# Cycle doctor-summary i18n — Phase 15

**Status:** Clinician locale rendering for the frozen Phase 14 doctor summary.  
**Locales:** `ka` · `en` · `fr` · `ru`  
**Catalog:** `mobile/src/i18n/cycle/doctorSummary.js`  
**Renderer:** `mobile/src/lib/cycleDoctorSummaryI18n.js`

This is not a new translation platform. It follows the Quest `{ ka, en, fr, ru }` catalog pattern.

---

## Locale source

The app has no global language preference. Quest still calls `questLocaleFromTag('ka')`.

Doctor summary adds a **document-scoped** language control on `/cycle/summary` (KA / EN / FR / RU chips). Default `ka`. Switching language:

- does not persist
- does not change app-wide language
- does not enable fertility / sexual / notes toggles
- does not change the server payload or date range

Do not invent locale from device region.

There is **no app-wide report-language architecture**. Other documents stay Georgian. This chip row is document-scoped only.

Server stays language-neutral: keys, dates, enum values. No `lang` query param. One renderer — not `buildFrenchDoctorSummary`.

---

## Namespaces

Strings: title, report title, inclusion copy, section headings, disclaimer, PDF actions, duration helpers.

Enums:

- `flow` spotting / light / medium / heavy
- `painType` cramps pelvic lower_back headache breast ovulation_side other
- `painSeverity` mild moderate severe
- `energy` very_low … very_high
- `sleep` poor okay good (subjective quality)
- `stress` low medium high
- `mucus` dry sticky creamy watery eggwhite
- `testResult` negative positive unclear
- `contraception` same keys as Cycle settings
- `symptom` Phase 14 INCLUDE physical symptoms
- `sexual` opt-in sexual observation keys
- `pregnancyReference` `LMP` · `USER_SELECTED` (Phase 20)

Unknown pregnancy reference type: never print the raw key. Use the generic localized “user-selected reference” label and keep the civil date when present.

---

## Fallback

Unknown locale → `ka`.  
Unknown enum → omit the row (never print the internal key).  
Tests require full key coverage in all four locales.

---

## Dates and plurals

Civil dates only. Georgian month names match `formatCycleDateKa`. EN uses `en-GB` (9 September 2026). FR: 9 septembre 2026. RU: 9 сентября 2026. `generatedAt` uses the `YYYY-MM-DD` prefix.

EN/FR: 1 vs n. RU: день/дня/дней, цикл/цикла/циклов, and неделя/недели/недель. KA: `დღე` / `ციკლი` / `კვირა`.

Gestational age: `{weeks} + {days}` (1 week / 2 weeks; 1 неделя / 2 недели / 5 недель / 21 неделя).

---

## Phase 20 — Pregnancy header labels

Clinician, not marketing. Never “Pregnant” / “Confirmed pregnancy”.

| Key | KA | EN | FR | RU |
|---|---|---|---|---|
| pregnancyContextTitle | ორსულობის მიმდინარე აღრიცხვის კონტექსტი | Current pregnancy tracking context | Contexte actuel de suivi de grossesse | Текущий контекст наблюдения за беременностью |
| pregnancyAlwaysOn | ორსულობის აღრიცხვის კონტექსტი | Pregnancy tracking context | Contexte de suivi de grossesse | Контекст наблюдения за беременностью |
| pregnancyTrackingMode | ორსულობის აღრიცხვის რეჟიმი | Pregnancy tracking mode | Mode de suivi de grossesse | Режим наблюдения за беременностью |
| pregnancyTrackingModeValue | ორსულობის აღრიცხვა | Pregnancy tracking | Suivi de grossesse | Наблюдение за беременностью |
| pregnancyDatingReference | დათარიღების საცნობი | Dating reference | Date de référence | Дата отсчёта |
| pregnancyEstimatedAge | სავარაუდო გესტაციური ასაკი | Estimated gestational age | Âge gestationnel estimé | Расчётный срок беременности |
| pregnancyEstimatedDue | სავარაუდო მშობიარობის თარიღი | Estimated due date | Date prévue d’accouchement | Предполагаемая дата родов |
| pregnancyReviewRequired | საცნობი თარიღი გადასახედია | Dating reference requires review | La date de référence doit être vérifiée | Дата отсчёта требует проверки |

Server remains language-neutral. Locale chips localize this header. Inclusion is not locale-driven.

---

## Tests

`mobile/src/lib/cycleDoctorSummaryI18n.test.js` — key coverage, enum coverage, civil dates, pluralization, payload parity, default/fertility/private HTML, mixed-language guard, AI/partner/export/engine firewalls.

HTML artifacts: `qa/cycle-phase15-locale/00-report-*-default.html`, `00-report-fr-fertility.html`, `00-report-fr-private.html`.

Phase 20 pregnancy reports: `qa/cycle-phase20-doctor-pregnancy/`.

---

## Phase 25 — Perimenopause header labels

Clinician, not diagnosis. Never “patient is perimenopausal” / “confirmed menopause”.

| Key | KA | EN | FR | RU |
|---|---|---|---|---|
| perimenopauseContextTitle | მიმდინარე აღრიცხვის კონტექსტი | Current tracking context | Contexte actuel de suivi | Текущий контекст отслеживания |
| perimenopauseAlwaysOn | პერიმენოპაუზის აღრიცხვის კონტექსტი | Perimenopause tracking context | Contexte de suivi de la périménopause | Контекст отслеживания перименопаузы |
| perimenopauseTrackingModeValue | მომხმარებლის მიერ არჩეული რეჟიმი: პერიმენოპაუზის თვალყური | Perimenopause tracking mode selected by user | Mode de suivi sélectionné par l’utilisatrice : périménopause | Выбранный режим отслеживания: перименопауза |

Renderer never prints `PERIMENOPAUSE`. Interval range copy is factual (“ranged from 24 to 46 days”) with a source-window count. HTML artifacts: `qa/cycle-phase25-doctor-perimenopause/`.

---

## Phase 39 — Postpartum header labels

Clinician tracking context, not a birth/delivery claim and not a recovery diagnosis. Never “days since birth”, “date d'accouchement”, or “дата родов”.

| Key | KA | EN | FR | RU |
|---|---|---|---|---|
| postpartumContextTitle | მშობიარობის შემდგომი აღრიცხვის კონტექსტი | Current postpartum tracking context | Contexte actuel de suivi post-partum | Текущий контекст послеродового отслеживания |
| postpartumTrackingModeValue | მშობიარობის შემდგომი თვალყური | Postpartum tracking | Suivi post-partum | Послеродовое отслеживание |
| postpartumReferenceLabel | პაციენტის მითითებული საწყისი თარიღი | Reference date entered by the patient | Date de référence saisie par la patiente | Дата отсчёта, указанная пациенткой |
| postpartumElapsedLabel | მითითებული თარიღიდან გასული დრო | Time since entered reference date | Temps écoulé depuis la date de référence saisie | Время с указанной даты отсчёта |

Renderer never prints `POSTPARTUM`. Missing reference: localized “not provided”, no fake 0 weeks. HTML artifacts: `qa/cycle-phase39-postpartum-doctor/`.

