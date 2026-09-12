# Phase 3 visual QA log

Viewport primary: **Pixel_8 emulator `emulator-5554`**, physical **1080×2400 @ 420 dpi** (standard phone).

Also captured:

- compact override `wm size 1080x1920` (shots `34`–`36`);
- large override `wm size 1440x3120` (shot `37`).

Device restored with `wm size reset`. Existing Metro on **8081** + Expo Go (`host.exp.exponent`). Session: Cycle QA profile (production API via `EXPO_PUBLIC_API_URL`). Did not sign out. Did not write assessment answers (would persist to production).

Screenshots: `qa/georgian-l10n-phase3/shots/`.

| ID | Screen / state | Nav | Keys | Result |
| --- | --- | --- | --- | --- |
| 01 | Home standard + hydration 0 ml | `/home` | home sections, hydration hub | **Pass.** `დაასრულეთ შეფასება` formal. Hydration 0/2000 ml = level 1. |
| 02 | Login | `/sign-in?preview=1` | `auth.signInHero`, placeholders | **Pass.** Formal. Hero wraps; no clip. |
| 03 | Registration | `/sign-up?preview=1` | `auth.signUpTitle`, terms | **Pass.** Terms wrap. Formal `თქვენ`. |
| 04 | Phone OTP start | `/phone?preview=1` | `auth.phoneHero` | **Pass.** |
| 05 | Password recovery choose | `/forgot-password?preview=1` | `auth.forgotPasswordChoose` | **Pass.** `აირჩიეთ`. |
| 06 | Password recovery email | `/forgot-password/email?preview=1` | `auth.forgotPasswordEmailHint` | **Pass.** |
| 07–10 | Assessment name / smoking / meds / PCOS | `/assessment?step=…&preview=1` | `nameTitle`, smoking, meds, PCOS | **Not visually verified.** Preview route stayed on a spinner. Live home CTA not used (would draft-save to production). |
| 11 | Cycle dashboard | `/cycle` | predicted period copy | **Pass.** Hedge copy wraps. Direct. |
| 12 then 33 | Cycle logging | `/cycle/log` | flow picker | **Pass** after load. `აირჩიეთ ერთი ვარიანტი` is formal inside Cycle (pre-existing; not changed). |
| 13 | Cycle journal / history | `/cycle/journal` | empty journal | **Pass.** `ჯერ არც ერთი ჩანაწერი არ არის.` |
| 14 | Pregnancy home | `/cycle/pregnancy` | pregnancy dashboard | **Not visually verified.** Route stayed on TRACK cycle dashboard (no pregnancy episode). |
| 15 | Care planner | `/cycle/pregnancy/care-plan` | `cycle.carePlan.title` | **Pass** for title + honesty copy. **First-visit item not shown** (no episode). |
| 16 | Timeline | `/cycle/pregnancy/timeline` | timeline | **Not visually verified.** Same TRACK redirect. |
| 17 | Medications hub empty | `/medications` | `meds.onboardingEmpty*` | **Pass.** Formal `დაამატეთ`. Title `მედიკამენტების კალენდარი` fits. Infinitive empty title valid. |
| 18 | Add medication search | `/medications/add/search` | `meds.addTitle` | **Pass** visually (`ახალი მედიკამენტი`). Wait regex was too strict. Keyboard overlay is Gboard, not copy. |
| 19 | Hydration levels (current = 1) | `/health-metrics/hydration/level` | `hydration.levels.1` | **Pass.** Title wraps 2 lines. Body is goal-progress, not diagnosis. |
| 20 | Medi empty chat | `/chat/ask` | empty + input | **Pass** empty/input. **Disclaimer not on empty state** (renders only after a message). Did not send a chat (production quota). |
| 21 | Quest dashboard | `/medi-quest` | missions | **Pass** visually (wait regex false negative). Direct `დალიე შენი…`. |
| 22 | Profile | `/profile` | profile | **Pass.** |
| 23 | Privacy | `/profile/privacy` | legal | **Pass.** Scrollable. `კონფიდენციალურობა`. |
| 24 | AI model | `/profile/ai` | model picker | **Pass.** Formal `აირჩიეთ`. |
| 25 | Notification settings | `/profile/notifications` | reminder groups | **Pass.** Direct Medi copy. |
| 28 | Login validation | submit empty | `auth.invalidEmail`, `common.required` | **Pass.** Errors wrap; no overlap. Neutral/formal. |
| 29 | Login network/retry | airplane / wifi off | `auth.networkError` | **Not visually verified.** Client validation still showing; then Expo LogBox from `/health` fetch fail. Banner not isolated. Code path mapped in `authErrorMessage`. |
| 30 | Hydration level 2 body | expand row 2 | `hydration.levels.2` | **Pass.** `დღიური მიზნის მისაღწევად მეტი წყალი დალიეთ.` |
| 31 / 39 | Cycle settings | `/cycle/settings` | modes | **Pass** for mode list. **PATCH / `კონტრაცეპტიული პლასტირი` not reached** (below fold; LogBox interrupted scroll). |
| 34 | Hydration compact 1080×1920 | same route | level 1 title | **Pass** wrap. Accordion lower rows need scroll (not a rigid one-line clip). |
| 35 | Login compact | sign-in | hero | **Pass** wrap. `შესვლა` briefly hidden by Expo LogBox, not by Georgian copy. |
| 36 | Cycle compact | `/cycle` | predicted body | **Pass** wrap. CTA covered by LogBox only. |
| 37 | Home large 1440×3120 | `/home` | home | Captured after size override (LogBox/splash timing). Not used as a third-device claim. |

## Visual failures found

1. Expo LogBox after wifi disable covered primary CTAs (`შესვლა`, `შენახვა`). Caused by the network-error attempt, not by copy. Wifi restored. `wm size` reset.
2. Assessment preview spinner — journey inaccessible without production writes.
3. Pregnancy first-visit title and contraceptive patch picker — not on screen for this TRACK QA profile.

## Copy/layout fixes this pass

- Formal `ka.auth.retry` / `ka.auth.networkError`; auth surfaces mapped via `authErrorMessage`. Shared `ka.common.retry` remains direct.
- Hydration 1–2 goal-progress wording; `lineHeight: 40` on the 32px level title so wrapped Georgian does not collide.
- Medications: no within-journey instruction-voice mix found; infinitive titles kept.
