# Cycle Perimenopause tracking mode — Phase 24 foundation

**Status:** Live product mode. Observation-first. Not a Cycle product-final.  
**Date:** 2026-09-10  
**App version:** mobile `47.0.0`  
**Phases 1–23 remain frozen.**

`PERIMENOPAUSE` is an explicit user-selected tracking goal. It adapts Cycle Management for changing intervals and body-change logging. It does not diagnose perimenopause or menopause.

---

## 1. Mode semantics

Canonical `CycleProfile.mode` values:

`TRACK_PERIOD` | `TRY_TO_CONCEIVE` | `PREGNANCY` | `PERIMENOPAUSE`

There is no `isPerimenopause`, `menopauseMode`, or `isMenopausal` field.

`CycleProfile.conditions` may still include the self-reported chip `'perimenopause'`. That chip is frozen context for advice. It does **not** switch tracking mode.

---

## 2. Explicit entry only

Entry is Settings → tracking goal → **პერიმენოპაუზის თვალყური**, then a short onboarding sheet, then Save.

Never auto-enter from age, irregular periods, missed periods, hot flashes, symptoms, AI, labs, or cycle variability.

No age gate.

---

## 3. Non-diagnostic wording

Do not tell the user they are in perimenopause or menopause. Do not confirm menopause from 12 months without bleeding. Do not say symptoms “mean menopause”.

Safe header: **პერიმენოპაუზის რეჟიმი** plus “this is a tracking mode you chose, not a diagnosis.”

---

## 4. Capability map

Central maps:

- Server: `server/src/lib/cycleModes.js` → `CYCLE_MODE_CAPABILITIES[PERIMENOPAUSE]` / `capabilitiesForProfileMode`
- Mobile: `mobile/src/lib/cycleModes.js` → `cycleModeCapabilities`

| Capability | Perimenopause |
|---|---|
| `showPerimenopauseTracking` | true |
| `showVariabilityContext` | true |
| `showLatePeriod` | false |
| `showFertileEstimates` | false |
| `showFertilityShortcuts` / OPK / BBT / TTC overview | false |
| `showPregnancyOverview` | false |
| `showNextPeriodForecast` | true (UI may hide a precise date when confidence is `low`) |

Do not scatter `if (mode === 'PERIMENOPAUSE')` for these flags.

`futureOnly` keeps `perimenopauseDiagnosis` — never implement it here.

**Phase 27:** full four-mode matrix and remaining valid domain checks: `docs/CYCLE_MODE_CAPABILITIES_CONTRACT.md`.

---

## 5. Prediction policy

Forecast **arithmetic is unchanged**. Presentation:

- Engine `predictionConfidence` is reused. No peri/hormone score.
- `medium` / `high`: may show an estimated next-period date, labeled estimated.
- `low`: “მომდევნო მენსტრუაციის შეფასება ბოლო ჩანაწერებით რთულია.” No exact-date CTA.

Read model: `bundle.perimenopause.forecast`.

---

## 6. Late-period policy

`detectLatePeriod` returns `{ reason: 'perimenopause_mode' }` and is not shown.

`buildCycleAlerts` skips late and 21–35-day “irregular gap” alerts. The 8-day heavy-flow safety alert remains.

---

## 7. Fertile-window policy

Fertile window and ovulation estimates are not prominent. Calendar predicted/fertile decorations are off. Historical OPK/BBT/mucus remain in storage. TTC is a separate explicit mode.

---

## 8. Cycle variability

Source: consecutive `inferred.periodStarts` (already computed). **Not** `buildCycleTrends` 18–45 clamp.

Window: last **6** completed intervals whose later start is within 12 months. Gaps `<1` or `>365` are skipped as logging holes.

| Intervals | UI |
|---|---|
| 0 | “ცვალებადობის შესაჯამებლად მეტი აღრიცხული ციკლია საჭირო.” |
| 1 | factual single interval; not a range |
| 2+ | shortest / longest only |

No irregularity score. No “getting longer / shorter / increasing”.

Fixture: 24, 31, 46, 29 → count 4, shortest 24, longest 46.

---

## 9. Skipped / missing bleeding

Missing episode ≠ skipped period. Do not say skipped, missed, or menopause. Show recorded episodes only.

Spotting is not a period start (frozen engine). Overview “last recorded bleeding” may include spotting as a logged bleed day.

---

## 10. Observations

Reuse registry. No new keys in Phase 24.

| Need | Key | Notes |
|---|---|---|
| Hot flashes | `hot_flashes` | existing PHYSICAL |
| Night sweats | `night_sweats` | existing; AI deny |
| Vaginal dryness | `vaginal_dryness` | PRIVATE / SENSITIVE; More Tracking only; not Overview recents |
| Mood / sleep / energy / headache | canonical fields | no `perimenopauseMood` |
| Palpitations / brain fog | deferred | `unfocused` mood already exists |

---

## 11. Privacy / AI / partner / doctor / analytics / push

| Surface | Phase 24 |
|---|---|
| AI | Mode sent as `TRACK_PERIOD`. No peri interpretation. `night_sweats` / dryness stay deny. `hot_flashes` keep existing allowlist. |
| Partner | Unchanged. No mode. No new symptom sharing. |
| Doctor summary | Unchanged. No “patient is perimenopausal” header. |
| Analytics | No new ProductEvents for mode, hot flashes, night sweats, dryness, or intervals. |
| Notification Brain | No new candidate types. Period/fertile/late candidates suppressed (`PERIMENOPAUSE_SUPPRESSED`). `log_nudge` may remain if the user enabled it. |

Personal export includes `profile.mode` and canonical logs (existing).

---

## 12. Transitions

| From → to | Rule |
|---|---|
| TRACK / TTC → PERIMENOPAUSE | Onboarding + save. History preserved. Not retagged as peri. |
| PREGNANCY → PERIMENOPAUSE | Frozen `applyPregnancyEpisodeTransition`: leaving PREGNANCY ends the ACTIVE episode. No silent skip of that flow. |
| PERIMENOPAUSE → TRACK | Save. Classic TRACK presentation. |
| PERIMENOPAUSE → TTC | Existing TTC onboarding. |
| PERIMENOPAUSE → PREGNANCY | Existing Pregnancy onboarding + episode create. |

Offline: same Cycle UPSERT overlay. No peri store. No extra cold-start fetch.

---

## 13. Read model

Attached on `GET /api/cycle` as `perimenopause` (null unless mode is `PERIMENOPAUSE`):

```
{
  mode, recentBleedingEpisodes, recentCycleIntervals,
  variabilitySummary, lastRecordedBleeding, recentObservations, forecast,
  observationSummaries
}
```

Code: `server/src/lib/cyclePerimenopause.js`.

---

## 14. Future phases (not this one)

- Menopause confirmation / 12-month rule
- Palpitations / brain-fog catalog expansion
- OpenRouter / Medi peri interpretation
- Exposure-aware denominators / longitudinal direction

Doctor-summary “Perimenopause tracking mode selected” header: **Phase 25** — see `docs/CYCLE_DOCTOR_SUMMARY_CONTRACT.md` §14.

Journal observation summaries: **Phase 26** — see `docs/PERIMENOPAUSE_OBSERVATION_SUMMARIES_CONTRACT.md`. This contract does not duplicate that Journal payload.

---

## 15. QA

Android artifacts: `qa/cycle-phase24-perimenopause/`.  
Account: `cycle.qa.phase6@medicard.ge` / `CycleQaPhase6a`.  
Seed: `server/scripts/cycle-phase24-qa-seed.js`.  
iOS QA deferred by product decision.
