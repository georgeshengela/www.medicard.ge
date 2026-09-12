# Admin V3 Step 3 — Command Center QA

Operator-first `#/overview`. Other Admin pages were not redesigned.

## How to run

From `server/`:

```bash
node scripts/_admin-v3-step3-qa.mjs
```

Requires Admin at `http://localhost:4000/admin`.

## Screenshot index

| File | Viewport | Theme | Range | Data source | Proves |
|---|---|---|---|---|---|
| `01-overview-light-1280.png` | 1280×900 | light | 7d · Asia/Tbilisi | live local Admin | Status + attention + Today above the fold; no horizontal overflow |
| `02-overview-light-1440.png` | 1440×900 | light | 7d · Asia/Tbilisi | live local Admin | Primary visual benchmark, full page |
| `03-overview-light-1920.png` | 1920×900 | light | 7d · Asia/Tbilisi | live local Admin | Content width stays controlled; chart does not stretch absurdly |
| `04-overview-dark-1440.png` | 1440×900 | dark | 7d · Asia/Tbilisi | live local Admin | Dark navy, readable status/warn/muted |
| `05-status-healthy.png` | 1440 | light | n/a | injected healthy chrome | Healthy badge + compact copy (live dataset currently has AI errors) |
| `06-status-attention.png` | 1440 | light | 7d | live | Real attention: 3 AI errors / 24h |
| `07-attention-list.png` | 1440 | light | 7d | live | Actionable attention row + Medi destination |
| `08-today.png` | 1440 | light | n/a (today) | live | აქტიური დღეს / ახალი დღეს / AI შეცდომა · 24სთ |
| `09-brain-summary.png` | 1440 | light | 7d | live | Funnel + დაგეგმილი + rates with denominators |
| `10-activity.png` | 1440 | light | 7d | live | Compact DAU chart + grain control |
| `11-retention.png` | 1440 | light | lifetime cohort | live | D1 small-n honesty; D7/D30 insufficient |
| `12-partial-error.png` | 1440 | light | n/a | injected Brain section error | Section-level error + retry; rest of page remains |

## Notes

- Live dataset on 2026-09-07: 3 Medi errors in last 24h / 9 requests → **attention**, not healthy.
- Feature share-of-active rendered at 50% / 0%. No value above 100%.
- Request count: **7 → 6** GETs on Command Center load (`/analytics/medi` dropped). Grain change is 1 GET. Live poll is `/system/health` only.
- `05` and `12` are injected presentation states. All other shots are live data.
