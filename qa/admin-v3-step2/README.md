# Admin V3 Step 2 — live QA

Operator chrome and shared interaction system. Page content (Command Center, Users, Rewards tables) was **not** redesigned.

## CSS precedence

`admin.css` → `admin-v24.css` → `admin-v25.css` → `admin-v26.css` → **`admin-v3.css` (last)**.

Old layers stay until pages migrate. V3 tokens and shell live in `admin-v3.css`. Helpers live in `admin-v3.js` (`window.AdminV3`), loaded last.

## How to run

From `server/`:

```bash
node scripts/_admin-v3-step2-qa.mjs
```

Requires Admin at `http://localhost:4000/admin`.

## Viewports

1280 / 1440 / 1920 × light + dark.

Representative shells: Overview, Users, Push, Rewards, Quality.

Also: login, palette, package drawer, user page, campaign/partner modal when present.

## Results (2026-09-07)

| Check | Result |
|---|---|
| Login | Works. Brand mark is **M**, not `+`. |
| 13 destinations | All render. Kickers match new IA. |
| Sidebar groups | Overview, People, Engagement, Health & Medi, Commerce, Operations, Production |
| Palette | Includes **ჯილდოები**. Grouped by new IA. |
| Package drawer | Opens |
| Partner create | Opens |
| User page | `#/users/:id` still a page, not a drawer |
| Theme / logout | Footer controls, aria-labels present |
| Page errors | **0** |
| Console errors | **0** |
| HTTP 4xx/5xx | **0** |
| Horizontal overflow | None at 1280 / 1440 / 1920 |
| New polling | None. Request mix matches Step 1 (login + existing analytics/list GETs). 6 viewport logins → 6× overview analytics. |

## Screenshots

- `{1280,1440,1920}-{light,dark}-{overview,users,push,rewards,quality}.png`
- `login-light.png`
- `1440-palette.png`
- `1440-package-drawer.png`
- `1440-user-page.png`
- `1440-campaign-modal.png` (if captured)

## Known leftover (not Step 2)

- Campaign create footer can still sit below the viewport (ADM-001).
- User Save is not sticky (later).
- Command Center / Rewards / Users content still uses old card density.
- Playwright `Control+K` is unreliable; palette opens via `renderCommandPalette()`. The in-page Ctrl/Cmd+K handler is unchanged.
