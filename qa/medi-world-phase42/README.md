# Medi World Phase 42 / 42.1 QA evidence

Android: Expo Go `host.exp.exponent` 57.0.9 on existing AVD `Pixel_8` (`emulator-5554`). Local API `http://10.0.2.2:4000` → disposable Postgres `127.0.0.1:54329` / `medicard_phase38` only. Production Neon was not used.

Device session: existing logged-in user **World!** (`userId` `34dfd803-541f-49b2-9b23-b1be8997ffb5` on the disposable DB).

Public app identity: `1.0.0.7.77` / iOS marketing `1.7.77`.

Map: Leaflet 1.9 WebView, OSM raster tiles (`tile.openstreetmap.org`). No Mapbox key. No Carto key.

Development fixtures are labeled in-app as QA fixtures. Simulated location is Google’s standard emulator test area (garden `37.422, -122.084`; park offset ~200 m). Not a home, clinic, or personal coordinate. Product screenshots emphasize fixture names and states, not raw coordinates. The `__DEV__` probe shows permission / services / sample yes-no / accuracy m / age s — never raw lat/lng.

## Native pipeline (Phase 42.1)

`adb emu geo fix <longitude> <latitude>` while Explore requested `Accuracy.High` (GPS `mStarted=true`) → `expo-location` sample (5 m, 0–3 s) → intentional Collect POST → server verification (coords stripped) → `CareSparkCollection` row (coarse key only) → UI count.

`cmd location` mock injection is denied on this Play image (`MOCK_LOCATION`). Extended Controls was not automatable here. GPX/KML was not required after single-point injection worked. No dedicated `Medicard_QA_API35` AVD. No development build — Expo Go delivered the sample after the High-accuracy fix.

## Screenshot index

Native GPS evidence (not a hardcoded “use fixture location” button):

| File | State | Native GPS? | QA fixture? |
| --- | --- | --- | --- |
| `location-diagnostics.txt` | AVD / providers / failing boundary / High-accuracy proof | diagnostics | — |
| `explore-after-far-fix.png` | Map + probe after High-accuracy + geo fix | yes | place names |
| `too-far-result-2.png` | `SPARK_TOO_FAR` from park GPS vs garden Spark | yes | — |
| `native-collected.png` | First `SPARK_COLLECTED` (garden), count 0→1 | yes | — |
| `persist-after-api-restart.png` | Discoveries still 1 after local API restart | persist | — |
| `persist-explore-count.png` | Explore list after restart: Found + count 1 | persist + sample | — |
| `already-collected-sheet.png` | Garden Collect disabled (idempotent UI) | sample on screen | — |
| `map-native-osm.png` | OSM map centered from native sample + fixtures | yes | map of emulator test area |
| `explore-settings-precise.png` | Precise foreground allowed; background off | permission | — |
| `en-native-list-2.png` / `persist-explore-count.png` | English list | yes | — |
| `ka-list-native.png` | Georgian list + 1.3× in-app type | yes | — |
| `compact-native-list.png` | Compact `wm size 1080x1700` | yes | — |
| `inaccurate-qa-armed-2.png` | `SPARK_LOCATION_INACCURATE` | native sample sent | **QA-armed** `arm_inaccurate` |
| `expired-qa-armed.png` | `SPARK_EXPIRED` | native sample sent | **QA** `expire_active` |
| `fifth-native-collect-2.png` | Fifth daily success (count 5) | yes (square) | 3 padded dummy rows |
| `daily-cap-qa-2.png` | `SPARK_DAILY_CAP_REACHED` | native sample sent | park spawn restored after expire |
| `map-fail-list-fallback.png` | List forced | sample | **QA-armed** `arm_map_fail` |
| `offline-cached-list.png` | Cached list + offline browse copy | sample | API stopped (Metro still up) |
| `offline-collect-disabled-2.png` | Collect disabled offline | — | API unreachable |
| `feature-disabled-explore.png` | `MEDI_WORLD_EXPLORE_ENABLED=0` | — | server flag |
| `en-dark.png` | English dark chrome (cool gray-950) | earlier same AVD, pre-fix count 0 | — |
| `reduced-motion.png` | Named file from Phase 42 (same chrome as en-dark) | OS reduce-motion was **off** in 42.1 settings | — |
| `safety-intro-ka.png` / `safety-intro-en.png` | Safety intro | — | — |
| `permission-explain.png` / `permission-denied.png` | Foreground-only permission UX | — | — |

Helpers `shot.mjs` / `tap.mjs` must be run from the repo root.

Do not put real personal coordinates into screenshots or reports.
