# Cycle notification contract

Phase 4. Engine math stays in `docs/CYCLE_ENGINE.md`. This document is privacy + delivery only.

---

## Privacy semantics

| Field | Where | Default | Meaning |
|---|---|---|---|
| `privacyEnabled` | `CycleProfile` (synced) | `false` | Broad Cycle privacy mode. Does **not** enable Face ID. |
| `maskNotifications` | device pref `medicard.cycle.notifications.masked` | **true** (`!== '0'`) | Explicit lock-screen Cycle copy preference. |
| `privacyLock` | device pref `medicard.cycle.privacy.lock` | false | Face ID / PIN for Cycle screens. Independent. |
| `discreet` | Medi engage prefs | false | Global lock-screen discreet copy for Medi engagement. |

Stored fields are never rewritten to match each other.

### Effective mask

```
effectiveCycleMask =
  maskNotifications === true
  OR privacyEnabled === true
  OR discreet === true
```

Masking is **DELIVER_WITH_DISCREET_COPY**, not disable.

| privacyEnabled | maskNotifications | Effective mask | Notes |
|---|---|---|---|
| false | false | off | User wants explicit Cycle copy |
| false | true | on | Default for existing devices |
| true | false | **on** | Closes the privacy gap; stored mask stays false |
| true | true | on | Explicit mask still wins as source |

Turning privacy off does **not** clear a stored mask.

No database migration. Behavior is derived at schedule + delivery time.

---

## Masked copy

Delivery template: `cycle-masked` (admin overlay + Phase 3 fertility safety still apply to unmasked fertility templates).

Georgian (app language; there is no en/fr/ru Cycle UI):

- Title: `Medi-სგან შეხსენება`
- Body: `როცა დრო გექნება, შემომიარე 💚`

No period, fertility, ovulation, PMS, pregnancy, sex, or symptom words.

Payload when masked: `templateKey: cycle-masked`, `masked: true`, route only (no cycleDay, ovulation date, symptoms, sexual fields).

---

## Notification inventory

| Type | Class | Scheduler | Delivery owner | Brain sees it | Default |
|---|---|---|---|---|---|
| period soon / start | A calendar reminder | Mobile local DATE 09:00 | Brain revalidation + mask | Yes, at fire | User toggle (`reminders.enabled`) |
| ovulation / fertile / OPK / BBT | A, TTC + fertility markers | Local 09:00 | Brain at fire | Yes | User toggles; LIMITED/PREGNANCY suppress |
| PMS | A | Local 09:00 | Brain at fire | Yes | User toggle |
| daily log | D user-configured | Local 09:00 | Brain at fire | Yes | Off by default |
| late / deviation | E status | **none** | n/a | Candidate exists, `notifyEligible: false` | No push |
| `engage-insight-cycle` | C insight | Notification Brain | Brain | Yes | `cycleRegular` still false; privacy masks copy if it ever fires |
| `cycle-tip` | D / QA | Local interval | Brain mask | Yes | Dev / in-app tip |
| Admin Expo broadcast | remote | Server `sendExpoPush` | Not Cycle scheduler | No | Templates only; not a Cycle cron |
| Medication | — | Local | Brain; **dose bypass** | Yes | Does **not** apply to Cycle |

There is **no** server Cycle cron and **no** second Cycle push system.

### Why local calendar reminders stay local

They are user-configured alarms (Cycle settings), not Medi engagement. They do **not** consume Brain daily caps or medication exceptions. Brain still owns: quiet-hour bump (`bumpOutOfQuiet`), delivery-time revalidation, effective mask, and suppression.

Same event cannot fire from server and mobile: server never schedules these keys.

---

## Candidate schema

```
type, eventDate, candidateId = cycle:{type}:{YYYY-MM-DD},
templateKey, route, priority, estimated, predicted,
privacyClass, urgency, notifyEligible, revalidationKey
```

Predicted fertility/ovulation candidates keep `predicted: true` and `estimated: true`. Brain must not treat them as confirmed.

Late candidates are emitted when the bundle has a late alert, with `notifyEligible: false`. **No late push in this phase.**

---

## Pipeline

```
engine facts (frozen)
  → buildCycleCandidates
  → user prefs + contraception + pregnancy filters
  → pick one candidate per civil date
  → privacy resolution (effective mask)
  → template (real key or cycle-masked)
  → Phase 3 fertility safety overlay (unmasked fertility keys)
  → schedule local 09:00 (quiet hours bumped via Brain helper)
  → at fire: Brain shouldDeliverNotification
       revalidate civil event date
       rewrite unmasked → discreet if privacy turned on after schedule
       suppress stale / disabled / contraception / pregnancy
  → send / hide
```

---

## Revalidation

| Situation | Reason |
|---|---|
| Predicted date moved | `STALE_PREDICTION` |
| Logged bleed today | `PERIOD_STARTED` |
| LIMITED hides fertility markers | `CONTRACEPTION_SUPPRESSED` |
| PREGNANCY mode | `PREGNANCY_SUPPRESSED` |
| Type or master reminder off | `USER_DISABLED` |
| OS permission off | `GLOBAL_DISABLED` |
| Same `candidateId` already sent | `DUPLICATE` |
| Late | `NOT_ELIGIBLE` |
| Privacy on after unmasked schedule | `DELIVER_WITH_DISCREET_COPY` (still delivers) |
| Mask off after masked schedule | still delivers **masked** (no unexpected unmask) |
| Travel / TZ change | civil `eventDate` unchanged; fire clock is local 09:00 |

Quiet hours: Cycle uses Brain `bumpOutOfQuiet`. No separate Cycle quiet-hour engine. User reminders are not dropped for quiet hours; they are shifted.

Frequency cap: Cycle calendar reminders are **not** engagement and do **not** count toward Medi daily cap. Same-day Cycle collision is solved by priority (period start > soon > ovulation > fertile > PMS > OPK > BBT > log).

---

## Deep links

Opaque routes only: `/cycle`, `/cycle/log`. No fertility status, cycle day, or symptom in the URL.

---

## Analytics

`PushEvent` title/body for `cycle-*` / `cycle_reminder` is stored as `[cycle-redacted]`. Structured key is kept. NotificationOutcome uses decision ids for engage only; Cycle calendar reminders have no health text in outcomes.

---

## Timezone

Event identity is the engine civil date. Delivery time is the device local clock (09:00, quiet-bumped). Logged Cycle dates are not mutated when the user travels.
