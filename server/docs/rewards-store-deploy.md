# Medi Quest Rewards Store — production deploy (Phase 7 / 7.1)

Do **not** use `prisma db push` for Rewards. Existing Neon drift (e.g. `UserLocation`) can cause destructive schema changes.

## Procedure

1. **Stop the API** (Windows: Prisma client DLL may be locked while `node src/server.js` runs).

2. **Generate client**
   ```bash
   cd server
   npx prisma generate
   ```

3. **Apply additive SQL only**
   ```bash
   npx prisma db execute --file prisma/phase7-rewards-store.sql --schema prisma/schema.prisma
   ```
   Safe to re-run: uses `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS` / FK `DO $$ … EXCEPTION WHEN duplicate_object`.

4. **Seed / refresh catalog**
   ```bash
   node scripts/phase71-verify-rewards.js
   ```
   or `npm run seed` (calls `ensureRewardDefinitions`).  
   Idempotent upsert by `key`. Does **not** rewrite historical `RewardRedemption.coinCost`.

5. **Verify tables**
   Expect `OK` for:
   - RewardPartner
   - RewardDefinition
   - RewardRedemption
   - RewardCode
   - RewardInventoryAdjustment
   - UserRewardEntitlement
   - RewardRedemptionAudit

6. **Restart API**
   ```bash
   npm run start
   # or npm run dev
   ```

7. **Health + rewards check**
   - `GET /api/app/status` (or existing health)
   - Authenticated `GET /api/rewards` → only ACTIVE, fulfillable rewards (no `PARTNER_TEST_10`, no DRAFT Premium)

8. **Optional live engine QA**
   ```bash
   node scripts/phase71-e2e-rewards.js
   ```

## Notes

- Mobile app version for Phase 7.2: see `mobile/app.json`.
- **Render `release`:** `prisma generate` + `seed` only — **not** `db push`. Rewards tables are applied via additive SQL. Same-device Coin balance uses `invalidateMediCoinBalance` / `publishMediCoinBalance` in `mobile/src/lib/quest/cache.ts`. Cross-device: refresh on foreground/focus (no Store sockets).
- Coupon import (internal): `node scripts/import-reward-codes.js <rewardKey> codes.txt`
