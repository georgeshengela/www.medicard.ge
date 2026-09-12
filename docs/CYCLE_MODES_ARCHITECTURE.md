# Cycle modes architecture

**Status:** Cycle Tracking, Trying to Conceive, Pregnancy, and Perimenopause are live product modes.  
**Date:** 2026-09-10  
**Live product modes:** Cycle Tracking (`TRACK_PERIOD`), Trying to Conceive (`TRY_TO_CONCEIVE`), Pregnancy (`PREGNANCY`), Perimenopause (`PERIMENOPAUSE`)

Code map: `server/src/lib/cycleModes.js` plus `docs/CYCLE_MODE_CAPABILITIES_CONTRACT.md` (Phase 27 presentation matrix). See `docs/CYCLE_TTC_CONTRACT.md`, `docs/CYCLE_PREGNANCY_CONTRACT.md`, and `docs/CYCLE_PERIMENOPAUSE_CONTRACT.md`.

Mode is a **product goal**, not gender or a biological identity field. Mode changes presentation. It does not change cycle arithmetic in Phase 16–18.

Historical observations are never deleted by a mode change.

---

## Cycle Tracking (live)

Visible groups: physical, energy, mood, digestion, skin, fertility observations (optional, separated), private.

Engine: flow only. Next period, ovulation estimate, fertile-window estimate, late-period.

Journal: prediction history, period history, pain/symptom/mood summaries already shipped. Generic observation trends stay Phase 13.

Notifications: existing period / estimated ovulation / fertile window / late. Unchanged this phase.

Privacy: wellness allowlist only for AI; sexual / notes / tags denied; fertility tests keep the existing Phase 2 AI USER_LOGGED line and stay off partner share.

---

## Trying to Conceive (live — presentation)

Visible groups: all Cycle Tracking groups, with fertility observations (OPK, BBT, cervical mucus, pregnancy tests) more prominent. Sexual activity stays under Private.

Engine implications: **none**. Same forecast as Track Period. Do not add conception probability, fertility scoring, or “confirmed ovulation”. Positive OPK stays a user-logged test.

Privacy: sexual activity and tests remain default-private for partner/analytics. AI allowlist is not expanded.

Notifications: optional OPK/BBT reminders already catalogued in Notification Brain — no new TTC campaigns.

Data needs: same CycleLog fields. `GET /api/cycle/ttc` is a bounded read model.

Transition: Cycle ↔ TTC keeps logs.

---

## Pregnancy (live — Phase 18 foundation)

Explicit entry only. Episode model: `CyclePregnancyEpisode` (one ACTIVE). LMP-based reference, server-owned week/day, estimated due date. No diagnosis, no auto-enter from a test. See `docs/CYCLE_PREGNANCY_CONTRACT.md`.

Engine implications: existing `detectLatePeriod` `pregnancy_mode` suppression is preserved. Forecast arithmetic is not rewritten. Presentation hides fertile-window / ovulation / next-period / late as active guidance.

Privacy: episode / due date / tests stay off partner payload. AI is not widened. No pregnancy Notification Brain campaigns.

---

## Perimenopause (live — Phase 24 foundation)

Explicit entry only. Tracking mode, not a diagnosis. See `docs/CYCLE_PERIMENOPAUSE_CONTRACT.md`.

Engine implications: **none** for arithmetic. Presentation suppresses late-period and fertile-window guidance. Variability uses unclamped historical intervals (last 6). `hot_flashes` / `night_sweats` reused; `vaginal_dryness` stays private.

Notifications: no new campaigns. Existing period/late/fertile candidates are suppressed.

`futureOnly`: `perimenopauseDiagnosis`.

---

## Capabilities map (conceptual)

| Mode | Observation groups | Prediction features | Journal | Notifications |
|---|---|---|---|---|
| Cycle Tracking | physical, energy, mood, digestion, skin, fertility (opt-in), private | next period, ovulation estimate, fertile window, late | prediction history, period, pain/mood | existing Cycle set |
| TTC | + fertility tests prominent | same engine; **no** conception % | OPK / BBT / mucus / tests | future OPK/BBT |
| Pregnancy | physical, wellness, tests as history | none of the cycle fertility overlay | week / symptoms | future prenatal |
| Perimenopause | physical, energy, sleep, mood, private | next period only when confidence allows; no late / fertile guidance; no diagnosis | bleeding history, variability, body-change logs | none new |

---

## What this architecture does not do

- Does not add a fifth Cycle mode.
- Does not add OpenRouter Cycle AI.
- Does not change forecast math.
- Does not infer pregnancy from a test result.
- Does not use cervical mucus or BBT to move ovulation.
- Does not add conception probability.
