# MEDI COACH — ფიტნეს ტრენერი × MEDICARD (2026-09-28)

Owner request 2026-09-28: registered, verified fitness trainers who schedule their clients, see the
client's training and nutrition (with the client's consent), build meal plans, and follow a goal with
weight and before/after photos. Trainers get their own workspace UI, not the consumer app.

## The one promise

> შენი ტრენერი ხედავს იმას, რაც დარბაზს გარეთ ხდება — შენ კი არასოდეს აცდენ ვარჯიშს.

The trainer's problem today: the client is visible 3 hours a week; the other 165 hours (food, steps,
sleep, weight) happen in WhatsApp screenshots and guesses. The client's problem: forgotten sessions,
a meal plan in a PDF nobody opens, and no proof of progress. MEDICARD already records the 165 hours
(nutrition diary, steps, weight, workouts from Health). This module connects them to one coach,
with consent the client controls.

## Roles

| | Client (any user) | Trainer (verified) | Admin |
| --- | --- | --- | --- |
| Becomes one by | default | applying in the app → admin approval | existing admin accounts |
| UI | normal app + „ჩემი ტრენერი“ | separate **Coach workspace** (own tab bar, own home) | `#/trainers` |
| Sees | own data | only linked clients, only the scopes each client granted | applications, gyms, links (no health values) |

A trainer is still a normal MEDICARD user. The profile switch „ტრენერის რეჟიმი“ swaps the whole
shell (Instagram professional / Uber driver pattern). Mode is remembered per device.

## Trainer registration & verification

1. Profile → „ტრენერი ხარ?“ → application (requires verified phone, 18+):
   display name, photo (existing avatar), bio, specialties (multi-select), years of experience,
   gyms (picked from the Georgian gym directory, or „ჩემი დარბაზი სიაში არ არის“ → proposed gym),
   certificates (title, issuer, year, photo of the certificate — private upload), Instagram (optional).
2. Status `PENDING` → admin reviews in `#/trainers` (certificate images, phone, account age),
   approves (`VERIFIED`, blue check) or rejects with a reason the trainer sees. Admin can suspend.
3. Only `VERIFIED` trainers appear in search, can link clients and create sessions.
   Pending trainers can already open the workspace in read-only preview (“დადასტურების მოლოდინში”).

No payments in the app (MEDICARD stays free, App Review correction 2026-09-22). Prices, if a trainer
wants them, are free text in the bio.

## Gym directory

`server/src/data/gyms-ge.json` — brands (companies) → branches (city, address). Seeded into the
`Gym` table by the install script; admin can add/edit/hide branches and approve trainer-proposed
gyms. Each entry carries its public source; confidence `low` entries stay hidden until an admin
confirms them.

## Linking trainer ↔ client (consent first)

- Trainer shares a 6-character coach code / link `https://medicard.ge/c/CODE` / QR, or
- client searches verified trainers by name or gym („მოძებნე ტრენერი შენს დარბაზში“) and sends a request.
- Before anything is shared the client sees a consent sheet with **named data categories**, each a
  switch: სესიები (always), ვარჯიშები (workouts + steps from Health), კვება (diary, calories,
  plan adherence), წონა და მიზანი, პროგრეს-ფოტოები (off by default). Revocable any time in
  „ჩემი ტრენერი“ → effect is immediate server-side. Health data is special-category (Law 3144):
  sharing is voluntary, scoped, logged and reversible.
- A client can have one active trainer (keeps UX and notifications simple); a trainer many clients.

## Sessions (calendar & bookings)

- Trainer creates a session for a client (date, time, duration, gym, type, note), optionally
  repeating weekly for N weeks. Or publishes open slots; linked clients can book them.
- Client gets a push immediately („ნიკამ ჩაგწერა: ხუთ. 19:00, Iron Gym Vake“), and reminders
  24 h and 1 h before (server job, lease `trainer-reminders`). Client can confirm or request cancel;
  trainer gets a push on booking/cancellation. Late cancel (<12 h) is marked, not punished.
- After the session: trainer marks done / no-show and optionally logs exercises (sets × reps × kg).
  The phone's workout for that time window (from Apple Health / Health Connect: duration, active kcal,
  avg heart rate, when available) is attached automatically when the client has shared workouts.

## Nutrition by the trainer

- Trainer writes a meal plan: daily kcal + protein/carbs/fat and meals (breakfast… with items).
  Activating it sets the client's nutrition target (client sees „ტრენერის გეგმა“ in the diary).
- Adherence per day from the existing diary: ✅ in range (±10 % kcal, protein ≥ 90 %), ⚠️ over/under,
  ⏺ not logged. Trainer sees a 14-day strip and today's meals live.

## Goal, weight & photos

- Goal: type (lose / gain / recomposition / performance), start & target weight, target date — set by
  the client or proposed by the trainer and accepted by the client. Reuses the existing weight goal.
- Progress photos: front / side / back, private storage, dated, with the weight of that day.
  Before/after compare with a slider. Visible to the trainer only with the photos scope.

## Coach workspace (separate UI)

Tabs: **დღეს** (today's sessions timeline + alerts: “3 days over kcal”, “no weigh-in 7 days”,
“missed session”), **კალენდარი** (week view, create/move sessions, open slots), **კლიენტები**
(list with status chips → client dashboard: goal progress, weight chart, adherence strip, workouts,
sessions, photos, meal plan), **პროფილი** (public card, gyms, code/QR, switch back).

## Out of scope for this pass (flagged)

In-app chat (moderation + retention policy needed), payments/packages, group classes, trainer
reviews/ratings, AI-generated meal plans (needs the AI-consent manifest update), native workout
detail beyond what the Health bridge already reads.

## Implementation status (2026-09-28, app 1.0.0.15.0)

Built and verified:

- **DB** `server/prisma/20260928-trainer.sql` (+ `install-trainer.mjs` in `db:install`): `Gym`, `TrainerProfile`,
  `TrainerLink` (partial unique: one open link per client), `TrainerSession`, `TrainerMealPlan`, `ProgressPhoto`,
  `WorkoutLog`. All times are `TIMESTAMPTZ` (a `timestamp without time zone` shifted session times with the
  DB timezone in testing). Gyms: `server/src/data/gyms-ge.json` — 98 brands / 136 branches / 10 cities from
  public sources (official sites, fitpass.ge, yell.ge, kompas.ge); 5 low-confidence branches start HIDDEN.
- **API** `/api/trainer` (`server/src/routes/trainer.routes.js`, logic `lib/trainer.js`, SQL `lib/trainerStore.js`,
  pushes + 24 h/1 h reminders `lib/trainerPush.js`, lease `trainer-reminders`). Kill switch: feature flag `coach`.
  Admin `/api/admin/trainers` (TRAINER_VIEW / TRAINER_MANAGE, audited). Web invite page `/c/:code`.
- **App**: client screens `app/trainer/*` (hub, connect + consent, search by gym, sharing, sessions, session detail,
  meal plan, progress photos with before/after slider, trainer application), trainer workspace `app/coach/*`
  (own tab bar: დღეს / კალენდარი / კლიენტები / პროფილი; client dashboard with food/weight/training/photos tabs;
  session booking with weekly repeat; results log; meal-plan editor; goal proposal). Home card (`coach` section,
  only when linked or a trainer) and Profile block „ფიტნესი · MEDI COACH“. Deep link `medicard://c/CODE`.
- **Admin** `#/trainers`: verification queue with certificate viewer, approve/reject (reason)/suspend/restore,
  gym directory (approve trainer-proposed gyms, hide, add), guide in `v4/guides.js`.
- **Workouts from Health**: iOS reads HKWorkout (duration, active energy, avg HR, distance) with the existing
  HealthKit module; Android reads ExerciseSession/ActiveCaloriesBurned/HeartRate and needs the new manifest
  permissions `READ_EXERCISE`, `READ_ACTIVE_CALORIES_BURNED` → **a new native build** (EAS) is required for
  Android and for the permission to exist in a store binary on both platforms. Uploaded only while the client
  shares "workouts" with an active trainer; requested only from the toggle in „გაზიარება ტრენერთან“.

Verification: `server/src/lib/trainer.test.js` (unit), `server/src/lib/trainer.http.test.js` (full trainer↔client
flow over HTTP on a disposable Postgres, 60+ assertions: phone gate, pending block, certificate privacy, consent
version, code/request linking, conflicts, open-slot race, reminders once, adherence, weight/goal, photo scope,
revocation, account deletion), `mobile/src/lib/coach.test.ts`; web build of every screen against a local API on
the disposable DB (screens + admin). Not observed: OS push banners and native HealthKit/Health Connect reads
on a device (needs the native build).

Rules: never show a trainer data outside the ACTIVE link + scope (`requireClientAccess`); photos and certificates
only through `servePrivateUpload` with an owner/scope check; no payments in the app; lock-screen push text never
contains calories, weight or other health values; permission sheets only from a button.
