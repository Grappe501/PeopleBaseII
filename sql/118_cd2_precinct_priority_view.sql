-- CD2 precinct priority scoring (election + VR/VH turnout + ballot initiatives).
-- Depends on: geo_counties, county_congressional_districts, election_results,
--             election_contests, elections, raw_vr, raw_vh, raw_vr_county_mapped,
--             voter_initiative_signatures.
-- Idempotent: safe to re-run.
-- Replace requires DROP first when output columns change (Postgres cannot reorder via OR REPLACE).

drop view if exists public.cd2_precinct_priority_v cascade;

create view public.cd2_precinct_priority_v
with (security_invoker = true)
as
with cd2_counties as (
  select
    gc.id as county_id,
    gc.county_name
  from public.geo_counties gc
  join public.county_congressional_districts ccd
    on ccd.county_id = gc.id
  where ccd.state_fips::text = '05'
    and ccd.congressional_district::numeric = 2
),

precinct_results_base as (
  select
    gc.id as county_id,
    gc.county_name,
    case
      when coalesce(nullif(trim(coalesce(er.source_precinct_name, er.location_label, er.location_raw)), ''), '') = ''
        then '(unknown)'
      else regexp_replace(
        lower(trim(coalesce(er.source_precinct_name, er.location_label, er.location_raw))),
        '\s+',
        ' ',
        'g'
      )
    end as precinct_label,
    e.election_year,
    ec.contest_name,
    lower(coalesce(er.party, '')) as party,
    coalesce(er.votes, 0) as votes
  from public.election_results er
  join public.election_contests ec
    on ec.id = er.contest_id
  join public.elections e
    on e.id = ec.election_id
  join public.geo_counties gc
    on gc.id = coalesce(
      er.county_id,
      (
        select g.id
        from public.geo_counties g
        where er.location_raw is not null
          and lower(g.county_name) = lower(replace(er.location_raw, ' County', ''))
        limit 1
      )
    )
  join cd2_counties c
    on c.county_id = gc.id
  where er.geography_type = 'precinct'
),

county_dem_2024_pres as (
  select
    county_id,
    round(
      100.0 * sum(case when party = 'dem' then votes else 0 end)::numeric
      / nullif(sum(votes), 0),
      4
    ) as county_dem_pct
  from precinct_results_base
  where election_year = 2024
    and lower(contest_name) like '%president%'
  group by county_id
),

county_dem_2022_gov as (
  select
    county_id,
    round(
      100.0 * sum(case when party = 'dem' then votes else 0 end)::numeric
      / nullif(sum(votes), 0),
      4
    ) as county_dem_pct
  from precinct_results_base
  where election_year = 2022
    and lower(contest_name) like '%governor%'
  group by county_id
),

cd2_dem_2024_pres as (
  select
    round(
      100.0 * sum(case when party = 'dem' then votes else 0 end)::numeric
      / nullif(sum(votes), 0),
      4
    ) as cd2_dem_pct
  from precinct_results_base
  where election_year = 2024
    and lower(contest_name) like '%president%'
),

cd2_dem_2022_gov as (
  select
    round(
      100.0 * sum(case when party = 'dem' then votes else 0 end)::numeric
      / nullif(sum(votes), 0),
      4
    ) as cd2_dem_pct
  from precinct_results_base
  where election_year = 2022
    and lower(contest_name) like '%governor%'
),

-- When precinct-level election rows are missing or do not join to VR precinct keys, use the same
-- county / CD2 aggregates as cd2_county_master_v (race-based SOS ingest path).
county_dem_master_seed as (
  select
    cm.county_id,
    cm.county_name,
    cm.registered_voters,
    -- Seed: observed county Dem % (prefer 2024 pres, else 2022 gov).
    round(coalesce(cm.pres_2024_general_dem_pct, cm.gov_2022_general_dem_pct), 4) as dem_pct_seed,
    -- Socio-demographic feature space (county-level proxy for "nearest geographic+socio-economic").
    coalesce(cm.pct_black_population, 0)::numeric as pct_black,
    coalesce(cm.pct_hispanic_population, 0)::numeric as pct_hispanic,
    coalesce(cm.poverty_rate_pct, 0)::numeric as poverty,
    coalesce(cm.renter_share_pct, 0)::numeric as renter_share,
    coalesce(cm.registration_rate_pct, 0)::numeric as registration_rate,
    coalesce(cm.turnout_rate_pct, 0)::numeric as turnout_rate
  from public.cd2_county_master_v cm
),

county_dem_master_fallback as (
  select
    a.county_id,
    round(
      coalesce(
        -- Use the county’s own observed baseline if present.
        nullif(a.dem_pct_seed, 0::numeric),
        -- Else: average of the 3 most similar CD2 counties that *do* have a baseline.
        (
          select avg(n.dem_pct_seed)::numeric
          from (
            select b.dem_pct_seed
            from county_dem_master_seed b
            where b.dem_pct_seed is not null
              and b.dem_pct_seed <> 0::numeric
              and b.county_id <> a.county_id
            order by (
              power(a.pct_black - b.pct_black, 2)
              + power(a.pct_hispanic - b.pct_hispanic, 2)
              + power(a.poverty - b.poverty, 2)
              + power(a.renter_share - b.renter_share, 2)
              + power(a.registration_rate - b.registration_rate, 2)
              + power(a.turnout_rate - b.turnout_rate, 2)
            ) asc
            limit 3
          ) n
        ),
        -- Last resort: CD2-wide average of observed counties.
        (
          select avg(b.dem_pct_seed)::numeric
          from county_dem_master_seed b
          where b.dem_pct_seed is not null and b.dem_pct_seed <> 0::numeric
        )
      ),
      4
    ) as county_dem_pct
  from county_dem_master_seed a
),

cd2_dem_master_fallback as (
  select
    round(
      sum(coalesce(f.county_dem_pct, 0)::numeric * coalesce(s.registered_voters, 0)::numeric)
      / nullif(sum(coalesce(s.registered_voters, 0)), 0),
      4
    ) as cd2_dem_pct
  from county_dem_master_seed s
  join county_dem_master_fallback f on f.county_id = s.county_id
),

precinct_2022_governor as (
  select
    county_id,
    county_name,
    precinct_label,
    sum(votes) as total_votes_2022_governor,
    round(
      100.0 * sum(case when party = 'dem' then votes else 0 end)::numeric
      / nullif(sum(votes), 0),
      2
    ) as dem_pct_2022_governor
  from precinct_results_base
  where election_year = 2022
    and lower(contest_name) like '%governor%'
  group by county_id, county_name, precinct_label
),

precinct_2024_president as (
  select
    county_id,
    county_name,
    precinct_label,
    sum(votes) as total_votes_2024_president,
    round(
      100.0 * sum(case when party = 'dem' then votes else 0 end)::numeric
      / nullif(sum(votes), 0),
      2
    ) as dem_pct_2024_president
  from precinct_results_base
  where election_year = 2024
    and lower(contest_name) like '%president%'
  group by county_id, county_name, precinct_label
),

precinct_2026_primary as (
  select
    county_id,
    county_name,
    precinct_label,
    sum(votes) as total_votes_2026_primary,
    round(
      100.0 * sum(case when party = 'dem' then votes else 0 end)::numeric
      / nullif(sum(votes), 0),
      2
    ) as dem_pct_2026_primary
  from precinct_results_base
  where election_year = 2026
  group by county_id, county_name, precinct_label
),

precinct_vr as (
  select
    m.mapped_county_id as county_id,
    case
      when coalesce(nullif(trim(rv.precinct_name), ''), '') = ''
        then '(unknown)'
      else regexp_replace(lower(trim(rv.precinct_name)), '\s+', ' ', 'g')
    end as precinct_label,
    count(*) as registered_voters
  from public.raw_vr rv
  join public.raw_vr_county_mapped m
    on m.voter_id = rv.voter_id
  join cd2_counties c
    on c.county_id = m.mapped_county_id
  group by
    m.mapped_county_id,
    case
      when coalesce(nullif(trim(rv.precinct_name), ''), '') = ''
        then '(unknown)'
      else regexp_replace(lower(trim(rv.precinct_name)), '\s+', ' ', 'g')
    end
),

precinct_vh as (
  select
    m.mapped_county_id as county_id,
    case
      when coalesce(nullif(trim(rv.precinct_name), ''), '') = ''
        then '(unknown)'
      else regexp_replace(lower(trim(rv.precinct_name)), '\s+', ' ', 'g')
    end as precinct_label,
    count(distinct vh.voter_id) as turnout_voters
  from public.raw_vh vh
  join public.raw_vr rv
    on rv.voter_id = vh.voter_id
  join public.raw_vr_county_mapped m
    on m.voter_id = rv.voter_id
  join cd2_counties c
    on c.county_id = m.mapped_county_id
  group by
    m.mapped_county_id,
    case
      when coalesce(nullif(trim(rv.precinct_name), ''), '') = ''
        then '(unknown)'
      else regexp_replace(lower(trim(rv.precinct_name)), '\s+', ' ', 'g')
    end
),

precinct_initiative_base as (
  select distinct
    m.mapped_county_id as county_id,
    case
      when coalesce(nullif(trim(rv.precinct_name), ''), '') = ''
        then '(unknown)'
      else regexp_replace(lower(trim(rv.precinct_name)), '\s+', ' ', 'g')
    end as precinct_label,
    vi.initiative,
    coalesce(vi.voter_id, vi.key_registrant) as signer_key
  from public.voter_initiative_signatures vi
  join public.raw_vr rv
    on (vi.voter_id is not null and rv.voter_id = vi.voter_id)
    or (
      vi.voter_id is null
      and vi.key_registrant is not null
      and rv.key_registrant = vi.key_registrant
    )
  join public.raw_vr_county_mapped m on m.id = rv.id
  join cd2_counties c
    on c.county_id = m.mapped_county_id
  where m.mapped_county_id is not null
),

precinct_initiative_agg as (
  select
    county_id,
    precinct_label,
    count(*) filter (where initiative = 'redistricting')::bigint as signers_redistricting,
    count(*) filter (where initiative = 'marijuana')::bigint as signers_marijuana,
    count(*) filter (where initiative = 'casino')::bigint as signers_casino,
    count(*) filter (where initiative = 'ranked_choice')::bigint as signers_ranked_choice,
    count(*)::bigint as initiative_signature_rows,
    count(distinct signer_key)::bigint as initiative_unique_signers
  from precinct_initiative_base
  group by county_id, precinct_label
),

precinct_base as (
  select
    coalesce(g22.county_id, p24.county_id, p26.county_id, vr.county_id) as county_id,
    coalesce(g22.county_name, p24.county_name, p26.county_name, gc_vr.county_name) as county_name,
    coalesce(g22.precinct_label, p24.precinct_label, p26.precinct_label, vr.precinct_label) as precinct_label,

    g22.total_votes_2022_governor,
    g22.dem_pct_2022_governor,
    p24.total_votes_2024_president,
    p24.dem_pct_2024_president,
    p26.total_votes_2026_primary,
    p26.dem_pct_2026_primary,

    vr.registered_voters,
    vh.turnout_voters,

    ini.signers_redistricting,
    ini.signers_marijuana,
    ini.signers_casino,
    ini.signers_ranked_choice,
    ini.initiative_signature_rows,
    ini.initiative_unique_signers,

    case
      when vr.registered_voters > 0
        then round(100.0 * vh.turnout_voters::numeric / vr.registered_voters, 2)
      else null
    end as turnout_rate_pct
  from precinct_2022_governor g22
  full outer join precinct_2024_president p24
    on p24.county_id = g22.county_id
   and p24.precinct_label = g22.precinct_label
  full outer join precinct_2026_primary p26
    on p26.county_id = coalesce(g22.county_id, p24.county_id)
   and p26.precinct_label = coalesce(g22.precinct_label, p24.precinct_label)
  full outer join precinct_vr vr
    on vr.county_id = coalesce(g22.county_id, p24.county_id, p26.county_id)
   and vr.precinct_label = coalesce(g22.precinct_label, p24.precinct_label, p26.precinct_label)
  left join precinct_vh vh
    on vh.county_id = vr.county_id
   and vh.precinct_label = vr.precinct_label
  left join public.geo_counties gc_vr
    on gc_vr.id = vr.county_id
  left join precinct_initiative_agg ini
    on ini.county_id = coalesce(g22.county_id, p24.county_id, p26.county_id, vr.county_id)
   and ini.precinct_label = coalesce(
      g22.precinct_label,
      p24.precinct_label,
      p26.precinct_label,
      vr.precinct_label
    )
),

precinct_out as (
  select
    pb.*,
    max(coalesce(pb.total_votes_2024_president, 0)) over () as cd2_max_total_votes_2024_pres,
    c24.county_dem_pct as county_dem_pct_2024_fallback,
    c22.county_dem_pct as county_dem_pct_2022_fallback,
    d24.cd2_dem_pct as cd2_dem_pct_2024_fallback,
    d22.cd2_dem_pct as cd2_dem_pct_2022_fallback,
    mf.county_dem_pct as county_dem_master_fallback_pct,
    d2m.cd2_dem_pct as cd2_dem_master_fallback_pct
  from precinct_base pb
  left join county_dem_2024_pres c24
    on c24.county_id = pb.county_id
  left join county_dem_2022_gov c22
    on c22.county_id = pb.county_id
  left join county_dem_master_fallback mf
    on mf.county_id = pb.county_id
  cross join cd2_dem_2024_pres d24
  cross join cd2_dem_2022_gov d22
  cross join cd2_dem_master_fallback d2m
  where pb.precinct_label is not null
)

select
  county_id,
  county_name,
  precinct_label,
  total_votes_2022_governor,
  dem_pct_2022_governor,
  total_votes_2024_president,
  dem_pct_2024_president,
  total_votes_2026_primary,
  dem_pct_2026_primary,
  registered_voters,
  turnout_voters,
  turnout_rate_pct,

  signers_redistricting,
  signers_marijuana,
  signers_casino,
  signers_ranked_choice,
  initiative_signature_rows,
  initiative_unique_signers,

  round(
    case
      when registered_voters > 0 and initiative_unique_signers is not null
        then 1000.0 * initiative_unique_signers::numeric / registered_voters::numeric
      else null
    end,
    4
  ) as initiative_unique_per_1k_registrants,

  round(
    case
      when registered_voters > 0 and initiative_signature_rows is not null
        then 1000.0 * initiative_signature_rows::numeric / registered_voters::numeric
      else null
    end,
    4
  ) as initiative_signature_touches_per_1k_registrants,

  round(
    least(
      100.0,
      case
        when registered_voters > 0 and coalesce(initiative_unique_signers, 0) > 0
          then 3.5 * (1000.0 * initiative_unique_signers::numeric / registered_voters::numeric)
        else 0.0
      end
    ),
    2
  ) as initiative_engagement_score,

  round(
    case
      when registered_voters > 0
        and coalesce(initiative_unique_signers, 0) > 0
        and turnout_rate_pct is not null
        then greatest(0, 100.0 - turnout_rate_pct::numeric)
          * (1000.0 * initiative_unique_signers::numeric / registered_voters::numeric)
          / 40.0
      else null
    end,
    2
  ) as grassroots_mobilization_score,

  round(
    coalesce(
      nullif(dem_pct_2024_president, 0::numeric),
      nullif(dem_pct_2022_governor, 0::numeric),
      nullif(county_dem_pct_2024_fallback, 0::numeric),
      nullif(county_dem_pct_2022_fallback, 0::numeric),
      nullif(cd2_dem_pct_2024_fallback, 0::numeric),
      nullif(cd2_dem_pct_2022_fallback, 0::numeric),
      nullif(county_dem_master_fallback_pct, 0::numeric),
      nullif(cd2_dem_master_fallback_pct, 0::numeric),
      dem_pct_2024_president,
      dem_pct_2022_governor
    ),
    2
  ) as baseline_dem_pct,

  round(
    coalesce(dem_pct_2024_president, 0) - coalesce(dem_pct_2022_governor, 0),
    2
  ) as dem_swing_2022_to_2024,

  greatest(
    coalesce(total_votes_2024_president, total_votes_2022_governor, total_votes_2026_primary, 0),
    0
  ) as size_score_raw,

  round(
    greatest(0, 100 - coalesce(turnout_rate_pct, 0)),
    2
  ) as turnout_gap_score_raw,

  round(
    (0.45 * coalesce(total_votes_2024_president, 0)) +
    (0.25 * greatest(0, 100 - coalesce(turnout_rate_pct, 0))) +
    (0.30 * greatest(0, coalesce(dem_pct_2024_president, dem_pct_2022_governor, 0))),
    2
  ) as precinct_priority_score,

  round(
    case
      when cd2_max_total_votes_2024_pres > 0
        then 100.0 * coalesce(total_votes_2024_president, 0)::numeric / cd2_max_total_votes_2024_pres::numeric
      else 0.0
    end,
    2
  ) as election_size_score_0_100,

  round(
    (0.35 * case
      when cd2_max_total_votes_2024_pres > 0
        then 100.0 * coalesce(total_votes_2024_president, 0)::numeric / cd2_max_total_votes_2024_pres::numeric
      else 0.0
    end) +
    (0.22 * greatest(0, 100 - coalesce(turnout_rate_pct, 0))) +
    (0.26 * greatest(0, coalesce(dem_pct_2024_president, dem_pct_2022_governor, 0))) +
    (0.17 * least(
      100.0,
      case
        when registered_voters > 0 and coalesce(initiative_unique_signers, 0) > 0
          then 3.5 * (1000.0 * initiative_unique_signers::numeric / registered_voters::numeric)
        else 0.0
      end
    )),
    2
  ) as precinct_priority_score_balanced,

  round(
    (0.45 * coalesce(total_votes_2024_president, 0)) +
    (0.25 * greatest(0, 100 - coalesce(turnout_rate_pct, 0))) +
    (0.30 * greatest(0, coalesce(dem_pct_2024_president, dem_pct_2022_governor, 0))) +
    least(
      30.0,
      0.35 * coalesce(
        case
          when registered_voters > 0 and initiative_unique_signers is not null
            then 1000.0 * initiative_unique_signers::numeric / registered_voters::numeric
          else 0.0
        end,
        0.0
      )
    ),
    2
  ) as precinct_priority_score_with_initiative_boost

from precinct_out;

comment on view public.cd2_precinct_priority_v is
  'CD2 precinct priority: elections, VR/VH, ballot initiative signers (four slugs), per-1k rates, engagement and mobilization scores, legacy composite, balanced 0–100-weighted score, and initiative-boosted composite. baseline_dem_pct: precinct 2024 pres / 2022 gov, else county same-race rollups, else CD2 rollups; VR precinct labels normalized to match election precinct keys.';

