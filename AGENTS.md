# Medicard.GE agent notes

## MEDI QUEST unified hub (2026-09-19)

Owner explicitly replaced the Profile robot and separate Companion pages with one native `/medi-quest` hub (missions/progress/rewards). Profile uses `QuestProfileCard`; Companion routes are compatibility redirects. Keep the geometric progress seal, existing ownership/equipment and journey math (completed daily=1/weekly=3), separate from claimed XP/coins. Do not restore the robot entry or old separate home based on older notes. Quest/Companion cache reads and late responses must stay scoped to the captured account. Global bottom navigation stays hidden on Quest routes. Native version1.0.0.9.6 / iOS1.9.6; no DB schema change.

## Release readiness (2026-09-15)

Beta execution 2026-09-15: owner-tested EAS preview `1.0.0.8.41` is AdHoc IPA / internal APK — not TestFlight/Play. `eas submit --profile beta` did not upload. Store-distribution EAS production builds were not started (paid). Do not treat Expo Go as store proof. Do not silently disable Pets on production — scope claims instead. Do not remount a global `/api` request-count limiter. Auth writes are IP-limited; GET `/api/auth/me` is skipped. Seed must not rotate an existing admin `passwordHash` (Render runs seed on every deploy). Consumer purchase CTAs stay off unless `CONSUMER_PURCHASES_ENABLED=true`.

## OS permissions (iOS 26)

Never call `requestPermissionsAsync` / HealthKit `requestAuthorization` / location request from `useEffect`, `InteractionManager`, or post-login background work. iOS 26 does not show the sheet (and can mark denied with no UI). Show `PermissionGateHost` after login and request only from the enable button. Setup **ნებართვის მიცემა** must call `requestNotificationPermission` on press. Background reminder code may only read `getNotificationPermissionGranted`. HealthKit step reads must not re-request authorization. `Linking.openSettings` has no Notifications row until the app has requested once.

## Product naming

The in-app AI is **Medi**. Never write Nightingale in user-facing copy (chat titles, CTAs, bubbles, share toggles). Nightingale is only the Figma UI kit name.

## Pets / Medi Vet

Hub copy is **ჩემი ცხოველები**. The pet assistant is **Medi Vet**. Profile **ყველას ნახვა** opens `/pets` manage hub (swipe right edit / swipe left archive, product/care/Medi Vet/weight tiles for the featured pet). Phase 5 local care reminders are implemented on the Notification Brain (`pets:`). Phase 6 Medi Vet is isolated OpenRouter chat (`/api/pets/:petId/chat/query`, never EvidenceMD / `withPatientAiContext`). Phase 7 local SQL/HTTP verification ran against disposable Postgres `127.0.0.1:55432` / `medicard_pets_phase7`. Phase 7.1: bird/unsupported-species is a bounded COMPLETE (not 502); COMPLETE+quota are one transaction; Pixel_8 development APK talked to isolated `:4010`; **OS notification banners were not observed**. **Hosted Neon Pets SQL is applied** (phase2 → phase7, additive `db execute` only — never `db push`). Owner-reported 2026-09-15: dog create, weight, allergies, Medi Vet chat on production. Do not re-apply SQL. Do not hang pets on `HealthProfile`, `ChatSession`, `MedicationSchedule`, `DoctorVisit`, or Home. Do not add a fifth bottom tab.

## Expo Router app directory

Routes live in `mobile/app/`. **Never create `mobile/src/app`** (even empty). Expo Router prefers `src/app` if that folder exists and shows the stock “Welcome to Expo” screen instead of Medicard.

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

NativeWind v4 **silently drops function-form style callbacks on `Pressable`** — `style={({ pressed }) => ({...})}` is never invoked, so the button renders with NO styles (invisible white text, unstyled layout). Always use a static object/array: `style={{ ... }}`. For pressed feedback use NativeWind `active:` classes or skip it. New screens' routes also need `<Stack.Screen name="..." options={{ headerShown: false }} />` in `app/_layout.tsx`, or an ugly system header appears on top. ~30 older files (cycle, home sheets) still use the broken callback pattern — sweep pending.

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

On every **store-facing** mobile change, update `mobile/app.json` `expo.version`. The public identity is Instagram-style **five-part** `G.0.0.B.R` (currently `1.0.0.8.56`). That string is Android `versionName`, in-app display, and `/api/app/status`. Apple rejects five-part marketing versions — set `expo.ios.version` to `G.B.R` (`1.8.56`) and keep plugin `withIosMarketingVersion` as last-write guard. Never put `1.7.72` in `minAppVersion` — that would block five-part clients. Native `ios.buildNumber` / `android.versionCode` in `app.json` are a local floor only. EAS production uses `appVersionSource: remote` + `autoIncrement` (remote was **2** on 2026-09-11) — never lower the remote counter. Cycle phase numbers stay in contracts / QA only.

- **Small** feature/fix → revision + 1 (`1.0.0.7.78` → `1.0.0.7.79`)
- **Native / store train** → train + 1 and bump `buildNumber` / `versionCode` (`1.0.0.7.77` → `1.0.0.8.0`)
- **Rare product generation** → first number + 1 (`1.0.0.7.71` → `2.0.0.0.0`)

See `MEMORY.md` for details. Cycle phase numbers stay in contracts / QA only.

## Retired district competition (2026-09-19)

The owner removed the district walking competition completely. Do not recreate its screens, sync, admin module, or database tables. MEDIRUN / MEDIPULSI remains the worldwide exploration game, accessible from Home; its duplicate Profile block is removed. Shared health totals and Pets remain independent.
