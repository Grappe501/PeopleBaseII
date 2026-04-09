# Geography and precinct crosswalk

## County reference

- **Canonical table:** `geo_counties`
- **Key:** `county_key` = `state_fips` || `county_fips` (e.g. `05143` for Arkansas / Washington County). Unique and stable for joins.
- **Arkansas:** `state_fips = '05'`, three-digit zero-padded `county_fips`.

### Linking voter registration (`raw_vr`)

Until electorate rows carry `county_id`, registration rollups use **`normalize_geo_name()`** and the **`raw_vr_county_mapped`** view (alias first, then canonical county key). See [County normalization](county-normalization.md) for the full model, **`geo_county_aliases`**, and **`diagnostics_vr_unmatched_counties`**.

## Precinct identity

- **`geo_precincts`** — One row per canonical precinct: `precinct_key` (globally unique), `canonical_precinct_code`, `canonical_precinct_name`, validity window (`effective_*`), `status`.
- **`geo_precinct_aliases`** — Maps a source system/year/name/code to a `precinct_id`. Used for historical election files and VR precinct strings that differ from the canonical label.

### Normalized source key

Scripts compute `normalized_source_key` for matching: lowercase, trim, collapse whitespace, strip most punctuation. This is a **hint**, not proof of equality.

## Crosswalk workflow (sql/005)

- **`precinct_crosswalk_suggestions`** — Candidate pairs (e.g. VR string ↔ canonical precinct) with `match_score`, `match_reason`, `review_status`. High-confidence rows may be approved into `geo_precinct_aliases` by a human or a guarded automation step.
- **`precinct_crosswalk_exceptions`** — Unresolved or conflicting pairs for manual review.

### Policy: unresolved precincts

- **Never drop** source precinct text on `precinct_results` / `precinct_turnout`: `source_precinct_code` and `source_precinct_name` always populated from the file.
- **`precinct_id`** may be `NULL` until an alias exists and is trusted.
- **No auto-merge** when `match_score` is below the configured threshold (see script comments in `scripts/build-precinct-crosswalk.ts`).

## Confidence rules (default)

| Score | Typical signal | Action |
|-------|----------------|--------|
| 1.0 | Exact match after normalization | Eligible for auto-suggest; human approval recommended before alias insert |
| 0.85–0.99 | Token subset or Levenshtein ratio above threshold | Suggestion only |
| &lt; 0.85 | Weak | Log to `precinct_crosswalk_exceptions` |

Adjust thresholds per county after reviewing false positives.

## Future expansion

Additional states add rows to `geo_counties` and use the same `precinct_key` namespace convention: `{county_key}_{stable_local_id}`.
