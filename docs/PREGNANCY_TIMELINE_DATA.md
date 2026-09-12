# Pregnancy timeline milestone sources — Phase 21

**Dataset:** `cycle.pregnancy-timeline.v1`  
**Review date:** 2026-09-10  
**Source set:** `who-nhs-acog-williams-2026`  
**Week numbering:** Phase 18 completed weeks (`floor(elapsed/7)`).

Educational calendar markers. Not a personal prenatal schedule. Not diagnosis.

Trimester bands (NHS week-number / Phase 18): T1 0–12, T2 13–26, T3 27+.

| id | week | range | category | summary | source | URL / citation | review | notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `early_calendar` | 4 | — | `PREGNANCY_STAGE` | Early pregnancy calendar already counts from the reference date; does not confirm pregnancy. | NHS week-by-week | https://www.nhs.uk/pregnancy/week-by-week/ | 2026-09-10 | Calendar language only. |
| `heart_activity` | 6 | — | `GENERAL_DEVELOPMENT` | Cardiac tube typically begins rhythmic contraction around this time; timing varies. | ACOG, How Your Fetus Grows During Pregnancy | https://www.acog.org/womens-health/faqs/how-your-fetus-grows-during-pregnancy | 2026-09-10 | Not a heartbeat diagnostic. |
| `embryonic_period` | 8 | — | `GENERAL_DEVELOPMENT` | Embryonic period typically around these weeks; calendar description only. | Williams Obstetrics, 26th ed. | textbook (no public URL) | 2026-09-10 | Not confirmation of development. |
| `t1_end` | 12 | — | `PREGNANCY_STAGE` | First trimester typically ends at the end of week 12 **on this convention**. | NHS Start for Life week-by-week guide | https://www.nhs.uk/start-for-life/pregnancy/week-by-week-guide-to-pregnancy/ | 2026-09-10 | Clinical cutovers may differ. |
| `t2_start` | 13 | — | `PREGNANCY_STAGE` | Second trimester typically begins at week 13 on this convention. | NHS Start for Life | same as above | 2026-09-10 | Week 13 is T2 here, matching Phase 18. |
| `movement_window` | 16 | — | `MATERNAL_CHANGE` | Movement is sometimes noticed around these weeks; timing varies. | NHS week-by-week | https://www.nhs.uk/pregnancy/week-by-week/ | 2026-09-10 | Not symptom interpretation of the current day. |
| `anatomy_scan` | 18 | 18–21 | `CLINICAL_WINDOW` | Anatomy / anomaly ultrasound is commonly scheduled around 18–21 weeks. | NHS 20-week scan | https://www.nhs.uk/pregnancy/your-pregnancy-care/20-week-scan/ | 2026-09-10 | Informational window, not a booking. |
| `calendar_mid` | 20 | — | `PREGNANCY_STAGE` | Midpoint of a 40-week **calendar** only. | NHS trimester bands + 40-week calendar | NHS Start for Life | 2026-09-10 | Explicitly not “50% developed”. |
| `glucose_screen` | 26 | 24–28 | `CLINICAL_WINDOW` | Glucose screening is often discussed around 24–28 weeks. | ACOG gestational diabetes FAQ | https://www.acog.org/womens-health/faqs/gestational-diabetes | 2026-09-10 | Pin at week 26; range 24–28. |
| `t3_start` | 27 | — | `PREGNANCY_STAGE` | Third trimester typically begins at week 27 on this convention. | NHS Start for Life | same trimester URL | 2026-09-10 | Not ACOG 28w0d. |
| `later_pregnancy` | 28 | — | `PREGNANCY_STAGE` | Later pregnancy on the calendar. Not an outcome forecast. | NHS week-by-week | https://www.nhs.uk/pregnancy/week-by-week/ | 2026-09-10 | Loss-sensitive wording. |
| `gbs_screen` | 36 | 36–37 | `CLINICAL_WINDOW` | Group B Strep screening is commonly scheduled around 36–37 weeks. | ACOG Group B Strep and Pregnancy | https://www.acog.org/womens-health/faqs/group-b-strep-and-pregnancy | 2026-09-10 | Informational window. |
| `estimated_term` | 40 | — | `PREGNANCY_STAGE` | End of the standard 40-week calendar. Due date remains estimated. | WHO antenatal care recommendations (2016); 40-week gestational calendar | https://www.who.int/publications/i/item/9789241549912 | 2026-09-10 | Never guaranteed. |

Skipped on purpose: viability, preterm-birth risk, overdue/alarm language, weekly fruit repeats, appointment checklists.
