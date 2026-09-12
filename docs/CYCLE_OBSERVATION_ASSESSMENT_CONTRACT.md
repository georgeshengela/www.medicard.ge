# Cycle observation assessment & exposure foundation — Phase 28

**Status:** implementation contract. Phases 1–27 remain FINAL-FROZEN.  
**Date:** 2026-09-10  
**App version:** mobile `51.0.0`

Canonical three-state observation assessment. Denominator infrastructure only. Not diagnosis. Not a longitudinal trend product. No OpenRouter / Medi.

---

## 1. Three-state semantics

For an **assessment-eligible** observation key, each civil day has exactly one of:

| State | Meaning |
|---|---|
| `UNKNOWN` | No explicit assessment and no positive canonical observation |
| `ABSENT` | User explicitly recorded that the observation was not present that day |
| `PRESENT` | Positive canonical observation (usually the key in `CycleLog.symptoms[]`) |

`UNKNOWN` is not `ABSENT`. Missing data is never reinterpreted as absent.

---

## 2. Positive log implies PRESENT

If the owner logs `hot_flashes` (or any eligible key) through Quick Log, More Tracking, or any other canonical CycleLog write, the resolver returns **PRESENT**.

Coverage metadata is not required for PRESENT.

Historical positive logs are PRESENT.

---

## 3. Absence requires explicit user action

Only an explicit “დღეს არ იყო” (or equivalent) write stores absence.

Never treat as ABSENT:

- no row
- chip not selected
- `undefined`
- historical `false` in `observations` JSON
- clearing a previously present chip

Removing a present answer returns **UNKNOWN**, not ABSENT.

---

## 4. UNKNOWN is the default

No assessment map entry + no positive observation → UNKNOWN.

Ignored days stay UNKNOWN. The daily assessment UI is optional. Partial answers are valid.

---

## 5. Storage

**Chosen: Option B — sibling JSON on CycleLog.**

```
CycleLog.observationAssessments Json @default("{}")
```

Additive column. Empty default. **No historical backfill. No new table.**

Stored shape records **explicit absences only**:

```json
{ "hot_flashes": "ABSENT", "vomiting": "ABSENT" }
```

PRESENT is derived from canonical `symptoms[]`. Do not duplicate PRESENT in this map.

Why not inside `observations`: that bag is typed observation *values* (`energy` enum). Mixing coverage flags there would collide with `parseObservationBag` and risk leaking through bag iteration.

Atomicity: `PUT /api/cycle/logs/:date` writes `symptoms` and `observationAssessments` in one Prisma upsert. No `/pregnancy/assessments` or `/perimenopause/exposure` endpoint.

---

## 6. Resolver (server-authoritative)

`resolveObservationAssessment(log, key)` → `{ state, source, conflict? }`

1. Ineligible key → UNKNOWN / `ineligible`
2. Positive canonical observation **and** ABSENT metadata → **PRESENT wins**, `conflict: true`, diagnostic warning
3. Positive observation → PRESENT / `positive_log`
4. `observationAssessments[key] === 'ABSENT'` → ABSENT / `explicit_assessment`
5. `observations[key] === false` (legacy) → UNKNOWN / `legacy_false`
6. Else → UNKNOWN / `legacy_unknown`

Writes strip ABSENT metadata whenever the same payload contains that key in `symptoms[]`, so the conflict should not persist.

Owner reads may attach a compact `dailyAssessments` map of non-UNKNOWN eligible states. Mobile editor restores from `symptoms` + `observationAssessments`. Mobile must not invent denominator math.

---

## 7. Registry

`assessmentEligible: spec.assessmentEligible === true` — **default false**.

V1 eligible keys:

| Surface | Keys |
|---|---|
| Pregnancy shortlist | `nausea`, `vomiting`, `fatigue` |
| Perimenopause shortlist | `hot_flashes`, `night_sweats`, `fatigue` |

`fatigue` is one canonical key. Shortlists differ by presentation capability, not storage.

Unknown or ineligible keys in `observationAssessments` → **400**.

---

## 8. Categorical / special fields (no assessment map)

| Field | Decision |
|---|---|
| `flow === 'none'` | Explicit bleeding coverage on the flow column. Do **not** duplicate via assessment metadata. Untouched flow remains UNKNOWN bleeding. |
| Pain types | Deferred. Type + severity is not a yes/no exposure set in V1. |
| `sleepQuality` | Logged enum = that day was answered. Missing = UNKNOWN. No boolean absent. |
| `energy` enum | Same. Logged enum = assessed. Missing = UNKNOWN. No absent state. |
| Private / notes / sexual | Excluded. |
| BBT, OPK, mucus, pregnancy test | Excluded. |

---

## 9. Field-specific exposure

Coverage is **per observation key**.

A hot-flash answer does not assess night sweats.

Internal helper `aggregateObservationExposure(logs, key, { dates })` returns:

`presentDays`, `absentDays`, `assessedDays` (= present + explicit absent), `unknownDays`, first/last assessed dates.

UNKNOWN days never enter the denominator.

Do **not** use `daysWithAnyLog`, `daysInPregnancy`, or `daysInPerimenopause` as a symptom denominator.

Example (not shown in UI): 4 present + 6 absent + 20 unknown → assessedDays = 10. Future eligible rate would be 4/10, never 4/30.

---

## 10. Phase 29 consumer — exposure-aware rates

Phase 29 attaches an optional `exposure` object on occurrence rows when `exposureRateEligible` and display thresholds pass. Denominator is field-specific `assessedDays`. Collapsed Journal stays the Phase 23/26 occurrence sentence. See `docs/CYCLE_OBSERVATION_EXPOSURE_RATES_CONTRACT.md`.

Phase 28 itself does **not** implement increasing / decreasing / improving / worsening / more frequent.

Phase 30 attaches an optional `comparison` object when both non-overlapping 14-day windows pass field-specific assessed-day thresholds. Collapsed Journal stays the Phase 23/26 occurrence sentence. Phase 29 single-window rates stay. See `docs/CYCLE_OBSERVATION_EXPOSURE_COMPARISON_CONTRACT.md`.

Phase 31 attaches additive `explainability` reason metadata so the Journal can explain why a rate, comparison, or direction is or is not shown. No coaching. See `docs/CYCLE_OBSERVATION_EXPLAINABILITY_CONTRACT.md`.

---

## 11. Presentation

Pregnancy UI: `showPregnancyObservations`.  
Perimenopause UI: `showPerimenopauseTracking`.  
No TRACK / TTC assessment panel in V1.

Storage is mode-independent. A TRACK-era positive `hot_flashes` stays PRESENT after the user enters Perimenopause. Do not relabel history biologically.

---

## 12. UX

Compact optional “დღევანდელი ნიშნების მონიშვნა” in Pregnancy and Perimenopause Quick Log (and the Feel tab of the full log). Not a mandatory survey. Not a 20-chip wall.

Three-state control: უპასუხო / დღეს იყო / დღეს არ იყო, plus **პასუხის წაშლა**. Not color-only. No red/green medical semantics.

Day Details: ABSENT does not appear in the logged-symptoms list. Optional “დღეს შემოწმებული”.  
Journal: logged facts only — no ABSENT list.  
Overview: no “N symptoms absent” card.

---

## 13. Offline / conflict

Same CycleLog UPSERT overlay and last-write semantics. No independent merge. Present / absent / clear-to-unknown survive queue → sync.

---

## 14. Privacy

| Surface | Assessment data |
|---|---|
| Personal export | **Included** (`observationAssessments` on each log) |
| Partner | **Not included** |
| Medi / OpenRouter | **Not included** |
| Doctor summary | **Unchanged** — no assessed-absent |
| ProductEvent / analytics | **No** keys, states, coverage, mode, or completion |
| Notification Brain | **No** “you haven’t assessed X” candidates |
| Achievements / streaks | **Forbidden** |

Owner auth only. No cross-user overlay.

---

## 15. Migration

`server/prisma/migrations/20260910140000_cycle_observation_assessments/migration.sql`

Live Neon historically has no `_prisma_migrations` table. Apply additively:

```
npx prisma db execute --schema prisma/schema.prisma --file prisma/migrations/20260910140000_cycle_observation_assessments/migration.sql
```

Existing rows stay valid with `{}`. Old clients that omit the field keep stored absences (except conflict strip when a positive symptom is written).
