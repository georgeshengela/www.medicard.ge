# Admin V3 Step 3.1 — Command Center visual rescue

Scope: `#/overview` only. Semantics from Step 3 are unchanged.

## CSS loading (proved)

Stylesheet order (live DevTools):

1. Noto Sans / Noto Sans Georgian
2. `admin.css?v=ops8`
3. `admin-v24.css?v=ops11`
4. `admin-v25.css?v=ops23`
5. `admin-v26.css?v=v26.9`
6. `admin-v3.css?v=v3.3` — 200, `text/css`, 18698 bytes
7. `command-center-v3.css?v=v3.32` — 200, `text/css`, 14766 bytes, contains `.v3-cc {`

V3 CSS was never missing. The raw look came from sparse surfaces plus legacy `.ops-page` / `.ops-range` / `.ops-chart` winning on the Command Center root.

Cache: hard reload + cached reload both compute `.v3-cc-status` `border-radius: 12px`.

## Computed styles (1440 light, winning V3 rules)

| Element | Class | Key computed |
|---|---|---|
| Page header | `.v3-page-header` | `display:flex`; padding `14px 24px 12px`; bg `#F4F5F6` |
| Operating status | `.v3-cc-status.is-attention` | `display:flex`; padding `10px 14px`; radius `12px`; warm 7% warn tint |
| Attention row | `.v3-cc-alert` | `display:grid`; padding `10px 4px`; radius `0` (row, not card) |
| Today metric | `.v3-cc-metric` | `display:grid`; min-height `72px`; padding `2px 14px`; no card chrome |
| Chart plot | `.v3-cc-plot` | `min-height:188px`; padding `8px 4px 4px`; radius `10px`; plot surface |
| Section | `#ops-today .v3-section` | `display:grid`; gap `10px`; no extra card |
| Button | `.v3-cc .btn` | radius `8px`; min-height `32px`; font `12.5px` |
| Filter bar | `.v3-filterbar.ops-range` | `display:flex`; padding `3px`; radius `10px`; white surface; **no V26 pill shadow** |

Dark 1440 status: navy-mixed warn surface, plot `#111827`, filter `#1F2937`.

## Screenshot iteration

### Pass 1 findings

CSS applied, but the page still felt unfinished: chart looked empty on full-page shots, Brain read as a number dump, attention CTA mashed (`ბოლო 24სთ · 3 Medi →`), dark surfaces too close to the canvas, movement 4-across cramped in the side column, status a bit peachy, section gaps heavy.

### Pass 2 fixes

Tighter status, darker dark surfaces, funnel `→` + dashed `is-thin` drop, chart dots, movement 2×2 in the split, attention value split from CTA, `--cc-gap: 16px`.

### Pass 3 (after screenshot inspection)

Loading skeletons now match final geometry (title line + surface + split). 1280 no longer stacks at 1320 — two-column holds until 1100. Attention value is a tabular number; CTA is just `Medi →`.

## Visual acceptance

Yes for `#/overview` visual rescue. Next Admin V3 page should be Users. Do not implement it in this step.

Live machine: 2026-09-07, 3 Medi errors / 9 requests / 24h, Brain 17 840 → 13 725 scheduled → 2 delivered.
