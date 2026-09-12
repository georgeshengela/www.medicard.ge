# Cycle observation explainability — Phase 31

**Status:** FINAL-FROZEN. Phases 1–30 remain FINAL-FROZEN.  
**Date:** 2026-09-10  
**App version:** mobile `54.0.0`

Transparent, user-readable explanations of what observation numbers mean and why a rate, comparison, or direction may or may not be available.

This is **explainability, not coaching**. It does not encourage more logging. It does not unlock comparisons. It does not prove a biological trend.

---

## 1. Purpose

When a user expands a Pregnancy or Perimenopause observation row, they can open one compact sheet to learn:

- only answered days are used
- unanswered days are not counted as “not present”
- why a percentage may be absent
- why a two-period comparison may be absent
- why two numbers can appear without a higher/lower label
- that HIGHER/LOWER describes recorded answers only

---

## 2. Non-coaching rule

User copy never says: log more, check in more, answer every day, complete more assessments, keep a streak, improve coverage, unlock comparisons.

No streaks, progress bars, coverage goals, badges, rewards, Medi Coins, Quest, or Notification Brain copy.

---

## 3. Server reason model

Mobile does **not** recompute `assessedDays < 5`, coverage, or material-change math.

Server attaches additive `explainability` on rate-eligible occurrence rows:

```
explainability: {
  rate: { available, reason },
  comparison: {
    numbersAvailable,
    directionAvailable,
    numbersReason,
    directionReason
  } | null
}
```

Reasons are product explanation metadata, not medical conclusions. They are never shown as raw enum strings.

### Rate unavailable

`NO_PRESENT_OCCURRENCES` · `INSUFFICIENT_OCCURRENCES` · `INSUFFICIENT_ASSESSED_DAYS` · `INSUFFICIENT_COVERAGE` · `NOT_EXPOSURE_ELIGIBLE`

User copy is generic: the percentage is not shown with these data. Unanswered days are excluded.

### Comparison unavailable

`EARLIER_WINDOW_INSUFFICIENT` · `RECENT_WINDOW_INSUFFICIENT` · `BOTH_WINDOWS_INSUFFICIENT` · `SHORT_AVAILABLE_HISTORY` · `NO_QUALIFIED_TWO_WINDOW_DATA`

User copy is generic: there is not enough comparable answered-day information in both periods. Short Pregnancy history uses `SHORT_AVAILABLE_HISTORY` and does **not** imply missing effort.

### Direction unavailable

`CHANGE_TOO_SMALL` · `COVERAGE_NOT_COMPARABLE` · `EVENT_COUNT_TOO_LOW` · `ZERO_BASELINE_NOT_QUALIFIED`

User copy: the app does not label one period higher or lower. Never “no change”, “similar”, or “not significant”. Coverage-imbalance copy does not mention a 2× ratio.

---

## 4. Raw thresholds

Exact thresholds stay in the Phase 29/30 technical contracts. They are **not** user-facing.

Do not show: minimum 5 days, 35%, 20 points, 1.5×.

---

## 5. UNKNOWN / PRESENT / ABSENT

- No answer = not counted. Do not say “missing data” or “unknown state” in the product UI.
- “Present today” counts as an answered day.
- “Not present today” counts as an answered day. Do not call it negative, normal, healthy, or safe.

---

## 6. UI

Collapsed Journal rows are unchanged.

Expanded rate-eligible rows may show:

- `რას ნიშნავს?`
- `რატომ არ ჩანს პროცენტი?` when the Phase 29 rate is absent
- `რატომ არ ჩანს შედარება?` when Phase 30 numbers are absent

One component: `CycleObservationExplainSheet`. Fade overlay (`APP_MODAL_PROPS`). Scrollable. No alert colors.

Empty summaries do not show explanation.

---

## 7. Pregnancy / Perimenopause

Same math/data explanation for nausea and hot flashes. No symptom education. No trimester or hormone language. Pre-mode Peri facts stay generic.

---

## 8. Firewalls

No doctor-summary PDF metadata. No partner payload. No OpenRouter / Medi. No analytics of observation key / reason / rate / direction. No Notification Brain. No personal-export of derived reasons. No DB migration. Derived on read from the existing calculation pass.

---

## 9. Accessibility / large text / dark / small screen

Info action announces `პასუხიანი დღეების ახსნა`. Sheet text is readable by screen readers. Large text 1.0 / 1.3 / 1.6: sheet scrolls, close CTA stays visible. Dark: Cycle navy, no alert red. Small screen 960×1800: no clipped fixed-height sheet.

---

## 10. Code

Canonical helpers: `explainObservationRate` / `explainObservationComparison` / `attachObservationExplainability` in `server/src/lib/cycleObservationExplainability.js`.

Phase 29 rate math and Phase 30 comparison math are unchanged.

---

## 11. Future limit

Phase 31 does not authorize logging coaching, assessment streaks, or clinical/AI interpretation.
