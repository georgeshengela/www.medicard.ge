# RA-00 Repository architecture map

Source of truth: live tree on 2026-09-11. Documentation may be stale.

## Shape

Two-app monorepo **without** `packages/`, **without** npm workspaces, **without** Turbo/Nx.

```
www.medicard/
├── mobile/          Expo SDK 57 client (Expo Router)
├── server/          Express + Prisma + admin SPA + marketing site
├── docs/            Cycle/pregnancy contracts
├── qa/              Phase QA harnesses and captures
├── qa-artifacts/    Versioned visual captures
├── scripts/         Figma + legal/calculator builders
├── brand/           Facebook cover/profile assets
├── memory/          Daily agent notes
├── render.yaml      Only CI/CD-as-code (Render)
└── package.json     Orchestrator scripts
```

Absent: `.github/workflows`, Docker, `apps/`, shared published packages.

## Apps

| App | Path | Runtime |
|-----|------|---------|
| Mobile | `mobile/` | Expo 57 / RN 0.86.3 / React 19.2 / Expo Router |
| API | `server/src/server.js` | Node ≥20 Express |
| Admin | `server/admin/` served at `/admin` | Static JS SPA |
| Marketing | `server/public/` | Landing, privacy, terms, calculators |

Shared domain logic is **duplicated** (e.g. cycle capability matrix on server and mobile). Tests cross-import.

## Important paths

| Concern | Path |
|---------|------|
| Mobile screens | `mobile/app/` |
| Mobile domain | `mobile/src/lib/` |
| Mobile UI | `mobile/src/components/` |
| i18n KA | `mobile/src/i18n/ka.ts` |
| Expo config | `mobile/app.json` |
| EAS | `mobile/eas.json` |
| Health Connect plugin | `mobile/plugins/withHealthConnect.js` |
| iOS marketing version plugin | `mobile/plugins/withIosMarketingVersion.js` |
| Local Android prebuild | `mobile/android/` (gitignored pattern; present on this disk) |
| iOS native folder | **absent** (EAS remote) |
| API routes | `server/src/routes/*.routes.js` |
| Engines | `server/src/lib/` |
| Prisma schema | `server/prisma/schema.prisma` |
| Migrations | `server/prisma/migrations/` (13) + `phase*.sql` (11) |
| Seed | `server/prisma/seed.js` |
| Env examples | `.env.example`, `mobile/.env.example`, `server/.env.example` |
| Tests | `server/src/lib/**/*.test.js`, `mobile/src/lib/**/*.test.{js,ts}` |
| QA | `qa/`, `docs/qa-phase5/`, `docs/qa-phase9/` |
| Deploy | `render.yaml` (Frankfurt web + 6h pharmacy cron) |

## Data / runtime

```
Expo app --HTTPS--> https://medicard.ge (Render Express)
                      ├── /api/* REST
                      ├── /socket.io
                      ├── /admin
                      ├── /  landing
                      ├── /uploads  STATIC (unauthenticated)  ← RA00-001
                      └── Prisma --> Neon PostgreSQL
```

## Version identity (implementation)

- Public: `mobile/app.json` `expo.version` = **1.0.0.7.66**
- iOS marketing: `expo.ios.version` = **1.7.66**
- Bundle/package: `ge.medicard.app`
- `mobile/package.json` `"version": "3.3.0"` is **not** the public identity (RA00-023)
