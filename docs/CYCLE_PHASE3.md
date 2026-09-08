# Cycle Phase 3 — engine irregularity + segmentation hardening

**Date:** 2026-09-08  
**App version:** mobile `37.0.2` (patch)  
**Scope:** engine quality only. No Flo/TTC/pregnancy/BBT/LH expansion. No OpenRouter. No UI redesign. Forecast length stays arithmetic mean.

**Tests:** `npm test` in `server/` → **671/671 pass**, 0 fail.

Authoritative rules: `docs/CYCLE_ENGINE.md`. Safety freeze: `docs/CYCLE_SAFETY_CONTRACT.md`.

---

## Files changed

| Area | Files |
|---|---|
| Segmentation, confidence, late, LMP | `server/src/lib/cycle.js` |
| Late copy | `server/src/lib/cycleHonesty.js` |
| History windows | `server/src/lib/cycleHistoryQuery.js`, `cycle.routes.js` |
| Partner LMP | `server/src/lib/cycleShare.js` |
| Push safety overlay | `server/src/lib/pushTemplates.js` |
| Civil dates | `mobile/src/lib/cyclePhase.ts` |
| Operator | `server/scripts/reconcile-cycle-push-templates.js` |
| Tests | `cycleSegmentation`, `cycleLate`, `cycleHistoryQuery`, `cycleRecompute`, plus golden/cycle/period/civil/push |
| Docs | `CYCLE_ENGINE.md`, this file, safety contract item 9 |
| Version | `mobile/app.json` 37.0.1 → 37.0.2 |

---

## Next phase (exactly one)

**Lock-screen privacy mask + Notification Brain cycle-candidate unification** — close `privacyEnabled ≠ maskNotifications`, and let Brain consume corrected fertility/late *candidates* without a second scheduler or Flo-like expansion.

Do not call the Cycle product final.
