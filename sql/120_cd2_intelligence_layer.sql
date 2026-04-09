-- CD2 intelligence: ACS+BLS county demographic model vs observed vote + precinct "blank density".
-- Depends on: cd2_county_master_v, cd2_precinct_priority_v, bls_laus_county_latest.

drop view if exists public.cd2_precinct_intel_v cascade;
drop view if exists public.cd2_county_intel_v cascade;

-- County: transparent linear index calibrated to ~AR CD2 range (not a literal forecast).
create view public.cd2_county_intel_v
with (security_invoker = true)
as
with m as (
  select
    cm.county_id,
    cm.county_name,
    cm.pres_2024_general_dem_pct,
    cm.gov_2022_general_dem_pct,
    cm.pct_black_population,
    cm.pct_white_population,
    cm.pct_hispanic_population,
    cm.poverty_rate_pct,
    cm.renter_share_pct,
    cm.registration_rate_pct,
    cm.turnout_rate_pct,
    cm.dem_power_score
  from public.cd2_county_master_v cm
),
laus as (
  select distinct on (county_id)
    county_id,
    unemployment_rate
  from public.bls_laus_county
  order by county_id, source_year desc, source_month desc
)
select
  m.county_id,
  m.county_name,
  m.pres_2024_general_dem_pct as county_observed_dem_2024_pct,
  m.gov_2022_general_dem_pct as county_observed_dem_2022_pct,
  round(
    greatest(
      24::numeric,
      least(
        78::numeric,
        31::numeric
        + 0.38 * coalesce(m.pct_black_population, 0)
        + 0.12 * coalesce(m.pct_hispanic_population, 0)
        + 0.06 * greatest(0, 100 - coalesce(m.pct_white_population, 0))
        - 0.30 * coalesce(m.poverty_rate_pct, 0)
        + 0.09 * coalesce(m.renter_share_pct, 0)
        - 0.42 * coalesce(l.unemployment_rate, 0)
      )
    ),
    2
  ) as model_expected_dem_pct,
  round(
    coalesce(m.pres_2024_general_dem_pct, 0)
    - greatest(
      24::numeric,
      least(
        78::numeric,
        31::numeric
        + 0.38 * coalesce(m.pct_black_population, 0)
        + 0.12 * coalesce(m.pct_hispanic_population, 0)
        + 0.06 * greatest(0, 100 - coalesce(m.pct_white_population, 0))
        - 0.30 * coalesce(m.poverty_rate_pct, 0)
        + 0.09 * coalesce(m.renter_share_pct, 0)
        - 0.42 * coalesce(l.unemployment_rate, 0)
      )
    ),
    2
  ) as county_dem_residual_pct,
  case
    when coalesce(m.pres_2024_general_dem_pct, 0)
      < greatest(
        24::numeric,
        least(
          78::numeric,
          31::numeric
          + 0.38 * coalesce(m.pct_black_population, 0)
          + 0.12 * coalesce(m.pct_hispanic_population, 0)
          + 0.06 * greatest(0, 100 - coalesce(m.pct_white_population, 0))
          - 0.30 * coalesce(m.poverty_rate_pct, 0)
          + 0.09 * coalesce(m.renter_share_pct, 0)
          - 0.42 * coalesce(l.unemployment_rate, 0)
        )
      ) - 2
      then 'underperforming_model'
    when coalesce(m.pres_2024_general_dem_pct, 0)
      > greatest(
        24::numeric,
        least(
          78::numeric,
          31::numeric
          + 0.38 * coalesce(m.pct_black_population, 0)
          + 0.12 * coalesce(m.pct_hispanic_population, 0)
          + 0.06 * greatest(0, 100 - coalesce(m.pct_white_population, 0))
          - 0.30 * coalesce(m.poverty_rate_pct, 0)
          + 0.09 * coalesce(m.renter_share_pct, 0)
          - 0.42 * coalesce(l.unemployment_rate, 0)
        )
      ) + 2
      then 'overperforming_model'
    else 'on_track'
  end as county_model_bucket,
  m.pct_black_population,
  m.pct_white_population,
  m.pct_hispanic_population,
  m.poverty_rate_pct,
  m.renter_share_pct,
  l.unemployment_rate as bls_unemployment_rate_pct,
  m.registration_rate_pct,
  m.turnout_rate_pct,
  m.dem_power_score
from m
left join laus l
  on l.county_id = m.county_id;

comment on view public.cd2_county_intel_v is
  'CD2 counties: ACS+BLS linear model of expected Dem presidential % vs observed 2024; residual = observed - model.';

-- Precinct: attach county model + estimate local gap ("blank" lift if precinct lags county+model).
create view public.cd2_precinct_intel_v
with (security_invoker = true)
as
select
  p.county_id,
  p.county_name,
  p.precinct_label,
  p.registered_voters,
  p.baseline_dem_pct,
  p.turnout_rate_pct,
  p.turnout_gap_score_raw,
  p.initiative_engagement_score,
  p.precinct_priority_score_balanced,
  ci.model_expected_dem_pct,
  ci.county_observed_dem_2024_pct,
  ci.county_dem_residual_pct,
  round(
    coalesce(p.baseline_dem_pct, 0) - coalesce(ci.county_observed_dem_2024_pct, 0),
    2
  ) as precinct_vs_county_gap_pct,
  round(
    greatest(0, ci.model_expected_dem_pct - coalesce(p.baseline_dem_pct, 0)),
    2
  ) as precinct_headroom_to_model_pct,
  round(
    greatest(0, ci.county_observed_dem_2024_pct - coalesce(p.baseline_dem_pct, 0)),
    2
  ) as precinct_vs_county_vote_share_gap_pct,
  round(
    greatest(0, ci.model_expected_dem_pct - coalesce(p.baseline_dem_pct, 0))
    * coalesce(p.registered_voters, 0) / 100.0,
    1
  ) as estimated_dem_votes_if_precinct_matched_model,
  round(
    greatest(0, coalesce(ci.county_observed_dem_2024_pct, 0) - coalesce(p.baseline_dem_pct, 0))
    * coalesce(p.registered_voters, 0) / 100.0,
    1
  ) as estimated_dem_votes_if_precinct_matched_county,
  round(
    (greatest(0, ci.model_expected_dem_pct - coalesce(p.baseline_dem_pct, 0)) / 40.0)
    * (coalesce(p.registered_voters, 0) / 1000.0)
    * (1.0 + coalesce(p.initiative_engagement_score, 0) / 200.0),
    4
  ) as blank_density_score,
  case
    when greatest(0, ci.model_expected_dem_pct - coalesce(p.baseline_dem_pct, 0)) >= 8
      and coalesce(p.turnout_gap_score_raw, 0) >= 25
      then 'socioeconomic_mobilization'
    when coalesce(p.baseline_dem_pct, 0) between 43 and 57
      and coalesce(p.turnout_gap_score_raw, 0) < 35
      then 'persuasion_swing'
    when coalesce(p.turnout_gap_score_raw, 0) >= 30
      and coalesce(p.baseline_dem_pct, 0) >= 40
      then 'turnout_density'
    when coalesce(p.initiative_engagement_score, 0) >= 35
      then 'grassroots_signal'
    else 'composite'
  end as voter_model_archetype
from public.cd2_precinct_priority_v p
join public.cd2_county_intel_v ci
  on ci.county_id = p.county_id
where p.precinct_label is not null;

comment on view public.cd2_precinct_intel_v is
  'CD2 precincts: demographic model + county vote vs precinct baseline; blank_density_score highlights latent Dem share vs model.';

