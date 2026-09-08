# Cycle UI contract — frozen (Phase 6)

**Status:** ANDROID FROZEN (calendar visual refinement). iOS QA deferred by product decision.  
**Date:** 2026-09-08  
**App version:** mobile `39.0.4`  
**Design source:** `docs/CYCLE_DESIGN.md`  
**Engine / safety / notifications remain frozen:** `CYCLE_ENGINE.md`, `CYCLE_SAFETY_CONTRACT.md`, `CYCLE_NOTIFICATION_CONTRACT.md`

This is the UI source of truth for Cycle. Visual changes after this document require a new Phase. Do not treat the Cycle *product* as final.

Facts on screen come from the server Cycle bundle. React must not invent phase, cycle day, confidence, late status, predicted dates, or fertility state.

---

## 1. Information architecture

One route `/cycle` with three panes:

`მიმოხილვა · კალენდარი · ჟურნალი`

- Segmented control under the Cycle header. Not app-level tabs.
- Settings: header gear only → `/cycle/settings`.
- Quick Log: one sheet, FAB on Overview and Calendar. Hidden while Day Details or Quick Log is open.
- Back: Calendar / Journal → Overview first, then exit Cycle.
- Day Details is a sheet over Calendar, not a route.
- Standalone `/cycle/journal` and `/cycle/trends` may remain as deep links. The Journal pane is the primary surface.

Kill list stays killed: Log Hub modal, decorative `CycleRing`, Calendar-as-modal, Home feature-tile menu.

---

## 2. Overview hierarchy

Strict order, first viewport first:

1. `CycleStatusGauge`
2. Status line
3. Prediction chip + confidence pill (prediction chip **hidden** when server confidence is `low`)
4. Quick Log CTA (`დღის აღრიცხვა` / period update / end)
5. Today `DaySummary` (row, not a second hero)
6. Exactly one contextual block: late > pregnancy > TTC > contraception > PMS
7. 7-day strip
8. At most one insight
9. Quiet Medi row

Nothing else on Overview.

### First fold (reference: Pixel-class 1080×2400)

Must show without scrolling: current state, prediction or learning context, Quick Log CTA. Today summary should be at least partly visible. The gauge must not push all useful content below the fold.

---

## 3. Gauge contract

Nightingale 9001:283189 geometry, MediCard recolor:

- ~270° horseshoe, open bottom
- Track ≈ Ø256-class, inner disc ≈ Ø186-class, bottom badge ≈ Ø56-class
- Scaled to `min(screen − 48, 228` on narrow / `268` otherwise)
- Today knob: teal ring
- Logged menstrual arc: solid rose
- Estimated fertile: violet dashed/ticked — never solid “confirmed”
- Estimated ovulation: hollow violet diamond
- Predicted period: dashed, never solid fill
- Phase label uses honesty wording (`სავარაუდო …`) unless the day is a logged period
- Screen-reader: one `gaugeA11ySummary` sentence. Decorative arcs are not focused.

**Low server confidence:** hide predicted overlays on the gauge, hide the exact-date prediction chip, and use learning status copy (`ვსწავლობთ თქვენს რიტმს…`). Logged facts stay.

Approved deviation: responsive scale smaller than the 316 kit artboard so the first viewport stays useful.

---

## 4. Logged vs predicted

Shared `classifyCycleDay` (`mobile/src/lib/cyclePresentation.js`):

| Layer | Treatment |
|---|---|
| Logged period | Solid rose circle, white numeral |
| Spotting | Rose micro-dot, no fill |
| Predicted period | Dashed rose circular outline, `~` numeral |
| Estimated fertile | Three small violet dots below the numeral |
| Estimated ovulation | Small outlined diamond (◇) below the numeral — never wraps the date |
| Today | Thin teal circular ring (position, not provenance) |
| Selected | Soft circular fill + thin neutral halo. If also today, teal ring. Never a polygon. |
| Symptom | Neutral gray micro-dot |

**Fill = logged fact. Outline / dash / dot / hollow = estimate. Ring = position.**

`showFertility: false` (engine contraception presentation) removes fertility layers entirely — no empty legend item, no placeholder wash.

`showPredicted: false` (UI mapping of `confidencePresentation().hidePredictedOverlays`) removes predicted period / fertile / ovulation layers. Logged period remains.

Never color-alone. Shape + pattern must still distinguish logged / predicted / today / ovulation / selected.

---

## 5. Calendar

Full pane. Month header with `‹ ›` arrows + `დღეს` jump when today is off-month. Week starts Monday.

Legend is compact, same glyphs as cells. When predictions or fertility are suppressed, those legend items disappear — no empty slots.

Selecting a day never writes a log.

**Month swipe** is not required for this freeze. Arrow navigation is sufficient. Revisit only if a later phase needs parity polish.

---

## 6. Day Details

Sheet over Calendar (`maxHeight` ~72%, safe-area padding).

Two groups:

- `● აღრიცხული` — logged facts
- `◌ სავარაუდო` — estimates, plus the honesty footnote that dates may change

Actions: Quick Log for that day, full log. Dismiss: X, overlay, system back.

Historical dates are edited here (Calendar → Day Details → Quick Log / full log). Quick Log from Overview is **today only**. A Quick Log date picker is not required.

---

## 7. Quick Log

One sheet, no nested modal:

1. Flow (`none | spotting | light | medium | heavy`)
2. Pain: severity, then type inline
3. Mood chips
4. Recent / common physical symptoms only — no casual sexual-health items
5. Save → optional `სრული აღრიცხვა`

Target: 1–3 taps after open for the common flow path.

Offline: existing `persistCycleLog` / queue. The sheet must not appear frozen while queued.

Private detailed fields live on the full log under `პირადი ჩანაწერები`. Lock icon must not imply encryption. Grouping is presentation only.

---

## 8. Journal

Stats band from the engine (integers / ranges, no fake precision).  
History rows: actual derived / logged periods — mini-bars are **not** prediction bars.  
Trends: empty-state copy until thresholds are met (cycle-length chart needs ≥3 gaps). No fake charts.  
**Prediction accuracy is absent** and must stay absent until a dedicated snapshot phase.

---

## 9. Settings and privacy presentation

Settings groups, in order:

`რეჟიმი · ჩემი ციკლი · კონტრაცეფცია · შეხსენებები · კონფიდენციალურობა · მონაცემები`

Privacy:

- Master privacy, notification mask, Face ID/PIN, partner sharing
- Mask preview labeled **`მაგალითი`**
- Appearance changes must not change Phase 4 semantics (`getEffectiveCycleMask` / stored vs effective)
- Partner stays per-scope. No “share all”. Fertility scope stays deliberate.

---

## 10. Color roles

| Role | Color | Use |
|---|---|---|
| Brand / today / CTA | MediCard teal (`#14B8A6` light, `#0D9488` filled dark CTA) | Today ring, primary buttons, FAB |
| Logged period | Rose | Solid fills only |
| Estimated fertility | Violet | Dashed / dotted / hollow only |
| Ink / surfaces | Cool gray-950 navy in dark (`#030712` page, `#111827` cards) | Never teal charcoal |

Violet must not overpower teal. Fertility is never visually “confirmed”.

---

## 11. Accessibility

- 44px minimum targets
- Combined calendar day labels (date + today + selected + logged/predicted layers)
- Gauge: one summary, not per-arc focus
- Segmented panes expose selected state
- Pain severity and settings toggles keep visible selected state
- Predicted a11y copy always includes `სავარაუდო`
- Meaning must not depend on animation

---

## 12. Future-mode boundaries

Do not add in a visual/UI phase:

- Prediction-accuracy product
- New Cycle AI / OpenRouter Cycle recommendations
- TTC expansion, pregnancy mode, perimenopause
- BBT / LH as new first-class IA
- Engine, schema, or notification-candidate changes

Existing TTC / pregnancy / contraception surfaces may stay in the single contextual slot and in Settings. They are not new tabs.

---

## 13. Intentional deviations (approved)

1. Responsive gauge smaller than the 316 kit artboard.
2. Irregular: calm sentence, no invented date window (engine does not emit one).
3. Prediction accuracy deferred.
4. TTC/pregnancy kept where already functional — not expanded.
5. Quick Log is today-only; history goes through Calendar.
6. Month change is arrows, not swipe.
7. Day Details section titles are `აღრიცხული` / `სავარაუდო` with solid / hollow glyphs (not the literal `●` / `◌` characters).

---

## 14. QA account (synthetic)

`server/scripts/cycle-phase6-qa-seed.js`  
Email `cycle.qa.phase6@medicard.ge` — not a real person. Seeds raw `CycleLog` + `CycleProfile` only.

States: `period | regular | fertile | ovulation | luteal | low-history | irregular | late | contraception | symptoms | empty`

After reseed, pull-to-refresh on Overview (do not swipe through the day strip).

---

## 15. Cross-platform implementation (Phase 7)

Layout-only. IA, semantics, and engine unchanged.

- **FAB:** width is measured (`onLayout`) and passed to the 7-day strip as `reservedRight`. Overview uses an icon-only FAB so the 7-day strip keeps a full row of tappable days (accessibility label stays `აღრიცხვა`). Labeled FAB remains on Calendar. Also compact under 380pt or `fontScale >= 1.3`. Calendar pane keeps a modest bottom inset so the legend can sit above the FAB.
- **Detailed log Save:** sticky footer height is measured (`onLayout`) and applied as ScrollView bottom inset. KeyboardAvoidingView uses safe-area offset. Do not use magic spacers.
- **Large text:** pane labels may wrap to two lines. Header phase subtitle may use two lines (header grows; do not clip with a fixed min-height). Gauge decorative size may shrink; at `fontScale >= 1.25` the phase line moves *under* the disc so it does not clip. Calendar **day-cell numerals** use `allowFontScaling={false}` so the month grid stays intact — full meaning is on the accessibility label. Settings switch rows wrap; toggles stay on the trailing edge.
- **Pull-to-refresh vs strip:** a long downward swipe that *ends* on a day cell can open that day. Normal short PTR from the hero does not. Not treated as a frequent accidental activation.
- **iOS native QA:** deferred by product decision. Android Cycle UI is the freeze surface.
- **Calendar day cells:** `getCycleCalendarDayVisualState` resolves fill / ring / micro-indicator. Selection is navigation only — circular, never a diamond, triangle, or octagon. Ovulation is a small outlined diamond under the date. iOS native QA is deferred by product decision.
