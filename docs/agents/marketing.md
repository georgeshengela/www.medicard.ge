# Marketing: ads, posters, social posts, landing pages

## The app is MEDICARD AI (owner 2026-10-13)

People who saw a MEDICYCLE ad looked for an app called MEDICYCLE. The App Store name is **MEDICARD AI**; the
modules (MEDICYCLE, MEDIRUN, MEDISLEEP, MEDIHOROSCOPE, …) are sections of it. Every creative says so:

- **Posters, stories, videos:** the real App Store icon (`mobile/assets/icon.png`, teal) + „MEDICARD AI“ at the top,
  on screen the whole time in a video; at the bottom „App Store-ში მოძებნე / MEDICARD AI“ + medicard.ge. A module
  name appears only as a part of the app: wordmark + „MEDICARD AI-ის (ახალი) განყოფილება“, or in a headline as
  „… MEDICARD AI-ში“. Never a module name alone as the brand of an ad.
- **Captions:** say „MEDICARD AI“ and „App Store-ში მოძებნე „MEDICARD AI““, plus the App Store link and medicard.ge
  (the older rule: every caption carries both links).
- **Landing pages** (`server/public/<module>/index.html`): the module wordmark carries `.wm-part`
  „MEDICARD AI აპის განყოფილება“, the App Store button has the `.appname` chip from `/app-name.css`
  (icon + „App Store-ში მოძებნე MEDICARD AI“), the site menu uses `/icon.png`. /cycle, /medirun, /horoscope, /sleep
  follow it. Meta Traffic ads must link these pages (App Store URLs are refused there); `?c=<ad>` becomes the App
  Store campaign (`/store-campaign.js`).
- **App Store search:** add module names (medicycle, medirun, medisleep, horoscope) to the keywords at the next
  version that is not in review.

## Where things are

- 2026-10-14 launch (MEDIHOROSCOPE + MEDISLEEP): `brand/launch-horo-sleep/` — `poster.html?v=h1…h4|s1…s4|og-h|og-s&fmt=feed|story|og`,
  `render.mjs` (JPGs), `film.html` + `render-film.mjs` (20 s film, 4:5 and 9:16), `music.mjs` (Lyria via OpenRouter,
  ~$0.04), captions in `captions.md`. App screens come from the web export + mock API (webqa harness, `adshoot.mjs`),
  never from production accounts. Media (`out/`, `img/screens/`, `img/art/`, `fonts/`) is not committed.
- Earlier campaigns: `brand/campaign/`, `brand/social-q4/`, `brand/cycle-*`, `brand/medirun/`.
- Health pages (/cycle, /sleep) never load the Meta Pixel or GA (`site-consent.js` EXCLUDED).
