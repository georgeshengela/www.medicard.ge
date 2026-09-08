# Cycle Phase 2 — safety + honesty hardening

**Date:** 2026-09-08  
**App version:** mobile `37.0.1` (patch)  
**Scope:** close Phase 1 P0 blockers. No Flo/TTC/pregnancy/BBT/LH expansion. No OpenRouter switch. No UI redesign. No forecast-math rewrite.

**Tests:** `npm test` in `server/` → **621/621 pass**, 0 fail.

---

## 1. Files changed

Central helpers: `cycleAiContext.js`, `cycleCivilDate.js`, `predictionConfidence` in `cycle.js`.

| Area | Files |
|---|---|
| AI allowlist | `server/src/lib/cycleAiContext.js`, `cycle.js`, `cycle.routes.js` |
| Partner | `server/src/lib/cycleShare.js` |
| Confidence | `server/src/lib/cycle.js` |
| Timezone | `server/src/lib/cycleCivilDate.js`, `cycle.routes.js`, `mobile/src/lib/api.ts`, calendar/strip/reminders |
| Push copy | `server/src/lib/pushTemplates.js`, `mobile/src/lib/pushCopy.ts`, `notificationCatalog.ts` |
| UI copy | `mobile/src/i18n/ka.ts` |
| Tests | `cycleAiContext.test.js`, `cycleCivilDate.test.js`, golden/share/push/cycle tests |
| Docs | `docs/CYCLE_SAFETY_CONTRACT.md`, this file |
| Version | `mobile/app.json` 37.0.0 → 37.0.1 |

---

## 2–3. Push wording before / after

**`cycle-ovulation`**

| | Before | After |
|---|---|---|
| Title | ოვულაციის დრო ახლოვდება ✨ | სავარაუდო ოვულაცია ახლოვდება ✨ |
| Body | თუ ორსულობას გეგმავ, დღეს შეიძლება ერთ-ერთი მნიშვნელოვანი დღე იყოს | კალენდრის მიხედვით, სავარაუდო ოვულაციის დღე ახლოვდება. ეს შეფასებაა — ციკლი ყოველთვის ზუსტად არ მიჰყვება კალენდარს |

**`cycle-fertile`**

| | Before | After |
|---|---|---|
| Title | ნაყოფიერი დღეები დაიწყო 🌱 | სავარაუდო ნაყოფიერი ფანჯარა 🌱 |
| Body | შენი სავარაუდო ნაყოფიერი ფანჯარა დაიწყო. თუ ორსულობას გეგმავ… | შენი სავარაუდო ნაყოფიერი ფანჯარა შეიძლება იწყებოდეს. ეს კალენდარული შეფასებაა — პროგნოზი შეიძლება შეიცვალოს |

**`cycle-opk` body:** “ოვულაციას აკვირდები” → “ოვულაციის ტესტს იყენებ”.

Deep links unchanged: ovulation `/cycle/log?tab=more`, fertile `/cycle`.

**Operational note:** admin-edited rows in `PushTemplate` can still override defaults until re-saved. Code defaults and mobile FALLBACKS are honest.

---

## 4. Fertility-related push surfaces audited

| Surface | Verdict |
|---|---|
| `cycle-ovulation` / `cycle-fertile` | Fixed (P0) |
| `cycle-period-soon` / `cycle-period-start` | Already hedged (“სავარაუდოდ”, “შეიძლება”) |
| `cycle-pms` | Already hedged (“შეიძლება”) |
| `cycle-opk` | Softened |
| `cycle-bbt` / `cycle-log` / `cycle-tip` | No fertility certainty |
| `cycle-masked` | Discreet; no cycle words |
| `engage-insight-cycle` | Generic trend; no ovulation claim |
| Notification Brain | Still the only scheduler. Copy via `applyPushCopy`. No second scheduler. |
| `ka.cycle.remOvulationBody` | Softened (“შეიძლება სავარაუდო”) |
| In-app insight cards | Already estimated; low-confidence strings now say სანდოობა not სიზუსტე |

---

## 5. Contraception wording audit

No “safe days”, “infertile days”, “cannot get pregnant”, or Georgian equivalents in Cycle push defaults. In-app already says Medicard is not contraception. LIMITED hormonal methods still hide fertility markers (`cycleContraception.test.js` pass). Fertility reminders stay gated on `showFertilityMarkers`.

---

## 6–9. AI context

**Before:** last-7-day `CycleLog` lines dumped `symptoms` (including `unprotected`), omitted notes/libido.

**After:** `serializeCycleLogForAi` / `buildCycleWellnessContext`. Raw DB objects do not flow to EvidenceMD.

**Allowed categories:** `general_cycle`, `bleeding`, `general_wellness` (allowlisted chips + sleep/stress), `mood` (allowlisted), `pain` (structured painEntries), `fertility` (existing OPK/BBT/mucus/pregnancy-test observations — not expanded).

**Excluded by default:** `sexual_health`, `private_notes`, `free_text`, `unknown`, TTC/pregnancy attempts as chips, `sexualActivity`, `libido`, custom tags, caffeine/alcohol/exercise, undeclared object fields.

DEV/test inspect: `inspectCycleAiCategories` returns category names only (no raw values). Not attached to production `/insights` JSON.

EvidenceMD `CYCLE_WELLNESS` unchanged. **OpenRouter was not added.**

---

## 10–12. Sexual / notes / unknown tests

`cycleAiContext.test.js` + golden AI case:

- `unprotected` / `protected` / `sex` / `pain_sex` absent from prompt
- `cramps` / `headache` / `anxious` / `flow=medium` survive
- `secret journal` absent (notes still excluded)
- `future_chip_xyz` / `brand_new_sensitive_chip` excluded
- `futureSecret` object field excluded
- inspect JSON does not contain raw `unprotected` or journal text

---

## 13–14. Partner serializer

**Finding:** symptoms scope previously returned the raw `symptoms` array, so sexual chips leaked when the owner enabled symptoms. Notes/OPK/BBT/libido were already omitted.

**Change:** `partnerSafeSymptomKeys` (wellness + mood allowlist). Unknown keys dropped. `partnerPayloadHasLeak` flags sexual chip JSON. Default scopes unchanged (`period` + `cyclePhase` on; fertile/symptoms off).

---

## 15–19. Confidence

**Before:** LOW if irregular or `<2` gaps; MEDIUM if `<6`; HIGH if `≥6`. Variance ignored. Six 21/45 cycles → HIGH.

**After (still LOW / MEDIUM / HIGH):**

| Label | Rule |
|---|---|
| LOW | `isIrregular` OR `<2` gaps OR in-band **range > 14** days |
| HIGH | `≥6` gaps AND lengths provided AND **range ≤ 7** |
| MEDIUM | everything else, including `≥6` gaps **without** lengths |

**Metric: range (max − min)** of the same 18–45 day gaps the engine already uses. Chosen because `cycleLengthStats.variability` already exists, it is deterministic, it needs no fake %, and 21/45 cannot look HIGH. MAD/SD would be more outlier-robust; range is conservative (see scenario F).

| Scenario | Result |
|---|---|
| A: 6 × 28 | HIGH |
| B: 6 × 21/45 | LOW (range 24) |
| C: 3 regular | MEDIUM |
| D: 1 gap | LOW |
| E: irregular flag + 6 × 28 | LOW |
| F: 5 × 28 + one 45 | LOW (range 17 > 14). Isolated outliers currently suppress HIGH. |

Irregular + HIGH is impossible.

---

## 20–26. Timezone

**Before:** engine `today` = `Asia/Tbilisi`; calendar/reminders = device local `Date`.

**After:**

1. `X-Client-Timezone` (device)
2. stored Quest profile timezone
3. `Asia/Tbilisi`

Reused Quest resolution (device-first) rather than a new schema. Historical `YYYY-MM-DD` never mutates when traveling. Only “today” follows the clock.

Reminders: engine civil dates from the bundle; fire 09:00 **device local**. Comparison “is this still in the future?” uses `bundle.meta.today`.

DST/midnight: `cycleCivilDate.test.js` — Tbilisi, Brussels, NY, LA, Tokyo; Brussels DST; 23:30 / 00:01 edges; stored `2026-09-08` stable.

**P1 leftover:** client `addDaysToKey` still uses local `Date` (not UTC civil add). Server `addDays` is UTC. Not changed this phase.

---

## 27. Notification Brain

Unchanged architecture. Copy + timezone interpretation only. Deep links preserved.

---

## 28. Hormonal contraception

LIMITED still hides fertility markers. Existing `cycleContraception.test.js` + lifecycle LIMITED tests pass. No modeling expansion.

---

## 29. Fertility UI wording

No layout redesign. Confidence strings: “მაღალი სიზუსტე” → “პროგნოზის სანდოობა: მაღალი …”. Low-confidence insight/reminder strings use სანდოობა.

---

## 30–32. EvidenceMD / OpenRouter / analytics

Cycle insights still EvidenceMD `CYCLE_WELLNESS`. No OpenRouter Cycle route.

Push event log still stores template title/body (lock-screen copy), not CycleLog chips. Partner/AI/notification payloads do not wholesale-serialize CycleLog. Flag: admin push-event rows can contain fertility *copy* when mask is off — existing, not a new chip leak.

Lock-screen privacy: `maskNotifications` already swaps `cycle-masked`. `privacyEnabled` remains a separate client setting and does **not** auto-mask. No new privacy system.

---

## 33–38. Test results

| Suite | Result |
|---|---|
| Golden (`cycleGoldenAudit.test.js`) | pass (confidence + AI cases updated and documented) |
| Cycle + period + honesty + fertility + contraception + observations + history + lifecycle | pass |
| Notifications (`pushTemplates.test.js`, `push.test.js`) | pass |
| AI privacy (`cycleAiContext.test.js`) | pass |
| Partner (`cycleShare.test.js`) | pass |
| Full `server` `npm test` | **621/621** |
| Runtime/build | no Cycle syntax/load errors after removing a duplicated prompt fragment |

---

## 39. Remaining P0

**0.** Both Phase 1 P0s closed.

---

## 40. Remaining P1

Closed in Phase 3 except:

7. **`privacyEnabled` ≠ lock-screen mask.**

---

## 41. Unresolved (out of scope)

Pregnancy mode, TTC expansion, BBT/LH productization, OpenRouter Cycle AI, forecast rewrite, irregular-cycle clinical claims, period segmentation redesign.

---

## Next phase (exactly one)

**Engine irregularity + segmentation hardening** — close the one-day bleed-gap splitter, then the 400-log window and late-period rule. Do not start Flo-like feature expansion.

This is **not** Cycle product FINAL.
