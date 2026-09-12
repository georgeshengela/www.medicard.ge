# Cycle mode capabilities contract — Phase 27

**Status:** CYCLE PHASE 27 — MODE CAPABILITY & PRESENTATION INTEGRITY  
**Date:** 2026-09-10  
**App version:** mobile `50.0.0` (Phase 27 freeze). Phase 38 additive: mobile `61.0.0`.  
**iOS QA:** deferred by product decision

Phases 1–26 remain frozen. Phase 27 did not add a fifth mode. **Phase 38** adds live `POSTPARTUM` as a fifth explicit owner-selected mode — see `docs/CYCLE_POSTPARTUM_MODE_CONTRACT.md`. Original four-mode rows below are unchanged.

Canonical maps (duplicated on purpose — Metro does not watch a repo-root shared package):

- `server/src/lib/cycleModeCapabilityMatrix.js`
- `mobile/src/lib/cycleModeCapabilityMatrix.js`

Helpers:

- Server: `capabilitiesForProfileMode(mode)` / `supportsCycleCapability(mode, key)`
- Mobile: `cycleModeCapabilities(mode)` / `supportsCycleCapability(mode, key)`

Parity is asserted in `server/src/lib/cycleModeCapabilityMatrix.test.js`.

---

## Presentation vs domain

**Capabilities own product availability** (what the owner UI may show).

**Direct mode checks remain valid** for:

| Class | Meaning | Examples |
|---|---|---|
| DOMAIN | Engine / alert arithmetic invariants | `cycle.js` `pregnancy_mode` / `perimenopause_mode` late detection; TTC insight payload on the insights builder |
| TRANSITION | Explicit lifecycle writes | `applyPregnancyEpisodeTransition`; Settings onboarding sheets; log.tsx positive pregnancy-test prompt |
| READ_MODEL | Whether a server read model is attached | Pregnancy / TTC / Perimenopause aggregators; GET `/api/cycle` peri horizon fetch |
| DOCTOR_CONTEXT | Clinician document inclusion | Phase 20 pregnancy header; Phase 25 peri tracking context |
| PRIVACY | AI prompt mapping | `profileModeForAiPrompt` maps `PERIMENOPAUSE` → `TRACK_PERIOD`. `POSTPARTUM` is omitted (`null`), not remapped. |
| NOTIFICATION | Medical candidate suppression | `cycleNotificationContract.js` pregnancy / peri / TTC reminder rules |
| OTHER | Offline timeline presenter input after a capability gate | `presentPregnancyTimeline({ mode: 'PREGNANCY' })` |

Do **not** replace those with UI capability flags. Capabilities must not replace `applyPregnancyEpisodeTransition`.

---

## Four live modes (Phase 27)

`TRACK_PERIOD` | `TRY_TO_CONCEIVE` | `PREGNANCY` | `PERIMENOPAUSE`

**Phase 38:** `POSTPARTUM` is a fifth live mode. Unknown / missing mode still presents as **TRACK_PERIOD** (never as a foreign mode).

---

## Capability list

Grouped around actual product decisions. Derived flags always equal a parent so they cannot drift:

| Flag | Parent / meaning |
|---|---|
| `showClassicCycleOverview` | CycleHero, phase header, classic insight cards |
| `showTtcOverview` | TTC card, TTC journal, TTC fetch |
| `showPregnancyOverview` | Pregnancy hero / journal / fetch |
| `showPregnancyTimeline` | = pregnancy overview |
| `showPregnancyWeekGuide` | = pregnancy overview |
| `showPregnancyObservations` | = pregnancy overview |
| `showPregnancyTrends` | = pregnancy overview |
| `showPregnancyCarePlanner` | = pregnancy overview (Phase 32) |
| `showPerimenopauseTracking` | Peri hero / journal / summaries parent |
| `showVariabilityContext` | Peri variability card |
| `showPerimenopauseObservationSummaries` | = peri tracking |
| `showNextPeriodForecast` | Next-period presentation (peri still hides a precise date when confidence is `low`) |
| `showLatePeriod` | Late-period banner |
| `showFertileEstimates` | Fertile-window overlays |
| `showOvulationEstimate` | = fertile estimates |
| `showFertilityLogging` | More-tracking fertility group (TRACK + TTC) |
| `showFertilityShortcuts` | Quick-log / log-tab OPK·BBT shortcuts (TTC only) |
| `showFertilityHistory` | TTC journal OPK/BBT/mucus history |
| `showBbtHistory` / `showOpkHistory` | = fertility history |
| `showPregnancyTestLog` | Pregnancy-test field (TTC + Pregnancy) |
| `showPostpartumOverview` | Postpartum Overview card / fetch (Phase 38) |
| `showPostpartumTracking` | Postpartum journal + Quick Log / Day Details labels (Phase 38) |

Not added (avoid explosion): `showCycleDay`, `showCyclePhase`, `showPeriodHistory`, `showBleedingLogging`, `showGeneralObservationLogging`. Those follow classic Cycle history and are never deleted by mode.

---

## Four-mode matrix

| Capability | TRACK | TTC | PREGNANCY | PERIMENOPAUSE | POSTPARTUM (P38) |
|---|---|---|---|---|---|
| `showClassicCycleOverview` | Y | Y | N | N | N |
| `showTtcOverview` | N | Y | N | N | N |
| `showPregnancyOverview` (+ timeline / week / obs / trends / planner) | N | N | Y | N | N |
| `showPerimenopauseTracking` (+ summaries) | N | N | N | Y | N |
| `showVariabilityContext` | N | N | N | Y | N |
| `showPostpartumOverview` / `showPostpartumTracking` | N | N | N | N | Y |
| `showNextPeriodForecast` | Y | Y | N | Y | N |
| `showLatePeriod` | Y | Y | N | N | N |
| `showFertileEstimates` / `showOvulationEstimate` | Y | Y | N | N | N |
| `showFertilityLogging` | Y | Y | N | N | N |
| `showFertilityShortcuts` / history / BBT / OPK | N | Y | N | N | N |
| `showPregnancyTestLog` | N | Y | Y | N | N |

---

## Capability ≠ data readiness

`mode = PREGNANCY` (capability on) plus a loading pregnancy query must use the Phase 17/18 loading contract. Do not render a fake empty Pregnancy product.

Capability on plus API error must stay a soft-error/retry state, never “capability disabled”.

---

## Auth / cache / cross-user

Do not derive mode-dependent chrome before `AuthContext.ready` and an authenticated profile.

TTC, Pregnancy, and Postpartum queries are scoped by `userId`. Logout / user switch clears the other user’s read model (`scopeTtcQueryToUser` / `scopePregnancyQueryToUser` / `scopePostpartumQueryToUser`).

Cycle bundle cache is already per `userId`. Mode-specific server data is not shown by hiding stale components alone.

---

## Mode save

Settings writes `PUT /api/cycle/profile`. Overview / Home / Journal re-read the canonical bundle. There is no second stored product-mode flag.

The Settings editor may hold a local `mode` draft (TRACK can be tapped immediately; TTC / Pregnancy / Peri open onboarding first). That draft is not the Cycle hub capability source. Lifecycle writes still go through `applyPregnancyEpisodeTransition` on the server.

**Offline:** mode change is not queued. Save fails clearly; current server mode remains. Unchanged from Phase 16.

**Rapid switch:** TTC / Pregnancy fetch helpers ignore stale generations; latest canonical mode wins.

---

## Deep links

| Route | Guard |
|---|---|
| `/cycle/pregnancy/timeline` | `showPregnancyOverview` else `router.replace('/cycle')` |
| `/cycle/pregnancy/care-plan` | `showPregnancyCarePlanner` else `router.replace('/cycle')` |
| `/cycle/week/[week]` | same |
| `/cycle/pregnancy` | Redirects to `/cycle` (Pregnancy is not a fourth pane) |

Static week catalog may be bundled, but the route is not an active Pregnancy product without the capability. Server `GET .../weeks/:week` still 404s unless profile mode is `PREGNANCY` (READ_MODEL).

Back navigation re-evaluates capabilities from the current bundle (screens do not keep a copied mode boolean).

---

## Surface matrix (presentation)

| Surface | TRACK | TTC | PREGNANCY | PERIMENOPAUSE | POSTPARTUM |
|---|---|---|---|---|---|
| Overview | CycleHero | CycleHero + TTC card | Pregnancy card + timeline peek + care planner card | Peri card | Postpartum card (mode + optional elapsed + today facts) |
| Calendar | period + prediction overlays | frozen TTC (fertile visible) | future fertile / ovulation / predicted-period decorations off | no fertility / late decorations | logged facts; future fertile / ovulation / predicted-period / late off; bleed label = სისხლდენა |
| Journal | generic history / Phase 13 trends | + TTC history | + Pregnancy summaries (denominator-safe) | + variability + peri summaries | postpartum factual history only; no prediction/period-history charts |
| Quick Log | classic | fertility shortcuts | Pregnancy-relevant emphasis | Peri-relevant emphasis | existing observations; flow as bleeding |
| Day Details | estimates follow caps; logged facts always remain | same | pregnancy labels; no fertile estimates | peri labels; no fertile estimates | bleeding (not period); no fertile estimates |
| Home | day / next period | + TTC label | week/day only | mode + last recorded bleeding | mode + optional elapsed; no symptoms |
| Settings | mode cards + explicit onboarding | same | same | same | same + optional reference date |
| Forecast presentation | on | frozen TTC | off | on; low confidence still softened/hidden | off |
| Late period | on | on | off | off | off |
| Fertile / ovulation estimates | frozen TRACK | on | off | off | off |

Logged owner facts are never deleted by a mode change. Presentation ≠ deletion.

---

## Loading / error / Pregnancy review-required

Pregnancy capability may be on while `reviewRequired` suppresses dating detail, baby-size week, and timeline current-week. No random fallback week.

Perimenopause capability may be on while Phase 24 hides a precise next-period date at `low` confidence.

---

## Doctor summary / notifications / AI / partner

Unchanged:

- Doctor: Phase 20 pregnancy context + Phase 25 peri tracking context + **Phase 39 postpartum current context** (POSTPARTUM + ACTIVE episode only). Direct current-mode inclusion. Not UI capabilities. Not obstetric history.
- Notification Brain: pregnancy / peri / postpartum suppression stay in `cycleNotificationContract.js`. No postpartum pushes.
- AI: `profileModeForAiPrompt` maps peri → TRACK. **POSTPARTUM is omitted** (not remapped to TRACK). Cycle `CYCLE_WELLNESS` is not called. General Medi remains available without Cycle context.
- Partner: no payload widening. Postpartum keys default-deny.

---

## Remaining valid production direct mode checks

Classified after Phase 27. Presentation files listed in `cyclePresentationModeGuard.test.js` must not gain new enum comparisons.

**Mobile**

| Location | Class |
|---|---|
| `cycleModes.js` `isTtcMode` / `isPregnancyMode` / `isPerimenopauseMode` / `isPostpartumMode` | DOMAIN helpers (not for UI branching) |
| `app/cycle/settings.tsx` | TRANSITION (onboarding + pregnancy / postpartum reference write) |
| `app/cycle/log.tsx` positive pregnancy test | TRANSITION (prompt, not auto-enter) |
| `cycleNotificationContract.js` | NOTIFICATION |
| `pregnancyTimelinePresent.js` `mode !== 'PREGNANCY'` | READ_MODEL (timeline payload) |

**Server**

| Location | Class |
|---|---|
| `cycleModes.js` profile-mode helpers + AI mapper | DOMAIN / PRIVACY |
| `cycle.js` late / TTC insight / pregnancy insight / peri irregular alert / postpartum late skip | DOMAIN |
| `cyclePregnancy.js` / `cycleTtc.js` / `cyclePerimenopause.js` / `cyclePostpartum.js` | READ_MODEL / TRANSITION |
| `cyclePerimenopauseObservationTrends.js` mode gate | READ_MODEL |
| `cycleDoctorSummary.js` | DOCTOR_CONTEXT |
| `cycle.routes.js` pregnancy week 404, peri horizon fetch, pregnancy/postpartum transition write | READ_MODEL / TRANSITION |
| `cyclePredictionHistory.js` pregnancy / postpartum snapshot skip | DOMAIN |
| `cycleContraception.js` TTC method conflict | DOMAIN |

---

## Future mode rule

Any future Cycle mode must add its **capability row** to both matrix files (and the parity test) **before** UI implementation.

No new `if (mode === '…')` in Cycle presentation files.

Do not reopen a repo-root shared package for this matrix (Phase 21 Metro lesson).

**Phase 32:** `showPregnancyCarePlanner` is derived from `showPregnancyOverview`. Planner contract: `docs/PREGNANCY_CARE_PLANNER_CONTRACT.md`.

**Phase 38:** `showPostpartumOverview` / `showPostpartumTracking`. Contract: `docs/CYCLE_POSTPARTUM_MODE_CONTRACT.md`.

**Phase 42:** forecast readiness is **not** a capability flag. `forecastEligibility.allowed` is a dynamic server policy layered on top of the static matrix. Contract: `docs/CYCLE_POSTPARTUM_RETURN_TO_TRACK_CONTRACT.md`.

---

## P2 polish in this phase

- Pane tabs grow (`minHeight` 52, `lineHeight` 20) so large text can wrap instead of clipping. Fonts are not frozen smaller.
- Settings gear: `flexShrink: 0` on icon buttons and `minWidth: 0` on the title column. Expo Tools FAB overlap in QA is not production chrome.
- FLOW_OPTIONS spotting chip: Georgian `ლაქები`. Enum stays `spotting`.
- Last-logged a11y uses `formatCycleDateKa` (civil date, Georgian spoken month).
