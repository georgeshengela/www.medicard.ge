# App Review — MEDICARD AI 1.23.1 (37) — Guideline 2.5.4, background audio

Rejected 2026-10-13 (iPad Air 11-inch M3): „the app declares `audio` in UIBackgroundModes, but we are unable to play
any audible content when the app is running in the background“.

## Why we keep `audio`

The mode is there for one feature: MEDISLEEP sleep sounds (train 1.0.0.23, `src/lib/sleep/sleepAudio.ts`). The person
starts a sound, it keeps playing with the screen locked until the sleep timer fades it out (default 45 min) or they
stop it. Without the mode iOS cuts the sound as soon as the phone locks — the feature would be pointless. Nothing
else plays in the background: Medi's voice and the MEDIRUN / MEDIPULSI heartbeat set `shouldPlayInBackground:false`.

Checked 2026-10-13 before replying: no code path stops the sounds on background (expo-audio 57.0.5 pauses players on
background only when `shouldPlayInBackground` is false; `setAppAudioMode` keeps it true while MEDISLEEP owns the
session), the `sleep` switch is on, all 20 sounds are LIVE and `/api/sleep/files/:id` serves them (200, ~2 MB, 0.4 s).
`SleepPlay` had **0 rows**: the reviewer never listened for a full minute, and no real phone had played a sound yet.
So the fix is proof + directions, not a new binary: App Review asks for a screen recording on a physical device.

## STEP 1 — owner: screen recording on the iPhone (build 37 from TestFlight)

1. Control Center → Screen Recording (add it in Settings → Control Center if missing). Volume up.
2. Open MEDICARD AI → Home → MEDISLEEP → „ხმები ძილისთვის“ → tap „წვიმა“ (Rain). Wait until it is audible.
3. Swipe up to the Home Screen; keep the sound audible for ~10 s, open Control Center to show the MEDISLEEP player.
4. Stop the recording (locking the screen ends a screen recording, so the Home Screen + Control Center is the proof).

If the sound stops on the Home Screen, that is a real bug: stop and fix it before replying.

## STEP 2 — reply in App Store Connect (App Review message) + attach the video

```
Hello,

Thank you for the review. MEDICARD AI uses the audio background mode for one feature that needs persistent audio: MEDISLEEP sleep sounds. The person chooses a sleep sound (rain, ocean waves, noise or a melody) and it keeps playing with the screen locked or the app in the background until the sleep timer fades it out (45 minutes by default) or they stop it from the in-app player, the lock screen or Control Center. Audio plays only after the person starts it; the app never plays silent audio to stay active in the background.

We have attached a screen recording from a physical iPhone showing the sound continuing on the Home Screen.

Steps to try it:
1. Sign in with the demo account from App Review Information.
2. On Home, scroll to the MEDISLEEP section and tap the card.
3. Under "Sounds for sleep", tap "Rain" (or tap "All" for the full library). On the first play the sound downloads once — wait 1–3 seconds until it is audible.
4. Swipe up to the Home Screen or lock the device: the sound keeps playing, and the lock screen / Control Center shows the MEDISLEEP player with play/pause.
5. Return to the app and tap the sound again (or pause in the player bar) to stop it.

Please keep the device volume up. The app language can be switched to English in Profile → Language.

The same steps and the recording are now in the App Review Information notes.

Best regards,
George Shengelia
```

## STEP 3 — App Review Information (for this and every later submission)

Notes — add at the end:

```
BACKGROUND AUDIO (UIBackgroundModes: audio)
Used only by MEDISLEEP sleep sounds, which keep playing with the screen locked until the sleep timer fades them out or the person stops them. To try: Home → MEDISLEEP → "Sounds for sleep" → tap "Rain", wait until it is audible (first play downloads the sound), then go to the Home Screen or lock the device — the sound continues and the lock screen / Control Center shows the MEDISLEEP player. A screen recording from a physical iPhone is attached.
```

Attachment — upload the same screen recording.

## 1.24.0 (38) — submitted instead of 1.23.1 (owner 2026-10-13: „გაუშვი ბილდი და ავტოსაბმითი“)

Build 38 = everything in 1.23.1 (MEDISLEEP, MEDIFAMILY) + MEDIHOROSCOPE. In App Store Connect: remove 1.23.1 from review
if it is still waiting, create version **1.24.0** (or change the version number of the rejected 1.23.1 record), select
build 38, keep the MEDISLEEP steps above **and attach the same screen recording**, add the paragraph below to the
App Review Notes, then Submit for Review.

```
New in this version — MEDIHOROSCOPE (entertainment): daily, weekly, monthly and yearly horoscopes computed from real astronomical planet positions, a birth chart, tarot of the day, compatibility, numerology, the Chinese zodiac and a dream dictionary. It is clearly labelled as entertainment and reflection, never gives medical, financial or psychological advice, and sits apart from the health features. Its chat assistant ("Oracle") asks for the same AI data-sharing consent as Medi before anything is sent, and it refers health questions to Medi. To open it: Home → the grid button (top right) → "Horoscope" / „ჰოროსკოპი“.
```
