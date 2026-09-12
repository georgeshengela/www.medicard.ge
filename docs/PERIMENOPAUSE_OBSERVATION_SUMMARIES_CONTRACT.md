# Perimenopause observation summaries — Phase 26 contract

**Status:** FINAL-FROZEN. Phases 1–25 remain FINAL-FROZEN.  
**Date:** 2026-09-10  
**App version:** mobile `49.0.2`

Denominator-safe, Journal-only Perimenopause observation summaries. Factual recurrence of **what the owner logged**. Not a diagnosis. Not hormonal interpretation. No OpenRouter / Medi.

---

## Scope

When `profile.mode === PERIMENOPAUSE`, the Perimenopause Journal shows compact summaries of logged observations over a bounded recent window.

Primary location: Perimenopause Journal — `ბოლო ჩანაწერების შეჯამება`.  
Not Overview. Not Calendar. Not Quick Log. Not a fourth tab. No charts.

Journal order:

1. Recent bleeding history (Phase 24 episodes)
2. Cycle variability (Phase 24)
3. Observation summaries (this phase)
4. Recent body-change history (Phase 24)

These have distinct semantics. Summaries do not duplicate bleeding-episode UI.

---

## Non-goals

- symptom prevalence percentages
- calendar-day denominators (`5 / 30`)
- “logged on X of Y logged days”
- increasing / decreasing / improving / worsening / more frequent
- hormonal interpretation (estrogen decline, ovarian aging, menopause progression)
- Perimenopause / Menopause / AUB / anemia / thyroid / mental-health / sleep-disorder diagnosis
- OpenRouter, Medi, LLM summarization
- mode-history timestamps / “since Perimenopause began”
- `PerimenopauseEpisode` / `MenopauseEpisode`
- doctor-summary derived cards, AI, partner, Notification Brain, ProductEvent
- exporting derived summary rows (raw CycleLog already exports)

---

## Mode requirement

Shown only when current mode is `PERIMENOPAUSE`.  
TRACK / TTC / PREGNANCY do not get this product.

Switching out hides the section. Logs remain. Switching in may count **recent canonical logs** from the 30-day window, including logs made while TRACK was active. Copy is always “logged on N days”, never “Perimenopause hot flashes” or “symptoms since transition.”

No mode-history table.

---

## Window

| Bound | Value |
|---|---|
| Display / count window | last **30 civil days** (`today − 29` … `today`) |
| Fetch cap | **90 civil days** (older bundle rows ignored) |
| Source | existing `GET /api/cycle` CycleLog display bundle (`shapedLogs`) |

No extra N+1 query. No episode start bound (there is no episode).

User-facing subtitle: `ბოლო 30 დღის ჩანაწერები.`  
Not “this stage.” Not a prevalence denominator.

Civil dates: `toDateKey` / `addDays`. No UTC shift in copy.

---

## Query / read model

Attached on existing `GET /api/cycle` → `perimenopause.observationSummaries`.

Same write path: canonical CycleLog UPSERT. No second write path. No cache. Edits/deletes recompute on the next GET. Offline writes appear after sync.

```
{
  version: 'cycle-perimenopause-observation-summaries-v1',
  window: { from, to, recentDays: 30, queryCapDays: 90 },
  summaries: [{ key, family, summaryType, occurrenceCount, lastLoggedDate, recentDates, summaryArgs: { days }, severityCounts?, flowCounts? }],
  generatedAt
}
```

Unknown stored keys omitted. No raw observation JSON. No `windowDays` in `summaryArgs`.

---

## Missing-data semantics

Missing log ≠ negative. A day with sleep only is not “no hot flashes.”  
Counts are unique civil days where the key was **present**. Positive occurrences only. Explicit enum values such as `energy: high` are not low-energy. `false` / absent chips are not used as a prevalence denominator.

---

## Summary types

| Type | Use |
|---|---|
| `RECENT_OCCURRENCE` | Factual day count |
| `RECENT_SEVERITY_DISTRIBUTION` | Pain row that also has categorical severity counts |
| `RECENT_BLEEDING_OCCURRENCE` | Spotting / light / medium / heavy category counts |
| `RECENT_CATEGORY_DISTRIBUTION` | Poor sleep category count |

Not implemented: INCREASING, DECREASING, IMPROVING, WORSENING, scores, averages, charts.

`lastLoggedDate` is a field on every row. Expanded detail may list up to 8 recent dates.

---

## Registry

`perimenopauseSummaryEligible` on each observation. **Default false.** Independent of Phase 13 `trendEligible` and Phase 23 `pregnancyTrendEligible`. Future keys stay false until explicitly reviewed.

Eligible in V1:

- `flow` (spotting / light / medium / heavy)
- `hot_flashes`, `night_sweats`
- `sleepQuality` (poor only → `sleep.poor`)
- `energy` (low + very_low grouped as `energy.low`)
- `fatigue` (distinct from energy)
- `pain` (canonical `painEntries` types)
- `migraine` (symptom; not double-counted with `pain.headache`)
- `dizziness`, `swelling`
- `heartburn`, `bloating`, `constipation`, `diarrhea`
- moods `irritable`, `sad` only

Excluded: `vaginal_dryness`, sexual health, notes, OPK, BBT, mucus, pregnancy tests, discharge, `anxious` and other unreviewed moods, unknown keys, palpitations.

Threshold: 0–1 occurrence → no row. 2+ → factual count. No “often.”

Ranking (UI relevance, not triage): bleeding → hot flashes → night sweats → sleep/energy/fatigue → pain/migraine → other body → digestion → mood. No urgency / red warning labels.

Pain severity stays categorical (mild / moderate / severe). No numeric mean. Energy and sleep are not numeric-averaged. No symptom-burden / menopause index scores.

Collapsed UI: max 4 rows, then `მეტის ნახვა`.

---

## Copy

Safe: აღრიცხე, ბოლო ჩანაწერი, ბოლო 30 დღის ჩანაწერები.  
Forbidden: გახშირდა, გაუარესდა, გაუმჯობესდა, ჰორმონალური, მენოპაუზაზე მიუთითებს, პერიმენოპაუზისთვის დამახასიათებელია.

Empty: `შეჯამებები გამოჩნდება, როცა რამდენიმე ჩანაწერი დაგროვდება.`  
Pending GET is loading (existing Cycle bundle), not this empty copy.

---

## Privacy / AI / partner / doctor / notifications / analytics

Owner health data. Summaries are not added to AI prompts, partner payload, doctor summary (Phase 25 context unchanged), personal export, Notification Brain, or ProductEvent.

---

## Auth / loading / errors

Same `GET /api/cycle` gate. If the bundle fails, existing error semantics. Do not render loading as empty. Cross-user: Cycle auth lifecycle unchanged.

---

## Phase 29 — exposure-aware rates

Expanded Journal rows may show an optional `exposure` rate when field-specific `assessedDays` and coverage thresholds pass. Collapsed Journal stays the occurrence sentence. See `docs/CYCLE_OBSERVATION_EXPOSURE_RATES_CONTRACT.md`.

## Phase 30 — two-window exposure comparison

Expanded Journal rows may also show an optional two-window `comparison` (earlier vs more recent 14 civil days) when both windows independently qualify. Copy is earlier / more recent assessed period — not perimenopause progression. See `docs/CYCLE_OBSERVATION_EXPOSURE_COMPARISON_CONTRACT.md`.

iOS QA is deferred by product decision.
