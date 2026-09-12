# RA-00 Release audit execution plan

RA-00 is discovery. Nothing below has been execution-tested except existing unit suites listed in `test-execution.json`.

Cycle Phases 1–42 remain **FINAL-FROZEN**. Later phases may test frozen behavior; they must not “fix” it by redesign.

## Recommended order (risk-first)

Highest-risk discoveries are **unauthenticated uploads**, **auth/session**, **broken Rewards/Cycle UI bindings**, and **AI PHI persistence**. Therefore RA-01 is not a cosmetic Home pass.

| Phase | Scope | Why this order |
|-------|--------|----------------|
| **RA-01** | Auth, onboarding, session, account delete, QA OTP, **upload URL auth**, AuthGate cold start | P0 uploads + account takeover paths. Do not start RA-01 in this chat. |
| **RA-02** | Home + navigation + deep links + orphan routes | Confirms the map users actually walk |
| **RA-03** | Medi AI pipelines + data boundaries + disclaimer persistence | PHI to third parties; stored claims |
| **RA-04** | Labs extract/explain/align + camera/gallery | Medical files + AI |
| **RA-05** | Medications CRUD, taken/skip, reminders, timezone | Health-state mutations |
| **RA-06** | Cycle core TRACK (frozen) + log/offline + the RA00-003/004 crash candidates | Reproductive health; do not change frozen engine |
| **RA-07** | TTC / Pregnancy / Peri / Postpartum (frozen contracts) | Mode races, forecast gate, care planner |
| **RA-08** | Health metrics, steps, hydration, weight, HealthKit/Connect | Device + local storage |
| **RA-09** | Quest, Companion, achievements | Server-authoritative economy |
| **RA-10** | Rewards + partner (includes RA00-002 crash) | Value movement |
| **RA-11** | Notification Brain, local vs remote, prenatal exact-time, quiet hours | Includes failing engage unit test |
| **RA-12** | Profile, settings, permissions, privacy/terms | |
| **RA-13** | Reports, doctor PDF, cycle export/wipe, calendar export | Privacy allowlists |
| **RA-14** | Admin SPA + every admin mutation + capability ACL | Operator power |
| **RA-15** | Security/privacy adversarial: IDOR, share tokens, uploads, AI logs | Uses RA00-001/005/015 |
| **RA-16** | Offline, error states, double-tap, races | |
| **RA-17** | Performance (UI lists, N+1, unbounded queries) | Inventory only in RA-00 |
| **RA-18** | Full regression + store/build (typecheck, EAS, iOS deferred policy) | |

## What RA-01 must do first

1. Confirm production `GET /uploads/*` behavior and whether `MedicalRecord.imageUrl` is guessable.
2. Walk register → OTP → login → refresh/hydration → logout → delete account.
3. Verify QA OTP is **off** on production AppSettings.
4. AuthGate: unauthenticated, expired JWT, account switch, pending cycle share.
5. Do **not** implement upload auth in RA-01 unless that phase is explicitly a fix phase; RA-00 did not fix it.

## Coverage rule for later phases

A unit test is **not** interaction coverage. Every master-control-matrix row stays `auditStatus: NOT_RUN` until that control is actually exercised.
