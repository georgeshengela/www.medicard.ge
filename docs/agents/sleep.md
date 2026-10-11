# MEDISLEEP (sleep module)

Owner request 2026-10-12: a complete sleep module — sleep mode with a lock-screen Live Activity, sounds and melodies,
a wake-up alarm, recommendations from the registration answers, analytics, widgets, and admin management. Built on
branch `feat/medisleep`; the app part needs **store train 1.0.0.23** (background audio, the `MedicardSleep` widget,
the AlarmKit module). Research brief (leaders, complaints, science, AlarmKit, licensing) was the basis — the key
choices below come from it.

## Product rules

- Name: **MEDISLEEP** (one word). Signature colour night plum → orchid: ink `#8A35C2` / `#D9A8FF`, hero gradient
  `#1B1145 → #4B2A9E → #9A4FD6`, moonlight accent `#F4E3B5` for the primary action and the moon. The whole module is a
  night space (`NightProvider` + `ModuleToneProvider tone="sleep"`, its own plum night palette in `colors.ts`).
- Free, no paywall, no microphone recording, no phone-guessed sleep stages. Stages appear only when Apple Health /
  Health Connect has them (Watch, Oura…).
- Score = duration vs her goal 50 % + rhythm (midpoint regularity) 30 % + her morning rating 20 %; missing parts
  re-weight. It can be hidden (`plan.hideScore`) — score anxiety is a known complaint.
- Sound timer by default (45 min, fade 60 s): evidence for all-night noise is weak (pink noise cut REM in a 2026
  lab study). „მთელი ღამე“ stays an option.
- Advice is education, not treatment; poor sleep for weeks → a doctor (CBT-I). Insights say „not a diagnosis“.
- Health data never in pushes, URLs, funnel or admin lists: reminders carry only the planned time; the admin page
  shows counts per person and the sleep picture only as aggregates of ≥ 5 real people (`SLEEP_K_MIN`).

## Server (`/api/sleep`, feature key `sleep`)

- Tables (`prisma/20261012-sleep.sql`, `install-sleep.mjs` in `db:install`, models in schema.prisma):
  `SleepPlan` (one per person), `SleepNight` (one per night, keyed by the **morning it ends**, 18:00 → 18:00 like
  `sleepNights.ts`), `SleepPlay` (listening sessions), `SleepSound` + `SleepFile` (catalogue; bytes in R2 when object
  storage is configured — `storageKey` — else in Postgres), `SleepTip` (advice, seeded once by id, never re-seeded
  over an admin edit), `SleepConfig` (timer, fade, layers, factors).
- Night merge (`lib/sleep.js` `mergeNight`): times — manual > health > sleep mode (a hand edit clears Health's
  stages); the check-in (quality, wake-ups, latency, factors) is hers and Health never touches it; sounds collect.
- Analytics are pure (`lib/sleepInsights.js` `sleepSummary`, `pickTips`): debt over the last 7 logged nights,
  regularity = SD of the sleep midpoint, social jetlag, factor effects need ≥ 3 nights on each side, steps effect
  needs 8 nights, best bedtime from nights rated ≥ 4. Shared by the app, Medi and the admin page.
- Files: `GET /api/sleep/files/:id` is public by random id (immutable, ETag, Range), registered before auth.
  `capacity.js` leaves `audio/*` out of the API latency p95.
- Medi: domain `sleep` (`assistantContext.js`, `lib/sleepAiContext.js`), chosen by sleep words in
  `assistantFlow.js`; Medi's clinical answer gets a `MEDISLEEP` block (`buildSleepBlock`). No Medi destinations yet
  (older app builds have no `/sleep`).
- Starter library: `brand/sleep/` — `sounds/synth.py` (procedural, seamless loops + fade tails, no licence),
  `studio.py` (Lyria 3 Pro melodies + Nano Banana Pro cover art through OpenRouter), `library.json` (ids, words,
  prompts). Upload once after deploy: `node server/scripts/sleep-library-sync.mjs --apply` (adds only what is missing).
- Tests: `server/src/lib/sleep.test.js`, `adminUsageSleep.test.js` (both imported from `adminFeed.test.js` — the
  Windows `npm test` command line is at its length limit).

## App (`mobile/app/sleep/*`, `src/lib/sleep/*`, `src/components/sleep/*`)

- Gate: `sleepNativeReady()` (store train ≥ 23, dev/web on) — `featureFlags.ts` forces `sleep` off with an
  „update the app“ message on older binaries, so an OTA of this JS never offers the module there (2.5.2).
- Hub `/sleep`: tonight's 24-hour dial (moon = bedtime, sun = wake-up, both drag; the hub's one bold element), last
  night (stages when Health has them), check-in prompt in the morning, sound shelf, the week's rhythm chart + score,
  advice from the server, Ask Medi chips, tools. Morning leads with last night; evening with tonight.
- Sleep mode `/sleep/night`: alarm + sounds + timer → „ღამე მშვიდობისა“; running: clock, alarm, sound, dims after
  20 s, „დილა მშვიდობისა“ saves the night (`kind: 'mode'`, < 20 min = nothing saved) and opens the check-in.
  Survives the app being killed (`sleepSession.ts`, scoped pref); offline saves queue and flush on foreground.
- Audio (`sleepAudio.ts`): up to `maxLayers` looping players (expo-audio loops gaplessly with AVQueuePlayer),
  lock-screen controls on the first layer (`doNotMix`), timer + equal-power fade driven by the player's own status
  events (Android pauses JS timers in the background) and a foreground interval; files downloaded once
  (`sleepSoundCache.ts`). Other audio callers use `setAppAudioMode` (`lib/audioSession.ts`) so Medi's voice or the
  MEDIRUN heartbeat never switch background playback off under sleep sounds. OTA reload waits while sound or sleep
  mode runs.
- Alarm (`sleepAlarm.ts`): AlarmKit through the local module `modules/sleep-alarm` (`MedicardSleepAlarm`, iOS 26+,
  weak-linked, permission only from the one-button primer „მაღვიძარა“); elsewhere a time-sensitive notification with
  `assets/sleep/medisleep_dawn.wav` (`brand/sleep/sounds/alarm.py`), Android channel `sleep-alarm-v1`.
- Live Activity `SleepActivity` (`sleepActivityLayout.tsx`): elapsed clock, alarm, sound + fade time, a sound
  play/pause button (`target="sound"`) and „ვიღვიძებ“ (`medicard://sleep/night?wake=1` ends the night).
- Widget `MedicardSleep` (app.json; small + lock-screen circular/rectangular/inline): timeline by the clock —
  rest (last night, gauge) → evening (live countdown to bedtime) → bedtime → wake („როგორ გეძინა?“); sleep mode
  shows the alarm. Pure builder `sleepWidgetSnapshot.ts`.
- Reminders: family `sleep` (Profile → შეტყობინებები, on by default, reconcile step): wind-down before the planned
  bedtime (repeating), the morning check-in for the next two mornings only, skipped for a rated night. Medi's own
  21:10 sleep nudge is skipped while these are scheduled and opens MEDISLEEP when the module is on.
- Health: `importSleepFromHealth` (≤ every 30 min on hub focus, 21 days, only when Health is already connected)
  → `POST /api/sleep/nights/import`; `sleepNightDetails` keeps the main sleep per night (a nap never stretches it).
- Home: one compact card `HomeSleep` in every layout (no second spotlight); ModulesSheet tile; Explore entry.
- Tests: `npm --prefix mobile run test:sleep` (clock maths, wind-down slots, widget timeline, Health nights, the
  Live Activity and widget layouts rendered in the expo-widgets runtime, app.json declarations).
- Web QA: `.claude/launch.json` `sleep-mock` (:4520, fixture `scratchpad/webqa/fixtures/sleep.mjs` uses the real
  server libs) + `sleep-web` (:8096). Sign-in is not mocked — set `localStorage['medicard.auth.token']` and open `/sleep`.

## Admin `#/sleep`

Tabs „გამოყენება“ (usage: people, ladder, sounds ranking, bedtime hours and the sleep picture only with ≥ 5 people),
„ხმები“ (library: edit, publish/hide, reorder, upload audio/tail/art as multipart), „რჩევები“ (advice by trigger),
„პარამეტრები“ (timer options, fade, layers, volume, breathing, check-in factors). Capabilities `SLEEP_VIEW` /
`SLEEP_MANAGE`; every write audited (`targetType: 'sleep'`). Live feed: a saved night (not Health-only imports) and
a played sound.

## Release

Server + admin can ship before the app (the app is hidden on trains < 23). App: train 1.0.0.23 store build —
`npm --prefix mobile run ota:baseline`, then `npm --prefix mobile run build:ios` (the widget extension gains the
`MedicardSleep` widget; AlarmKit needs Xcode 26). Review notes: background audio is used only for sounds the person
starts, with a timer; AlarmKit for the wake-up she sets.
