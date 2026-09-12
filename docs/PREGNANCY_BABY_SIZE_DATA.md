# Pregnancy baby size — data provenance

**Dataset version:** `1.0.0`  
**Source version:** `hadlock1992-who2017-williams-chl`  
**Review date:** 2026-09-09  

Educational averages for gestational **completed weeks**. Not ultrasound results. Not a diagnosis. Values are not averaged across websites.

Week numbering matches Phase 18: `week = floor(elapsedDays / 7)`, `day = elapsedDays % 7`. Same civil day = 0w+0d. **8 weeks + 6 days → catalog week 8.**

---

## Sources

| Role | Source | Reference | Convention | Access |
| --- | --- | --- | --- | --- |
| CRL 5–18 | Hadlock 1992, CRL-by-GA table | Hadlock FP, Shah YP, Kanon DJ, Lindsey JV. Fetal crown-rump length: reevaluation of relation to menstrual age (5–18 weeks) with high-resolution real-time US. *Radiology*. 1992;182(2):501–505. Table as reprinted in Hologic *Obstetrical References*, “CRL by GA – Hadlock1992”. | LMP / menstrual age. Length is **crown–rump (CRL)**, cm. | 2026-09-09 |
| Weight 14–40 | WHO Fetal Growth Charts | Kiserud T, Piaggio G, Carroli G, et al. The World Health Organization Fetal Growth Charts. *PLoS Med*. 2017;14(1):e1002220. **Table 11**, 50th percentile, sexes combined. https://doi.org/10.1371/journal.pmed.1002220 | Gestational weeks 14–40. Estimated fetal weight (grams). | 2026-09-09 |
| CHL 20–40 | Williams Obstetrics teaching table | Classic LMP crown–heel length anchors at 20, 24, 28, 32, 36, 40 weeks (25 / 30 / 35 / 40 / 45 / 50 cm). Linear interpolation **only between those anchors**, whole cm. | LMP. Length is **crown–heel (CHL)**, cm. | 2026-09-09 |
| Development events | Moore / Langman embryology, mapped LMP | Moore KL, Persaud TVN, Torchia MG. *The Developing Human*. Fertilization-age events mapped as **LMP week ≈ embryonic week + 2**. Conservative phrasing only. | LMP display weeks. | 2026-09-09 |
| Development events | NHS week-by-week (timing check) | NHS “You and your pregnancy” week pages (LMP). Used to confirm timing, not to copy consumer metaphors. | LMP weeks. | 2026-09-09 |

Not used for measurements: Moore/Langman Table 7.1 (fertilization age, ~+2 vs LMP), random pregnancy blogs, unused `FETAL_SIZE_KA` in `cycle.js`.

---

## Measurement rules

| Weeks | Length | Weight | Comparison |
| --- | --- | --- | --- |
| 1–3 | none | none | none (informational) |
| 4 | none | none | poppy seed **analogy only** |
| 5–18 | Hadlock CRL, 1 decimal cm | none until 14; WHO from 14 | object analogy |
| 19 | **omitted** (do not interpolate CRL→CHL) | WHO 272 g | none |
| 20–40 | Williams CHL, whole cm | WHO 50th | object analogy |
| 41–44 (active ceiling) | week-40 catalog + `beyondCatalog` | same | week-40 object |

Canonical weight is always grams. UI may show kg at ≥1000 g (one decimal).

Object comparisons are **friendly analogies after** the medical number. They are not measurements.

---

## Week table

Hadlock display = 1-decimal rounding of the published CRL-by-GA values. WHO 50th = Table 11 column “50”. Williams CHL = interpolated whole cm.

| Week | Length | Type | Weight (g) | Comparison | Length source | Weight source | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | — | — | — | — | — | — | Informational |
| 2 | — | — | — | — | — | — | Informational |
| 3 | — | — | — | — | — | — | Informational |
| 4 | — | — | — | poppy_seed | — | — | Analogy only |
| 5 | 0.2 | CRL | — | sesame | Hadlock 0.222 cm | — | |
| 6 | 0.5 | CRL | — | sesame | Hadlock 0.458 cm | — | |
| 7 | 0.9 | CRL | — | blueberry | Hadlock 0.853 cm | — | |
| 8 | 1.4 | CRL | — | raspberry | Hadlock 1.447 cm | — | No invented ~1 g |
| 9 | 2.3 | CRL | — | raspberry | Hadlock 2.256 cm | — | |
| 10 | 3.3 | CRL | — | strawberry | Hadlock 3.259 cm | — | |
| 11 | 4.4 | CRL | — | lime | Hadlock 4.406 cm | — | |
| 12 | 5.6 | CRL | — | lime | Hadlock 5.622 cm | — | |
| 13 | 6.8 | CRL | — | lemon | Hadlock 6.833 cm | — | |
| 14 | 8.0 | CRL | 90 | kiwi | Hadlock 7.983 cm | WHO 50th | |
| 15 | 9.0 | CRL | 114 | kiwi | Hadlock 9.045 cm | WHO 50th | |
| 16 | 10 | CRL | 144 | avocado | Hadlock 10.03 cm | WHO 50th | |
| 17 | 11 | CRL | 179 | pear | Hadlock 10.983 cm | WHO 50th | |
| 18 | 12 | CRL | 222 | mango | Hadlock 11.983 cm | WHO 50th | |
| 19 | — | — | 272 | — | CRL/CHL switch | WHO 50th | No interpolated length |
| 20 | 25 | CHL | 330 | banana | Williams anchor | WHO 50th | |
| 21 | 26 | CHL | 398 | banana | Williams interp. | WHO 50th | |
| 22 | 28 | CHL | 476 | banana | Williams interp. | WHO 50th | |
| 23 | 29 | CHL | 565 | banana | Williams interp. | WHO 50th | |
| 24 | 30 | CHL | 665 | coconut | Williams anchor | WHO 50th | |
| 25 | 31 | CHL | 778 | coconut | Williams interp. | WHO 50th | |
| 26 | 33 | CHL | 902 | coconut | Williams interp. | WHO 50th | |
| 27 | 34 | CHL | 1039 | coconut | Williams interp. | WHO 50th | |
| 28 | 35 | CHL | 1189 | eggplant | Williams anchor | WHO 50th | |
| 29 | 36 | CHL | 1350 | eggplant | Williams interp. | WHO 50th | |
| 30 | 38 | CHL | 1523 | pineapple | Williams interp. | WHO 50th | |
| 31 | 39 | CHL | 1707 | pineapple | Williams interp. | WHO 50th | |
| 32 | 40 | CHL | 1901 | pineapple | Williams anchor | WHO 50th | |
| 33 | 41 | CHL | 2103 | pineapple | Williams interp. | WHO 50th | |
| 34 | 43 | CHL | 2312 | pineapple | Williams interp. | WHO 50th | |
| 35 | 44 | CHL | 2527 | pineapple | Williams interp. | WHO 50th | |
| 36 | 45 | CHL | 2745 | watermelon | Williams anchor | WHO 50th | |
| 37 | 46 | CHL | 2966 | watermelon | Williams interp. | WHO 50th | |
| 38 | 48 | CHL | 3186 | watermelon | Williams interp. | WHO 50th | |
| 39 | 49 | CHL | 3403 | watermelon | Williams interp. | WHO 50th | |
| 40 | 50 | CHL | 3617 | watermelon | Williams anchor | WHO 50th | |

Discrepancy handled: week 19 has WHO weight but no length, because mixing CRL and CHL as one series would be false precision.

Canonical module: `mobile/src/lib/pregnancyWeekData.js` (imported by the server; not duplicated).
