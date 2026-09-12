# Cycle observation trends contract — Phase 13

**Status:** Journal observation trends (Android). Not a Cycle product-final.  
**Date:** 2026-09-09  
**App version:** mobile `39.0.27`  
**Frozen:** engine, segmentation, forecast, confidence, late, fertile window, ovulation estimate, prediction-history, observation registry writes, privacy, partner, Notification Brain, Quick Log / More Tracking.

This is observational history. It is not diagnosis, not AI, and not a forecast input.

---

## 1. Architecture

Server-authoritative aggregation in `server/src/lib/cycleObservationTrends.js`.

`GET /api/cycle/observation-trends` (owner-only, `Cache-Control: no-store` via Cycle router).

Not attached to Overview `GET /api/cycle`.

Mobile renders structured facts. It does not scan CycleLog rows to invent analytics.

No cache. A CycleLog write is visible on the next Journal fetch.

---

## 2. Query window

Fetch the last **180 civil days** of the owner’s CycleLog rows.

Recent occurrence counts use the last **30** of those days.

Period episode recurrence uses up to **6** completed logged bleed ranges that overlap that window.

Storage is unchanged. Old observations are not deleted because the presentation window is recent.

Existing `(userId, date)` identity is enough. **No GIN index** on `observations` JSONB.

---

## 3. Registry metadata

| Field | Phase 13 |
|---|---|
| `trendEligible` | explicit; **new keys default false** |
| `trendGroup` | `pain` / `energy` / `digestion` / `skin` / `physical` |
| `minimumOccurrences` | 2 (factual row; never “often”) |
| `minimumObservedDays` | same default |
| `displayPriority` | pain 10, energy 20, digestion 30, skin 40, physical 50 |

Unknown stored keys never generate trends.

Mood is **not** trend-eligible in Phase 13 (taxonomy overlap with tired/fatigue/energy).

---

## 4. Eligible vs excluded

**Eligible**

- Canonical pain types from `painEntries` (`pain.cramps`, `pain.headache`, …). Legacy pain-managed chips count only when no matching painEntry exists (once).
- Grouped low energy: `energy.low` = `low` or `very_low`. No numeric mean.
- Digestion: bloating, nausea, vomiting, constipation, diarrhea, gas.
- Skin: acne, dry_skin, oily_skin, itchy_skin, hair_loss.
- Selected physical: fatigue, migraine, dizziness, hot_flashes.

**Excluded**

sexual activity, libido, sexual-health chips, pregnancy test, OPK, BBT, cervical mucus, notes, custom tags, discharge, night sweats, moods, appetite/cravings.

---

## 5. Thresholds and missing data

| Occurrences (positive days) | UI |
|---|---|
| 0–1 | no trend card |
| 2 | factual count. No “often / usually / frequently”. |
| ≥3 | same factual recurrence copy (still no “often”) |

A day without a log is **not** “symptom absent”.

No percentages. No “3 out of 10 days”. No exposure-normalized luteal claims.

---

## 6. Period association

Uses frozen `inferCycleStats` **logged** `periodRanges` (`source: 'logged'`).

A date is associated only if it falls inside `[range.start, range.end]`.

**Predicted** period days never count. Ranges with `source: 'predicted'` are dropped.

Window is the actual bleed range only — not start−2 / end+2.

Copy example: “logged during 3 of the last 4 completed periods” uses completed episodes as the denominator of **episodes**, not missing symptom days.

---

## 7. Trend types

Finite set:

- `RECENT_OCCURRENCE` — positive days in the last 30
- `PERIOD_EPISODE_RECURRENCE` — positive logs inside completed bleed episodes (needs ≥3 completed episodes)
- `RECENT_SEVERITY_DISTRIBUTION` — fallback when ≥3 same-type pain severities exist and recent/episode thresholds are not met. Neutral “mostly moderate”. **No improving/worsening.**

No generic INSIGHT blobs. No charts in v1.

---

## 8. Ranking and UI limit

Sort: trendGroup priority, then occurrenceCount desc, then lastLoggedDate desc, then key.

Journal shows at most **5** rows. `მეტის ნახვა` reveals the rest.

Empty: `ტენდენციები გამოჩნდება, როცა რამდენიმე დღის ჩანაწერი დაგროვდება.`

No empty chart shells. PMS heatmap mounts only when `hasPmsPattern`. Overlapping Phase 9 symptom/pain sentences and 90-day symptom bars are not shown beside these rows.

---

## 9. Copy rules

Allowed: “You logged…”, “Appeared on…”, “Was logged…”.

Forbidden: because / means / indicates / hormones caused / you probably have / fertile today / ovulation confirmed.

Georgian lives on the client. Server sends `summaryType` + `summaryArgs` only.

---

## 10. Privacy

Owner-only. Not in partner payload. Not in EvidenceMD / OpenRouter prompts. Not in doctor summary. Not in ProductEvent. No trend push notifications.

Payload contains keys, counts, dates of **approved trend keys only**. No notes, sexual fields, or fertility-test values.

---

## 11. Engine

Observation trends do not change periodStarts, cycle length, next period, fertile window, ovulation estimate, or confidence.

---

## 12. Future

Do not add luteal “more often” without an exposure denominator. Do not trend sensitive fertility/sexual keys without a new phase. Do not attach this payload to Overview.
