# Pregnancy baby size & week-by-week visual guide — Phase 19 contract

**Status:** implementation contract for Cycle Phase 19. Phase 18 Pregnancy Mode Foundation remains FINAL-FROZEN.  
**Date:** 2026-09-09  
**App version:** mobile `42.0.0`  
**Dataset:** `PREGNANCY_WEEK_DATA_VERSION = 1.0.0`

This is educational presentation of **static, source-backed averages**. It is not diagnosis, not ultrasound biometry, and not an AI feature.

---

## Scope

In Pregnancy mode only, show:

- current completed gestational week (server-owned, Phase 18)
- approximate length and weight from the catalog
- familiar object comparison (analogy)
- editorial object illustration
- 2–4 short development facts
- week browsing and a week-detail screen

Out of scope: ultrasound input, kick counter, contraction timer, weekly diet/exercise, personalized “smaller/larger than expected”, OpenRouter/Medi facts, Notification Brain, partner sharing, doctor-summary fruit copy, calendar fruit icons, global Home fruit hero.

Phase 21 timeline deep-links to Week Detail. It must not copy length / weight / fruit / facts into timeline rows.

---

## Source policy

See `docs/PREGNANCY_BABY_SIZE_DATA.md`. One methodology per metric. Do not average blogs. Do not use `FETAL_SIZE_KA` in `cycle.js`.

Medical content updates bump `dataVersion` / `sourceVersion` / `reviewDate` without rewriting UI.

---

## Week numbering

Frozen Phase 18: `week = Math.floor(elapsed / 7)`, `day = elapsed % 7`.

**8 weeks + 6 days → catalog Week 8.** Mobile must not round independently.

Catalog range: completed weeks **1–40**. Weeks **1–3** informational (no size). Week **4** analogy only. Weeks **41–44** (still inside the 308-day active ceiling): show week-40 catalog + `beyondCatalog` and a neutral message. `reviewRequired` still hides size entirely.

---

## Measurement semantics

| `measurementType` | Meaning | Georgian label |
| --- | --- | --- |
| `CRL` | Crown–rump | სიგრძე (თავიდან საჯდომამდე) |
| `CHL` | Crown–heel | სიგრძე (თავიდან ქუსლამდე) |
| `null` | No length this week | omit length row |

Do not compare CRL and CHL numbers as if identical. Canonical weight is grams.

Copy must stay approximate: დაახლოებით / საშუალოდ. No “exactly 16.4 cm”. No “your baby is exactly a strawberry”.

---

## Comparison semantics

`comparisonKey` is an object id (`raspberry`), never a translated sentence. The object is a visual analogy, not a physical scale model, and not a clinical finding. Week 19 has no comparison.

---

## Static dataset architecture

One module: `mobile/src/lib/pregnancyWeekData.js`.

Server: `import { attachWeekDevelopment, weekDevelopmentForCompletedWeek } from '../../../mobile/src/lib/pregnancyWeekData.js'`.

Helpers:

- `weekDevelopmentForCompletedWeek(week)` — catalog only
- `attachWeekDevelopment(dating)` — uses **existing** `estimatedGestationalAge.week`

Mobile browsing uses the bundled catalog. It does not calculate gestational age.

---

## API / read model

`GET /api/cycle/pregnancy` (Pregnancy mode only, existing gate) may include:

```
weekDevelopment: {
  week, kind, comparisonKey, lengthCm, weightGrams, measurementType,
  developmentFactKeys, illustrationKey, beyondCatalog, dataVersion, sourceVersion, reviewDate
}
```

`week` in this object is the catalog week derived from the **already computed** Phase 18 week. No second dating function.

Optional `GET /api/cycle/pregnancy/weeks/:week` returns catalog for a requested integer week. It does not use the user’s reference date. TRACK/TTC must not fetch it.

`bundlePregnancyView` stays without fruit / `insight` (Phase 18 test).

---

## Visual assets

`mobile/assets/pregnancy-size/{comparisonKey}.webp` plus `placeholder.webp`.

Editorial object still-life, shared lighting and canvas, transparent/soft-neutral (no white JPEG box). Expo WebP. Card-scale (~512px), not 4K.

Preload current / previous / next only.

Fallback: placeholder + measurements. Do not hide the Pregnancy hero.

---

## UI

- Overview hero: mode → week/day → illustration → comparison → length/weight → CTA `ნახე ამ კვირის განვითარება`
- Week detail: `/cycle/week/[week]` (not `/cycle/pregnancy/week/` — `pregnancy.tsx` already redirects)
- Current: `თქვენ ახლა ხართ` + `ახლა`. Browsed: `მე-N კვირა`
- Compact milestone selector (not 40 buttons)
- Journal: compact `კვირის განვითარება` in `CyclePregnancyJournalSection`
- Calendar: no fruit on days
- Home: week/day only; no fruit (privacy)

Current vs browsed must never look the same. Future weeks are informational.

---

## Privacy / AI / partner / doctor / export / push

Pregnancy size is derived from sensitive pregnancy dating.

Do not add `weekDevelopment`, `comparisonKey`, `lengthCm`, `weightGrams`, `illustrationKey`, `developmentFactKeys` to:

- AI / Medi prompts
- partner payload
- analytics
- push
- doctor summary (stay clinical; no fruit)

Personal export: episode/reference only. Static catalog is product content, not user data.

No new Notification Brain campaigns.

---

## Offline / performance / a11y

Bundled catalog + illustrations work offline. Current week still comes from the existing pregnancy read model / cache. No new offline pregnancy engine.

Reduced motion: no bounce; optional crossfade only.

Image a11y: `{object} ილუსტრაცია — მე-N კვირის ზომის შედარება`.

Large text 1.0 / 1.3 / 1.6. Dark navy. Small screen 960×1800.

Disclaimer on week detail:

- ზომა და წონა საშუალო მაჩვენებლებია და შეიძლება განსხვავდებოდეს.
- განვითარება კვირიდან კვირამდე განსხვავდება.

---

## Tests

Dataset uniqueness, translations, assets, sane numerics. Server week boundaries 4/8/12/20/28/36/40, unsupported, current week matches `estimatedGestationalAge.week`, no client math. Dating and `buildPredictions` unchanged. TRACK/TTC do not fetch. Exit hides feature. Privacy leak keys include the new fruit fields.
