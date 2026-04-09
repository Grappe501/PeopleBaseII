## Command Center (local-only admin)

This repo includes a local-only admin area at `\`/command-center\``.

- **Production behavior**: blocked (returns 404) by `middleware.ts` for `/command-center/*` and `/api/command-center/*`.
- **Purpose**: calendar command center, event entry, approvals, and eventually Google account connection via OAuth (no hardcoded credentials).

### Events workflow

Events are stored in `public.events` and must be approved to appear on the rollup calendars:

- `draft` → `in_review` → `approved` (visible upstream)
- `rejected` requires a reason

Calendar rollup view:
- `public.events_rollup_v` emits only **approved + published** events into:
  - `statewide`
  - `county`
  - `place`
  - `precinct`

### Local API routes

- List/create events: `\`/api/command-center/events\``
- Submit a draft for review: `\`/api/command-center/events/:id/submit\``
- Approve/reject: `\`/api/command-center/events/:id/approve\``
- Download ICS: `\`/api/command-center/events/:id/ics\``

### Environment variables (optional)

Set these locally only (do not commit secrets):

- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (future map UI)
- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `GOOGLE_OAUTH_REDIRECT_URL`

