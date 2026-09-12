# MEDICARD RELEASE AUDIT RA-00 — FULL PRODUCT INVENTORY

**Date:** 2026-09-11  
**Public app identity:** `1.0.0.7.66` (`ge.medicard.app`)  
**Product logic changed during RA-00:** **NO**  
**Full execution audit:** **NOT YET COMPLETE**

This phase discovers what exists in source. It does **not** claim the app works. Master-control-matrix rows are `auditStatus: NOT_RUN` unless noted as unit-tested only.

Generator: `qa/release-audit/RA-00/_generate-inventory.mjs` (read-only parser).

---

## 1–2. Repository architecture / apps

See `repository-map.md`.

- Apps: **mobile** (Expo), **server** (Express/Prisma/Neon), **admin SPA**, **marketing site**.
- No `packages/` workspace. Cycle capability matrix is duplicated server/mobile.
- CI: **Render Blueprint only**. No GitHub Actions. Mobile: **EAS** (`appVersionSource: remote`, production `autoIncrement`).
- Native: local `mobile/android/` prebuild on this disk; **no** `mobile/ios/`.

---

## 3–7. Mobile screens, routes, deep links, controls

| Metric | Count | Artifact |
|--------|------:|----------|
| Screen files (`mobile/app/**/*.tsx` excluding layouts) | **114** | `screen-inventory.json` |
| Layout navigators | **21** | same |
| Admin hash screens | **15** | `admin-inventory.json` |
| Interactive controls extracted | **811** | `master-control-matrix.json` |
| Master audit cases | **811** | same |

Scheme: `medicard`. HTTPS partner share: `https://medicard.ge/share/cycle/{code}`. Notification routes include `/week`, `/chat/DOCTOR`, `/cycle`, `/cycle/log`, `/cycle/pregnancy/care-plan`, `/medications/:id`, `/visits`, `/health-metrics/*`, `/weather?from=push`, `/medi-quest?from=push`.

**Auth:** `AuthGate` in `mobile/app/_layout.tsx` — all non-`(auth)` routes require a user. Cycle stack has an extra privacy/biometric unlock. `__DEV__` + `?preview=1` can stay on onboarding.

**Orphans / weak entry:** `/cycle/journal`, `/health-metrics/hydration/calendar` (strong); `/symptoms/conditions`, `/cycle/pregnancy` redirects; `/(auth)/phone` DEV-ish; `dev-launcher` `__DEV__` only. Defect **RA00-019**.

**Control extraction method:** static regex over `Pressable|Switch|TextInput|RefreshControl|Button` in `app/` + `src/components/`, plus every admin mutation endpoint. This is the discoverable set. Custom gesture-only controls without those primitives may still exist — later phases click the real UI.

**Accessibility:** ~405/666 Pressables lack `accessibilityLabel` (conservative Pressable-only scan). Defect **RA00-016**.

---

## 8. Modules

Canonical list in `modules-inventory.json`. Added vs the brief: **PERIMENOPAUSE**, **RUN**, **BILLING**, **RECORDS**, **PLATFORM**.

Home **implementation** order (`homeSectionOrder.ts`): dashboard → nextDose → steps → hydration → weight → mediQuest → cycle? → lab → weather → run → symptom → analysis → consilium → recentActivity → disclaimer.

---

## 9–10. API + security class

Artifact: `api-inventory.json` (**207** method+path pairs from source regex + top-level mounts).

Independent Express `router.stack` walk during discovery reported **217**. Variance documented as **RA00-020**. Use the JSON as the working matrix; RA-15 should dump live stack.

| Class | Count (JSON) |
|-------|-------------:|
| OWNER_ONLY | 102 |
| ADMIN_ONLY | 79 |
| PUBLIC | 20 |
| AUTHENTICATED | 3 |
| PARTNER_SCOPED | 2 |
| UNKNOWN | **1** |
| INTERNAL | 0 |

**UNKNOWN = `GET /uploads/*`** — unauthenticated static files. Defect **RA00-001 (P0)**.

PUBLIC includes auth register/login/password/phone start+verify, pharmacy catalog, `/api/app/status`, `/health`, legal/calculators, admin **shell** HTML, admin login.

---

## 11–12. Database

**69** Prisma models. Artifact: `database-model-inventory.json`.

- 13 Prisma migration folders, **no** `migration_lock.toml`, **no** baseline.
- 11 standalone `phase*.sql` files.
- Prisma validate: **schema file is valid** (does not prove Neon matches).
- Integrity flags: missing User FKs (`DailyUsage`, `SmsLog`, `PhoneVerification`); loose string refs; pregnancy/postpartum one-ACTIVE only in SQL; possible duplicate ACTIVE entitlements; User delete Cascades almost all PHI.

Defects **RA00-006, RA00-010, RA00-011, RA00-012, RA00-018**.

---

## 13. Authentication map

| Step | Implementation |
|------|----------------|
| Register / login | `POST /api/auth/register`, `/login` JWT |
| Phone OTP | `/phone/start`, `/phone/verify` (UI orphan-ish) |
| Password reset | `/password/forgot`, `/reset` (Resend) |
| Me / patch / delete | `GET/PATCH/DELETE /api/auth/me` |
| Hydration | AuthContext + SecureStore token |
| Middleware | `requireAuth`, `requireAdmin`, `requireAdminCapability` |
| Partner | share token hash + accept binding |
| Account switch | scoped prefs + cycle offline isolation tests exist |
| QA OTP | env + admin toggle; documented off |

Protected: every mobile route outside `(auth)` via AuthGate; every `/api/*` except pharmacy, app status, auth public, admin login, and static `/uploads`.

---

## 14. Cross-user candidates

Chats/records/meds/visits generally scope `userId` in WHERE or `updateMany({ id, userId })`.

**Fetch-then-check:** quest `loadQuestForUser`, cycle custom tags. Partner share is intentional cross-user. Admin by `params.id` is operator scope.

Adversarial list: **RA00-015**. Not proven IDOR.

---

## 15. Admin

SPA `server/admin/` hashes: overview, users, users/:id, push, health, ai, rewards, packages, orders, sms, pharmacy, quality, cycleqa, audit, settings.

**Impersonation: ABSENT.**

Mutations are in the master matrix as `admin-mutation` rows. Capabilities gate rewards admin.

---

## 16–17. AI pipelines + data boundary

**13** pipelines in `ai-pipeline-inventory.json`.

Providers: OpenRouter (Gemini Flash default, Ling free), EvidenceMD, vision fallbacks Anthropic + OpenAI.

`withPatientAiContext` may send: demographics, vitals, allergies, conditions, meds, 14-day metrics, cycle mode (POSTPARTUM omitted for Cycle AI).

**Retention:** `AiInteraction.userPrompt` / `assistantReply` — no purge job. Admin can read. Third parties receive live calls. Defect **RA00-005**. Persisted chats/records can store generated claims. Defect **RA00-030**.

---

## 18. Notifications

Artifact: `notification-inventory.json`.

- Local: meds, cycle, prenatal DATE_BASED + EXACT_TIME, visits, goals, Brain engage (18 families).
- Remote: admin campaigns, quota-reset sweeper 30s.
- Brain is sole client scheduler for engage; medication/cycle/prenatal have dedicated planners.
- Quiet hours 22:00–08:00; EXACT_TIME uses visit-alarm policy (no bump).
- Actions: TAKE/SNOOZE, DRANK, OK/CHAT, OPEN/SNOOZE, quota CHAT.
- Companion product ≠ a Brain family.

Failing unit test: re-engagement fireAt. **RA00-008**.

---

## 19. Socket.IO

See `socket-inventory.json`. JWT handshake; rooms `ops` and `user:{id}`; 9 emit events. Quest sockets are UX; REST is source of truth.

---

## 20–21. Permissions + health integrations

`permissions-inventory.json`.

Implemented: notifications, camera, photos, foreground location, HealthKit, Health Connect, calendar (explicit prenatal export), biometrics.

**ABSENT:** background location, Bluetooth, workout Health types, runtime microphone request (declared only — **RA00-017**).

Health sync **does** read steps/weight/hydration/sleep/BP/HR/nutrition and R/W menstrual + BBT + mucus. OPK/pregnancy-test **not** written to Health.

---

## 22. Local storage

`local-storage-inventory.json`. SecureStore for JWT + cycle DEK. Encrypted cycle offline queue. No AsyncStorage/SQLite/Zustand persist.

---

## 23. Secrets / env

`secrets-inventory.json`. Names only. No hardcoded `sk-` private keys found in source. Production API URL baked in `app.json` / EAS. Example `ADMIN_PASSWORD` in `.env.example` (**RA00-026**). Local `.env` files exist and are gitignored — not printed.

---

## 24. Logging

Morgan redacts `/api/cycle/share`. `AiInteraction` stores prompts (PHI). Client `console.warn('[api]')` paths. Lab extract console is a PHI candidate. Cycle push logs are redacted via `redactCyclePushLog`. **No Sentry.**

---

## 25. Analytics

`analytics-inventory.json`. First-party `ProductEvent` allowlist (27 kinds including server-only). No PostHog. Weather client events **dropped** (**RA00-009**). Dose events send medication **IDs**, not names.

---

## 26. Uploads

Multer memory, 12MB, image/PDF for AI. Persistent user files via `/uploads` static (**P0**). HEIC transcode on iPhone. Pharmacy images are catalog URLs.

---

## 27. Exports

`export-inventory.json`: cycle JSON, doctor summary PDF (ka/en/fr/ru, observation allowlist), wipe, partner peek (stripped fertility tests), prenatal OS Calendar (no place, no alarms), account delete, admin CSV-like exports. **No** named cycle CSV exporter.

---

## 28–29. Localization / copy

App UI is **Georgian** via `ka.ts` (no i18next). Doctor summary + quest catalogs: ka/en/fr/ru. Hardcoded KA exists in notifications channel names and force-update. Button-label vs action mismatches were **not** exhaustively executed; suspicious semantics are a later RA item (Save/Cancel/Delete). Inventory flag: rewards/cycle crashes prevent some buttons from even running.

---

## 30. Navigation

AuthGate + Expo Router file routes. Orphans listed above. Deep-link params (`share code`, `week`, `id`) need RA-02 unsafe-param tests. Modal policy: `APP_MODAL_PROPS` fade (convention; not verified visually in RA-00).

---

## 31–35. Error / cold start / offline / idempotency / races

Not execution-tested. Inventory:

- Network UX: many screens likely miss 401/429/timeout differentiation — **RA-16**.
- Cold start: AuthGate waits `authReady`; cycle can paint cached bundle; TTC/pregnancy queries have unit tests for user switch; UI language is hard-ka so little locale flash.
- Offline: cycle log/period queued+encrypted; most else online-required (**RA00-022**).
- Strong server idempotency: rewards `idempotencyKey`, quest/achievement ledger uniques, hydration `clientEventId`, cycle `(userId,date)`, check-in date unique.
- Weak client: med taken, mode patch TOCTOU, wipe double confirm (**RA00-013/014**).
- React Query: **not used**.

---

## 36–37. Performance (inventory only)

Candidates: cycle calendar, pharmacy lists, lab history, admin user table (20/page), `withPatientAiContext` 14-day metrics, pharmacy sync cron, AI serial vision, unbounded `findMany` without pagination on several owner lists (chats/records/meds — later RA-17 must confirm).

---

## 38–41. Tests + coverage honesty

**113** automated test files. **0** Maestro. **0** product E2E.

`npm --prefix server test`: **1565 pass / 0 fail** in 6.7s (includes many mobile tests).

Mobile scripts: offline 57, geo 5, weather 27, quest 65, home 10 — pass. **Engage 37 pass / 1 fail**. Lab script passed in the combined run.

**Interaction coverage: NONE.** A passing cycle engine test does not mean a button was clicked.

`coverage-gaps.json`: Cycle/TTC/Pregnancy/Postpartum/Quest/Rewards = high **unit**, zero **E2E**. Medications/Symptoms/Pharmacy/Profile/Run/Weight = low/none even in unit.

---

## 42. Build / type / lint / prisma

| Check | Result |
|-------|--------|
| `npx prisma validate` | PASS (schema file) |
| `npm --prefix server test` | PASS 1565 |
| `npm --prefix mobile run typecheck` | **FAIL 123 errors** (**RA00-007**) |
| Expo doctor / EAS build | NOT RUN |
| Server process start | NOT RUN (avoid live side effects) |
| Admin “build” | static files; root `npm run build` not executed here |
| Lint | no repo-wide eslint script in root package.json |

---

## 43. Dependencies (no upgrades)

Mobile: Expo 57, RN 0.86.3, HealthKit + Health Connect, Mapbox via public token, socket.io-client. Server: Express 4, Prisma 6, OpenAI SDK, Anthropic, multer, Playwright (pharmacy scrape), Tesseract, pdf-parse. Duplicate cycle libs across apps. `playwright` in both. Abandoned-looking: none proven. Peer warnings: not captured (npm ls not run to completion).

---

## 44–46. TODO / fake data / flags

Almost no TODO/FIXME in app logic. DEV fixtures are `__DEV__` gated (quest, companion, weather, rewards). Pregnancy `placeholder.webp` is a real fallback asset. QA OTP is a **live code path** if enabled (**RA00-027**). `SHOW_DEV_UI = false`.

---

## 47–48. Accessibility / visual matrix

Inventory only. Later QA must capture per important screen: normal, empty, loading, error, dark, large text, small screen, keyboard, long content. Cycle phase QA already has Android shot folders; iOS deferred by product.

---

## 49–50. Medical safety / high-risk

See `medical-safety-inventory.json` and `high-risk-actions.json`. RA-00 does not judge clinical correctness.

---

## 51–57. Special inventories

- Cycle (frozen 1–42): `cycle-inventory.json`
- Medications: `medications-inventory.json`
- Labs: `labs-inventory.json`
- Medi: `medi-inventory.json`
- Quest/economy: server ledger; **no client-authoritative mint found**. Reward **UI crash** **RA00-002**.
- Home: order in §8
- Profile/settings: notifications, permissions, privacy, terms, AI engine, streak, face-id, location; mix of server profile vs scoped local prefs — RA-12 executes persistence
- Delete account: **present** (`DELETE /api/auth/me`). Export cycle: present. Revoke partner share: present.

---

## 58–59. Release config

- Version `1.0.0.7.66` / iOS `1.7.66` / native integers 66 (local floor)
- EAS remote autoIncrement (MEMORY: remote was 2 on 2026-09-11)
- API `https://medicard.ge`
- No Sentry, no OTA
- Android Health Connect needs a **native** APK (Expo Go limitation documented in MEMORY)

---

## 60–63. Defects, counts, gaps

See `defects.json`.

| Sev | N |
|-----|--:|
| P0 | 1 |
| P1 | 7 |
| P2 | 15 |
| P3 | 7 |
| Total OPEN | 30 |

**P0:** unauthenticated `/uploads`.

**P1 (titles):** reward detail crash; CycleMoreTracking `pregnancy`; missing `alcoholLabel` export; AI prompt retention; Prisma migration drift; 123 tsc errors; Brain re-engage test fail.

Untested functionality: essentially **all UI**, admin clicks, live AI, live push on device, Health Connect on a real APK, iOS, production QA OTP state, upload guessing.

Dead/unreachable: listed orphans + DEV launchers.

---

## 64–66. Plan / blockers / files

Plan: `release-audit-plan.md`. Next recommended phase: **RA-01** (auth + session + P0 uploads verification). **Do not start it in this session.**

**Blockers preventing a complete execution audit (not inventory):** no Maestro; typecheck red; iOS QA deferred; live API/AI/smoke not run; EAS not run; `/uploads` P0 unverified against production CDN.

### Files created

Under `qa/release-audit/RA-00/`:

- `_generate-inventory.mjs`
- `repository-map.md`
- `screen-inventory.json`
- `master-control-matrix.json`
- `api-inventory.json`
- `database-model-inventory.json`
- `ai-pipeline-inventory.json`
- `notification-inventory.json`
- `permissions-inventory.json`
- `analytics-inventory.json`
- `export-inventory.json`
- `test-suite-inventory.json`
- `test-execution.json`
- `coverage-gaps.json`
- `defects.json`
- `release-audit-plan.md`
- `RA-00-report.md` (this file)
- `admin-inventory.json`
- `counts.json`
- `socket-inventory.json`
- `secrets-inventory.json`
- `cycle-inventory.json`
- `modules-inventory.json`
- `high-risk-actions.json`
- `medical-safety-inventory.json`
- `local-storage-inventory.json`
- `feature-flags.json`
- `medications-inventory.json`
- `labs-inventory.json`
- `medi-inventory.json`
- `documentation-mismatches.json`

---

## 67. Conclusion

The repository is inventoried well enough to begin execution testing. It is **not** release-ready and **not** fully tested.

**MEDICARD RELEASE AUDIT RA-00 — FULL PRODUCT INVENTORY COMPLETE**

**FULL EXECUTION AUDIT — NOT YET COMPLETE**

Next phase: **RA-01** (Auth + onboarding + session + account lifecycle + unauthenticated upload boundary). Do not start RA-01 here.
