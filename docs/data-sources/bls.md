# Bureau of Labor Statistics

## LAUS (Local Area Unemployment Statistics)

### API

BLS Public Data API v2: `POST https://api.bls.gov/publicAPI/v2/timeseries/data/`

### Authentication

`BLS_API_KEY` (registration key from [BLS](https://www.bls.gov/developers/api_signature.htm)).

### Script

`npm run sync:bls` → [`scripts/sync-bls.ts`](../../scripts/sync-bls.ts)

### Series ID pattern (Arkansas counties)

Each county uses four LAUS series (20-character IDs):

```text
LAUCN + state(2) + county_fips(3) + "0000000" + measure(2)
```

| Measure | Suffix | Field |
|---------|--------|--------|
| Unemployment rate | `03` | `unemployment_rate` |
| Unemployed | `04` | `unemployed` |
| Employed | `05` | `employed` |
| Labor force | `06` | `labor_force` |

Example (Arkansas County, FIPS 001): `LAUCN050010000000003` (rate).

The script anchors the **reporting month** on the latest point returned for the **unemployment rate** series, then reads the other three series at the same `year` + `period` (`M01`–`M12`).

### Rate limits

Batch requests stay under 50 series per call; the script sleeps ~400ms between chunks.

### Refresh cadence

Monthly after BLS publishes revised LAUS (often mid-month for prior month).

## QCEW (Quarterly Census of Employment and Wages)

`bls_qcew_county` is created for county × year × quarter storage. **This phase does not populate it via the timeseries API** (QCEW is usually sourced from downloadable files or specialized endpoints). Plan a follow-on importer or manual load; document provenance when filled.

## Limitations

- If one of the four LAUS series is missing for a county/month, that field may be `NULL` in `bls_laus_county`.
- Revised LAUS values can change historical months; rerunning the sync overwrites the target `(county_id, year, month)` row.
