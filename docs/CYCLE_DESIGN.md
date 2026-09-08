# Cycle — Fable 5 design phase

**Scope:** UX architecture + visual system only. Engine, API, notification rules, privacy logic frozen (`docs/CYCLE_ENGINE.md`, `CYCLE_SAFETY_CONTRACT.md`, `CYCLE_NOTIFICATION_CONTRACT.md`). No code in this phase.

**North star:** “A calm health companion that helps me understand my own pattern” — never “a fertility calculator pretending to know my body exactly.”

---

## 1. Design diagnosis (current experience)

Grounded in `mobile/app/cycle/index.tsx` and `src/components/cycle/*`:

1. **Home is a feature menu, not an answer.** The current stack renders hero → alerts banner → day strip → day insights → TTC card → contraception card → PMS heatmap → feature tiles → FAB, plus three overlays (log hub modal, quick log sheet, calendar sheet). The first question — *where am I today and how sure are we* — competes with 8+ siblings.
2. **The ring is decorative, not informative.** `CycleRing` shows day N of L but encodes no phase segments, no predicted-period position, no confidence. It spends the hero viewport without answering the hero question.
3. **Logged vs predicted leans on color alone.** Calendar day cells differentiate mostly by fill hue; predicted period and logged period are the same rose family. This violates the engine’s core LOGGED / DERIVED / PREDICTED distinction.
4. **Two competing log entries.** `CycleLogHubModal` (hub with icon grid) and `CycleQuickLogSheet` overlap; the hub feels like a settings launcher, and flow logging is not consistently 1–3 taps.
5. **Calendar is a sheet, not a surface.** A major product surface is trapped in a modal (`CycleCalendarSheet`) with limited month navigation and no persistent legend semantics.
6. **Settings is one long page** mixing profile math (avg lengths), mode, conditions, contraception, reminders, mask, privacy, Face ID, export, partner, delete — with no grouping story.
7. **Trends screen is chart-first, meaning-second.** Numbers appear without the observational language the safety contract requires.
8. **Confidence is copy-only.** `nextPeriodConfidenceCopy` exists, but there is no consistent visual confidence object; low confidence reads as an apology paragraph.
9. **Sensitive fields sit too close to generic chips** in the log tabs (sexual-health chips one scroll away from mood).

What already works and must be preserved: honesty copy layer (`cycleHonesty`), offline queue + banner, contraception presentation gating, mask preview, partner scopes, Georgian copy.

---

## 2. UX architecture

Three primary surfaces + one global action:

```
CYCLE
├── Overview   (today: status gauge, next prediction, today’s log, one insight)
├── Calendar   (month grid + day details sheet)
└── Journal    (history + trends merged: cycles list, stats, patterns)

Global: Quick Log  (bottom sheet, reachable from every Cycle surface)
Header: Settings (gear) → profile / reminders / privacy / sharing / data
```

Rationale: “History” and “Trends” answer the same user question (*what is my pattern?*) and merge into **Journal** with two internal sections. Day details is a **sheet over Calendar**, not a separate route. Pregnancy transition, TTC card, contraception context remain contextual blocks, not tabs.

Kill list: the icon-grid Log Hub modal (replaced by Quick Log + “more” link), the separate summary screen as a route (fold into Journal), feature tiles on Home.

---

## 3. Navigation model

- **Segmented control** under the Cycle header: `მიმოხილვა · კალენდარი · ჟურნალი` (Overview / Calendar / Journal). Not app-level tabs; one route with three panes preserves state and avoids five-tab sprawl.
- **Quick Log**: single FAB-style primary button, bottom center-right, visible on Overview and Calendar. On Calendar with a selected day, the same button logs *that* day.
- **Settings**: gear in the header only. No settings entry points scattered in content.
- Back behavior: system back always returns to Overview pane first, then exits Cycle.

---

## 4. Cycle Home (Overview)

### 4.1 Hero — CycleStatusGauge (from Nightingale node 9001:283189, recolored to MediCard)

Use the kit’s gauge construction **exactly in geometry**, re-skinned:

| Element | Kit spec | Cycle adaptation |
|---|---|---|
| Outer guide ring | 316×316, dashed, 2 concentric | Keep, `border` color at 40% |
| Track arc | 256×256, ~270° arc, thick rounded stroke (~28), open at bottom | Arc = one full cycle (day 1 → length L). Segments: menstrual (logged rose fill), follicular (neutral), estimated fertile (violet, **dashed/ticked**), luteal (neutral). Predicted segments never solid. |
| Interior tick dots | Dotted marks inside track | Day ticks every ~5 days |
| Knob | 32×32 white circle w/ colored ring + shadow | **Today** marker, teal ring |
| Inner disc | 186×186 white, soft shadow | `დღე 18` (68px numeral) / `ლუტეალური ფაზა` (phase, 15px) / confidence pill row |
| Text-path labels | LOW / MEDIUM / HIGH along arc | Phase names along arc, 11px caps, muted; predicted phases get `~` prefix |
| Bottom badge | 56×56 logomark at ring bottom gap | MediCard mark or phase glyph; tap = “how is this calculated?” |
| Background halos | 380/468/586 faint circles | Keep at ≤4% opacity, brand-tinted |

Below the gauge (kit lower block, same rhythm):
- Headline slot (kit “You are unhealthy!” position) → **status line**: `მენსტრუაცია სავარაუდოდ 10 დღეში` — always estimated wording, 20–22px, max 2 lines.
- Two chips (kit badges position) → `PredictionBadge` (`სავარაუდო · 24 სექ`) + `ConfidenceHint` (`6 ციკლის მიხედვით`).
- Primary button (kit CTA position, 343×48) → **დღის აღრიცხვა** (Quick Log).

During logged period, the inner disc swaps to `მენსტრუაციის მე-2 დღე` with rose accent and the CTA becomes `დღის განახლება / დასრულება`.

### 4.2 Below the hero (strict order, max 4 blocks)

1. **Today row** — compact `DaySummary` of what is logged today (or “ჯერ არაფერია აღრიცხული დღეს” + inline log link). Row, not card.
2. **One contextual block** — exactly one of: late-status note (calm), contraception context, TTC observation card, PMS pattern note. Priority: safety > mode > pattern.
3. **7-day mini strip** (`CycleMiniTimeline`) — the existing day strip, slimmed: logged days filled, predicted days dashed, today ringed. Tap → Calendar pane on that day.
4. **One insight** (`EmptyInsight` when none) — a single observational sentence with its evidence (“3 ბოლო ციკლში…”), never a stack of AI cards.

Nothing else. TTC/contraception/PMS never appear simultaneously.

---

## 5. Calendar design

- Full pane (no modal). Month header: `‹ სექტემბერი 2026 ›` + `დღეს` jump chip (visible only when today is off-screen month).
- Grid: 7 columns, min 44×44 touch targets, week starts Monday (Georgian convention).
- Swipe left/right for month; no page-flip animation — 150ms crossfade.
- Selected day opens **Day Details sheet** (half-height), grid stays visible above.
- Legend: single compact row under the grid, 4 items max, using the same glyphs as the cells (see §24). A `?` link opens the full semantics sheet once.

### Calendar day semantics (deliverable 63)

| State | Treatment (never color alone) |
|---|---|
| Logged menstrual day | **Solid rose fill**, white numeral |
| Spotting (logged) | Rose **small dot under numeral**, no fill |
| Predicted menstrual day | Rose **dashed outline**, rose numeral, 8% rose wash, tiny `~` before numeral on selected/details |
| Estimated fertile day | Violet **dotted underline** + 8% violet wash, normal numeral |
| Estimated ovulation day | Violet **open diamond ring** around numeral (outline, not fill) |
| Today | **Teal ring** (2px) — brand identity marker, layered over any state |
| Selected day | Ink ring (2px) + slight scale; if also today, teal inner + ink outer |
| Symptom logged | Neutral **gray micro-dot** bottom-center (single dot regardless of count) |
| Outside current month | 35% opacity, not tappable |

Rule: **fill = logged fact; outline/dash/dot = estimate; ring = position (today/selected).** Fertility marks disappear entirely (no placeholders) when contraception presentation hides them.

---

## 6. Quick Log design

Bottom sheet, one screen, no navigation:

```
დღეს · 8 სექტემბერი                         [სხვა დღე ▾]

გამონადენი   ○ არა  ◔ ლაქები  ◑ მსუბუქი  ● საშუალო  ●● ძლიერი
ტკივილი      [კრუნჩხვა] [თავის] [წელის] [+]   → tap = chip expands ▸ მსუბუქი/საშუალო/ძლიერი
განწყობა     😊 🙂 😐 🙁 😣   (5 fixed)
სიმპტომები   [ბოლოს გამოყენებული ×4] [ხშირი ×4] [ყველა →]

                    [შენახვა]        დეტალური აღრიცხვა →
```

- Flow save alone = **1 tap open + 1 tap value + auto-save on sheet close** (or explicit save). Target met: 1–3 taps for the common case.
- Pain: chip tap expands an inline 3-step severity segment — no modal-in-modal.
- Save feedback: sheet collapses to a 1.5s inline `DaySummary` toast (`დღეს · საშუალო · კრუნჩხვა`), no confetti, light haptic only.
- “დეტალური აღრიცხვა” opens the full log screen pre-filled.

---

## 7. Detailed Log design

The existing log screen, reorganized by progressive disclosure:

1. **Always visible:** flow, pain, mood, symptoms (grouped), notes.
2. **Collapsed groups (tap to expand):** sleep/stress/energy, caffeine/alcohol/exercise, custom tags.
3. **Private section (explicitly separated):** sexual activity, libido, OPK/BBT/mucus, pregnancy test — under a distinct header `პირადი ჩანაწერები 🔒` with one-line copy “ეს ველები არასდროს ჩანს AI-სთვის და პარტნიორისთვის.” Never in the first symptom row.
4. Save is sticky-bottom; unsaved-changes guard on back.

Symptom picker: search field on top, then `ბოლოს გამოყენებული` → `ხშირი ამ ფაზაში` → grouped alphabet. Max 2-column chip grid, 40px chips.

---

## 8. Day Details design (Calendar sheet)

Half sheet over the grid:

```
სამშაბათი, 24 სექტემბერი        ციკლის მე-18 დღე · ლუტეალური
──────────────────────────────
● აღრიცხული: საშუალო გამონადენი, კრუნჩხვა (საშუალო), დაღლილობა
   [რედაქტირება]
──────────────────────────────
◌ სავარაუდო: მენსტრუაციის დაწყება ამ დღეს (შეფასება ბოლო ციკლებით)
```

- Logged block uses filled bullets and `აღრიცხული` label; predicted block uses hollow bullets and `სავარაუდო` label — same glyph system as the calendar.
- Future days: only the predicted block plus `აღრიცხვა ამ დღეს` (if within edit rules).
- Editing a past day = same Quick Log sheet, prefilled, with `წაშლა` action. No recalculation language; after save just show the updated summary. (Engine already rebuilds deterministically.)

---

## 9. History design (Journal · ისტორია)

- **Header stats band** (`HistoryStats`): three compact stats — `საშუალო ციკლი 28 დღე` · `მენსტრუაცია ~5 დღე` · `ბოლო 6 ციკლი: 26–30 დღე`. Ranges, not fake precision; hide any stat below its data threshold.
- **Cycle list**: one row per derived cycle — `1 სექ – 28 სექ · 28 დღე · ▮▮▮▮▯` (period-length mini bar). Logged periods solid; the current open cycle labeled `მიმდინარე`.
- Tapping a row → that month in Calendar.
- Out-of-band gaps (engine-excluded) are shown but tagged `არ მონაწილეობს საშუალოში` in the row detail — visible, honest, not hidden.

---

## 10. Trends design (Journal · ტენდენციები)

Sections, each rendered only when the data threshold is met:

| Section | Threshold | Presentation |
|---|---|---|
| ციკლის ხანგრძლივობა | ≥3 gaps | Dot-line chart, band for 26–32 typical zone, no trend line under 6 points |
| მენსტრუაციის ხანგრძლივობა | ≥3 ranges | Bars |
| ტკივილი ფაზების მიხედვით | ≥2 cycles with pain | Existing PMS-style heatmap, relabeled observationally |
| სიმპტომების განმეორება | ≥2 recurrences | Sentence list: “თავის ტკივილი აღრიცხეთ 3 ბოლო ციკლში, მენსტრუაციამდე 2–3 დღით ადრე.” |
| პროგნოზის სიზუსტე | ≥3 completed predictions | “ბოლო 3 პროგნოზი ფაქტს 0–2 დღით აცდა” — plain sentence, no gauge |

No section shows an empty chart; below threshold it renders the `EmptyInsight` explainer (“კიდევ 1 ციკლის აღრიცხვა და ეს განყოფილება გაიხსნება”).

---

## 11. Prediction presentation

- Every predicted date is prefixed `სავარაუდო` or suffixed `(შეფასება)` — never bare dates in headers.
- Predicted visuals are **never solid fills**: dashed outlines, washes ≤10%, hollow glyphs.
- The gauge, status line, calendar, day sheet, and reminders all pull the same `PredictionBadge` presentation — one component, one honesty rule.
- “How is this calculated?” sheet (from the gauge badge): 4 plain sentences — logged starts → average of recent gaps → estimated window → why it can shift. No formulas, no medical claims.

## 12. Confidence presentation

`ConfidenceHint` — a quiet pill, never a warning:

| Engine | Pill copy (ka) | Tone |
|---|---|---|
| high | `6+ ციკლის მიხედვით` | neutral ink on subtle fill |
| medium | `რამდენიმე ციკლის მიხედვით · თარიღი შეიძლება გადაიწიოს` | same neutral |
| low | `ჯერ ვსწავლობთ თქვენს რიტმს` | same neutral, **never red/amber** |

Confidence also modulates prediction visuals: low confidence widens the predicted-period wash on the calendar by ±1 day and softens the gauge’s predicted segment (lighter dash). Uncertainty is shown as *softness*, not alarm.

## 13. Irregular-cycle presentation

- `isIrregular` or LOW variability: status line switches to a window, not a date — `მენსტრუაცია სავარაუდოდ 12–18 ოქტომბერს შორის`.
- One calm sentence where the confidence pill sits: `თქვენი ციკლები იცვლება, ამიტომ თარიღი შეიძლება გადაიწიოს.`
- The app never looks broken: gauge still renders (arc uses the mean; predicted segment extra-soft), calendar shows the wash-window, Journal keeps facts. No diagnosis, no “irregularity detected” badge.

## 14. Fertility presentation

- Fertile window and ovulation are **estimates by construction**: violet dotted/dashed only, labeled `სავარაუდო ნაყოფიერი ფანჯარა` / `სავარაუდო ოვულაცია`.
- Never: solid fertile fills, “safe days”, countdown-to-ovulation numerals, or confidence-free ovulation dates.
- LIMITED contraception: fertility layers vanish cleanly — calendar legend drops those entries, gauge shows menstrual/neutral segments only, Overview contextual block explains once (`ჰორმონალური კონტრაცეფციისას ოვულაციის შეფასება არ ჩანს`). No empty placeholders.
- TTC mode adds the observation card (existing) — still estimates-first, no contraception-safety implication.

---

## 15. Privacy UX

Settings → one **კონფიდენციალურობა** group, four plain rows (`PrivacyRow`):

1. `ციკლის კონფიდენციალურობა` — master toggle; helper: “შეტყობინებები ეკრანზე ზოგადი ტექსტით გამოჩნდება.”
2. `შეტყობინების ნიღაბი` — explicit mask + style picker + **preview labeled `მაგალითი — ასე დაინახავს სხვა`** (clearly a preview; does not claim OS-level changes).
3. `Face ID / PIN დაცვა` — screen lock, clearly separate from notification mask.
4. `პარტნიორთან გაზიარება` — link into sharing (below).

Effective-mask rule surfaces here as behavior, not jargon: when privacy master is on, the mask row shows `ჩართულია კონფიდენციალურობის რეჟიმით` instead of appearing off.

Partner sharing: per-scope toggles (მენსტრუაციის სტატუსი / ფაზა / ნაყოფიერი ფანჯარა / სიმპტომები), each with a one-line “what they see” example. No single share-everything switch; fertile scope has an extra confirm.

## 16. Settings UX

Regrouped into five titled sections (section title above card, per house style):

1. **რეჟიმი** — mode selector + future-mode slot (see §18)
2. **ჩემი ციკლი** — last period, avg lengths (labeled “გამოიყენება მხოლოდ საწყისად — შემდეგ ვსწავლობთ თქვენი ჩანაწერებიდან”), irregular toggle, conditions
3. **კონტრაცეფცია** — existing method picker + presentation note
4. **შეხსენებები** — master, per-type toggles, days-before stepper; TTC-only rows appear only in TTC mode
5. **კონფიდენციალურობა** — §15
6. **მონაცემები** — Health import, ICS export, wipe (destructive style, existing confirm)

## 17. Medi future integration (architecture only)

- One quiet row on Overview, below the insight: `🩺 ჰკითხე Medi-ს ჩემი ციკლის შესახებ` → existing chat with `CYCLE_WELLNESS` context. Row, not card; never above the fold; never auto-expanding.
- Future AI insight slot = the same single-insight block (§4.2.4) with a `Medi` attribution chip. Contract: max one, must cite its evidence (“3 ციკლში…”), allowlisted context only, dismissible. **No insight data fabricated now** — until real, the slot shows pattern facts or the empty explainer.

## 18. Future mode architecture (no flows now)

- Mode lives in **Settings → რეჟიმი** as a card selector: ციკლი (active) · TTC (exists) · ორსულობა (transition sheet exists) · პერიმენოპაუზა (future, hidden until built).
- Mode changes recolor the Overview contextual block and gauge accents but never restructure navigation — the three panes survive any mode.
- Reserved: one optional pane title swap in Journal for pregnancy (weeks view) — architecture note only.

## 19. Accessibility

- All states carry text labels or `accessibilityLabel` (e.g. calendar day: “24 სექტემბერი, სავარაუდო მენსტრუაცია, სიმპტომები აღრიცხულია”).
- Touch targets ≥44px; calendar cells 44×44 min; chips 40px height.
- Contrast: all text ≥4.5:1 in both themes; washes are backgrounds only, never information carriers alone (§24: shape carries meaning).
- Dynamic type: numerals scale, gauge inner disc truncates gracefully (day numeral → smaller phase text, never clipped).
- Reduced motion: crossfades only; gauge draws without sweep animation.
- Screen reader order: status line → confidence → CTA → today row.

## 20. Dark mode

Per the house dark contract (gray-950 navy):

| Token | Light | Dark |
|---|---|---|
| Page | `#F8FAFC` | `#030712` |
| Card/gauge disc | `#FFFFFF` | `#111827` |
| Border/dashes | `#E5E7EB` | `#374151` |
| Menstrual (logged) | `#E11D48` | `#FB7185` |
| Menstrual wash | rose 8% | rose 14% (dark needs more) |
| Fertility/ovulation | `#7C3AED` | `#A78BFA` |
| Fertility wash | violet 8% | violet 14% |
| Today ring | `#0D9488` | `#14B8A6` |
| Numerals | `#111827` | `#FFFFFF` |

Rules: same shapes in both themes (dash stays dash); gauge disc uses `surface`, not pure black; washes get +6% opacity on dark; halo circles drop to 3%.

## 21. Localization (Georgian first)

- All labels sized for Georgian: buttons min-width fit `დეტალური აღრიცხვა`; chips wrap to 2 lines never truncate; status line reserves 2 lines.
- Dates via existing `formatCycleDateKa`; weekday initials `ორ სა ოთ ხუ პა შა კვ`.
- No fixed-height text containers; numerals use tabular figures so `დღე 8` and `დღე 28` don’t shift the disc.
- Latin appears only in brand marks (MediCard, Medi).

---

## 22. Component system

| Component | Role |
|---|---|
| `CycleStatusGauge` | Hero arc (Nightingale 9001:283189 geometry, MediCard skin) |
| `CycleStatusLine` | Headline prediction sentence (window form when irregular) |
| `PredictionBadge` | `სავარაუდო · date` pill — the only way predicted dates render |
| `ConfidenceHint` | Quiet confidence pill (§12) |
| `CycleMiniTimeline` | 7-day strip, logged/predicted/today glyphs |
| `CycleCalendarDay` | Day cell implementing §24 exactly |
| `CalendarLegendRow` | 4-glyph inline legend + `?` sheet |
| `DayDetailsSheet` | §8 |
| `QuickLogSheet` | §6 |
| `FlowSelector` | 5-step flow segment (icons + labels) |
| `PainSelector` | Chip + inline severity expansion |
| `SymptomPicker` | Search + recents + groups |
| `DaySummary` | Compact logged-facts row (Home, toast, day sheet) |
| `HistoryStats` | Journal stats band |
| `TrendSection` | Threshold-gated chart/sentence block |
| `EmptyInsight` | “what logging unlocks” explainer |
| `PrivacyRow` | Labeled toggle + helper + preview slot |

## 23. Design tokens

- Spacing: 4-base — 4/8/12/16/24; screen gutter 16; section gap 24; in-card gap 12.
- Radius: cards 16, sheets 24 top, chips 999, day cells 12, gauge disc circle.
- Type (Noto Sans Georgian): display numeral 56–68/Bold (gauge day); H1 22/Bold (status line); H2 17/Bold (section titles — above cards); body 15/Regular; secondary 13/Regular; caption 11/Medium caps (arc labels, legends). Bold reserved for current state + section titles.
- Cycle semantic colors: §20 table; brand teal stays navigation/today/CTA only — **teal never encodes fertility**.
- Icons: Lucide, 20px, 1.75 stroke; no hearts/flowers/babies as category icons (calendar-heart nav icon may stay in tab entry only).
- Motion: 150–200ms ease-out; selection scale 1.0→1.06; sheet spring subtle; no loops, no blobs.

## 24. Logged-vs-predicted contract (honesty rules)

| Class | Fill | Edge | Glyph | Label | Language |
|---|---|---|---|---|---|
| USER LOGGED | solid | none | filled bullet ● | `აღრიცხული` | facts, past tense |
| DERIVED (phase, cycle day, averages) | none | none | plain text | `თქვენი ჩანაწერებით` | descriptive |
| PREDICTED | wash ≤10% | dashed/dotted | hollow ◌ / diamond ◇ / `~` | `სავარაუდო` | estimate verbs, may shift |
| FUTURE AI INSIGHT | none | left accent bar | Medi chip | `Medi-ს დაკვირვება` + evidence count | observational, never causal |

Hard rules: predictions never solid; solid never estimated; every predicted date has visible estimate wording within the same visual unit; removing color must leave the class readable (shape+label carry it); banned words: დადასტურებული/ზუსტი/გარანტირებული for any derived/predicted value.

## 25. Screen-state matrix

| # | Screen | Key states |
|---|---|---|
| 1 | Home — regular | gauge day N, high pill, next-period line, today row, insight |
| 2 | Home — low history | gauge without predicted segment; status: `ვსწავლობთ თქვენს რიტმს — აღრიცხეთ შემდეგი მენსტრუაცია`; CTA prominent; no fake window |
| 3 | Home — irregular | window status line, soft dash, calm sentence |
| 4 | Home — period active | rose disc `მე-2 დღე`, CTA = განახლება/დასრულება |
| 5 | Calendar | month grid + legend |
| 6 | Calendar — selected day | ink ring + DayDetailsSheet |
| 7 | Quick Log | §6, plus prefilled-edit variant |
| 8 | Detailed Log | groups collapsed / expanded / private section |
| 9 | Journal · History | stats band + cycle rows; open cycle marked |
| 10 | Journal · Trends | thresholds met / partially met |
| 11 | Journal — empty | explainer + first-log CTA, no fake charts |
| 12 | Settings | five groups |
| 13 | Privacy / Notifications | 4 rows + labeled preview |

Home phase variants (deliverable 62): period day (rose disc), follicular (neutral segment active), fertile estimate window (violet dashed segment active + estimate line; hidden under LIMITED), luteal (neutral, next-period line dominant), low-confidence (window wording, soft visuals). No pregnancy/TTC home variants in this phase.

Global states: offline banner (existing) pinned under header; loading = skeleton gauge disc + rows (no spinner wall); error = retry row, content preserved.

## 26. User flow map

```
Cycle entry
└─ Overview ── gear ─→ Settings ─→ [ჩემი ციკლი | შეხსენებები | კონფიდენციალურობა ─→ Mask preview / Face ID / Sharing | მონაცემები]
   ├─ Quick Log ─→ save ─→ toast summary ─→ Overview (refreshed)
   │                └─ დეტალური ─→ Detailed Log ─→ save
   ├─ mini-strip day ─→ Calendar(day) ─→ DayDetailsSheet ─→ [Edit=QuickLog prefilled | past log view]
   ├─ status gauge badge ─→ “როგორ ითვლება” sheet
   └─ segmented ─→ Calendar ⇄ Journal(History ⇄ Trends) ─→ cycle row ─→ Calendar(month)
```

## 27. Priorities

**MUST HAVE**
1. Logged-vs-predicted visual contract everywhere (§24) — calendar, strip, day sheet
2. New Overview hierarchy: gauge + status line + confidence + one block + one insight
3. `CycleStatusGauge` per Figma geometry, MediCard skin
4. Quick Log 1–3-tap sheet replacing the log hub modal
5. Calendar as pane + day semantics + compact legend
6. Confidence pill system (never warning-styled)
7. Private-section separation in Detailed Log
8. Settings regrouping incl. privacy rows with labeled mask preview

**SHOULD HAVE**
9. Journal merge (History + Trends) with thresholds and stats band
10. Irregular window-form status line
11. Day Details sheet redesign
12. Empty/low-history states suite
13. Dark-mode wash calibration + reduced motion

**LATER**
14. Prediction-accuracy sentence in Trends
15. Medi insight slot activation (needs product/AI decision)
16. Mode-switch card architecture surfacing TTC/pregnancy entries
17. Symptom picker “ხშირი ამ ფაზაში” intelligence

## 28. Implementation handoff notes

- **Zero engine/API changes needed.** Every element maps to existing bundle fields: `predictions.*` (+`estimated`, `confidence`), `inferred.periodRanges/cycleGaps`, `logs`, `alerts[].late`, `contraception.presentation.showFertilityMarkers`, honesty helpers in `cycleHonesty.ts`.
- Gauge: implement with `react-native-svg` arcs; geometry from Figma node `9001:283189` (`UvO6dfZRJH8SjUj8D0mB8N`): track Ø256/stroke ~28/270° open-bottom, disc Ø186, knob Ø32, badge Ø56, guide Ø316, halos 380/468/586. Pull exact fills per element via `get_design_context` at build time; recolor per §20.
- Respect house rules: `Pressable` static style objects only (NativeWind v4 drops function styles); new routes need `headerShown: false` in `app/_layout.tsx`; overlay modals spread `APP_MODAL_PROPS` (fade), scrim as sibling; section titles above cards.
- Reuse, don’t fork: `CycleCalendar` day cell refactors in place; `CycleQuickLogSheet` evolves into `QuickLogSheet`; `CycleDayStrip` → `CycleMiniTimeline`; log hub modal deleted after Quick Log parity.
- All sample content in mocks must be tagged `მაგალითი` — no fabricated trends.
- Ship order = MUST list order; each step is independently shippable; bump `mobile/app.json` per release convention when implementation starts (major bump `38.0.0` justified at MUST-1–5 completion).
