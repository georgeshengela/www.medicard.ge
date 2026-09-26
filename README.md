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
with the phone on the same Wi-Fi. The project targets **Expo SDK 57**, which matches the
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
| Medi chat and module answers | **Gemini Flash via OpenRouter** (`google/gemini-3.8-flash`), chosen by the server. There is no user-facing model picker; ops can override with `AI_DEFAULT_ENGINE` (`gemini_flash` · `ling_free` · `evidencemd`). | `server/src/lib/aiEngine.js` |
| Clinical last-resort path | **EvidenceMD** (`evidencemd-pro`) | `server/src/lib/evidencemd.js` |
| Image description, OCR, visual triage of skin / X-ray / CT / MRI | **OpenRouter** vision models, using only the provider routing named in `mobile/src/config/aiDisclosure.json` | `server/src/lib/vision.js` |
| Offline OCR fallback for lab sheets | Tesseract (`kat+eng+rus`) | `server/src/lib/ocr.js` |

Every outbound AI request goes through `consentedAiFetch`. It allows only the OpenRouter and EvidenceMD origins, pins OpenRouter to the disclosed providers (`allow_fallbacks: false`, `zdr`), and checks the account's AI consent on every attempt. The direct Anthropic / OpenAI clients left in `vision.js` are therefore blocked (`AI_PROVIDER_NOT_APPROVED`). They are not a working fallback.

Images never go to the clinical engine directly. The vision model turns pixels into structured
English notes, those notes are wrapped in a Georgian hand-off instruction, and only then does
EvidenceMD reason over them. The vision models are explicitly forbidden from diagnosing; the
clinical model is explicitly required to answer in Georgian and cite its sources.

EvidenceMD is OpenAI-compatible, so it is driven with the official OpenAI SDK pointed at
`https://evidencemd.ai/api/v1` and authenticated with an `x-api-key` header.

### AI usage metering

MEDICARD is entirely free for consumers. `FREE_CONSUMER_RELEASE` is always `true`
(`mobile/src/lib/consumerAccess.js`), so there is **no daily quota and no upsell**. Package rows
and `FREE_DAILY_AI_LIMIT` remain only for historical data and older API compatibility.

`enforceAiQuota` still runs before every engine call, but only for abuse and concurrency control:

- a per-account burst limit of 30 AI starts per 10 minutes (`AI_START_MAX` / `AI_START_WINDOW_MS`
  in `server/src/lib/usage.js`), which returns HTTP 429 `RATE_LIMITED`;
- one in-flight reservation per operation, released on failure or cancel (`AI_BUSY`).

`req.consumeAiCredit()` runs only after a generation succeeds, so a failed upstream call never
counts.

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
| `POST` | `/api/ai/query` | Medi / კონსილიუმი — metered |
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
| Medi | `app/chat/[mode].tsx` | EvidenceMD, conversational, last 12 turns kept for context |
| კონსილიუმი | same screen, `consilium` mode | EvidenceMD picks 3–5 relevant specialists and writes each opinion |
| გაშიფრე ანალიზები | `app/module/lab.tsx` | image → vision OCR, or PDF → `pdf-parse` → EvidenceMD → ნორმაშია / ყურადღება მისაქცევი / რეკომენდაციები |
| რენტგენი / CT / MRI | `app/module/imaging.tsx` | vision description → EvidenceMD radiology read |
| კანი & ხალები | `app/module/skin.tsx` | vision description → EvidenceMD ABCDE assessment and risk tier |
| კანის მოვლა | `app/module/skincare.tsx` | structured questionnaire → EvidenceMD routine |
| მედიკამენტების კალენდარი | `app/(tabs)/medications.tsx` | Neon schedule → `expo-notifications` daily repeating reminders |

Medication reminders are a mirror of the server schedule: the client cancels and re-creates the
full set on every read, which is the only way to stay consistent after an edit, pause or delete.

## Design system

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `bg-100` | `#f5f7f7` | `#030712` | page background |
| `bg-200` | `#eaeeef` | `#1f2937` | inputs, chips, sheets |
| `primary-100` | `#0f766e` | `#99f6e4` | brand text |
| `primary-200` | `#14b8a6` | `#14b8a6` | brand, links, icons |
| `accent-100` | `#ccfbf1` | `#042f2e` | brand tint fill |
| `text-100` | `#0f1a1c` | `#ffffff` | headings |

Filled dark CTAs use `#0D9488`. See AGENTS.md "Dark theme" and `mobile/src/theme/hub.ts` for the Home hub design language.

Defined once in `mobile/tailwind.config.js` and mirrored as plain values in
`mobile/src/theme/colors.ts` for the places React Native cannot take a `className` — icon
colours, shadows and navigator options. Cards are `rounded-2xl` with soft diffuse elevation.

Dark mode is pinned to `class` rather than `media` in `tailwind.config.js`. The app has light and dark
themes chosen in-app (and synced to the OS on request), so the class toggle is how it switches — and it is also load-bearing. On web,
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

The app ships as **one** Render web service: Express serves `/api`, `/health`, `/admin`,
and a Georgian **marketing landing** on [medicard.ge](https://medicard.ge). The product itself
is **mobile-only** (Expo). There is no web login or app shell. Database stays on Neon.

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
| `SMS_OFFICE_API_KEY` | SMSOffice.ge key (OTP + admin SMS; sender **MEDICARD**) |
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

First deploy runs `prisma db push`, then starts `node server/src/server.js`. The public site is
`server/public/` (not an Expo web export).

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
- **SMS** — `POST /api/auth/phone/start` sends a real 4-digit OTP via SMSOffice.ge when
  `SMS_OFFICE_API_KEY` is set. Admin panel → **SMS** tab for balance, send, and logs.
- **Payments** — the Premium upsell is a placeholder. There is no billing integration yet.
- **PHI** — confirm HIPAA/GDPR scope, data-retention terms and a BAA with EvidenceMD before
  sending identifiable patient data.
- **Migrations** — Production still uses `prisma db push` in `npm run release`. Live Neon
  inspection (2026-08-30, read-only): there is **no** `_prisma_migrations` table, but
  `CycleProfile` / `CycleLog` / `CycleCustomTag` / `CyclePartnerShare` already include the
  Phase 7–9 columns (TTC tests, contraception, pain/lifestyle/tags). The three repo
  migrations are `IF NOT EXISTS` no-ops against that schema. Do **not** switch Render to
  `prisma migrate deploy` until: (1) `DIRECT_URL` / unpooled Neon is set (PgBouncer can
  break migrate), (2) `migrate deploy` is proven on a staging clone, (3) you accept that
  this database was created by `db push` and must never `migrate reset`. After a successful
  clone deploy, the first production `migrate deploy` would create `_prisma_migrations` and
  record those three already-applied Cycle migrations. Seed on release is idempotent for
  packages/settings/pharmacy catalogs and does not touch Cycle rows; it does re-hash the
  admin password and assign FREE to users with a null package — prefer running seed only
  when that is intended, not on every deploy.

## Medical disclaimer

Medicard.GE is a decision-support tool, not a diagnostic device. Every clinical response carries
**„ეს არ არის საბოლოო დიაგნოზი — მიმართეთ ექიმს."**, and the disclaimer is enforced in code rather
than left to the model.
