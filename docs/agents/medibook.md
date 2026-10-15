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
phone layout, light theme, English. The map was checked the same day with the pane visible (a hidden pane never draws a
frame, so Mapbox never fires `load`): tiles, pins by category, clusters, the count pill, pin → card → business page,
`?focus=<id>`, the locate button, the category chips, light and dark. The map follows the theme button through a
`MutationObserver` on `data-theme` (`setStyle` + re-added layers from the kept features); the pill says „500+“ at the
server cap (`MAP_LIMIT`); a chip that excludes the selected place closes its card; on phones the Mapbox logo / attribution
sit above the bottom nav, the +/- buttons are hidden (pinch zooms) and the card hides the „ჩაწერა“ pill.

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

## Charts, demo data and the second polish pass (2026-10-15, evening)

- `/overview` now returns `days` (two weeks back, one ahead: bookings / completed / noShow / cancelled / pending / created / revenue / newClients per day) and `sources` (APP / WEB / BUSINESS over the past two weeks). The dashboard draws sparklines under the four numbers, the three-week stacked bars, the team's day as rings (booked ÷ working minutes from `today` + each person's schedule) and the sources donut. Clients get a strip (returning share donut, new in 30 days, average spend, drifting away), reviews the average with a star distribution, team cards a 30-day load meter (from `/analytics?range=30`), calendar heads an occupancy bar, the bookings list status chips with counts, analytics a revenue line and a services-share donut. Charts come from `/app/js/charts.js` (barChart / lineChart / donut / ring / sparkline / meters).
- Demo data for the owner's test business (Aversi Clinic, `bk-31b9b4e11f9e`) was seeded on 2026-10-15 with the session's `qa-demo.mjs` (clients `@demo.medicard.test`, appointments with `internalNote = 'DEMO'`, expenses `note = 'DEMO'`, time off `reason LIKE 'DEMO%'`, events). Those markers let `qa-demo.mjs cleanup` remove exactly the demo rows when the owner wants a clean business; events are deleted wholesale for that business.
- Admin #/book catalogue rows open a read-only detail dialog (status, contact, hours, panel members, services, team) from the name or the info button; editing stays in its own dialog.
- App booking flow: services are grouped like the business page, the day strip marks days with free slots, slots and chips are 44 pt tall, the footer line names the chosen person.

## Booking flow in the app (2026-10-15, late: four pages) and the panel lists

- The one-page booking screen is gone. `app/book/b/[id]/book/` holds `index` (service, grouped, tap advances; `?serviceId=` skips it), `who` (anyone first, then each eligible person with the nearest free day and its first four times as chips — a chip jumps straight to the summary, the way Altegio's professional page does), `when` (a week strip you page through with a dot under days that have free time, the free times of the chosen day in three parts of the day, an „earliest free time“ card on top, one Continue in the thumb zone) and `confirm` (summary with Change links, note, the business's note, cancellation rule, then the one call that creates the booking). Shared pieces in `src/components/book/BookFlow.tsx` (`useBookingFlow`, `StepBar`, `ChosenPills`, `ServiceRow`, `PersonRow`, `discountFor`). What is chosen travels in route params, so back always means one step back. „ჩემი ჯავშნები“ lives at `app/book/appointments/index.tsx` with upcoming / past tabs; the hub links to it right under the search field.
- Reference studied with the owner's Altegio demo (2026-10-15): the client form lets people start from service, professional or date; services are multi-select with a sticky summary bar whose button names the next step; the professional page shows „nearest time slot“ chips; the date page is a month grid with available days bold and times in collapsible day parts; the details page is summary + name/phone/email/comment + reminder choice + consent. Our flow keeps one service per booking (the server's model) and the app's own reminders.
- Panel lists all use `js/lists.js`: `chips` (with counts), `pager` (25/50/100, remembered per page in sessionStorage with the filters via `listState`), `sortableHead`/`sortRows`, `groupBy`, `filterBar`. Bookings: day-grouped table, period incl. a custom range, status/person/source, search, quick confirm / cancel / complete in the row. Clients: filters (app / by hand / new / with a booking / no-shows / drifting), tag chips, sortable columns, call link, new-booking and edit in the row, a richer client card. Finance: ledger chips (all / income / expenses / by hand), category, method, person, search, sortable, net of the shown rows. Reviews: chips (unanswered, 5★, 4★, ≤3★, with text), person, pages. Services: search, online/on-site, group chips. Team: search, sort (load / bookings / name), chips, a week of dots per person.
- Sidebar (2026-10-15, after the Altegio walk): navigation in three groups (the day / the business / money and numbers) plus Settings; live badges from `/overview` (today's visits on Calendar, bookings to confirm on Bookings in the warn tone, unanswered reviews on Reviews; refreshed at most every 20 s on navigation); a mini month calendar under the navigation only on the calendar page (a day jumps to it, keeping the day/week mode); the business card in the sidebar opens Settings.

## Wave 2 (2026-10-16): several services in one booking

- Schema: `server/prisma/20261016-medibook-2.sql` + `scripts/install-medibook-2.mjs` (in `db:install`, additive only — the install script refuses anything but `CREATE … IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS` on `Book*`). `BookAppointmentItem` holds one row per service (name, minutes, price, discount, order; cascades with the appointment). `BookAppointment` keeps the first `serviceId`, the names joined with „ + “ in `serviceName`, and the total `durationMin` / `price` / `discountAmount`, so every older reader (lists, finance, pushes, web /app) keeps working unchanged.
- Server: `normalizeServiceIds(serviceIds, serviceId)` (comma list or array, de-duplicated, max 8) → `serviceRows` (every id must exist and be active; online for clients) → `bundleOf` = one block of time (`ids`, summed minutes, the last service's buffer). `availability.js` `slotsForDay` takes that bundle and only offers people who perform **every** id (`serviceIdsOf`). `createAppointment` prices and discounts each service on its own, writes the items and bumps each discount's `usedCount`. A service change from the drawer (`updateByBusiness` with `serviceId`) collapses the booking back to that one service. `analytics` top services count every item, so a haircut + colour visit counts for both. Routes: consumer `/availability`, `/days`, `POST /appointments` and business `/availability`, walk-in `POST` accept `serviceIds` next to `serviceId` (`SERVICE_REQUIRED` when neither comes). `appointmentPublic` adds `services[]` (always, one entry for a plain booking).
- Panel: the new-booking dialog lists services as checkboxes with a running total („2 სერვისი · 1 სთ 45 წთ · 130 ₾“) and reloads the free times for the whole block; the drawer lists the services under „სერვისები“ when there is more than one. Styles `.bz-svc-pick/.bz-svc-row/.bz-svc-total/.bz-svc-list`.
- App (1.0.0.25.10): the service step is multi-select (checkbox rows, Altegio pattern) with a bar in the thumb zone that adds everything up and whose button names the next step („აირჩიე ვინ“ / „აირჩიე დრო“); it warns when no one person performs the whole set. `useBookingFlow` exposes `serviceIds`, `selected`, `bundle`, `serviceKey`; `serviceParams(ids)` builds the query for days/availability; who/when/confirm carry `serviceIds` in the route params (`serviceId` stays the first one, so the business page's „ჩაწერა“ pill still skips ahead; coming back from the summary with `serviceIds` shows the ticks instead of skipping). The summary lists each service with its own price and the total; the booking detail page lists the services under „N სერვისი“. Web /app stays single-service (still valid).
- Verified 2026-10-15 on the main DB: bundle availability (30 + 20 = 50 min), a two-service DEMO booking on the owner's Aversi business (per-service discount, items, drawer), service change → one item, cascade delete, consumer API with the QA business (bundle + old single-service shape + `SERVICE_REQUIRED`), the panel dialog and drawer in the browser; `node --test` 18 green, `tsc` clean.

## Wave 2 (2026-10-16): waiting list

- Schema: `BookWaitlist` in `20261016-medibook-2.sql` — business, client (user and/or client row, name, phone), the services (`serviceIds` JSONB + the first `serviceId` + joined `serviceName`), optional person, `fromDate`/`toDate` (YMD), `dayParts` (MORNING < 12:00 ≤ AFTERNOON < 17:00 ≤ EVENING; empty = any), note, status WAITING / OFFERED / BOOKED / CANCELLED / EXPIRED, source, the last offer (`offeredAt`, `offeredStartsAt`, `offeredStaffId`, `offerCount`), `appointmentId` once booked.
- Server `server/src/lib/book/waitlist.js`: `join` (client; CLAIMED + online booking, online services, a person who performs them all, range clamped to today…horizon and ≤ 60 days, phone required, one open entry per user + business + same service set is refreshed instead of duplicated, ≤ 10 open entries per user), `addByBusiness` (walk-in, any range ≤ 180 days), `listMine`, `listForBusiness({ status: 'open' | 'all' | one })`, `countOpen`, `cancelMine`, `updateByBusiness` (note, cancel, back to waiting, booked + appointmentId, or `offer: { startsAt, staffId }`), `remove`, `markBooked` (a booking inside the range for one of the entry's services closes it; a manicure booked while waiting for a haircut leaves the haircut open), `expireOld`, `sweepBusinesses`, `matchOpenings({ businessId, dates, minAgeMs })` — per day the bundle's free slots (`slotsForDay`, the entry's person or anyone) filtered by day parts; the first fitting slot is remembered and the entry becomes OFFERED; entries offered within the last 24 h are skipped, two waiting clients never get the same minute in one pass.
- Pushes (`push.js`): `offerOpenings` = match + `notifyWaitlistOpening` („გათავისუფლდა დრო — {ბიზნესი}: {სერვისი} · {როდის}“, route `/book/b/{id}/book/when?serviceId=&serviceIds=&staffId=&date=` so one tap lands on that day), `notifyWaitlistJoined` to the business's people, `notifyWaitlistAdded` to an app user put on the list by hand. Triggers: client cancel (`POST /appointments/:id/cancel`), business PATCH to CANCELLED or a move (the old day; the response carries `waitlistOffered` and the drawer's toast says „მოლოდინის სიიდან N კლიენტს დრო შევთავაზეთ“), time-off removal (every freed day, ≤ 14), and the five-minute reminders pass (`processBookReminders`: `expireOld`, then the next seven days for every business with open entries; entries younger than 15 min wait for the next pass so joining never pushes back at once).
- Routes: consumer `POST /api/book/waitlist` (requireVerifiedPhone; 201 created / 200 refreshed), `GET /api/book/waitlist`, `DELETE /api/book/waitlist/:id`; business `GET /:id/waitlist?status=`, `POST /:id/waitlist` (walk-in), `PATCH /:id/waitlist/:wid`, `DELETE` (manage). Bookings (consumer + walk-in) call `markBooked` with the booked service ids.
- Panel: sidebar „მოლოდინის სია“ (bellRing, in „დღე“, badge = open entries from `/waitlist?status=open&limit=1`), page `pages/waitlist.js`: chips open / offered / booked / all, search, five columns (client, services + person + note, wanted range + day parts, status + offer + added, actions), row actions „შეთავაზება“ (day + time with the bundle's free times tinted, one push; a walk-in without the app is noted as offered and the business calls), „ჩაწერა“ (the new-booking dialog pre-filled with client, services, person and the first day — `newAppointmentDialog` takes `preset.serviceIds`; the entry becomes BOOKED on creation), remove; „დამატება ხელით“ dialog (client search or new, services chips, person, range, day parts, note).
- App (1.0.0.25.11): `app/book/b/[id]/book/wait.tsx` (services and person from the flow, days: this day / next 7 / 14 / 30 within the horizon, day parts, note, how it works, „სიაში ჩაწერა“, done card); the `when` page shows the waiting-list card at the top when no day has free time, inside the empty state of a full day (with that day), and a quiet link under the times otherwise; „ჩემი ჯავშნები“ lists open entries above the bookings — an OFFERED entry shows „გათავისუფლდა: …“ with „დაჯავშნე“ (opens `when` on that day), the X leaves the list. `api.book.waitlist.join/list/cancel`, types `BookWaitlistEntry`, `BookDayPart`.
- Verified 2026-10-15 on the main DB with the QA business: join / refresh / bundle join / my list / business list / walk-in by hand; a business cancellation offered the day to two matching entries (`waitlistOffered: 2`, OFFERED with the first slot and the person); a booking inside the range closed only the matching entry; a manual offer; BAD_RANGE and SERVICE_REQUIRED; the panel page, badge and offer dialog in the browser; `tsc` clean. Web /app has no waiting list yet.
