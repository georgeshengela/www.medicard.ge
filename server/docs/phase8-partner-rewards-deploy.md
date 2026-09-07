# Phase 8 — Partner Rewards Platform deploy

Do **not** use `prisma db push`. Existing Neon drift remains risky.

## Procedure

1. **Stop the API** (Windows: Prisma `query_engine` DLL locks while the server runs).

2. **Generate client**
   ```bash
   cd server
   npx prisma generate
   ```

3. **Apply additive SQL only**
   ```bash
   npx prisma db execute --file prisma/phase8-partner-rewards.sql --schema prisma/schema.prisma
   ```
   Safe to re-run (`IF NOT EXISTS` / duplicate-object guards).

4. **Restart API**
   ```bash
   npm run start
   ```

5. **Verify**
   - `GET /api/admin/rewards/overview` (admin + `REWARDS_VIEW` or legacy null capabilities)
   - Authenticated `GET /api/rewards` — first-party ACTIVE rewards still listed
   - Production partner / campaign counts may be **0** (expected)

## Production safety

- Do **not** set `ALLOW_DEV_PARTNER=1` in production.
- Do **not** activate `MEDI_PHARMACY_DEMO` for real users.
- Geo-restricted campaigns (`marketCountryCode`) cannot activate in production until a trusted account-market signal exists (`ALLOW_GEO_RESTRICTED_REWARDS=1` is an explicit override only).

## Code storage decision

`RewardCode.code` remains **plaintext in DB** (Phase 7). Admin UI masks by default (`••••••AB12`). Import responses never return accepted plaintext lists. Do not log codes. Application-level encryption deferred until a shared crypto pattern exists — fragile custom crypto is out of scope.

## Mobile

App version for Phase 8: **35.0.0**. Store clients on 34.2.x remain compatible (additive partner/campaign fields).
