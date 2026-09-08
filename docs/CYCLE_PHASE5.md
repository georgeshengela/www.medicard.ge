# Cycle Phase 5 — approved Fable 5 UX implemented

**Date:** 2026-09-08  
**App version:** mobile `39.0.0` (major — Cycle IA + visual system)  
**Design source:** `docs/CYCLE_DESIGN.md`  
**Frozen:** `CYCLE_ENGINE.md`, `CYCLE_SAFETY_CONTRACT.md`, `CYCLE_NOTIFICATION_CONTRACT.md`

No engine, prediction, privacy-mask, or notification-candidate changes.

---

## 1. Files changed (implementation)

**New / evolved**
- `mobile/src/lib/cyclePresentation.js` + `.test.js` — shared LOGGED / DERIVED / PREDICTED contract
- `mobile/src/components/cycle/CycleStatusGauge.tsx`
- `mobile/src/components/cycle/CycleBadges.tsx`
- `mobile/src/components/cycle/CycleDaySummary.tsx`
- `mobile/src/components/cycle/CycleDayDetailsSheet.tsx`
- `mobile/src/components/cycle/CycleCalendarLegend.tsx`
- `mobile/src/components/cycle/CycleJournalPane.tsx`
- `mobile/app/cycle/index.tsx` — three-pane shell
- `mobile/src/components/cycle/CycleHero.tsx`, `CycleCalendar.tsx`, `CycleDayStrip.tsx`, `CycleQuickLogSheet.tsx`, `CycleLogTabs.tsx`, `CycleAlertsBanner.tsx`, `CycleHomeHeader.tsx`, `CycleNotificationMaskPreview.tsx`, `CycleTrendsChart.tsx`
- `mobile/app/cycle/settings.tsx`
- `mobile/src/lib/cycleHonesty.ts` — short confidence pills (copy only)
- `mobile/src/theme/cycle.ts` — fertility = violet, not magenta
- `mobile/src/i18n/ka.ts` — pane / honesty / privacy preview strings
- `mobile/app.json` `39.0.0`
- `server/package.json` — includes `cyclePresentation.test.js`

**Removed**
- `CycleLogHubModal.tsx`
- `CycleLogHubIcons.tsx`
- `CycleRing.tsx`
- `CycleCalendarSheet.tsx`
- `CycleDayInsights.tsx`

---

## 2. Old screens/components removed

| Removed | Why | Replacement |
|---|---|---|
| Log hub modal + icons | Duplicate log entry | `CycleQuickLogSheet` |
| `CycleRing` | Decorative hero | `CycleStatusGauge` |
| `CycleCalendarSheet` | Calendar trapped in a modal | Calendar pane |
| `CycleDayInsights` | Replaced day surface | `CycleDayDetailsSheet` |
| Home feature tiles | Feature menu | Three panes + one FAB |
| Journal “trends/notes” duplicate rows | Extra menu | Inline Journal + one Summary link |

## 3. Reused

`CycleCalendar`, `CycleQuickLogSheet`, `CycleFlowPicker`, `CyclePainEditor`, `CycleLogTabs`, `CyclePeriodHistory`, `CycleTrendsCharts`, `CycleOnboarding`, `CycleOfflineBanner`, `CycleTtcCard`, `CycleContraceptionCard`, `CycleNotificationMaskPreview`, honesty helpers, offline queue, `persistCycleLog`.

## 4. New components

`CycleStatusGauge`, `PredictionBadge`, `ConfidenceHint`, `CycleDaySummary`, `CycleDayDetailsSheet`, `CycleCalendarLegend`, `CycleJournalPane`, `cyclePresentation` helpers.

## 5. Final navigation

One route `/cycle` with segmented panes: **მიმოხილვა · კალენდარი · ჟურნალი**. Settings gear. FAB Quick Log on Overview + Calendar. Back from Calendar/Journal returns to Overview first.

## 6. Overview hierarchy

Gauge → status line → prediction/confidence chips → Quick Log CTA → today `DaySummary` → one contextual block (late > pregnancy > TTC > contraception > PMS) → 7-day strip → max one insight → quiet Medi row.

## 7–8. Gauge

Nightingale 9001:283189 geometry (270° open-bottom, Ø256-class track, Ø186 disc, Ø56 badge), scaled to `min(screen−48, 228 on narrow / 268 otherwise)`. Overlays: dashed fertile, hollow ovulation diamond, dashed predicted-period ring, teal today knob. Low server confidence hides predicted overlays (no fake personalization). Screen-reader: one `gaugeA11ySummary` sentence; decorative arcs are not focused.

## 9–11. Logged vs predicted + Calendar + Day Details

Shared `classifyCycleDay`: solid rose = logged period; dashed rose + `~` = predicted; spotting = rose micro-dot; fertile = dotted underline; ovulation = open diamond; today = teal ring; selected = ink ring; symptoms = gray micro-dot. Day Details sheet splits `● აღრიცხული` / `◌ სავარაუდო`. Selecting a day never writes a log.

## 12–14. Quick Log / detailed / private

One sheet: flow (canonical `none|spotting|light|medium|heavy`) → compact pain (severity then type, no nested modal) → moods → recent symptoms from existing logs (or static common three) → save → full log link. Offline path unchanged (`persistCycleLog` / queue). Detailed log keeps `პირადი ჩანაწერები` grouping (presentation only — **not encryption**). Sensitive fields stay off the first symptom row. Allowlists untouched.

## 15–19. Journal / history / trends / deferred

Journal pane: engine stats band (integers/ranges, no 28.43), period history, threshold-gated trends. Cycle-length chart requires **≥3** gaps. **Prediction accuracy is NOT implemented** (LATER — no historical prediction snapshot). No fake charts.

## 20–24. Confidence / irregular / late / fertility / contraception

Confidence pills are neutral (`ჯერ ვსწავლობთ თქვენს რიტმს` / irregular vary copy). No red LOW. Irregular uses the calm sentence — **no invented date window** (engine does not emit an uncertainty range). Late uses existing Phase 3 `alerts[].late` as a calm note, not a red banner. Fertility markers remain estimated and vanish when `showFertilityMarkers` is false.

## 25–27. Settings / privacy / partner

Sections: რეჟიმი · ჩემი ციკლი (avgs, irregular, last period, conditions) · კონტრაცეფცია · შეხსენებები · კონფიდენციალურობა · მონაცემები. Mask preview labeled **მაგალითი**. When `privacyEnabled` forces the mask: `ჩართულია კონფიდენციალურობის რეჟიმით`. Partner stays per-scope toggles. `getEffectiveCycleMask` unchanged.

## 28–29. Medi / EvidenceMD

Quiet `ჰკითხე Medi-ს` → `/chat/doctor`. Existing `CycleInsightsPanel` with `maxCards={1}` — real EvidenceMD/local advice only; no fabricated insight.

## 30–34. A11y / dark / Georgian

44px targets, combined calendar labels, gauge one-shot a11y, reduced-motion hook on gauge. Dark uses existing `useCycleColors`. New copy reviewed in Georgian (short, not machine-literal).

## 35–37. Responsive / offline / performance

Gauge shrinks on `<380` width. Calendar cells 44×44. Quick Log keeps offline queue. Classification memoized per calendar render; no new deps.

## 38–43. Cleanup / tests

Dead hub/ring/sheet/insights removed. No Cycle `testID`s existed; a11y labels preserved/expanded. Presentation tests in `cyclePresentation.test.js`. Engine Phase 1–4 suites unchanged and included in `server` `npm test`.

## 44–47. Native QA

Android emulator `emulator-5554` available. Screenshots under `qa/cycle-phase5/` when captured. Visual pass notes in this file’s fidelity matrix.

## 48. Design fidelity matrix

| Surface | Verdict |
|---|---|
| Three-pane IA | MATCH |
| Overview order | MATCH |
| Gauge geometry (scaled) | MINOR DEVIATION — scaled down so first viewport keeps status + CTA |
| Logged vs predicted | MATCH |
| Calendar pane + legend | MATCH |
| Day Details sheet | MATCH |
| Quick Log 1–3 tap | MATCH |
| Private log grouping | MATCH |
| Journal merge | MATCH |
| Irregular date *window* | INTENTIONAL DEVIATION — no engine window; calm sentence only |
| Prediction accuracy trend | INTENTIONAL DEVIATION — deferred (LATER) |
| Medi insight generation | INTENTIONAL DEVIATION — existing insight or empty |
| TTC/Pregnancy modes | INTENTIONAL DEVIATION — existing functional surfaces kept, not expanded |
| Settings grouping | MATCH |

## 49. Intentional deviations

1. No invented irregular date range.  
2. Prediction accuracy deferred.  
3. TTC/pregnancy kept where already functional (contextual card / settings / route) — not new modes.  
4. Gauge smaller than 316 kit artboard so Overview is not a decorative-first screen.  
5. Standalone `/cycle/journal` and `/cycle/trends` routes remain for deep links; Journal pane is the primary surface.

## 50–52. Remaining debt

**UX debt:** swipe-month on calendar; “სხვა დღე” date picker inside Quick Log; symptom “ხშირი ამ ფაზაში”.  
**P0:** none known in engine/privacy. Native visual polish on a physical iPhone still recommended.  
**P1:** prediction-accuracy (needs snapshots); Medi insight product decision; mode-switch architecture surfacing.

---

## TTC decision

`CycleTtcCard` is **functional** (mode `TRY_TO_CONCEIVE`). Relocated to the single contextual slot. Not deleted.

---

## Next phase (exactly one)

**Cycle Phase 6 — native visual QA + first-viewport polish on device**, then freeze the UI contract. Do not open prediction-accuracy or new Cycle AI until that pass.
