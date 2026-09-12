# Admin V3 — Final Unification QA

Artifacts for the last visual/system cleanup before FINAL-FROZEN.

## Layout

- `screenshots/` — route matrix (1440 light/dark + width samples)
- `pass1/` / `pass2/` — two visual passes
- `contact-sheet-light.png` / `contact-sheet-dark.png`
- `live-report.json` / `live-report-recapture.json`
- `live-qa.mjs` / `recapture.mjs`

## How to re-run

From `server/`:

```bash
node scripts/_admin-v3-recapture.mjs
```

Requires Admin at `http://localhost:4000/admin`.

## Acceptance note

See final report in chat / `docs/admin-v3-css-migration.md` for CSS ownership.
Visible legacy fragments targeted in this pass: Push compose phone, ops mosaics, Rewards `ops-kpis`.
