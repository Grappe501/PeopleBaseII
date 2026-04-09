-- CD2 county master view + canonical county ↔ congressional district mapping (AR-02).
-- Depends on: geo_counties, census_county_acs, raw_vr_county_mapped, raw_vh, raw_vr,
--             voter_initiative_signatures, elections, races, election_contests,
--             election_results, race_candidates (013+ mixed geography).
-- Idempotent: safe to re-run.

-- ---------------------------------------------------------------------------
-- 1) county_congressional_districts (expected by CD2 analytics; seed AR-02)
-- ---------------------------------------------------------------------------
create table if not exists public.county_congressional_districts (
  id bigserial primary key,
  county_id bigint not null references public.geo_counties (id) on delete cascade,
  state_fips text not null default '05',
  congressional_district smallint not null,
  map_effective_year smallint,
  notes text,
  created_at timestamptz not null default now(),
  constraint county_congressional_districts_state_cd_chk check (state_fips = '05'),
  constraint county_congressional_districts_cd_chk check (congressional_district between 1 and 4),
  constraint county_congressional_districts_unique unique (county_id, congressional_district)
);

-- Repair older / partial copies of this table (CREATE IF NOT EXISTS skips column DDL).
alter table public.county_congressional_districts
  add column if not exists state_fips text default '05';

alter table public.county_congressional_districts
  add column if not exists congressional_district smallint;

alter table public.county_congressional_districts
  add column if not exists map_effective_year smallint;

alter table public.county_congressional_districts
  add column if not exists notes text;

alter table public.county_congressional_districts
  add column if not exists created_at timestamptz default now();

update public.county_congressional_districts
set state_fips = coalesce(nullif(trim(state_fips), ''), '05')
where state_fips is null;

create index if not exists county_congressional_districts_cd_idx
  on public.county_congressional_districts (state_fips, congressional_district);

comment on table public.county_congressional_districts is
  'County grain assignment to U.S. congressional districts (Arkansas).';

-- Act 1116 (2021) AR map: CD2 full counties (see SOS / Census district maps).
-- Pulaski is split at sub-county geography; this table is full-county for rollups.
insert into public.county_congressional_districts (
  county_id,
  state_fips,
  congressional_district,
  map_effective_year,
  notes
)
select
  g.id,
  '05',
  2,
  2022,
  'AR CD2 (Act 1116): Cleburne, Conway, Faulkner, Perry, Pulaski, Saline, Van Buren, White — full-county assignment; Pulaski split not modeled here.'
from public.geo_counties g
where g.state_fips = '05'
  and g.county_key in (
    '05023', '05029', '05045', '05145', '05119', '05125', '05141', '05105'
  )
on conflict (county_id, congressional_district) do nothing;

-- ---------------------------------------------------------------------------
-- 2) Helper: effective party on election_results rows (fills gaps when contest
--    names are not party-prefixed and VR/import did not set party).
-- ---------------------------------------------------------------------------
drop view if exists public.cd2_county_master_v cascade;

create or replace view public.cd2_county_master_v as
with
cd2_counties as (
  select ccd.county_id
  from public.county_congressional_districts ccd
  where ccd.state_fips::text = '05'
    and ccd.congressional_district::numeric = 2
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
    c.poverty_population,
    c.owner_occupied_housing,
    c.renter_occupied_housing
  from public.census_county_acs c
  order by c.county_id, c.source_year desc
),
vr_counts as (
  select
    m.mapped_county_id as county_id,
    count(*)::bigint as registered_voters
  from public.raw_vr_county_mapped m
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
initiative_json as (
  select
    s.county_id,
    jsonb_object_agg(s.initiative, s.signer_count) as signers_by_initiative,
    jsonb_object_agg(
      s.initiative,
      round(
        1000.0 * s.signer_count::numeric
          / nullif(v.registered_voters, 0),
        4
      )
    ) as signer_rate_per_1000_registrants
  from initiative_sig s
  join vr_counts v on v.county_id = s.county_id
  group by s.county_id
)
select
  gc.id as county_id,
  gc.state_fips,
  gc.county_fips,
  gc.county_key,
  gc.county_name,
  al.acs_source_year,
  al.total_population,
  al.voting_age_population,
  round(
    100.0 * al.black_population::numeric / nullif(al.total_population, 0),
    4
  ) as pct_black_population,
  round(
    100.0 * al.white_population::numeric / nullif(al.total_population, 0),
    4
  ) as pct_white_population,
  round(
    100.0 * al.hispanic_population::numeric / nullif(al.total_population, 0),
    4
  ) as pct_hispanic_population,
  round(
    100.0 * al.poverty_population::numeric / nullif(al.total_population, 0),
    4
  ) as poverty_rate_pct,
  round(
    100.0 * al.renter_occupied_housing::numeric
      / nullif(
        coalesce(al.owner_occupied_housing, 0) + coalesce(al.renter_occupied_housing, 0),
        0
      ),
    4
  ) as renter_share_pct,
  coalesce(vr.registered_voters, 0::bigint) as registered_voters,
  round(
    100.0 * coalesce(vr.registered_voters, 0)::numeric / nullif(al.voting_age_population, 0),
    4
  ) as registration_rate_pct,
  coalesce(vh.vh_unique_voters, 0::bigint) as vh_unique_voters,
  round(
    100.0 * coalesce(vh.vh_unique_voters, 0)::numeric / nullif(vr.registered_voters, 0),
    4
  ) as turnout_rate_pct,
  round(
    100.0 * g22.dem_votes::numeric / nullif(g22.total_votes, 0),
    4
  ) as gov_2022_general_dem_pct,
  round(
    100.0 * p24.dem_votes::numeric / nullif(p24.total_votes, 0),
    4
  ) as pres_2024_general_dem_pct,
  case
    when s6.race_has_dem is not true then null
    else round(100.0 * s6.dem_votes::numeric / nullif(s6.total_votes, 0), 4)
  end as sos_2026_dem_primary_pct,
  case
    when s6.race_has_dem is not true then null
    else s6.dem_votes
  end as sos_2026_dem_votes,
  case
    when s6.race_has_dem is not true then null
    else s6.total_votes
  end as sos_2026_total_votes,
  ij.signers_by_initiative,
  ij.signer_rate_per_1000_registrants,
  round(
    (round(100.0 * p24.dem_votes::numeric / nullif(p24.total_votes, 0), 4))
    - (round(100.0 * g22.dem_votes::numeric / nullif(g22.total_votes, 0), 4)),
    4
  ) as dem_swing_pct_2022_to_2024,
  case
    when s6.race_has_dem is not true then null
    else round(
      (round(100.0 * s6.dem_votes::numeric / nullif(s6.total_votes, 0), 4))
      - (round(100.0 * p24.dem_votes::numeric / nullif(p24.total_votes, 0), 4)),
      4
    )
  end as dem_swing_pct_2024_to_2026,
  case
    when s6.race_has_dem is not true then null
    else round(
      (round(100.0 * s6.dem_votes::numeric / nullif(s6.total_votes, 0), 4))
      - (round(100.0 * g22.dem_votes::numeric / nullif(g22.total_votes, 0), 4)),
      4
    )
  end as dem_swing_pct_2022_to_2026,
  -- Composite: emphasizes 2024 presidential baseline, 2022 governor, optional 2026 SOS,
  -- plus 2022→2024 swing (clamped contribution).
  round(
    least(
      100::numeric,
      greatest(
        0::numeric,
        0.45 * coalesce(round(100.0 * p24.dem_votes::numeric / nullif(p24.total_votes, 0), 4), 0)
        + 0.35 * coalesce(round(100.0 * g22.dem_votes::numeric / nullif(g22.total_votes, 0), 4), 0)
        + 0.20 * coalesce(
          case
            when s6.race_has_dem is not true then null
            else round(100.0 * s6.dem_votes::numeric / nullif(s6.total_votes, 0), 4)
          end,
          round(100.0 * p24.dem_votes::numeric / nullif(p24.total_votes, 0), 4)
        )
        + 0.15 * greatest(
          -15::numeric,
          least(
            15::numeric,
            coalesce(
              (round(100.0 * p24.dem_votes::numeric / nullif(p24.total_votes, 0), 4))
              - (round(100.0 * g22.dem_votes::numeric / nullif(g22.total_votes, 0), 4)),
              0
            )
          )
        )
      )
    ),
    4
  ) as dem_power_score
from public.geo_counties gc
join cd2_counties cd on cd.county_id = gc.id
left join acs_latest al on al.county_id = gc.id
left join vr_counts vr on vr.county_id = gc.id
left join vh_counts vh on vh.county_id = gc.id
left join gov2022 g22 on g22.county_id = gc.id
left join pres2024 p24 on p24.county_id = gc.id
left join sos2026 s6 on s6.county_id = gc.id
left join initiative_json ij on ij.county_id = gc.id
where gc.state_fips = '05';

comment on view public.cd2_county_master_v is
  'CD2 (AR-02) counties: ACS, VR, VH, initiative signers, election trend columns, and dem_power_score.';
