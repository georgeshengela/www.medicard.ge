# Pregnancy observation & body-changes experience — Phase 22 contract

**Status:** implementation contract for Cycle Phase 22. Phases 1–21 remain FINAL-FROZEN.  
**Date:** 2026-09-10  
**App version:** mobile `45.0.0`

Observation-first Pregnancy logging. Not diagnosis. Not a triage engine. No OpenRouter / Medi interpretation.

---

## Scope

When `mode = PREGNANCY` and an ACTIVE episode exists, the owner can:

- record pregnancy-relevant observations on canonical `CycleLog`
- review what they logged, in the current episode window only
- see those facts on Quick Log, More Tracking, Day Details, Journal, and Overview

Missing log is a logging state. It is not “symptom absent”.

---

## Non-goals

- “this is normal / abnormal”
- preeclampsia, miscarriage, gestational diabetes, anemia, UTI, or any inference
- red-flag / urgency / risk meter
- OpenRouter, Medi, LLM symptom analysis
- pregnancy-specific trend conclusions (“nausea increasing”, “more common in trimester 2”)
- symptom overlays on Phase 19 baby-size or Phase 21 timeline
- a `PregnancyLog` table
- Notification Brain symptom pushes
- analytics of raw symptom keys / severity / bleeding
- iOS QA (deferred by product decision)

---

## Canonical fields (reused)

Storage remains `CycleLog`. Mode changes presentation.

| Concept | Canonical field | Action |
|---|---|---|
| Bleeding / spotting | `flow` (`spotting` / `light` / `medium` / `heavy`) | reuse |
| Pain | `painEntries` | reuse; Pregnancy Quick Log prioritizes cramps, pelvic, lower_back, headache, breast |
| Nausea / vomiting / bloating / constipation / diarrhea | `symptoms[]` | reuse / expose |
| Fatigue | `symptoms.fatigue` | reuse; distinct from energy |
| Energy | `observations.energy` | expose |
| Sleep quality | `sleepQuality` | reuse; not HealthMetricDaily hours |
| Stress | `stressLevel` | expose |
| Dizziness / migraine / swelling / short_breath / frequent_urination / leg_cramps | existing chips | expose |
| Discharge | `symptoms.discharge` | body observation; not cervical mucus; not Overview |
| Cervical mucus / OPK / BBT | existing columns | not promoted in Pregnancy UI |
| Sexual health / notes | existing private fields | private; not Overview |

Do **not** create `pregnancyNausea`, `pregnancyFatigue`, or `pregnancyCramps`.

Headache = pain type. Migraine = separate symptom. Legacy pain-managed chips are stripped when `painEntries` covers them.

---

## New field

| Key | Type | Why |
|---|---|---|
| `heartburn` | BOOLEAN chip in `symptoms[]` | No canonical reflux field existed |

Not added: swelling severity enum (boolean `swelling` already exists), nasal congestion, frequent-urination duplicate, shortness-of-breath duplicate.

### `heartburn` policy (until a later reviewed phase)

| Policy | Value |
|---|---|
| Clinical neutrality | User-logged presence only. No medication advice. |
| Data type | BOOLEAN |
| Sensitivity | HEALTH |
| AI | DENY |
| Partner | DENY |
| Analytics | DENY |
| Trend | FALSE |
| Doctor summary | EXCLUDE |
| Engine | presentation only |

Write validation is the existing registry: unknown keys → 400.

---

## Episode scoping

Current Pregnancy observation UI uses the **ACTIVE episode** civil interval:

- lower bound = civil day of `episode.startedAt` (not LMP / `referenceDate`)
- upper bound = today (ACTIVE) or `endedAt` civil day (ENDED)
- recent presentation cap = **90** days
- GET log query = `max(startedAt civil, today − 279)`

Do not infer pregnancy onset from symptoms. Do not tag every `CycleLog` with `pregnancyEpisodeId`.

A new episode must not mix previous-episode nausea/spotting into the current Pregnancy section.

When the episode ends, Pregnancy presentation disappears with the mode. Rows are not deleted.

---

## Read model

`GET /api/cycle/pregnancy` adds:

- `recentObservations` — normalized days, newest first, approved keys only
- `todayObservations` — same shape, **no** intimate/private fields
- `observationRange`

Shape:

```
{
  date,
  spotting,
  bleeding?,
  pain: [{ type, severity }],
  symptoms: [...],
  wellness: { energy?, sleepQuality?, stressLevel? }
}
```

Unknown stored keys are omitted. No raw `observations` JSON. No pregnancy test, BBT, OPK, mucus, notes, or sexual chips in this object.

Write path is unchanged: `PUT /api/cycle/logs/:date` + existing offline UPSERT queue.

---

## UI

**Quick Log (Pregnancy):** Bleeding / spotting → Pain → Nausea / digestion → Energy / fatigue (energy enum kept distinct) → Common body changes → More Tracking. Sheet hint is `აღრიცხეთ ლაქები, ტკივილი ან სხეულის ცვლილებები` — not period-start language.

Pregnancy test is not a daily shortcut (remains in More Tracking). OPK / BBT / mucus are not shown.

**Day Details:** BLEEDING / SPOTTING, PAIN, BODY CHANGES, WELLNESS, PRIVATE NOTES. Logged facts only. Historical TTC fields appear only if logged that day.

**Overview `დღეს აღრიცხული`:** compact approved facts. Empty copy: `დღეს ჯერ არაფერია აღრიცხული.` Never “no nausea”.

**Journal `ორსულობის ჩანაწერები`:** chronological compact timeline of current-episode observations.

**Trends:** Phase 13 stays generic. Period-association summaries are not emphasized in Pregnancy Journal.

Timeline and baby-size stay educational. No personal symptom merge.

---

## Copy

Use logged / recorded / you noted. Avoid caused, means, indicates, normal, abnormal, concerning, expected.

Spotting copy is `ლაქები აღირიცხა`, not implantation bleeding.

Selected chips use fill + outline + checkmark, not color-only.

---

## Privacy / AI / partner / doctor summary / analytics / notifications

Owner health data. No automatic partner or AI share.

AI contract unchanged. Partner payload unchanged. Doctor-summary inclusion stays registry-driven; `heartburn` is EXCLUDE. Existing INCLUDE keys (nausea, pain, energy, …) keep prior behavior.

No ProductEvent of raw symptom values. No symptom-driven Notification Brain candidate.

Personal export still includes owner `CycleLog` rows.

---

## Missing data

A day without a log is not “no symptoms”. Overview / Journal empty copy is a logging-state statement only.

Phase 28 adds optional explicit assessment for `nausea`, `vomiting`, and `fatigue`. That is not a Phase 23 percentage. See `docs/CYCLE_OBSERVATION_ASSESSMENT_CONTRACT.md`.


---

## Future medical interpretation boundary

A later medically reviewed phase may add triage, red-flag copy, or denominator-safe pregnancy trends. Phase 22 must not be extended into that work by presentation convenience.
