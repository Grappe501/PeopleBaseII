-- County detail export surface (one row per county; filter by county_id or name at query time).
-- Includes: statewide_county_master_v fields + top precincts JSON + initiative totals + election trend summary
-- + BLS placeholders (joined if available via *_latest views).
-- Idempotent: safe to re-run.

drop view if exists public.county_detail_export_v cascade;

create view public.county_detail_export_v
with (security_invoker = true)
as
with
top_precincts as (
  select
    p.county_id,
    jsonb_agg(
      jsonb_build_object(
        'precinct_label', p.precinct_label,
        'registered_voters', p.registered_voters,
        'turnout_voters', p.turnout_voters,
        'turnout_rate_pct', p.turnout_rate_pct,
        'total_votes_2022_governor', p.total_votes_2022_governor,
        'dem_pct_2022_governor', p.dem_pct_2022_governor,
        'total_votes_2024_president', p.total_votes_2024_president,
        'dem_pct_2024_president', p.dem_pct_2024_president,
        'total_votes_2026_primary', p.total_votes_2026_primary,
        'dem_pct_2026_primary', p.dem_pct_2026_primary,
        'dem_swing_2022_to_2024', p.dem_swing_2022_to_2024,
        'dem_swing_2024_to_2026', p.dem_swing_2024_to_2026,
        'precinct_size_score', p.precinct_size_score,
        'precinct_turnout_gap_score', p.precinct_turnout_gap_score,
        'precinct_baseline_score', p.precinct_baseline_score,
        'precinct_priority_score', p.precinct_priority_score
      )
      order by p.precinct_priority_score desc nulls last, p.registered_voters desc nulls last, p.precinct_label
    ) as top_precincts_by_priority
  from (
    select
      sp.*,
      row_number() over (
        partition by sp.county_id
        order by sp.precinct_priority_score desc nulls last, sp.registered_voters desc nulls last, sp.precinct_label
      ) as rn
    from public.statewide_precinct_priority_v sp
  ) p
  where p.rn <= 25
  group by p.county_id
),

laus as (
  select
    county_id,
    unemployment_rate,
    labor_force,
    employment,
    unemployment,
    source_year as laus_source_year,
    source_month as laus_source_month
  from public.bls_laus_county_latest
),

qcew as (
  select
    county_id,
    average_weekly_wage,
    establishments,
    employment as qcew_employment,
    source_year as qcew_source_year
  from public.bls_qcew_county_latest
)

select
  cm.*,
  tp.top_precincts_by_priority,

  -- BLS (if missing, nulls are expected; UI should render placeholders)
  laus.unemployment_rate,
  laus.labor_force,
  laus.employment,
  laus.unemployment,
  laus.laus_source_year,
  laus.laus_source_month,

  qcew.average_weekly_wage,
  qcew.establishments,
  qcew.qcew_employment,
  qcew.qcew_source_year,

  -- Contextual notes placeholders (for future poll-context mapping layer; not county inference).
  null::text as poll_context_notes,
  null::text as model_notes
from public.statewide_county_master_v cm
left join top_precincts tp on tp.county_id = cm.county_id
left join laus on laus.county_id = cm.county_id
left join qcew on qcew.county_id = cm.county_id;

comment on view public.county_detail_export_v is
  'One row per AR county: statewide_county_master_v + top precincts JSON + BLS latest joins + placeholder notes fields.';

