# Cycle engine contract

Authoritative prediction math lives in `server/src/lib/cycle.js`. Derived periods are interpretation of raw `CycleLog` rows. Raw logs are never rewritten to match grouping.

Identity is a civil calendar day `YYYY-MM-DD`. Arithmetic uses UTC date parts (`addDays` / `daysBetween`). Mobile `addDaysToKey` matches that helper.

This is a calendar tracker. It is not diagnostic, not contraception, and not a pregnancy test. See `docs/CYCLE_SAFETY_CONTRACT.md`.

---

## Provenance

| Kind | Meaning |
|---|---|
| USER_LOGGED | Raw `CycleLog` (flow, symptoms, extras) |
| DERIVED | Period starts/ranges, LMP, averages, late status, confidence |
| PREDICTED | Next period, ovulation day, fertile window, phase labels |

Segmentation changes DERIVED only.

---

## Flow classification

Schema: `CycleLog.flow` is `String?` (`none | spotting | light | medium | heavy`).

| Input | Class | Period start? | May bridge a 1-day interior? |
|---|---|---|---|
| `light` / `medium` / `heavy` | bleed | yes | n/a (continues) |
| missing row (no log) | missing | no | yes, if envelope allows |
| `flow` null/unknown on a row | missing | no | yes, if envelope allows |
| `flow = 'none'` | none | no | **never** |
| `spotting` | spotting | **no** | yes, if envelope allows |

The schema **can** distinguish no row vs explicit `none` vs null flow. A missing log does not mean bleeding stopped. Explicit `none` is a stronger stop.

Spotting alone never starts a period.

---

## Period segmentation

Logs are sorted by civil date. Only bleed days start or extend a run.

**Continue the same episode when** `canContinuePeriod`:

1. Consecutive bleed (`gap ≤ 1` calendar day) always continues.
2. At most **one** interior calendar day of **missing or spotting** may bridge (`PERIOD_MERGE_MAX_INTERIOR_DAYS = 1`).
3. Inclusive span from run start to the resumed bleed must be **≤ 10 days** (`PERIOD_MERGE_MAX_SPAN_DAYS`).
4. Any interior day with explicit `flow = 'none'` never bridges.

Otherwise a new period start is recorded.

Consecutive long bleeds (e.g. 18 logged heavy days) stay one logged episode. Period-length average still only uses ranges of **2–10** days. Gap-merging must not invent an 11+ day period.

Valid **cycle** gaps between period starts remain **18–45** days. Out-of-band gaps are ignored for the mean (they still create starts).

**LMP** = last derived period start. `pickLastPeriodStart` / bundle / partner payload prefer derived LMP; stored onboarding LMP is the fallback when there is no bleed run.

---

## History windows

| Purpose | Query |
|---|---|
| CALCULATION | 5 civil years of `date + flow` (`CYCLE_ENGINE_HISTORY_DAYS = 365 * 5`) |
| DISPLAY | latest 400 full rows |
| AI | last 7 days from the display slice (allowlisted) |

Root cause of the old 400-log bug: `take: 400` on **all** CycleLog rows. Dense daily symptom/`none` logging filled 400 days and dropped older period starts.

Averages still use **all in-band 18–45 gaps inside the 5-year engine window** (arithmetic mean). A recency-N window was considered and **rejected** this phase: it would change sparse long-history loggers. Median is not used.

Index: existing `CycleLog @@index([userId, date])`. No new index.

Bundle cost: **two** CycleLog queries (engine date+flow + display 400), not an unbounded full-history dump.

---

## Cycle average

When ≥2 in-band gaps exist, forecast cycle length is the rounded arithmetic mean, clamped 21–45.

Period length: mean of 2–10 day derived ranges, clamped 2–10.

Stored profile averages are never overwritten. `resolveForecastAverages` picks inferred vs stored vs default.

---

## Variability and confidence

Spread = `cycleLengthSpread` of the same in-band gaps:

- n < 6: **full range** (small samples cannot spare an outlier)
- n ≥ 6: **trimmed range** (drop one min and one max)

| Rule | Result |
|---|---|
| `isIrregular` or &lt;2 gaps | LOW |
| spread &gt; 14 | LOW |
| ≥6 gaps and spread ≤ 7 | HIGH |
| otherwise, with ≥2 gaps | MEDIUM |
| lengths missing | never HIGH |

Isolated outlier among ≥6 regular gaps can stay HIGH. Persistent 21/45 chaos stays LOW.

---

## Late status

Engine status only. **Never pregnancy.** `notifyEligible` is always `false` — there is no Cycle late push. Notification Brain remains the only scheduler.

| History | Rule |
|---|---|
| HIGH, ≥2 gaps, not irregular | late if `today > predictedStart + 2` |
| MEDIUM, ≥2 gaps, not irregular | late if `today > predictedStart + 5` |
| irregular **or** LOW with ≥2 gaps | late if `today > predictedStart + 14` |
| &lt;2 personalized gaps | late if `today ≥ last FLOW + 45` |
| in a logged bleed range | on_time |
| `PREGNANCY` mode | unknown / not late |

Copy: `მენსტრუაცია ბოლო პატერნზე გვიანია. ეს შეფასებაა, არა დიაგნოზი…`

LIMITED contraception still allows period-late status. Fertility claims stay gated separately.

---

## Civil dates

Server `addDays` / mobile `addDaysToKey`: parse `YYYY-MM-DD`, add days with `Date.UTC` + `setUTCDate`. DST and host timezone must not change the key.

“Today” still uses `cycleCivilDate` (device TZ → quest TZ → Asia/Tbilisi). Historical keys stay stable.

---

## Push templates

`listPushTemplates` merges DB rows over `PUSH_TEMPLATE_DEFAULTS`.

Fertility keys `cycle-ovulation` and `cycle-fertile`:

- Serve DB copy only if it stays estimated (`სავარაუდო` or `შეიძლება`) and has no certainty phrases.
- Otherwise serve code defaults (`source: default_safety_override`). The admin row is **not deleted**.
- `savePushTemplate` rejects unsafe fertility copy (`unsafe_fertility_copy`).

Operator: `node server/scripts/reconcile-cycle-push-templates.js` (report) and `--apply` to rewrite stored unsafe fertility copy to current defaults.

---

## Historical edits

PUT/DELETE/period writes call `syncLastPeriodStart`, which:

1. Reloads 5-year date+flow
2. Re-derives LMP
3. Always writes `emptyCycleAiCache()` (`aiInsights` / `aiInsightsAt` null)

Predictions, confidence, late status, and insights rebuild from logs on the next bundle. Raw rows stay user truth.

Cycle reminders are local (mobile). There are no server future-cycle notification rows to duplicate. Bundle changes cancel+reschedule locally. Late status does not enqueue a push.

---

## What this engine does not do

No Flo-like expansion, TTC/pregnancy/BBT/LH productization, OpenRouter Cycle AI, median forecast, or UI redesign. EvidenceMD `CYCLE_WELLNESS` allowlist is unchanged.

Phase 8 historical snapshots (`docs/CYCLE_PREDICTION_HISTORY_CONTRACT.md`) observe `nextPeriodStart` after a bundle is built. They do not change this file's forecast mean, confidence, late, fertility, or segmentation.

**Phase 42:** postpartum-return forecast eligibility gates whether those predictions are exposed. Arithmetic in this file is unchanged. Contract: `docs/CYCLE_POSTPARTUM_RETURN_TO_TRACK_CONTRACT.md`.
