# Cycle Phase 42 QA — postpartum return to TRACK

Account: `cycle.qa.phase6@medicard.ge` / `CycleQaPhase6a`

Seed from `server/`:

```
node scripts/cycle-phase42-qa-seed.js postpartum|zero|one|two|three|ttc
```

Android screenshots on Pixel_8 (`emulator-5554`). iOS deferred by product decision.

| Shot | File |
|---|---|
| 01 | `01-postpartum-return-action.png` |
| 02 | `02-return-confirmation.png` |
| 03 | `03-track-learning-zero-history.png` |
| 04 | `04-track-learning-one-period.png` |
| 05 | `05-track-learning-two-periods.png` |
| 06 | `06-track-forecast-ready.png` |
| 07 | `07-calendar-no-prediction-before-ready.png` |
| 08 | `08-calendar-prediction-after-ready.png` |
| 09 | `09-history-classified-periods.png` |
| 10 | `10-large-text.png` |
| 11 | `11-dark.png` |
| 12 | `12-small-screen.png` |

Live GET: `node qa/cycle-phase42-postpartum-return-to-track/live-cycle-get.mjs`

Seed left on **three** / `TRACK_PERIOD` after freeze capture.
