# Cycle Postpartum copy isolation — Phase 40

**Status:** CYCLE PHASE 40 — POSTPARTUM JOURNAL & COPY ISOLATION  
**Date:** 2026-09-11  
**App version:** mobile `63.0.0`  
**iOS QA:** deferred by product decision

Phases 1–39 remain FINAL-FROZEN. Cycle product is not final.

This phase is **presentation / semantic isolation only**. It does not add a tracking model, lochia classification, forecast, AI, doctor-summary JSON/PDF, analytics, partner, schema, or API.

---

## 1. Why menstruation copy is unsafe in postpartum

POSTPARTUM is an explicit owner-selected tracking context. A logged or missing bleed is a **bleeding fact**. The product does not know that it is:

- menstruation
- a period
- lochia
- postpartum hemorrhage
- the first period after birth
- proof that the menstrual cycle has resumed

Empty states, headings, CTAs, helpers, and accessibility labels that tell the owner to “log menstruation” or that “no menstruation is recorded” are therefore false in this mode.

---

## 2. Neutral bleeding semantics

Reuse the frozen Phase 38 label:

`სისხლდენა`

Do not invent a new translation. Do not label bleeding `ლოხია`. Do not say hemorrhage / PPH. Do not say the period has returned.

Intensity chips (`მსუბუქი` / `ზომიერი` / `ძლიერი` / `ლაქები`) stay intensity, not diagnosis.

---

## 3. Journal empty state

POSTPARTUM Journal empty (no current-episode factual rows, query ready):

- Title: `მშობიარობის შემდგომი ჩანაწერები`
- Body: `ამ თვალთვალის ინტერვალში ჩანაწერი ჯერ არ არის.`
- CTA: `ჩანაწერის დამატება` → existing Quick Log

Do **not** show:

- `ჯერ არ არის აღრიცხული მენსტრუაცია`
- `აღრიცხეთ მენსტრუაცია და სიმპტომები…`
- `გამოტოვებული მენსტრუაცია`

Pending query ≠ empty. Use Phase 38 `postpartumQueryPending` / `postpartumEmptyCopyAllowed`.

---

## 4. Summary empty state

`/cycle/summary` is the **doctor-summary preview shell**, not a second Journal.

Phase 39 `postpartumContext` JSON/PDF is unchanged.

The interactive `CyclePeriodHistory` empty card is **not** part of the clinician document. In POSTPARTUM it is hidden (same capability boundary as Journal). TRACK/TTC still show it.

If engine-eligible historical episodes exist, the frozen doctor heading `მენსტრუაციის ისტორია` may still appear for those episodes. That is historical menstrual history in the clinician document, not a postpartum empty card and not a relabel of postpartum-stamped flow.

---

## 5. Historical period distinction

Old TRACK/TTC period logs keep their original history.

POSTPARTUM Journal **does not**:

- relabel them as postpartum bleeding history
- show them under “current postpartum records”
- convert them into lochia

Calendar may still paint logged flow as a fact. Engine-eligible (unstamped) historical bleeds remain engine history.

---

## 6. Current postpartum episode distinction

`CyclePostpartumJournalSection` uses `GET /api/cycle/postpartum` `recentLogs`.

Those rows are logs whose `postpartumEpisodeId` matches the **ACTIVE** `CyclePostpartumEpisode`. Ended episodes are not mixed into the current section. Re-entry uses the new ACTIVE episode only.

No backfill of `trackingContext=POSTPARTUM` onto older logs.

---

## 7. No lochia / return-of-period / forecast / doctor / AI

| Topic | Phase 40 |
|---|---|
| Lochia inference | No |
| Return-of-period claim | No |
| `engineLogWhere` / `filterLogsForEngine` | Unchanged |
| Next-period / LMP / late / fertile / ovulation math | Unchanged |
| Phase 39 `postpartumContext` JSON/PDF | Unchanged |
| Phase 38 AI fail-closed (`profileModeForAiPrompt(POSTPARTUM)=null`) | Unchanged |
| Partner / personal export / Notification Brain | Unchanged |
| DB / API | Unchanged |

---

## 8. Mode-aware copy architecture

Central helper: `mobile/src/lib/cycleHistoryCopy.js`.

Presentation files call `cycleHistoryPresentation(mode)` / `cycleLoggedBleedLabel(mode, copy)`.

Unknown mode is **not** TRACK_PERIOD. Pending copy is empty. Components must not render `journalEmptyBody` / `periodHistoryEmpty` from a guessed mode.

Capabilities reused: `showPostpartumTracking` (no new capability).

Do not scatter `mode === 'POSTPARTUM'` through UI files.

TRACK/TTC keep `periodHistoryEmpty` and related strings in `ka.ts`. This is not a global `მენსტრუაცია` → `სისხლდენა` replace.

---

## 9. Cold-start / loading

- Cycle hub: `CycleLoading` until a bundle exists (`loading && !bundle`).
- Postpartum Overview card: pending spinner, not TRACK empty.
- Journal postpartum section: loading label until query ready.
- Quick Log: no default `TRACK_PERIOD`. Show `იტვირთება…` until the owner’s mode is hydrated.
- Calendar / Day Details a11y: bleed label from the presenter, not a hardcoded period string.

---

## 10. Accessibility

Visual and screen-reader strings must agree.

POSTPARTUM logged bleed: `სისხლდენა`.

POSTPARTUM empty: `ამ თვალთვალის ინტერვალში ჩანაწერი ჯერ არ არის.` / `ჩანაწერის დამატება`.

Do not announce `მენსტრუაცია` for postpartum-stamped flow or postpartum empty cards.

---

## 11. Audit artifact

`qa/cycle-phase40-postpartum-copy/copy-audit.json`

---

## 12. Explicitly not in Phase 40

Owner classification of “this bleed is my period again” · lochia product · PPH warnings · postpartum observation rates · AI · doctor contract edits · iOS QA

**Phase 41** implements owner classification without changing this copy-isolation contract: `docs/CYCLE_POSTPARTUM_PERIOD_CLASSIFICATION_CONTRACT.md`.
