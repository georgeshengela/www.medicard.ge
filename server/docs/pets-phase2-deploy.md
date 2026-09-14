# Phase 2 — My Pets identity (schema)

Additive only. **Do not** use `prisma db push`. Do not run this against hosted Neon unless an operator explicitly asks.

## Apply (local / operator)

```bash
cd server
npx prisma db execute --file prisma/pets-phase2.sql --schema prisma/schema.prisma
npx prisma generate
```

On Windows, stop the API process first if `query_engine-windows.dll.node` is locked.

## Runtime

- Routes: `/api/pets`, `/api/pets/catalog`, `/api/pets/:petId`, photo, archive
- Missing table: `GET /api/pets` returns **503** with `schemaReady: false` (Hunt lesson). Catalog still serves without the table.

## Photos

`saveUpload` writes `server/uploads/`. Render has no persistent disk — photos are **not durable** on that host. `storage.js` remains the swap point for later object storage. Do not treat pet photos as permanent in this phase.
