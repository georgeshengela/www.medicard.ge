# Medicard.GE — remaining actionable blockers

**Date:** 2026-09-15 evening  
**Candidate:** `f3c4a51` + uncommitted working tree  
**Identity:** `1.0.0.8.56` / iOS `1.8.56` / native floor 67  
**Production inspect:** read-only. No deploy, SQL, cron register, paid EAS, or store submit.

Status: **FIXED (local)** · **OPEN** · **ELIGIBILITY** (store/account, not a code patch) · **SCOPED** (out of listing claims).

---

## Closed in the working tree (must deploy / ship JS)

| ID | What | Blocks until |
|---|---|---|
| RA00-001 | Live `/uploads` 401 | Already on production |
| RA00-002/003/004 | Rewards/Cycle crashes | Next **mobile** binary |
| REL-AI-01 | Untrusted clinical context is a user turn, not a second system message. **Not complete injection-proofing.** | **Server** deploy |
| REL-HK-01 | HealthKit purpose strings name cycle read/write | Next **native** rebuild |
| REL-AUTH-01 | Auth-write 80/15min; skip GET `/me`; `trust proxy` 1 | **Server** deploy |
| REL-ADMIN-LOGIN-01 | Admin login 20/15min | **Server** deploy |
| REL-LOGOUT-01 | Logout cancels all local Brain alarms | Next **mobile** JS |
| REL-SMS-01 | Delete account redacts SmsLog content | **Server** deploy |
| REL-MD-01 | Chat links http(s) only | Next **mobile** JS |
| REL-SEED-01 | Seed never rotates existing admin hash | **Server** deploy |
| REL-IAP-01 | Purchase CTAs **off** unless `CONSUMER_PURCHASES_ENABLED=true` | **Server** + **mobile** JS. Does **not** implement IAP |
| RA00-005 | Retention **script** exists, dry-run default | Owner `--execute` later; not a crash |
| REL-PHOTO-01 | R2/S3 env contract documented; disk still default | Owner bucket credentials |
| REL-TM-01 | Cron **prepared** in `server/docs/tbilisi-moves-finalize.render.yaml` | Owner copy-paste into `render.yaml` **if** auto awards wanted. Today: **manual** |

---

## Still open — technical / native

| ID | Evidence | Action |
|---|---|---|
| REL-NATIVE-01 | No IPA/AAB compiled this pass. No `gradlew`. No `mobile/ios`. `adb` empty | EAS **preview/development** binary, separate from owner Expo Go. Paid production EAS not started here |
| REL-HEALTH-01 | Expo Go cannot run HealthKit/Health Connect | Same binary; grant + same-day steps + repeat sync |
| REL-PUSH-01 | OS banners never observed this pass. Local Brain ≠ FCM | Same binary; one med + one pet-care DATE trigger, app backgrounded |
| REL-FCM-01 | No `google-services.json` | Only if **remote** Android campaigns are in the listing |
| RA00-006 | Render `release` = generate+seed, not migrate deploy | Additive `db execute` only. **No SQL this ship** |
| RA00-007 | Historical `tsc` debt | Crash-class identifiers above are tested; remaining tsc is not a green gate |

---

## Still open — store / account eligibility (cannot code around)

Owner decision: **keep** Apple/Google accounts under Giorgi Shengelia. Organization later. That does **not** waive current rules.

| ID | Official rule (accessed 2026-09-15) | Impact |
|---|---|---|
| REL-LEGAL-01 | Apple **5.1.1 (ix)** — healthcare / sensitive data → **legal entity**, not individual. https://developer.apple.com/app-store/review/guidelines/ | App Store submit under Individual is a **review risk**. Do not hide health features to dodge it |
| REL-PLAY-ORG | Play: Health/Medical apps **must register as an Organization**. https://support.google.com/googleplay/android-developer/answer/17125096 | Play production listing under Individual is a **policy miss** until conversion |
| REL-LEGAL-ADDR | Privacy copy still “when registered”; no street/D-U-N-S in repo | Owner fills Connect/Play forms. Do not invent |

---

## Monetization (honest)

Subscription **sales are desired**. StoreKit / Play Billing / account payment eligibility are **absent**.

This tree **does not** grant paid access from a client tap. Admin grants remain. First listing options:

1. **Free launch** — FREE quotas; paid packages only if already granted.  
2. **Paid launch later** — after IAP **and** Organization/legal-entity eligibility.

Do not turn paid modules free for everyone.

---

## Explicit non-blockers

Medi Hunt (unmounted). `mobile/src/app` must stay absent. Fifth tab forbidden. Pets/Tbilisi Neon SQL already applied — do not re-run. QA OTP fail-closed in production. Nightingale not in user copy. Tbilisi `pilotMode=true` stays.
