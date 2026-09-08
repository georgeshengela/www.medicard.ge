# MediCard Cycle — Phase 1 forensic audit

**Status:** audit only. No prediction rewrite, no schema migration, no new modes, no AI feature implementation.  
**Date:** 2026-09-08  
**Golden suite:** `server/src/lib/cycleGoldenAudit.test.js` — 28/28 pass (documents current behavior).

---

## 1. Executive summary

MediCard Cycle is already a **real product**, not a stub. Canonical forecast math lives on the **server** (`server/src/lib/cycle.js`). The mobile app **displays server stamps** (`phaseFromBundle` in `mobile/src/lib/cycleCanonical.ts`) and does not re-run LMP ovulation math for hub/calendar.

What works:

- Civil-day identity (`YYYY-MM-DD`), not timestamps, for logs.
- Spotting is not a period.
- End Period does **not** invent bleed days.
- Logged period overlay sets `predicted: false`.
- Calendar method is explicit: ovulation = LMP + (cycleLength − 14); fertile = ovulation−5 … ovulation+1.
- Contraception LIMITED methods hide fertility markers in presentation without changing the engine.
- Partner share defaults exclude fertile window and symptoms; tokens are hashed.
- Cycle insights use **EvidenceMD** (`CYCLE_WELLNESS`), not OpenRouter, with honesty rules and an 18h cache.
- Pregnancy-sized gaps are **excluded** from the 18–45 average (they do not become a 280-day “cycle”).

What is weak or unsafe:

- Confidence is a **count heuristic**, not variance. Six 21/45 alternating cycles still yield `high` unless the user ticks `isIrregular`.
- A skipped bleed day (gap > 1) **splits one period into two** and can move `lastPeriodStart`.
- Personalized length needs **two valid gaps** (≥3 period starts). One or two logged periods still show a 28-day calendar estimate.
- Push copy is **less hedged** than in-app copy (especially ovulation).
- Sexual chips are stored inside `CycleLog.symptoms` and currently appear in the EvidenceMD prompt; notes do not.
- Engine “today” is **Asia/Tbilisi**; the calendar “today” marker is **device local**.
- Bundle history is capped at **400 logs**. Daily trackers lose older cycles.
- OpenRouter is **not** on the cycle path. Medi chat receives only `ციკლის რეჟიმი: {mode}`.

**Verdict:** the engine is **partially trustworthy** for regular ovulatory tracking. It is **not** ready to be sold as a fertility-awareness or irregular-cycle clinical system. AI personalization architecture exists but must not expand until minimization and confidence metadata are honest.

**Recommended next phase (one only):** Safety and honesty hardening — push wording, AI/partner field minimization, confidence/variance, timezone contract. Do not rebuild the calculator and do not add Flo-like modes yet.

---

## 2. Current architecture

```
USER INPUT (hub / log / period start-end / onboarding)
        ↓
LOCAL STATE (screen useState + encrypted offline queue on iOS/Android)
        ↓
API /api/cycle/*  (requireAuth + assertFemale)
        ↓
DATABASE  CycleProfile, CycleLog, CycleCustomTag, CyclePartnerShare, PregnancyLog
        ↓
CYCLE ENGINE  inferCycleStats → resolveForecastAverages → buildPredictions
              overlayLogsOnCalendar → stampCalendarPhases → presentPredictions
        ↓
BUNDLE  predictions, phase, analytics, localInsights, alerts, summary
        ↓
FRONTEND  calendar / strip / insights / home card
        ↓
NOTIFICATIONS (client scheduler from bundle dates)
        AI (POST /insights → EvidenceMD)
        SHARING (hashed partner token)
```

Socket.IO is **not** used for cycle. React Query / Zustand are **not** used for cycle.

---

## 3. Frontend architecture

Expo Router under `mobile/app/cycle/*` plus home card `HomeCyclePreviewCard`.

No dedicated `useCycle` store. Each screen calls `loadCycleView` (`mobile/src/lib/cycleOffline.ts`), which fetches GET `/api/cycle/` and overlays pending offline mutations.

Display phase: `mobile/src/lib/cycleCanonical.ts` `phaseFromBundle` — comment: no client LMP engine.

Client date helpers in `mobile/src/lib/cyclePhase.ts` (`addDaysToKey` uses **device** `Date`, not Tbilisi) for countdowns and reminders.

---

## 4. Backend architecture

Mounted at `/api/cycle` in `server/src/server.js`.

| Layer | File |
|---|---|
| HTTP | `server/src/routes/cycle.routes.js` |
| Forecast | `server/src/lib/cycle.js` |
| Period writes | `server/src/lib/cyclePeriod.js` |
| History/PMS | `server/src/lib/cycleHistory.js`, `cycleHistoryAnalytics.js` |
| Honesty copy | `server/src/lib/cycleHonesty.js` |
| Fertility observations | `server/src/lib/cycleFertility.js` |
| Contraception presentation | `server/src/lib/cycleContraception.js` |
| Pain/lifestyle/tags | `server/src/lib/cycleObservations.js` |
| Partner share | `server/src/lib/cycleShare.js` |
| Export/wipe | `server/src/lib/cycleLifecycle.js` |

Female gate: `assertFemale` — `user.gender !== 'FEMALE'` → 403.

---

## 5. Database model

`server/prisma/schema.prisma`

- **CycleProfile** — mode (`TRACK_PERIOD` \| `TRY_TO_CONCEIVE` \| `PREGNANCY`), stored averages, LMP `@db.Date`, `isIrregular`, due date, privacy flag, partner code, `aiInsights` JSON cache, conditions JSON, reminderPrefs, contraception method/start.
- **CycleLog** — unique `(userId, date)` string `YYYY-MM-DD`. Flow, symptoms/moods JSON, sexualActivity, libido, bbt, mucus, OPK, pregnancy test, notes, painEntries, lifestyle enums, customTagIds.
- **CycleCustomTag** — soft archive.
- **CyclePartnerShare** — `tokenHash` unique, permissions JSON, expiry, revoke.
- **PregnancyLog** — unique `(userId, date)`.

Indexes: `(userId, date)` on logs; share owner/partner indexes. No provenance column. No edit-history table.

Legacy/ambiguous: sexual chips duplicated into `symptoms`; `privacyEnabled` stored but commented as client-enforced; `avgCycleLength` stored but forecast may ignore it when inferred.

---

## 6. Canonical source of truth

| Fact | Authoritative source |
|---|---|
| Period start/end ranges | Derived from logs via `inferCycleStats` (not a stored range table) |
| Bleeding days | `CycleLog.flow` |
| Stored averages | `CycleProfile.avgCycleLength/avgPeriodLength` — **not overwritten** by inference |
| Forecast averages | `resolveForecastAverages` — inferred if `cycleCount >= 2`, else stored, else 28/5 |
| Cycle day / phase | Server `detectCyclePhase` stamped onto calendar |
| Fertile / ovulation | Server `buildPredictions` then `presentPredictions` |
| Next period | `phases` next start = lastStart + usedCycleLength |
| Confidence | `predictionConfidence({ cycleCount, isIrregular })` |
| Irregularity | **User flag** `isIrregular`, plus alerts on last gap &lt;21 or &gt;35 |
| Symptoms/pain/notes | `CycleLog` |
| TTC | Profile `mode` + observation fields; **does not change math** |
| Pregnancy status | Profile `mode === 'PREGNANCY'` + due date; **not inferred** from late period |

**Duplicates (parallel, not competing forecast):**

- Civil-day math copied in `cycleHistory.js` (intentional isolation).
- `isPeriodFlow` vs `isBleedLog`.
- Forecast gaps [18,45] vs historical pattern lengths [18,60].
- Partner payload rebuilds infer + predict independently of `loadBundle`.
- Client `addDaysToKey` vs server `addDays` (UTC vs local Date).

Canonical **forecast** math: only `cycle.js`.

---

## 7. Cycle engine

`buildPredictions` in `server/src/lib/cycle.js`.

**Inputs:** `lastPeriodStart`, `avgCycleLength`, `avgPeriodLength`, `horizonDays=90`, `cycleCount`, `isIrregular`, `logs`.

**Loop:** up to 4 cycles or &gt;90 days from LMP.

```
periodEnd     = start + (avgPeriodLength − 1)
ovulation     = start + (avgCycleLength − 14)
fertileStart  = ovulation − 5
fertileEnd    = ovulation + 1
nextStart     = start + avgCycleLength
```

Every forecast period day is marked `period: true, predicted: true, estimated: true`. Logs overlay afterwards.

**Returned “current” ovulation/fertile window** is the **upcoming** cycle starting at `lastPeriodStart` (including the in-progress cycle), not the next one. `nextPeriodStart` is the following cycle.

---

## 8. Period segmentation

`inferCycleStats`: sort logs; keep only `light|medium|heavy`; a new run starts when gap from last bleed **&gt; 1 day**.

Golden result: bleed Mon–Tue, skip Wed, bleed Thu–Fri → **two** period starts.

Spotting never joins a run.

Very long bleed: range length = contiguous days; period-length average keeps only lengths **2–10**, so a 14-day run is **dropped** from the period average (still a start). Write path `MAX_PERIOD_SPAN_DAYS = 14`.

---

## 9. Cycle-length calculation

Mean of gaps between period starts where gap ∈ **[18, 45]**. Need **≥2** such gaps. Then clamp to **[21, 45]**.

Not median, not weighted, not “most recent N only” except that API loads the newest **400 logs**.

`cycleCount` = number of **in-band gaps**, not number of periods.

---

## 10. Period-length calculation

Mean of run `lengthDays` where n ∈ **[2, 10]**. Need ≥1 such run. Clamp [2, 10].

One-day bleeds are starts but **excluded** from the average (fallback 5 or stored).

Partial unlogged days are **not** filled on End Period, so period length is actual logged contiguous days only.

---

## 11. Prediction algorithm

After averages resolve:

1. If no LMP → empty calendar, confidence still computed.
2. Else project 4 cycles of predicted period + fertile + ovulation.
3. Overlay logs (`predicted: false` on logged bleed).
4. Stamp `cycleDay` / `phase` for every civil day in horizon.
5. Contraception LIMITED strips fertile/ovulation marks for **presentation**.

Onboarding with only LMP and default 28/5 produces a full calendar estimate immediately (`source: 'default'`).

---

## 12. Confidence

```js
if (isIrregular || cycleCount < 2) return 'low';
if (cycleCount < 6) return 'medium';
return 'high';
```

**Heuristic, not statistical.** No standard deviation, no range check. User flag forces low.

Golden D: six 21/45 gaps → `high` if `isIrregular` is false.

UI does distinguish generic vs personalized **averages source** (`default` \| `user` \| `inferred`) in the bundle, and honesty copy is more cautious when `low`. First-run UX still shows predicted period rings from the 28-day default.

---

## 13. Fertile-window algorithm

Calendar-only. Sperm/egg window assumed as 5 days before + 1 day after the luteal-length-14 ovulation estimate.

**Does not** use OPK, BBT, mucus, sex, or LH peak.

UI copy (in-app) says calendar estimate, not confirmed fertility. Push is weaker.

---

## 14. Ovulation semantics

**Predicted only.** There is no retrospective confirmed-ovulation object.

`CycleLog.ovulationTest` is `negative|positive|unclear`, labeled user-logged. Positive OPK **does not** move `ovulationDate`.

Phase label `ოვულაცია` on the predicted civil day is still an estimate; honesty layer titles it `estimatedOvulationTitle`. Risk: calendar fill is solid purple like a fact if the user ignores the legend.

---

## 15. Phase calculation

`detectCyclePhase`:

- `day = daysBetween(LMP, today) + 1`; wrap with modulo `avgCycleLength`.
- `ovulationCycleDay = avgCycleLength − 13` (same civil day as LMP + length − 14).
- `cycleDay ≤ periodLen` → period  
- in [ov−5, ov+1] → fertile, or ovulation on that day  
- after ov+1 → luteal  
- else follicular  

Wrapping with modulo **invents** future cycles’ phases even without new logs (calendar method). Irregular users still get a phase number.

LIMITED contraception overrides non-period phases to unknown + Georgian “calendar phase less meaningful”.

---

## 16. PMS

- **Logged:** moods/symptoms/pain can include PMS-like keys.
- **Analytics:** `buildPmsByDaysBefore` — observations 1–14 days before next period start; recurring needs ≥3 pattern-valid cycles and coverage ≥ 0.15. Copy: not a clinical diagnosis.
- **Predicted reminder:** client schedules PMS at `ovulationDate + 2` days (`cycleReminders.ts`) — **not** from the heatmap. Heuristic luteal nudge.

No separate PMS probability model.

---

## 17. Irregular-cycle behavior

Identification = optional profile checkbox + last-gap alert outside 21–35.

Forecast still emits dates. Outliers outside 18–45 are **silently dropped** from the mean (so remaining regular-looking gaps can look “stable”). Highly variable **in-band** cycles still average and can be `high` confidence.

Historical analytics allow pattern lengths up to **60**, so charts can show cycles the forecast ignored.

---

## 18. Outlier behavior

| Gap | Forecast average |
|---|---|
| &lt;18 (e.g. 15) | discarded |
| 18–45 | included |
| &gt;45 (60, 280) | discarded |

Discarding pregnancy/postpartum gaps is **protective**. Discarding a true 60-day cycle also **hides irregularity** from the predictor.

---

## 19. Timezone / date behavior

- Log identity: string `YYYY-MM-DD`.
- `toDateKey(Date)`: **UTC** Y-M-D so `@db.Date` midnight UTC does not shift.
- Engine today: `todayInTimeZone('Asia/Tbilisi')`.
- Writes reject `key > tbilisiToday`.
- Mobile calendar/reminders `todayKey()`: **device** local Y-M-D.
- `addDaysToKey` on client uses local `Date` (DST on the device).

**Risk:** traveler whose device day ≠ Tbilisi day can be told “cannot log future” for their local today, or log a different civil day than the engine’s today. **Stored days do not jump** after write.

Georgia has no DST; Tbilisi is stable UTC+4. DST tests on UTC civil addDays pass.

---

## 20. Historical editing

- Adding an earlier bleed in the same run rewinds LMP (`pickLastPeriodStart`).
- Period history UI can fill/start/end ranges.
- `syncLastPeriodStart` always clears `aiInsights` cache.
- Client `syncCycleReminders` cancels and reschedules from the new bundle (if the app opens).
- No server push scheduler, so stale OS notifications persist until next client sync.
- No row-level audit log of who changed a day.

---

## 21. Daily logging

Hub panes (`CycleLogHubModal`): BBT, libido, moods, mucus, flow, symptoms, pain, start period, sex, notes, lifestyle, tags, OPK, pregnancy test.

Full form: `CycleLogTabs` + `persistCycleLog`.

Upsert unique `(userId, date)` — same day overwrite, no duplicate rows.

---

## 22. Bleeding

States: `none | spotting | light | medium | heavy`.

Only light/medium/heavy bound cycles. Intensity does not change duration except as the days the user logged. Default start flow: `medium`.

Accidental one-day medium **does** create a period start (golden I).

---

## 23. Pain

Structured `painEntries`: types cramps, pelvic, lower_back, headache, breast, ovulation_side, other × mild/moderate/severe. Max 7, unique type. Pain-managed symptom IDs filtered from new symptom pickers.

Does not affect predictions. Sent to AI as `ტკივილი=type:severity`. Partner share does **not** include pain.

---

## 24. Symptoms

~45 physical chips + 17 moods + 6 sexual chips stored **in the same `symptoms` array**. No search/favorites. Multi-select. Historical edit = reopen that date.

Compared with Flo/Clue: catalog is reasonably rich; organization is a grid, not a guided daily interview.

---

## 25. Notes

Max 2000. Copy says partner does not get notes. AI prompt **omits** notes (`CYCLE_OBSERVATION_AI_RULES`). Doctor JSON summary does not include raw notes. Export JSON (`GET /export`) includes logs (notes present in lifecycle export — verify before sharing files).

Consumers: CycleLog DB, journal UI, offline cache, JSON export, Health not applicable.

---

## 26. Calendar

Month nav, past select, future predicted rings vs logged fills (`CycleCalendar.tsx`). Fertile/ovulation solid purple. Today = device local. Legend on full sheet.

**Ambiguity:** home `WeekDots` fill any `mark.period` — predicted and logged look the same.

---

## 27. History

`CyclePeriodHistory`, journal, trends + PMS heatmap, doctor summary. User can see lengths and patterns when ≥2–3 complete cycles. Predicted vs actual comparison is strongest on the calendar (ring vs fill), weaker in trends (lengths only).

---

## 28. Onboarding

Gated when FEMALE and no `lastPeriodStart`.

1. Last period start (approx OK).
2. Contraception method or skip (`null`).

**Not asked:** typical length, irregular, conditions, mode, “I don’t know my date” beyond approx. Privacy sentence present. `onboardBody` oversells that forecasts help you “feel better / be ready” without hedge.

---

## 29. TTC

Mode `TRY_TO_CONCEIVE` exists. UI: `CycleTtcCard`, OPK/BBT/mucus/sex logging, fertility reminders, conflict sheet if hormonal contraception.

Missing vs mature TTC: intercourse timing protocol, insemination, sperm/egg education beyond copy, confirmed ovulation, pregnancy probability.

---

## 30. BBT

Manual °C, 34–42 validation. Chart: last 60 points in trends. No device auto-sync interpretation, no biphasic detection. Does not confirm ovulation (correct). HealthKit/Connect can write BBT quantity.

---

## 31. Ovulation tests

`negative | positive | unclear`. No separate “peak”. Does not affect predictions. Cards say not confirmed ovulation.

---

## 32. Cervical mucus

`dry | sticky | creamy | watery | eggwhite`. Symptom/observation, not a fertility algorithm. Copy: Medicard does not confirm fertility from mucus.

---

## 33. Pregnancy testing

Same three states. Positive **does not** auto-set pregnancy mode; client offers `CyclePregnancyTransitionSheet`. Server does not infer pregnancy from late period.

---

## 34. Pregnancy mode

Exists. Due date + LMP+280 gestational age + fetal-size metaphors + checklist `PregnancyLog`. Transition is user-initiated. Cycle predictions hidden when mode is PREGNANCY for next-period cards.

Gap: no structured “exit pregnancy / miscarriage / postpartum” that quarantines the gap from averages (the 18–45 filter helps mathematically, but UX/mode story is missing).

---

## 35. Postpartum

No mode. Long amenorrhea: late alert after **&gt;40 days since last logged flow**; forecast still projects from old LMP for ~90 days. Gap &gt;45 excluded from mean — good. Returning first period becomes new LMP; old in-band gaps can still drive the average.

---

## 36. Pregnancy loss

No representation. Do not gamify. Future must be explicit, sensitive, and must not treat loss interval as a normal cycle (engine already drops &gt;45 gaps).

---

## 37. Contraception

Methods: NONE, combined/progestin pill, hormonal/copper IUD, implant, injection, patch, ring, barrier, FAM, OTHER.

LIMITED (systemic hormones): hide fertility markers; relabel bleeding. CAUTION (hormonal IUD, FAM, OTHER): context card, FAM “not certified”. Engine math **unchanged**.

TTC + inconsistent method → `ttcConflict` flag.

Does not model pill-placebo bleeds vs periods. Copper IUD treated as NORMAL fertility display.

---

## 38. Perimenopause readiness

Condition chip only (`perimenopause`). Architecture assumes modulo cycling from LMP. Skipped periods look like “late” or get dropped as outliers. **Poor support** without a mode that stops inventing ovulation.

---

## 39. No-period tracking readiness

Feature **requires FEMALE** and onboarding LMP. Hormonal amenorrhea / post-procedure users cannot use the module without a fake LMP. Symptom logging is tied to cycle days. Architectural limitation.

---

## 40. Cycle modes architecture

Three modes on one profile. Clean enough to add PERIMENOPAUSE / TRACK_WITHOUT_PERIOD later **if** forecast presentation is gated the same way LIMITED contraception is (do not feed fake ovulation). Do not implement now.

---

## 41. Current insights

- Local deterministic cards: `buildLocalInsights` (phase, cramps, mood, TTC window, next period).
- EvidenceMD JSON cards via POST `/insights`, cache 18h, fallback to local.
- Alerts: heavy ≥8 consecutive days, irregular last gap, late &gt;40d, PCOS/endo info.

---

## 42. Pattern detection

`buildHistoricalAnalytics`: last 12 pattern-valid cycles (length 18–60), coverage thresholds, pain/symptom/mood/lifestyle frequencies, PMS heatmap.

Minimum: basic stats ≥2 complete cycles; recurring ≥3 and coverage ≥0.15. Quality LOW/MEDIUM/HIGH from coverage.

Language in UI/AI rules: correlation ≠ cause. No “your period causes headaches” detector found in engine copy.

---

## 43. Current OpenRouter / AI integration

**Cycle does not call OpenRouter.**

Path: `runTrackedAi` → `askEvidenceMd({ mode: 'CYCLE_WELLNESS' })`.

- Temperature 0.55, maxTokens 1200.
- System: `server/src/lib/prompts.js` `CYCLE_WELLNESS` (Georgian JSON cards; “do not say you are ovulating today”).
- User: `buildCycleAiUserPrompt` — last 7 logs, estimated phase/dates, confidence, conditions, contraception, historical pattern lines.
- Parse: `parseCycleInsightsJson` — headline, phaseLabel, cards[].
- Timeout/retry: inherited from EvidenceMD client (not re-specified in cycle.routes).
- Fallback: local insights, `source: 'local_fallback'`.
- Credit: only if JSON parses.

OpenRouter **is** used elsewhere (vision, symptoms, onboarding, weight). Reuse that stack later if Cycle moves off EvidenceMD; do **not** add a second cycle-specific LLM client.

---

## 44. Medi chat Cycle integration

`withPatientAiContext` (`server/src/lib/patient.js`) adds only `ციკლის რეჟიმი: {mode}`.

Medi can **hallucinate** cycle day / ovulation because it does not receive deterministic predictions. Companion privacy blocklist includes `cycle` so companion payloads should not dump cycle logs.

Future “Ask Medi about my cycle” should open existing Medi with a **structured, minimized** context from the bundle — not a new bot.

---

## 45. AI privacy

Sent: recent flow, symptom keys (including sex tags), moods, OPK/BBT/mucus/pregnancy-test bits, pain, sleep, stress, age, mode, estimated dates, self-reported conditions/contraception, aggregate pattern lines.

Not sent: journal notes, custom tag names, libido field, `sexualActivity` boolean (but **unprotected** etc. still leak via symptoms).

No separate “use Cycle data in Medi” toggle beyond general AI/privacy policy (`privacyPolicyKa.ts` §3.3 discloses cycle processing).

---

## 46. AI safety

Strengths: honesty rule lists, USER_LOGGED vs ESTIMATED split, no diagnosis, FAM not certified, parse-and-truncate cards, local fallback, contraception LIMITED prompt lines.

Weaknesses: model still generates free Georgian prose (output schema is shallow); Medi chat lacks cycle facts so it may invent them; red-flag layer is light (heavy-flow alert + “see a doctor” copy), not a deterministic emergency classifier.

---

## 47. Future AI architecture

See §79 in this document. Principle already in code comments: **AI must never be the calculator.**

---

## 48. Notification behavior

Client-only scheduler `syncCycleReminders` at 09:00 local:

| Pref | Rule |
|---|---|
| period soon | `nextPeriodStart − periodDaysBefore` |
| period start | `nextPeriodStart` |
| ovulation / fertile / OPK | TTC mode + fertility markers allowed |
| PMS | `ovulationDate + 2` |
| BBT | TTC + no BBT today |
| daily log | no log today |

`cancelCycleReminders` first. Masked lock-screen template `cycle-masked`.

---

## 49. Notification Brain integration

Templates live in admin `pushTemplates.js` group `cycle` and client `pushCopy.ts`. `notificationCatalog.ts` documents channels. `mediNotificationBrain` has a `cycle_log` **action kind** (deep link), not a second prediction engine.

**No server cron** found that fires cycle-period-soon from predictions. Engage template `engage-insight-cycle` is marketing copy, not the calculator.

Conflict risk: admin-sent cycle templates vs local schedule — copy mismatch (honesty), not double math.

---

## 50. Partner sharing

30-day hashed token, one live invite, accept binds partner. Peek 404s uniformly. Permissions: period, cyclePhase, fertileWindow, symptoms (default fertile/symptoms **false**).

Payload rebuilds estimates; leak-guard forbids notes, tests, BBT, mucus, sexualActivity keys — **not** symptom ids such as `unprotected`.

---

## 51. Doctor sharing / export

No server PDF. Bundle `summary` from `buildDoctorSummary` + client `cycleReport.ts` HTML/PDF. Fields: mode, averages, next period, ovulation, fertile window, top symptoms/moods, cycle stats, fertility tests, pain, lifestyle, historical slice.

ICS export labels predicted events.

JSON `GET /export` full module dump.

---

## 52. Analytics privacy

No Cycle-specific ProductEvent payload with notes/sex found in mobile cycle libs. Admin counts profiles/logs. Bundle `analytics` is on-device/API private (`Cache-Control: private`). Partner serializer forbids `analytics` key.

---

## 53. Deletion / privacy

`POST /wipe` confirm `DELETE_CYCLE_DATA` → shares revoked, logs/tags/pregnancy/profile deleted. Account delete `deleteUserAccount` revokes shares then Prisma cascade.

AI cache lives on profile (wiped). Offline encrypted queue is client-side — wipe should discard pending (client responsibility). OS notifications until next cancel.

---

## 54. Authorization

Owner routes: session + FEMALE. Share peek: bound partner, not expired/revoked, owner not BLOCKED. Tests: `cycleShare.test.js`. Cross-user CycleLog access is scoped by `req.user.id`.

---

## 55. Offline

iOS/Android: SecureStore DEK encrypted queue. Web: session-only. Overlay pending on bundle. Banner + discard. Doctor report warns pending excluded. Conflicts: last write at flush; unique date upsert.

---

## 56. Multi-device

Profile + logs server-authoritative after sync. Two devices logging the same date last-write-wins on fields. Duplicate period start: idempotent if already period flow. Stale predictions until fetch. Reminder prefs mirrored on profile JSON.

---

## 57. Idempotency

Log upsert; start skip if already bleeding; fill skip existing period flow; share accept first-writer; insights cache. Multi-day fill is sequential upserts (not one transaction).

---

## 58. Cache invalidation

Bleed writes → `emptyCycleAiCache()`. Profile PATCH should go through bundle rebuild. Insights TTL 18h unless `refresh`. Client reminders rebuilt on `syncCycleReminders`. Historical analytics recomputed each `loadBundle` (not cached separately).

---

## 59. HealthKit / Health Connect

Settings card. Writes: menstrual flow, intermenstrual spotting, mucus, BBT. OPK/pregnancy **not written**. Can import LMP from Health in settings. Expo Go limitations copied in UI.

---

## 60. Wearable readiness

Health sync exists for BBT quantity. No wrist temperature / HR / sleep → ovulation model. Architecture can ingest more Health samples later; must not claim confirmation.

---

## 61. Provenance

Calendar marks: `predicted`, `estimated`, `logged`, `flow`. Fertility tests labeled `user_logged`. No enum `USER_LOGGED | DEVICE_SYNCED | DERIVED | PREDICTED | AI_GENERATED` on rows. AI cards have `source: 'local' | 'ai' | 'local_fallback'`.

---

## 62. Performance

400 logs per bundle by design (~1–2 years daily). Analytics payload test keeps &lt;80KB. Calendar stamps ≤500 days. Risk: daily loggers lose year 3+. N+1 not on the hot path (one findMany). Client rerenders are screen-local.

---

## 63. Accessibility

Calendar cells have composite labels (logged vs predicted). Home week dots color-only. Fertility diamond often `accessibilityElementsHidden`. NativeWind `Pressable` function styles still present on calendar chevrons (known app-wide gotcha — may drop layout styles). Contrast via theme tokens. Dynamic Type not systematically tested here. Reduced motion: Reanimated ZoomIn/FadeInDown on calendar.

---

## 64. Localization

Product UI is **Georgian-only** (`ka.ts`). No en/fr/ru packs. Enum keys (`spotting`, OPK, BBT, TTC, PMS, PCOS) leak into labels. Dates via Georgian month constants.

---

## 65. Georgian UX language

Most honesty strings are careful (`სავარაუდო`, `არა დადგენილი ფაქტი`). Awkward/imprecise:

- `conditionPcos: 'ოვარიუმის კისტები'` — not PCOS.
- `logHubSymptoms: 'ტკივილი'` for a general symptoms pane.
- Mixed English: spotting, fertility-awareness, heads-up in push.
- Push titles more certain than in-app.

---

## 66. Test coverage

Existing: cycle, period, share, honesty, fertility, contraception, observations, history, lifecycle, mobile offline.

Gaps: API integration/authz e2e, timezone traveler UI, notification invalidation, HealthKit, accessibility, 400-log window, Medi chat hallucination, partner+sex-tag symptoms.

**Added this audit:** golden A–R diagnostic unit tests (28).

---

## 67. Golden test suite results

All run against **current** formulas (`node --test src/lib/cycleGoldenAudit.test.js`) — **28 pass**.

| ID | Scenario | Current behavior |
|---|---|---|
| A | 28-day ×3 gaps | inferred 28; next = LMP+28; ov = LMP+14; fertile ov−5…+1; confidence medium |
| B | 30-day | inferred 30; next LMP+30 |
| C | 24/34 | mean 29 (not median); confidence medium |
| D | 23/37/29/45 | mean 34; six 21/45 → **high** if flag off |
| E | 1 start | no infer; source default 28/5; low |
| F | 2 starts (1 gap) | still not personalized; uses stored |
| G | 6 gaps | high |
| H | spotting around bleed | period starts on first light/medium/heavy |
| I | 1-day mistaken bleed | creates a start; excluded from period-length mean |
| J | 60-day gap | dropped; remaining 28s infer 28 |
| K | 15-day gap | dropped |
| L | edit earlier same-run day | LMP rewinds |
| M | TZ | UTC date-key stable; Tbilisi today ≠ UTC ISO date |
| N | DST civil addDays | 2026-03-28+1 = 03-29 |
| O | ~280-day gap | not averaged; LMP = latest start |
| P | end/fill | end fill=[]; shortening clears later bleed |
| Q | period-only logs | still infers cycle length; 1-day runs fall back period length 5 |
| R | overlap / future | start idempotent; future rejected |
| gap | skip one bleed day | **two** period starts |
| overlay | logged vs predicted | logged `predicted:false`; spotting not period |
| late | late alert | **&gt;40 days since last FLOW**, not vs predicted start |
| AI | prompt | includes `unprotected` symptom; omits notes |

---

## 68. Flo comparison

| Concept | Status |
|---|---|
| Rich daily tracking | PARTIAL (strong catalog, less guided) |
| Personalized insights | PARTIAL (local + EvidenceMD) |
| Cycle reports | PARTIAL (doctor HTML/PDF) |
| Goal modes | PARTIAL (3 modes; no peri / no-period) |
| Health assistant | PARTIAL (Medi exists; weak cycle facts) |
| Reminders | WE HAVE (client) |
| TTC | PARTIAL |
| Pregnancy | PARTIAL |
| Clone UI | NOT APPROPRIATE |

---

## 69. Clue comparison

| Concept | Status |
|---|---|
| Analysis / history | PARTIAL |
| Period / fertile / ovulation predictions | WE HAVE (calendar method) |
| PMS predictions | PARTIAL (heatmap + ovulation+2 reminder) |
| BBT | PARTIAL (manual) |
| Custom tags | WE HAVE |
| Irregular handling | PARTIAL / weak |
| TTC / pregnancy / peri | PARTIAL / MISSING peri |
| Partner sharing | WE HAVE |
| Tracking guidance | PARTIAL |

---

## 70. Apple Cycle Tracking comparison

| Concept | Status |
|---|---|
| Logged vs predicted visual | WE HAVE on main calendar; MISSING on home dots |
| Fertile prediction | WE HAVE |
| Prediction notifications | WE HAVE (client) |
| Cycle history | PARTIAL |
| Possible cycle deviations | PARTIAL (gap alerts only) |
| Wearable-assisted prediction | MISSING (Health write/read limited) |
| Retrospective ovulation | MISSING (correctly not faked) |

---

## 71. Feature-gap matrix

| Capability | Status | Quality | Safety | UX | Benchmark | Priority | Notes |
|---|---|---|---|---|---|---|---|
| Daily bleed log | HAVE | High | High | High | High | — | Spotting correct |
| Period start/end | HAVE | High | High | High | High | — | End does not invent days |
| Calendar forecast | HAVE | Med | Med | High | High | P1 | Default 28-day looks certain |
| Confidence | HAVE | Low | Med | Med | High | P1 | Count only |
| Irregular support | PARTIAL | Low | Med | Low | High | P1 | Flag + drop outliers |
| Fertile/ovulation copy (in-app) | HAVE | High | High | High | High | — | Hedged |
| Fertile/ovulation copy (push) | HAVE | Low | Low | Med | High | **P0** | Over-certain |
| TTC observations | HAVE | Med | High | Med | High | P2 | Not in engine (good) |
| BBT algorithm | MISSING | — | — | — | Med | P3 / NO as confirmer |
| Pregnancy mode | PARTIAL | Med | Med | Med | High | P2 | Exit/loss missing |
| Perimenopause | MISSING | — | — | — | High | P2 architecture |
| Partner share | HAVE | High | Med | Med | Med | P1 | Sex tags in symptoms |
| Doctor summary | PARTIAL | Med | High | Med | Med | P2 | |
| Cycle AI insights | HAVE | Med | Med | Med | High | P1 | EvidenceMD; sex in prompt |
| Medi cycle Q&A | PARTIAL | Low | Low | — | High | P1 | Mode only |
| Health sync | PARTIAL | Med | High | Med | High | P2 | |
| Offline | HAVE | High | High | High | Med | — | |
| en/fr/ru | MISSING | — | — | — | Med | P3 | Product is KA-first |
| Contraception-aware UI | HAVE | High | High | High | High | — | Presentation only |

---

## 72. P0 issues

1. **Unsafe ovulation/fertile push wording** — `mobile/src/lib/pushCopy.ts` `cycle-ovulation` title “ოვულაციის დრო ახლოვდება”; body treats today as an important conception day. Lock-screen. Contradicts in-app honesty (`insightOvulationBody`).
2. **Sexual symptom keys in EvidenceMD prompt** — `persistCycleLog` writes sex chips into `symptoms`; `buildCycleAiUserPrompt` dumps last 7 days’ symptom keys. Golden test matches `unprotected`. Notes/libido are excluded. Third-party model sees sexual detail without a dedicated consent surface.

No authorization hole found in share tests. Stored date keys do not shift after write.

---

## 73. P1 issues

- Confidence ignores variance (golden D).
- One-day logging gap splits periods and can move LMP.
- Personalized averages need 2 gaps; UI still shows default calendar rings at 0–1 gaps.
- Device today ≠ Tbilisi today for travelers.
- 400-log window silently drops older history.
- Late alert is 40 days since last **flow**, not days past predicted period (regular 28-day users wait ~2 weeks after a missed period).
- Partner `symptoms` permission includes sex-tag ids.
- Medi chat lacks deterministic cycle facts (hallucination risk).
- PCOS label “ოვარიუმის კისტები”.
- Home week dots: predicted = logged visually.
- PMS reminder = ovulation+2, not user pattern.
- No computed irregularity; outlier drop hides variability.

---

## 74. P2 opportunities

- Retrospective ovulation **estimate** (clearly labeled), using OPK/BBT without confirming.
- Cycle history: predicted vs actual table.
- Doctor PDF richer structured patterns.
- Import multiple historical period starts (migration from other apps).
- Perimenopause / no-period presentation gates.
- Pregnancy exit / postpartum / loss flows.
- Pattern insights with N-of-M already in analytics — surface more clearly.
- Accessibility pass (home dots, Dynamic Type, NativeWind pressables).

---

## 75. P3 ideas

- Custom favorites, search, English locale, wearable HR/temp educational overlays, ICS polish, animation reduction setting.

---

## 76. Things we should NOT build

- Flo/Clue UI clone.
- AI as cycle calculator.
- “Safe days” / contraception from the calendar.
- PCOS/endometriosis/pregnancy **detectors**.
- Confirmed ovulation from calendar or single OPK/BBT.
- Diagnostic percentages of fertility.
- A second chatbot.
- A second notification brain.
- Sending full health DB or journal to any LLM.

---

## 77. Recommended product modes (architecture only)

Keep one `CycleProfile.mode` enum. Eventually:

1. Period tracking (default)
2. Trying to conceive
3. Pregnancy
4. Perimenopause (presentation: low certainty, no fake ovulation emphasis)
5. Track without period (symptoms only; hide calendar fertile math)

Contraception stays an overlay, not a mode.

---

## 78. Recommended deterministic-engine architecture

Keep `cycle.js` as single forecast owner.

Evolve later (not now):

- Segmentation: configurable gap (e.g. allow 1-day miss inside a run).
- Averages: median or trimmed mean + **variance → confidence**.
- Provenance on calendar cells.
- Quarantine intervals (pregnancy, postpartum, pause) excluded from means **and** from LMP wrapping.
- Never write inferred averages back over user-stored (already true).

---

## 79. Recommended OpenRouter AI architecture

Do **not** switch Cycle to OpenRouter until there is a product reason. Reuse **one** central LLM gateway (today: EvidenceMD for chat/cycle insights; OpenRouter for vision/other).

**Deterministic engine calculates:** cycle day, phase, next period, fertile window, ovulation estimate, averages, confidence, alerts, patterns (counts).

**LLM receives:** short structured facts + honesty metadata, never journal, never sex tags unless explicit TTC consent, never raw GPS.

**Allowed:** explain estimates, summarize N-of-M patterns, educational guidance, doctor questions, encourage logging, express uncertainty.

**Forbidden:** new dates, diagnoses, contraception assurance, medication doses, “you are ovulating”, pregnancy guess.

**Output schema (future):** summary, observations[], suggestions[], questionsToConsider[], education[], redFlags[], disclaimer, sourceSignals[].

**Confidence:** pass `INSUFFICIENT_DATA | LOW | MEDIUM | HIGH` plus `source: default|user|inferred` and `variability`.

**Validation:** parse JSON; drop medical-claim regex; overlay deterministic red flags **before** model.

**Cache:** invalidate on any log/profile write (already mostly true).

**Consent:** explicit Cycle→Medi toggle; contextual disclosure on insights.

---

## 80. Recommended safety architecture

```
DETERMINISTIC RULES (heavy flow, late, irregular, contraception LIMITED)
        ↓
SAFE STRUCTURED CONTEXT
        ↓
LLM (optional)
        ↓
OUTPUT VALIDATION
        ↓
USER
```

Reuse existing `CYCLE_*_AI_RULES` and `buildCycleAlerts`. Do not let the model invent seek-care thresholds.

---

## 81. Recommended privacy architecture

- Split sex tags from `symptoms`.
- Partner symptoms ≠ sexual events.
- AI allowlist of symptom keys.
- Keep notes local-only unless user includes them in a doctor export.
- Minimize Medi context to mode + optional “today estimated phase + confidence”.
- Retain wipe + hashed shares + private cache headers.

---

## 82. Recommended future UX architecture

Every surface: **LOGGED / DERIVED / PREDICTED** with shape, not only color.

Zero history: “generic 28-day estimate” not “your period”.

Irregular: show range, not a fake precise day.

Home card: same predicted-vs-logged language as the calendar.

Ask Medi: one button into existing Medi with structured context.

---

## 83. Recommended implementation order

**Next phase only:** Safety and honesty hardening (P0 copy + AI/partner minimization + confidence labeling + timezone contract documentation/fix). Then engine irregularity. Then modes/TTC depth. Then richer AI.

---

## 84. Files inspected

Backend: `cycle.routes.js`, `cycle.js`, `cyclePeriod.js`, `cycleHistory.js`, `cycleHistoryAnalytics.js`, `cycleHonesty.js`, `cycleFertility.js`, `cycleContraception.js`, `cycleObservations.js`, `cycleShare.js`, `cycleLifecycle.js`, `prompts.js`, `patient.js`, `evidencemd.js`, `deleteUser.js`, `pushTemplates.js`, `mediCompanion/privacy.js`, `schema.prisma`, existing `cycle*.test.js`.

Mobile: `app/cycle/*`, `components/cycle/*`, `lib/cycle*.ts`, `constants/cycle.ts`, `i18n/ka.ts`, `HomeCyclePreviewCard`, `cycleReminders.ts`, `pushCopy.ts`, `healthSync*`, `privacyPolicyKa.ts`.

Docs: `docs/CYCLE_PRODUCT_SPEC.md` (partly stale on client engine duplication).

---

## 85. Tests added

`server/src/lib/cycleGoldenAudit.test.js` (registered in `server/package.json` `test` script). Diagnostic only.

---

## 86. Tests run

```
node --test src/lib/cycleGoldenAudit.test.js
ℹ tests 28  pass 28  fail 0
```

Existing cycle unit files were not modified. Full `npm test` not required for this audit phase.

---

## 87. Unresolved questions

1. Should engine today remain Asia/Tbilisi forever (GE product) or follow device locale with a stored timezone?
2. Is 400 logs the accepted ceiling for 5-year history, or should period-start extraction query beyond daily logs?
3. Should sex tags be a breaking schema split or a filter in serializers only?
4. Product stance on OTHER/non-binary users who menstruate (`assertFemale`).
5. Keep Cycle insights on EvidenceMD vs routing through the existing OpenRouter gateway?
6. How should pregnancy loss be named in Georgian with clinician review?

---

## 118. Scorecard (0–10)

| Dimension | Score | Why |
|---|---|---|
| CORE LOGGING | 8 | Rich daily model; start/end/fill careful; unique date upsert |
| CYCLE MATH | 7 | Civil-day math is sound; 1-day gap split is the main weakness |
| PREDICTION QUALITY | 6 | Standard calendar method; honest as an estimate; over-precise UI |
| IRREGULAR CYCLE SUPPORT | 4 | Flag + discarded outliers; high confidence still possible |
| FERTILITY SAFETY | 6 | Excellent in-app hedges; weak push; no “safe days” found |
| HISTORY | 6 | Trends/PMS exist; 400-cap; weak predicted-vs-actual table |
| DAILY TRACKING | 8 | Broad catalog, pain structured, hub UX |
| PERSONALIZATION | 5 | Inferred after 2 gaps; default 28 looks personal |
| AI READINESS | 6 | Gateway + rules + cache; minimization hole; chat under-informed |
| PRIVACY | 7 | Wipe, share defaults, notes out of AI; sex-in-symptoms |
| SECURITY | 8 | Authz + hashed shares + female gate |
| UX | 7 | Calendar distinction good; home/onboarding less so |
| ACCESSIBILITY | 5 | Some labels; color-only home; unverified Dynamic Type |
| LOCALIZATION | 4 | KA-only; some machine-ish / imprecise medical terms |
| DOCTOR USEFULNESS | 5 | Summary exists; not a clinic-ready packet |
| OVERALL PRODUCT MATURITY | 6 | Stronger than an MVP; not yet top-tier tracker quality |

---

## 119. Final status

CYCLE AUDIT COMPLETE: **YES**

PRODUCTION-SAFETY BLOCKERS: **2**

P0: **2**  
P1: **12**  
P2: **8**  
P3: **5**

CURRENT ENGINE TRUSTWORTHY: **PARTIALLY**

READY FOR AI PERSONALIZATION: **PARTIALLY**

READY FOR PRODUCT EXPANSION: **NO**

RECOMMENDED NEXT PHASE: **Safety and honesty hardening (push wording, AI/partner field minimization, confidence honesty, timezone contract)**

STOP.
