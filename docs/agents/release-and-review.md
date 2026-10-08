# App Review, permissions, release, versions, OTA

Moved verbatim from AGENTS.md on 2026-10-08 (token diet). Read this file before working in its area; add new notes here, not in AGENTS.md.

## App Review correction (2026-09-22)

MEDICARD is entirely free for consumer accounts. No commercial user types, paid unlocks, upgrade CTAs or quotas may be enabled by environment/config flags. This supersedes older purchase-toggle guidance below. Keep historical billing rows only for data integrity and older API compatibility; preserve admin authorization roles. AI disclosure is a real native Modal with bounded scroll content and pinned choices. Named recipients/data categories and voluntary consent must be shown before any AI transmission, including voice transcription and speech output. Decline/close/revoke must block transmission without presenting the choice as a network error. The current consent version is derived from the full disclosure manifest; never pre-accept for real users. See docs/APP-REVIEW-2026-09-22.md for release evidence and remaining publication steps.

## Release readiness (2026-09-15)

Beta execution 2026-09-15: owner-tested EAS preview `1.0.0.8.41` is AdHoc IPA / internal APK — not TestFlight/Play. `eas submit --profile beta` did not upload. Store-distribution EAS production builds were not started (paid). Do not treat Expo Go as store proof. Do not silently disable Pets on production — scope claims instead. Do not remount a global `/api` request-count limiter. Auth writes are IP-limited; GET `/api/auth/me` is skipped. Seed must not rotate an existing admin `passwordHash` (Render runs seed on every deploy). Consumer purchases are permanently off (App Review correction 2026-09-22); the old `CONSUMER_PURCHASES_ENABLED` flag has no effect.

## Permission primers (App Review 5.1.1(iv), 2026-09-27)

Apple rejected build 1.11.9 (20) because the Health message before the permission sheet said „ნებართვის მიცემა“ (Allow) and had „ახლა არა“. Any screen shown before an OS permission sheet (notifications, Apple Health / Health Connect, location, camera, microphone, photos) has **one** button, „გაგრძელება“ / Continue, and it always opens the system sheet. No Not now / Later / Skip / close / tap-outside before the request; after the sheet was answered a Close or Open Settings is fine. Copy lives in `mobile/src/lib/permissionPrimer.ts` (English on non-Georgian devices); each primer shows once per device. Guarded by `mobile/src/lib/deviceAccess.test.js`. App Review phone sign-in uses `APP_REVIEW_PHONE` + `APP_REVIEW_OTP` (Render env only). See docs/APP-REVIEW-2026-09-27.md.

## MEDI COACH review rules (2026-09-28, app 1.0.0.16.0)

Before the first store build with MEDI COACH: nothing is shared with a trainer by default (`DEFAULT_SCOPES` all false, `CONSENT_VERSION` bumped on any consent-copy change); the consent sheet names what a trainer always sees (name, photo, age, sex, height, session schedule) and every scope (workouts include sleep). Clients and trainers can report each other and a client can block a trainer (`server/src/lib/coachSafety.js`, `/trainer/report`, admin ტრენერები → შეტყობინებები, Director Telegram notice); a client who ended/declined or blocked is never re-invited by that trainer. Privacy §14 / Terms §22 describe it — edit `scripts/privacy-source.md` / `scripts/terms-source.md`, then `node scripts/build-legal-pages.mjs && node scripts/sync-privacy-ka.mjs`; never hand-edit `privacy.html` (the build overwrites it). The QR scanner is a one-button „გაგრძელება“ primer until the camera question is answered.

## OS permissions (iOS 26)

Never call `requestPermissionsAsync` / HealthKit `requestAuthorization` / location request from `useEffect`, `InteractionManager`, or post-login background work. iOS 26 does not show the sheet (and can mark denied with no UI). Show `PermissionGateHost` after login and request only from the enable button. Setup **ნებართვის მიცემა** must call `requestNotificationPermission` on press. Background reminder code may only read `getNotificationPermissionGranted`. HealthKit step reads must not re-request authorization. `Linking.openSettings` has no Notifications row until the app has requested once.

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

On every **store-facing** mobile change, update `mobile/app.json` `expo.version`. The public identity is Instagram-style **five-part** `G.0.0.B.R` (current value: `mobile/app.json` — never copy it into docs). That string is Android `versionName`, in-app display, and `/api/app/status`. Bump **only** `expo.version` in `mobile/app.json`: `mobile/app.config.js` derives `extra.medicardInternalVersion` (Profile display + `/api/app/status`) and Apple's three-part `ios.version` `G.B.R` from it — never hand-edit those copies (a stale `extra` copy once froze Profile at `1.0.0.11.23`). Plugin `withIosMarketingVersion` stays as last-write guard. Never put `1.7.72` in `minAppVersion` — that would block five-part clients. Native `android.versionCode` in `app.json` is a local floor only. EAS production uses `appVersionSource: remote` + `autoIncrement` (remote was **2** on 2026-09-11) — never lower the remote counter. iOS since 1.0.0.19: the MEDIRUN Live Activity extension takes `ios.buildNumber` from `app.json` at prebuild and Apple refuses an extension whose build number differs from the app's, so start iOS store builds with `npm --prefix mobile run build:ios` (sets `ios.buildNumber` to the remote counter + 1, then `eas build -p ios --profile production --auto-submit`) and commit the app.json change. Cycle phase numbers stay in contracts / QA only.

- **Small** feature/fix → revision + 1 (`1.0.0.7.78` → `1.0.0.7.79`)
- **Native / store train** → train + 1 and bump `buildNumber` / `versionCode` (`1.0.0.7.77` → `1.0.0.8.0`)
- **Rare product generation** → first number + 1 (`1.0.0.7.71` → `2.0.0.0.0`)

See `MEMORY.md` for details. Cycle phase numbers stay in contracts / QA only.

## Product freeze (2026-09-26)

Owner decision after the 2026-09-26 strategic audit: fewer features, one clear promise. These freezes override older notes that invite expansion.

- **Pets / Medi Vet:** no new features. Bug fixes only. Isolation rules above still apply.
- **MEDIRUN:** no new zones or prizes; at most one event per month. The Glow map (below) is an owner-approved visual change, not a new zone. The user-visible name is **MEDIRUN** everywhere — except the bottom tab bar's center button, which reads **RUN** (owner decision 2026-09-30, final — do not reopen) — never RUN elsewhere, MEDI RUN, Medi Run, MEDIPULSI or „სირბილი" as the product name (the verb/activity „სირბილი" in a sentence is fine). Internal identifiers (`medipulsi*` routes, tables, capabilities) stay as they are.
- **Cycle:** no new phases until iOS QA is complete.
- **Women's space (community):** no open launch until there are 300+ active women and named human moderators assigned to the queue. Access sits behind the admin launch flag (`CommunityConfig.open`, admin ქალების სივრცე → launch card, audited, `COMMUNITY_MANAGE`). Missing row/table = closed. While closed, existing `CommunityMember`s keep full access, new members cannot join (`POST /api/community/membership` 403), and Home/Explore hide the entry for non-members (`useCommunityEntry`). Do not remove or bypass it.

## Minimum age 18+ (2026-09-27, app 1.0.0.13.15)

Owner asked for the legal minimum. Health data is a special category under Law 3144 and a minor's special-category data needs parental consent, which we cannot verify, so accounts are **18+**: `MIN_USER_AGE` in `server/src/lib/patient.js` (`birthDateSchema` refuses younger dates at account creation; edit routes use `birthDateInputSchema` + `birthDateAgeError`, which refuses only a new or changed under-18 date, because profile saves re-send the stored date) and `mobile/src/lib/birthdate.ts` (pickers and the onboarding birth-date step). Accounts created before the rule are not blocked or deleted automatically; admin users → „18 წლამდე“ lists them for the owner to review. Lower the limit only after legal review and with a parental-consent flow.

## Launch readiness pass (2026-09-28, app 1.0.0.14.1)

Admin push campaigns are queued (`POST /api/admin/push/campaigns` → 202, status QUEUED) and sent by `server/src/lib/pushCampaigns.js` under the `push-campaigns` JobLease: waves of 4×100 Expo tokens, retry with backoff on 429/5xx, progress + resume cursor in `PushCampaign.data.progress`, stale queues expire after 24 h. Segments are ALL / ACTIVE_7D / ACTIVE_30D / PLATFORM_IOS / PLATFORM_ANDROID / GOAL_* (primaryGoal); retired package segments map to ALL. Never send a campaign inside the HTTP request again. Product funnel: `FunnelEvent` (additive `prisma/20260928-funnel.sql`, `install-funnel.mjs` in the release chain), `POST /api/funnel/events` (optional auth, own rate limit, allow-listed names/enums only — never health values or free text), mobile `src/lib/funnel.ts`, admin `#/funnel`. Google Play account deletion page: `/delete-account` (`server/public/delete-account.html`); keep it true to `deleteUserAccount`. Uploads are compressed on device (`src/lib/imageCompress.ts`: photos 1600 px, lab/imaging 2400 px, JPEG 0.8, PDFs untouched). Android uses Firebase `medicard-d6ea0` only as the FCM transport under Expo Push.

## Over-the-air updates (2026-09-28, app 1.0.0.17.0)

`expo-updates` (EAS Update) ships JS/copy/styles/images without App Review. `runtimeVersion` = store train `G.0.0.B` (derived in `mobile/app.config.js`), so the versioning rule maps directly: **revision bump (`.R`) → `npm --prefix mobile run ota -- "message"`**; **train bump (`.B`, any native module/plugin/permission/SDK change) → store build**. `mobile/scripts/ota.mjs` forces `EXPO_PUBLIC_API_URL=https://medicard.ge` (never the LAN URL in `.env.development.local`) and refuses to publish when the native fingerprint (`@expo/fingerprint`, version fields excluded) differs from the train's store build recorded in `mobile/ota-baselines.json` — run `npm --prefix mobile run ota:baseline` when starting each store build and commit the file. Channels: eas.json production → `production`, preview → `preview` (`--preview`). The app checks on cold start (never blocks the splash) and on foreground (hourly), downloads quietly and switches after ≥10 min away (`src/lib/otaUpdates.ts`). Builds before 1.0.0.17.0 have no expo-updates and never receive OTA. Never use OTA to change the app's purpose or add features that would need review (Guideline 2.5.2) — fixes, copy, design and admin-driven content only.
