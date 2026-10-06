# MEDICARD strategy deck (October 2026)

Georgian presentation: user feedback from 105 health and fitness apps, exercise and behaviour science,
Georgia's health and market data, the product plan (P1–P22, stop list S1–S12), the popularisation
strategy and the plan for developing MEDICARD. Output: `MEDICARD-strategy-2026.pdf` (1600×900, 91 slides).

Every statistic was checked twice against its source (244 key claims: 175 confirmed, 45 corrected,
24 removed). Targets, budgets and revenue ranges are planning assumptions and are labelled as such.

## Rebuild

```
node docs/strategy-2026/build-sources.mjs   # refs/*.json → parts/95-sources.html
node docs/strategy-2026/build.mjs           # parts/*.html → deck.html
node docs/strategy-2026/render.mjs deck.html MEDICARD-strategy-2026.pdf
```

`render.mjs` uses the preinstalled Playwright Chromium and prints a warning for any slide whose content
overflows. Slides are `<section class="slide">` blocks in `parts/` (sorted by file name), styled only by
`deck.css`; the allowed slide shapes are in `samples/components.html`. Fonts come from the repo
(Archy `mobile/assets/fonts`, FiraGO / Exo 2 / Davit `server/public/fonts`). Preview one part with
`node build.mjs --only parts/50-product.html --out _preview.html`.
