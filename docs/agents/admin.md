# Admin panel (V4) conventions

Moved verbatim from AGENTS.md on 2026-10-08 (token diet). Read this file before working in its area; add new notes here, not in AGENTS.md.

## Admin V4 (Stripe-style layer, 2026-09-27)

`server/admin/v4/stripe.css` loads last and owns the look: it re-tokens light/dark (`--s-*`, mapped onto the legacy `--v3-*`/`--teal` families) and restyles the shared primitives. `v4/components.css` holds the `s-*` components (s-card, s-metrics, s-badge, s-switch, s-table, s-segment, s-feed-item, s-field) — build new or rebuilt modules from those, not inline styles, and never add another `admin-vNN.css` layer. `v4/experience.js` adds the ⌘K/Ctrl+K palette (pages, sub-pages, actions, live user search, recents), `g`+letter navigation on physical keys (works on the Georgian layout), `?` cheat sheet, ⇧A activity + system health sheet, account menu, breadcrumbs, exit animations for dialogs/drawers/toasts and table density. Use `AdminV3.openDialog` for forms/decisions — never `alert()` or native `<dialog>`. Local preview: `node scripts/admin-dev-proxy.mjs` → http://localhost:4380/admin/ (local files, main API); the owner signs in themselves. To test new admin endpoints run `node scripts/admin-local-server.mjs` (main DB, every background job off, :4390) and point the proxy at it (`admin-preview-local`).

Admin management (2026-09-27): `/api/admin/manage` (`server/src/routes/adminManage.routes.js`) — module kill switches (`src/lib/featureFlags.js`, raw-SQL `FeatureFlag` table created lazily; missing row = enabled; `requireFeature()` blocks only writes with 503 `FEATURE_DISABLED` on Medi, Medi Vet chat, nutrition AI, reward redeem, referral payouts; flags also in `/api/app/status` `features`), Medi Quest template editing (edited rows get `config.adminManaged` and `ensureQuestTemplates` then keeps their target/rewards/priority), per-user Medi Coins grant/revoke (`RewardLedger` ADJUST/SYSTEM, never below 0, audited), AI-consent history, and per-user JSON export (audited). Pages `#/features` (მოდულები) and `#/quests` (Medi Quest); every page has a header „გზამკვლევი“ (`v4/guides.js`) — keep its steps true to the UI when you change a module.

Admin order and conventions (owner request 2026-10-02, „everything in its place, by priority“). Sidebar groups in this order: მთავარი (ოპერაციები, მხარდაჭერა, დირექტორი) → ადამიანები → ზრდა და კომუნიკაცია → პროდუქტი → სისტემა; one distinct icon per page (`index.html`; new glyphs in `v4/experience.js`). Font is FiraGO everywhere (`--s-font`). The header shows the title and a one-line purpose (`switchTab` copy in `admin.js` / module `mountHeader`) — keep the nav label, page title and purpose in sync. Page order: what needs action first, then key numbers, the work surface, trends, settings. Page tabs = underline `.v3-subnav` inside `.s-tabbar`; filters and periods = `.s-segment`. Dates: `AdminV3.formatDate(iso, 'datetime' | 'date')` („დღეს, 14:05“ / „28 სექ, 18:30“), Tbilisi time, never raw ISO or `toLocale*`. Charts: `AdminCharts.line` for trends, `AdminCharts.bars` for counts per day/hour (today's unfinished day is drawn dashed/light automatically), `.s-meter` rows for rankings. Never show raw enums, ids, camelCase or English server text as the main label: map them (Brain: `brainFamilyLabel`, `suppressText`, `brainResultBadge` in `ops-center.js`; audit: `window.AdminAuditLabels` from `v3/modules/audit.js`; synthetic `…@phone/@apple.medicard.ge` logins show as the phone / „Apple-ით შესული“). Page-only CSS lives in its page block at the end of `v4/components.css`.

Online now (owner 2026-10-06): the admin home lists who is in the app this minute under the live hero — `server/src/lib/onlineUsers.js` (AppActivity `lastAt` ≤ 90 s + User), socket `ops:online` (on connect, after activity when someone came/left/changed screen, every 10 s while an admin is watching), fallback `GET /api/admin/online-users`; client `paintOnline` in `command-center-v3.js`, styles `.cc-on-*` in `v4/components.css`. Phone heartbeat `src/lib/livePresence.ts`, web `/app` heartbeat `public/app/js/presence.js` (15 s, raw request — no cache invalidation). A heartbeat keeps the last screen in `AppActivity.activityType`. Names/contacts only — never health values in this list.

## Admin tab shell width (mandatory)

Tab selector and active tab content must share the **same left/right edges** — identical width. Never add horizontal padding only on the pane/body while the tablist stays full-bleed (and never max-width the content narrower than the tabs).

**Every admin page body is full workspace width** (`--v3-page-max: none`). Do not cap Settings / forms / modules at 720px, 920px, 1440px, or 1600px. Login cards, drawers, dialogs, toasts, and table-cell clips may stay constrained.

Applies to Push (`#/push` subnav ↔ panels), user investigation (`#/users/:id` `.user-tabs` ↔ `.user-body`), Settings and any future admin subnav.

```css
/* Pattern */
.shell { display: flex; flex-direction: column; gap: 14px; width: 100%; }
.shell > .tabs,
.shell > .pane { width: 100%; margin-inline: 0; padding-inline: 0; box-sizing: border-box; }
```

Shared hooks: `.v3-tab-shell`, `.v3-push .push-board`, `.v3-user-page .v3-user-board`. Kill legacy inset like `.user-body { padding: 22px }` inside V3 boards.
