# Cycle safety contract

Cycle is a calendar tracker. It is not fertility-awareness contraception, not a clinical ovulation test, and not a pregnancy diagnostic.

1. **Cycle dates are civil dates.** Identity is `YYYY-MM-DD`. Stored logs never become UTC midnight timestamps. Travel does not rewrite a logged day.
2. **Calendar predictions are estimates.** Next period, ovulation, fertile window, and phase come from logged history plus calendar math.
3. **Predicted ovulation is not confirmed ovulation.** OPK, BBT, and mucus are user-logged observations. They do not confirm ovulation and do not change engine dates.
4. **The fertile window is not contraception guidance.** Copy must never imply safe days, infertile days, or that pregnancy cannot occur.
5. **AI does not calculate authoritative cycle dates.** EvidenceMD (`CYCLE_WELLNESS`) comments on allowlisted context. Forecast math stays in `server/src/lib/cycle.js`.
6. **AI receives allowlisted Cycle data only.** `serializeCycleLogForAi` / `buildCycleWellnessContext` are the only Cycle → EvidenceMD serializers.
7. **Sexual and private fields are excluded by default.** Sex chips (`unprotected`, `protected`, intercourse tags), `sexualActivity`, `libido`, journal notes, custom tags, and free text do not enter AI or partner payloads.
8. **Unknown new fields are excluded by default.** New symptom keys and undeclared object fields are not AI-visible or partner-visible until explicitly allowlisted. Phase 11 structured observations (`docs/CYCLE_OBSERVATION_CONTRACT.md`) keep this rule: registry unknown keys are rejected on write; new keys default AI/partner DENY.
9. **Confidence reflects history quantity and typical variability.** Labels stay `low` / `medium` / `high`. HIGH needs ≥6 in-band gaps and **trimmed** range ≤7 days (drop one min and one max). Below 6 gaps, full range is used. Irregular flag or spread >14 days is LOW. One isolated outlier among ≥6 regular gaps does not collapse HIGH. Missing lengths never produce HIGH.
10. **User-facing copy must preserve uncertainty.** In-app and lock-screen fertility wording must stay predicted/estimated. Discreet lock-screen copy already exists (`cycle-masked` / `maskNotifications`); do not invent a second privacy system.

## Timezone (“today” only)

Precedence: request device timezone (`X-Client-Timezone`) → stored Quest profile timezone → `Asia/Tbilisi`.

Only operations that need “now” use this clock. Historical `YYYY-MM-DD` rows stay stable.

Reminders fire at 09:00 in the device local timezone against engine civil dates from the bundle.

## Partner share

Scopes stay `period` / `cyclePhase` / `fertileWindow` / `symptoms`. Symptoms scope returns allowlisted wellness/mood keys only. Sexual chips, notes, OPK, BBT, mucus, and unknown keys are never included.

## Hormonal contraception

LIMITED methods continue to hide fertility markers in presentation. Engine math is unchanged.
