-- CD2 voter-level campaign score: initiatives + lean + VH + precinct context; segment buckets + hotspot rollup.
-- Depends on: raw_vr, raw_vr_county_mapped, voter_initiative_signatures, raw_vh, county_congressional_districts,
--             geo_counties, cd2_precinct_priority_v.

drop view if exists public.cd2_segment_hotspots_v cascade;
drop view if exists public.cd2_voter_scorecard_v cascade;

create view public.cd2_voter_scorecard_v
with (security_invoker = true)
as
with cd2 as (
  select gc.id as county_id
  from public.geo_counties gc
  join public.county_congressional_districts ccd
    on ccd.county_id = gc.id
  where ccd.state_fips::text = '05'
    and ccd.congressional_district::numeric = 2
),

precinct_ctx as (
  select
    p.county_id,
    p.precinct_label,
    p.baseline_dem_pct,
    p.initiative_engagement_score,
    p.registered_voters as precinct_registered_voters
  from public.cd2_precinct_priority_v p
),

vh_n as (
  select
    voter_id,
    count(*)::bigint as vh_event_rows
  from public.raw_vh
  group by voter_id
),

init_agg as (
  select
    rv.voter_id,
    count(*)::bigint as initiative_signature_rows,
    count(distinct vi.initiative)::bigint as initiative_breadth,
    bool_or(vi.initiative = 'ranked_choice') as signed_ranked_choice,
    bool_or(vi.initiative = 'redistricting') as signed_redistricting,
    bool_or(vi.initiative = 'marijuana') as signed_marijuana,
    bool_or(vi.initiative = 'casino') as signed_casino
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
  join cd2
    on cd2.county_id = m.mapped_county_id
  where m.mapped_county_id is not null
  group by rv.voter_id
),

vr_cd2 as (
  select
    rv.voter_id,
    rv.key_registrant,
    m.mapped_county_id as county_id,
    gc.county_name,
    case
      when coalesce(nullif(trim(rv.precinct_name), ''), '') = ''
        then '(unknown)'
      else regexp_replace(lower(trim(rv.precinct_name)), '\s+', ' ', 'g')
    end as precinct_label
  from public.raw_vr rv
  join public.raw_vr_county_mapped m
    on m.id = rv.id
  join public.geo_counties gc
    on gc.id = m.mapped_county_id
  join cd2
    on cd2.county_id = m.mapped_county_id
  where m.mapped_county_id is not null
),

scored as (
  select
    v.voter_id,
    v.key_registrant,
    v.county_id,
    v.county_name,
    v.precinct_label,
    coalesce(nullif(pc.baseline_dem_pct, 0::numeric), 45::numeric) as precinct_dem_baseline_pct,
    (pc.baseline_dem_pct is null or pc.baseline_dem_pct = 0::numeric) as precinct_baseline_imputed,
    coalesce(pc.initiative_engagement_score, 0::numeric) as precinct_initiative_engagement_score,
    coalesce(pc.precinct_registered_voters, 0::bigint) as precinct_registered_voters,
    (
      case
        when upper(coalesce(rv.party, '')) like '%DEM%' then 92::numeric
        when upper(coalesce(rv.party, '')) like '%REP%' then 6::numeric
        when upper(coalesce(rv.party, '')) like '%LIB%' then 28::numeric
        when upper(trim(coalesce(rv.party, ''))) in ('IND', 'NON', 'NONE', 'NONPARTISAN', 'O', 'OTHER', '') then 42::numeric
        else 38::numeric
      end
    ) as party_lean_component,
    least(
      100::numeric,
      greatest(
        0::numeric,
        0.55 * (
          case
            when upper(coalesce(rv.party, '')) like '%DEM%' then 92::numeric
            when upper(coalesce(rv.party, '')) like '%REP%' then 6::numeric
            when upper(coalesce(rv.party, '')) like '%LIB%' then 28::numeric
            when upper(trim(coalesce(rv.party, ''))) in ('IND', 'NON', 'NONE', 'NONPARTISAN', 'O', 'OTHER', '') then 42::numeric
            else 38::numeric
          end
        )
        + 0.45 * coalesce(nullif(pc.baseline_dem_pct, 0::numeric), 45::numeric)
      )
    ) as dem_lean_score,
    coalesce(ia.initiative_signature_rows, 0::bigint) as initiative_signature_rows,
    coalesce(ia.initiative_breadth, 0::bigint) as initiative_breadth,
    coalesce(ia.signed_ranked_choice, false) as signed_ranked_choice,
    coalesce(ia.signed_redistricting, false) as signed_redistricting,
    coalesce(ia.signed_marijuana, false) as signed_marijuana,
    coalesce(ia.signed_casino, false) as signed_casino,
    case
      when vh_n.vh_event_rows is not null then true
      else false
    end as has_vote_history,
    coalesce(vh_n.vh_event_rows, 0::bigint) as vh_event_rows
  from vr_cd2 v
  join public.raw_vr rv
    on rv.voter_id = v.voter_id
  left join precinct_ctx pc
    on pc.county_id = v.county_id
   and pc.precinct_label = v.precinct_label
  left join init_agg ia
    on ia.voter_id = v.voter_id
  left join vh_n
    on vh_n.voter_id = v.voter_id
)

select
  s.voter_id,
  s.key_registrant,
  s.county_id,
  s.county_name,
  s.precinct_label,
  round(s.precinct_dem_baseline_pct, 2) as precinct_dem_baseline_pct,
  round(s.precinct_initiative_engagement_score, 2) as precinct_initiative_engagement_score,
  s.precinct_registered_voters,
  round(s.dem_lean_score, 2) as dem_lean_score,
  round(100::numeric - s.dem_lean_score, 2) as dem_lean_headroom,
  s.initiative_signature_rows,
  s.initiative_breadth,
  s.signed_ranked_choice,
  s.signed_redistricting,
  s.signed_marijuana,
  s.signed_casino,
  s.has_vote_history,
  s.vh_event_rows,
  round(
    least(
      100::numeric,
      greatest(
        0::numeric,
        0.40 * s.dem_lean_score
        + 0.28 * least(40::numeric, s.initiative_breadth::numeric * 10.0)
        + 0.12 * least(25::numeric, s.vh_event_rows::numeric)
        + 0.12 * least(15::numeric, s.precinct_initiative_engagement_score)
        + 0.08 * least(10::numeric, s.initiative_signature_rows::numeric)
      )
    ),
    2
  ) as campaign_engagement_score,
  round(
    least(
      100::numeric,
      0.55 * s.dem_lean_score
      + 0.25 * least(40::numeric, s.initiative_breadth::numeric * 10.0)
      + 0.20 * least(30::numeric, s.precinct_initiative_engagement_score)
    ),
    2
  ) as funder_potential_proxy_score,
  -- Segment rules (v3): first match wins. Mobilization uses a lower lean floor than v2 so non-VH targets are not
  -- skipped when blended dem_lean clusters in the low 40s; persuadable requires engagement or initiative signal
  -- so it does not absorb every registrant after mobilization.
  case
    when s.dem_lean_score >= 68
      and (s.initiative_breadth >= 1 or s.vh_event_rows > 0)
      then 'heavy_dem_supporter'
    when s.initiative_breadth >= 2
      then 'volunteer_potential'
    when not s.has_vote_history
      and s.dem_lean_score between 35 and 85
      and s.party_lean_component >= 32
      then 'mobilization_target'
    when (
      s.has_vote_history
      or s.initiative_breadth >= 1
      or s.initiative_signature_rows >= 1
    )
    and (
      (
        coalesce(s.precinct_dem_baseline_pct, 48::numeric) between 36 and 62
        and s.dem_lean_score between 40 and 72
      )
      or (s.dem_lean_score between 42 and 68)
    )
    and (
      not s.precinct_baseline_imputed
      or s.dem_lean_score between 43 and 61
      or s.initiative_breadth >= 1
    )
      then 'persuadable'
    when s.dem_lean_score between 32 and 58
      then 'on_the_bubble'
    else 'base_pool'
  end as segment_bucket
from scored s;

comment on view public.cd2_voter_scorecard_v is
  'CD2 registered voters: party+pct lean, initiative breadth/flags, VH, precinct initiative context; campaign_engagement_score; segment_bucket (v3 mobilization lean floor + persuadable engagement gate; imputed persuadable lean band 43–61); funder_potential_proxy until donor data lands.';

-- Precinct × segment density (where persuadable / volunteers concentrate).
create view public.cd2_segment_hotspots_v
with (security_invoker = true)
as
select
  v.county_id,
  v.county_name,
  v.precinct_label,
  v.segment_bucket,
  count(*)::bigint as voter_count,
  max(v.precinct_registered_voters) as precinct_registered_voters,
  round(
    1000.0 * count(*)::numeric
    / nullif(max(v.precinct_registered_voters), 0),
    2
  ) as segment_share_per_1k_registrants
from public.cd2_voter_scorecard_v v
group by v.county_id, v.county_name, v.precinct_label, v.segment_bucket;

comment on view public.cd2_segment_hotspots_v is
  'CD2 precinct × segment_bucket counts; use to find where persuadable/volunteer_potential concentrate.';

