# PeopleBaseII Dashboard Shell — Drop-In Patch

This patch is designed for a Next.js App Router project with a root-level `app/`, `components/`, and `lib/` structure.

## What this adds
- `/dashboard` page
- dashboard layout shell
- live overview cards
- live county summary table
- Ask PeopleBase UI + backend placeholder
- dashboard API routes
- resilient query layer that can read from either:
  - `raw_vr` with source-style column names like `"County"` and `"VoterID"`
  - `raw_vr` with normalized lowercase column names like `county` and `voter_id`

## Assumptions
- `postgres` npm package is already installed
- `DATABASE_URL` exists in `.env.local`
- project uses the default `@/*` path alias

## Files included
- `app/dashboard/page.tsx`
- `app/dashboard/layout.tsx`
- `app/dashboard/loading.tsx`
- `app/api/dashboard/overview/route.ts`
- `app/api/dashboard/counties/route.ts`
- `app/api/ask/route.ts`
- `components/dashboard/*`
- `lib/db.ts`
- `lib/queries/dashboard.ts`
- `lib/types/dashboard.ts`

## Notes
- If your project already has `lib/db.ts`, compare before replacing.
- The Ask panel is intentionally safe and modular. It is a placeholder for your future AI/query orchestration layer.
- This patch does not change your existing home page or root layout.

## Recommended immediate next steps
1. Copy these files into your project root.
2. Run `npm run dev`
3. Open `/dashboard`
4. Verify overview cards render
5. Verify county table renders
6. Import more `raw_vr` chunks
7. Then build AR-02 filtered views and charts
