# Cycle observation exposure rates — Phase 29

**Status:** FINAL-FROZEN. Phases 1–28 remain FINAL-FROZEN.  
**Date:** 2026-09-10  
**App version:** mobile `52.0.0`

Exposure-aware rates for fields with valid explicit assessment coverage. One bounded window. Not a directional trend product. Not diagnosis. No OpenRouter / Medi.

---

## 1. Denominator

For each eligible observation key:

```
assessedDays = presentDays + explicitAbsentDays
rate = presentDays / assessedDays
```

UNKNOWN days never enter the denominator.

Never use:

- calendar days in the window
- days with any log
- days in Pregnancy
- days in Perimenopause
- days since episode start / mode selection

as a **symptom** denominator.

Example: 4 present + 6 absent + 20 unknown → **4 of 10 assessed days** (40%). Never 4/30.

Coverage is **per field**. Hot flashes at 10 assessed days and night sweats at 3 do not share a denominator.

---

## 2. Eligible fields

Registry flag `exposureRateEligible` defaults **false**. Also requires `assessmentEligible === true`.

V1:

| Surface | Keys |
|---|---|
| Pregnancy | `nausea`, `vomiting`, `fatigue` |
| Perimenopause | `hot_flashes`, `night_sweats`, `fatigue` |

Excluded: pain, bleeding/`flow`, sleep, energy, mood, private (notes, sexual, `vaginal_dryness`), fertility (BBT, OPK, mucus, pregnancy test), unknown keys, heartburn, swelling.

---

## 3. Window

One primary recent window: **last 30 civil days**.

**Pregnancy:** current ACTIVE episode ∩ last 30 civil days. Previous episode never mixes. Lower bound = civil `startedAt`.

**Perimenopause:** last 30 civil days. No episode model. Recent factual assessments may count after a mode switch. Copy is generic observation history, not “perimenopause-era”.

`availableDays` = civil days in that field-specific window. It is a **rate-display quality** metric only. It is not the symptom denominator.

Short Pregnancy episode (7 days): coverage = assessedDays / 7, not / 30.

---

## 4. Qualification (`isExposureRateDisplayEligible`)

All must pass:

| Rule | Value |
|---|---|
| Minimum present | `presentDays >= 2` |
| Minimum sample | `assessedDays >= 5` |
| Coverage quality | `assessedDays / availableDays >= 0.30` |

Boundaries: 4 assessed → no rate. 8/30 → no rate. 9/30 → eligible if other rules pass. 1 available day → no rate.

Zero present: **no standalone 0% card**. Occurrence summaries already omit 0–1 present days.

If qualification fails: keep the existing Phase 23/26 occurrence sentence. No rate. No “you didn’t log enough”.

---

## 5. Formula and copy

Whole percentage points: `Math.round(present / assessed * 100)`. 2/7 → 29%. No 28.57%.

Never show `40%` alone. Always:

`იმ დღეებიდან, როცა ამ ნიშანს უპასუხე, 10-დან 4-ში მონიშნე · 40%`

Hint: `ეს არის პასუხის გაცემული დღეები, არა მთელი თვე.`

Unsafe: “occurs 40% of the time”, “of 30 days”, “of logged days”, increasing/decreasing/improving/worsening, due to hormones / trimester / menopause.

Collapsed Journal: occurrence count only (`აღრიცხე 4 დღეს`).  
Expanded row: exposure detail. No charts, sparklines, or trend arrows.

---

## 6. Integration

Architecture **A**: enrich existing summary rows with optional `exposure`. Primary product remains Phase 23/26 factual counts.

Attached on:

- `GET /api/cycle/pregnancy` → `observationTrends.trends[].exposure`
- `GET /api/cycle` Perimenopause → `perimenopause.observationSummaries.summaries[].exposure`

Shape (only when `rateDisplayEligible`):

```
exposure: {
  presentDays, absentDays, assessedDays, availableDays,
  ratePercent, rateDisplayEligible: true
}
```

Coverage percent is server-internal. No `coveragePercent` in the mobile payload. No second endpoint. No DB column for rates. Compute on read from already-bounded logs via Phase 28 `aggregateObservationExposure`.

Mobile renders `exposure` if present. It does not independently decide validity.

---

## 7. Privacy

| Surface | Rates |
|---|---|
| Overview / Home / Calendar | **No** |
| Doctor summary | **No** |
| Partner | **No** |
| Medi / OpenRouter | **No** |
| Personal export | Raw assessments only (Phase 28). Derived rates **not** exported |
| ProductEvent | **No** |
| Notification Brain | **No** |
| Achievements | **Forbidden** |

---

## 8. Offline / edit

After sync, rates recompute from canonical server state. No independent offline rate engine.

PRESENT → ABSENT: present −1, absent +1, assessed unchanged.  
Clear to UNKNOWN: assessed −1. Rate disappears if thresholds fail; occurrence remains if still ≥ 2.  
Positive chip outside the assessment panel still counts PRESENT.

Loading a missing payload ≠ “not eligible”. Same existing read response — no split fetch.

---

## 9. Future directional work (not implemented in Phase 29)

Phase 29 describes **one** window. No window-to-window comparison.

**Phase 30** is the consumer of two-window comparison. See `docs/CYCLE_OBSERVATION_EXPOSURE_COMPARISON_CONTRACT.md`. Phase 29 single-window rates are unchanged.

**Phase 31** explains why a rate may be absent. It does not change these thresholds. See `docs/CYCLE_OBSERVATION_EXPLAINABILITY_CONTRACT.md`.

---

## 10. Thresholds (locked)

`EXPOSURE_RATE_MIN_ASSESSED_DAYS = 5`  
`EXPOSURE_RATE_MIN_COVERAGE = 0.3`  
`EXPOSURE_RATE_MIN_PRESENT_DAYS = 2`

Code: `server/src/lib/cycleObservationExposureRates.js`.
