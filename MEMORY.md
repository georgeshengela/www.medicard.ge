# Medicard.GE — agent memory

## Mobile app versioning (mandatory)

Whenever you change the mobile app, bump `mobile/app.json` → `expo.version` (and any mirrored `APP_VERSION` in profile UI) **in the same change**:

| Change type | Rule | Example |
| --- | --- | --- |
| Small features, fixes, polish, copy, minor UI | **patch** +0.0.1 | `1.0.1` → `1.0.2` |
| Large features / architecture / major product surface | **major** +1.0.0 (reset minor/patch) | `1.0.1` → `2.0.0` |

Do this automatically without waiting to be asked. Mobile app is at **9.0.43**. Home hub sections are always **title then content** (`HomeSectionTitle` above the card, never the section name inside it) — same as შემდეგი მიღება, წონის კონტროლი, აქტიურობა. Daily login awards **5 points** inside `GET /api/auth/me` on every app open (Tbilisi day, unique per user). Streak screen is Figma `11425:139549` at `/profile/streak`. Profile tab / permissions dark chrome uses the same cool gray-950 stack as home and meds (`#030712` page, `#111827` cards, `#1F2937` chips, filled CTAs `#0D9488`). Medications hub uses a normal title (`მედიკამენტების ტრეკერი`) — no home date/hello/avatar header. The bottom tab pill overlays content with no page-color strip around it. Dark theme is cool gray-950 (`#030712` page, `#111827` cards, teal `#14B8A6`) — not teal charcoal. Overlay modals always fade (`APP_MODAL_PROPS` in `mobile/src/components/ui/appModal.ts`) — never `animationType="slide"` on a transparent Modal. Steps, meds, symptoms, plans, assessment, and profile-setup all follow the same light/dark token hooks as auth/home. Steps goals are a deadline campaign (not only the daily 10k chart): set target + deadline + weekday reminders at `/health-metrics/steps/goal` (Figma 8924:166715 / 8921:69885 / 8851:142819). Home has one Nightingale weight card (Figma 8848:112910) — tap opens today’s weight sheet; it updates profile `weightKg` and daily health-metrics history. Home page no longer shows the health-metrics privacy disclaimer or the compact package/quota banner. Symptom anatomy (`/symptoms/body`) uses Nightingale Human Body SVGs (`9192:5539`) as tappable regions with pinch/zoom — not PNG + dots.

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
