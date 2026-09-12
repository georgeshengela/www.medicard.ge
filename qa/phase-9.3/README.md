# Phase 9.3 — Native QA closure & Medi Companion FINAL-FREEZE

## Environment

| Field | Value |
| --- | --- |
| Device | Android Emulator `Pixel_8` (`emulator-5554`) |
| Android | 15 (API 35) / `sdk_gphone64_x86_64` |
| Build | Native debug APK `ge.medicard.app` via `npx expo run:android` (Metro bundler) |
| App version | **36.2.0** (`versionCode` 1) |
| API | Local `http://127.0.0.1:4000` during QA (emulator via `10.0.2.2:4000`); `.env` restored to `https://medicard.ge` after |
| QA account | `+995500000005` (OTP master `0000`) |
| Deep-link note | Native intents need **`medicard:///medi-companion`** (triple slash). `medicard://medi-companion` shows Expo Router Unmatched Route. In-app `router.push('/medi-companion')` is fine. |

## Screenshot index

| File | Theme | Size / font | Fixture vs live | Proves |
| --- | --- | --- | --- | --- |
| `01-native-home-light.png` | light | default / 100% | live API | Companion Home hero, Talk CTA, 2×2 grid, 4-slot cosmetics |
| `02-native-home-dark.png` | dark | default | live | Dark Companion Home |
| `03-native-home-narrow.png` | light | ~360dp (`960x1800` @320dpi) | live | Narrow Home: no horizontal clip, CTA reachable |
| `03b-journey-narrow.png` | light | ~360dp | live | Narrow Journey |
| `03c-collection-narrow.png` | light | ~360dp | live | Narrow Collection |
| `04-native-home-font160.png` | light→dark mix | font 1.6 | live | 160% Home: wrap OK, Talk CTA visible |
| `05-native-home-dark-font160.png` | dark | font 1.6 | live | Dark + 160% combined |
| `06-native-home-four-slots.png` | light | default | live | All four cosmetic slots equipped composition |
| `07-native-journey.png` | light | default | live | Journey path / current / next-stop |
| `08-native-journey-font160.png` | dark | font 1.6 | live (may show stale cache banner) | 160% Journey readability |
| `09-native-collection.png` | light | default | live | Accent list, Equip / Equipped CTAs |
| `10-native-collection-font160.png` | — | font 1.6 | live | 160% Collection |
| `11-live-equip-before.png` | light | default | live | Equipped baseline |
| `12-live-equip-after.png` | light | default | live | After PUT equip |
| `13-live-equip-persist-relaunch.png` | light | default | live | Cosmetics still present after force-stop relaunch |
| `14-live-journey-unlock.png` | light | default | live | Post unlock Journey **23/30**, current **ახალი ჩრდილი** (MILESTONE_07) |
| `15-live-dedupe-single-toast.png` | light | default | live | Cold start after unlock: **no** Journey celebration toast |
| `16-reduced-motion.png` | light | animator scale 0 | live | Reduced motion Companion Home |
| `17-offline.png` | light | default | DEV `?fixture=OFFLINE` | Offline cached banner + usable shell |
| `18-error.png` | light | default | DEV `?fixture=ERROR` | Error card + retry (`თავიდან`) |
| `20-font130-home.png` | light | font 1.3 | live | 130% regression |

## Live API results (authoritative)

### Equipment (all four slots)

PUT `/api/medi-companion/equipment` → 2xx; `MediCompanionProfile.selectedCosmetics`:

- accent `COSMETIC_MILESTONE_04`
- accessory `COSMETIC_MILESTONE_03`
- background `COSMETIC_MILESTONE_05`
- decoration `COSMETIC_MILESTONE_02`

Failed PUT invalid key → **400** `COMPANION_COSMETIC_INVALID`; prior equipment unchanged. Equip writes **0** RewardLedger rows.

### QuestCompletion → Journey

Script `server/scripts/phase93c-quest-unlock.mjs`:

1. Reset calendar `daily_medi` `2026-09-07`
2. Seed units to `nextAt - 1` (22)
3. Create privacy-safe `AiInteraction` (OK / DOCTOR, no chat text)
4. `refreshQuestProgressForUser(MEDI_USED)` → quest COMPLETED, units **23**
5. Unlock **`MILESTONE_07`** at `2026-09-07T09:55:25.525Z`
6. Dedupe id: `MILESTONE_07:2026-09-07T09:55:25.525Z`
7. Second `reconcileMediJourneyForUser` → `newlyUnlockedKeys: []`

### HTTP / socket dedupe

- Unlock emitted on real Quest completion path (`reconcileMediJourneyAfterQuestSafe`), not by calling Journey as the only test.
- Immediate second reconcile returns no new keys.
- Client cold start after unlock: no celebration toast (`15-live-dedupe-single-toast.png`).
- Client unit tests: `celebrationDedupe.test.js` green.
- Multi-unlock UI: DEV fixture `MULTI_UNLOCK_4` shows one aggregate toast (acceptable for multi UI; single unlock above is real).

## Runtime noise (not Companion-origin)

Persistent LogBox: `expo-notifications: Custom sound 'default' not found…` — empty red toast at bottom of many shots. Not Companion / Reanimated / SVG.

## Expo Go limitation (not a freeze blocker)

`wm size` / `font_scale` + Expo Go reload was unreliable in 9.2. This pass used **native debug APK** with cold starts after size/font changes.

## FINAL-FREEZE

**MEDI COMPANION V1 — FINAL-FROZEN** at mobile **36.2.0** (no product layout patch required this pass).
