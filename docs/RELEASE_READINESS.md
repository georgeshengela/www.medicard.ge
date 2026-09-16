# Medicard.GE — release package (2026-09-15 evening)

**Candidate:** git `f3c4a51` plus the uncommitted working tree on this machine (crash/AI/auth/billing/retention/finalize-prep).  
**Public identity in tree:** `1.0.0.8.56` (iOS marketing `1.8.56`, local native floor `67`). **Not bumped** — bump only when the store binary is actually cut.  
**Production inspect (read-only, 2026-09-15 ~21:25 UTC+2):** `https://medicard.ge` `/health` ok; Tbilisi `schemaReady` + `featureEnabled` + `enrollmentOpen` + **`pilotMode=true`**; `minAppVersion=1.0.0.1.11`; packages FREE/STANDARD 19.99 / ULTIMATE 49.99; `consumerPurchasesEnabled` **absent on live** (treat as off after this mobile JS ships).  
**Not a claim of legal compliance or store approval.**

Companion: `docs/RELEASE_BLOCKERS.md`, `docs/RELEASE_RUNBOOK.md`.

---

## 1. Split verdict

| Track | Status |
|---|---|
| **Server JS** | Ready to **deploy** (prepared, **not executed**). Includes Medi context wrapping, auth-write limiter, admin login limiter, SMS redact, seed password policy, purchase flag, AiInteraction retention **script**. |
| **Mobile JS** | Ready to **include in the next store/dev binary**. Crash fixes, logout reminder cancel, http(s) chat links, purchase CTAs off by default. |
| **Native binary** | **Not compiled, not installed, not device-tested** on this pass. `mobile/android` has no Gradle wrapper; `mobile/ios` absent. Expo Go ≠ HealthKit / OS banners. |
| **Store / account eligibility** | **Not ready to submit.** Accounts stay under Giorgi Shengelia (Individual). Medicard collects sensitive health data and offers health AI. Official rules require a **legal entity** for this class of app (see §9). Future organization conversion is **not** current approval. |
| **Paid consumer billing** | **Not implemented.** Launch configuration **hides purchase CTAs** (default off). Existing admin-granted entitlements stay. FREE quotas stay 3/day · 90/month unless the user already has another package. |

Do **not** silently disable Pets or თბილისი მოძრაობს on production. Scope **store claims**, not product flags.

---

## 2. What this pass fixed and verified

Previous audit fixes **still in the tree** (source + tests): RA00-002/003/004, REL-AI-01, REL-HK-01, REL-AUTH-01, REL-ADMIN-LOGIN-01, REL-LOGOUT-01, REL-SMS-01, REL-MD-01, REL-SEED-01.

**New this pass (local, not deployed):**

| ID | Change | Verification |
|---|---|---|
| REL-IAP-01 (scoped) | `consumerPurchasesEnabled` defaults **false**. Package + profile no longer show a buy CTA. Copy says in-app payment does not work; current plan/limits stay; admin grant is not a purchase receipt. | Local `GET /api/app/status` → `consumerPurchasesEnabled: false`. Unit tests. |
| REL-SEED-01 | `resolveAdminSeedAction`: existing admin never rotates hash whether `ADMIN_PASSWORD` is set or not; production **create** aborts without it. | `seedAdminPolicy.test.js` |
| REL-SMS-01 / push | Logout unregisters **this device token** only (`token + userId`). | `pushUnregisterPolicy.test.js` |
| REL-AUTH-01 | `trust proxy` 1 + write-only limiter; GET `/me` skipped. | `apiLimiterPolicy` + `rateLimitSeparation` |
| RA00-005 | Retention **script** dry-run default: redact prompts after 90d, delete redacted rows after 365d if no eval results. **Not** on API boot. **Not** run against production. | `aiInteractionRetention.test.js` |
| REL-PHOTO-01 | Object-storage **config** (R2/S3 env). Until all four vars exist, disk stays ephemeral. No production file move. | `objectStorage.test.js` |
| REL-TM-01 | Concurrent-run advisory lock on the **runner**; prepared cron YAML **not** copied into live `render.yaml`. Live finalization remains **manual**. | `tbilisiFinalizeScheduler.test.js`; production status `pilotMode=true` |

**Prompt wrapping is not complete injection protection.** Untrusted notes are a user turn in `<clinical_context>`; a model can still be socially engineered. Do not market “injection-proof.”

**Account switch:** cycle queue and pet-care confirms are `userId`-scoped (`flushCycleQueue(user.id)`, `queuedConfirmMayReplay`). Logout cancels **local** Brain alarms on this device; it does not clear another phone.

---

## 3. Launch scope (keep enabled; be honest in the listing)

Include after a **device-tested** binary: auth, home, records, meds, Medi (with disclaimer), labs, cycle (female), health metrics, Pets/Medi Vet, თბილისი მოძრაობს enroll/boards (activity ranking, not medical), Quest/rewards (no cash), pharmacy browse, account deletion.

**Listing must not promise:** automatic Tbilisi daily awards (finalizer unscheduled), HealthKit/Health Connect in Expo Go, durable photos, Android FCM campaigns, in-app purchase/restore, Google Sign-In, anonymous cycle web peek, clinical validation.

**When purchasing is unavailable (this release config):**  
- FREE: 3 AI questions/day, 90/month (seeded).  
- STANDARD/ULTIMATE: only if **already** assigned (admin). Quotas stay.  
- No client can grant a paid plan.  
- Prices remain visible as plan comparison, not as a checkout.

**Owner decision still required:** (A) first public listing = **free** with those quotas, or (B) paid listing **after** StoreKit/Play Billing **and** account eligibility. Do not invent IAP.

---

## 4. Evidence matrix (this evening)

| Surface | Result |
|---|---|
| Production GET | `/health` ok; Tbilisi flags on + pilot; uploads not re-probed; no live AI spend; no admin login |
| Local API | After `parseAppVersion` import restore: `/api/app/status` returns `consumerPurchasesEnabled: false` |
| Unit tests | **40 pass / 0 fail / 0 skip** — command in §10 |
| Isolated Pets/Tbilisi Postgres | Not re-run (no schema SQL this pass) |
| Expo Go | Owner session must **not** be retargeted. Not used as HealthKit/banner proof |
| Android APK/AAB | **Not compiled.** No `gradlew`. Java 17 present. SDK folder exists; `ANDROID_HOME` unset; `adb` empty |
| iOS IPA | **Not compiled.** No local `mobile/ios`. EAS cloud **can** compile without a Mac; **not started** (paid cloud forbidden) |
| OS banners / Health Connect / HealthKit | **Not executed** |

---

## 5. Deployment split

**Server (Render, next push to `main`):**  
`clinicalMessages.js`, `aiEngine.js`, `evidencemd.js`, `ai.routes.js`, `patient.js`, `prompts.js`, `server.js`, `admin.routes.js`, `deleteUser.js`, `prisma/seed.js`, `seedAdminPolicy.js`, `settings.js`, `consumerPurchases.js`, `rateLimitKey.js`, `tbilisiMoves/finalize.js`, `tbilisiMoves/schedulerPolicy.js`.  
SQL: **none**. Jobs: **do not** add the Tbilisi cron unless you want automatic awards.

**Mobile (next binary only):** crash screens, AuthContext logout, Markdown links, package/profile purchase gate, HealthKit strings, consumerPurchases helper.  
Version bump **when cutting that binary**, not now.

**Admin:** login limiter only; no layout redesign.

---

## 6. Native health and reminders (honest)

Notification Brain remains the only scheduler. Local DATE/TIME alarms do **not** need FCM. Missing `google-services.json` blocks **Android remote/admin broadcast**, not local meds/pets banners.

Personal `HealthMetricDaily` vs Tbilisi ledger: product copies Home steps onto credit for the same date (replace, not add). Expo Go can enroll and show stored credit; native provider PUT is unsupported there.

**Not claimed from this pass:** tray banners, HealthKit samples, Health Connect permission sheet.

---

## 7. Durability and retention (prepared)

- Uploads: Render disk, **ephemeral**. Swap point `storage.js` + `objectStorage.js`. Need owner-created R2/S3: `S3_BUCKET`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`. Then implement PUT/GET against that bucket (config detection is in; credentials are the missing dependency). **Do not migrate production files in this task.**
- AiInteraction: `node server/scripts/ai-interaction-retention.js` (dry-run). `--execute` writes. Proposed 90/365 days — **not legally mandated**.
- Account delete: still cascades user-owned rows; SMS body redacted locally until server deploy.

---

## 8. Tbilisi operations

**Live:** automatic finalization = **no**. Admin can finalize by hand. Rankings on the hub are live/provisional; finalized history only after a finalize. `pilotMode=true` preserved.

Prepared, **not registered:** `server/docs/tbilisi-moves-finalize.render.yaml` (`*/15 * * * *`, `--limit 8`, `TBILISI_MOVES_FINALIZE_SCHEDULED=true`, direct Neon host for advisory lock). Copy into root `render.yaml` only when you want auto awards.

---

## 9. Store eligibility (official sources, accessed 2026-09-15)

Medicard is a health AI + medications + cycle + labs + HealthKit/Health Connect app. **Do not relabel the category to evade review.**

- Apple Guideline **5.1.1 (ix)**: apps in highly regulated fields such as **healthcare**, or that require **sensitive user information**, “should be submitted by a **legal entity** that provides the services, and **not by an individual developer**.”  
  https://developer.apple.com/app-store/review/guidelines/  
  Also: https://developer.apple.com/app-store/review/ (submitted by incorrect entity).
- Apple 1.4.1 medical accuracy scrutiny; 5.1.3 HealthKit not for ads; no iCloud for HealthKit-derived PHI.
- Play Console requirements: developers providing **Health apps (Medical / Human Subjects Research)** **must register as an Organization**.  
  https://support.google.com/googleplay/android-developer/answer/17125096  
- Health apps declaration: https://support.google.com/googleplay/android-developer/answer/14738291  
- Health apps policy: https://support.google.com/googleplay/android-developer/answer/17517561  
- Health Connect permissions: https://support.google.com/googleplay/android-developer/answer/12991134  
- Account deletion (Apple): https://developer.apple.com/support/offering-account-deletion-in-your-app  

**Unknowns (owner forms, do not invent):** legal street address, D-U-N-S, bank/tax, privacy nutrition answers, Health apps declaration checkboxes, reviewer demo account, screenshots.

---

## 10. Tests actually run

```
cd server
node --test src/lib/consumerPurchases.test.js src/lib/aiInteractionRetention.test.js src/lib/objectStorage.test.js src/lib/seedAdminPolicy.test.js src/lib/deleteUser.test.js src/lib/apiLimiterPolicy.test.js src/lib/rateLimitKey.test.js src/lib/rateLimitSeparation.test.js src/lib/pushUnregisterPolicy.test.js src/lib/tbilisiFinalizeScheduler.test.js src/lib/clinicalMessages.test.js ../mobile/src/lib/safeExternalHref.test.js ../mobile/src/lib/releaseCrashRegressions.test.js ../mobile/src/lib/consumerPurchases.test.js
```

**40 pass / 0 fail / 0 skip.** Full `npm test` not re-run. Isolated PG Pets/Tbilisi not re-run. `tsc` not a green gate. Live VET eval not spent.

---

## 11. Next concrete action

**Deploy the server JS to Render** (runbook §3A). Then cut a **development** Android/iOS binary (EAS preview/dev client, not store submit) on a **separate** session from the owner Expo Go phone, and run native smoke: login → steps read → repeat sync → one med banner → one pet-care banner → notification tap → logout cleanup → Tbilisi credit refresh.

Until that binary is installed, this is a **production API + Expo Go** product, not a public store build.
