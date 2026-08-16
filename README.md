# Medicard.GE

A Georgian-language AI medical assistant. React Native (Expo) client, Express + Prisma API, Neon
serverless PostgreSQL, and a dual-AI architecture that splits clinical reasoning from image
pre-processing.

Every string the user sees — UI copy, validation messages, API errors and AI output — is in Georgian.

```
www.medicard/
├── mobile/     Expo + Expo Router + NativeWind client
└── server/     Express + Prisma API against Neon PostgreSQL
```

## Quick start

```bash
# 1. Install both workspaces
npm run install:all

# 2. Configure the backend
cp server/.env.example server/.env      # fill in DATABASE_URL, JWT_SECRET, API keys

# 3. Create the schema in Neon
npm run db:push

# 4. Run the API (port 4000)
npm run server

# 5. Run the app (separate terminal)
npm run mobile          # Expo Go / dev client
npm run mobile:web      # browser
```

`npm run mobile` prints a QR code — scan it with Expo Go (Android) or the Camera app (iOS)
with the phone on the same Wi-Fi. The project targets **Expo SDK 54**, which matches the
Expo Go build on the App Store and Play Store. It starts in `--lan` mode so the device can
reach both Metro and the API; on a network that blocks peer traffic use `npm run mobile -- --tunnel`.

The client discovers the API automatically: it reuses the LAN IP Metro is serving from so a
physical device can reach your machine, falls back to `10.0.2.2` on the Android emulator, and
`localhost` otherwise. Override with `EXPO_PUBLIC_API_URL` for staging or production.

> **Why the scripts go through `mobile/scripts/start.mjs`:** some editor terminals (Cursor's
> included) export `CI=1`. The Expo CLI reads that as non-interactive, which hides the QR code
> and disables Metro's file watching, so nothing hot-reloads. The launcher strips `CI` and
> forwards every argument to `expo`, so the behaviour is identical in and out of the IDE.

## Architecture

### Dual-AI routing

Two engines, each doing only what it is good at.

| Concern | Engine | Where |
| --- | --- | --- |
| Clinical reasoning, differentials, lab interpretation, guidelines, citations | **EvidenceMD** (`evidencemd-pro`) | `server/src/lib/evidencemd.js` |
| Image description, OCR, visual triage of skin / X-ray / CT / MRI | **Claude 3.5 Sonnet**, falling back to **GPT-4o** | `server/src/lib/vision.js` |
| Offline OCR fallback for lab sheets | Tesseract (`kat+eng+rus`) | `server/src/lib/ocr.js` |

Images never go to the clinical engine directly. The vision model turns pixels into structured
English notes, those notes are wrapped in a Georgian hand-off instruction, and only then does
EvidenceMD reason over them. The vision models are explicitly forbidden from diagnosing; the
clinical model is explicitly required to answer in Georgian and cite its sources.

EvidenceMD is OpenAI-compatible, so it is driven with the official OpenAI SDK pointed at
`https://evidencemd.ai/api/v1` and authenticated with an `x-api-key` header.

### Free-tier metering

Three AI generations per user per day, resetting at local midnight in Tbilisi (not UTC).

`enforceAiQuota` checks the `DailyUsage` row before any engine is called and returns
**HTTP 429** with `"დღიური 3 უფასო შეკითხვა ამოიწურა. გთხოვთ, სცადეთ ხვალ."` plus an upsell
payload when the limit is reached. Otherwise it hands the route a `req.consumeAiCredit()`
callback which is invoked *only after a generation succeeds* — a failed upstream call never
costs the user a query. The counter is incremented with an atomic upsert, so concurrent
requests cannot both slip through.

Every AI response carries the refreshed quota, and the client folds it straight into the
persistent counter banner.

### Patient demographics

Sex and date of birth are collected at registration because reference ranges, drug dosing
and differential diagnosis all depend on them. `server/src/lib/patient.js` derives the age
and renders a Georgian demographics block that is passed as clinical context to *every*
EvidenceMD call — chat, consilium, lab decoding, imaging, skincare and medication review.

Birth dates are stored in a Postgres `DATE` column and read back with UTC getters while
"today" is read locally, so a birthday never shifts by a day across timezones. Accounts
created through the SMS flow, which cannot collect these fields, get an inline editor on the
profile screen; until they complete it the demographics block is simply omitted rather than
guessed.

### Prompt design

`server/src/lib/prompts.js` holds one system prompt per module, each pinning three things:
the output language and register, the required Markdown section structure, and the safety
rules (no final diagnosis, mandatory disclaimer, 112 escalation for red-flag symptoms, no
prescription dosing). The disclaimer is appended in code rather than trusted to the model.

## API

| Method | Route | Notes |
| --- | --- | --- |
| `POST` | `/api/auth/register` | email + password + sex + birth date, returns JWT and quota |
| `POST` | `/api/auth/login` | |
| `POST` | `/api/auth/phone/start` | Georgian phone auth — SMS gateway stub |
| `POST` | `/api/auth/phone/verify` | creates the account on first verification |
| `GET` | `/api/auth/me` | profile, quota and record counts |
| `PATCH` | `/api/auth/me` | completes the medical profile (sex, birth date, name) |
| `GET` | `/api/usage` | free-tier counter with its Georgian label |
| `POST` | `/api/ai/query` | AI ექიმი / კონსილიუმი — metered |
| `POST` | `/api/ai/analyze-image` | multipart lab / imaging / skin upload — metered |
| `POST` | `/api/ai/skincare` | routine builder — metered |
| `POST` | `/api/ai/medication-review` | interaction check on the active schedule — metered |
| `GET/DELETE` | `/api/chats`, `/api/chats/:id` | |
| `GET/DELETE` | `/api/records`, `/api/records/:id` | |
| `GET/POST/PATCH/DELETE` | `/api/medications` | |

Auth is `Authorization: Bearer <jwt>`. The token is stored in the Keychain / Android Keystore
via Expo SecureStore, with a `localStorage` fallback on web.

## Modules

| Module | Screen | Pipeline |
| --- | --- | --- |
| AI ექიმი | `app/chat/[mode].tsx` | EvidenceMD, conversational, last 12 turns kept for context |
| კონსილიუმი | same screen, `consilium` mode | EvidenceMD picks 3–5 relevant specialists and writes each opinion |
| გაშიფრე ანალიზები | `app/module/lab.tsx` | image → vision OCR, or PDF → `pdf-parse` → EvidenceMD → ნორმაშია / ყურადღება მისაქცევი / რეკომენდაციები |
| რენტგენი / CT / MRI | `app/module/imaging.tsx` | vision description → EvidenceMD radiology read |
| კანი & ხალები | `app/module/skin.tsx` | vision description → EvidenceMD ABCDE assessment and risk tier |
| კანის მოვლა | `app/module/skincare.tsx` | structured questionnaire → EvidenceMD routine |
| მედიკამენტების კალენდარი | `app/(tabs)/medications.tsx` | Neon schedule → `expo-notifications` daily repeating reminders |

Medication reminders are a mirror of the server schedule: the client cancels and re-creates the
full set on every read, which is the only way to stay consistent after an edit, pause or delete.

## Design system

| Token | Value | Use |
| --- | --- | --- |
| `bg-100` | `#fffefb` | page background |
| `bg-200` | `#f5f4f1` | cards, containers |
| `primary-200` | `#00668c` | brand, primary actions |
| `accent-200` | `#71c4ef` | light sky accent |
| `text-100` | `#1d1c1c` | body copy |

Defined once in `mobile/tailwind.config.js` and mirrored as plain values in
`mobile/src/theme/colors.ts` for the places React Native cannot take a `className` — icon
colours, shadows and navigator options. Cards are `rounded-2xl` with soft diffuse elevation.

Dark mode is pinned to `class` rather than `media` in `tailwind.config.js`. This is a light-only
clinical UI so the OS colour scheme must not recolour it — but it is also load-bearing. On web,
`react-native-css-interop` installs a `MutationObserver` that waits for the stylesheet to be
injected and then calls `colorScheme.set(...)`, which **throws** if the compiled `darkMode` flag
says `media`. The result is a full-screen uncaught error:

> Cannot manually set color scheme, as dark mode is type 'media'.

Because it depends on whether the CSS lands before or after that module evaluates, it shows up
intermittently rather than on every load.

If you ever see it, the compiled CSS is stale — Metro caches NativeWind's Tailwind build
separately and does not reliably invalidate it when `tailwind.config.js` changes:

```bash
npm run mobile:web:clean    # or: npm run mobile:clean
```

Then hard-reload the browser tab. To confirm the fix took, the served CSS should contain
`--css-interop-darkMode: class dark`. **Any edit to `tailwind.config.js` needs a `--clear` start.**

Georgian script has a large x-height and no capitals, so the type scale uses slightly looser
line heights than the Tailwind defaults, and the tab bar sets an explicit `lineHeight` to stop
descenders being clipped.

All copy lives in `mobile/src/i18n/ka.ts` so it can be proof-read in one place.

## Verification

```bash
npm run test:api      # 21 API assertions against a running server
npm run test:ai       # live EvidenceMD call, asserts Georgian output + disclaimer
npm run typecheck     # tsc --noEmit
```

`mobile/scripts/screenshot.mjs` drives the web build through a full signup-to-profile walkthrough
in a phone-sized Chromium viewport and writes `mobile/screenshots/*.png`. Run the API and
`npm run mobile:web` first, then `node mobile/scripts/screenshot.mjs`.

## Deploy (Render + medicard.ge)

The app ships as **one** Render web service: Express serves `/api`, `/health` and the
Expo web export on [medicard.ge](https://medicard.ge). Database stays on Neon.

### 1. GitHub

Repo: [github.com/georgeshengela/www.medicard.ge](https://github.com/georgeshengela/www.medicard.ge)

```bash
git remote add origin https://github.com/georgeshengela/www.medicard.ge.git
git push -u origin main
```

### 2. Render

1. Open [dashboard.render.com](https://dashboard.render.com) and sign in with GitHub.
2. **New → Blueprint** and select `georgeshengela/www.medicard.ge`.
3. Fill in the prompted secrets (these never go in git):

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Neon **pooled** (`-pooler`) connection string |
| `EVIDENCEMD_API_KEY` | EvidenceMD key (chat / clinical reasoning) |
| `OPENROUTER_API_KEY` | OpenRouter key (X-ray / labs / derm vision) |
| `ANTHROPIC_API_KEY` | optional fallback vision |
| `OPENAI_API_KEY` | optional fallback vision |

Also set (or rely on Blueprint defaults):

| Variable | Suggested value |
| --- | --- |
| `OPENROUTER_BASE_URL` | `https://openrouter.ai/api/v1` |
| `OPENROUTER_MODEL` | `openai/gpt-4o` |
| `EVIDENCEMD_BASE_URL` | `https://evidencemd.ai/api/v1` |
| `EVIDENCEMD_MODEL` | `evidencemd-pro` |

`JWT_SECRET` is generated. `PORT` is set by Render. Frankfurt is the closest region to Georgia.

First deploy runs `prisma db push`, exports the Expo web app, then starts `node server/src/server.js`.

### 3. DNS for medicard.ge

Render auto-adds `www.medicard.ge` → `medicard.ge`. At your registrar (often nic.ge),
replace any existing A/AAAA/CNAME for the root and `www`:

| Type | Host | Value |
| --- | --- | --- |
| **A** | `@` | `216.24.57.1` |
| **CNAME** | `www` | your Render URL, e.g. `medicard-ge.onrender.com` |

Copy the exact `*.onrender.com` hostname from the service page — do not guess it.

If the DNS host is **Cloudflare**, use CNAME `@` and `www` → that same Render hostname,
both **DNS only** (grey cloud) until Render issues the certificate. Then you can proxy.

Delete **AAAA** records — Render is IPv4-only and leftover AAAA records block SSL.

Propagation is usually minutes; SSL is issued automatically after Render verifies DNS.
Confirm in the service → **Settings → Custom Domains**.

The Blueprint uses the **starter** instance so the API does not spin down. Switch to **free**
in the dashboard if you want to try the deploy before paying.

## Before production

- **Secrets** — `server/.env` is gitignored. Rotate the committed development keys and move them
  into your host's secret manager.
- **File storage** — uploads currently land on local disk via `server/src/lib/storage.js`. Swap
  that one module for S3 / R2; nothing else depends on the storage backend.
- **SMS** — `POST /api/auth/phone/start` returns a fixed development code. Wire a Georgian
  gateway (SMSOffice.ge, Magti, Geocell); the client contract does not change.
- **Payments** — the Premium upsell is a placeholder. There is no billing integration yet.
- **PHI** — confirm HIPAA/GDPR scope, data-retention terms and a BAA with EvidenceMD before
  sending identifiable patient data.
- **Migrations** — `prisma db push` is used because Neon's pooled connection sits behind
  PgBouncer. For versioned migrations, point `prisma migrate` at the direct (non-pooler) host.

## Medical disclaimer

Medicard.GE is a decision-support tool, not a diagnostic device. Every clinical response carries
**„ეს არ არის საბოლოო დიაგნოზი — მიმართეთ ექიმს."**, and the disclaimer is enforced in code rather
than left to the model.
