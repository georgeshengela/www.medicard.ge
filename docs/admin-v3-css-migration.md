# Admin V3 CSS ownership — Final Unification

## Cascade (final order)

1. `admin.css` — base tokens + retained legacy helpers (invisible debt)
2. `admin-v24.css` — historical overlays (mostly neutralized on V3 roots)
3. `admin-v25.css` — historical overlays (Push/SMS/Pharmacy class names still in DOM)
4. `admin-v26.css` — historical overlays
5. `admin-v3.css` — V3 shell, tables, buttons, forms, toasts
6. `command-center-v3.css` — Overview / Command Center only
7. `v3/modules.css` — shared module surfaces (subnav, critical strip, login, settings)
8. `v3/unify.css` — **final visual kill-switch** for legacy DNA inside `.v3-module`

## Ownership by route

| Route | Primary ownership |
| --- | --- |
| Overview | `command-center-v3.css` + `admin-v3.css` |
| Users / user detail | `admin-v3.css` + `admin-users-v3.js` |
| Push | `v3/modules/push.js` + `unify.css` (compose preview) |
| Medi / Health | module wraps + `unify.css` |
| Orders / Packages / SMS / Pharmacy | module wraps + `unify.css` queue/panel rules |
| Rewards | `v3/modules/rewards.js` (no `ops-kpis`) + `unify.css` |
| Quality / Audit / Settings | dedicated V3 module renderers |
| Login | `modules.css` `.login-shell` |

## Retained legacy CSS (invisible debt)

- `admin.css` / v24–v26 remain loaded because class names still appear in DOM (`v25-*`, `.card-head`) and some non-module helpers.
- Visible appearance on V3 routes is forced by `unify.css` (includes justified `!important` to beat layered legacy).
- Full file deletion of v24/v25/v26 is **not** claimed — only visual neutralization.

## Removed / neutralized this pass

- Decorative push phone bezel/glow/island → compact `.v3-notif-preview`
- Rewards `ops-kpis` / `ops-card` → `.v3-critical-strip` / `.v3-panel`
- Orders 4-column mosaic → vertical `.v3-orders-queue`
- Legacy `window.prompt` code-import path neutralized in `rewards-admin.js` (V3 dialog owns import)

## !important policy

`v3/unify.css` uses `!important` only to override multi-year legacy specificity on migrated roots. Prefer removing legacy selectors later over adding more wars.
