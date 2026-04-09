# `public.raw_vr` — frozen source table

`raw_vr` is the persistent loaded voter-registration source, not disposable migration scaffolding. Ingestion, analytics, and dashboards depend on it.

1. Do not `DROP` `raw_vr`.
2. Do not `TRUNCATE` `raw_vr`.
3. Do not recreate `raw_vr` (including drop-and-create under the same name in migrations).
4. Do not `ALTER` `raw_vr` (columns, types, constraints) without explicit approval.
5. Add modeling via additional tables, views, or transforms; do not treat `raw_vr` as throwaway staging.

Non-breaking operational tuning (for example indexes) may be discussed separately.
