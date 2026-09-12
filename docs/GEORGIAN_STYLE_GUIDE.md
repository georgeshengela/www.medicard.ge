# Georgian product language — Medicard

Source of truth: `mobile/src/i18n/ka.ts`, plus satellite catalogs under `mobile/src/i18n/`. Push defaults live in both `mobile/src/lib/pushCopy.ts` and `server/src/lib/pushTemplates.js` and must stay aligned. Public legal pages rebuild from `scripts/privacy-source.md` / `scripts/terms-source.md` via `node scripts/build-legal-pages.mjs`.

This guide is verified against the live product voice. The localization audit is **not frozen**: Expo/visual QA of every screen has not been completed.

## Voice

Warm, calm, direct. Friendly without being childish. Prefer natural Georgian over English or Russian calques.

- Buttons: short verbs (`შეინახე` where the UI is an action; established infinitives like `შენახვა` may stay).
- Retry: `ხელახლა სცადე` on Cycle/Quest (`ka.common.retry`). Authentication uses `ka.auth.retry`: `ხელახლა სცადეთ`. Symptoms uses `ka.symptoms.retry`: `ხელახლა სცადეთ`.
- Load failure: `მონაცემები ვერ ჩაიტვირთა`.
- Network: `შეამოწმე ინტერნეტთან კავშირი` in shared `ka.common.networkError` (Cycle and other direct surfaces). Authentication uses `ka.auth.networkError`: `შეამოწმეთ ინტერნეტთან კავშირი`. Do not globally rewrite the shared keys.
- Shared API timeout (`ka.common.requestTimeout`) stays voice-neutral: `მოთხოვნა დროის ამოწურვის გამო შეწყდა.` Auth maps 408 to `ka.auth.requestTimeout`.
- Medical referral: `ექიმს მიმართე` when advice is personal; keep `მიმართეთ ექიმს` in clinician/legal reports.

Do not use English-style title case. Do not mix Cyrillic letters into Georgian words.

## Tone matrix (verified)

| Product area | Voice | Verified example |
| --- | --- | --- |
| Authentication | Formal (`თქვენ`, `-ეთ`) | `შედით ანგარიშში` · `აირჩიეთ პაროლის აღდგენის გზა` |
| Onboarding / assessment | Formal | `როგორ გსურთ, რომ Medi-მ მოგმართოთ?` · `როდის დაიბადეთ?` |
| Medi chat / companion | Direct (`შენ`) | `ჰკითხე Medi-ს` · `Medi-სთან საუბარი` |
| Cycle | Direct | `აღრიცხე შემდეგი მენსტრუაცია` · `ჰკითხე Medi-ს ციკლის შესახებ` | Frozen Phase 40 TRACK empty copy still uses `აღრიცხეთ` / `თქვენი` by contract — do not “fix” those strings. |
| Pregnancy care planner | Direct | `შენი ექიმის გეგმა შეიძლება განსხვავდებოდეს.` |
| Quest | Direct | `დღევანდელი მისია` |
| Medications | Mixed: titles often infinitive, bodies often formal | `მედიკამენტის დამატება` · `აირჩიეთ მედიკამენტის ფორმა` |
| Home | Formal | `ატვირთეთ ანალიზი` · `მოიწვიეთ კონსილიუმი` |
| Symptoms | Formal | `შეამოწმეთ სიმპტომები` · `ხელახლა სცადეთ` |
| Laboratory upload / studio | Formal | `გადაიღეთ ან აირჩიეთ ყველა გვერდი` · `ხელახლა სცადეთ` |
| Quota limit sheet | Formal | `აირჩიეთ უფრო მაღალი გეგმა` · `დაელოდეთ განახლებას` |
| Quota recovered sheet | Direct (Medi companion ping) | `ჰკითხე Medi-ს` |
| Notifications | Direct, first person | `არ დაგავიწყდეს შენი {name}` |
| Legal | Formal | `გარკვეული არასავალდებულო ფუნქციები შეიძლება დაეყრდნოს თქვენს თანხმობას.` |
| Shared errors (`ka.common.*`) | Direct | `ხელახლა სცადე` · `შეამოწმე ინტერნეტთან კავშირი` |
| Auth errors (`ka.auth.retry` / `ka.auth.networkError`) | Formal | `ხელახლა სცადეთ` · `შეამოწმეთ ინტერნეტთან კავშირი` |

Do not mix `შენ` and `თქვენ` in the same sentence. Do not switch address mid-journey (assessment stays formal from intro through complete). Frozen Phase 40 TRACK empty copy still uses `აღრიცხეთ` / `თქვენი` by contract — do not “fix” those strings.

## Latin brand inflection

Keep **Medi** and **Medicard** in Latin script. When Georgian grammar needs a case marker, hyphenate:

| Case | Form | Example |
| --- | --- | --- |
| Nominative subject | Medi | `Medi უკეთ დაგეხმარებათ` |
| Ergative | Medi-მ | `როგორ გსურთ, რომ Medi-მ მოგმართოთ?` |
| Genitive / dative | Medi-ს | `Medi-ს რჩევა` · `ჰკითხე Medi-ს` |
| Instrumental / with | Medi-თან | `საუბარი Medi-სთან` |
| Ablative / from | Medi-სგან | `Medi-სგან შეხსენება` |
| Benefactive | Medi-სთვის | `ერთი წუთი Medi-სთვის` |
| Locative | Medi-ში | `Medi-ში ჩაინიშნო` |

Never write `მედი`, `მედიმ`, or `მედისთან` for the product AI. Same hyphen rule for other Latin names when a Georgian suffix is required (`{name}-ის დროა`).

## Menstrual terminology (contextual)

Do **not** replace every English “period” with `მენსტრუაცია`.

| Meaning | Georgian |
| --- | --- |
| Menstrual bleeding / the menstrual event | `მენსტრუაცია` |
| The full cycle | `მენსტრუალური ციკლი` or product short `ციკლი` |
| Cycle phase | `ფაზა` |
| A general span of time (PMS window, usage period, “this period”) | `პერიოდი` is correct |
| Postpartum unclassified bleed | `სისხლდენა` (frozen) |

Example: notification `PMS-ის პერიოდი` keeps `პერიოდი`. Push `პერიოდი ახლოვდება` was the English *period* (menses) and must stay `სავარაუდო მენსტრუაცია`.

## Pregnancy first visit

Catalog key `care_first_booking_title`: `ორსულობის პირველი სამედიცინო ვიზიტი`.

This is the first antenatal contact, not an NHS “booking” loanword and not a vague `პირველი ვიზიტი`. Source notes may still mention NHS/NICE/WHO as references; the user-facing title must not assume a single national pathway.

## Contraceptive patch

Method enum `PATCH`: `კონტრაცეპტიული პლასტირი` (Cycle settings and clinician PDF). Do not shorten to `პლასტირი` in that picker — users would read it as a wound dressing.

## PCOS

Preferred full term: **პოლიკისტოზური საკვერცხეების სინდრომი**.

Use this in onboarding condition lists, Cycle settings, and the health-profile catalog. The acronym `PCOS` may appear on a compact advice card after the condition is already on the profile (`advicePcosTitle`). Never `ოვარიუმის კისტები`.

## Hydration levels 1–2

`hydrationLevel()` is **percent of the user’s water goal** (`ml / goal`), not a clinical exam:

- 5: ≥100% · 4: ≥75% · 3: ≥50% · 2: ≥25% · 1: <25%

The hydration hub is formal (`დალიეთ`, `თქვენი ჰიდრატაციის დონე`). Level 1–2 copy stays in that voice and talks about **goal progress**, not diagnosis.

| Level | Title | Body |
| --- | --- | --- |
| 2 | წყლის მიღება დაბალია | დღიური მიზნის მისაღწევად მეტი წყალი დალიეთ. |
| 1 | წყლის მიღება ძალიან დაბალია | დღიური მიზნის მისაღწევად დალიეთ წყალი ახლავე. |

Rationale: the app only knows intake versus the user’s goal. Do not use `დეჰიდრატაცია` or `კრიტიკული`. Do not claim the body “needs more fluid” or tell the user to monitor clinical symptoms from the percentage alone. Direct-address candidates (`დალიე…`) were rejected here because the surrounding hydration screens are formal.

## Smoking

`FORMER` = `ადრე ვეწეოდი` / `შევწყვიტე მოწევა`. Enum is only CURRENT / FORMER / NEVER. Occasional smoking is a **product-model gap**, not a copy bug.

## Glossary

| Concept | Preferred Georgian | Avoid |
| --- | --- | --- |
| Health record | სამედიცინო ჩანაწერი | მედიკალური რეკორდი |
| Laboratory result | ანალიზის შედეგი / მაჩვენებელი | ლაბ რეზულტატი |
| Reference range | ნორმის საზღვარი | რეფერენს რეინჯი |
| Medication | მედიკამენტი | წამალი as the product term |
| Dosage | დოზა / დოზირება | Cyrillic-mixed დозირება |
| Reminder | შეხსენება | რემაინდერი |
| Appointment | ვიზიტი | აპოინტმენტი, ბუკინგი |
| Optional | არასავალდებულო | არჩევითი |
| Privacy | კონფიდენციალურობა | პრივატულობა |
| Journal pane | დღიური | ჟურნალი (except legal “აუდიტის ჟურნალი”) |
| Insight | რჩევა / დაკვირვება | ინსაითი |
| Former smoker | ადრე ვეწეოდი | ხანდახან / ზოგჯერ |
| Cravings | საკვების ლტოლვა | კრავინგი |
| Chills | შეცივება | შეარყუნება |
| Drug interaction | ურთიერთქმედება | ურთიერთობა, გავლენა as the product term |
| Sync | სინქრონიზაცია | სინქრონი, სინქრონს |
| Retry | ხელახლა სცადე / ხელახლა სცადეთ | სცადეთ თავიდან |
| Evidence verb | ადასტურებს / აფასებს | ასკვნის |
| Medi Run target | სამიზნე | პინი, პინს დაგისვამს |

## Lab name alignment

`ka.lab.align*`: Medi maps multilingual analyte names onto one catalog so old and new dates share a chart. User-facing verb is `დაკავშირება` (`დააკავშირებს`, `დააკავშირეთ`). Do not say Medi “fixes languages”.

## Medication interactions

Formal journey. Use `ურთიერთქმედება` and `შესაძლო რისკი`. Screen title is `მედიკამენტების ურთიერთქმედება`, not `უსაფრთხოება`. AI may look for possible interactions; it does not confirm that medicines are safe.

## Weight pace

Medi recommends a pace (`ტემპს გირჩევთ`) and calculates an estimated date (`სავარაუდო ვადას ითვლის`) from the profile. Do not say the recommended pace is already “calculated”. Do not call that pace `უსაფრთხო`. Do not use `გამძლე` for a pace (that adjective is for durable objects). Prefer `შენარჩუნება უფრო მარტივია`.

## Location

Location is for determining the user’s city (shown on the profile) and local weather. Reverse-geocode may also store country, but permission copy does not claim medical personalization or “smarter” advice.

## Symptom finding bar

The composer bar is **completeness of entered symptoms**, not diagnostic accuracy. Client: `28 + 12×symptomCount`. Server fallback adds body-part and notes. Prompt: more detail → higher `findingScore`. Label: `მონაცემების სისრულე`. Never `სიზუსტე`.

## Medi is not a doctor

User-facing copy must not call Medi an `AI ექიმი`. Chat CTAs: `ჰკითხეთ Medi-ს` (formal) / `ჰკითხე Medi-ს` (direct) / `Medi-სთან საუბარი`. Internal API mode `DOCTOR` and route `/chat/doctor` may stay.

## Assessment name

Formal: `ამ სახელით Medi მოგმართავთ.` Do not say “the app” addresses the user.

## Medi Run

Direct. The map target is `სამიზნე`. GPS is for route and distance, not “so Medicard can see you on the map”.

## Preserve as-is

Medicard, Medi (never მედი), Gemini, EvidenceMD, Ling Sante, HealthKit, Health Connect, QR, AI, API, OPK, BBT, LH, PMS, TTC, BMI, GBS, NIPT, WHO, NHS, NICE, ACOG.

## Medical safety

Never present an estimate as a confirmed finding. Keep `სავარაუდო`, `შეფასება`. Do not invent clinical advice. Do not label a goal-ratio band as a diagnosis. Do not promise that data is “always protected”, that AI guarantees medication safety, or that a weight-change pace is clinically safe. Sex and age inform lab reference ranges and personal estimates — Medicard does not calculate medication dosages from them. Assessment score badges show `ნდობა`, not `სიზუსტე`.
