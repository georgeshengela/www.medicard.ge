# Cycle doctor-summary observation contract — Phase 14

**Status:** Clinician-facing Cycle observation inclusion (Android). Not a Cycle product-final.  
**Date:** 2026-09-09  
**App version:** mobile `39.0.29` (Phase 15 clinician locale rendering). Inclusion contract frozen in Phase 14 (`39.0.28`).  
**Frozen:** engine, segmentation, forecast, confidence, late, prediction-history, observation registry writes, observation trends, AI allowlist, partner allowlist, Notification Brain, Quick Log / More Tracking, Journal trends.

This is a factual export. It is not diagnosis, not AI, and not a forecast input.

---

## 1. Purpose

Help a clinician review menstrual history, bleeding, pain, selected physical symptoms, and selected wellness logs.

Doctor-summary inclusion does **not** authorize partner sharing or EvidenceMD/OpenRouter inclusion.

---

## 2. Four serializers (kept separate)

| Purpose | Builder | Endpoint |
|---|---|---|
| **A. Doctor summary** | `buildCycleDoctorSummaryData` | `GET /api/cycle/doctor-summary` + Overview `summary` (default-deny) |
| **B. Personal export** | `buildCycleExportPayload` | `GET /api/cycle/export` |
| **C. Partner share** | `buildPartnerPayload` | share peek |
| **D. AI / EvidenceMD** | `buildCycleAiUserPrompt` | insights / chat |

Owner-bundle `GET /api/cycle` still attaches a default-deny `summary` so the frozen Journal stats band can read `cycleCount` / shortest / longest from logged gaps. Those aliases are not predictions and are not PDF sections.

PDF is generated on-device from the structured doctor-summary payload (`cycleReport.ts` + `expo-print`). There is no server PDF.

---

## 3. Registry metadata

`doctorSummary` on each observation key:

`EXCLUDE` · `INCLUDE` · `INCLUDE_IF_NONEMPTY` · `INCLUDE_WITH_REDACTION` · `REQUIRES_EXPLICIT_USER_OPT_IN`

**Default for new keys: `EXCLUDE`.** Unknown stored keys never appear.

---

## 4. Inclusion matrix (Phase 14)

**INCLUDE**

- flow / logged period ranges
- pain (`painEntries`, canonical; legacy pain chips count once)
- migraine (distinct from headache)
- fatigue, dizziness, hot_flashes
- bloating, nausea, vomiting, constipation, diarrhea
- acne, hair_loss
- energy (categorical only)
- sleepQuality (subjective Cycle log, labeled as such — not HealthMetricDaily hours)
- stressLevel (category only)
- discharge (not cervical mucus)

**INCLUDE_IF_NONEMPTY**

- contraceptionMethod (self-reported profile)

**REQUIRES_EXPLICIT_USER_OPT_IN** (document-scoped, default off)

- OPK, BBT, cervical mucus, pregnancy test
- sexual activity, libido, sexual-health chips, pain during sex
- private notes

**EXCLUDE**

- moods (all chips)
- gas, appetite, cravings
- oily / dry / itchy skin
- custom tags
- missed pill (not writable)
- Journal observation trends
- prediction-history accuracy / first-vs-final
- exercise, caffeine, alcohol
- medications module (lives elsewhere)

---

## 5. Time window

Default: last **180** civil days. Optional `from` / `to` query params. Hard cap **366** days.

Personal export window is unchanged.

---

## 6. Menstrual facts

Logged `periodRanges` only (`source: 'logged'`). Predicted ranges never count.

Spotting is listed separately and is not a period day.

Cycle lengths: gaps 18–45 days between actual period starts. Neutral list: `27, 35, 29`. No “irregular” diagnosis label.

Flow per episode: consecutive distinct logged bleed levels (`light → medium`). No numeric average-flow score.

---

## 7. Predictions

Not included as clinical history. App estimates may appear on the same screen in a separate card labeled as estimates. PDF does not include next period / ovulation / fertile window.

---

## 8. Missing data

A day without a log is not “symptom absent”. Empty sections are omitted. Never “No cramps”.

---

## 9. Sensitive consent

Toggles on the doctor-summary screen. Unchecked by default. Apply only to **this generated document**. They do not change partner scopes, AI allowlists, or future exports.

No single “include everything” switch.

---

## 10. Localization (Phase 15)

Supported locales: **ka, en, fr, ru**.

**Locale source:** the app has no global language setting (Quest copy currently hardcodes `ka`). Doctor summary uses a **document-scoped** KA/EN/FR/RU control on `/cycle/summary`. It defaults to `ka`, does not persist, and does not change app language or sensitive toggles.

**Renderer:** `buildCycleReportHtmlFromSummary(summary, locale)` in `cycleDoctorSummaryI18n.js`. One HTML builder. Catalog: `mobile/src/i18n/cycle/doctorSummary.js` (same pattern as Quest catalogs).

**Fallback:** unknown locale → `ka`. Missing enum label → row omitted (never a raw key). Missing string in production would fall back to `ka`; tests fail if a required key is absent.

**Dates:** civil `YYYY-MM-DD` only. Georgian uses the existing month table. EN/FR/RU use `Intl` with `timeZone: 'UTC'` at noon UTC so Brussels DST cannot shift the day. `generatedAt` is rendered from its `YYYY-MM-DD` prefix, never via local timezone conversion.

**Pluralization:** EN/FR 1 vs n; RU день/дня/дней and цикл/цикла/циклов; KA `დღე`.

**Parity:** the same structured payload renders in all four languages. Localization does not change inclusion.

**PDF:** one HTML builder. Table cells wrap. Existing app font stack (no new files): Noto Sans / Segoe UI cover Latin, French diacritics, and Cyrillic; Noto Sans Georgian for KA. Non-ka `/cycle/summary` titles drop the Georgian display font.

App version at Phase 15 freeze: `39.0.29`. Details: `docs/CYCLE_DOCTOR_SUMMARY_I18N.md`.

---

## 11. Disclaimer

`history_not_diagnosis` plus existing `reportDisclaimer`. When `pregnancyContext` is present, the renderer adds one extra localized sentence: pregnancy timing is estimated from the user-selected reference date.

---

## 12. Firewalls

Doctor-summary allowlist does not extend AI or partner. Personal GDPR export still contains user-owned fields the doctor summary omits. Observation trends are not copied into the PDF.

---

## 13. Pregnancy tracking context (Phase 20)

**Status:** additive clinician header. Not a diagnosis. Not obstetric-history export. App version `43.0.0`.

`pregnancyContext` is included **by default** on a Cycle doctor summary when all of the following hold:

1. Profile mode is `PREGNANCY` (user-selected tracking mode)
2. There is a valid **ACTIVE** `CyclePregnancyEpisode`
3. Dating is consumed from `presentPregnancyDating` (Phase 18). Doctor summary, PDF, and mobile do not recompute week/day/due date.

Otherwise `pregnancyContext` is `null`. TRACK_PERIOD and TRY_TO_CONCEIVE never get the header. A positive pregnancy test alone does not create it.

**Current-context semantics.** The header is a generation-time snapshot of the **current** tracking context. It is not a fact that occurred inside `from`/`to`. The clinician label is “Current pregnancy tracking context”. Do not imply it belongs historically to every row in the selected range. Historical ENDED episodes are out of scope.

**Payload (language-neutral):**

```
pregnancyContext: null | {
  current: true,
  trackingMode: 'PREGNANCY',
  referenceDate: 'YYYY-MM-DD' | null,
  referenceType: 'LMP' | 'USER_SELECTED' | null,
  reviewRequired: boolean,
  estimatedGestationalAge: { week, day } | null,
  estimatedDueDate: { date, estimated: true } | null
}
```

Unknown `referenceType` is stored as `null` (never a raw key). Renderer uses the generic “user-selected reference” label and keeps a safe civil date when present.

**Review-required / invalid dating.** If Phase 18 returns `reviewRequired` (or invalid dating): omit `estimatedGestationalAge` and `estimatedDueDate`. Keep tracking mode + reference date + review flag. Do not show a stale week or due date.

**Copy rules.** Mode is “Pregnancy tracking mode”, never “Pregnant” / “Confirmed pregnancy”. Gestational age is **estimated** from the selected reference. Due date is **estimated due date**, never unqualified “Due date”. No fruit, object comparison, `weekDevelopment`, `comparisonKey`, length/weight, development facts, or baby-size images. No viability, miscarriage, ectopic, fetal-growth, or high-risk language. No OpenRouter / Medi pregnancy interpretation.

**Range interaction.** Menstrual history in the selected window remains. Mode does not delete prior periods. Future period predictions stay out of the PDF. Late-period status is not added to this header.

**Privacy.** This header is default clinician context for a report generated while the user is in Pregnancy mode, because it changes interpretation of menstrual data. It is **not** a consent widening for fertility, sexual, or notes. Those remain document-scoped opt-in, default off. Config UI shows an always-included row (“Pregnancy tracking context”), not a new privacy switch.

**Partner / AI / personal export / engine / Notification Brain:** unchanged. Do not add `pregnancyContext`, week, due date, or reference date to partner or Medi/EvidenceMD/OpenRouter. Personal export already includes pregnancy episodes from Phase 18. Forecast dating helpers are not copied; doctor summary calls `presentPregnancyDating`. No ProductEvent for mode/week/due date. No schema change.

**PDF order:** title → date range → generated on → **pregnancy context** → menstrual history → contraception → pain → symptoms → wellness → optional fertility/private → disclaimers.

---

## 14. Perimenopause tracking context (Phase 25)

**Status:** additive clinician header. Not a diagnosis. App version `48.0.0`.

`perimenopauseContext` is included **by default** on a Cycle doctor summary when:

1. Profile mode is `PERIMENOPAUSE` (explicit user-selected tracking mode)

Otherwise `perimenopauseContext` is `null`. TRACK_PERIOD, TRY_TO_CONCEIVE, and PREGNANCY never get this header. Age, hot flashes, night sweats, dryness, labs, notes, AI, or cycle variability alone never create it.

**Current-context semantics.** Generation-time snapshot of the **current** tracking context. It is not a fact that occurred inside `from`/`to`. The clinician label is “Current tracking context”. Do not imply the selected report range happened while this mode was active. Do not tag historical bleeding rows as perimenopausal. No mode history.

**Payload (language-neutral):**

```
perimenopauseContext: null | {
  current: true,
  trackingMode: 'PERIMENOPAUSE',
  userSelected: true,
  variability: null | {
    intervalCount,
    shortestDays,
    longestDays,
    sourceWindow: 'last_6_completed_intervals'
  }
}
```

**Variability.** Optional. Reuses Phase 24 `completedCycleIntervals` + `buildVariabilitySummary` (last 6 completed intervals; later start within 12 months; skip gaps `<1` or `>365`). Included only when `intervalCount >= 2`. Otherwise omit the row. No irregularity score, no “getting longer”, no 28-day fallback. Renderer does not recompute intervals.

**Copy rules.** “Perimenopause tracking mode selected by user” (locale equivalent). Never “patient is perimenopausal”, “confirmed menopause”, or “diagnosed perimenopause”. Renderer never prints the raw `PERIMENOPAUSE` enum.

**Excluded from this header:** next-period forecast, late period, fertile window / ovulation, hot flashes, night sweats, last bleeding (already in menstrual history), vaginal dryness.

**Privacy.** Included as current contextual metadata because the user generates a Cycle doctor report and the selected mode changes how Cycle interprets predictions. It is **not** a consent widening. Fertility / sexual / notes stay document-scoped opt-in, default off. Observation allowlists unchanged. Config UI shows an always-included row, not a new privacy switch. Do not add this mode label anywhere except this generated doctor document.

**Partner / AI / personal export / engine / Notification Brain / analytics / Phase 24 product UI:** unchanged. No schema change. Same `GET /api/cycle/doctor-summary`.

**PDF order:** title → date range → generated on → **perimenopause context** (or pregnancy context when in Pregnancy mode) → menstrual history → …

Pregnancy Phase 20 payload and PDF semantics are unchanged.

---

## 15. Future

Do not add luteal interpretation, scores, TTC header, menopause confirmation, ended-episode obstetric history, or perimenopause/pregnancy diagnosis. Optional fertility/sexual/notes remain opt-in.

---

## 16. Postpartum tracking context (Phase 39)

**Status:** additive clinician header. Current tracking context only. Not a pregnancy outcome. Not a recovery diagnosis. App version `62.0.0`.

See `docs/CYCLE_POSTPARTUM_DOCTOR_SUMMARY_CONTRACT.md`.

`postpartumContext` is included **by default** when mode is `POSTPARTUM` **and** an ACTIVE `CyclePostpartumEpisode` exists. Otherwise `null`. TRACK / TTC / PREGNANCY / PERIMENOPAUSE never get it. Ended episodes are not current context.

**Payload (language-neutral):**

```
postpartumContext: null | {
  current: true,
  trackingMode: 'POSTPARTUM',
  referenceDate: 'YYYY-MM-DD' | null,
  elapsed: { week, day } | null
}
```

Reference is owner-entered only. Elapsed comes from `postpartumElapsed`. Do not use pregnancy `endedAt` or postpartum `startedAt` as the reference. No episode id, `startedAt`/`endedAt`, `trackingContext`, planner fields, or outcome fields.

**Partner / AI / personal export / engine / Notification Brain / analytics:** unchanged. Phase 38 AI fail-closed remains. Same `GET /api/cycle/doctor-summary`. No schema change.

Pregnancy Phase 20 and Perimenopause Phase 25 payloads stay unchanged.


