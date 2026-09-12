# Cycle Postpartum doctor-summary context — Phase 39

**Status:** Additive current-tracking context on the existing Cycle doctor summary. Not a Cycle product-final.  
**Date:** 2026-09-11  
**App version:** mobile `62.0.0`  
**Endpoint:** existing `GET /api/cycle/doctor-summary` (no new document type)  
**Frozen:** Phases 1–38, including Phase 38 AI fail-closed (POSTPARTUM omitted from Cycle AI; general Medi remains without Cycle context).

This is current tracking context at document generation time. It is not obstetric history, not a pregnancy outcome, not a recovery score, and not a diagnosis.

---

## 1. When present

`postpartumContext` is included **by default** when **both** hold:

1. Current `CycleProfile.mode === POSTPARTUM`
2. There is a current **ACTIVE** `CyclePostpartumEpisode`

Otherwise `postpartumContext` is `null`.

TRACK, TTC, PREGNANCY, and PERIMENOPAUSE never get this header. An ended postpartum episode is never attached as current context. Re-entry uses the new ACTIVE episode only.

If mode is POSTPARTUM but no ACTIVE episode exists (corrupt/inconsistent state): **fail closed** (`null`). The builder may log `[cycle-doctor-summary] postpartum_context_invariant mode_without_active_episode` with **no PHI**. Do not fabricate an episode.

---

## 2. Payload (language-neutral)

```
postpartumContext: null | {
  current: true,
  trackingMode: 'POSTPARTUM',
  referenceDate: 'YYYY-MM-DD' | null,
  elapsed: { week, day } | null
}
```

Server values: mode enum, civil date, week/day numbers. No Georgian (or any) UI strings in the JSON.

`referenceDate` is the owner-entered postpartum reference only. If the owner did not enter one: `null`. Do not infer it from:

- `CyclePregnancyEpisode.endedAt`
- postpartum episode `startedAt` / `endedAt`
- due date
- AI
- delivery / birth fields (none exist in Phase 38)

If a valid owner reference exists, `elapsed` is `{ week, day }` from canonical `postpartumElapsed(referenceDate, today)` in `cyclePostpartum.js`. Doctor-summary does not recompute elapsed. Compact contract omits `days` even though the helper also returns it.

If no valid reference: `elapsed: null`. Do not show 0 weeks as a stand-in for missing data.

---

## 3. Current-context vs report range

The header is a **generation-time snapshot**. It does not mean every row in the selected `from`/`to` range was logged in POSTPARTUM. Renderer copy states this (same distinction as Phase 25).

PDF is a snapshot. No mutable linkage after mode changes.

---

## 4. Mutually exclusive current-mode contexts

At generation time only the current mode-specific context is non-null:

| Mode | pregnancyContext | perimenopauseContext | postpartumContext |
|---|---|---|---|
| POSTPARTUM + ACTIVE episode | null | null | populated |
| PREGNANCY + ACTIVE episode | Phase 20 unchanged | null | null |
| PERIMENOPAUSE | null | Phase 25 unchanged | null |
| TRACK / TTC | null | null | null |

---

## 5. Copy (renderer-owned)

Clinician labels live in `mobile/src/i18n/cycle/doctorSummary.js` (KA / EN / FR / RU). Renderer never prints raw `POSTPARTUM`, `trackingContext`, or episode ids.

| Key | KA | EN | FR | RU |
|---|---|---|---|---|
| Title | მშობიარობის შემდგომი აღრიცხვის კონტექსტი | Current postpartum tracking context | Contexte actuel de suivi post-partum | Текущий контекст послеродового отслеживания |
| Mode value | მშობიარობის შემდგომი თვალყური | Postpartum tracking | Suivi post-partum | Послеродовое отслеживание |
| Reference | პაციენტის მითითებული საწყისი თარიღი | Reference date entered by the patient | Date de référence saisie par la patiente | Дата отсчёта, указанная пациенткой |
| Missing | არ არის მითითებული | Not provided | Non renseignée | Не указана |
| Elapsed | მითითებული თარიღიდან გასული დრო | Time since entered reference date | Temps écoulé depuis la date de référence saisie | Время с указанной даты отсчёта |

Elapsed display reuses existing week/day formatters (`3 weeks + 2 days`). This is time since the owner-entered reference — not “postpartum age”, not recovery.

**Forbidden wording:** delivery date, birth date, days since birth, date d'accouchement, дата родов, დაბადების თარიღი, lochia (unless an existing log already carries that semantic — Phase 38 does not), recovery %, healing complete/incomplete, return of fertility.

---

## 6. PDF order

Preserve frozen Phase 14/20/25 structure:

Title → reporting range → generated date → **current pregnancy / peri / postpartum context** → menstrual facts → observation facts → disclaimers.

Postpartum sits in the same current-context slot as pregnancy and peri (only one is non-null). Extra disclaimer: user-selected tracking mode; not a recovery diagnosis; does not record a pregnancy outcome.

---

## 7. Firewalls

Phase 39 must not add: `liveBirth`, `birthDate`, `deliveryDate`, `deliveryType`, `vaginalBirth`, `cSection`, `miscarriage`, `stillbirth`, `abortion`, `ectopic`, `neonatalOutcome`, `infantStatus`, recovery score/stage, fertility-return prediction, prenatal planner (`plannedPlace` / `plannedTime` / reminder config / Calendar ownership), episode `id` / `startedAt` / `endedAt`, engine `trackingContext`.

Bleeding in the selected window may still appear under frozen doctor-summary allowlists as factual Cycle logs. Do not relabel it as lochia, period, or hemorrhage.

| Channel | Phase 39 |
|---|---|
| Partner | Unchanged. Leak keys include `postpartumContext`. No partner access to doctor summary. |
| Medi / OpenRouter | **Unchanged Phase 38 fail-closed.** Doctor context does not enable Cycle AI for POSTPARTUM. |
| Personal export | Unchanged. Export is not this document. |
| Notification Brain | Unchanged. |
| Analytics | No `referenceDate` / elapsed / mode-specific doctor context on ProductEvent. |
| Prenatal planner | Not in postpartum context. |
| Schema | No new model / migration. |

Owner-only. Same Phase 14 authorization. Document-scoped locale (Phase 15) affects rendering only.

---

## 8. Artifacts

`qa/cycle-phase39-postpartum-doctor/`

iOS native QA deferred by product decision.
