# Medi World Phase 43 QA evidence

Android: Expo Go `host.exp.exponent` on existing AVD `Pixel_8` (`emulator-5554`). Local API `http://10.0.2.2:4000` → disposable Postgres `127.0.0.1:54329` / `medicard_phase38` only. Production Neon was not used.

Device session: `world.qa@medicard.test` (**World!**). Public identity `1.0.0.7.78` / iOS `1.7.78`.

Simulated route: Google emulator test area starting `37.422, -122.084`, northbound ~16 m steps at ~8 s (~2 m/s walk). Not a personal location.

`adb emu geo fix <longitude> <latitude>` with `Accuracy.High`. No background location requested by Medicard `app.json`. Expo Go host lists `ACCESS_BACKGROUND_LOCATION` as `granted=false`.

## Screenshot index

| File | State |
| --- | --- |
| `ka-intro.png` / `ka-setup-hub.png` / `ka-mode-5min.png` | Georgian setup |
| `en-setup.png` | English intro |
| `ka-safety.png` / `ka-safety-2.png` | Safety confirmation |
| `native-gps-ready.png` / `locating.png` | Native GPS ready |
| `active-walk.png` | Active walk 0:00 |
| `half-progress.png` | ~2:20 / 5:00 verified |
| `too-fast-pause.png` / `pause-session.png` | Motorized-speed pause |
| `resume-session.png` / `resume-active.png` | Resume |
| `target-complete.png` | 5:16 / 5:00, Medi complete line |
| `completion-summary.png` | 100% summary + server reward copy |
| `movement-history.png` | History: walk · completed · within_500m · 100% |
| `collect-disabled-after-success.png` | Phase 42 Collect disabled |
| `dark-explore.png` | Dark collect sheet, Collect still disabled |
| `columns.txt` | `LEAKS none` |

History after API restart was re-fetched over HTTP: completed, `within_500m`, 10000 bps, no coordinates/tokens.

Emulator restored: `wm size` 1080x2400, `font_scale` 1.0, night no.
