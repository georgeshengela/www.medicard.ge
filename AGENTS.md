# Medicard.GE agent notes

## App Review correction (2026-09-22)

MEDICARD is entirely free for consumer accounts. No commercial user types, paid unlocks, upgrade CTAs or quotas may be enabled by environment/config flags. This supersedes older purchase-toggle guidance below. Keep historical billing rows only for data integrity and older API compatibility; preserve admin authorization roles. AI disclosure is a real native Modal with bounded scroll content and pinned choices. Named recipients/data categories and voluntary consent must be shown before any AI transmission, including voice transcription and speech output. Decline/close/revoke must block transmission without presenting the choice as a network error. The current consent version is derived from the full disclosure manifest; never pre-accept for real users. See docs/APP-REVIEW-2026-09-22.md for release evidence and remaining publication steps.

## MEDI QUEST unified hub (2026-09-19)

Owner explicitly replaced the Profile robot and separate Companion pages with one native `/medi-quest` hub (missions/progress/rewards). Profile uses `QuestProfileCard`; Companion routes (`/medi-companion`, `/journey`, `/collection`) are 5-line compatibility redirects kept for old push `route`s; the Companion UI components were deleted 2026-09-27. `/api/medi-companion` and its tables stay: `useQuestJourney` reads journey/overview and writes equipment through it (see docs/DB-DROP-CANDIDATES.md). Keep the geometric progress seal, existing ownership/equipment and journey math (completed daily=1/weekly=3), separate from claimed XP/coins. Do not restore the robot entry or old separate home based on older notes. Quest/Companion cache reads and late responses must stay scoped to the captured account. Global bottom navigation stays hidden on Quest routes. Native version1.0.0.9.6 / iOS1.9.6; no DB schema change.

## Release readiness (2026-09-15)

Beta execution 2026-09-15: owner-tested EAS preview `1.0.0.8.41` is AdHoc IPA / internal APK — not TestFlight/Play. `eas submit --profile beta` did not upload. Store-distribution EAS production builds were not started (paid). Do not treat Expo Go as store proof. Do not silently disable Pets on production — scope claims instead. Do not remount a global `/api` request-count limiter. Auth writes are IP-limited; GET `/api/auth/me` is skipped. Seed must not rotate an existing admin `passwordHash` (Render runs seed on every deploy). Consumer purchases are permanently off (App Review correction 2026-09-22); the old `CONSUMER_PURCHASES_ENABLED` flag has no effect.

## OS permissions (iOS 26)

Never call `requestPermissionsAsync` / HealthKit `requestAuthorization` / location request from `useEffect`, `InteractionManager`, or post-login background work. iOS 26 does not show the sheet (and can mark denied with no UI). Show `PermissionGateHost` after login and request only from the enable button. Setup **ნებართვის მიცემა** must call `requestNotificationPermission` on press. Background reminder code may only read `getNotificationPermissionGranted`. HealthKit step reads must not re-request authorization. `Linking.openSettings` has no Notifications row until the app has requested once.

## Product naming

The in-app AI is **Medi**. Never write Nightingale in user-facing copy (chat titles, CTAs, bubbles, share toggles). Nightingale is only the Figma UI kit name.

## Pets / Medi Vet

Hub copy is **ჩემი ცხოველები**. The pet assistant is **Medi Vet**. Profile **ყველას ნახვა** opens `/pets` manage hub (swipe right edit / swipe left archive, product/care/Medi Vet/weight tiles for the featured pet). Phase 5 local care reminders are implemented on the Notification Brain (`pets:`). Phase 6 Medi Vet is isolated OpenRouter chat (`/api/pets/:petId/chat/query`, never EvidenceMD / `withPatientAiContext`). Phase 7 local SQL/HTTP verification ran against disposable Postgres `127.0.0.1:55432` / `medicard_pets_phase7`. Phase 7.1: bird/unsupported-species is a bounded COMPLETE (not 502); COMPLETE+quota are one transaction; Pixel_8 development APK talked to isolated `:4010`; **OS notification banners were not observed**. **Hosted Neon Pets SQL is applied** (phase2 → phase7, additive `db execute` only — never `db push`). Owner-reported 2026-09-15: dog create, weight, allergies, Medi Vet chat on production. Do not re-apply SQL. Do not hang pets on `HealthProfile`, `ChatSession`, `MedicationSchedule`, `DoctorVisit`, or Home. Do not add a fifth bottom tab.

## Expo Router app directory

Routes live in `mobile/app/`. **Never create `mobile/src/app`** (even empty). Expo Router prefers `src/app` if that folder exists and shows the stock “Welcome to Expo” screen instead of Medicard.

## Admin V4 (Stripe-style layer, 2026-09-27)

`server/admin/v4/stripe.css` loads last and owns the look: it re-tokens light/dark (`--s-*`, mapped onto the legacy `--v3-*`/`--teal` families) and restyles the shared primitives. `v4/components.css` holds the `s-*` components (s-card, s-metrics, s-badge, s-switch, s-table, s-segment, s-feed-item, s-field) — build new or rebuilt modules from those, not inline styles, and never add another `admin-vNN.css` layer. `v4/experience.js` adds the ⌘K/Ctrl+K palette (pages, sub-pages, actions, live user search, recents), `g`+letter navigation on physical keys (works on the Georgian layout), `?` cheat sheet, ⇧A activity + system health sheet, account menu, breadcrumbs, exit animations for dialogs/drawers/toasts and table density. Use `AdminV3.openDialog` for forms/decisions — never `alert()` or native `<dialog>`. Local preview: `node scripts/admin-dev-proxy.mjs` → http://localhost:4380/admin/ (local files, main API); the owner signs in themselves.

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

Spread `APP_MODAL_PROPS` on every overlay Modal. Opaque full-screen takeovers (e.g. cycle onboarding) may stay `transparent={false}`. Dim color: `APP_MODAL_OVERLAY`. Keep the scrim as a **sibling** of the sheet, not a parent wrapping it.

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

On every **store-facing** mobile change, update `mobile/app.json` `expo.version`. The public identity is Instagram-style **five-part** `G.0.0.B.R` (currently `1.0.0.8.56`). That string is Android `versionName`, in-app display, and `/api/app/status`. Bump **only** `expo.version` in `mobile/app.json`: `mobile/app.config.js` derives `extra.medicardInternalVersion` (Profile display + `/api/app/status`) and Apple's three-part `ios.version` `G.B.R` from it — never hand-edit those copies (a stale `extra` copy once froze Profile at `1.0.0.11.23`). Plugin `withIosMarketingVersion` stays as last-write guard. Never put `1.7.72` in `minAppVersion` — that would block five-part clients. Native `ios.buildNumber` / `android.versionCode` in `app.json` are a local floor only. EAS production uses `appVersionSource: remote` + `autoIncrement` (remote was **2** on 2026-09-11) — never lower the remote counter. Cycle phase numbers stay in contracts / QA only.

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

## Minimum age 18+ (2026-09-27, app 1.0.0.13.15)

Owner asked for the legal minimum. Health data is a special category under Law 3144 and a minor's special-category data needs parental consent, which we cannot verify, so accounts are **18+**: `MIN_USER_AGE` in `server/src/lib/patient.js` (`birthDateSchema` refuses younger dates at account creation; edit routes use `birthDateInputSchema` + `birthDateAgeError`, which refuses only a new or changed under-18 date, because profile saves re-send the stored date) and `mobile/src/lib/birthdate.ts` (pickers and the onboarding birth-date step). Accounts created before the rule are not blocked or deleted automatically; admin users → „18 წლამდე“ lists them for the owner to review. Lower the limit only after legal review and with a parental-consent flow.

## Phone verification gate (2026-09-27, app 1.0.0.13.14)

Owner-approved: a verified phone is required only where abuse or real value is at stake. Server middleware `requireVerifiedPhone` (`server/src/lib/phoneGate.js`) answers 403 `PHONE_VERIFICATION_REQUIRED` on women's-space join / post / comment and `POST /api/rewards/:id/redeem` (partner vouchers included); apply it to referral rewards and family members when those ship. `User.phone` is only written after an OTP check (or by an admin); email `/register` ignores any `phone` field (2026-09-27 review fix), so a stored Georgian mobile counts as verified. The app catches the code (`mobile/src/lib/phoneGate.ts`) and offers `/profile/verify-phone` (number → SMS code, keyboard-safe shell) instead of an error. Never gate everyday health features (Medi, meds, nutrition, lab, cycle, pets).

## One Medi (2026-09-27, app 1.0.0.13.8)

`/assistant` is the only Medi screen, with a mode switch: **Medi** (planner: actions, handoffs), **ექიმთან** (`?mode=doctor`, DOCTOR via `/api/ai/query`) and **ღრმა ანალიზი** (`?mode=deep`, the former consilium). The clinical chat lives in `MediConsultation`; `/chat/[mode]` is a redirect that accepts every spelling (doctor/DOCTOR/consilium/CONSILIUM) and keeps `sessionId`/`prefill`. A `consult` handoff switches the mode in place (staged launch still keyed by the legacy `/chat/…` route). Medi-mode conversations are saved as `ChatSession` with `mode: 'ASSISTANT'` through `POST /api/chats/assistant` and reopen from ჩემი ბარათი; ASSISTANT sessions are excluded from the consultation AI context, from `/api/ai/query` session lookup and from Brain consultation nudges. Symptoms, lab, skin and imaging stay separate tools opened by handoff. Medi Vet stays `/pets/:id/chat` with its own endpoint and storage. Tests: `npm --prefix mobile run test:medi`, `server/src/lib/assistantChats.test.js`.

## 7-step onboarding (2026-09-27, app 1.0.0.13.6)

New accounts answer 5 questions in `/(auth)/assessment` (`ONBOARDING_STEPS`): sex → primary goal (medications / nutrition-weight / cycle for women / general) → birth date → height+weight on one screen → one goal step (first medication / target weight / last period start). Then step 6 = the required privacy acceptance (legal record, text unchanged) followed by the voluntary AI consent, and step 7 = notifications (requested only from its button). `extraAnswers.primaryGoal` moves that Home section right after "ask Medi"; `onboardingVersion: 2` + `onboardingStepKey` drive resume. The goal step saves where the feature already reads it: `saveWeightGoal` (reminders off until notifications are granted) and `api.cycle.setLastPeriod`. Avatar, phone verification, Face ID and location are no longer onboarding steps; their screens stay routable for features that need them. The full question list lives at `/profile/complete` ("დაასრულე პროფილი", Home card from `profileCompletion`). Existing users (`completedAt` set) never see the new flow. Test: `npm --prefix mobile run test:onboarding`.

## Retired district competition (2026-09-19)

The owner removed the district walking competition completely. Do not recreate its screens, sync, admin module, or database tables. MEDIRUN / MEDIPULSI remains the worldwide exploration game, accessible from Home; its duplicate Profile block is removed. Shared health totals and Pets remain independent.


## Unified Medi conversation (2026-09-21, app 1.0.0.11.4)

Owner explicitly removed human/pet tabs from the global action assistant. Do not restore them. `/assistant` sends `scope:auto`; server resolves owned pet names (including Georgian suffixes) or asks for identity clarification. This UX does NOT merge human/pet storage or authorization. Dedicated Medi Vet clinical chat remains separate. Voice questions stay on the conversation canvas; manual forms and capability discovery are opt-in. Keep signed reviews and idempotent execution, never fabricate external clinic bookings or medication doses. See docs/MEDI-ASSISTANT.md latest entry.

## Main database only (owner requirement, 2026-09-24)

Always use the main MEDICARD database and https://medicard.ge API for the owner's app, Expo previews, and testing. Never switch to another database or an isolated QA backend unless the owner explicitly changes this rule. The app is prelaunch and the owner tests using existing main-database accounts. Do not copy or reset their data. Keep test writes narrowly scoped and avoid destructive changes.

## Keyboard comfort (owner requirement, 2026-09-24)

Every form must keep the focused input and primary action above the keyboard, with compact spacing and smooth opening/closing. Follow the existing sign-in pattern: a bounded scrolling form and a pinned, animated footer, with safe-area padding only when the keyboard is closed. Never combine two keyboard-inset mechanisms. Check small screens, iOS and Android, focus changes, dismissal and submission; browser-only checks are not proof of native keyboard behavior. This is a completion requirement for new and edited forms, including community nickname onboarding.

## Publish completed changes (owner requirement, 2026-09-24)

After completing and verifying requested app/backend changes, commit and push the relevant finished changes to the existing Git remote so the owner can test. Check deployment when backend behavior changes. Preserve unrelated in-progress edits and never commit secrets. Report the deployed/verified state accurately.

## Nutrition · Cal AI parity (2026-09-26, app 1.0.0.12.0)

`/nutrition/diary` logs food eight ways from one `+` menu: photo, gallery, barcode (`expo-camera` viewfinder → Open Food Facts via our server, code only), label scan, describe/dictate (text mode, no photo), search (saved → Georgian catalog `server/src/data/nutrition-catalog.json` → Open Food Facts / optional USDA), saved/recent, manual. `POST /api/nutrition/estimate` takes `mode=photo|label|text|fix`; only text and fix may omit the photo. Health score is a deterministic heuristic (`healthScore`), never AI. Budget = target + burned (if `addBurned`) + rollover ≤200 (if `rollover`), from `NutritionPreference`. Streak, week summary, projection, water/steps, measurements and activities ride on the dashboard. Meal reminders use the `nutrition:` prefix. Medi action `nutrition_log` → `/api/nutrition/quick-log`. Keep estimates unsaved until the person confirms; never claim accuracy. 2026-09-27 (app 1.0.0.13.0): macro split (re-divides plan calories only), meal/day copy, personal recipes (`NutritionFood.source='recipe'`), opt-in Apple Health / Health Connect write-back and an intermittent-fasting timer — daily 10–20 h windows only; never offer it under 18, in pregnancy/breastfeeding or with an eating-disorder history; glucose-lowering medication needs the person's doctor confirmation; no ketosis/autophagy claims. Quest still excludes calories; widgets/HealthKit write-back are a separate native train. See docs/NUTRITION.md.

## Referral · Medi coins (2026-09-27, app 1.0.0.13.18)

Tables `ReferralCode` / `Referral` (additive, `server/scripts/install-referral.mjs` in the release chain). A new account (≤14 days) enters a friend's 6-character code once (`/profile/invite-code`, deep link `medicard://invite/CODE`, web `https://medicard.ge/i/CODE`). 100 coins go to each side through `RewardLedger` (`sourceType REFERRAL`, `invitee:`/`inviter:` source ids) only after the invitee's first health action (medicine, check-in, visit, record, meal or cycle log) and with a verified phone; the inviter needs a verified phone to see their code and is paid at most 5 times per Tbilisi month; one device per referral (hashed install id, required to claim); pending referrals expire after 30 days. No monetary value — never add cash-out. Quest shows a link card only; it is not a Quest template (journey math unchanged). Admin: Rewards → მოწვევები (masked users). The reward pass only selects referrals that are ready (phone + health action) so inactive ones cannot block newer ones. A code from an invite link opened before sign-up is offered once from Home while the account is ≤14 days old. Mobile `npm run test:all` runs every mobile suite (incl. `test:units`).
