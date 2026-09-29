# App Review — MEDICARD AI 1.17.22 — copy & paste

Approved store build: 1.16.1 (build 23). This build: `expo.version` 1.0.0.17.22 → iOS **1.17.22**, build 24.
First store build with expo-updates (OTA train 1.0.0.17): later `.R` fixes reach it without review.
Tests green, native fingerprint = train baseline. Privacy policy updated 29 Sep 2026 (crash diagnostics,
private sex/libido log).

## STEP 1 — build + upload (done by Claude, 2026-09-29)

`eas build --platform ios --profile production --auto-submit` → EAS build 1f4b042a-f8ef-494b-83e3-297293bca817.
When EAS finishes, the build is uploaded to App Store Connect automatically; Apple processing then takes ~10–30 min.

## STEP 2 — App Store Connect → MEDICARD AI → Distribution

1. iOS App → **+** → version **1.17.22** → Create.
2. **What's New in This Version**:

```
A redesigned cycle tracker: a clear phase dial, one-tap "period started", your cycle stats, daily tips and reminders that arrive on time. Password reset by SMS, faster and more reliable loading across the app, and many stability improvements.
```

3. **Build** → **+** → choose 1.17.22 (24) → Done.
4. **App Review Information → Notes**: keep the 1.16.1 notes (sign-in + MEDI COACH) and add at the end:

```
CHANGES IN 1.17.22
Cycle tracker (women's accounts, Profile sex = female): redesigned overview, local cycle reminders (only after the user has allowed notifications; can be turned off or masked in cycle settings), and an optional private log of sexual activity and sex drive. That log is visible only to the user; it is never sent to AI services, trainers, the community, analytics or notifications, and can be deleted at any time.
Crash diagnostics: when the app hits an error it sends a scrubbed technical report (error type, code location, app version, platform, hashed account id) to our own server only — no health values, no third parties, 30-day retention.
No new permissions, no purchases. Privacy policy updated 29 Sep 2026: https://medicard.ge/privacy
```

5. **Save**.

## STEP 3 — App Privacy → Edit Data Types

Keep everything already ticked (Health, Fitness, Photos or Videos, Other User Content, Customer Support,
Product Interaction, Device ID, …). Add:

| Tick | Section | Purpose | Linked to identity | Tracking |
|---|---|---|---|---|
| Crash Data | Diagnostics | App Functionality | Yes | No |

**Publish**.

## STEP 4 — submit

Distribution → 1.17.22 → **Add for Review** → **Submit to App Review**.

## After approval

Release 1.17.22. From then on JS/copy/design fixes: `npm --prefix mobile run ota -- "message"` (revision bump only).
A native change (new module/plugin/permission/SDK) = new train + new store build.
Android: still no Play production build — separate decision.
