# Medicard.GE — agent memory

## Mobile app versioning (mandatory)

Whenever you change the mobile app, bump `mobile/app.json` → `expo.version` (and any mirrored `APP_VERSION` in profile UI) **in the same change**:

| Change type | Rule | Example |
| --- | --- | --- |
| Small features, fixes, polish, copy, minor UI | **patch** +0.0.1 | `1.0.1` → `1.0.2` |
| Large features / architecture / major product surface | **major** +1.0.0 (reset minor/patch) | `1.0.1` → `2.0.0` |

Do this automatically without waiting to be asked. Mobile app is at **8.0.5**. Symptom anatomy (`/symptoms/body`) uses Nightingale Human Body SVGs (`9192:5539`) as tappable regions with pinch/zoom — not PNG + dots.

## Admin backend

- UI: `http://localhost:4000/admin` (prod: `https://medicard.ge/admin`)
- Dashboard is card-based with SVG icons (overview metrics, 14-day charts, package donut, app mode, recent users)
- Users registry (`/admin` → მომხმარებლები): Nightingale dashboard aesthetic — pulse hero, metric cards, 14-day signup chart, package/gender mix, click-row profile modal
- Overview also shows live OpenRouter USD balance (`GET /api/v1/credits`) and EvidenceMD status + Medicard usage (they have no public wallet API)
- Women's cycle module (**FEMALE only**): mobile `/cycle`, API `/api/cycle` — period predictions, daily symptom log, TTC (BBT/mucus), pregnancy week tracker, partner share link, doctor summary → AI chat prefill
- Cycle AI tips: `POST /api/cycle/insights` via EvidenceMD (`CYCLE_WELLNESS`), cached ~18h on `CycleProfile.aiInsights`; local Flo-like tips as instant fallback
- If `npx prisma generate` fails with EPERM on Windows, stop the API server (DLL lock), then regenerate
- Default seed login: `ADMIN_EMAIL` / `ADMIN_PASSWORD` (see `server/.env.example`)
- Packages: FREE (3/day), STANDARD (50/day), ULTIMATE (unlimited)
- App settings: maintenance/offline mode, min version, force update, registrations gate
