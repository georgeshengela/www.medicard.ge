# App Review — build 1.16.0 (1.0.0.16.0), MEDI COACH

Store build 1.13.25 was approved on 2026-09-28. This build adds MEDI COACH (optional fitness
trainers) and product analytics. Code-side readiness: commit 7e455fc.

## 1. Before submitting (owner)

1. **Demo accounts (set up 2026-09-28).**
   - Trainer: `demo.woman@medicard.ge` — VERIFIED trainer „ნინო მაისურაძე · დემო“, coach code **QSPW7W**,
     gym Aspria Vake, 3 open sessions. (This account is also still a *client* of another trainer —
     end that link in its „ჩემი ტრენერი“ if it confuses the review.)
   - Client: create one more account in the app (e.g. `demo.client@medicard.ge`), finish onboarding,
     log a weight and one meal, then Profile → „ფიტნესი · MEDI COACH“ → „ტრენერთან დაკავშირება“ →
     code **QSPW7W** → switch on workouts/nutrition/weight → „თანხმობა და დაკავშირება“ → book one open session.
   - Passwords go only into App Store Connect, never into this repo.
   Original note: **Demo trainer for the reviewer.** Recommended: a dedicated account (e.g. an email account
   „review.trainer@…“ created in the app) → Profile → „ფიტნესი · MEDI COACH“ → become a trainer →
   finish the 3 steps → admin ტრენერები → approve. Add one open session. Put its email/password and
   its 6-character coach code into the review notes below.
   Minimum alternative: use the existing verified trainer „ჟორა კეისარი“, coach code **F6RNBA**
   (client-side testing only — the reviewer connects to it).
2. **App Store Connect → App Privacy** — add/confirm (all: linked to the user, not used for tracking):
   - Health & Fitness — App Functionality (also shared with the user's chosen trainer, at the user's direction)
   - Photos or Videos — App Functionality (profile photo, progress photos, trainer certificates)
   - Other User Content — App Functionality (trainer bio, session notes, meal plans, notes to the trainer, reports)
   - Usage Data → Product Interaction — Analytics (first-party funnel events)
   - Identifiers → Device ID — Analytics (hash of an app-generated install id; not IDFA)
   - Customer Support — App Functionality (support mail, answered with an AI assistant)
   - Email Address — add "Developer's Advertising or Marketing" only if the marketing opt-in is live
3. Keep `APP_REVIEW_PHONE` / `APP_REVIEW_OTP` on Render.

## 2. Build and submit (owner, EAS)

```
cd mobile
eas build --platform ios --profile production --auto-submit
```
(`appVersionSource: remote` + `autoIncrement` set the build number; iOS marketing version 1.16.0
comes from `expo.version` 1.0.0.16.0.) Android: `eas build --platform android --profile production`.

## 3. Review notes (paste into App Store Connect → App Review Information → Notes)

```
Sign-in: use the phone number and code already provided for App Review.

NEW IN THIS VERSION — MEDI COACH (optional, free)
People can connect with an independent fitness trainer whose profile and certificates are
verified by our team before the trainer appears in the app. There are no payments, prices or
purchases in the app; any training arrangement happens in person, outside the app.

To test the client side:
Profile → "ფიტნესი · MEDI COACH" → "ტრენერთან დაკავშირება" → enter code QSPW7W.
The consent screen lists exactly what the trainer can see. Only name, photo, age, sex, height
and the shared session schedule are always visible; activity/workouts (including Apple Health),
nutrition, weight and progress photos are OFF by default and shared only if the user switches
them on. The user can change them or end the connection at any time
(MEDI COACH → "გაზიარება ტრენერთან"). Health data is never used for advertising.

Apple Health workouts are read only after the user turns on "ვარჯიშების წაკითხვა" in that screen;
the Health permission sheet is requested from that button only.

Safety: both sides can report the other ("შეტყობინება დარღვევაზე") and a client can block a
trainer; the connection ends immediately and the trainer cannot invite again. Reports are
reviewed by our team. Trainer applications stay "under review" until our team approves them.

Demo accounts:
- Trainer: demo.woman@medicard.ge / [password] — verified trainer, coach code QSPW7W.
  Trainer mode: Profile → "ფიტნესი · MEDI COACH" → trainer workspace (clients, sessions, QR).
- Client: demo.client@medicard.ge / [password] — already connected to the trainer above and
  sharing workouts, nutrition and weight; can change or end sharing in "გაზიარება ტრენერთან".

Privacy policy (updated 28 Sep 2026, section 14): https://medicard.ge/privacy
```
