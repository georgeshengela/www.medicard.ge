# Phase 9.2 — Medi Companion live device QA

## Device

- Emulator: Pixel 8 (`emulator-5554`)
- Resolution: 1080×2400 (density reset between small-width runs)
- App: Expo Go → `exp://127.0.0.1:8081`
- Mobile version under test: **36.2.0**
- Locale: Georgian (`ka`) primary; titles also audited in en/fr/ru via catalog
- Account: authenticated QA user (Giorgi / phone flow)

## Themes & fixtures

- Light + system dark (`adb shell cmd uimode night yes`)
- DEV Companion fixtures (`__DEV__` only): `NEW_USER`, `MID_JOURNEY`, `NEAR_MILESTONE`, `LARGE_COLLECTION`, `JOURNEY_COMPLETE`, `MULTI_UNLOCK*`, `COMEBACK`, `OFFLINE`, `ERROR`, `RAIN`, etc.
- Deep link helper (DEV): `/medi-companion?fixture=SCENARIO`

## Required artifacts

| File | Scenario / what was verified |
| --- | --- |
| `01-home-light-default.png` | New-user / default Companion, SVG stable |
| `02-home-light-equipped.png` | Four-slot equipped scene (LARGE_COLLECTION) |
| `03-home-dark.png` | Dark Medi Home default |
| `03b-home-dark-equipped.png` | Dark + four cosmetics (gold figure, plant, dusk bg) |
| `03c-journey-dark.png` | Dark Journey |
| `03d-multi-unlock-dark.png` | Dark multi-unlock toast |
| `03e-journey-complete-dark.png` | Dark Journey complete |
| `03f-collection-dark.png` | Dark Collection |
| `03g-error-dark.png` | Dark Companion error |
| `04-journey-start.png` | Journey start comprehension |
| `05-journey-mid.png` | Mid journey |
| `06-journey-major.png` | Near / major milestone hierarchy |
| `07-journey-complete.png` | ≥302 completion copy (no broken denominator) |
| `08-collection-locked.png` | Locked collection rows |
| `09-collection-equipped.png` | Equipped accent + unique ka titles |
| `10-multi-unlock.png` | Unlock ×2–3 aggregate toast |
| `10a-multi-unlock-1.png` | Single unlock celebration |
| `10b-multi-unlock-4.png` | 4+ “journey caught up” toast |
| `11-small-screen.png` | ~320dp width attempt (see unresolved) |
| `11b-journey-small.png` / `11c-collection-small.png` | Journey / Collection on narrow density |
| `12-large-font-130.png` | Companion @ font_scale 1.3 |
| `12b-journey-font-130.png` / `12c-collection-font-130.png` | Journey / Collection @ 1.3 |
| `13-large-font-160.png` | Home @ 1.6 — **Expo Go reload often blocked** |
| `13b-collection-font-160.png` / `13c-journey-font-160.png` | Collection / Journey @ 1.6 (usable) |
| `14-reduced-motion.png` | animator scales 0 + COMEBACK (Welcome Back) |
| `15-offline.png` | Offline / cached Companion |
| `16-error.png` | Intentional Companion error + retry |
| `17-talk-to-medi.png` | `/chat/doctor` from Companion CTA |

## Bugs fixed in this phase

1. **Worklet crash** — `moodTilt()` called inside `useAnimatedStyle` → remote function sync error. Pose/mood offsets now computed on JS thread.
2. **SVG Path/G rotation** — already avoided; pose via `Animated.View` only.
3. **Georgian action tile truncation** — removed chevron; allow 3 lines on Companion hub tiles.
4. **DEV fixtures** — added `MULTI_UNLOCK_1`, `MULTI_UNLOCK_4`, `JOURNEY_COMPLETE`; fixture deep-link; present unlock toast on fixture select.
5. Unique Journey cosmetic titles (ka/en/fr/ru) via `cosmeticNames.ts`.

## Unresolved / not FINAL-FREEZE blockers to clear

- Expo Go **reloads** when `font_scale` / `wm size` change; Companion Home @ **160%** and narrow Companion Home shots are incomplete or landed on main Home.
- Live **HTTP equip PUT** persistence + **QuestCompletion socket/HTTP dedupe** proven in unit/server tests; not fully re-run as a production Quest event on device in this pass.
- Historical reconcile celebration on a real aged account: fixture + server tests only this session.

## FINAL-FREEZE

**No** — crash regression and most visual matrix items passed; remaining font/small-width Expo Go friction + incomplete live economy-path E2E keep v1 out of freeze.
