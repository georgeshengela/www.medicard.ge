# Medicard Cycle Tracker — Product & Engineering Specification

**Status:** Specification only. No implementation in this document’s creation pass.  
**Product:** Medicard.GE cycle module (women’s health). In-app AI name is **Medi**.  
**Audience:** Engineering, product, QA.  
**Source of truth for current behavior:** repository as of 2026-08-30 (cycle audit + files listed at the end).  
**Scope:** Existing cycle module. Do not rebuild. Do not replace the Express/Prisma/Expo stack. Do not redesign unrelated Medicard products (meds, pharmacy, visits, hydration, steps) except where they already touch cycle.

---

## How to read this document

- **Current** = what the code does today.
- **Target** = the production-quality contract we will implement in later, controlled phases.
- Unresolved decisions are listed at the end. Do not implement around them until they are decided.

---

# Part A — Current architecture

## A1. Current architecture

Medicard is a Georgian health super-app:

| Layer | Stack | Cycle role |
| --- | --- | --- |
| Mobile | Expo 54, React Native 0.81, Expo Router, AuthContext | FEMALE-gated `/cycle` stack; fetches `CycleBundle`; local reminders, lock, Health sync, PDF/ICS |
| API | Express, JWT `requireAuth`, Zod | `/api/cycle/*`; `assertFemale` → 403 if `user.gender !== 'FEMALE'` |
| DB | PostgreSQL + Prisma | `CycleProfile` (1:1 user), `CycleLog`, `PregnancyLog` |
| Engine | `server/src/lib/cycle.js` | Infer stats, predictions, overlay, phase, trends, alerts, doctor summary, local + AI prompt |
| Client engine (duplicate) | `mobile/src/lib/cyclePhase.ts` | Recalculates cycle day + phase + day cards from LMP + averages |
| AI | EvidenceMD `CYCLE_WELLNESS` + `runTrackedAi` + quota | Cached ~18h on `CycleProfile.aiInsights` |
| Tests | `server/src/lib/cycle.test.js` | Flow vs spotting, inference, overlay, confidence |

**Data flow today**

```
User action (log / settings)
  → PUT/PATCH /api/cycle/*
  → Prisma upsert
  → syncLastPeriodStart() (bleed-run inference)
  → loadBundle()
       inferCycleStats(logs)
       buildPredictions(profile averages || inferred)  // default 28 is always truthy
       overlayLogsOnCalendar()
       gestationalAge / trends / alerts / summary / localInsights
  → JSON CycleBundle
  → Client stores in screen state (no cycle offline DB)
  → Client ALSO runs detectCyclePhaseForDate / cycleDayForDate for hub, home card, AI tips
```

**Architectural problem (current):** medically meaningful values are computed in two places with different date rules (server UTC helpers vs client local calendar). Predictions use stored `avgCycleLength` (default 28), not inferred averages.

Sibling products (not cycle-owned): `/medications`, `/visits`, `/health-metrics/hydration`, `/health-metrics/steps`, `/chat/[mode]`. They are not joined to cycle except Medi patient context and optional HealthKit reads.

---

## A2. Current routes

### Mobile (Expo Router)

| Route | File | Purpose |
| --- | --- | --- |
| `/cycle` | `mobile/app/cycle/index.tsx` | Hub: day strip, ring, day insights, AI tips, PMS heatmap, quick tiles, onboarding, log hub modal, calendar sheet |
| `/cycle/log` | `mobile/app/cycle/log.tsx` | Full day editor (`CycleLogTabs`: flow / body / more) |
| `/cycle/settings` | `mobile/app/cycle/settings.tsx` | Mode, averages, LMP, due date, conditions, reminders, lock, Health, ICS, partner |
| `/cycle/summary` | `mobile/app/cycle/summary.tsx` | Doctor summary + PDF share |
| `/cycle/trends` | `mobile/app/cycle/trends.tsx` | Cycle length, symptoms, BBT, PMS |
| `/cycle/pregnancy` | `mobile/app/cycle/pregnancy.tsx` | Week, checklist, weight, kicks, notes |
| `/cycle` layout | `mobile/app/cycle/_layout.tsx` | Biometric privacy gate around the stack |
| `/share/cycle/[code]` | `mobile/app/share/cycle/[code].tsx` | Partner accept + permitted fields (outside cycle lock) |

**Overlays (not routes):** `CycleLogHubModal`, `CycleCalendarSheet`, `CycleOnboarding`, `CyclePregnancyTransitionSheet`, `CycleInsightDetailSheet`, `CycleQuickLogSheet`.

**Related non-cycle routes:** `/chat/[mode]`, `/medications/*`, `/visits/*`, `/health-metrics/*`, `/profile/permissions`.

**Home:** `HomeCyclePreviewCard` (`mobile/src/components/home/HomeCyclePreviewCard.tsx`) fetches/uses bundle + **client** `detectCyclePhaseForDate`.

### HTTP API

Mounted in `server/src/server.js`:

| Method | Path | Auth | Handler |
| --- | --- | --- | --- |
| GET | `/api/cycle` | JWT + female | `loadBundle` |
| PATCH | `/api/cycle/profile` | JWT + female | Profile upsert fields |
| PUT | `/api/cycle/logs/:date` | JWT + female | Day log upsert + `syncLastPeriodStart` |
| DELETE | `/api/cycle/logs/:date` | JWT + female | Delete one day + `syncLastPeriodStart` |
| PUT | `/api/cycle/pregnancy/:date` | JWT + female | Pregnancy day upsert |
| POST | `/api/cycle/insights` | JWT + female + AI quota on miss | EvidenceMD or cache |
| GET | `/api/cycle/share` | JWT + female (owner) | Owner share status |
| POST | `/api/cycle/share` | JWT + female (owner) | Create / rotate invite |
| PATCH | `/api/cycle/share` | JWT + female (owner) | Update permissions |
| DELETE | `/api/cycle/share` | JWT + female (owner) | Revoke |
| POST | `/api/cycle/share/:code/accept` | JWT (any gender) | Bind authenticated partner |
| GET | `/api/cycle/share/:code` | JWT + bound partner | Partner-safe payload only |

Client wrapper: `mobile/src/lib/api.ts` → `api.cycle.*`.

---

## A3. Current database models

Prisma: `server/prisma/schema.prisma`.

### `User` (cycle-relevant)

- `gender` — `'MALE' | 'FEMALE' | 'OTHER'`. Cycle API requires `FEMALE`.
- Relations: `cycleProfile`, `cycleLogs`, `pregnancyLogs`.

### `CycleProfile` (one per user)

| Field | Type | Default / notes |
| --- | --- | --- |
| `mode` | String | `TRACK_PERIOD` \| `TRY_TO_CONCEIVE` \| `PREGNANCY` |
| `avgCycleLength` | Int | **Default 28** (21–45 via API) |
| `avgPeriodLength` | Int | **Default 5** (2–10 via API) |
| `lastPeriodStart` | Date? `@db.Date` | Written as `${ymd}T00:00:00.000Z` |
| `isIrregular` | Boolean | Default false |
| `dueDate` | Date? `@db.Date` | Pregnancy |
| `privacyEnabled` | Boolean | Stored flag; **client lock is a separate local pref** |
| `partnerShareCode` | String? unique | Owner-only plaintext of current 64-hex invite (`randomBytes(32)`). Lookup uses `CyclePartnerShare.tokenHash`. |
| `aiInsights` / `aiInsightsAt` | Json / DateTime | ~18h cache |
| `conditions` | Json | `["pcos","endometriosis","perimenopause"]` |
| `reminderPrefs` | Json? | Optional **mirror**; scheduler is on-device |

### `CycleLog` (one row per user + calendar day)

| Field | Notes |
| --- | --- |
| `date` | `YYYY-MM-DD` string. Comment: Asia/Tbilisi calendar day. Unique `(userId, date)` |
| `flow` | `none` \| `spotting` \| `light` \| `medium` \| `heavy` |
| `symptoms` / `moods` | JSON string arrays |
| `sexualActivity` | Boolean? |
| `libido` | 1–5 |
| `bbt` | Float 34–42 |
| `cervicalMucus` | `dry` \| `sticky` \| `creamy` \| `watery` \| `eggwhite` |
| `ovulationTest` | `negative` \| `positive` \| `unclear` — user-logged OPK, not confirmed ovulation |
| `pregnancyTest` | `negative` \| `positive` \| `unclear` — user-logged result, not a diagnosis |
| `notes` | Max 500 |

There is **no** period-range table. Periods are inferred from consecutive `light|medium|heavy` days.

### `CyclePartnerShare`

| Field | Notes |
| --- | --- |
| `ownerUserId` | Cycle owner. Cascades on user delete |
| `partnerUserId` | Bound after accept. SetNull if partner account deleted |
| `tokenHash` | SHA-256 hex of invite token. Unique lookup key |
| `permissions` | `{ period, cyclePhase, fertileWindow, symptoms }` |
| `expiresAt` | Server-enforced. Default 30 days |
| `revokedAt` | Owner revoke. Immediate |

### `PregnancyLog`

`date`, `currentWeek` 1–42, `weightKg` 30–200, `symptoms[]`, `kickCount`, `notes`. Unique `(userId, date)`.

### Query caps in `loadBundle`

- Cycle logs: last **400** rows (`orderBy date desc`).
- Pregnancy logs: last **120**.

Older history is dropped from inference/trends silently.

### Account deletion

`deleteUserAccount` (`server/src/lib/deleteUser.js`) is **admin-only**. User delete cascades Cycle* via Prisma `onDelete: Cascade`. No in-app user self-delete or cycle export dump.

---

## A4. Current cycle API

### `GET /api/cycle` → `CycleBundle`

```
profile, logs, pregnancyLogs,
predictions { nextPeriodStart, nextPeriodEnd, ovulationDate, fertileWindow, calendar, phases? },
pregnancy { dueDate, age, insight } | null,
inferred { avgCycleLength, avgPeriodLength, lastPeriodStart, periodStarts },
trends, alerts, summary, localInsights
```

Client TypeScript (`CycleBundle`) **does not type** `predictions.phases`, though the server sends it.

### `PATCH /api/cycle/profile`

Optional: `mode`, `avgCycleLength`, `avgPeriodLength`, `lastPeriodStart`, `isIrregular`, `dueDate`, `privacyEnabled`, `enablePartnerShare`, `conditions`, `reminderPrefs`.

Partner: `enablePartnerShare: true` generates a new code; `false` clears it.

### `PUT /api/cycle/logs/:date`

Partial upsert. Then `syncLastPeriodStart`: if inferred last bleed-run start differs from profile, overwrite `lastPeriodStart`.

### `DELETE /api/cycle/logs/:date`

Deletes **that date only**, then re-syncs LMP.

### `PUT /api/cycle/pregnancy/:date`

Upsert pregnancy day. Does not change predictions.

### `POST /api/cycle/insights`

If cache younger than 18h and `refresh` is false → cached cards + `localInsights`. Else quota + EvidenceMD; parse JSON cards; fallback to `localInsights` with `source: 'local_fallback'`.

### `GET /api/cycle/share/:code` (authenticated partner)

Requires JWT. Returns a permission-gated partner payload only after accept. Unauthenticated requests get 401 with no cycle fields. Invalid / expired / revoked / wrong user get the same 404 body.

---

## A5. Current cycle calculation engine

**Canonical file (server):** `server/src/lib/cycle.js`  
**Duplicate (client):** `mobile/src/lib/cyclePhase.ts` + `cycleDayNumber` in `CycleCalendar.tsx`

### Date helpers (server)

| Function | Behavior |
| --- | --- |
| `toDateKey(value)` | String `YYYY-MM-DD…` → first 10 chars. `Date` → **`toISOString().slice(0, 10)` (UTC)** |
| `parseDateKey` | `Date.UTC(y, m-1, d)` |
| `addDays` / `daysBetween` | UTC calendar arithmetic |

`today` for `detectCyclePhase`, `gestationalAge`, `buildCycleAlerts`, `buildCycleTrends` cutoff uses `toDateKey(new Date())` → **UTC date**, not Asia/Tbilisi.

### Period inference — `inferCycleStats`

1. Sort logs by `date`.
2. A **period start** is a `light|medium|heavy` day whose previous bleed day is missing or gap **> 1** day.
3. **Spotting is never a period start** (`PERIOD_FLOWS`).
4. Cycle gaps used for average: **18–45** days only; need **≥ 2 such gaps** else fallback (usually 28).
5. Period length: consecutive bleed-run length, keep runs **2–10** days; need ≥ 1 run else fallback 5.
6. Clamp averages to 21–45 and 2–10.

### Last period start — `pickLastPeriodStart` / `syncLastPeriodStart`

`inferred.lastPeriodStart || currentProfile || null`.  
Onboarding LMP is kept if there is no confirmed bleed run.  
Adding an earlier day to the **current** run rewinds LMP (tested).

### Cycle day / phase — `detectCyclePhase` (server)

```
dayOffset = daysBetween(LMP, today) + 1
cycleDay = ((dayOffset - 1) % avgCycleLength) + 1
ovulationDay = avgCycleLength - 14

cycleDay <= avgPeriodLength          → period
ovulation-5 … ovulation+1            → fertile; == ovulation → ovulation
cycleDay > ovulation+1               → luteal
else                                 → follicular
```

Client `detectCyclePhaseForDate` is the same formula for an arbitrary `targetDate`, using **local** `addDaysToKey` (`new Date(y, m-1, d)`).

`daysBetween` on the client uses `Date.UTC` (same as server). `addDaysToKey` uses **local** `setDate`. DST edges can diverge from server `addDays`.

### What is **not** a single source today

| Value | Server | Client |
| --- | --- | --- |
| Cycle day | `detectCyclePhase` (today only, UTC today) | `cycleDayForDate` / ring / home card |
| Phase | `buildLocalInsights` / AI prompt | Hub, day insights, `cycleAdvice.ts` |
| Predictions | `buildPredictions` | Displayed from bundle |
| Period ranges | Implicit in `periodStarts` + run scan | History UI lists starts only |
| “Today” | UTC `toISOString` | Device local `todayKey()` |

---

## A6. Current prediction logic

`buildPredictions({ lastPeriodStart, avgCycleLength, avgPeriodLength, horizonDays = 90 })`

If no LMP → empty calendar and null dates.

Otherwise, up to **4 cycles** or until `horizonDays` from LMP:

- Period: `[start, start + avgPeriodLength - 1]`, marks `{ period: true, predicted: true }`
- Ovulation: `start + (avgCycleLength - 14)`
- Fertile: ovulation **−5 … +1** (inclusive)
- Next cycle start: `start + avgCycleLength`

Returned:

- `nextPeriodStart` / `nextPeriodEnd` — **next** cycle after LMP (not the current period)
- `ovulationDate` / `fertileWindow` — **current** cycle (`upcoming` = first phase with `periodStart >= LMP`)
- `phases[]` — all generated cycles
- `calendar` — date → marks

### Overlay — `overlayLogsOnCalendar`

- Logged `light|medium|heavy` → `period: true`, **`predicted: false`**, `logged: true`, `flow`
- `spotting` → `logged: true`, `period: false`
- `none` or notes/symptoms/moods/BBT/sex → `logged: true`

Predictions are **not** written into `CycleLog`. Good: logs stay user data.

### What actually feeds `buildPredictions` (`loadBundle`)

```js
avgCycleLength: profile.avgCycleLength || inferred.avgCycleLength
avgPeriodLength: profile.avgPeriodLength || inferred.avgPeriodLength
```

`avgCycleLength` defaults to **28** in Prisma, so `28 || inferred` is **always 28**.  
**Inferred averages are shown in trends/summary but do not drive the forecast** unless the user saved a non-default length (still user-saved, not learned).

`isIrregular` does **not** change the calendar math. It only forces `predictionConfidence` → `low`.

### Confidence — `predictionConfidence`

| Condition | Level |
| --- | --- |
| `isIrregular` OR `cycleCount < 2` | `low` |
| `cycleCount < 6` | `medium` |
| else | `high` |

`cycleCount` = number of **valid 18–45 gaps**, not number of period starts.

Exposed on `summary` and `trends`, not on the hub hero.

Copy in UI/PDF often says **სავარაუდო**. Partner JSON does not.

---

## A7. Current period logging behavior

| Action | How | Effect |
| --- | --- | --- |
| First LMP | `CycleOnboarding` → `PATCH lastPeriodStart` | Unlocks calendar/predictions without logs |
| Settings LMP | Settings date field | Same |
| Hub “start period” | Writes flow on today (hub modal / log) | `syncLastPeriodStart` may move LMP |
| Daily flow | Log tabs or hub | Spotting ≠ start |
| Add historical period | `CyclePeriodHistory.addMissed` | Writes **N days of `medium`** (2–10) |
| Edit period | Pencil → `/cycle/log?date=start` | Edits **one day** |
| Delete period | Trash → `DELETE /logs/:start` | Deletes **start day only**; leftover bleed days remain |
| End period | None | End = last consecutive bleed day in inference |

Period history list = `inferred.periodStarts` (starts only). Cycle length next to a start comes from `trends.cycleLengths` (gap **to** that start).

---

## A8. Current symptom system

**UI catalog:** `mobile/src/constants/cycle.ts`

- Flow: none, spotting, light, medium, heavy
- Physical: ~45 chips (cramps, headache, migraine, GI, pain, vaginal, fever, …)
- Mood: ~18 chips
- Sexual chips: protected/unprotected, drive, orgasm, pain_sex (stored as **symptom keys**, plus `sexualActivity` + `libido`)
- Mucus: 5 types → `cervicalMucus` column

**API:** `symptoms` / `moods` are `z.string().max(40)` arrays (max 40 / 20). Custom keys are **accepted** but there is **no add-custom UI**.

**Not first-class cycle fields:** sleep quality score, exercise, caffeine, alcohol, hydration, meditation, OPK, pregnancy test, pain intensity/location/duration.

Hydration/steps live in `/health-metrics/*` and are not written onto `CycleLog`.

PMS heatmap keys: subset in `PMS_SYMPTOM_KEYS` in `cycle.js` (cycle days 18–35 of **current** LMP-aligned cycle only — not a true multi-cycle overlay per historical start).

---

## A9. Current TTC system

- Mode `TRY_TO_CONCEIVE` on profile.
- Same prediction math as period tracking.
- UI: fertile/ovulation copy, BBT + mucus on “more” tab / hub, TTC reminder for ovulation + fertile start.
- Local insight card `ttc_window` with estimated dates.
- **No** OPK/LH, **no** pregnancy test log, **no** BBT-shift ovulation confirmation.
- Irregular / PCOS: info alert that the window “may be longer”; math unchanged.

Reminder body today: `დღეს სავარაუდოდ ოვულაციაა` — estimate language present, still actionable.

---

## A10. Current pregnancy system

- Mode `PREGNANCY` + `dueDate`.
- `gestationalAge(due)`: pregnancy day = `280 - daysUntilDue`; week/day; trimester `<13` / `<27` / else.
- `fetalInsightForWeek` — Georgian fruit-size copy (`FETAL_SIZE_KA`).
- Screen: checklist (`PREGNANCY_CHECKLIST` stored as `symptoms[]` on `PregnancyLog`), weight, kicks, notes, `currentWeek` override field.
- Transition sheet estimates due date from LMP + 280 days (`CyclePregnancyTransitionSheet`).
- Predictions still built in `loadBundle` even in pregnancy mode; reminders skip period/PMS when mode is pregnancy.
- **No** in-module appointments (visits app is separate). **No** pregnancy-specific medication link.

---

## A11. Current reminders

| Piece | Where | Behavior |
| --- | --- | --- |
| Prefs | AsyncStorage via `cycleReminderPrefs.ts` | enabled, periodDaysBefore 0–5, ovulation, dailyLog, pms, mask + style |
| Server mirror | `CycleProfile.reminderPrefs` | Optional PATCH; **does not schedule** |
| Scheduler | `cycleReminders.ts` on hub load | Cancels + reschedules local notifications |
| Time | **09:00 device local** | No per-reminder clock, no TZ setting |
| Period soon | `nextPeriodStart - N` | Off in PREGNANCY |
| Period start | `nextPeriodStart` | Routes to `/cycle/log` |
| Ovulation / fertile | TTC + prefs.ovulation | Fertile = window **start** |
| PMS | `ovulationDate + 2` | Heuristic |
| Daily log | Today 09:00 if no log | |

**Privacy mask:** `cycleNotificationMask.ts` styles `neutral | wellness | calendar | notes`. Applied in `notifications.ts` when scheduling. Default mask **on**.

Not in cycle reminders: medication, birth control, pregnancy test, doctor appointment, custom.

---

## A12. Current privacy implementation

| Control | Implementation | Gap |
| --- | --- | --- |
| Auth | JWT on all `/api/cycle` routes including share | — |
| Female gate | `assertFemale` | 403 Georgian message |
| Cycle lock | `expo-local-authentication` on `/cycle` focus | Local pref `medicard.cycle.privacy.lock`; no PIN |
| `privacyEnabled` | Stored on profile | **Not** what the layout gate reads |
| Notification privacy | Mask presets | Real copy if mask off |
| Secure session | `expo-secure-store` (app-wide) | — |
| Partner peek | JWT + bound partner + live share + permitted fields | Pregnancy / notes / IDs not in payload |
| User delete / export | Admin delete only; PDF/ICS only | No GDPR-style dump |
| Logs / analytics | AI telemetry via `runTrackedAi` | Cycle prompt includes recent symptoms |

App-wide biometrics: `/profile/permissions` (separate from cycle lock).

---

## A13. Current partner sharing

1. Settings toggle → `PATCH enablePartnerShare` or `POST /api/cycle/share` (owner, female).
2. UI shows `https://medicard.ge/share/cycle/{64-hex}` (app route, not the API).
3. Partner must sign in, `POST /accept`, then `GET /:code` returns only permitted fields.
4. Default permissions: period ON, phase ON, fertile OFF, symptoms OFF. TTL 30 days. Owner can revoke and edit permissions.
5. Extra rate limit 20/min on `/api/cycle/share`. Morgan redacts the code. Responses are `Cache-Control: private, no-store`.

---

## A14. Current AI integration

| Layer | Role |
| --- | --- |
| `POST /insights` | EvidenceMD `CYCLE_WELLNESS`, temp 0.55, 1200 tokens, `skipDisclaimer: true` on provider; app still has disclaimer copy |
| `buildCycleAiUserPrompt` | Mode, age, averages, irregular, conditions, **server** phase, predictions, last 7 logs |
| `parseCycleInsightsJson` | headline + cards (tone whitelist) |
| `buildLocalInsights` | Template cards from server phase + recent symptoms |
| `buildCycleAdvice` (client) | Extra cards from **client** phase + today’s log + conditions |
| `CycleInsights.tsx` | Medi hero + companion cards; `mergeInsightCards` |
| Medi chat | Prefill / actions via `cycleInsightActions.ts` → `/chat` |

Cards are **generated**, not user logs. Cache 18h can outlive a new period log until refresh.

Safety: Georgian “არ არის დიაგნოზი” on report/chat; local cramp copy tells user to see a doctor. TTC/fertile cards can still read as personal facts.

---

## A15. Current HealthKit / Health Connect

| File | Role |
| --- | --- |
| `healthSync.ts` | Facade; no-op on Expo Go |
| `healthSync.shared.ts` | Pref `medicard.health.sync.enabled`; `CycleHealthPayload` |
| `healthSyncPlatform.ios.ts` | HealthKit write: menstrual flow, intermenstrual bleeding (spotting), mucus, BBT; read last period + other metric types for the wider app |
| `healthSyncPlatform.android.ts` | Health Connect equivalent (best-effort) |
| `CycleHealthConnectCard` | Settings connect / import LMP / disconnect |

Writes are **best-effort** and must not block Medicard saves (`syncCycleLogToHealth`, `syncPeriodStartToHealth`).

Not productized: Garmin, Oura, Apple Watch as cycle sources.

---

## A16. Current exports

| Format | Builder | Contents |
| --- | --- | --- |
| PDF (HTML print) | `cycleReport.ts` + summary screen | Mode, stored averages, shortest/longest/variability, estimated next period & ovulation, period starts, cycle lengths, top symptoms/moods, disclaimer |
| ICS | `cycleCalendarExport.ts` | Next predicted period, fertile window, ovulation — labeled პროგნოზი |

No CSV/JSON health dump. ICS uses UTC date values (all-day).

---

## A17. Current UI architecture

**Chrome tokens:** `mobile/src/theme/cycle.ts` — page `bg100`, cards `surface`, hairline `bg300`, CTA `#0D9488` dark / teal light. Rose `#E11D48` / `#FB7185` and purple `#C026D3` / `#E879F9` **only on period / fertile / ovulation data**.

**Shared chrome:** `CycleUI.tsx` (`CycleCard`, `CycleSection`, `CycleLoading`, FAB, tiles). Modals: `APP_MODAL_PROPS` (fade, not slide). Section titles above cards (`HomeSectionTitle` pattern).

**Hub composition (`/cycle`):**  
`CycleHomeHeader` → `CycleDayStrip` → `CycleRing` (day/length clock, not a score) → `CycleDayInsights` + `CycleInsights` → PMS heatmap → feature tiles → onboarding / hub modal / calendar sheet.

**Two log surfaces:** `CycleLogHubModal` (quick today) vs `/cycle/log` tabs. Same API.

**State:** per-screen `useState<CycleBundle>`; refetch on focus. No cycle store, no offline queue.

**i18n:** Georgian `ka.cycle.*` only.

**A11y:** some `accessibilityRole` / labels (history edit/delete). Calendar cells and chips are uneven. No systematic pass.

**Known native UX:** Yoga `gap` / `Pressable` margin and `LinearGradient` radius historically fail on device while web looks correct (audit 2026-08-30).

---

# Part B — Target architecture

## B1. Principles (decided)

1. **Do not rebuild.** Keep Prisma models, `/api/cycle` shape, Expo routes, and `server/src/lib/cycle.js` as the engine home.
2. **Server engine is the only source of medically meaningful values.** The client must not independently compute cycle day, phase, period ranges, lengths, predictions, fertile window, ovulation, or confidence for display or reminders.
3. **User logs stay user data.** Predictions never write into `CycleLog`. Overlay continues to set `predicted: false` on confirmed bleed.
4. **Estimates are labeled estimates** in API, UI, ICS, PDF, notifications, and any share payload (`estimated: true` or equivalent).
5. **Date keys are calendar days**, never timestamps-as-identity.
6. **No diagnosis.** Conditions are self-report. Advice is wellness. Correlations ≠ causation.
7. Unrelated Medicard modules stay as they are.

## B2. Canonical bundle (target)

`GET /api/cycle` (and every mutating response’s `bundle`) must include a **`canonical`** (name can be flattened into existing keys if we extend types — do not fork a second engine). Required fields:

| Field | Meaning |
| --- | --- |
| `meta.today` | `YYYY-MM-DD` in the **product timezone** (see B3) |
| `meta.timezone` | IANA name used to compute `today` |
| `cycleDay` | Integer or null (for `meta.today`) |
| `phase` | `period \| follicular \| fertile \| ovulation \| luteal \| unknown` |
| `phaseKa` | Display label |
| `periodRanges` | `{ start, end, lengthDays, source: 'logged' }[]` inferred from bleed runs |
| `averages` | See B4 |
| `predictions` | Existing fields + `confidence` + `estimated: true` on forecast dates + `calendar[date].cycleDay` / `.phase` / `.predicted` |
| `inferred` | Keep for history/debug; must not silently disagree with `averages.usedForForecast` |

**Client rules**

- Hub ring, header, home preview, AI advice, reminders, ICS, PDF, partner payload: **read bundle only**.
- Allowed on client: format `YYYY-MM-DD` for display, navigate months, chip catalogs, form state, `todayKey()` **only as a fallback label when the bundle has not loaded** — not for phase math.
- `mobile/src/lib/cyclePhase.ts` medical functions become **deprecated** and must be removed from render paths in the implementation phase. Copy helpers (`buildDayPredictions` text) may stay if they consume **server** `phase` + `mark`, not recomputed day.

**Selected past/future day:** use `predictions.calendar[date]` (extended marks) or `periodRanges`. Do not re-run modulo math on the device.

## B3. Date-key and timezone rules (target)

| Rule | Target |
| --- | --- |
| Identity | Every log, LMP, due date, calendar cell, reminder YMD is `YYYY-MM-DD` |
| Product timezone | **Asia/Tbilisi** (already documented on `CycleLog.date` and DailyCheckIn) |
| Server `today` | Format “now” in `Asia/Tbilisi`, **not** `Date#toISOString` UTC |
| Persist dates | Keep `@db.Date` + `T00:00:00.000Z` **only if** we always serialize via the date key, never via UTC “today” |
| Client `todayKey()` | Device local. **Must not** drive cycle day once bundle exists. If device TZ ≠ Tbilisi, show server `meta.today` as the cycle “today” |
| Arithmetic | One shared algorithm: add/diff on civil dates (UTC date parts **or** Tbilisi civil — pick one implementation, use it on server only) |

**Open:** whether travelers should get device-local “today” for logging vs Tbilisi. Default target: **log date = user-picked / device calendar day they confirm**; **engine today = Tbilisi** until decided otherwise. See unresolved #4.

## B4. Prediction rules (target)

Keep the existing calendar-math model (LMP + averages, ovulation = length − 14, fertile −5…+1, ~90 days, 4 cycles). Do not invent a new fertility engine in v1.

**Forecast inputs**

- `lastPeriodStart` = profile after `pickLastPeriodStart` (unchanged).
- **Length used for forecast** must be explicit in the API:

```
averages: {
  storedCycleLength,      // profile.avgCycleLength
  storedPeriodLength,
  inferredCycleLength,    // inferCycleStats
  inferredPeriodLength,
  usedCycleLength,        // what buildPredictions actually used
  usedPeriodLength,
  source: 'user' | 'inferred' | 'default',
  cycleCount              // valid gaps
}
```

**Decided for implementation (pending the one open choice in unresolved #1):** the client and PDF must display `used*` and `source`, never imply the forecast is “from your last 6 cycles” if `source === 'default'`.

**Overlay:** keep current rules. Logged bleed is never `predicted: true`.

**Recalculation:** every `loadBundle` after log/profile write. No client-side forecast.

**Insufficient data:** no LMP → empty predictions, onboarding. `cycleCount < 2` → `confidence: 'low'`, `source` default or user.

## B5. Confidence rules (target)

Keep `predictionConfidence` thresholds (irregular or `<2` → low; `<6` → medium; else high).

Additionally:

- Attach `confidence` to `predictions` (not only summary/trends).
- Hub and TTC copy must show the level (or “დაბალი სიზუსტე”) when not `high`.
- Irregular or PCOS: **never** upgrade confidence via UI chrome.

## B6. Irregular-cycle rules (target)

- Same calendar math (no second algorithm in v1).
- `isIrregular` **and/or** `variability` large → `low` confidence.
- Valid gaps stay 18–45 for averaging; out-of-range gaps still create period starts (current behavior) but do not enter the average.
- Alerts for last gap `<21` or `>35` stay informational, not diagnostic.
- TTC fertile reminders: **soften or suppress** when confidence is `low` (see B7).

## B7. TTC safety rules (target)

- Fertile window and ovulation are **estimates**. API marks `estimated: true`.
- UI/notifications: სავარაუდო; never “you are ovulating” as fact.
- BBT/mucus remain observations, not confirmed ovulation.
- If `confidence === 'low'` or conditions include `pcos`: do not schedule assertive ovulation/fertile push copy; use “შეიძლება ნაყოფიერი პერიოდი იყოს — პროგნოზი დაბალი სიზუსტით” or skip those two notifications.
- No OPK/pregnancy-test features in this spec’s implementation order until product asks.

## B8. Contraception rules (target)

- Phase 8 added `contraceptionMethod` / `contraceptionStartedAt` on CycleProfile plus a server interpretation layer (`NORMAL` / `CAUTION` / `LIMITED`). Engine math is unchanged.
- Target v1 (no new tables required): settings + hub + PDF disclaimer — hormonal contraception / IUD can make period/ovulation forecasts **wrong**; user should not use Medicard as contraception.
- Do **not** silently change −14 math without a contraception model (future phase, out of scope until decided).

## B9. Data privacy rules (target)

| Rule | Target |
| --- | --- |
| Auth | All cycle **write** and **full bundle** routes stay JWT + female |
| Partner | Must not remain an unauthenticated forever-URL of fertility dates. Disable, or signed expiring token + revoke + no pregnancy/fertile dates without explicit scopes (decision #3) |
| Notifications | Mask default on; lock-screen preview stays |
| Lock | Keep biometric gate; document that `privacyEnabled` should either drive the same lock or be removed from API later |
| Minimization | Share payloads: only fields the user opted into |
| Deletion | User-facing delete/export is a later P1; admin cascade already deletes cycle rows |
| AI | Prompts may include recent logs; do not log raw cycle payloads to third-party analytics beyond existing EvidenceMD/telemetry |
| Predictions vs logs | Never persist AI or forecast into `symptoms` / `notes` |

## B10. Period ranges (target, no new table required)

`inferCycleStats` already walks bleed runs. Target: return **`periodRanges`** `{ start, end, lengthDays }` for each run (end = last consecutive PERIOD_FLOWS day).

UI history: edit/delete must eventually operate on a **range** (implementation phase). Spec only: engine exposes ranges so the client does not reconstruct them incorrectly.

Spotting never extends a range.

## B11. UI architecture (target, no redesign of unrelated app)

- Keep current routes and chrome tokens.
- Display **server** ring day, phase chip, calendar marks.
- Keep rose/purple on period/fertile/ovulation **data** only.
- Dual log UI is a product cleanup (unresolved #8), not an engine change.
- Native spacing/radius fixes stay in the existing components (implementation later).

## B12. What this spec explicitly does **not** add

Birth-control types, OPK/pregnancy tests, pain diary, custom-symptom UI, education library, Garmin/Oura, CSV dump, PIN lock, partner productization (beyond closing the leak), offline sync protocol — unless a later phase updates this file.

---

# Part C — Implementation discipline (for later phases)

When implementation starts:

1. Change `server/src/lib/cycle.js` + `loadBundle` + tests first.
2. Extend `CycleBundle` types to match.
3. Point mobile render/reminders at bundle fields.
4. Remove client phase/day from hub, home card, advice.
5. Do not add features from the audit checklist in the same PR as the engine contract.

---

# Part D — Files inspected

### Server

- `server/prisma/schema.prisma` — `User`, `CycleProfile`, `CycleLog`, `PregnancyLog`
- `server/src/lib/cycle.js` — engine
- `server/src/lib/cycle.test.js` — engine tests
- `server/src/routes/cycle.routes.js` — HTTP + `loadBundle` + partner handler
- `server/src/server.js` — mount `/api/cycle`, public share
- `server/src/lib/deleteUser.js` — admin delete / cascade

### Mobile — API, engine, prefs

- `mobile/src/lib/api.ts` — `CycleBundle`, `api.cycle`
- `mobile/src/lib/cyclePhase.ts` — client day/phase/cards
- `mobile/src/lib/cycleAdvice.ts` — client Medi tips
- `mobile/src/lib/cycleLabels.ts`
- `mobile/src/lib/cycleAnalytics.ts`
- `mobile/src/lib/cycleReminders.ts`
- `mobile/src/lib/cycleReminderPrefs.ts`
- `mobile/src/lib/cycleNotificationMask.ts`
- `mobile/src/lib/cyclePrivacy.ts`
- `mobile/src/lib/cycleReport.ts`
- `mobile/src/lib/cycleCalendarExport.ts`
- `mobile/src/lib/cycleInsightActions.ts`
- `mobile/src/lib/notifications.ts` (mask on schedule)
- `mobile/src/lib/healthSync.ts`
- `mobile/src/lib/healthSync.shared.ts`
- `mobile/src/lib/healthSyncPlatform.ios.ts`
- `mobile/src/lib/healthSyncPlatform.android.ts`
- `mobile/src/constants/cycle.ts`
- `mobile/src/theme/cycle.ts`
- `mobile/src/i18n/ka.ts` (`ka.cycle`)

### Mobile — screens & UI

- `mobile/app/cycle/_layout.tsx`
- `mobile/app/cycle/index.tsx`
- `mobile/app/cycle/log.tsx`
- `mobile/app/cycle/settings.tsx`
- `mobile/app/cycle/summary.tsx`
- `mobile/app/cycle/trends.tsx`
- `mobile/app/cycle/pregnancy.tsx`
- `mobile/src/components/cycle/*` (calendar, strip, ring, insights, hub modal, period history, onboarding, Health card, pregnancy sheet, …)
- `mobile/src/components/home/HomeCyclePreviewCard.tsx`

Audit conversation (2026-08-30) used as the product inventory; this spec prefers **code** over the audit where they differ.

---

# Part E — Architecture discovered (summary)

```
PostgreSQL
  CycleProfile (mode, averages, LMP, irregular, due, share code, AI cache, conditions)
  CycleLog     (daily flow / symptoms / mood / sex / BBT / mucus / notes)
  PregnancyLog (week / weight / checklist / kicks / notes)

Express /api/cycle
  loadBundle → infer → predict(profile averages) → overlay → extras
  Auth GET/POST/PATCH/DELETE /share + partner accept/peek

Expo /cycle
  Display bundle + RECOMPUTE phase/day locally
  Local notifications @ 09:00
  Local biometric lock
  HealthKit / Health Connect best-effort
  PDF + ICS from bundle
```

**Single engine intent:** `server/src/lib/cycle.js`.  
**Actual engines today:** that file **plus** `cyclePhase.ts` **plus** UTC vs local “today”.

---

# Part F — Unresolved architectural decisions

Do not implement these until product/eng signs them.

### 1. What length drives the forecast?

**Decided (Phase 1):** **C.** Do not persist inferred averages onto `CycleProfile`. `buildPredictions` uses inferred when `cycleCount ≥ 2`, else stored user values, else defaults 28/5. API exposes `averages.source`: `user` | `inferred` | `default`.

### 2. Period ranges: inferred only vs first-class rows

**Decided (Phase 3):** inferred only. `CycleLog.flow` of `light|medium|heavy` is the source of truth. No `Period` table. `PUT /api/cycle/period` is a shortcut over CycleLog upserts (`start` / `end` / `fill`).

**Phase 3.1:** `end` never synthesizes `flow`. It only clears bleed after the chosen day. Missing days stay unlogged. Schema cannot store “bled, intensity unknown” — do not fake `medium`. `fill` remains an explicit historical action and must be user-confirmed.

### 3. Partner share

**Decided (Phase 2):** possession of a URL/code is not authorization. Partner must be authenticated. Invite token is 64 hex from `randomBytes(32)`, stored as SHA-256 hash. Default TTL **30 days**. Owner can revoke. Partner payload is permission-gated (`period`, `cyclePhase`, `fertileWindow`, `symptoms`) — not the full CycleBundle. Public unauthenticated GET never returns cycle data.

### 4. “Today” if the phone is not in Georgia

Log date = device day vs Tbilisi engine day.  
Default in B3 is hybrid; travelers can get off-by-one vs predictions. **Needs a decision.**

### 5. Offline

**Decided (Phase 6 / 6.1):** cache the last successful canonical `CycleBundle` (stale snapshot + Georgian banner). Persist a per-`userId` mutation queue. The client must **not** advance cycle day / phase / windows / confidence from elapsed time. Partner peek stays online-only.

Native: AES-256-GCM envelope in FileSystem; 256-bit DEK in SecureStore / Keychain / Keystore (`WHEN_UNLOCKED_THIS_DEVICE_ONLY`). Web: **no durable** Cycle health persistence (session memory only; never claim “saved on this device”). Logout keeps scoped encrypted blobs; never replay User A into User B. Account/health deletion must call `destroyCycleOfflineAccount`.

Conflict v1: last accepted user edit wins at the day-log level. Prisma `CycleLog.updatedAt` exists but is **not** used for client conflict detection yet — do not claim otherwise.

### 6. `privacyEnabled` vs local lock

Two switches. Unify, or drop the server flag from UX. **Not decided.**

### 7. Client `cyclePhase.ts` after cutover

Delete medical functions vs keep for unit tests / offline stale UI. **Not decided** (lean delete from production render paths).

### 8. Dual log UI

Hub modal vs `/cycle/log` — product IA, not engine. **Not decided.**

### 9. Contraception beyond disclaimer

Disclaimer-only (B8) vs future `contraceptionMethod` on profile that **changes or disables** ovulation math. **Not decided** (v1 = disclaimer only).

### 10. PMS day mapping

Trends map logs to cycle day using **current** LMP + stored average, not each historical cycle’s start. Fixing that is an engine change. **Not decided** for v1.

---

# Document history

| Date | Change |
| --- | --- |
| 2026-08-30 | Initial specification from full-repo audit. No code changes. |
| 2026-08-30 | Phase 1: decision #1 locked to C. Server engine is canonical. |
| 2026-08-30 | Phase 2: partner share is authenticated, expiring, revocable, permission-gated. |
| 2026-08-30 | Phase 3: period ranges stay inferred from CycleLog bleed days. PUT /period start/end/fill. |
| 2026-08-30 | Phase 3.1: End Period no longer invents medium-flow days. |
| 2026-08-30 | Phase 4: Cycle UX/UI quality. No engine or data-model change. |
| 2026-08-30 | Phase 5: medical honesty and estimate language. No engine math change. |
| 2026-08-30 | Phase 6: offline queue + stale canonical bundle cache. No engine math change. |
| 2026-08-30 | Phase 6.1: native AES-GCM Cycle offline store; web persistence reduced. |
| 2026-08-30 | Phase 7: TTC fertility observations (OPK, pregnancy test) on CycleLog. No engine math change. |
