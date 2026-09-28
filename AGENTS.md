# Medicard.GE agent notes

## App Review correction (2026-09-22)

MEDICARD is entirely free for consumer accounts. No commercial user types, paid unlocks, upgrade CTAs or quotas may be enabled by environment/config flags. This supersedes older purchase-toggle guidance below. Keep historical billing rows only for data integrity and older API compatibility; preserve admin authorization roles. AI disclosure is a real native Modal with bounded scroll content and pinned choices. Named recipients/data categories and voluntary consent must be shown before any AI transmission, including voice transcription and speech output. Decline/close/revoke must block transmission without presenting the choice as a network error. The current consent version is derived from the full disclosure manifest; never pre-accept for real users. See docs/APP-REVIEW-2026-09-22.md for release evidence and remaining publication steps.

## MEDI QUEST unified hub (2026-09-19)

Owner explicitly replaced the Profile robot and separate Companion pages with one native `/medi-quest` hub (missions/progress/rewards). Profile uses `QuestProfileCard`; Companion routes (`/medi-companion`, `/journey`, `/collection`) are 5-line compatibility redirects kept for old push `route`s; the Companion UI components were deleted 2026-09-27. `/api/medi-companion` and its tables stay: `useQuestJourney` reads journey/overview and writes equipment through it (see docs/DB-DROP-CANDIDATES.md). Keep the geometric progress seal, existing ownership/equipment and journey math (completed daily=1/weekly=3), separate from claimed XP/coins. Do not restore the robot entry or old separate home based on older notes. Quest/Companion cache reads and late responses must stay scoped to the captured account. Global bottom navigation stays hidden on Quest routes. Native version1.0.0.9.6 / iOS1.9.6; no DB schema change.

## Release readiness (2026-09-15)

Beta execution 2026-09-15: owner-tested EAS preview `1.0.0.8.41` is AdHoc IPA / internal APK — not TestFlight/Play. `eas submit --profile beta` did not upload. Store-distribution EAS production builds were not started (paid). Do not treat Expo Go as store proof. Do not silently disable Pets on production — scope claims instead. Do not remount a global `/api` request-count limiter. Auth writes are IP-limited; GET `/api/auth/me` is skipped. Seed must not rotate an existing admin `passwordHash` (Render runs seed on every deploy). Consumer purchases are permanently off (App Review correction 2026-09-22); the old `CONSUMER_PURCHASES_ENABLED` flag has no effect.

## Permission primers (App Review 5.1.1(iv), 2026-09-27)

Apple rejected build 1.11.9 (20) because the Health message before the permission sheet said „ნებართვის მიცემა“ (Allow) and had „ახლა არა“. Any screen shown before an OS permission sheet (notifications, Apple Health / Health Connect, location, camera, microphone, photos) has **one** button, „გაგრძელება“ / Continue, and it always opens the system sheet. No Not now / Later / Skip / close / tap-outside before the request; after the sheet was answered a Close or Open Settings is fine. Copy lives in `mobile/src/lib/permissionPrimer.ts` (English on non-Georgian devices); each primer shows once per device. Guarded by `mobile/src/lib/deviceAccess.test.js`. App Review phone sign-in uses `APP_REVIEW_PHONE` + `APP_REVIEW_OTP` (Render env only). See docs/APP-REVIEW-2026-09-27.md.

## MEDI COACH review rules (2026-09-28, app 1.0.0.16.0)

Before the first store build with MEDI COACH: nothing is shared with a trainer by default (`DEFAULT_SCOPES` all false, `CONSENT_VERSION` bumped on any consent-copy change); the consent sheet names what a trainer always sees (name, photo, age, sex, height, session schedule) and every scope (workouts include sleep). Clients and trainers can report each other and a client can block a trainer (`server/src/lib/coachSafety.js`, `/trainer/report`, admin ტრენერები → შეტყობინებები, Director Telegram notice); a client who ended/declined or blocked is never re-invited by that trainer. Privacy §14 / Terms §22 describe it — edit `scripts/privacy-source.md` / `scripts/terms-source.md`, then `node scripts/build-legal-pages.mjs && node scripts/sync-privacy-ka.mjs`; never hand-edit `privacy.html` (the build overwrites it). The QR scanner is a one-button „გაგრძელება“ primer until the camera question is answered.

## OS permissions (iOS 26)

Never call `requestPermissionsAsync` / HealthKit `requestAuthorization` / location request from `useEffect`, `InteractionManager`, or post-login background work. iOS 26 does not show the sheet (and can mark denied with no UI). Show `PermissionGateHost` after login and request only from the enable button. Setup **ნებართვის მიცემა** must call `requestNotificationPermission` on press. Background reminder code may only read `getNotificationPermissionGranted`. HealthKit step reads must not re-request authorization. `Linking.openSettings` has no Notifications row until the app has requested once.

## Navigation before the shell mounts (2026-09-27, app 1.0.0.13.21)

expo-router wraps `app/_layout` in its own root stack, and AuthGate renders no `Stack` until auth/theme are ready. A `router.push` in that window does not fail: it pushes a second copy of the whole root layout (new providers, new AppShell). That is how a notification tap on a cold start looped on the splash with a flickering status bar. Never navigate from AppShell-level code, listeners or timers until `canOpenNotificationRoute` (segments non-empty, not `(auth)`) is true; `navigationRef.isReady()` is always true and proves nothing. Notification taps are claimed once per process (`notificationTaps.ts`) and routes must pass `isNotificationRoute`. Keep the root `ErrorBoundary`: the production boot guard swallows fatals, so without it a render crash is a frozen screen.

## Product naming

The in-app AI is **Medi**. Never write Nightingale in user-facing copy (chat titles, CTAs, bubbles, share toggles). Nightingale is only the Figma UI kit name.

## Pets / Medi Vet

Hub copy is **ჩემი ცხოველები**. The pet assistant is **Medi Vet**. Profile **ყველას ნახვა** opens `/pets` manage hub (swipe right edit / swipe left archive, product/care/Medi Vet/weight tiles for the featured pet). Phase 5 local care reminders are implemented on the Notification Brain (`pets:`). Phase 6 Medi Vet is isolated OpenRouter chat (`/api/pets/:petId/chat/query`, never EvidenceMD / `withPatientAiContext`). Phase 7 local SQL/HTTP verification ran against disposable Postgres `127.0.0.1:55432` / `medicard_pets_phase7`. Phase 7.1: bird/unsupported-species is a bounded COMPLETE (not 502); COMPLETE+quota are one transaction; Pixel_8 development APK talked to isolated `:4010`; **OS notification banners were not observed**. **Hosted Neon Pets SQL is applied** (phase2 → phase7, additive `db execute` only — never `db push`). Owner-reported 2026-09-15: dog create, weight, allergies, Medi Vet chat on production. Do not re-apply SQL. Do not hang pets on `HealthProfile`, `ChatSession`, `MedicationSchedule`, `DoctorVisit`, or Home. Do not add a fifth bottom tab.

## Expo Router app directory

Routes live in `mobile/app/`. **Never create `mobile/src/app`** (even empty). Expo Router prefers `src/app` if that folder exists and shows the stock “Welcome to Expo” screen instead of Medicard.

## Admin V4 (Stripe-style layer, 2026-09-27)

`server/admin/v4/stripe.css` loads last and owns the look: it re-tokens light/dark (`--s-*`, mapped onto the legacy `--v3-*`/`--teal` families) and restyles the shared primitives. `v4/components.css` holds the `s-*` components (s-card, s-metrics, s-badge, s-switch, s-table, s-segment, s-feed-item, s-field) — build new or rebuilt modules from those, not inline styles, and never add another `admin-vNN.css` layer. `v4/experience.js` adds the ⌘K/Ctrl+K palette (pages, sub-pages, actions, live user search, recents), `g`+letter navigation on physical keys (works on the Georgian layout), `?` cheat sheet, ⇧A activity + system health sheet, account menu, breadcrumbs, exit animations for dialogs/drawers/toasts and table density. Use `AdminV3.openDialog` for forms/decisions — never `alert()` or native `<dialog>`. Local preview: `node scripts/admin-dev-proxy.mjs` → http://localhost:4380/admin/ (local files, main API); the owner signs in themselves. To test new admin endpoints run `node scripts/admin-local-server.mjs` (main DB, every background job off, :4390) and point the proxy at it (`admin-preview-local`).

Admin management (2026-09-27): `/api/admin/manage` (`server/src/routes/adminManage.routes.js`) — module kill switches (`src/lib/featureFlags.js`, raw-SQL `FeatureFlag` table created lazily; missing row = enabled; `requireFeature()` blocks only writes with 503 `FEATURE_DISABLED` on Medi, Medi Vet chat, nutrition AI, reward redeem, referral payouts; flags also in `/api/app/status` `features`), Medi Quest template editing (edited rows get `config.adminManaged` and `ensureQuestTemplates` then keeps their target/rewards/priority), per-user Medi Coins grant/revoke (`RewardLedger` ADJUST/SYSTEM, never below 0, audited), AI-consent history, and per-user JSON export (audited). Pages `#/features` (მოდულები) and `#/quests` (Medi Quest); every page has a header „გზამკვლევი“ (`v4/guides.js`) — keep its steps true to the UI when you change a module.

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

## Home hub sections

A home block is **title, then content**. The section name sits **above** the card — never inside it. Match შემდეგი მიღება / წონის კონტროლი / აქტიურობა.

```tsx
import { HomeSectionTitle } from '@/components/home/HomeSectionTitle';

<View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
  <HomeSectionTitle title={ka.home.nextDose} />
  {/* card / slider / chart — no repeated section title inside */}
</View>
```

Do not put the hub title in the card header. Card chrome can still show metric names (e.g. წონა on the weight sparkline card).

## Pressable styles (NativeWind gotcha)

NativeWind v4 **silently drops function-form style callbacks on `Pressable`** — `style={({ pressed }) => ({...})}` is never invoked, so the button renders with NO styles (invisible white text, unstyled layout). Always use a static object/array: `style={{ ... }}`. For pressed feedback use NativeWind `active:` classes or skip it. New screens' routes also need `<Stack.Screen name="..." options={{ headerShown: false }} />` in `app/_layout.tsx`, or an ugly system header appears on top. The sweep is complete (verified 2026-09-27: 0 function-form Pressable styles; `CyclePressable` resolves function styles itself before building its array).

## Mobile modals

Transparent overlays **fade**. Never `animationType="slide"` — that slides the dim and leaves an ugly transparent hole.

```tsx
import { APP_MODAL_PROPS } from '@/components/ui/appModal';

<Modal visible={visible} {...APP_MODAL_PROPS} onRequestClose={onClose}>
```

Import `Modal` from `@/components/ui/appModal`, never from `react-native` (test `tests/modal-chrome.test.cjs`): on iOS the tab pill and run badge live in a `FullWindowOverlay` window above every RN Modal, and the app Modal hides that chrome while open. In-window overlays (permission gate, location ask) call `useHideTabChromeWhile(visible)`. Prompts and confirmations (Face ID offer, delete account, default home) are centered cards; pickers and long forms may stay bottom sheets. Spread `APP_MODAL_PROPS` on every overlay Modal. Opaque full-screen takeovers (e.g. cycle onboarding) may stay `transparent={false}`. Dim color: `APP_MODAL_OVERLAY`. Keep the scrim as a **sibling** of the sheet, not a parent wrapping it.

## Dark theme

Dark is **cool gray-950 navy**, not teal charcoal. Keep `global.css` `.dark` and `src/theme/colors.ts` `darkColors` in sync.

| Token | Hex | Role |
| --- | --- | --- |
| `bg100` | `#030712` | Page / tab canvas |
| `surface` | `#111827` | Cards, auth screens |
| `surfaceRaised` / `bg200` | `#1F2937` | Sheets, inputs, chips |
| `bg300` | `#374151` | Borders, tracks |
| `text100` / `text200` / `text300` | `#FFFFFF` / `#D1D5DB` / `#6B7280` | Heading / body / placeholder |
| `primary200` | `#14B8A6` | Links, icons, brand |
| `primary100` | `#99F6E4` | Brand text on dark |
| `accent100` | `#042F2E` | Brand tint fill (avatars, welcome hero) |

Filled dark CTAs use `#0D9488` (`FIGMA_AUTH_DARK.primaryBg`), not `#14B8A6`. Auth screens sit on `bg-surface`. Google on dark is a **white** fill with dark label. Do not invert the stack (page stays darker than cards).

On every **store-facing** mobile change, update `mobile/app.json` `expo.version`. The public identity is Instagram-style **five-part** `G.0.0.B.R` (current value: `mobile/app.json` — never copy it into docs). That string is Android `versionName`, in-app display, and `/api/app/status`. Bump **only** `expo.version` in `mobile/app.json`: `mobile/app.config.js` derives `extra.medicardInternalVersion` (Profile display + `/api/app/status`) and Apple's three-part `ios.version` `G.B.R` from it — never hand-edit those copies (a stale `extra` copy once froze Profile at `1.0.0.11.23`). Plugin `withIosMarketingVersion` stays as last-write guard. Never put `1.7.72` in `minAppVersion` — that would block five-part clients. Native `ios.buildNumber` / `android.versionCode` in `app.json` are a local floor only. EAS production uses `appVersionSource: remote` + `autoIncrement` (remote was **2** on 2026-09-11) — never lower the remote counter. Cycle phase numbers stay in contracts / QA only.

- **Small** feature/fix → revision + 1 (`1.0.0.7.78` → `1.0.0.7.79`)
- **Native / store train** → train + 1 and bump `buildNumber` / `versionCode` (`1.0.0.7.77` → `1.0.0.8.0`)
- **Rare product generation** → first number + 1 (`1.0.0.7.71` → `2.0.0.0.0`)

See `MEMORY.md` for details. Cycle phase numbers stay in contracts / QA only.

## Hub design language (owner direction, 2026-09-26)

Home is the reference look; every other mobile page is to be migrated to it gradually. Tokens and type live in `mobile/src/theme/hub.ts` (`HUB`, `hubInk`, `hubTint`, `hubText`); building blocks are `HomeSectionHeading` (title outside the card, optional right link) and `HubFeatureCard` (icon tile / title / body / CTA row, `surface` or one `spotlight` per page). Cards are flat `surface`, radius 22, no border, no shadow; icons sit in a 42px tile tinted with the ink at 8% light / 15% dark; section gap 28, gutter 20. Do not add per-section colour schemes, decorative arcs, or a second dark card on a page. Copy addresses the person as შენ.

## Product freeze (2026-09-26)

Owner decision after the 2026-09-26 strategic audit: fewer features, one clear promise. These freezes override older notes that invite expansion.

- **Pets / Medi Vet:** no new features. Bug fixes only. Isolation rules above still apply.
- **MEDIRUN:** no new zones or prizes; at most one event per month. The user-visible name is **MEDIRUN** everywhere — never RUN, MEDI RUN, Medi Run, MEDIPULSI or „სირბილი" as the product name (the verb/activity „სირბილი" in a sentence is fine). Internal identifiers (`medipulsi*` routes, tables, capabilities) stay as they are.
- **Cycle:** no new phases until iOS QA is complete.
- **Women's space (community):** no open launch until there are 300+ active women and named human moderators assigned to the queue. Access sits behind the admin launch flag (`CommunityConfig.open`, admin ქალების სივრცე → launch card, audited, `COMMUNITY_MANAGE`). Missing row/table = closed. While closed, existing `CommunityMember`s keep full access, new members cannot join (`POST /api/community/membership` 403), and Home/Explore hide the entry for non-members (`useCommunityEntry`). Do not remove or bypass it.

## Cycle look (2026-09-28, app 1.0.0.17.6)

Owner-requested redesign, UI only (no new phases, honesty rules unchanged). Palette `src/theme/cyclePalette.ts` speaks the colour language women already know from Flo / Apple Health, because there is no Georgian cycle app and every user migrates from one of those: **rose-red** bleeding (solid = logged, dashed = expected), **turquoise** fertile window / ovulation (`fertileFill` for graphics), rose actions, today in calm ink, blush-white canvas. Owner rejected an earlier clay/blue/teal set as ugly and unfamiliar. Contrast is enforced by `tests/cycle-palette.test.cjs`. One grammar on ring, strip and calendar: logged bleeding = solid clay circle, estimated period = dashed clay ring, estimated fertile = soft turquoise circle with turquoise number, estimated ovulation = soft turquoise + turquoise ring, logged symptoms = small dot under the date — no bands or abstract lines (the owner found a band unreadable). The legend draws tiny day circles. Layout: the week strip is a card inside the 20 px gutters and is the only pinned element (header and tabs scroll away); the selected day (today by default) sits in the middle column with three days either side, and a „დღეს“ pill appears once today scrolls out of view. The hero ring (`CycleStatusGauge`) is one bead per cycle day with one number in the centre (bleeding day → „დღეს“ → countdown with „სავარაუდოდ“ → cycle day); „მენსტრუაცია დაიწყო“ leads only when the period is plausible within 3 days, unknown or late. Cards are flat hub cards; no decorative arcs.

## Minimum age 18+ (2026-09-27, app 1.0.0.13.15)

Owner asked for the legal minimum. Health data is a special category under Law 3144 and a minor's special-category data needs parental consent, which we cannot verify, so accounts are **18+**: `MIN_USER_AGE` in `server/src/lib/patient.js` (`birthDateSchema` refuses younger dates at account creation; edit routes use `birthDateInputSchema` + `birthDateAgeError`, which refuses only a new or changed under-18 date, because profile saves re-send the stored date) and `mobile/src/lib/birthdate.ts` (pickers and the onboarding birth-date step). Accounts created before the rule are not blocked or deleted automatically; admin users → „18 წლამდე“ lists them for the owner to review. Lower the limit only after legal review and with a parental-consent flow.

## Phone verification gate (2026-09-27, app 1.0.0.13.14)

Owner-approved: a verified phone is required only where abuse or real value is at stake. Server middleware `requireVerifiedPhone` (`server/src/lib/phoneGate.js`) answers 403 `PHONE_VERIFICATION_REQUIRED` on women's-space join / post / comment and `POST /api/rewards/:id/redeem` (partner vouchers included); apply it to referral rewards and family members when those ship. `User.phone` is only written after an OTP check (or by an admin); email `/register` ignores any `phone` field (2026-09-27 review fix), so a stored Georgian mobile counts as verified. The app catches the code (`mobile/src/lib/phoneGate.ts`) and offers `/profile/verify-phone` (number → SMS code, keyboard-safe shell) instead of an error. Never gate everyday health features (Medi, meds, nutrition, lab, cycle, pets).

## One Medi (2026-09-27, app 1.0.0.13.8)

`/assistant` is the only Medi screen, with a mode switch: **Medi** (planner: actions, handoffs), **ექიმთან** (`?mode=doctor`, DOCTOR via `/api/ai/query`) and **ღრმა ანალიზი** (`?mode=deep`, the former consilium). The clinical chat lives in `MediConsultation`; `/chat/[mode]` is a redirect that accepts every spelling (doctor/DOCTOR/consilium/CONSILIUM) and keeps `sessionId`/`prefill`. A `consult` handoff switches the mode in place (staged launch still keyed by the legacy `/chat/…` route). Medi-mode conversations are saved as `ChatSession` with `mode: 'ASSISTANT'` through `POST /api/chats/assistant` and reopen from ჩემი ბარათი; ASSISTANT sessions are excluded from the consultation AI context, from `/api/ai/query` session lookup and from Brain consultation nudges. Symptoms, lab, skin and imaging stay separate tools opened by handoff. Medi Vet stays `/pets/:id/chat` with its own endpoint and storage. Tests: `npm --prefix mobile run test:medi`, `server/src/lib/assistantChats.test.js`.

## 7-step onboarding (2026-09-27, app 1.0.0.13.6)

New accounts answer 5 questions in `/(auth)/assessment` (`ONBOARDING_STEPS`): sex → primary goal (medications / nutrition-weight / cycle for women / general) → birth date → height+weight on one screen → one goal step (first medication / target weight / last period start). Then step 6 = the required privacy acceptance (legal record, text unchanged) followed by the voluntary AI consent, and step 7 = notifications (requested only from its button). `extraAnswers.primaryGoal` moves that Home section right after "ask Medi"; `onboardingVersion: 2` + `onboardingStepKey` drive resume. The goal step saves where the feature already reads it: `saveWeightGoal` (reminders off until notifications are granted) and `api.cycle.setLastPeriod`. Avatar, phone verification, Face ID and location are no longer onboarding steps; their screens stay routable for features that need them. The full question list lives at `/profile/complete` ("დაასრულე პროფილი", Home card from `profileCompletion`). Existing users (`completedAt` set) never see the new flow. Test: `npm --prefix mobile run test:onboarding`.

## Email system (2026-09-28)

`server/src/lib/email/` (`email.js` re-exports for `passwordReset.js`). Resend over plain fetch (Idempotency-Key, batch, 429 back-off), one branded layout, templates = code defaults (`templates.js`) + admin overrides (`EmailTemplate`), `{{var}}` allow-list per template, HTML-escaped, links https/mailto only. Triggers: `welcome` after email `/register` (setImmediate, once per user via `EmailLog.idempotencyKey`, never blocks sign-up; phone sign-ups have a synthetic `@phone.medicard.ge` login and get nothing), `password_reset`, `account_deleted` (after `DELETE /api/auth/me` commits, not linked to the deleted row). Kill switch = feature flag `email`; per-template `enabled`. `EmailLog` keeps sha256 + masked address only, purged after 180 days (`email-log-purge` lease). Resend webhook `POST /api/email/webhook` (Svix, `RESEND_WEBHOOK_SECRET`, 503 when unset) advances status and suppresses hard bounces / complaints (`EmailSuppression`, transactional included). Marketing needs `User.emailMarketingOptIn` (Law 3144; off by default; raw SQL only — the Prisma fields are `@ignore`), toggled in Profile → Notifications or `/unsubscribe?t=` (signed, RFC 8058 POST). Campaigns: admin `#/email`, worker lease `email-campaigns`, claims each recipient once. Never put health data in an email. Tables: `prisma/20260928-email.sql` via `install-email.mjs` in the release chain. Tests: `server/src/lib/email.test.js`.

## MEDI COACH — fitness trainers (2026-09-28, app 1.0.0.15.0)

Owner request 2026-09-28 (overrides the product freeze for this module). Verified trainers (phone + 18+ +
admin approval in `#/trainers`) get a separate workspace `/coach` with its own tab bar; clients use `/trainer`.
Linking is consent-first: named scopes (workouts, nutrition, weight, photos — photos off by default), revocable
instantly; trainers read client data only through `requireClientAccess` in `server/src/lib/trainerStore.js`.
A trainer's meal plan never overwrites the client's nutrition program — adherence is computed from the diary.
Gyms: `server/src/data/gyms-ge.json` (install adds missing rows only; admin edits persist). Times are
`TIMESTAMPTZ`. Health workouts: Android needs the READ_EXERCISE / READ_ACTIVE_CALORIES_BURNED native build.
No payments, no chat (not built: needs moderation/retention policy). Flag `coach`. See docs/TRAINER.md.

Photo avatars + personal QR (2026-09-28, app 1.0.0.15.1): `UserAvatar` / `UserQr` tables
(`prisma/20260928-avatar-qr.sql`, `install-avatar-qr.mjs`), API `/api/identity`. A photo is visible only to the
person, open trainer↔client links, everyone for VERIFIED trainers, and a verified trainer holding the person's
current QR token (`canViewAvatar`); the women's space never shows it. The personal QR is a random renewable
token (`https://medicard.ge/u/TOKEN`), never the user id; a trainer's scan returns identity only and an invite
(`TrainerLink.initiator = 'TRAINER'`) shares nothing until the client accepts with scopes. `StyledQr` geometry
was verified with a decoder (round dots failed) — keep modules ≥ 0.47 cell and logo ≤ 20 %. Codes stay as a
fallback until the owner says otherwise.

## Retired district competition (2026-09-19)

The owner removed the district walking competition completely. Do not recreate its screens, sync, admin module, or database tables. MEDIRUN / MEDIPULSI remains the worldwide exploration game, accessible from Home; its duplicate Profile block is removed. Shared health totals and Pets remain independent.


## Unified Medi conversation (2026-09-21, app 1.0.0.11.4)

Owner explicitly removed human/pet tabs from the global action assistant. Do not restore them. `/assistant` sends `scope:auto`; server resolves owned pet names (including Georgian suffixes) or asks for identity clarification. This UX does NOT merge human/pet storage or authorization. Dedicated Medi Vet clinical chat remains separate. Voice questions stay on the conversation canvas; manual forms and capability discovery are opt-in. Keep signed reviews and idempotent execution, never fabricate external clinic bookings or medication doses. See docs/MEDI-ASSISTANT.md latest entry.

## Main database only (owner requirement, 2026-09-24)

Always use the main MEDICARD database and https://medicard.ge API for the owner's app, Expo previews, and testing. Never switch to another database or an isolated QA backend unless the owner explicitly changes this rule. The app is prelaunch and the owner tests using existing main-database accounts. Do not copy or reset their data. Keep test writes narrowly scoped and avoid destructive changes.

## Keyboard comfort (owner requirement, 2026-09-24)

Every form must keep the focused input and primary action above the keyboard, with compact spacing and smooth opening/closing. Follow the existing sign-in pattern: a bounded scrolling form and a pinned, animated footer, with safe-area padding only when the keyboard is closed. Owner 2026-09-28: the sign-in screen is THE reference for every screen with an input and a button — build pages on `mobile/src/components/ui/KeyboardFormShell.tsx` (measured keyboard overlap, animated footer, focused field scrolled into view, no KeyboardAvoidingView) and use its `useKeyboardPad` for bottom panels and sheets. Never combine two keyboard-inset mechanisms. Check small screens, iOS and Android, focus changes, dismissal and submission; browser-only checks are not proof of native keyboard behavior. This is a completion requirement for new and edited forms, including community nickname onboarding.

## Publish completed changes (owner requirement, 2026-09-24)

After completing and verifying requested app/backend changes, commit and push the relevant finished changes to the existing Git remote so the owner can test. Check deployment when backend behavior changes. Preserve unrelated in-progress edits and never commit secrets. Report the deployed/verified state accurately.

## Nutrition · Cal AI parity (2026-09-26, app 1.0.0.12.0)

`/nutrition/diary` logs food eight ways from one `+` menu: photo, gallery, barcode (`expo-camera` viewfinder → Open Food Facts via our server, code only), label scan, describe/dictate (text mode, no photo), search (saved → Georgian catalog `server/src/data/nutrition-catalog.json` → Open Food Facts / optional USDA), saved/recent, manual. `POST /api/nutrition/estimate` takes `mode=photo|label|text|fix`; only text and fix may omit the photo. Health score is a deterministic heuristic (`healthScore`), never AI. Budget = target + burned (if `addBurned`) + rollover ≤200 (if `rollover`), from `NutritionPreference`. Streak, week summary, projection, water/steps, measurements and activities ride on the dashboard. Meal reminders use the `nutrition:` prefix. Medi action `nutrition_log` → `/api/nutrition/quick-log`. Keep estimates unsaved until the person confirms; never claim accuracy. 2026-09-27 (app 1.0.0.13.0): macro split (re-divides plan calories only), meal/day copy, personal recipes (`NutritionFood.source='recipe'`), opt-in Apple Health / Health Connect write-back and an intermittent-fasting timer — daily 10–20 h windows only; never offer it under 18, in pregnancy/breastfeeding or with an eating-disorder history; glucose-lowering medication needs the person's doctor confirmation; no ketosis/autophagy claims. Quest still excludes calories; widgets/HealthKit write-back are a separate native train. See docs/NUTRITION.md.

## Referral · Medi coins (2026-09-27, app 1.0.0.13.18)

Tables `ReferralCode` / `Referral` (additive, `server/scripts/install-referral.mjs` in the release chain). A new account (≤14 days) enters a friend's 6-character code once (`/profile/invite-code`, deep link `medicard://invite/CODE`, web `https://medicard.ge/i/CODE`). 100 coins go to each side through `RewardLedger` (`sourceType REFERRAL`, `invitee:`/`inviter:` source ids) only after the invitee's first health action (medicine, check-in, visit, record, meal or cycle log) and with a verified phone; the inviter needs a verified phone to see their code and is paid at most 5 times per Tbilisi month; one device per referral (hashed install id, required to claim); pending referrals expire after 30 days. No monetary value — never add cash-out. Quest shows a link card only; it is not a Quest template (journey math unchanged). Admin: Rewards → მოწვევები (masked users). The reward pass only selects referrals that are ready (phone + health action) so inactive ones cannot block newer ones. A code from an invite link opened before sign-up is offered once from Home while the account is ≤14 days old. Mobile `npm run test:all` runs every mobile suite (incl. `test:units`).

## Launch readiness pass (2026-09-28, app 1.0.0.14.1)

Admin push campaigns are queued (`POST /api/admin/push/campaigns` → 202, status QUEUED) and sent by `server/src/lib/pushCampaigns.js` under the `push-campaigns` JobLease: waves of 4×100 Expo tokens, retry with backoff on 429/5xx, progress + resume cursor in `PushCampaign.data.progress`, stale queues expire after 24 h. Segments are ALL / ACTIVE_7D / ACTIVE_30D / PLATFORM_IOS / PLATFORM_ANDROID / GOAL_* (primaryGoal); retired package segments map to ALL. Never send a campaign inside the HTTP request again. Product funnel: `FunnelEvent` (additive `prisma/20260928-funnel.sql`, `install-funnel.mjs` in the release chain), `POST /api/funnel/events` (optional auth, own rate limit, allow-listed names/enums only — never health values or free text), mobile `src/lib/funnel.ts`, admin `#/funnel`. Google Play account deletion page: `/delete-account` (`server/public/delete-account.html`); keep it true to `deleteUserAccount`. Uploads are compressed on device (`src/lib/imageCompress.ts`: photos 1600 px, lab/imaging 2400 px, JPEG 0.8, PDFs untouched). Android uses Firebase `medicard-d6ea0` only as the FCM transport under Expo Push.

## Schema installs on deploy (2026-09-28)

The Render service was created by hand, so it ignores render.yaml's `preDeployCommand`: nothing ran the install scripts and the funnel, email and community tables were missing in production until they were installed manually on 2026-09-28. The dashboard Pre-Deploy Command must be `npm run db:install` — every `server/scripts/install-*.mjs` (additive, idempotent, no seed). Never put `npm run release` there: its `seed` step rewrites package rows and aborts in production when the configured admin does not exist. Every new install script must be added to `db:install` (`server/src/lib/installChain.test.js` fails otherwise).

## Support inbox (2026-09-28)

Mail to support@medicard.ge (Resend Inbound, MX eu-west-1) arrives as `email.received` on the existing Svix-verified `/api/email/webhook` and lands in `SupportThread` / `SupportMessage` / `SupportSnippet` (`prisma/20260928-support.sql`, `install-support.mjs` in `db:install`). Admin page `#/support` (read `SUPPORT_VIEW`, change `SUPPORT_MANAGE`): threads, sanitized HTML in a sandboxed iframe, attachment proxy (no disk), replies from `SUPPORT_FROM` with In-Reply-To/References through the normal mailer (kill switch, suppression, EmailLog), internal notes, snippets, owner notice to `SUPPORT_NOTIFY_EMAIL` (subject only, 1 per 10 min, loop-protected). Reading bodies/attachments needs `RESEND_INBOUND_API_KEY` (a Full-access key; Sending-access keys can only send) — without it the inbox is metadata-only and says so. Inbound content is untrusted: keep it sanitized and never render it as admin page HTML. Closed threads older than 2 years are purged daily.

## Server capacity alerts (2026-09-28)

Owner wants to scale Render before the server falls over. `server/src/lib/capacity.js` (production only; `CAPACITY_MONITOR=off` disables) samples each instance once a minute — CPU vs cgroup limit, memory vs limit, event-loop p95, GET `/api` p95 (AI answers/uploads are POST and excluded), 5xx %, DB ping — into `CapacitySample` (7 days) via `prisma/20260928-capacity.sql` / `install-capacity.mjs` in `db:install`. The `capacity-monitor` lease holder evaluates the fleet (`RULES`: a threshold must hold for 2–3 minutes in a row, so deploy/cron spikes do not alert) and sends Director Telegram notices through `notifyOwner` with the concrete Render step (instances N → M for ~60 % CPU, bigger plan for memory, "scaling will not help" for DB/5xx); escalation goes out at once, repeats after 30 min (critical) / 2 h (warn), "recovered" after 10 quiet minutes; history in `CapacityEvent`. Admin `#/capacity` (სერვერის დატვირთვა, `g z`) shows the series, live instances, alert history and a test-alert button. Samples hold numbers only — never users, paths or payloads. Server shutdown drains in-flight requests up to 27 s on SIGTERM (Render kills at 30 s).

## Module switches + Home news (2026-09-28, app 1.0.0.16.2)

Owner: every module must be pausable from admin without an app build. `server/src/lib/featureFlags.js` `FEATURES` (group module/ai/system, `parent` = child is effectively off while the parent is off) covers cycle, nutrition(+nutritionAi), medi, pets(+mediVet), medirun, quest(+rewardsStore), coach, community, pharmacy, news, referralRewards, email. Server: `requireFeature` on each router answers writes with 503 `FEATURE_DISABLED` + the admin's message — this is all a store build older than 1.0.0.16.2 gets (reads stay open so history is visible). App 1.0.0.16.2+: `/api/app/status` `features` + `featureMessages` → `mobile/src/lib/featureFlags.ts` store (cached, re-polled on foreground ≤1/min, a 503 FEATURE_DISABLED hides the module at once); Home sections/tiles, Explore and Profile blocks disappear and `ModuleGate` covers the module's routes (`featureRoutes.ts` maps route → key). A new module = add its key to FEATURES, mount `requireFeature`, map its route in `featureRoutes.ts` and hide its entries (test `featureRoutes.test.ts` checks keys exist on the server). Core health (meds, records, visits, profile) is intentionally not switchable; whole-app stop = Settings maintenance mode.

Home news („სიახლეები“): admin `#/news` (`v4/modules/news.js`, `/api/admin/announcements`, writes need `NEWS_MANAGE`, audited). Tables `Announcement` / `AnnouncementImage` (bytes in Postgres, public `/api/announcements/image/:id`) / `AnnouncementReceipt` (first view/tap/dismiss per person) — `prisma/20260928-announcements.sql`, `install-announcements.mjs` in `db:install`. Cards sit directly above nutrition (`homeSectionOrder` keeps `news` glued to `nutrition`), flat surface card, tone only tints badge/tile/button (no second spotlight), max 5, detail screen `/news/[id]` (also valid as a push `route`). Buttons open an allow-listed app route (`ROUTE_ROOTS`, identical on server and app — tested) or an https link. Audience = gender + platform only; never health data.

## Over-the-air updates (2026-09-28, app 1.0.0.17.0)

`expo-updates` (EAS Update) ships JS/copy/styles/images without App Review. `runtimeVersion` = store train `G.0.0.B` (derived in `mobile/app.config.js`), so the versioning rule maps directly: **revision bump (`.R`) → `npm --prefix mobile run ota -- "message"`**; **train bump (`.B`, any native module/plugin/permission/SDK change) → store build**. `mobile/scripts/ota.mjs` forces `EXPO_PUBLIC_API_URL=https://medicard.ge` (never the LAN URL in `.env.development.local`) and refuses to publish when the native fingerprint (`@expo/fingerprint`, version fields excluded) differs from the train's store build recorded in `mobile/ota-baselines.json` — run `npm --prefix mobile run ota:baseline` when starting each store build and commit the file. Channels: eas.json production → `production`, preview → `preview` (`--preview`). The app checks on cold start (never blocks the splash) and on foreground (hourly), downloads quietly and switches after ≥10 min away (`src/lib/otaUpdates.ts`). Builds before 1.0.0.17.0 have no expo-updates and never receive OTA. Never use OTA to change the app's purpose or add features that would need review (Guideline 2.5.2) — fixes, copy, design and admin-driven content only.
