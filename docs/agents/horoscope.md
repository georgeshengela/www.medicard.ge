# MEDIHOROSCOPE (owner 2026-10-13)

Owner: „a full astrology module — horoscope, planets, the year, a chart — updated every day, beautiful and magical,
with its own AI (Medi in a witch hat, a mysterious fortune-teller), falling stars on the main page, admin control".
Read this file before working on the module.

## Decisions (owner)

- **Our own content only.** horoskopi.ge was looked at for ideas (its sections: daily/love/money/sexual/pets
  horoscopes, Chinese, dreams, fortune telling, superstitions, weekly by a named astrologer) — it is „all rights
  reserved“; the owner said „don't take from horoskopi, we do it ourselves". Never scrape or reuse its texts.
- **Georgian written natively, never translated.** Three passes per text: Georgian author → Georgian editor
  (grammar, cases, verb forms, calques) → English author writing its own version from the same sky. Prompts are
  in Georgian (`writer.js` `WRITER_KA`, `EDITOR_KA`). Owner picked the author in a blind 5-model test:
  **D = Claude Sonnet 5.5** (default for writer/editor/English; ~$0.03 per reading, ~$15/month for all periods).
  Admin can switch models (`HOROSCOPE_MODELS` in `llm.js`).
- **The Oracle** = the module's own assistant (not Medi): Medi's flat mascot in a witch hat (generated in Medi's
  own style with the mascot's image model — `brand/horoscope/oracle-studio.mjs`, cut out with `cutout.cjs`; the
  hat rides inside the mascot's head group: `MediMascot hat="witch"` + crop `hat`). Mysterious but clear;
  never health/medicine (sends people to Medi), no fate/fear, no money advice; drops the role for self-harm (112).
- **Magical night module**: always a night space (`NightProvider` + tone `horo`, lapis + brass). One bold element
  per page = the brass astrolabe (`SkyWheel`). Background `StarrySky`: still stars (same every visit), a few that
  twinkle, a shooting star every few seconds; reduced motion = still sky; paused off-screen/background.

## Real sky

`server/src/lib/horoscope/astro.js` (pure): astronomy-engine (tropical, true ecliptic of date), Placidus houses
(whole sign above 66°), aspects, Moon phase / lunar day, sky events (lunations, eclipses, ingresses, stations),
transits to a natal chart, Chinese New Year (month-11/leap-month rule — 40 published dates match), numerology.
Tests in `horoscope.test.js` (Placidus self-check, ascendant on the horizon, tz history, CNY, retro stations).

## Content pipeline

- Readings: `HoroscopeReading` (kind day/week/month/year × period × 12 signs). `jobs.js` (JobLease
  `horoscope-scheduler`, every 10 min, production only) writes everything missing for today, **tomorrow** (so 00:00
  Tbilisi already has the new day), this week/month/year and the next week/month/year near their start.
- Library: `HoroscopeLibrary` (key × lang) — sign profiles, compat (78 pairs, score is deterministic in
  `catalog.js`), tarot (22 major arcana; XIII „გარდაქმნა“, XV „ცდუნება“, XX „გამოღვიძება“ — no Death/Devil in a
  health app), numbers, moon phases, retrogrades, planets/houses/elements, Chinese + year forecast, ascendants,
  planet-in-sign/house, transits (600), natal aspects, 116 dream symbols. Filled in batches by the scheduler;
  admin edits are never overwritten (`source='admin'`).
- Content rules: `contentRules.js` (Georgian stems, English whole words) — a text that breaks one is rejected
  and written again.

## API

App `/api/horoscope` (`requireFeature('horoscope')`, Oracle routes also `horoscopeOracle`): `/` hub, `/home`,
`/sign/:sign`, `/chart`, `PUT /profile` (birth time/place, Home card), `/places` (Open-Meteo geocoding, name only),
`/sky?month=`, `/compat`, `/numerology`, `/chinese`, `/tarot`, `/dreams[?q]`, `/dreams/:id`, `/oracle`,
`POST /oracle/query` (`requireAiConsent` + `enforceAiQuota` + `runTrackedAi` mode `HOROSCOPE`, SSE, Claude Sonnet 5.5
on Google Vertex — the approved zero-retention route added to aiDisclosure.json routing; daily limit from admin), `DELETE /oracle/:id`. AI disclosure has a MEDIHOROSCOPE line
(2026-10-13 — everyone is asked to re-confirm once). Privacy §18.

Admin `#/horoscope` (`v4/modules/horoscope.js`, `/api/admin/horoscope`, HOROSCOPE_VIEW / HOROSCOPE_MANAGE):
ჰოროსკოპები (sky now, readiness grid, read/edit/hide/write again), ბიბლიოთეკა (progress, fill, edit),
გამოყენება (counts, signs, sections — never chat text or birth details), ჟურნალი (runs, cost), პარამეტრები.

## App and web

- Routes `mobile/app/horoscope/*` (hub, oracle, chart, birth, sign/[sign], compat, tarot, numerology, chinese,
  dreams, sky); kit in `src/components/horoscope/` (HoroUI, SkyWheel, StarrySky, TarotCard, ReadingView,
  OracleMascot, AstroGlyph — Noto Sans Symbols outlines, OFL); serif `NotoSerifGeorgian_500Medium` loaded by the
  module layout only (headlines, tips).
- **Release gate**: new module ⇒ store build (2.5.2). Entries show in DEV or native train ≥ 24
  (`HOROSCOPE_FIRST_TRAIN`, `horoscopeAvailability.ts`) and while `horoscope` is on. OTAs into train 23 carry
  the code hidden. The next store build must be train 24.
- Home card `HomeHoroscope` (section `horoscope`, every layout, after sleep) — hidden by the person (birth
  screen) or admin (`homeCard`).
- Web `/app/horoscope[/oracle|chart|tarot|compat|more]` (`public/app/js/pages/horoscope.js`, `css/horoscope.css`) —
  live on deploy, no build.
- QA: `webqa` harness with `fixtures/horoscope.mjs` (real engine + snapshot of real readings/library).
