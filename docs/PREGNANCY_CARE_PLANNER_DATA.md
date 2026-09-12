# Pregnancy prenatal care planner — catalog data (Phase 32)

**Catalog version:** `prenatal-care-v1`  
**Reviewed at:** 2026-09-10  
**Source set:** `who-nhs-nice-acog-2026`  
**Code:** `mobile/src/lib/pregnancyCareCatalog.js`

Week numbers are Phase 18 **completed weeks** (inclusive windows). Timing is informational. Items are optional discussion/organization points, not required tests.

Removed future items: keep historical `PregnancyCarePlanItemState` rows in owner export; do not render obsolete guidance as current.

---

## Source audit (2026-09-10)

| ID | Organization | Title | URL |
|---|---|---|---|
| `src_who_anc_2016` | WHO | WHO recommendations on antenatal care for a positive pregnancy experience (2016) | https://www.who.int/publications/i/item/9789241549912 |
| `src_who_anc_news_2016` | WHO | New guidelines on antenatal care for a positive pregnancy experience (7 Nov 2016) | https://www.who.int/news/item/07-11-2016-new-guidelines-on-antenatal-care-for-a-positive-pregnancy-experience |
| `src_who_ultrasound_2022` | WHO | Maternal and fetal assessment update: imaging ultrasound before 24 weeks of pregnancy (2022) | https://www.who.int/publications/i/item/9789240046009 |
| `src_nhs_antenatal` | NHS | Your antenatal care and appointments | https://www.nhs.uk/pregnancy/your-pregnancy-care/your-antenatal-care-and-appointments/ |
| `src_nhs_12_scan` | NHS | 12-week scan | https://www.nhs.uk/pregnancy/your-pregnancy-care/12-week-scan/ |
| `src_nhs_20_scan` | NHS | 20-week scan | https://www.nhs.uk/pregnancy/your-pregnancy-care/20-week-scan/ |
| `src_nhs_gbs` | NHS | Group B strep | https://www.nhs.uk/pregnancy/your-pregnancy-care/group-b-strep/ |
| `src_nhs_vaccinations` | NHS | Pregnancy vaccinations | https://www.nhs.uk/pregnancy/keeping-well/vaccinations/ |
| `src_nice_ng201` | NICE | Antenatal care (NG201) | https://www.nice.org.uk/guidance/ng201 |
| `src_acog_path_2025` | ACOG | Tailored Prenatal Care Delivery for Pregnant Individuals (April 2025) | https://www.acog.org/clinical/clinical-guidance/clinical-consensus/articles/2025/04/tailored-prenatal-care-delivery-for-pregnant-individuals |
| `src_acog_gdm` | ACOG | Gestational Diabetes | https://www.acog.org/womens-health/faqs/gestational-diabetes |
| `src_acog_gbs` | ACOG | Group B Strep and Pregnancy | https://www.acog.org/womens-health/faqs/group-b-strep-and-pregnancy |
| `src_acog_screening` | ACOG | Prenatal Genetic Screening Tests | https://www.acog.org/womens-health/faqs/prenatal-genetic-screening-tests |

WHO 2016: ≥8 contacts at ≤12, 20, 26, 30, 34, 36, 38, 40 weeks — used as **milestone windows**, not a rigid visit cadence (ACOG PATH 2025: visit frequency individualized).

---

## V1 items

| id | category | weeks | regionalVariation | sources |
|---|---|---|---|---|
| `first_booking` | APPOINTMENT | 0–12 | no | WHO ANC 2016/news, NHS antenatal, ACOG PATH |
| `first_trimester_labs` | LAB | 0–12 | no | NHS antenatal, NICE NG201, WHO ANC |
| `dating_ultrasound` | ULTRASOUND | 10–14 | yes | NHS 12-week scan, NICE NG201, WHO US 2022 |
| `aneuploidy_screening_discussion` | SCREENING | 10–16 | yes | ACOG screening, NHS 12-week, NICE NG201 |
| `anatomy_ultrasound` | ULTRASOUND | 18–22 | yes | NHS 20-week, NICE NG201, ACOG PATH |
| `gdm_screening_discussion` | SCREENING | 24–28 | yes | ACOG GDM, NHS antenatal, NICE NG201 |
| `blood_group_rh_review` | LAB | 26–30 | yes | NHS antenatal, NICE NG201 |
| `vaccination_discussion` | VACCINATION_DISCUSSION | 16–36 | yes | NHS vaccinations, WHO ANC |
| `third_trimester_followup` | APPOINTMENT | 28–40 | yes | WHO ANC 2016/news, ACOG PATH |
| `gbs_screening_discussion` | SCREENING | 35–38 | **yes (must)** | ACOG GBS, NHS GBS (NHS: not routine) |
| `birth_planning` | BIRTH_PLANNING | 28–40 | no | NHS antenatal, NICE NG201 |
| `postpartum_newborn_prep` | EDUCATION | 32–40 | no | NHS antenatal, WHO ANC |

Fail closed: missing organization / title / reviewedAt / url → item is not rendered.

---

## Regional variation decisions

- Dating US: NHS ~11–14 vs WHO any scan before 24 weeks.
- Aneuploidy / NIPT: offered/discussed; availability varies. Framed as screening, not required, not diagnostic.
- Anatomy: NHS commonly 18–21; ACOG ~18–22. Conservative union 18–22.
- GDM: US often offered 24–28; NHS/NICE more risk-based. Discussion only; no result/treatment.
- Rh review: educational blood-group/Rh discussion. **No anti-D instruction.**
- Third-trimester follow-up: WHO later contacts as a **window**, not every-2-weeks.
- GBS: US commonly offered late pregnancy; **NHS not routinely tested**.
- Vaccination: **discussion only** — no deterministic vaccine timing/prescription.

---

## Risk-dependent exclusions

Not in V1: extra growth scans, specialist referral pathways, aspirin/preeclampsia prophylaxis, GDM treatment, twin/multiple schedules, age-based NIPT mandates, kick counts.

---

## Medication exclusions

No aspirin, iron, folic-acid dosing, insulin, antibiotics, anti-D, or supplements in the catalog.
