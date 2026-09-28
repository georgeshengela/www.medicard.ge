# App Review — MEDICARD AI 1.16.x (MEDI COACH) — copy & paste

Approved store build: 1.13.25. This build: `expo.version` 1.0.0.16.1 → iOS 1.16.1.
Code readiness: 7e455fc (+ later small fixes). Demo trainer ready in production (2026-09-28).

---------------------------------------------------------------------------------------------------
## STEP 1 — build and upload (terminal)

```
cd C:\Users\User\Desktop\www.medicard\mobile
eas build --platform ios --profile production --auto-submit
```
Wait until EAS says the build was submitted to App Store Connect (~20–40 min), then the build
appears in App Store Connect → TestFlight after Apple's processing (~10–30 min).

---------------------------------------------------------------------------------------------------
## STEP 2 — App Store Connect → Apps → MEDICARD AI → Distribution

1. Left column: iOS App → **+** (next to "iOS App") → version **1.16.1** → Create.
2. Open 1.16.1 → **What's New in This Version** — paste:

```
MEDI COACH — connect with a verified fitness trainer, share only what you choose, book sessions and follow your trainer's meal plan. Plus stability and privacy improvements.
```

3. Scroll to **Build** → **+** → choose the new 1.16.1 build → Done.
4. Scroll to **App Review Information**:
   - Sign-In required: ✅ (already filled with the App Review phone + code — keep it)
   - **Notes** — replace the text with the block below; put demo.woman's real password where it says PASSWORD.

```
Sign-in: use the phone number and code in the Sign-In Information above. That account is the CLIENT.

NEW IN THIS VERSION — MEDI COACH (optional, free)
People can connect with an independent fitness trainer whose profile and certificates are verified by our team before the trainer appears in the app. There are no payments, prices or purchases in the app; any training arrangement happens in person, outside the app.

TEST THE CLIENT SIDE (with the review phone account):
Profile → "ფიტნესი · MEDI COACH" → "ტრენერთან დაკავშირება" → enter code QSPW7W → consent screen.
Only name, photo, age, sex, height and the shared session schedule are always visible to the trainer. Activity/workouts (including Apple Health), nutrition, weight and progress photos are OFF by default and shared only if the user switches them on. The user can change them or end the connection at any time: MEDI COACH → "გაზიარება ტრენერთან". Health data is never used for advertising.
Apple Health workouts are read only after the user turns on "ვარჯიშების წაკითხვა" in that screen; the Health permission sheet is requested from that button only.

TEST THE TRAINER SIDE (optional):
Email login: demo.woman@medicard.ge / PASSWORD
Profile → "ფიტნესი · MEDI COACH" → trainer workspace: clients, sessions, calendar, personal QR. The client connected above appears in the client list.

SAFETY: both sides can report the other ("შეტყობინება დარღვევაზე"); a client can block a trainer — the connection ends immediately and the trainer cannot invite again. Reports are reviewed by our team. Trainer applications stay "under review" until our team approves them.

Privacy policy (updated 28 Sep 2026, section 14 MEDI COACH): https://medicard.ge/privacy
```

5. **Save** (top right). Do NOT press "Add for Review" yet — do Step 3 first.

---------------------------------------------------------------------------------------------------
## STEP 3 — App Store Connect → App Privacy (left column, under TRUST & SAFETY)

Click **Edit** next to "Data Types". Make sure these are ticked (keep everything already ticked):

| Tick this | Where in the list |
|---|---|
| Health | Health & Fitness |
| Fitness | Health & Fitness |
| Photos or Videos | User Content |
| Other User Content | User Content |
| Customer Support | User Content |
| Product Interaction | Usage Data |
| Device ID | Identifiers |

Save, then for EACH newly ticked type answer:

- **Purpose:** App Functionality (for Product Interaction and Device ID choose **Analytics**)
- **Linked to the user's identity?** → **Yes**
- **Used for tracking?** → **No**

Then **Publish** (top right of the App Privacy page).

---------------------------------------------------------------------------------------------------
## STEP 4 — submit

Distribution → 1.16.1 → **Add for Review** → **Submit to App Review**.

---------------------------------------------------------------------------------------------------
## Reference (already done — nothing to do)

- demo.woman@medicard.ge = VERIFIED trainer „ნინო მაისურაძე · დემო", code QSPW7W, gym Aspria Vake,
  3 open sessions. Created 2026-09-28 by the owner's request, audited.
- App Review phone/OTP stay on Render (APP_REVIEW_PHONE / APP_REVIEW_OTP).
- Optional: demo.woman is also a client of another trainer; ending that link in its „ჩემი ტრენერი"
  keeps the review simpler.
- Passwords live only in App Store Connect — never in this repository.
