# My Pets — release readiness (2026-09-15)

Narrow pass. Owner design changes are preserved. No remote SQL, deploy, push, or version bump in this task.

Related: `docs/PETS_PHASE7_VERIFICATION.md`, `docs/PETS_ARCHITECTURE.md`, `server/docs/pets-phase7-runbook.md`.

---

## 1. Environment used by the current mobile session

| Fact | Actual |
|---|---|
| Phone session | LAN device connected to Metro **`:8081`** |
| API target | **`https://medicard.ge`** (`mobile/.env` `EXPO_PUBLIC_API_URL`; `app.json` `extra.apiUrl` same) |
| Backend | **Hosted Render**, not the isolated `:4010` API |
| Database behind `server/.env` | **Hosted Neon** (same cluster the local `:4000` process uses) |
| Isolated leftover | Metro `:8082` + API `:4010` → `127.0.0.1:55432` / `medicard_pets_phase7`. Not this owner test |

Unauthenticated `GET https://medicard.ge/api/pets` → **401** (route mounted). Not 404. Schema is checked only after auth; owner create/chat is the live proof, plus the inspect below.

`GET /api/app/status`: `maintenanceMode=false`, `minAppVersion=1.0.0.1.11`, `forceUpdate=false`. Five-part clients are not blocked.

Owner success **does not** mean a second SQL apply is required. It also does not prove OS reminders or iOS.

---

## 2. Hosted schema (inspect only — not applied)

`SELECT` via Prisma against `server/.env` (no credentials in this file):

| Object | Present |
|---|---|
| `Pet*` tables | 11: `Pet`, `PetWeightLog`, `PetAllergy`, `PetCondition`, `PetProduct`, `PetCareSchedule`, `PetCareOccurrence`, `PetCareEvent`, `PetReminderDelivery`, `PetChatSession`, `PetChatMessage` |
| `PeriodUsage.reserved` / `reservedAt` | Yes |
| `PetChatMessage_petId_inflight_key` | Yes |
| `PetReminderDelivery_*_fkey` | user / pet / schedule CASCADE |

Row counts at inspect (no names/URLs): `Pet` 1, `PetWeightLog` 2, `PetAllergy` 1, `PetCondition` 0, `PetProduct` 0, `PetCareSchedule` 1, `PetCareOccurrence` 0, `PetCareEvent` 0, `PetReminderDelivery` 0, `PetChatSession` 1, `PetChatMessage` 10.

**SQL to apply on this target: none.** Files `pets-phase2.sql` … `pets-phase7.sql` are already reflected. Re-running them is unnecessary (`IF NOT EXISTS` / duplicate-object guards, but do not treat a re-run as a release step).

Render `preDeployCommand` is `npm run release` = `prisma generate` + `seed`. Seed does **not** touch Pets tables. It does **not** apply Pets SQL.

---

## 3. Verified by owner (accepted; design kept)

| Journey | Status |
|---|---|
| Create dog | Verified by owner |
| Weight | Verified by owner |
| Allergies | Verified by owner |
| Medi Vet chat | Verified by owner (text) |
| Conditions | **Not** reported |
| Reminder → notification tap → administer → next occurrence | **Not** verified |
| Care-draft confirm from Medi Vet | **Not** verified |
| Photos durable | **Not** verified (and not durable on Render) |
| iOS | **Not** verified |

Do not redo the Pets UI. Do not start a broad QA campaign.

---

## 4. Verified technically

| Item | Evidence |
|---|---|
| Isolated SQL/HTTP Phase 7 / 7.1 | `docs/PETS_PHASE7_VERIFICATION.md` (55432) |
| Hosted schema phase2–7 | Inspect 2026-09-15 |
| Production pets routes | `GET /api/pets` 401 |
| VET isolation | `petsChat` uses `SYSTEM_PROMPTS.VET` / `withPetAiContext`. Chat composer `showTools={false}` (no camera). In-app disclosure names OpenRouter, not a diagnosis |
| Privacy vs behavior | Live `https://medicard.ge/privacy` §3.4ა: OpenRouter, not EvidenceMD, no VET attachments, ephemeral photos, device-local reminders. Matches `ka.pets.photoHint`, `vetDisclosureBody`, `vetDisclaimer` |
| Release API URLs | `eas.json` preview/production `EXPO_PUBLIC_API_URL=https://medicard.ge`. No `10.0.2.2` / `:4010` in EAS. QA OTP disabled when `NODE_ENV=production`. Dev preview `preview=1` is `__DEV__` only |

`QA_OTP_CODE=0000` is on the leftover isolated `:4010` process only.

---

## 5. Remaining blockers (capability-scoped)

| Capability | Blocks shipping identity/health/VET text? | Action |
|---|---|---|
| OS care reminders | **Yes if the store promises banners** | Owner checklist below on a **development build** (Expo Go is not DATE-trigger proof) |
| Care-draft confirm | No for chat-only | Leave as-is; do not mark verified |
| Photos | Only if claiming permanence | Keep current hint. Do not add object storage in this pass |
| iOS | iOS store | Deferred, same as Cycle |
| Clinical VET review | Quality, not schema | Outstanding; owner chat is not that review |
| Uncommitted mobile UI | Store JS | Owner design lives in the working tree. Ship it when asked; this pass does not push |

---

## 6. Near-future reminder checklist (owner, existing flow)

Use a **development APK**, not Expo Go. Same production API is fine.

1. Open the dog → **მოვლა** → **მოვლის დამატება** → **მოვლის დაგეგმვა**.
2. Kind + first date **today or tomorrow**, time ~10 minutes ahead if the form allows a clock.
3. Save the plan. Open the schedule. Turn **შეხსენება ამ მოწყობილობაზე** on. Allow OS notifications if asked.
4. Leave the app (home screen, not force-stop). Wait for the banner.
5. Tap the banner → confirm **მივეცი** / **გაკეთდა** on `/pets/:id/care/complete`.
6. Confirm the next occurrence moved (or the plan completed if one-shot).
7. Glance that human medication reminders still exist.

If step 4 never fires, do **not** market pet-care OS reminders. Tracking still works without them. Force-stop is a separate OS state and is not promised.

---

## 7. Minimal rollout (proposed; not executed)

**Target:** production Render `medicard.ge` + current hosted Neon.

**SQL:** none. Confirm with the inspect `SELECT`s in the runbook if a future operator is unsure. Never `prisma db push`.

**Order:**

1. Backend is already serving `/api/pets` on Render (commit `a2d7ce8` and later). Extra server deploy only if uncommitted server Pets code must ship — this readiness pass did not require one.
2. Mobile: commit the owner-approved Pets UI when asked, then EAS **production** (`EXPO_PUBLIC_API_URL=https://medicard.ge`). Bump `expo.version` in **that** store-facing task, not here.
3. Config: `OPENROUTER_API_KEY` already required for the owner’s live chat. `NODE_ENV=production`. Do not set `QA_OTP_CODE` on Render.

**Post-release smoke (authenticated, existing account):**

1. List pets (not 503).
2. Open weight + allergy already entered.
3. Medi Vet one short question; confirm OpenRouter, not EvidenceMD.
4. Optional: the reminder checklist if banners will be mentioned.

**Rollback / disable (keep history):**

- Do **not** drop `Pet*` tables.
- Hide Profile **ჩემი ცხოველები** and/or stop mounting `petsRouter` / chat router. Missing-schema 503 is for missing tables, not a disable switch.
- Reminders: `PATCH` `reminderEnabled: false`; local reconcile cancels `pets:` OS ids.
- Quota `reserved` columns can stay.

---

## 8. Report summary

| Class | What |
|---|---|
| Verified by owner | Dog create, weight, allergies, Medi Vet chat |
| Verified technically | Hosted schema phase2–7; production pets routes; VET isolation vs EvidenceMD; privacy copy match; EAS/production API URLs; QA OTP off in production |
| Remaining blockers | OS reminder tray if promised; care-draft confirm; iOS; durable photos; clinical VET review |
| Proposed deploy | Production Render + existing Neon. **No SQL.** Mobile UI commit/EAS when asked. No version bump in this task |
