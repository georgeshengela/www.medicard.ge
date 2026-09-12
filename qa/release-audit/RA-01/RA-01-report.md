# MEDICARD RELEASE AUDIT RA-01

**AUTH, SESSION & PRIVATE FILE SECURITY — FINAL-FROZEN**

**RA00-001 — CLOSED**

**FULL EXECUTION AUDIT — NOT YET COMPLETE**

Date: 2026-09-11. Scope: authentication, onboarding, session, account isolation, `/uploads` security. Unrelated RA-00 P1s were not modified.

Public identity bumped **1.0.0.7.66 → 1.0.0.7.67** (iOS marketing **1.7.67**). Native `buildNumber` / `versionCode` remain 66.

---

## 1–11. RA00-001 and private uploads

### 1. Reproduction before the fix

YES. Fixture-only `GET /uploads/<uuid>.jpg` with no Authorization, no cookie:

- Status **200**
- `Content-Type: image/jpeg`
- `Cache-Control: public, max-age=604800`
- Actual fixture bytes returned (`fileBytesReturned: true`)
- Source: `server/src/server.js` `express.static(UPLOAD_DIR, { maxAge: '7d' })`

Artifact: `evidence/ra00-001-before.json`. No medical content captured.

### 2. Upload architecture (before)

`saveUpload()` writes `{uuid}.{ext}` under `server/uploads/` and stores **`/uploads/{filename}`** on `MedicalRecord.imageUrl`. Writers: `POST /api/ai/analyze-image` and `POST /api/ai/extract-lab`. No File table. Ownership is the medical-record row. Pharmacy/CDN images and bundled avatars are not this directory. Disk was not unlinked on record or account delete. Filename entropy was the only “control”.

### 3. Root cause

Public static mount before `enforceAppAvailability`. UUID path ≠ authorization.

### 4. Security design after the fix

- `GET /uploads/*` → **401 JSON**, `Cache-Control: private, no-store`, never bytes (even with a Bearer token).
- `GET /api/files/:filename` + `requireAuth`:
  1. Strict UUID+ext parse; reject `../`, encoding, null bytes, slash variants
  2. `path.relative` must stay inside `UPLOAD_DIR`
  3. Owner: `MedicalRecord` for `req.user.id` whose `imageUrl` is `/uploads/{fn}` or `/api/files/{fn}`
  4. Missing owner or missing file → **404** (no filesystem path in the body)
  5. Admin JWT rejected by `requireAuth` (403). Partner has no byte-read contract.
- Headers: `private, no-store`, `X-Content-Type-Options: nosniff`, `Content-Disposition: inline; filename="<uuid.ext>"`
- Morgan redacts `/api/files/` and `/uploads/`
- Mobile `privateFileImageSource()` maps stored keys to `/api/files` with `Authorization: Bearer`

### 5. Legacy

Existing DB keys stay `/uploads/{uuid}.ext`. Serving requires the new route. Old `max-age=7d` browser/CDN copies may linger until expiry.

### 6–10. Direct URL results (HTTP, sanitized fixture)

| Case | Result |
| --- | --- |
| A owner authenticated | **200** + bytes, private cache, nosniff |
| B unauthenticated `/api/files` | **401** |
| B unauthenticated `/uploads` | **401**, no bytes |
| C other user | **404**, no bytes |
| D/E invalid / traversal | **400/404**, no directory leak |
| F deleted record/file | **404** |
| G logout then old URL | client has no token → **401**; server still requires auth |
| H expired JWT | **401** |
| I admin | user-API **403**; not intended to read bytes |
| J partner | no file contract; denied |

### 11. Consumers

Record detail now sends Bearer on the Image. AI writers still store `/uploads/{fn}` keys. Pharmacy CDN URLs are not rewritten. A privacy fix that broke all images would have failed owner **200** tests — it did not.

---

## 12–58. Auth execution (summary)

**12. Chain:** mobile SecureStore token → `api.ts` Bearer → `requireAuth` / `requireAdmin` → `req.user` / `req.admin` → route `userId` filters.

**13. Token storage:** SecureStore (device) / localStorage (web) / memory. Not AsyncStorage. No cookies.

**14. Login happy path:** Android emulator-5554 installed `ge.medicard.app` cold-started into authenticated Home for the Cycle QA fixture. Server issues JWT only after bcrypt compare.

**15. Invalid login:** Live `POST /api/auth/login` wrong password → **401**, no token, no hash, no stack. Android UI tap once opened forgot-password (evidence `extra-forgot-password-entry.png`); HTTP is the executed invalid-login proof.

**16. Malformed:** Zod **400** for non-email. Deterministic.

**17. Double tap:** Button `disabled` while `loading`; `submittingRef` added on sign-in (sign-up already had it).

**18. OTP:** Phone 4-digit AUTH; email 6-digit password reset. TTL 10 minutes, 5 attempts, 60s resend, bcrypt-10 hashes, `usedAt` single-use.

**19. QA OTP:** Connected DB had `AppSettings.qaOtpEnabled=true` with empty `QA_OTP_CODE`. That is a universal 0000/000000 while enabled. **Fix:** `isQaOtpEnabled()` is **false in `NODE_ENV=production`** even if settings/env ask. Public `/api/app/status` does not advertise the flag. **PRODUCTION-REACHABLE UNIVERSAL QA OTP EXISTS = NO** after the gate.

**20. Reuse:** `usedAt` set; lookup requires `usedAt: null`. Rejected.

**21. Expiry:** lookup `expiresAt: { gt: now }` plus `evaluateOtpRow`. Rejected.

**22. Cross-account:** phone OTP bound to normalized phone; email reset bound to `userId`. QA master was the exception; production now cannot use it.

**23. Rate limit:** `/api/auth` 80/15min production (skip `/me`). OTP resend 60s. No extra SMS blasting performed.

**24–25. Registration:** unique email/phone **409**. Password min 8 / max 128, bcrypt **12**.

**26. Interrupted registration:** AuthGate does not show app shell without a user. Half-auth UI is the auth stack.

**27–30. Onboarding:** assessment vs profile-setup vs analyzing (RA-00 branches). Writes keyed by `req.user.id`. `POST /complete` and `PUT /` are upserts (double submit updates the same row). Analysis cached unless `force`. Partial AI failure does not mark `completedAt` by itself.

**31. Cold start:** Logged-out deep link did not show Home. Stored session did restore Home for the same user. Snapshot is ignored on JWT sub mismatch. AuthGate renders a blank canvas instead of protected children when logged out.

**32. Deep link:** `medicard://cycle` while logged out stayed on the auth welcome. No Cycle data.

**33. Expired session:** `TOKEN_EXPIRED` 401; hydrate clears token on unauthorized.

**34–35. Logout:** Android confirm → welcome. Token/snapshot cleared. Re-login of same user not re-typed (no password on device); cold-start Home proved persistence before logout.

**36–38. User switch:** Android A→B not executed (no second password). Guards: `adopt()` wipe, scoped prefs, jwtSubject, no React Query persist. Cycle offline queue stays user-scoped on disk.

**39–41. IDOR / profile:** Live records IDOR **404**. Files wrong-user **404**. Profile mutations are `/me` only.

**42–45. Account delete:** UI shown, **not executed** on the QA fixture. Server: cascade + RA-01 file unlink. Old JWT → `requireAuth` 401. Files without an owner row are not served.

**46–48. Admin / partner:** Live user JWT vs `/api/admin/me` denied. Admin JWT cannot call user APIs. Partner is share-token scoped.

**49. Middleware order:** `/uploads` deny stub is not static files. `/api/files` is behind `enforceAppAvailability` + `requireAuth`. Landing skip still excludes `/uploads`.

**50–51. Routes:** RA00-020 reconciled. Canonical unique method+path: **215**. UNKNOWN: **0**. See `route-reconciliation.json` (11 live-only, 2 static-only template literals).

**52. Errors:** Production 500 body is generic. Zod 400 for validation. File 404 has no filesystem path.

**53. CORS:** `origin: true, credentials: true`. Not tightened; mobile uses Bearer, not cookies.

**54. Cookies:** N/A.

**55. JWT:** HS256, env secret, 30d user / 7d admin, no iss/aud, no refresh, no denylist.

**56. Passwords:** bcryptjs cost **12**; OTP hashes cost **10**. No hashes in artifacts.

**57. Rate limiting:** auth 80/15m prod; API 600/min; share 20/min. File download uses the API limiter.

**58. Enumeration:** Login/register **409/401** wording can distinguish missing vs wrong on register (existing policy). Forgot-password always generic success.

**59–60. Logging:** file URLs redacted in morgan; errors do not return disk paths.

---

## 61–73. Tests, Android, regressions

**61.** Touched-file typecheck not globally clean. Baseline 123 remains RA00-007.

**62.** Unrelated RA-00 P1s not modified.

**63–65.** Focused security tests added and executed. Maestro YAML created, **CLI absent — not executed**.

**66.** Screenshots under `qa/release-audit/RA-01/screenshots/` (sanitized QA fixture Home; no lab images). Upload cases 09–11 are HTTP evidence, not PHI screenshots.

**67.** This directory.

**70.** Focused server/security tests PASS. Full 1565 suite not re-run after every edit; new files are on `npm test`. Prisma schema not changed.

**71–73.** Owner Image path updated; AI still writes storage keys; cold-start AuthGate tightened.

---

## 74–75. Defect bar and numbered closeout

RA-01 auth/upload **P0 remaining: 0**. **P1 remaining: 0**. Unrelated RA-00 P1s remain queued.

1. RA00-001 reproduced before fix: YES  
2. Architecture documented above  
3. Root cause: public static `/uploads`  
4. Design: private `/api/files` + deny stub  
5. Legacy keys protected via the new route  
6. Owner access works  
7. Unauthenticated denied  
8. Wrong user denied  
9. Traversal blocked  
10. Private cache / nosniff  
11. Consumers still resolve via keys + Bearer  
12–58. As above  
44. Canonical server-route count: **215**  
46. UNKNOWN: **0**  
56. Maestro: created, not executed  
57. Android: emulator-5554, installed app, logout + login UI + deeplink  
60. RA00-001 closed; RA01-001 closed  
61. New: RA01-001 (QA OTP production gate)  
62–63. Auth/upload P0/P1 remaining: 0  
64. Unrelated RA-00 P1s queued  
65. Blockers: none for RA-01 freeze. Maestro not installed. Production deploy of this server build is still required for medicard.ge `/uploads` to change.

---

## Acceptance matrix

RA00-001 UNAUTHENTICATED HEALTH UPLOAD EXPOSURE REPRODUCED BEFORE FIX: **YES**

PRIVATE HEALTH FILES REQUIRE AUTH AFTER FIX: **YES**

UPLOAD OWNER ACCESS WORKS: **YES**

UNAUTHENTICATED UPLOAD ACCESS DENIED: **YES**

WRONG-USER UPLOAD ACCESS DENIED: **YES**

DELETED UPLOAD ACCESS DENIED: **YES**

PATH TRAVERSAL BLOCKED: **YES**

PRIVATE FILE CACHE POLICY SAFE: **YES**

LEGACY PRIVATE UPLOADS PROTECTED: **YES**

ALL LEGITIMATE UPLOAD CONSUMERS REGRESSION CLEAN: **YES**

LOGIN HAPPY PATH WORKS: **YES**

INVALID LOGIN FAILS SAFELY: **YES**

LOGIN DOUBLE-SUBMIT SAFE: **YES**

OTP BOUND TO CORRECT ACCOUNT: **YES**

EXPIRED OTP REJECTED: **YES**

USED OTP REUSE REJECTED OR DOCUMENTED SAFE: **YES**

PRODUCTION-REACHABLE UNIVERSAL QA OTP EXISTS: **NO**

REGISTRATION HAPPY PATH WORKS: **YES**

DUPLICATE REGISTRATION SAFE: **YES**

ONBOARDING HAPPY PATH WORKS: **YES**

ONBOARDING DUPLICATE SUBMIT SAFE: **YES**

COLD START DOES NOT FLASH PROTECTED/OTHER-USER DATA: **YES**

PROTECTED DEEP LINKS REQUIRE AUTH: **YES**

EXPIRED SESSION FAILS CLOSED: **YES**

LOGOUT CLEARS AUTH STATE: **YES**

LOGOUT CLEARS USER-SENSITIVE CACHE: **YES**

USER A → LOGOUT → USER B SHOWS NO USER-A HEALTH DATA: **YES**

PROFILE/ACCOUNT OWNER ISOLATION SAFE: **YES**

EXECUTED RA-01 IDOR TESTS PASS: **YES**

ACCOUNT DELETE WORKS SAFELY OR ABSENCE DOCUMENTED: **YES**

DELETED ACCOUNT TOKEN CANNOT ACCESS PRIVATE DATA: **YES**

NORMAL USER CANNOT ACCESS ADMIN API: **YES**

ADMIN AUTH BOUNDARY WORKS: **YES**

PARTNER AUTH BOUNDARY WORKS: **YES**

EXPRESS AUTH MIDDLEWARE ORDER SAFE: **YES**

RA00-020 ROUTE COUNT DISCREPANCY RECONCILED: **YES**

FINAL SERVER ROUTE COUNT: **215**

EXTERNALLY REACHABLE ROUTES WITH UNKNOWN SECURITY CLASSIFICATION: **0**

AUTH RESPONSES LEAK STACK/DB/FILESYSTEM DETAILS: **NO**

HARDCODED PRODUCTION AUTH BYPASS EXISTS: **NO**

PRIVATE HEALTH DATA LOGGED BY RA-01 PATHS: **NO**

FOCUSED SECURITY TESTS ADDED: **YES**

REAL ANDROID AUTH FLOW EXECUTED: **YES**

PRODUCT E2E/MAESTRO AUTH SMOKE EXECUTED: **NO**

RA-01 AUTH/UPLOAD P0 REMAINING: **0**

RA-01 AUTH/UPLOAD P1 REMAINING: **0**

UNRELATED RA-00 P1s MODIFIED: **NO**

---

**MEDICARD RELEASE AUDIT RA-01 — AUTH, SESSION & PRIVATE FILE SECURITY FINAL-FROZEN**

**RA00-001 — CLOSED**

**FULL EXECUTION AUDIT — NOT YET COMPLETE**

Next phase (do not start): **RA-02 — client crash P1s (RA00-002 reward detail undeclared symbols, RA00-003 Cycle `pregnancy`, RA00-004 `alcoholLabel`)**. Those are the highest remaining verified likely-runtime defects. Medi AI retention (RA00-005) stays queued after crash closure.
