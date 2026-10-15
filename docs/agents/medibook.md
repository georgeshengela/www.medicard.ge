# MEDIBOOK: catalogue, map, online booking, business panel (/business), admin

Owner request 2026-10-15: „მნიშვნელოვანი ინფრასტრუქტურა“ — every dental clinic, beauty salon, aesthetic centre,
clinic and studio of our consumer segment in one catalogue with a map; MEDICARD users book online with every
step and notification; businesses claim or register themselves at https://medicard.ge/business and run a
Stripe-style panel (calendar, staff, services, clients, discounts, finance, analytics incl. utilisation —
„მარგი ქმედების კოეფიციენტი“). Inspiration: salonkee.be. „ექიმთან ვიზიტები“ became part of MEDIBOOK.
Read this file before working in the area; add new notes here, not in AGENTS.md.

## Names and rules

- Module **MEDIBOOK** (`book`), brand id `book` in `mobile/src/theme/moduleBrand.ts` (lilac `#7A58C9` / `#C6B2F5` — used lightly, lines not fills;
  the first pick, fuchsia, the owner rejected on day one), tone `book` in `colors.ts`. Feature flag `book` (server
  `FEATURES`, app `FEATURE_KEYS`, admin section „სხვა სივრცეები“). `visits` stays: it gates the hand-typed visit
  editor and Medi's visit tools.
- Free for consumers and (for now) free for businesses — no payments anywhere; prices are shown, paid on site.
- Only public business facts travel: name, category, contacts, address, hours, pictures, services, staff names,
  ratings. A client's note is theirs and the business's; never health data. Listing events (`BookEvent`) carry a
  hashed viewer, never a user id.
- Booking needs a verified phone (`requireVerifiedPhone`, the women's-space rule) — the business must be able to
  reach the client; the app offers `/profile/verify-phone` on the 403.
- Reminders for bookings are local notifications (prefix `book:`, same Profile switch as visits — „ვიზიტები და
  ჯავშნები“, family `visits`); the server pushes only changes (confirmed, moved, cancelled) and „შეაფასე“.

## Data (prisma/20261015-medibook.sql, install-medibook.mjs in db:install)

`BookBusiness` (status LISTED catalogue · PENDING registered by an owner, hidden from lists · CLAIMED live with an
owner · HIDDEN by admin; `source` MAPBOX | OSM | OWNER | ADMIN + `sourceRef` unique), `BookImage` (bytes in
Postgres, public `/api/book/image/:id`), `BookMember` (OWNER / MANAGER / STAFF, `staffId` links a member to their
calendar), `BookClaim` (CLAIM of a listed row, REGISTER of a new one; one PENDING per business per user),
`BookStaff` (schedule per weekday, `serviceIds` empty = every service), `BookService` (price / priceTo GEL,
duration, buffer, online), `BookTimeOff`, `BookClient` (the business's CRM row; `userId` when an app user),
`BookDiscount` (PERCENT / FIXED, services, dates, weekdays, hours, code, maxUses), `BookAppointment` (PENDING /
CONFIRMED / CANCELLED / COMPLETED / NO_SHOW; source APP / WEB / BUSINESS; price copied at booking; reminder flags),
`BookReview` (one per appointment, business reply), `BookFavorite`, `BookTransaction` (INCOME written once when an
appointment completes — unique on appointmentId; manual EXPENSE / INCOME), `BookEvent` (VIEW, CALL, ROUTE, WEBSITE,
SHARE, BOOK_START, BOOK_DONE, FAVORITE). Times are TIMESTAMPTZ; the day logic uses a fixed UTC+4
(`lib/book/time.js`). Catalogue ids are `bk-<sha1(source|ref)>`, slugs `<name>-<6 hex>`.

## Server (`server/src/lib/book/*`, routes `book.routes.js`, `business.routes.js`, `adminBook.routes.js`)

- `catalog.js` pure: CATEGORIES (ids, ka/en, pin colours, Mapbox + OSM mapping, name words), `guessCategory`,
  hours (`normalizeHours`, `openState`, Mapbox periods, simple OSM `opening_hours`), settings
  (`normalizeSettings`: slotMinutes, leadMinutes, horizonDays, cancelHours, autoConfirm, onlineBooking,
  allowStaffChoice, bookingNote), geometry (bbox pre-filter + haversine), public shapes, discounts.
- `availability.js` pure (tests): business hours ∩ staff schedule − time off − appointments (+ buffer), slot grid,
  lead time, horizon; „anyone“ = union over staff; `findConflict`, `isOfferedSlot`, `canCancelFree`.
- `store.js` (catalogue, members, claims, staff, services, time off, images, favourites, events, admin) and
  `bookings.js` (availability loading, `createAppointment` under `pg_advisory_xact_lock(hashtext(businessId))`,
  client upsert, best discount, my appointments, cancel, review → rating recompute, the business's calendar,
  `updateByBusiness` with the status flow and money/client side effects, clients, discounts, transactions,
  analytics raw, reminders due). `analytics.js` pure (tests): series, utilisation = booked ÷ working minutes
  (passed hours only), funnel, heat, top services, new vs returning, sources, ratings; `periodFor(range)`.
- `push.js`: `notifyBooked` (client + business members + email to the business address, ad-hoc `content` through
  `sendEmail`), `notifyChanged`, `notifyClientCancelled`, `notifyClaimReviewed`, reminders job lease
  `book-reminders` (24 h / 2 h, then one „შეაფასე“ 2–48 h after). Lock-screen text: place · service · time only.
- `/api/book`: public catalogue reads (`/businesses` nearby or search, `/map` pins, `/businesses/:id`,
  `/availability`, `/days`, `/categories`, `/image/:id`, events) + the person's bookings, cancel, review,
  favourites. `/api/business`: `/me`, `/search`, `/external` (Mapbox POI forward search for the claim flow),
  `/geocode` (Mapbox Geocoding v6, Georgia), `/similar`, `/claims`, `/register`, then `/:businessId/*` behind
  `requireMember(roles)`. `/api/admin/book`: overview, claims queue + review, businesses list/edit/add
  (BOOK_VIEW / BOOK_MANAGE, audited). Mapbox token = `mapboxPublicToken()` (Render env), also served to the panel.

## Catalogue seed

`server/scripts/medibook-crawl.mjs` → `server/src/data/medibook-ge.json`: Mapbox Search Box category API over a
grid of Tbilisi / Batumi / Kutaisi cells + 35 towns × 17 categories (name, address, phone, website, hours), then
Overpass (OSM) merged by distance < 80 m + name (fills `nameKa`, hours, phone) or added as `OSM` rows.
`install-medibook.mjs` inserts rows whose `source|sourceRef` is new and never touches existing rows. Re-run the
crawler when the catalogue looks thin; a claimed business is never overwritten. `language=ka` on the Mapbox
category endpoint returned nothing (2026-10-15) — names come as the provider has them.

## App (`mobile/app/book/*`, components `src/components/book/*`, lib `src/lib/book/*`)

Hub `/book` (ModuleHeader + hero: next booking or the search prompt; search field; category chips; „ახლოს შენთან“
with the one-button location ask — never from an effect; favourites; upcoming/past bookings; „ვიზიტები ხელით“ =
the old editor; „შენი ბიზნესია?“), `/book/map` (BookMap: Mapbox GL JS WebView like RunMap, pins coloured by
category, clusters, blue dot, bottom card), `/book/search`, `/book/b/[id]` (gallery, actions call / route /
site / share with events, discounts, services grouped with „ჩაწერა“, team, hours, about, reviews; unclaimed →
call + hand-typed visit + owner hint), `/book/b/[id]/book` (service → person → day strip → slots → note →
confirm; SLOT_TAKEN reloads slots; phone gate), `/book/appointments/[id]` (call, route, add to calendar from the
button, cancel with the late warning, review sheet; `?review=1` from the push), `/book/business`. `/visits`
redirects to `/book`; `/visits/editor` stays. Home: MEDIBOOK door in every layout (next booking), „არ გამოგრჩეს“
booking row, directory and modules sheet entries. `api.book.*` in `api.ts`; `/api/book` writes invalidate
`book` + `home` (events are read-only). Version 1.0.0.25.5 on main — a new module is review-worthy (2.5.2): it
ships with the next store build, not by OTA.

## Web app (`server/public/app/js/pages/book.js`, `css/book.css`, routes in `main.js` with `feature: 'book'`)

The same module on https://medicard.ge/app (owner rule: every app feature exists on the web). One page module serves
`/book` (hub: night-violet hero with the next booking or the search prompt — lilac only as lines, outlines and the
wordmark; chosen states and the booking button are neutral ink, `--book*` tokens in `book.css` —, live search + category chips — the term stays
on the page, only `?category=` is in the URL —, „ახლოს შენთან“ from the browser position after the one-button ask,
else the profile's saved city (`extraAnswers.location` coordinates or the town centre from the catalogue's city table),
else Tbilisi; upcoming / past bookings, saved places, „ვიზიტები ხელით“ → `/visits`, „შენი ბიზნესია?“ → `/business`),
`/book/map` (Mapbox GL JS, token from `/api/app/status` kept as `session.mapboxToken`; pins by category, clusters,
bottom card; `?focus=<id>` centres a place; without a token a calm note), `/book/:slug` (gallery, facts, call / route /
site / share / save with the same `BookEvent` kinds, discounts, services with „ჩაწერა“, team, hours, about, reviews;
unclaimed → call + hand-typed visit + owner hint), `/book/:slug/book?serviceId=` (service → person → 14-day strip with
paging inside `horizonDays` → slots by part of day → note → confirm; the 403 phone gate opens quest.js
`offerPhoneVerification` and retries once verified; `SLOT_TAKEN` reloads the slots) and `/book/appointments/:id?review=1`
(call, route, `.ics` download, cancel with the late warning, review sheet, „ისევ ჩაწერა“). `X-Medicard-Platform: web`
makes these bookings `source: WEB`. Free-slot reads bypass the 30 s client cache (`api.days` / `api.availability`
invalidate first). Home: MEDIBOOK door in the tools grid and the next booking (≤ 7 days) in „არ გამოგრჩეს“; nav item
in the Health group. Shared bits added for it: icons (`scissors`, `hand`, `waves`, `glasses`, `heartPulse`, `badgeCheck`,
`navigation`, `percent`, `globe`, `instagram`, `store`, `calendarPlus`, `locate`, `map`), `wordmark('book')`,
`.ink-book` / `.wm-book`. Preview: `node scripts/web-app-dev.mjs 4401` → http://localhost:4401/app/book (the owner signs
in). QA without an account: `node scripts/web-app-dev.mjs 4403 --mock scripts/web-app-mock` — `medibook.mjs` mocks the
person (one claimed bookable business, bookings, the phone gate with dev code 1234, cancel, review) and proxies the
public catalogue reads to the main API; set `localStorage.medicard.web.token` to any value to be „signed in“. Verified
2026-10-15 in the built-in browser: hub, search, business page, booking flow through the gate, cancel, review, Home,
phone layout, light theme, English. The map loads Mapbox + style but the hidden pane never ran its render loop, so
pins were not seen drawn — check once in a normal browser.

## Business panel (`server/public/business/`, served at /business and /business/*)

Vanilla ES modules on the /app toolkit (`/app/js/api.js` token `medicard.web.token`, `ui.js`, `i18n.js`,
`session.js`, `social.js`, `charts.js`) + `business.css` (`.bz-*`). `main.js` router/shell (sidebar with the
MEDIBOOK wordmark in Exo 2, business switcher, role-filtered nav, mobile bottom nav), `auth.js` sign-in,
`state.js` (memberships, current business in `localStorage` `medicard.business.current`), `shared.js` helpers,
`drawer.js`, `appointment.js` (drawer + new-booking dialog), pages: landing (signed out), start (claim: catalogue
search → claim form; Mapbox places → prefilled registration; register with geocode + draggable pin + hours),
dashboard, calendar (day = a column per person, week = a column per day; click a free spot → new booking; time
off), appointments, clients (+ detail with auto-saving notes), services, team (+ panel access), discounts,
finance (ledger, chart, methods, by person, expense categories), analytics (utilisation per person, funnel, busy
hours, top services, clients, sources, ratings), reviews (reply), settings (public page, pictures with logo /
cover roles, booking rules, status). Pending businesses see a yellow banner; the panel works before approval.

## Admin

`#/book` (`server/admin/v4/modules/book.js`): claims queue with approve / reject (reason required, pushes + email to
the owner), catalogue table (search, status, category; hide / list / edit; add a place), numbers (listed /
claimed / pending, bookings, favourites, 7-day views / calls). Capabilities `BOOK_VIEW`, `BOOK_MANAGE`.

## Business panel UI (2026-10-15 design pass)

- Brand colour is lilac (`#7A58C9` light ink / `#C6B2F5` dark; `--book*` tokens in `server/public/business/business.css`). Fuchsia, lime and amber were all rejected by the owner on 2026-10-15 — never bring it back.
- The colour is used lightly (owner): the wordmark, borders and outlines, the active page's bar, links, free-slot outlines, focus rings. Never as a fill: primary buttons, chosen states, toggles and avatars are neutral ink (`--brand` = the neutral, `--book*` = the lilac). Hero gradients in the app stay a quiet night-violet.
- The landing hero is the product: a three-column day that fills with bookings once on load (`pages/landing.js` `demo()`); claim / register scroll to the sign-in box and store the intent in `sessionStorage` for `/start`.
- Date and time are never native inputs: `js/fields.js` `dateField()` (month popover, Monday first) and `timeField()` (15-minute grid in three parts of the day; `configure({ free })` tints the free slots from `/availability`; `allowEmpty` adds Clear; `to: '24:00'` for closing times). The popover is `position: fixed` on `<body>` so modals and the drawer never clip it, and it is click-through while fading out. Used by the walk-in dialog, the move editor, time off, discounts, finance and the hours editor (`shared.js hoursEditor`).
- Dialog buttons in the modal footer sit outside the form: submit by hand (`form.requestSubmit()`), never `type: 'submit'` there.
- Shell: the desktop sidebar column rule is wrapped in `@media (min-width: 761px)` (the shared `/app/app.css` hides the sidebar at 760px); stat strip = one surface with hairline dividers, only the money number carries the accent.
