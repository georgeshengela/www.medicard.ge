# Phase 8 / 8.1 — Partner Rewards Platform deploy

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
   Safe to re-run (`IF NOT EXISTS` / duplicate-object guards). No `DROP TABLE`.

4. **Seed / refresh catalog + achievement rarities**
   ```bash
   npm run seed
   ```
   Upserts reward definitions and achievement rarities (including Phase 8.1 `FIRST_WEEKLY` / `COMEBACK` = `UNCOMMON`). Does **not** rewrite historical redemptions or claim state.

5. **Restart API** (or let Render release run `prisma generate` + `seed`).

6. **Verify**
   - `GET https://medicard.ge/health` → 200
   - `GET /api/admin/rewards/overview` (admin auth) → KPIs
   - Authenticated `GET /api/rewards` — first-party ACTIVE rewards still listed
   - Production partner / campaign counts may be **0** (expected)

## Production safety

- Do **not** set `ALLOW_DEV_PARTNER=1` in production.
- Do **not** activate `MEDI_PHARMACY_DEMO` for real users.
- Geo-restricted campaigns (`marketCountryCode`) cannot activate in production until a trusted account-market signal exists (`ALLOW_GEO_RESTRICTED_REWARDS=1` is an explicit override only).

## Admin capabilities

- `Admin.capabilities = null` → **legacy full access** (intentional backward compatibility).
- Non-null array → explicit capability checks (`REWARDS_VIEW`, `PARTNERS_MANAGE`, …).
- UI hiding is not authority; every `/api/admin/rewards/*` route enforces capabilities.

## Code storage decision (accepted risk)

`RewardCode.code` remains **plaintext in the database** (Phase 7 design).

**Why:** Fulfillment must reveal the code to the owner at redeem time; the project has no shared application-level crypto / KMS pattern yet. Fragile custom crypto is out of scope for Phase 8/8.1.

**Controls in place:**
- Admin UI masks by default (`••••••AB12`)
- Import responses never return accepted plaintext lists
- Code list API returns `codeMasked` only
- Never log plaintext codes
- No anonymous code-check / validation endpoint
- Owner redeem + capability-gated admin only

**Future:** migrate to envelope encryption when a shared crypto pattern exists, with dual-read during cutover.

## QA helpers

```bash
node scripts/phase81-prod-verify.js        # counts, indexes, rarities, health
node scripts/phase81-prod-verify.js e2e    # DEV partner commerce E2E (local)
```

## Mobile

App version for Partner Rewards platform: **35.x** (`mobile/app.json`). Store clients remain compatible (additive partner/campaign fields).
