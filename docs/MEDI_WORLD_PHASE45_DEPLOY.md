# Medi World Phase 45 — Social rollout

Do **not** run Social SQL against production Neon from a local working tree.

Disposable local apply:

```
npx prisma db execute --file prisma/phase45-medi-world-social.sql --schema prisma/schema.prisma
```

Or `npx prisma migrate deploy` on a migrate-tracked disposable database after `20260913020000_medi_world_garden`.

`prisma db push` is forbidden. Historical Cycle migrations stay untouched.

## Production-safe flag

`MEDI_WORLD_SOCIAL_ENABLED` is **off in production when unset**. Production enables Social only with `MEDI_WORLD_SOCIAL_ENABLED=1`. Malformed values do not enable it. Development/test may default on when unset.

Render currently pins `MEDI_WORLD_SOCIAL_ENABLED=0`. Do not flip that to `1` until the reviewed migration is on Neon.

## Rollout order

1. Apply the reviewed Phase 45 Social migration to the target database.
2. Verify schema (`SocialProfile` and related tables exist; Prisma generate).
3. Deploy application code with `MEDI_WORLD_SOCIAL_ENABLED=0` (or unset in production).
4. Smoke-test Medi World without Social (Garden, Movement, Explore, Companion still work; Social APIs return uniform 404 `SOCIAL_DISABLED` and do not query missing tables).
5. Explicitly set `MEDI_WORLD_SOCIAL_ENABLED=1`.
6. Rollback: set `MEDI_WORLD_SOCIAL_ENABLED=0`. Existing friendships stay stored; the Social entry disappears.

## QR

Friend-code QR is generated on-device with `react-native-qrcode-svg` (ISO/IEC 18004 via the `qrcode` encoder, no network). Payload is only:

`medicard://medi-world/social/add?code=XXXXX-XXXXX`
