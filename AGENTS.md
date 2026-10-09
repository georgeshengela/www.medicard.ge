# Medicard.GE agent notes

This file is loaded into every session, so it holds only rules that apply everywhere. Area details live in `docs/agents/` — **read the matching file before working in that area**, and put new notes there (keep this file short; add a line here only for a rule every session needs).

| Working on | Read first |
| --- | --- |
| App Review, permissions, 18+, versions, OTA, store builds, product freeze, dark theme tokens | [docs/agents/release-and-review.md](docs/agents/release-and-review.md) |
| Mobile UI: module names/brands/wordmark, `ModuleHeader`, Home + layouts, modals, Pressable, keyboard, app icons, navigation, languages | [docs/agents/mobile-ui.md](docs/agents/mobile-ui.md) |
| Cycle (MEDICYCLE): look, forecasts, reminders, widget, temperature, logging, privacy | [docs/agents/cycle.md](docs/agents/cycle.md) |
| Medi chat, MEDISCAN, Medi Vet / Pets | [docs/agents/medi-ai.md](docs/agents/medi-ai.md) |
| MEDIRUN: campaign, boxes, economy, coins store, background GPS, Glow map, decor, weather, viral layer | [docs/agents/medirun.md](docs/agents/medirun.md) |
| Admin panel | [docs/agents/admin.md](docs/agents/admin.md) |
| Sign-in, accounts, phone gate, onboarding, referral | [docs/agents/accounts.md](docs/agents/accounts.md) |
| Server: loop guards, cache, schema installs, email, support, capacity, errors, module switches, news | [docs/agents/server-ops.md](docs/agents/server-ops.md) |
| MEDI QUEST, MEDI COACH, nutrition, reminders, web `/app` | [docs/agents/features.md](docs/agents/features.md) |
| Main DB + publishing rules (full text) | [docs/agents/process.md](docs/agents/process.md) |

Other docs: `docs/I18N.md`, `docs/MEDI-ASSISTANT.md`, `docs/NUTRITION.md`, `docs/TRAINER.md`, `docs/APP-REVIEW-*.md`, `docs/DB-DROP-CANDIDATES.md`.

## How we work

- **Main database only.** Use the main MEDICARD DB and https://medicard.ge API for app, previews and tests unless the owner says otherwise. Never copy/reset owner data; keep test writes narrow, nothing destructive.
- **Publish finished work.** After a verified change: commit and push the relevant files (never secrets, never others' in-progress edits — other sessions share this checkout, commit your own paths with `git commit -- <paths>`), check the deploy when backend behaviour changed, report the real state.
- **Versions.** Every store-facing mobile change bumps only `expo.version` in `mobile/app.json` (five-part `G.0.0.B.R`): small fix → `.R`+1 and ship by OTA (`npm --prefix mobile run ota -- "msg"`); native module/plugin/permission/SDK change → train `.B`+1 = store build (iOS: `npm --prefix mobile run build:ios`; `ota:baseline` at each store build). Never hand-edit derived copies in `app.config.js`. Never use OTA to add review-worthy features (2.5.2). Details in release-and-review.md.
- **Schema:** additive raw-SQL `server/scripts/install-*.mjs`, each added to `npm run db:install` (Render Pre-Deploy). Never `prisma db push`, never `npm run release` as pre-deploy.

## Product rules (always)

- MEDICARD is free for consumers: no paid unlocks, upgrade CTAs, quotas or purchase flags.
- Accounts are 18+. Health data never goes into URLs, emails, push analytics, funnel events, error reports or admin "online" lists.
- AI: every AI call goes through the consent path (`consentedAiFetch` app, `withAiConsent` web); never pre-accept consent; a declined consent is a calm note (`AiConsentDeclinedNote`), never an error.
- Languages: every new user-facing string in Georgian and English (`tx('ქართული','English')` / `ka` dictionary + `src/i18n/en`; server `t(req, ka, en)`); admin stays Georgian; consent versions derive from Georgian text.
- Names: the AI is **Medi** (never Nightingale). Modules are one word — MEDIRUN, MEDICYCLE, MEDIFOOD, MEDIPILL, MEDIQUEST, MEDIVET, MEDICOACH, MEDISCAN, MEDILAB (never with a space, never MEDIDOCTOR); the tab-bar centre button alone reads RUN. Imaging = „გამოსახულება“, never „სნიმარი“.
- Freezes: Pets/Medi Vet bug fixes only; MEDIRUN no new zones/prizes (≤1 event/month); cycle no new phases until iOS QA; the women's community opens/closes only via the admin launch flag (`CommunityConfig.open`; it is OPEN since 2026-10-02 — check the flag, don't assume it is closed). District competition is retired — never recreate it. No fifth bottom tab.
- New module = key in `featureFlags.js` `FEATURES` + `requireFeature` + `featureRoutes.ts` + admin `FEATURE_SECTIONS`. Never block `/api/health-metrics/sync`; never cancel medication/visit reminders on a pause. Every reminder family has a switch in Profile → შეტყობინებები and a call in the reconcile.

## Mobile gotchas (always)

- Routes live in `mobile/app/`; **never create `mobile/src/app`**. New screens need `<Stack.Screen … headerShown:false>`.
- `Pressable` styles must be static objects/arrays (NativeWind drops function-form styles).
- `Modal` only from `@/components/ui/appModal` with `APP_MODAL_PROPS` (fade, never slide).
- OS permissions are requested only from a button press, never from effects/background; a pre-permission screen has exactly one button „გაგრძელება“ / Continue that opens the system sheet.
- No `router.push` / navigation from AppShell-level code before `canOpenNotificationRoute`.
- Forms use `KeyboardFormShell` / `useKeyboardPad` (the sign-in pattern); never two keyboard-inset mechanisms.
- Server reads through `useAccountQuery` (TanStack, keys `['acct', id, …]`); new write prefixes go in `queryInvalidation.ts`; never invalidate `/api/health-metrics`. Socket events must never trigger writes without the loop guards; foreground work uses `onReturnToForeground`.
- Home blocks: section title above the card (`HomeSectionTitle`), never inside. Hub look: flat `surface` cards, radius 22, one spotlight per page. Use theme tokens / `hubInk`, not hard-coded teal.
- Module pages use `ModuleHeader` / `ModuleStackHeader` („სტანდარტული მოდული ჰედერით“), never a hand-made header row.

## Admin (always)

Build from `v4/components.css` `s-*` components, forms via `AdminV3.openDialog` (never `alert()` / `<dialog>`), dates via `AdminV3.formatDate`, pages full width, no new `admin-vNN.css`. Never show raw enums/ids as labels. Details in admin.md.
