-- CD2 Democrat growth targeting: ranked precincts + voters with lean / contact priority scores.
-- Depends on: cd2_precinct_priority_v, raw_vr, raw_vr_county_mapped, raw_vh,
--             geo_counties, county_congressional_districts.

drop view if exists public.cd2_dem_target_voters_v cascade;
drop view if exists public.cd2_dem_target_precincts_v cascade;

-- Precincts: combine voter concentration (density), competitive persuasion band, mobilization, initiative.
create view public.cd2_dem_target_precincts_v
with (security_invoker = true)
as
with base as (
  select
    p.*,
    max(coalesce(p.registered_voters, 0)) over () as cd2_max_registered_voters
  from public.cd2_precinct_priority_v p
  where coalesce(p.registered_voters, 0) > 0
),
scored as (
  select
    b.*,
    round(
      100.0 * b.registered_voters::numeric / nullif(b.cd2_max_registered_voters, 0),
      2
    ) as voter_density_weight_0_100,
    round(
      greatest(0, 100 - abs(coalesce(b.baseline_dem_pct, 0) - 49) * 2.2),
      2
    ) as persuasion_swing_score_0_100,
    round(
      greatest(0, 100 - coalesce(b.turnout_rate_pct, 0))
        * coalesce(b.baseline_dem_pct, 0) / 100.0,
      2
    ) as mobilization_blend_score,
    round(
      0.32 * (100.0 * b.registered_voters::numeric / nullif(b.cd2_max_registered_voters, 0))
      + 0.28 * greatest(0, 100 - abs(coalesce(b.baseline_dem_pct, 0) - 49) * 2.2)
      + 0.25 * (
        greatest(0, 100 - coalesce(b.turnout_rate_pct, 0))
        * coalesce(b.baseline_dem_pct, 0) / 100.0
      )
      + 0.15 * coalesce(b.initiative_engagement_score, 0),
      2
    ) as dem_growth_target_score
  from base b
)
select
  s.*,
  ntile(5) over (order by s.dem_growth_target_score desc) as target_quintile,
  case ntile(5) over (order by s.dem_growth_target_score desc)
    when 1 then 'primary'
    when 2 then 'secondary'
    else 'watch'
  end as target_tier
from scored s;

comment on view public.cd2_dem_target_precincts_v is
  'CD2 precincts ranked for Dem vote growth: density (share of CD2 registrants), persuasion (near 49% Dem baseline), mobilization (gap x lean), initiative engagement. Quintile 1 = top 20%.';

-- Voters in primary/secondary precincts (top 40%) with lean score and contact priority.
create view public.cd2_dem_target_voters_v
with (security_invoker = true)
as
with vh_n as (
  select
    voter_id,
    count(*)::bigint as vh_event_rows
  from public.raw_vh
  group by voter_id
),
joined as (
  select
    rv.voter_id,
    rv.key_registrant,
    m.mapped_county_id as county_id,
    gc.county_name,
    case
      when coalesce(nullif(trim(rv.precinct_name), ''), '') = ''
        then '(unknown)'
      else regexp_replace(lower(trim(rv.precinct_name)), '\s+', ' ', 'g')
    end as precinct_label,
    rv.party as party_raw,
    case
      when upper(coalesce(rv.party, '')) like '%DEM%' then 92::numeric
      when upper(coalesce(rv.party, '')) like '%REP%' then 6::numeric
      when upper(coalesce(rv.party, '')) like '%LIB%' then 28::numeric
      when upper(trim(coalesce(rv.party, ''))) in ('IND', 'NON', 'NONE', 'NONPARTISAN', '') then 42::numeric
      else 38::numeric
    end as party_lean_0_100,
    p.baseline_dem_pct as precinct_dem_baseline_pct,
    p.dem_growth_target_score as precinct_dem_growth_target_score,
    p.target_quintile as precinct_target_quintile,
    p.target_tier as precinct_target_tier,
    p.voter_density_weight_0_100 as precinct_voter_density_weight_0_100,
    p.registered_voters as precinct_registered_voters,
    case
      when vh_n.vh_event_rows is not null then true
      else false
    end as has_vote_history,
    coalesce(vh_n.vh_event_rows, 0::bigint) as vh_event_rows,
    least(
      100::numeric,
      greatest(
        0::numeric,
        0.55 * (
          case
            when upper(coalesce(rv.party, '')) like '%DEM%' then 92::numeric
            when upper(coalesce(rv.party, '')) like '%REP%' then 6::numeric
            when upper(coalesce(rv.party, '')) like '%LIB%' then 28::numeric
            when upper(trim(coalesce(rv.party, ''))) in ('IND', 'NON', 'NONE', 'NONPARTISAN', '') then 42::numeric
            else 38::numeric
          end
        )
        + 0.45 * coalesce(p.baseline_dem_pct, 45::numeric)
      )
    ) as dem_lean_score_raw
  from public.raw_vr rv
  join public.raw_vr_county_mapped m
    on m.id = rv.id
  join public.geo_counties gc
    on gc.id = m.mapped_county_id
  join public.county_congressional_districts ccd
    on ccd.county_id = m.mapped_county_id
   and ccd.state_fips::text = '05'
   and ccd.congressional_district::numeric = 2
  join public.cd2_dem_target_precincts_v p
    on p.county_id = m.mapped_county_id
   and p.precinct_label = case
      when coalesce(nullif(trim(rv.precinct_name), ''), '') = ''
        then '(unknown)'
      else regexp_replace(lower(trim(rv.precinct_name)), '\s+', ' ', 'g')
    end
  left join vh_n
    on vh_n.voter_id = rv.voter_id
  where m.mapped_county_id is not null
    and p.target_quintile <= 2
)
select
  j.voter_id,
  j.key_registrant,
  j.county_id,
  j.county_name,
  j.precinct_label,
  j.party_raw,
  j.party_lean_0_100,
  round(j.dem_lean_score_raw, 2) as dem_lean_score,
  round(100::numeric - j.dem_lean_score_raw, 2) as dem_lean_headroom,
  j.precinct_dem_baseline_pct,
  j.precinct_dem_growth_target_score,
  j.precinct_target_quintile,
  j.precinct_target_tier,
  j.precinct_voter_density_weight_0_100,
  j.precinct_registered_voters,
  j.has_vote_history,
  j.vh_event_rows,
  round(
    j.precinct_dem_growth_target_score
    * ((100::numeric - j.dem_lean_score_raw) / 100.0)
    * (j.precinct_voter_density_weight_0_100 / 100.0),
    4
  ) as voter_dem_growth_priority_score
from joined j;

comment on view public.cd2_dem_target_voters_v is
  'CD2 voters in precincts with target_quintile 1–2: party + precinct blended dem_lean_score, headroom, precinct growth score, voter_dem_growth_priority (density x headroom x precinct score).';

