# Election results (precinct CSV)

## Format

CSV with normalized headers (see [`scripts/import-election-results.ts`](../../scripts/import-election-results.ts)). Required logical columns:

- `election_key`, `election_year`, `election_type`
- `race_key`, `office_name`
- `county` (must match `geo_counties.county_name` case-insensitively)
- `precinct_name` (or `precinct`)
- `candidate_name`, `party`, `votes`

Optional: `election_date`, `precinct_code`, `district_type`, `district_code`, `description`, `is_partisan`.

## Import

```bash
npx tsx scripts/import-election-results.ts --file ./data/elections/sample.csv --source-file sample.csv
```

## Idempotency

Rows with the same `source_file` label are **deleted** from `precinct_results` before re-insert, so re-running an import for that file is safe.

## County resolution

County labels are matched with:

```sql
`normalize_geo_name(county_name from file)` = `geo_counties.normalized_county_name` (or add a `geo_county_aliases` row when the file uses a non-standard label)
```

Unmatched rows are skipped (counted in `election_import_log`).

## Precinct policy

`source_precinct_code` and `source_precinct_name` are always stored. `precinct_id` stays `NULL` until the crosswalk approves an alias to `geo_precincts`.

## Turnout

Turnout CSV support can use the same script with a dedicated path in a follow-up, or a second importer writing `precinct_turnout` (not bundled in the first `import-election-results` pass).

## Logs

Each run appends a row to `election_import_log` with counts and the logical `source_file` key.
