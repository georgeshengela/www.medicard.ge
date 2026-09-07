# MediCard Admin V3 — Step 1 audit

Read-only. No production logic changed. Live QA: `http://localhost:4000/admin` at 1280 / 1440 / 1920 on 2026-09-07. Artifacts: `qa/admin-v3-step1/`. Interactive tables: canvas `admin-v3-step1-audit.canvas.tsx`.

Entry: `server/admin/index.html` → `ops-center.js` → `admin.js` → `rewards-admin.js`. API: `/api/admin`, `/api/admin/rewards`.

## Do not rebuild

Keep Command Center, Users + investigation page, Push studio + Brain, Medi eval, Health features, Orders, Packages, SMS, Pharmacy, Rewards ops (overview/campaigns/partners/redemptions/codes), Quality, Audit, Settings. Quest / Achievements / Companion have **no admin UI today** — do not invent fake dashboards.

## Live QA

- Login worked. All 13 nav routes render. Unknown hash → 404 panel.
- 0 JS page errors, 0 console errors, 0 HTTP 4xx/5xx during click-through.
- No horizontal overflow on main screens at 1280 / 1440 / 1920.
- Campaign create modal: panel 720px, footer below 900px viewport (`footGone: true`).
- User Save in DOM at y≈1091 (viewport 900) — footer is not sticky.
- Quality / Brain often still skeleton after ~2s (multiple parallel GETs).
- Overview fires 7 analytics GETs. Users list polled every 8s. Push stats polled on compose/copy/engage.

## P0

| ID | Screen | Issue |
|---|---|---|
| ADM-001 | Campaign create | Save/Cancel footer off-screen |
| ADM-002 | Settings | Save uncaught; maintenance / QA OTP with no confirm |
| ADM-003 | Rewards | Activate/pause campaign or partner with no confirm |
| ADM-004 | Command Center | Errors KPI can warn while Attention says healthy |
| ADM-005 | Command Center | `გაგზავნილი` = scheduled, not sent |
| ADM-006 | Quality | Integrity % mixes row-count numerator with unique-user denom |
| ADM-007 | Rewards | Today / 7d KPIs use UTC; rest of admin is Tbilisi |
| ADM-008 | Command Center | Feature % of active can exceed 100% |
| ADM-009 | User page | Package dates written as UTC midnight |

## Step 2 first

Shared chrome (header, toolbar, dialog, drawer, confirm, toast) → Command Center hierarchy (alerts first) → Rewards campaign create as a page + confirm activate → user sticky footer → URL state for users/push/rewards → honest KPI labels. No visual mosaic, no glass, no giant tiles.
