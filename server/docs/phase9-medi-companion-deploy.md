# Phase 9 — Medi Companion deploy

Additive only. Do **not** use `prisma db push`.

## Apply schema

```bash
cd server
npx prisma db execute --file prisma/phase9-medi-companion.sql --schema prisma/schema.prisma
npx prisma generate
```

On Windows, stop the API process first if `query_engine-windows.dll.node` is locked.

## Verify

Confirm tables `MediCompanionProfile` and `MediJourneyUnlock` exist in Neon after execute.

## Runtime

- Routes: `/api/medi-companion`, `/journey`, `/collection`, `PUT /equipment`, `POST /reconcile`
- Quest completion hooks call `reconcileMediJourneyAfterQuestSafe` (no economy writes)
- Mobile: `/medi-companion` (v36.0.0)

## Notes

Journey progress is derived from `QuestCompletion` (daily=1, weekly=3). Historical users unlock on first reconcile/overview.
