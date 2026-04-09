# Census ACS 5-year (county)

## Source dataset

U.S. Census Bureau [Data API](https://www.census.gov/data/developers/data-sets.html), **ACS 5-year** profile at county resolution: `acs/acs5`.

- **Endpoint pattern:** `GET https://api.census.gov/data/{YEAR}/acs/acs5`
- **`YEAR`:** ACS *data release* year (the end year of the five-year span). Example: `2022` → estimates labeled 2018–2022.

## Authentication

Set **`CENSUS_API_KEY`** in the environment (see [API key signup](https://api.census.gov/data/key_signup.html)). The sync script requires this variable.

## Sync script

```bash
npm run sync:census
```

Implementation: [`scripts/sync-census.ts`](../../scripts/sync-census.ts)

Also requires **`DATABASE_URL`**.

Optional:

- **`CENSUS_ACS_YEAR`** — ACS release year (default `2022` if unset).

Each run generates a **UUID v7** `import_batch_id` (time-ordered) and sets `data_source = 'census_acs5'` on every touched row.

## Variables used (county)

| App field | ACS variables | Notes |
|-----------|---------------|--------|
| `total_population` | `B01003_001E` | Total population |
| `voting_age_population` | `B01001_*E` (male 18+ + female 18+ cohorts) | Sum of published age buckets |
| `white_population` | `B02001_002E` | White alone |
| `black_population` | `B02001_003E` | Black or African American alone |
| `asian_population` | `B02001_005E` | Asian alone |
| `hispanic_population` | `B03003_003E` | Hispanic or Latino |
| `median_household_income` | `B19013_001E` | Median household income |
| `poverty_population` | `B17001_002E` | Income below poverty level |
| `bachelors_or_higher` | `B15003_022E`–`025E` | Bachelor’s through doctorate |
| `owner_occupied_housing` | `B25003_002E` | Owner-occupied |
| `renter_occupied_housing` | `B25003_003E` | Renter-occupied |

Census suppression sentinels (e.g. `-666666666`) are stored as SQL `NULL`.

To add more measures, extend the variable list and mapper in `scripts/sync-census.ts` (see comments in the **ACS variable registry** section).

## County matching

- Geography: **`for=county:*`** with **`in=state:05`** (Arkansas only in this phase).
- Rows are joined to **`geo_counties`** using **FIPS only**: API `state` + `county` (zero-padded to 2 + 3 digits) must equal `geo_counties.state_fips` + `geo_counties.county_fips`.
- **Names are not used** for matching; any API row with no FIPS match is logged as **unmatched** (includes `NAME` from the API for debugging).

## Upsert behavior

- **Conflict target:** `(county_id, source_year)` on `census_county_acs`.
- On insert and update: `data_source`, `import_batch_id`, and all fact columns are refreshed; `updated_at` is maintained by the table trigger.

## API (read-only)

| Route | Purpose |
|-------|---------|
| [`/api/census/status`](../../app/api/census/status/route.ts) | Whether data exists, row count, latest `source_year`, counties with data, latest import time (`max(updated_at)`) |
| [`/api/census/summary`](../../app/api/census/summary/route.ts) | Latest ACS row per Arkansas county: name, year, population, income, race/ethnicity counts |

## Rerunning the sync

Safe to rerun any time: the script refetches the API and upserts the same `(county_id, source_year)`. Use a newer **`CENSUS_ACS_YEAR`** when the Census publishes a new 5-year vintage (typically in the fall).

## Limitations

- **County-level only** in this phase; tract sync and precinct logic are out of scope.
- ACS 5-year estimates **lag** real time by several years and are **smoothed** over five years—not point-in-time for a single calendar year.
- Race and Hispanic origin tables follow **Census definitions**; categories are not mutually exclusive for Hispanic vs. race in every analytic use case.
- Small areas can have **high margins of error**; suppressed values appear as nulls in the database.
