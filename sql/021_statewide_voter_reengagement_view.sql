-- Statewide voter re-engagement view (Arkansas).
-- Goal: surface registrants with civic/turnout signals + lower recent participation, for outreach.
-- Constraints: no person-level partisan labels inferred; only turnout/vote-history + petition signals + precinct/county context.
-- Depends on: raw_vr, raw_vr_county_mapped, raw_vh, voter_initiative_signatures,
--             geo_counties, statewide_county_master_v, statewide_precinct_priority_v.
-- Idempotent: safe to re-run.

drop view if exists public.statewide_voter_reengagement_v cascade;

create view public.statewide_voter_reengagement_v
with (security_invoker = true)
as
with
vh_flags as (
  select
    coalesce(nullif(trim(v.voter_id), ''), nullif(trim(v.key_registrant), '')) as person_key,
    bool_or(v.election_type ilike '%general%' and v.election_date like '2022%') as voted_2022_general,
    bool_or(v.election_type ilike '%general%' and v.election_date like '2024%') as voted_2024_general,
    bool_or(v.election_date like '2026%' and v.election_type ilike '%primary%') as voted_2026_primary,
    bool_or(v.election_date like '2026%' and v.election_type ilike '%runoff%') as voted_2026_runoff,
    bool_or(v.election_type ilike '%primary%') as voted_any_primary,
    count(*)::bigint as vh_rows
  from public.raw_vh v
  where coalesce(nullif(trim(v.voter_id), ''), nullif(trim(v.key_registrant), '')) is not null
  group by coalesce(nullif(trim(v.voter_id), ''), nullif(trim(v.key_registrant), ''))
),

petition_flags as (
  select
    coalesce(nullif(trim(vi.voter_id), ''), nullif(trim(vi.key_registrant), '')) as person_key,
    bool_or(vi.initiative = 'redistricting') as petition_redistricting,
    bool_or(vi.initiative = 'marijuana') as petition_marijuana,
    bool_or(vi.initiative = 'casino') as petition_casino,
    bool_or(vi.initiative = 'ranked_choice') as petition_ranked_choice,
    count(*)::bigint as petition_rows,
    count(distinct vi.initiative)::bigint as petition_breadth
  from public.voter_initiative_signatures vi
  where coalesce(nullif(trim(vi.voter_id), ''), nullif(trim(vi.key_registrant), '')) is not null
  group by coalesce(nullif(trim(vi.voter_id), ''), nullif(trim(vi.key_registrant), ''))
),

vr_base as (
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
    rv.registrant_status,
    coalesce(nullif(trim(rv.voter_id), ''), nullif(trim(rv.key_registrant), '')) as person_key
  from public.raw_vr rv
  join public.raw_vr_county_mapped m
    on m.id = rv.id
  join public.geo_counties gc
    on gc.id = m.mapped_county_id
  where m.mapped_county_id is not null
    and gc.state_fips = '05'
),

ctx as (
  select
    vb.person_key,
    vb.voter_id,
    vb.key_registrant,
    vb.county_id,
    vb.county_name,
    vb.precinct_label,
    vb.registrant_status,

    coalesce(vf.voted_2022_general, false) as voted_2022_general,
    coalesce(vf.voted_2024_general, false) as voted_2024_general,
    coalesce(vf.voted_2026_primary, false) as voted_2026_primary,
    coalesce(vf.voted_2026_runoff, false) as voted_2026_runoff,
    coalesce(vf.voted_any_primary, false) as voted_any_primary,

    coalesce(pf.petition_redistricting, false) as petition_redistricting,
    coalesce(pf.petition_marijuana, false) as petition_marijuana,
    coalesce(pf.petition_casino, false) as petition_casino,
    coalesce(pf.petition_ranked_choice, false) as petition_ranked_choice,

    coalesce(pf.petition_rows, 0::bigint) as petition_rows,
    coalesce(pf.petition_breadth, 0::bigint) as petition_breadth,

    coalesce(cm.turnout_rate_pct, 0::numeric) as county_turnout_rate_pct,
    coalesce(cm.county_priority_score, 0::numeric) as county_priority_score,

    coalesce(pp.precinct_priority_score, 0::numeric) as precinct_priority_score,
    coalesce(pp.turnout_rate_pct, null) as precinct_turnout_rate_pct
  from vr_base vb
  left join vh_flags vf
    on vf.person_key = vb.person_key
  left join petition_flags pf
    on pf.person_key = vb.person_key
  left join public.statewide_county_master_v cm
    on cm.county_id = vb.county_id
  left join public.statewide_precinct_priority_v pp
    on pp.county_id = vb.county_id
   and pp.precinct_label = vb.precinct_label
  where vb.person_key is not null
),

scored as (
  select
    c.*,
    -- Re-engagement score:
    --   + petition breadth/rows (civic activity signal)
    --   + precinct/county priority context
    --   + penalty if already voted recently (we want "re-engagement", not "already active")
    round(
      least(
        100::numeric,
        greatest(
          0::numeric,
          18::numeric * least(4::numeric, c.petition_breadth::numeric) +
          6::numeric * least(6::numeric, c.petition_rows::numeric) +
          0.28 * coalesce(c.precinct_priority_score, 0) +
          0.22 * coalesce(c.county_priority_score, 0) +
          0.12 * greatest(0::numeric, 100::numeric - coalesce(c.county_turnout_rate_pct, 0)) -
          (case when c.voted_2024_general then 18 else 0 end) -
          (case when c.voted_2022_general then 10 else 0 end) -
          (case when c.voted_2026_primary then 14 else 0 end)
        )
      ),
      2
    ) as reengagement_score
  from ctx c
)

select
  s.voter_id,
  s.key_registrant,
  s.county_id,
  s.county_name,
  s.precinct_label,
  s.registrant_status,

  s.voted_2022_general,
  s.voted_2024_general,
  s.voted_2026_primary,
  s.voted_2026_runoff,
  s.voted_any_primary,

  s.petition_redistricting,
  s.petition_marijuana,
  s.petition_casino,
  s.petition_ranked_choice,

  s.precinct_turnout_rate_pct,
  s.county_turnout_rate_pct,
  s.county_priority_score,
  s.precinct_priority_score,

  s.reengagement_score,
  case
    when s.reengagement_score >= 72 then 'high_priority'
    when s.reengagement_score >= 45 then 'medium_priority'
    else 'lower_priority'
  end as outreach_bucket
from scored s;

comment on view public.statewide_voter_reengagement_v is
  'Statewide AR registrants: vote-history flags + petition flags + precinct/county context → reengagement_score + outreach_bucket. No person-level partisan inference.';

