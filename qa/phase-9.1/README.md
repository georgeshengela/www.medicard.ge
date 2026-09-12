# Phase 9.1 QA captures

Device: Pixel 8 emulator (emulator-5554), 1080×2400.

| File | Notes |
| --- | --- |
| 00-current.png | Pre-session home/welcome |
| 00b-after-load.png | Welcome light (Georgian) |
| 00e-phone.png | Phone auth light |
| 00g-otp.png | OTP with DEV test code |
| 00i-logged.png | Crash overlay during post-login (fixed: SVG Path transform) |
| 01-home-light.png | Post-login / home attempt |
| 01b-companion-attempt.png | Companion deep-link attempt |
| 03-journey-start.png | Early capture (may be splash during reload) |
| 07-collection.png | Early capture (may be splash during reload) |

Companion visual fulfillment verified primarily via catalog/renderer parity tests + DEV fixtures.
Full Pixel companion matrix (dark / 320dp / large font / reduced motion on-device) marked unresolved if screens show splash/auth only.
