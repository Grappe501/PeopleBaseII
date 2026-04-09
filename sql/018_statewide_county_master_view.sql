-- Statewide county master view (Arkansas): extends the CD2 county master pattern to all counties.
-- Depends on: geo_counties, census_county_acs, raw_vr_county_mapped, raw_vh, raw_vr,
--             voter_initiative_signatures, elections, races, election_contests,
--             election_results, race_candidates (013+ mixed geography), optional BLS latest views.
-- Idempotent: safe to re-run.

drop view if exists public.statewide_county_master_v cascade;

create or replace view public.statewide_county_master_v
with (security_invoker = true)
as
with
params as (
  select
    600000::bigint as statewide_vote_target,
    date '2025-11-01' as registration_window_start,
    date '2026-11-01' as registration_window_end
),

acs_latest as (
  select distinct on (c.county_id)
    c.county_id,
    c.source_year as acs_source_year,
    c.total_population,
    c.voting_age_population,
    c.white_population,
    c.black_population,
    c.hispanic_population,
    c.asian_population,
    c.median_household_income,
    c.poverty_population,
    c.bachelors_or_higher,
    c.owner_occupied_housing,
    c.renter_occupied_housing
  from public.census_county_acs c
  order by c.county_id, c.source_year desc
),

vr_counts as (
  select
    m.mapped_county_id as county_id,
    count(*)::bigint as vr_voters,
    count(distinct nullif(trim(coalesce(rv.voter_id, '')), ''))::bigint as vr_unique_voters
  from public.raw_vr_county_mapped m
  join public.raw_vr rv on rv.id = m.id
  where m.mapped_county_id is not null
  group by m.mapped_county_id
),

vh_counts as (
  select
    g.id as county_id,
    count(
      distinct coalesce(
        nullif(trim(v.voter_id), ''),
        nullif(trim(v.key_registrant), '')
      )
    )::bigint as vh_unique_voters
  from public.raw_vh v
  join public.geo_counties g
    on g.state_fips = '05'
   and g.normalized_county_name = public.normalize_geo_name(v.county::text)
  where v.county is not null
    and trim(v.county::text) <> ''
  group by g.id
),

-- Registration window counts (goal tracking 50k new registrants statewide Nov 2025 → Nov 2026).
vr_regdate_parsed as (
  select
    m.mapped_county_id as county_id,
    rv.voter_id,
    rv.key_registrant,
    coalesce(
      to_date(nullif(trim(rv.date_of_registration), ''), 'YYYY-MM-DD'),
      to_date(nullif(trim(rv.date_of_registration), ''), 'MM/DD/YYYY')
    ) as registration_date
  from public.raw_vr rv
  join public.raw_vr_county_mapped m on m.id = rv.id
  where m.mapped_county_id is not null
),
vr_registration_window as (
  select
    v.county_id,
    count(*)::bigint as registrations_in_window_rows,
    count(
      distinct coalesce(
        nullif(trim(v.voter_id), ''),
        nullif(trim(v.key_registrant), '')
      )
    )::bigint as registrations_in_window_unique_voters
  from vr_regdate_parsed v
  cross join params p
  where v.registration_date is not null
    and v.registration_date >= p.registration_window_start
    and v.registration_date < p.registration_window_end
  group by v.county_id
),

er_enriched as (
  select
    er.race_id,
    er.county_id,
    e.election_year,
    e.election_type,
    ec.contest_name,
    er.candidate_name,
    er.votes::bigint as votes,
    coalesce(
      nullif(trim(rc.party), ''),
      nullif(trim(er.party), ''),
      case
        when e.election_year = 2022
          and e.election_type = 'general'
          and ec.contest_name ilike '%governor%'
          and ec.contest_name !~* 'lieutenant'
        then case
          when er.candidate_name ilike '%Chris Jones%' then 'DEM'
          when er.candidate_name ilike '%Sarah Huckabee Sanders%' then 'REP'
          when er.candidate_name ilike '%Harrington%' then 'LIB'
          else null
        end
        when e.election_year = 2024
          and e.election_type = 'general'
          and ec.contest_name ilike '%u.s.%president%'
        then case
          when er.candidate_name ~* 'Kamala|Harris|Walz' then 'DEM'
          when er.candidate_name ~* 'Trump|Vance' then 'REP'
          else null
        end
        else null
      end
    ) as effective_party
  from public.election_results er
  join public.races r on r.id = er.race_id
  join public.elections e on e.id = r.election_id
  join public.election_contests ec on ec.id = er.contest_id
  left join public.race_candidates rc
    on rc.race_id = r.id
   and rc.candidate_name = er.candidate_name
  where er.county_id is not null
    and er.geography_type in ('county', 'precinct')
),

sos2026_races as (
  select distinct r.id as race_id
  from public.races r
  join public.elections el on el.id = r.election_id
  join public.election_contests ec on ec.race_id = r.id
  where el.election_year = 2026
    and ec.contest_name ilike '%secretary%state%'
),
sos2026_has_dem as (
  select
    sr.race_id,
    exists (
      select 1
      from public.race_candidates rc
      where rc.race_id = sr.race_id
        and rc.party = 'DEM'
    ) as has_dem_candidate
  from sos2026_races sr
),

gov2022 as (
  select
    x.county_id,
    sum(x.votes) filter (where x.effective_party = 'DEM')::bigint as dem_votes,
    sum(x.votes)::bigint as total_votes
  from er_enriched x
  where x.election_year = 2022
    and x.election_type = 'general'
    and x.contest_name ilike '%governor%'
    and x.contest_name !~* 'lieutenant'
  group by x.county_id
),
pres2024 as (
  select
    x.county_id,
    sum(x.votes) filter (where x.effective_party = 'DEM')::bigint as dem_votes,
    sum(x.votes)::bigint as total_votes
  from er_enriched x
  where x.election_year = 2024
    and x.election_type = 'general'
    and x.contest_name ilike '%u.s.%president%'
  group by x.county_id
),
sos2026 as (
  select
    x.county_id,
    sum(x.votes) filter (where x.effective_party = 'DEM')::bigint as dem_votes,
    sum(x.votes)::bigint as total_votes,
    bool_or(coalesce(h.has_dem_candidate, false)) as race_has_dem
  from er_enriched x
  join sos2026_races sr on sr.race_id = x.race_id
  left join sos2026_has_dem h on h.race_id = x.race_id
  group by x.county_id
),

initiative_sig as (
  select
    m.mapped_county_id as county_id,
    vi.initiative,
    count(*)::bigint as signer_count
  from public.voter_initiative_signatures vi
  join public.raw_vr rv
    on (vi.voter_id is not null and rv.voter_id = vi.voter_id)
    or (
      vi.voter_id is null
      and vi.key_registrant is not null
      and rv.key_registrant = vi.key_registrant
    )
  join public.raw_vr_county_mapped m on m.id = rv.id
  where m.mapped_county_id is not null
  group by m.mapped_county_id, vi.initiative
),
initiative_pivot as (
  select
    county_id,
    max(signer_count) filter (where initiative = 'redistricting')::bigint as redistricting_signers,
    max(signer_count) filter (where initiative = 'marijuana')::bigint as marijuana_signers,
    max(signer_count) filter (where initiative = 'casino')::bigint as casino_signers,
    max(signer_count) filter (where initiative = 'ranked_choice')::bigint as ranked_choice_signers
  from initiative_sig
  group by county_id
),

expected_turnout as (
  select
    gc.id as county_id,
    round(
      coalesce(vr.vr_unique_voters, 0)::numeric
      * (coalesce(vh.vh_unique_voters, 0)::numeric / nullif(coalesce(vr.vr_unique_voters, 0)::numeric, 0)),
      0
    )::bigint as expected_turnout_votes
  from public.geo_counties gc
  left join vr_counts vr on vr.county_id = gc.id
  left join vh_counts vh on vh.county_id = gc.id
  where gc.state_fips = '05'
),

state_totals as (
  select
    sum(coalesce(vr.vr_unique_voters, 0))::bigint as state_vr_unique_voters,
    sum(coalesce(vh.vh_unique_voters, 0))::bigint as state_vh_unique_voters,
    sum(coalesce(et.expected_turnout_votes, 0))::bigint as state_expected_turnout_votes
  from public.geo_counties gc
  left join vr_counts vr on vr.county_id = gc.id
  left join vh_counts vh on vh.county_id = gc.id
  left join expected_turnout et on et.county_id = gc.id
  where gc.state_fips = '05'
),

county_out as (
  select
    gc.id as county_id,
    gc.county_name,
    gc.state_fips,
    gc.county_fips,

    al.acs_source_year,
    al.total_population,
    al.voting_age_population,
    al.white_population,
    al.black_population,
    al.hispanic_population,
    al.asian_population,
    al.median_household_income,
    al.poverty_population,
    al.bachelors_or_higher,
    al.owner_occupied_housing,
    al.renter_occupied_housing,

    round(100.0 * al.black_population::numeric / nullif(al.total_population, 0), 4) as pct_black_population,
    round(100.0 * al.white_population::numeric / nullif(al.total_population, 0), 4) as pct_white_population,
    round(100.0 * al.hispanic_population::numeric / nullif(al.total_population, 0), 4) as pct_hispanic_population,
    round(100.0 * al.asian_population::numeric / nullif(al.total_population, 0), 4) as pct_asian_population,
    round(100.0 * al.poverty_population::numeric / nullif(al.total_population, 0), 4) as poverty_rate_pct,
    round(100.0 * al.bachelors_or_higher::numeric / nullif(al.voting_age_population, 0), 4) as bachelors_or_higher_rate_pct,
    round(
      100.0 * al.renter_occupied_housing::numeric
        / nullif(coalesce(al.owner_occupied_housing, 0) + coalesce(al.renter_occupied_housing, 0), 0),
      4
    ) as renter_share_pct,

    coalesce(vr.vr_voters, 0::bigint) as vr_voters,
    coalesce(vr.vr_unique_voters, 0::bigint) as vr_unique_voters,
    round(
      100.0 * coalesce(vr.vr_unique_voters, 0)::numeric / nullif(al.voting_age_population, 0),
      4
    ) as registration_rate_pct,

    coalesce(vh.vh_unique_voters, 0::bigint) as vh_unique_voters,
    round(
      100.0 * coalesce(vh.vh_unique_voters, 0)::numeric / nullif(vr.vr_unique_voters, 0),
      4
    ) as turnout_rate_pct,

    coalesce(ip.redistricting_signers, 0::bigint) as redistricting_signers,
    coalesce(ip.marijuana_signers, 0::bigint) as marijuana_signers,
    coalesce(ip.casino_signers, 0::bigint) as casino_signers,
    coalesce(ip.ranked_choice_signers, 0::bigint) as ranked_choice_signers,
    round(1000.0 * coalesce(ip.redistricting_signers, 0)::numeric / nullif(vr.vr_unique_voters, 0), 4) as redistricting_signers_per_1k_vr,
    round(1000.0 * coalesce(ip.marijuana_signers, 0)::numeric / nullif(vr.vr_unique_voters, 0), 4) as marijuana_signers_per_1k_vr,
    round(1000.0 * coalesce(ip.casino_signers, 0)::numeric / nullif(vr.vr_unique_voters, 0), 4) as casino_signers_per_1k_vr,
    round(1000.0 * coalesce(ip.ranked_choice_signers, 0)::numeric / nullif(vr.vr_unique_voters, 0), 4) as ranked_choice_signers_per_1k_vr,

    round(100.0 * g22.dem_votes::numeric / nullif(g22.total_votes, 0), 4) as dem_pct_2022_governor,
    round(100.0 * p24.dem_votes::numeric / nullif(p24.total_votes, 0), 4) as dem_pct_2024_president,
    case
      when s6.race_has_dem is not true then null
      else round(100.0 * s6.dem_votes::numeric / nullif(s6.total_votes, 0), 4)
    end as dem_pct_2026_sos,

    round(
      (round(100.0 * p24.dem_votes::numeric / nullif(p24.total_votes, 0), 4))
      - (round(100.0 * g22.dem_votes::numeric / nullif(g22.total_votes, 0), 4)),
      4
    ) as dem_swing_2022_to_2024,
    case
      when s6.race_has_dem is not true then null
      else round(
        (round(100.0 * s6.dem_votes::numeric / nullif(s6.total_votes, 0), 4))
        - (round(100.0 * p24.dem_votes::numeric / nullif(p24.total_votes, 0), 4)),
        4
      )
    end as dem_swing_2024_to_2026,

    (select statewide_vote_target from params) as statewide_vote_target,
    (select state_vr_unique_voters from state_totals) as statewide_vr_unique_voters,
    (select state_expected_turnout_votes from state_totals) as statewide_expected_turnout_votes,

    -- County share of state electorate and proportional target under 600k scenario.
    round(
      coalesce(vr.vr_unique_voters, 0)::numeric
      / nullif((select state_vr_unique_voters from state_totals), 0),
      8
    ) as county_vote_share_of_state,
    round(
      (select statewide_vote_target from params)::numeric
      * coalesce(vr.vr_unique_voters, 0)::numeric
      / nullif((select state_vr_unique_voters from state_totals), 0),
      0
    )::bigint as county_target_votes_at_proportional_share,

    coalesce(et.expected_turnout_votes, 0::bigint) as expected_turnout_votes,
    (floor(coalesce(et.expected_turnout_votes, 0)::numeric / 2.0) + 1)::bigint as county_votes_needed_for_majority_of_expected_turnout,

    round(
      coalesce(et.expected_turnout_votes, 0)::numeric
      * (coalesce(round(100.0 * p24.dem_votes::numeric / nullif(p24.total_votes, 0), 4), 0)::numeric / 100.0),
      0
    )::bigint as expected_democratic_baseline_votes,

    coalesce(vrw.registrations_in_window_unique_voters, 0::bigint) as registrations_2025_11_to_2026_11_unique_voters
  from public.geo_counties gc
  left join acs_latest al on al.county_id = gc.id
  left join vr_counts vr on vr.county_id = gc.id
  left join vh_counts vh on vh.county_id = gc.id
  left join initiative_pivot ip on ip.county_id = gc.id
  left join gov2022 g22 on g22.county_id = gc.id
  left join pres2024 p24 on p24.county_id = gc.id
  left join sos2026 s6 on s6.county_id = gc.id
  left join expected_turnout et on et.county_id = gc.id
  left join vr_registration_window vrw on vrw.county_id = gc.id
  where gc.state_fips = '05'
)

select
  c.*,

  -- Opportunity heuristics (bounded 0–100); designed for ranking, not prediction.
  round(least(100::numeric, greatest(0::numeric, (100::numeric - coalesce(c.turnout_rate_pct, 0)))) , 2)
    as county_turnout_opportunity_score,

  round(least(100::numeric, greatest(0::numeric, (100::numeric - coalesce(c.registration_rate_pct, 0)))), 2)
    as county_registration_opportunity_score,

  round(least(100::numeric, greatest(0::numeric, coalesce(c.dem_pct_2024_president, c.dem_pct_2022_governor, 0))), 2)
    as county_democratic_baseline_score,

  round(
    least(
      100::numeric,
      greatest(
        0::numeric,
        -- Civic activity proxy: initiative signers per 1k + turnout rate blend.
        0.60 * least(
          100::numeric,
          2.5 * coalesce(
            (coalesce(c.redistricting_signers_per_1k_vr, 0)
             + coalesce(c.marijuana_signers_per_1k_vr, 0)
             + coalesce(c.casino_signers_per_1k_vr, 0)
             + coalesce(c.ranked_choice_signers_per_1k_vr, 0)),
            0
          )
        )
        + 0.40 * coalesce(c.turnout_rate_pct, 0)
      )
    ),
    2
  ) as county_civic_activity_score,

  round(
    least(
      100::numeric,
      greatest(
        0::numeric,
        -- Priority score: weight opportunity + baseline + electorate size (share).
        0.32 * (100::numeric - coalesce(c.turnout_rate_pct, 0)) +
        0.28 * (100::numeric - coalesce(c.registration_rate_pct, 0)) +
        0.22 * coalesce(c.dem_pct_2024_president, c.dem_pct_2022_governor, 0) +
        0.18 * least(100::numeric, 1000::numeric * coalesce(c.county_vote_share_of_state, 0))
      )
    ),
    2
  ) as county_priority_score

from county_out c;

comment on view public.statewide_county_master_v is
  'Statewide (AR) county master: ACS demographics, VR/VH, initiatives, election baselines/trends, scenario planning under statewide_vote_target, and derived opportunity/priority scores.';

