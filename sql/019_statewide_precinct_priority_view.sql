-- Statewide precinct priority scoring (Arkansas): elections + VR/VH turnout + optional initiative touches.
-- Purpose: identify high-information/high-opportunity precincts (NOT person-level partisan targeting).
-- Depends on: geo_counties, election_results (precinct rows), election_contests, elections,
--             raw_vr, raw_vh, raw_vr_county_mapped, voter_initiative_signatures.
-- Idempotent: safe to re-run.

drop view if exists public.statewide_precinct_priority_v cascade;

create view public.statewide_precinct_priority_v
with (security_invoker = true)
as
with
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
  where gc.state_fips = '05'
    and er.geography_type = 'precinct'
),

precinct_2022_governor as (
  select
    county_id,
    county_name,
    precinct_label,
    sum(votes)::bigint as total_votes_2022_governor,
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
    sum(votes)::bigint as total_votes_2024_president,
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
    sum(votes)::bigint as total_votes_2026_primary,
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
    count(*)::bigint as registered_voters
  from public.raw_vr rv
  join public.raw_vr_county_mapped m
    on m.id = rv.id
  where m.mapped_county_id is not null
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
    count(distinct vh.voter_id)::bigint as turnout_voters
  from public.raw_vh vh
  join public.raw_vr rv
    on rv.voter_id = vh.voter_id
  join public.raw_vr_county_mapped m
    on m.id = rv.id
  where m.mapped_county_id is not null
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
  join public.raw_vr_county_mapped m
    on m.id = rv.id
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
   and ini.precinct_label = coalesce(g22.precinct_label, p24.precinct_label, p26.precinct_label, vr.precinct_label)
),

scored as (
  select
    pb.*,
    max(coalesce(pb.registered_voters, 0)) over () as state_max_registered_voters,
    round(
      coalesce(
        nullif(pb.dem_pct_2024_president, 0::numeric),
        nullif(pb.dem_pct_2022_governor, 0::numeric),
        nullif(pb.dem_pct_2026_primary, 0::numeric),
        pb.dem_pct_2024_president,
        pb.dem_pct_2022_governor,
        pb.dem_pct_2026_primary
      ),
      2
    ) as baseline_dem_pct
  from precinct_base pb
  where pb.precinct_label is not null
)

select
  s.county_id,
  s.county_name,
  s.precinct_label,

  s.registered_voters,
  s.turnout_voters,
  s.turnout_rate_pct,

  s.total_votes_2022_governor,
  s.dem_pct_2022_governor,
  s.total_votes_2024_president,
  s.dem_pct_2024_president,
  s.total_votes_2026_primary,
  s.dem_pct_2026_primary,

  round(coalesce(s.dem_pct_2024_president, 0) - coalesce(s.dem_pct_2022_governor, 0), 2) as dem_swing_2022_to_2024,
  round(coalesce(s.dem_pct_2026_primary, 0) - coalesce(s.dem_pct_2024_president, 0), 2) as dem_swing_2024_to_2026,

  round(
    case
      when coalesce(s.state_max_registered_voters, 0) > 0
        then 100.0 * coalesce(s.registered_voters, 0)::numeric / s.state_max_registered_voters::numeric
      else 0.0
    end,
    2
  ) as precinct_size_score,

  round(greatest(0, 100 - coalesce(s.turnout_rate_pct, 0)), 2) as precinct_turnout_gap_score,
  round(greatest(0, coalesce(s.baseline_dem_pct, 0)), 2) as precinct_baseline_score,

  round(
    least(
      100::numeric,
      greatest(
        0::numeric,
        0.38 * (
          case
            when coalesce(s.state_max_registered_voters, 0) > 0
              then 100.0 * coalesce(s.registered_voters, 0)::numeric / s.state_max_registered_voters::numeric
            else 0.0
          end
        )
        + 0.34 * greatest(0, 100 - coalesce(s.turnout_rate_pct, 0))
        + 0.20 * greatest(0, coalesce(s.baseline_dem_pct, 0))
        + 0.08 * least(
          100::numeric,
          case
            when coalesce(s.registered_voters, 0) > 0 and coalesce(s.initiative_unique_signers, 0) > 0
              then 3.5 * (1000.0 * s.initiative_unique_signers::numeric / s.registered_voters::numeric)
            else 0.0
          end
        )
      )
    ),
    2
  ) as precinct_priority_score

from scored s;

comment on view public.statewide_precinct_priority_v is
  'Statewide AR precinct priority: elections + VR/VH turnout + initiative touches. Designed for identifying high-information / high-opportunity precincts, not person-level partisan targeting.';

