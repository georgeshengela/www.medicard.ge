# Pregnancy observation trends — Phase 23 contract

**Status:** implementation contract for Cycle Phase 23. Phases 1–22 remain FINAL-FROZEN.  
**Date:** 2026-09-10  
**App version:** mobile `46.0.0`

Denominator-safe, current-episode Pregnancy observation summaries. Factual recurrence only. Not diagnosis. Not a triage engine. No OpenRouter / Medi.

---

## Scope

When `mode = PREGNANCY` and an ACTIVE episode exists, the Journal shows compact summaries of **what the owner logged** in the current episode, over a bounded recent window.

Primary location: Pregnancy Journal — `ორსულობის ჩანაწერების შეჯამება`.  
Not Overview. Not a fourth tab. No charts.

---

## Non-goals

- symptom prevalence percentages
- calendar-day denominators (`5 / 30`)
- “logged on X of Y logged days”
- increasing / decreasing / improving / worsening
- trimester or week comparisons
- diagnosis, triage, red-flag scores
- OpenRouter, Medi, LLM interpretation
- merging personal logs into the educational timeline or baby-size guide
- doctor-summary / AI / partner / Notification Brain payloads
- exporting derived trend rows (raw CycleLog already exports)

---

## Episode isolation

- Current **ACTIVE** episode only.
- Lower bound = civil day of `episode.startedAt` (not LMP / `referenceDate`).
- Upper bound = today (ACTIVE).
- Query cap = 90 days (same Phase 22 observation window).
- User-facing count window = **last 30 civil days ∩ episode start**.
- A new episode starts at zero. Previous-episode nausea/spotting never mix.
- When the episode ends, the section disappears with mode. Rows are not deleted.

---

## Query / read model

Attached on existing `GET /api/cycle/pregnancy` as `observationTrends`.

Same bounded CycleLog read as Phase 22. No second write path. No N+1. No extra table.

Shape:

```
{
  version: 'cycle-pregnancy-observation-trends-v1',
  window: { from, to, recentDays: 30, episodeFrom, queryCapDays: 90 },
  trends: [{ key, family, summaryType, occurrenceCount, lastLoggedDate, recentDates, summaryArgs: { days }, severityCounts?, flowCounts? }],
  generatedAt
}
```

Unknown stored keys are omitted. No raw observation JSON.

Edits and deletes recompute on the next fetch. No cached trend engine. Offline writes appear after the canonical UPSERT syncs; there is no separate offline trend model.

---

## Missing-data semantics

Missing log ≠ negative. A day with energy only is not “no nausea”.  
Counts are unique civil days where the key was **present**. No percentages. No `windowDays` in `summaryArgs`.

---

## Trend types

| Type | Use |
|---|---|
| `RECENT_OCCURRENCE` | Factual day count |
| `RECENT_SEVERITY_DISTRIBUTION` | Pain row that also has categorical severity counts |
| `RECENT_BLEEDING_OCCURRENCE` | Spotting / flow category counts |

Not implemented: INCREASING, DECREASING, IMPROVING, WORSENING, LAST_LOGGED-as-a-card, consecutive-day streaks, logs/day averages.

`lastLoggedDate` is a field on every row.

---

## Registry

`pregnancyTrendEligible` on each observation. **Default false.** Phase 13 `trendEligible` is unchanged.

Eligible in V1:

- `flow` (spotting / light / medium / heavy)
- `pain` (canonical `painEntries` types)
- nausea, vomiting, bloating, heartburn, constipation, diarrhea
- fatigue (distinct from energy)
- energy (low + very_low grouped as `energy.low`)
- dizziness, migraine, swelling, short_breath, frequent_urination, leg_cramps

Excluded: discharge (clinically sensitive / context-dependent — logged in history, not trend cards), sleep, stress, sexual health, notes, pregnancy test, OPK, BBT, mucus, unknown keys.

Threshold: 0–1 occurrence → no row. 2+ → factual count. No “often”.

Ranking (UI relevance, not triage): bleeding → pain → nausea/vomiting → energy/fatigue → other body, then occurrence, then last date. No urgent/warning labels.

Pain severity stays categorical (mild / moderate / severe). No numeric mean.  
Energy is not numeric-averaged.

---

## Copy

Safe: აღრიცხე, ბოლო ჩანაწერი.  
Forbidden: გახშირდა, გაუარესდა, გაუმჯობესდა, მიუთითებს, ნიშნავს, normal/abnormal.

Window subtitle: `ბოლო 30 დღე ამ ეპიზოდში.` — defines the recent period; it is not a prevalence denominator.

Empty: `შეჯამებები გამოჩნდება, როცა რამდენიმე ჩანაწერი დაგროვდება.`

---

## Privacy / AI / partner / doctor / notifications / analytics

Owner health data. Trends are not added to AI prompts, partner payload, doctor summary, personal export, Notification Brain, or ProductEvent.

---

## Auth / loading / errors

Same Pregnancy GET gate (auth, owner, mode, ACTIVE episode).  
Pending is loading, not empty. API failure omits the subsection; Journal remains usable. No cross-user flash.

---

## Phase 29 — exposure-aware rates

Expanded Journal rows may show an optional `exposure` rate when field-specific `assessedDays` and coverage thresholds pass. Collapsed Journal stays the occurrence sentence. Calendar-day denominators remain forbidden. See `docs/CYCLE_OBSERVATION_EXPOSURE_RATES_CONTRACT.md`.

## Phase 30 — two-window exposure comparison

Expanded Journal rows may also show an optional two-window `comparison` (earlier vs more recent 14 civil days) when both windows independently qualify. Direction labels require stricter material-change and coverage-comparability rules. Not a biological trend. See `docs/CYCLE_OBSERVATION_EXPOSURE_COMPARISON_CONTRACT.md`.

iOS QA is deferred by product decision.
