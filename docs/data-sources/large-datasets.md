# Large datasets: where they belong

This repo is optimized for **code + schemas + documentation**, not raw source datasets. GitHub rejects files over 100 MB, and large blobs make the repo slow and fragile.

## What should NOT be committed

- Raw voter files (VR/VH), full exports, snapshots
- Large election CSV collections
- XLSX/PDF source artifacts (unless they are tiny and truly essential)
- Any file \(or generated artifact\) that is hard to diff or regularly re-generated

If you have local copies under `data/`, keep them local only. The repository ignores `data/` by design.

## Where large datasets SHOULD live

Pick one of these storage patterns, then document the pointer in `docs/`.

### Option 1: Supabase Storage (recommended for this project)

- **Use for**: campaign/internal datasets that should be gated behind project access
- **Pattern**:
  - Create a bucket like `datasets` (or per-source buckets)
  - Store versioned objects, e.g.:
    - `vr/2026-04-01/vr.csv`
    - `vh/2026-04-01/vh.csv`
    - `elections/2024/general/*.csv`
  - Keep a short manifest file in this repo describing:
    - bucket name
    - object path(s)
    - expected schema/columns
    - import command to run locally

### Option 2: S3 / R2 / GCS (recommended if you need cheap bulk storage)

- **Use for**: large public/semipublic datasets, or anything that needs lifecycle policies
- **Pattern**:
  - Store a versioned prefix, e.g. `s3://bucket/datasets/vr/2026-04-01/vr.csv`
  - Maintain a `docs/data-sources/*` note with:
    - the canonical URI(s)
    - how to request access (if private)
    - checksum(s) if applicable

### Option 3: External download (public sources)

- **Use for**: public election results, ACS extracts, etc.
- **Pattern**:
  - Don’t commit the downloaded file
  - Instead commit:
    - the source URL
    - a small script that downloads and normalizes it
    - a tiny sample file (optional) for tests/dev UX

## How to reference datasets in the repo

- Put the pointer/manifest in `docs/data-sources/`
- Prefer stable naming: include **source + date + version**
- If a dataset powers SQL imports, also document:
  - where it lands locally (e.g. `data/_staging/...` — still ignored)
  - which ingest script to run (`scripts/ingest/*`)
  - which validation SQL to run (`sql/validation_*.sql`)

## Guardrails

- `data/` is ignored by `.gitignore`
- GitHub will reject pushes containing blobs over 100 MB
- If a big file accidentally gets committed, it must be removed from history before pushing

