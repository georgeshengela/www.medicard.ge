# Cycle observation exposure comparison — Phase 30

**Status:** FINAL-FROZEN. Phases 1–29 remain FINAL-FROZEN.  
**Date:** 2026-09-10  
**App version:** mobile `53.0.0`

A safe, exposure-aware comparison between **two non-overlapping assessment windows**. Descriptive only. Not a diagnosis. Not hormonal interpretation. Not a causal trend engine. No OpenRouter / Medi.

Phase 30 still does **not** prove a biological trend. A future clinical or AI interpretation phase would need substantially more validation and is **not** authorized by this phase.

---

## 1. Two-window design

Exactly two adjacent, equal-duration civil-date windows:

| Window | Rule |
|---|---|
| Recent | most recent **14** civil days, today inclusive |
| Earlier | the **14** civil days immediately before that |

Today `2026-09-10` → recent `2026-08-28`–`2026-09-10`, earlier `2026-08-14`–`2026-08-27`.

Code: `EXPOSURE_COMPARISON_WINDOW_DAYS = 14` in `server/src/lib/cycleObservationExposureComparison.js`.

---

## 2. Non-overlap

Forbidden: last 14 days vs last 30 days (observations overlap).

Windows are constructed as adjacent half-open ranges on civil dates. After Pregnancy episode clipping, earlier dates remain strictly before `recentFrom`. Overlap aborts the comparison.

---

## 3. Field-specific denominator

For each window and each eligible field, reuse Phase 28 `aggregateObservationExposure`:

```
assessedDays = presentDays + explicitAbsentDays
rate = presentDays / assessedDays
```

UNKNOWN is excluded. Never use calendar days, `daysWithAnyLog`, `daysWithCycleLog`, or `daysInMode` as the symptom denominator.

Each field has its own denominator in each window. Nausea assessed days are not shared with vomiting.

---

## 4. Eligible fields

Registry flag `exposureComparisonEligible` defaults **false**. Also requires `assessmentEligible` **and** `exposureRateEligible`.

V1 (same binary set as Phase 29):

| Surface | Keys |
|---|---|
| Pregnancy | `nausea`, `vomiting`, `fatigue` |
| Perimenopause | `hot_flashes`, `night_sweats`, `fatigue` |

Excluded: private (notes, sexual, `vaginal_dryness`), fertility (BBT, OPK, mucus, pregnancy test), pain, bleeding/`flow`, categorical sleep/energy, unknown keys, heartburn, swelling.

Not every rate-eligible field must remain comparison-eligible forever.

---

## 5. Pregnancy scope

Both windows ∩ current **ACTIVE** episode. Previous episodes never contribute. Lower bound = civil `startedAt`.

If the active episode does not contain enough time for both windows → no comparison.

`availableDays` is the clipped civil-day count in that window (episode days only).

---

## 6. Perimenopause scope

No episode model. Two recent civil-date windows. Pre-mode factual assessments may count (storage is mode-independent). Copy stays generic: earlier / more recent assessed period. Never “early perimenopause” / “later perimenopause” / “during Perimenopause”.

---

## 7. Thresholds (locked)

| Rule | Value |
|---|---|
| Min assessedDays per window | **5** |
| Coverage per window | `assessedDays / availableDays >= 0.35` |
| Min availableDays per window | **7** |
| Event threshold (direction) | at least one window `presentDays >= 2` **and** total present across both `>= 3` |
| Absolute change (direction) | unrounded `\|recentRate − earlierRate\| * 100 >= 20` |
| Relative change (direction) | unrounded rate ratio `>= 1.5` (not shown to the user) |
| Zero baseline | if earlier rate = 0, do **not** divide. HIGHER only if recent `presentDays >= 3` **and** absolute `>= 25` points. Symmetric for recent = 0 → LOWER. |
| Coverage comparability (direction) | larger coverage / smaller coverage must **not exceed 2×** |

On unclipped 14-day windows, 5 assessed days is already 35.7% coverage. The 35% rule stays independent so Pregnancy-clipped windows cannot sneak through on tiny calendars.

0/10 vs 0/11: **no comparison card**. No “stable”.

1 vs 0: numbers may show; **no direction**.

---

## 8. Two qualification levels

`comparisonNumbersEligible` — both windows independently meet assessed / coverage / availableDays, and not both zero present.

`comparisonDirectionEligible` — numbers eligible **plus** event threshold, coverage comparability, and material-change (or zero-baseline) rules.

If numbers yes and direction no: show both factual windows, **no** higher/lower label.

V1 does **not** show “similar” / “equivalent”. That would sound like validated equivalence.

---

## 9. Unrounded math vs display

Threshold math uses raw `presentDays / assessedDays`.

Display percents are whole points via existing `roundExposureRatePercent` (`Math.round`). Example: 2/7 → math 0.2857, display **29%**. Do not compare rounded 29% vs 48%.

Internal direction: `HIGHER` | `LOWER` | `null`. Never IMPROVING / WORSENING.

---

## 10. Copy semantics

Allowed (only if direction qualifies):

- Higher: `ბოლო შეფასებულ პერიოდში უფრო მეტ პასუხიან დღეზე მონიშნე`
- Lower: `ბოლო შეფასებულ პერიოდში უფრო ნაკლებ პასუხიან დღეზე მონიშნე`

Window labels: `წინა შეფასებული პერიოდი` / `ბოლო შეფასებული პერიოდი`.

Must name assessed/answered days. Do not say rate, ratio, denominator.

Forbidden: improved, worsened, better, worse, getting worse, trending, progressing, hormonal, pregnancy/perimenopause progression, statistically significant, diagnosis. No Georgian equivalents of those claims.

No charts, sparklines, arrows, red/green movement, or scores.

---

## 11. UI

Collapsed Journal: unchanged Phase 23/26 occurrence sentence.

Expanded hierarchy: occurrence → Phase 29 single-window rate (if any) → comparison (if numbers eligible).

Max **3** comparison-enhanced rows. Ranking is existing Phase 23/26 ranking (family, then occurrence count). **Never** sort by largest increase, highest percent, or “worst change”.

If no eligible comparison: omit the section. Do not show an empty shell.

Overview / Home / Calendar unchanged.

---

## 12. API / cache / DB / offline

Server owns windows, aggregation, qualification, direction. Enrich existing Pregnancy `observationTrends` rows and Peri `observationSummaries`. **No new endpoint.**

Derived on read. No DB persistence. **No migration.** Phase 28 owns assessment storage.

No offline comparison engine. After sync, server recomputes. Do not animate late data as medical improvement/deterioration.

Personal export: raw assessment facts already export. Derived comparison is not required.

---

## 13. Firewalls

No doctor-summary auto-insert. No OpenRouter / Medi. No partner payload. No analytics of rates/differences/directions. No Notification Brain (“your hot flashes increased”). No forecast / `predictionConfidence` / fertile estimate / pregnancy dating change. No achievements.

---

## 14. Accessibility / large text / dark / small screen

A11y (expanded): observation, earlier present/assessed, recent present/assessed, direction only if qualified.

Large text 1.0 / 1.3 / 1.6 via system scaling. Dark: no red/green direction colors. Small screen (960×1800): comparison stacks vertically.

---

## 15. Future limit

Phase 30 compares two bounded assessed periods. It does not prove a biological trend, hormone change, or diagnosis. A future clinical/AI interpretation phase is a separate product decision and is **not** implied here.

**Phase 31** explains why comparison numbers or a direction label may be absent. It does not change comparison math. See `docs/CYCLE_OBSERVATION_EXPLAINABILITY_CONTRACT.md`.

---

## 16. Code

Canonical helper: `buildObservationExposureComparison` / `qualifyObservationExposureComparison`. Pregnancy and Perimenopause share qualification math. Mode code supplies eligible keys and allowed date scope only.

Thresholds:

```
EXPOSURE_COMPARISON_WINDOW_DAYS = 14
EXPOSURE_COMPARISON_MIN_ASSESSED_DAYS = 5
EXPOSURE_COMPARISON_MIN_COVERAGE = 0.35
EXPOSURE_COMPARISON_MIN_AVAILABLE_DAYS = 7
EXPOSURE_COMPARISON_MIN_ABS_POINTS = 20
EXPOSURE_COMPARISON_MIN_RELATIVE_RATIO = 1.5
EXPOSURE_COMPARISON_MAX_COVERAGE_RATIO = 2
EXPOSURE_COMPARISON_MAX_ROWS = 3
```
