# App Review — MEDICARD AI 1.26.0 (41) — MEDIBOOK — copy & paste

Build 41 = `expo.version` 1.0.0.26.0, uploaded to App Store Connect on 2026-10-17 (TestFlight only). The owner tests
it on the phone first and submits by hand. New and review-worthy in this build: **MEDIBOOK** (catalogue + map +
online booking). Also new: the velvet launch screen and the location purpose text that names the MEDIBOOK map.
Background audio (MEDISLEEP) must be explained again, as in every submission since 2026-10-13.

---------------------------------------------------------------------------------------------------
## STEP 1 — owner: check build 41 in TestFlight (what the reviewer will see)

Sign out, then sign in with the **App Review phone number and code** (the ones in App Review Information →
Sign-In Information). Only that account and team @medicard.ge accounts see the demo place.

1. Home → MEDIBOOK card → search field → type `demo` → **MEDICARD Demo Studio**.
2. Services → „Book“ next to Relaxing massage → Anyone available → Earliest free time → Take it → Continue →
   Confirm booking → „You are booked“.
3. Booking details → Cancel booking → Cancel booking. The booking moves to Past as cancelled.
4. MEDISLEEP: Home → MEDISLEEP → Sounds for sleep → Rain → Home Screen: the sound keeps playing.

Then sign back in with your own account. If any step fails, stop and fix it before submitting.

---------------------------------------------------------------------------------------------------
## STEP 2 — App Store Connect → MEDICARD AI → Distribution → iOS App → **+** → version **1.26.0**

1. **What's New in This Version** — paste:

```
MEDIBOOK — find dental clinics, salons, spas and clinics near you on a map and book a visit online at the places that have joined. Reminders before each visit, easy cancelling, reviews after. Free, no payments in the app.
A new launch screen and smaller fixes.
```

2. **Build** → **+** → build **41** (1.26.0).
3. **App Review Information**:
   - Sign-In Information: keep the App Review phone number + code as they are.
   - **Notes** — replace everything with the block in STEP 3.
   - **Attachment** — the MEDISLEEP screen recording from a physical iPhone (docs/APP-REVIEW-2026-10-13.md
     STEP 1). If the attachment did not carry over to the new version, upload it again (the 2026-10-13
     recording is fine, or record a fresh one on build 41).
4. **Save**. Do STEP 4 before Add for Review.

---------------------------------------------------------------------------------------------------
## STEP 3 — App Review Information → Notes (≈2 760 characters, limit 4 000)

```
SIGN-IN
Use the phone number and code in Sign-In Information above (phone sign-in). No SMS is sent to this number; the code is accepted for it. This account has a verified phone number, which booking in MEDIBOOK requires. The app language can be switched in Profile → Language.

NEW IN THIS VERSION — MEDIBOOK (free)
A catalogue and map of dental clinics, salons, spas, clinics and studios in Georgia, with online booking at the places that have joined. There are no payments or purchases in the app: prices are shown and paid on site. Places that have not joined show only their public details (address, phone, opening hours). Businesses manage their bookings in a free web panel (medicard.ge/business), not in the app. A booking shares only the person's name, phone number, the chosen service and time and an optional note with that business; health data is never shared. Location is optional: it is requested only when the person taps "Use my location", to show nearby places.

To try booking, use our demo place "MEDICARD Demo Studio". It is not a real business, it is shown only to the review account, and nobody attends its bookings:
1. Home → tap the MEDIBOOK card ("Book a visit"). It is also behind the grid button at the top right → MEDIBOOK.
2. Tap the search field, type "demo" and open "MEDICARD Demo Studio".
3. Under Services, tap "Book" next to "Relaxing massage".
4. "With whom?": tap "Anyone available" (or a name).
5. "When?": tap "Take it" on "Earliest free time" (or pick a day and a time), then "Continue". Times are shown in Tbilisi time (UTC+4); the place is open 09:00–21:00 every day and always has free times in the coming days.
6. "Everything right?": tap "Confirm booking" → "You are booked".
7. To cancel: tap "Booking details" (or MEDIBOOK → "My bookings" → the booking) → "Cancel booking" → confirm with "Cancel booking".
Reminders for a booking are local notifications and follow the "Visits and bookings" switch in Profile → Notifications.

BACKGROUND AUDIO (UIBackgroundModes: audio)
Used only by MEDISLEEP sleep sounds, which keep playing with the screen locked until the sleep timer fades them out or the person stops them. To try: Home → MEDISLEEP → "Sounds for sleep" → tap "Rain", wait until it is audible (the first play downloads the sound), then go to the Home Screen or lock the device — the sound continues and the lock screen / Control Center shows the MEDISLEEP player. A screen recording from a physical iPhone is attached.

ALSO IN THE APP
MEDIHOROSCOPE (Home → grid button → Horoscope) is entertainment and reflection only; it never gives medical, financial or psychological advice. Its assistant and Medi ask for AI data-sharing consent before anything is sent.

Privacy policy: https://medicard.ge/privacy
```

---------------------------------------------------------------------------------------------------
## STEP 4 — App Privacy (once, before the first submission with the Meta SDK)

The Meta (Facebook) SDK rides this build for install measurement only (docs/agents/release-and-review.md „Meta
install measurement“): no ATT prompt, no IDFA, no custom events. In App Store Connect → App Privacy → Data Types,
confirm that **Usage Data → Product Interaction** lists the purpose **Third-Party Advertising** (next to Analytics),
**not linked** to the user's identity, **not used for tracking**. Add **Identifiers → Device ID** the same way only
if Meta's SDK data list for your setup includes it. Publish.

MEDIBOOK needs nothing new there: name and phone number (Contact Info) and other user content (the booking note)
are already declared for App Functionality; check once that they are.

---------------------------------------------------------------------------------------------------
## STEP 5 — submit

Distribution → 1.26.0 → **Add for Review** → **Submit to App Review**.

---------------------------------------------------------------------------------------------------
## Reference (already done — nothing to do)

- Admin switch `book` (MEDIBOOK) is ON (no FeatureFlag row = enabled; checked 2026-10-17). While it is off the app
  shows MEDIBOOK as paused and the server refuses bookings.
- Demo place `bk-app-review-demo` („MEDICARD Demo Studio“, SPA, CLAIMED, two people Ana / Giorgi, three services
  without a price, open 09:00–21:00 every day, auto-confirm, SMS and business mail off). Its free times come from its
  hours, so they never go stale. `server/src/lib/book/reviewDemo.js` (hourly, job lease `book-review-demo`) creates
  it when missing and puts back only what keeps it bookable. Catalogue reads list it — and `POST /api/book/appointments`
  accepts it — only for the App Review phone account and team @medicard.ge accounts; everyone else gets 404 / never
  sees it. Admin #/book → hide (HIDDEN) pauses the pass; `APP_REVIEW_BOOK_DEMO=off` on Render stops it.
- The App Review phone and code live only in Render's environment (`APP_REVIEW_PHONE` / `APP_REVIEW_OTP`) and in
  App Store Connect — never in this repository.
- MEDICOACH (`coach`) stays OFF by the owner's choice, so these notes no longer mention it.
