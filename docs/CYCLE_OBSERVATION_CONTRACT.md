# Cycle observation contract

**Status:** Phase 11 tracking foundation **deployed** on target Neon. Phase 12 Android native QA complete. Not a Cycle product-final.  
**Date:** 2026-09-09  
**App version:** mobile `39.0.26`  
**Engine / safety / UI / prediction-history remain frozen** except where this document names an additive observation layer.

Cycle stays a calendar tracker. Structured observations are user-logged facts. They are not diagnoses, not confirmed ovulation, and not pregnancy confirmation.

---

## 1. Architecture

**Chosen: Option C hybrid.**

- High-frequency canonical fields stay on `CycleLog` columns: `flow`, `symptoms`, `moods`, `painEntries`, `sleepQuality`, `stressLevel`, `exerciseLevel`, `caffeine`, `alcohol`, `sexualActivity`, `libido`, `bbt`, `cervicalMucus`, `ovulationTest`, `pregnancyTest`, `notes`, `customTagIds`.
- Extensible typed keys live in `CycleLog.observations` JSON, validated by the registry. Phase 11 writable extra: `energy`.
- There is **no** generic EAV `CycleObservation` table. Daily identity is already `userId + date`. Bundle load stays one query. Offline stays one `PUT /logs/:date`.

Why not a separate table: current cardinality is one value per key per day (pain is a small typed array on the same row). An EAV table would add joins, wipe paths, and N+1 risk without a many-measurements requirement. Future many-cardinality (repeat BBT) can add a table later without rewriting this contract.

`observationSchemaVersion` is `1`.

Code: `server/src/lib/cycleObservationRegistry.js`.

---

## 2. Registry

Every observation type has:

| Field | Meaning |
|---|---|
| `category` | menstrual / physical / pain / mood / energy / sleep / digestion / skin / headache / discharge / fertility_observation / sexual_health / pregnancy_test / medication_contraception / lifestyle / free_text / custom_tag |
| `key` | canonical id |
| `valueType` | BOOLEAN / ENUM / SEVERITY / NUMBER / MEASUREMENT / TEXT |
| `allowedValues` | enum members, or null |
| `storage` | column / symptoms / moods / painEntries / observations / profile / customTagIds |
| `cardinality` | `one` / `set` / `multi` |
| `sensitivity` | HEALTH / SENSITIVE / HIGHLY_SENSITIVE |
| `aiDefaultAllowed` | explicit |
| `partnerDefaultAllowed` | explicit |
| `analyticsAllowed` | in-app journal counts only — never ProductEvent raw values |
| `trendEligible` | future trend charts |
| `engineRole` | `engine_input` or `presentation_only` |
| `modeVisibility` | conceptual product modes |
| `uiGroup` | Quick Log More Tracking group |
| `enabled` | writes rejected when false |
| `assessmentEligible` | Phase 28 explicit present/absent coverage. **Default false.** See `docs/CYCLE_OBSERVATION_ASSESSMENT_CONTRACT.md`. |

Unknown keys: **400 on write**. On read, AI/partner serializers exclude them. Owner bundle may still contain legacy unknown `symptoms[]` chips until the next validated write.

New types default **AI = DENY**, **partner = DENY**.

---

## 3. Value types and cardinality

| Type | Use |
|---|---|
| BOOLEAN | presence chip in `symptoms[]` / `moods[]` |
| ENUM | energy, sleep, mucus, tests, flow |
| SEVERITY | pain `mild` / `moderate` / `severe` |
| NUMBER | libido 1–5 |
| MEASUREMENT | BBT °C, one per civil date |
| TEXT | notes, custom tag names |

Cardinality:

- `flow`, `energy`, `sleepQuality`, `stressLevel`, lifestyle enums, BBT, OPK, mucus, pregnancy test, notes: **one per date**, last write wins.
- `symptoms[]` / `moods[]`: set of known keys.
- `painEntries`: up to 7 types, one severity per type.
- Future repeat BBT is **not** implemented. Registry keeps BBT as `one`.

Source may be `manual` now. HealthKit / Health Connect are not implemented in this phase.

---

## 4. Engine input boundary

**Engine input today: `flow` only** (bleed segmentation, cycle length, confidence, late, derived LMP, fertile-window formula, ovulation estimate).

OPK, BBT, and mucus remain user-logged. They do **not** confirm ovulation and do not change engine dates. Existing TTC observation cards (copy only) are unchanged.

Every other observation is **presentation / trend only** until a future reviewed phase promotes it.

---

## 5. Privacy

| Class | Examples | AI | Partner | Analytics / ProductEvent |
|---|---|---|---|---|
| Existing wellness allowlist | cramps, bloating, moods, flow, pain, sleepQuality, stress | allow (pre-Phase-11) | partner symptoms scope: wellness/mood chips only | no raw ProductEvent |
| New Phase 11 | energy, oily_skin, night_sweats | DENY | DENY | DENY |
| Fertility tests | OPK, BBT, mucus, pregnancy test | keep **existing** Phase 2 USER_LOGGED allowlist | DENY | DENY |
| Sexual / notes / tags | sex chips, libido, pain_sex, notes, custom tags | DENY | DENY | DENY |

Unknown future keys stay excluded from AI and partner payloads.

---

## 6. Legacy compatibility

`symptoms[]` remains. Registry classifies every existing catalog key.

**No double counting:**

- Pain-managed chips (`cramps`, `headache`, `back_pain`, `breast_tenderness`, `pelvic_pain`, `ovulation_pain`) are hidden in symptom pickers (already).
- Writes strip those chips when the matching `painEntries` type exists.
- AI, doctor summary, and symptom pattern analytics skip a pain-managed chip when pain already covers it.
- Headache canonical form is **pain type**, not a second public chip.
- `discharge` (general) is not `cervicalMucus`.

Lazy / dual-read: originals stay in the row. No destructive rewrite.

---

## 7. Cross-module health data

Do not duplicate into CycleLog:

- steps, sleep **hours**, hydration, weight → `HealthMetricDaily` by civil date (already loaded as `dailyMetrics` in the bundle).
- Cycle stores subjective `sleepQuality` only.

---

## 8. API

Still `PUT /api/cycle/logs/:date`.

Optional body fields: existing columns plus:

```json
{ "energy": "low", "observations": { "energy": "low" } }
```

`energy` is a convenience alias for `observations.energy`. Merge is per-key. `null` clears. Server validates known key, type, enum, date, cardinality. Client is not trusted.

No per-field endpoints. No per-chip sockets. Cycle updates do not emit noisy socket traffic.

Offline: same UPSERT_LOG payload. Last-write / existing queue rules. Empty `energy: null` does not by itself turn Start Period into a log upsert.

---

## 9. Deletion and indexes

Observations live on `CycleLog`. Cycle wipe / account delete already deletes those rows. No extra table indexes. Access pattern remains `userId + date`.

Display bundle: latest 400 full rows. Engine query stays `date + flow` for 5 years. Do not put years of observation history into Overview beyond the display window.

---

## 10. UI

Quick Log keeps flow / pain / mood / common symptoms.

**მეტის აღრიცხვა** (progressive disclosure): სხეული, ენერგია, განწყობა, მონელება, კანი, ნაყოფიერების ნიშნები, პირადი.

Recent shortcuts: keys logged on ≥2 days, no sensitive fertility/sex chips.

Day Details groups logged facts. Predicted facts stay separate.

Journal: no new trend charts this phase. Historical day summaries remain readable.

Favorites: not added.

---

## 11. Future-mode use

See `docs/CYCLE_MODES_ARCHITECTURE.md`, `docs/CYCLE_TTC_CONTRACT.md`, `docs/CYCLE_PREGNANCY_CONTRACT.md`, and `docs/CYCLE_PERIMENOPAUSE_CONTRACT.md`. Live product modes: Cycle Tracking (`TRACK_PERIOD`), Trying to Conceive (`TRY_TO_CONCEIVE`), Pregnancy (`PREGNANCY`), Perimenopause (`PERIMENOPAUSE`).

Reserved, not writable: `missed_pill`.

---

## 12. Export

Personal JSON export includes observations and journal (user-owned).

Doctor summary keeps existing wellness / pain / user-logged fertility tests. It does not auto-include sexual health, notes, custom tags, or energy.

---

## 13. Deployment (Phase 12)

Target Neon **does not** have `_prisma_migrations`. Do not run `prisma migrate deploy` and do not fabricate migration history.

Executed 2026-09-09 against the pooled `DATABASE_URL`:

1. Stopped the API process that locked `query_engine-windows.dll.node`.
2. `npx prisma generate` — client includes `CycleLog.observations` (`Json`) and `CycleLog.observationSchemaVersion`.
3. Additive SQL via the same Phase 8 pattern:

```
npx prisma db execute --schema prisma/schema.prisma --file prisma/migrations/20260909140000_cycle_observation_registry/migration.sql
```

Verified on target:

- `observations` JSONB NOT NULL DEFAULT `'{}'::jsonb`
- `observationSchemaVersion` INTEGER NOT NULL DEFAULT `1`
- Existing 26 `CycleLog` rows remained; sample old rows readable with `observations = {}` and version `1`
- No other `CycleLog` columns dropped or rewritten

Unknown write keys return **400** (`უცნობი აღრიცხვა.`) and are not persisted. Unknown keys already stored in JSON are omitted from the owner-shaped bundle and dropped on the next validated write.

Synthetic QA: `cycle.qa.phase6@medicard.ge` / `CycleQaPhase6a` (`server/scripts/cycle-phase11-qa-seed.js`).

---

## 14. Phase 22 addendum — `heartburn`

Pregnancy presentation reuses canonical CycleLog fields. The only new registry key is `heartburn` (BOOLEAN, digestion group). Defaults: AI DENY, partner DENY, trend false, doctor summary EXCLUDE. See `docs/PREGNANCY_OBSERVATION_CONTRACT.md`. Do not treat this as a rewrite of Phase 11.

## 15. Phase 23 addendum — `pregnancyTrendEligible`

Additive registry flag. Default **false**. Independent of Phase 13 `trendEligible`. Reviewed Pregnancy Journal summaries may set it true. See `docs/PREGNANCY_OBSERVATION_TRENDS_CONTRACT.md`. `heartburn` stays Phase 13 `trendEligible: false` and is Pregnancy-trend eligible.

## 16. Phase 24 addendum — Perimenopause tracking (no new keys)

Phase 24 reuses existing registry keys. No additive keys.

- `hot_flashes` — PHYSICAL; existing AI allowlist unchanged
- `night_sweats` — PHYSICAL; AI DENY (unchanged)
- `vaginal_dryness` — SEXUAL_HEALTH, SENSITIVE, PRIVATE; AI/partner/analytics DENY; doctor opt-in; excluded from Perimenopause Overview recents

Palpitations and a dedicated brain-fog key are deferred. See `docs/CYCLE_PERIMENOPAUSE_CONTRACT.md`.

## 17. Phase 26 addendum — `perimenopauseSummaryEligible`

Additive registry flag. Default **false**. Independent of Phase 13 `trendEligible` and Phase 23 `pregnancyTrendEligible`. Reviewed Perimenopause Journal summaries may set it true. `vaginal_dryness` stays false. See `docs/PERIMENOPAUSE_OBSERVATION_SUMMARIES_CONTRACT.md`.

## 18. Phase 28 addendum — `assessmentEligible` + `observationAssessments`

Additive sibling JSON `CycleLog.observationAssessments` (explicit ABSENT coverage only). Registry flag `assessmentEligible` defaults **false**. V1 keys: `nausea`, `vomiting`, `fatigue`, `hot_flashes`, `night_sweats`. Missing remains UNKNOWN. See `docs/CYCLE_OBSERVATION_ASSESSMENT_CONTRACT.md`.

## 19. Phase 29 addendum — `exposureRateEligible`

Registry flag `exposureRateEligible` defaults **false** and also requires `assessmentEligible`. Optional `exposure` on Phase 23/26 occurrence rows. Denominator is field-specific `assessedDays`. See `docs/CYCLE_OBSERVATION_EXPOSURE_RATES_CONTRACT.md`.

## 20. Phase 30 addendum — `exposureComparisonEligible`

Registry flag `exposureComparisonEligible` defaults **false** and also requires `assessmentEligible` and `exposureRateEligible`. Optional two-window `comparison` on occurrence rows. See `docs/CYCLE_OBSERVATION_EXPOSURE_COMPARISON_CONTRACT.md`.


