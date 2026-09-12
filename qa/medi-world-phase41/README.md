# Medi World Phase 41 QA evidence

Android: Expo Go on `emulator-5554`, local API `10.0.2.2:4000`, disposable Postgres `127.0.0.1:54329` only.

QA login: `world.qa@medicard.test` (local disposable user).

Public app identity: `1.0.0.7.75`.

Required screens (filled as captured):

| File | State |
| --- | --- |
| `ka-adventure-light.png` | Georgian generated Adventure |
| `en-adventure-light.png` | English generated Adventure |
| `ka-adventure-dark.png` | Georgian dark (cool gray-950) |
| `en-adventure-dark.png` | English dark |
| `one-capability.png` | One supported capability (movement only) |
| `three-slot.png` | Full three-slot path |
| `choice-before.png` | Optional choice before selection |
| `choice-selected.png` | Selected choice |
| `swap-result.png` | Swap result |
| `swap-exhausted.png` | Swap exhausted |
| `partial-progress.png` | Partial progress (`მიმდინარეობს`, 50 / 100) |
| `completed.png` | Completed Adventure (`დღისთვის ეს საკმარისია.`) |
| `rest-day.png` | Rest Day Mode |
| `recovery.png` | No-compatible-action recovery (no reward) |
| `offline-cached.png` | Airplane + cached read-only Adventure |
| `retry-recovery.png` | Airplane off, live refresh |
| `compact-layout.png` | Compact layout (`wm size 1080x1700`) |
| `font-1_3.png` | ~1.3× font |
| `reduced-motion.png` | Animation scales 0, static path |
| `radiant-ka-corrected.png` | Copy of corrected Phase 40 Radiant (ka) |
| `radiant-en-corrected.png` | Copy of corrected Phase 40 Radiant (en) |
| `../medi-world-phase40/radiant-ka-corrected.png` | Canonical Phase 40 Radiant (ka): გაღვიძებული თანამგზავრი |
| `../medi-world-phase40/radiant-en-corrected.png` | Canonical Phase 40 Radiant (en): A fully awakened care companion |

| `feature-disabled.png` | Medi World index while server flag is off (awakening; no live profile) |
| `feature-disabled-world.png` | Same World index capture |
| `feature-disabled-quest.png` | Quest hub footer: ისტორია / ბალანსი / ჯილდოები, no Medi World tile |
| `feature-disabled-adventure.png` | `/medi-world/adventure` shows `featureOff` (`ეს გზა ახლა არ არის გახსნილი.`) |
| `feature-disabled-care-space.png` | Deep-link Care Space with flag off: title + body, no cached companion, back works |

There is **no** ordinary-online expired Adventure screenshot. `GET /today` never returns yesterday; an expired Today frame is not a required online screen. Offline expired cache is unit-tested (`cacheExpiry.test.ts`) and would need a previous-day cached payload plus airplane mode.
