# MEDIFAMILY — ოჯახის ჯანმრთელობა, დაწყება შვილით

Owner request 2026-10-12: one of the most important modules; far stronger, more refined, more functional and more
beautiful than MEDIVET. Research behind it: `docs/MEDIFAMILY-RESEARCH.md` (Georgian, ~140 sources; five tracks: competitor apps, parent needs, Georgian immunization calendar, feeding/growth/
development, pediatric AI safety + law).

## რას ვაკეთებთ (ერთი წინადადებით)

მშობელი ამატებს შვილს და ერთ ადგილას აქვს: საქართველოს აცრების კალენდარი ვადებით და შეხსენებებით, ზრდა ჯანმოს
(WHO) პერცენტილებით, ასაკზე მორგებული კვება და რჩევები, ავადობის დღიური (ტემპერატურა, სიმპტომი, წამალი) და Medi,
რომელიც ამ კონკრეტულ ბავშვს იცნობს და პედიატრივით პასუხობს — უფასოდ, რეკლამის გარეშე.

## რატომ მოიგებს (კვლევის მთავარი დასკვნები)

- **აცრების კალენდარი ვადებით არცერთ კომერციულ აპს არ აქვს.** ისინი აცრას მხოლოდ თავისუფალ ჩანაწერად ინახავენ;
  ვადა/გადაცილება/დაწევა მხოლოდ სახელმწიფო აპებშია (NHS, Bebbo — საქართველო Bebbo-ში არ არის).
- **ყველა ასაკი, ყველა შვილი.** ბაზარი 0–3 წელზეა აწყობილი; 0–18 უფასო ოჯახური ბარათი ცარიელი ნიშაა.
- **მშობლები ტოვებენ აპს** ფასიანი კედლის, რეკლამის, ორ მშობელს შორის არასინქრონის, მონაცემის დაკარგვის,
  ბევრი შეხების და შიშის მომგვრელი კონტენტის გამო. MEDICARD უფასოა და რეკლამის გარეშე — 1 და 4 მიზეზი თავიდანვე
  მოხსნილია; დანარჩენს დიზაინით ვხსნით.
- **შეხსენება მუშაობს:** Cochrane — RR 1.22 ბავშვთა აცრებზე; 2026 ავსტრალიის კვლევა — +29% დროული აცრა.
  საქართველოში პრობლემა უარი კი არა, **დაგვიანებაა** (დროულად აცრილი მხოლოდ 13%).
- **AI:** მშობლების 81% უკვე იყენებს AI-ს, ეშინიათ არასწორი რჩევის (52%). ამიტომ Medi-ს უსაფრთხოების ფენა
  დეტერმინისტულია: საშიში ნიშნები AI-ზე ადრე მოწმდება და AI-ს არ შეუძლია დონის დაწევა.

## მოდულის შემადგენლობა (v1 — ამ ეტაპზე)

1. **შვილის დამატება** (≤ 60 წამი): სახელი → დაბადების თარიღი → სქესი → დროულად დაიბადა? (თუ არა — კვირები) →
   სურვილისამებრ დაბადების წონა/სიგრძე → მშობლის თანხმობა (კანონი 3144, მუხ. 7(3)) → „აქამდე აცრები?“
   (ყველა გაკეთებულია / თავად მოვნიშნავ / არ ვიცი). რამდენიმე შვილი, ერთი შეხებით გადართვა.
2. **შვილის გვერდი (ჰაბი)** — ერთი გმირი-ბარათი (MEDIFAMILY-ის ფერი): სახელი, ზუსტი ასაკი (ნაადრევზე —
   კორექტირებული), დღის ერთი პასუხი (ვადაგადაცილებული აცრა → მოახლოებული → ცხელება → გაზომვის დრო → კვირის რჩევა),
   სწრაფი მოქმედებები: აცრა · გაზომვა · კვება · ტემპერატურა · Medi. ქვემოთ: აცრები, ზრდა, კვება, ამ ასაკში,
   ჯანმრთელობა.
3. **აცრები** — საქართველოს ეროვნული კალენდარი (ბრძანება №01-60/ნ, ბოლო ცვლილება №52/ნ 13.07.2023): ჰეპB,
   ბცჟ, ჰექსა ×3, პნევმო ×3, როტა ×2, წწყ ×2, დყატ/პ ×2, ტდ, აპვ ×2 (გოგო და ბიჭი 10–12). ეტაპები ასაკით,
   თითო დოზაზე სტატუსი (გაკეთებული · ახლა · მალე · გადაცილებული · ასაკი გავიდა), ერთი შეხებით „გაკეთდა“, თარიღი/
   კლინიკა/სერია/რეაქცია, ქართული დაწევის წესები (სერია არ იწყება თავიდან, როტა 24 კვირამდე, ბცჟ 12 თვემდე,
   ≥ 4 კვირა დოზებს შორის), დამატებითი ვაქცინები (ჩუტყვავილა, ჰეპ A, გრიპი, მენინგოკოკი, სხვა).
4. **ზრდა** — წონა, სიმაღლე/სიგრძე, თავის გარშემოწერილობა; ჯანმოს სტანდარტები (0–5) და 2007 რეფერენსი (5–19),
   LMS z-score, მრუდები 3/15/50/85/97; ტრენდი ენით, რომელიც არ აშინებს („თავის ხაზს მიჰყვება“), სიგნალი მხოლოდ
   ზღვრებზე და ხაზის მკვეთრ ცვლილებაზე; BMI 2 წლიდან; 0.7 სმ წოლით/დგომით კორექცია.
5. **კვება** — ასაკით: 0–6 თვე — კვების ჟურნალი (მკერდი მარცხ./მარჯვ. ტაიმერით, ბოთლი მლ, რძე/ნარევი) და დღის
   ჯამი; 6–24 თვე — დამატებითი კვების დაწყება, 9 ალერგენის შეყვანის ბარათი (არაქისი, კვერცხი…), რეაქციის ჩანიშვნა;
   2+ — თეფშის პრინციპი, სასმელები, რისი მოერიდო. **კალორიების თვლა ბავშვებზე არა** (AAP).
6. **ამ ასაკში (რეკომენდაციები)** — განვითარების ეტაპები (CDC/AAP 2022, 2 თვე – 5 წელი) მონიშვნით, ძილის ნორმა,
   ეკრანი, აქტივობა, უსაფრთხოება, D ვიტამინი, მოსალოდნელი ვიზიტები; ყველაფერი სერვერიდან (ცვლილება ბილდის გარეშე).
7. **ჯანმრთელობა** — ალერგიები, ქრონიკული მდგომარეობები, მუდმივი წამლები; **ავადობის დღიური**: ტემპერატურა
   დროით, სიმპტომები, მიცემული წამალი (რა და როდის — დოზას მშობელი წერს შეფუთვიდან).
8. **Medi — ბავშვის პედიატრი** — ცალკე საუბარი თითო შვილზე, იცის: ასაკი/კორექტირებული ასაკი, ზრდა და
   პერცენტილები, აცრები, ალერგიები, მდგომარეობები, ბოლო ტემპერატურა/სიმპტომები/წამლები, კვება, ეტაპები.
   უსაფრთხოება: ტრიაჟის 4 დონე (112 ახლავე · დღესვე ექიმთან · 24 სთ · სახლში + როდის დაბრუნდე), წესი ამოწმებს
   AI-მდე და AI ვერ დაწევს; **დოზას რიცხვით არასოდეს ასახელებს** (შეფუთვის ცხრილი/ფარმაცევტი/პედიატრი); არასოდეს
   ასპირინი < 16, კოდეინი < 12, ხველების წამლები < 6, თაფლი < 1. AI თანხმობის გზით (consentedAiFetch).
9. **შეხსენებები** — აცრა: 2 კვირით ადრე, იმ დღეს, გადაცილებისას +7 და +30 დღე; თვის დაბადების დღე 24 თვემდე
   („ნინო დღეს 6 თვისაა — რა იცვლება“); ცალკე ჩამრთველი პროფილში → შეტყობინებები („ოჯახი“), reconcile-ში.
10. **ადმინი** — მოდულის ჩამრთველები `family` + `familyMedi`; გვერდი `#/family` (MEDIVET-ის გვერდის მსგავსად,
    ოღონდ ძლიერი): რამდენი მშობელი/ბავშვი, ასაკობრივი ჯგუფები, აცრების ჩანაწერები, შეხსენებები, ზრდა, Medi
    პედიატრის გამოყენება და ხარისხი; კალენდრის ნახვა წყაროსთან ერთად. არასოდეს სახელები, დიაგნოზები, ჩატის ტექსტი.
11. **კონფიდენციალურობა** — მშობლის თანხმობა ბავშვის მონაცემზე, კონფიდენციალურობის პოლიტიკის ახალი პარაგრაფი,
    ანგარიშის წაშლისას ყველაფერი იშლება, ბავშვის მონაცემი არასოდეს მშობლის AI-კონტექსტში, URL-ში, push-ის
    ანალიტიკაში ან ადმინის სიებში.

## შემდეგი ეტაპები

- **v2:** მეორე მშობლის/ბებია-ბაბუის მოწვევა (როლები, მყისიერი გაუქმება — ჩურნის #2 მიზეზი), აცრების ბარათის
  PDF/გაზიარება (საბავშვო ბაღი/სკოლა, ფორმა 100-ის მომზადება), პედიატრთან ვიზიტები და კითხვების სია, ვებ `/app`
  გვერდი, Medi-ს მთავარი ჩატიდან ბავშვის ამოცნობა სახელით („ნინოს 38.5 აქვს“).
- **v3:** ოჯახის სხვა წევრები (მეუღლე, მოხუცი მშობელი — მზრუნველის რეჟიმი, წამლების შეხსენება), ფეხმძიმობიდან
  ბავშვზე გადასვლა (MEDICYCLE-ის ორსულობის რეჟიმიდან), მთავარი გვერდის „მშობლის“ განლაგება.

## გამოშვება

ახალი მოდული = **store build** (App Review 2.5.2, OTA-თ ახალ ფუნქციას არ ვამატებთ). კოდი main-ზე ჩადის დამალული:
აპში ჩანს მხოლოდ `__DEV__`-ში (Expo-ზე ტესტი) ან native train ≥ 23-ზე და `family` ჩამრთველი ჩართულია.
იხსნება MEDISLEEP-თან ერთად ერთ store build-ში: train 23, ვერსია 1.0.0.23.1, build 37 (build 36 MEDIFAMILY-ის გარეშე არ გამოდის). მანამდე: owner ამოწმებს Expo-ში, სქრინები light/dark.

## Technical design (for agents)

- **Brand:** `family` in `moduleBrand.ts` — MEDIFAMILY, warm coral (ink `#C2410C` / dark `#FDBA74`, gradient
  `#7C2D12 → #EA580C → #FB923C`); tone `family` in `colors.ts`; routes wrapped in `ModuleToneProvider tone="family"`.
- **Schema:** `server/prisma/20261012-family.sql` via `server/scripts/install-family.mjs` (in `db:install`), raw SQL
  only (no Prisma models): `FamilyMember`, `FamilyAccess` (OWNER now, CAREGIVER in v2 — every read/write authorises
  through it), `FamilyHealthItem`, `FamilyVaccineDose`, `FamilyMeasurement`, `FamilyLog` (feed/temp/symptom/med/
  note), `FamilyFoodIntro`, `FamilyMilestone`, `FamilyChatSession`, `FamilyChatMessage`. Deleted with the account
  (`deleteUser`).
- **Server:** `server/src/lib/family/` — `store.js` (access), `age.js`, `vaccinesGe.js` (calendar + engine),
  `growth.js` (+ `server/src/data/who-growth.json`), `guide.js` (+ data), `pediatricPolicy.js` (triage + safety),
  `pediatricEngine.js`, `aiContext.js`, `reminders.js`, `adminFamily.js`. Routes `/api/family` (`requireFeature
  ('family')`, chat `requireFeature('familyMedi')`), `/api/admin/family` (`FAMILY_VIEW`). AI telemetry mode
  `PEDIATRIC`; never EvidenceMD, never `withPatientAiContext`, never in the parent's consultation context.
- **App:** `mobile/app/family/**`, kit `src/components/family/`, API `api.family`, keys `['family', …]`
  (`queryInvalidation.ts` `/api/family`), notifications prefix `family:`, channel `family-reminders`,
  reminder family `family`, route root `family` (server `announcements.js` + app `ROUTE_ROOTS` +
  `NOTIFICATION_ROUTE_ROOTS`). Visibility gate `src/lib/familyAvailability.ts`.

## Status (2026-10-12, v1 built — ships in store build 37, train 23, with MEDISLEEP)

Built: everything in „v1“ above except caregiver invites (the `FamilyAccess` table is ready for them). Server tables
were installed on the main DB (additive, `install-family.mjs`); every SQL statement was exercised in a rolled-back
transaction. Screens were checked in the mock web harness (light + dark): hub, life-ribbon hero (on time / overdue),
vaccine card, growth chart, feeding, guide, health diary, add child, Medi chat (emergency card + 112).

Rules for agents working here:

- **Release gate:** `src/lib/family/familyAvailability.ts` — entries show in `__DEV__` and on native train ≥ 23 only (store build 37 carries it with MEDISLEEP; build 36 without it is never released),
  and only while the admin switch `family` is on. Never lower the train in an OTA (App Review 2.5.2).
- **Calendar = code + source:** `server/src/lib/family/vaccinesGe.js` mirrors order №01-60/ნ (table №52/ნ 2023).
  When the Ministry changes it, edit the file (server deploy, no app build) and update `GE_CALENDAR_SOURCE.checkedOn`.
  HPV catch-up ages (13–45) live in the yearly programs decree — re-check every January. Vaccines follow
  chronological age; growth and milestones use corrected age < 2 y for babies born < 37 weeks.
- **Growth data:** `whoGrowthData.js` is WHO's own anthro/anthroplus tables (hash-checked against the source on
  2026-10-12). Never hand-edit numbers.
- **Medi for children:** rule triage (`pediatricPolicy.js`) runs before the model and sets the floor; the model's
  `[[LEVEL: …]]` can only raise it; the tag never reaches the screen (`levelTagStripper`). No dose numbers ever
  (prompt + `mentionsDoseNumbers` guard note). Telemetry mode `PEDIATRIC`. Conversations live in `FamilyChat*`, never
  `ChatSession`, never in the parent's AI context. Tests: `pediatricPolicy.test.js` pins every rule — a pediatrician
  should review the table before launch.
- **Privacy:** admin `#/family` shows counts only (test asserts no child name leaks). Children cascade-delete with the
  owner account (FKs, not `UNLINKED_USER_TABLES`); a parent can delete one child completely (edit → delete).
- **Reminders:** `src/lib/family/familyReminders.ts`, prefix `family:`, channel `family-reminders`, switch „შვილები“ in
  Profile → შეტყობინებები, called from `reconcileAllLocalReminders` and after dose/child changes; fire-time check in
  the Notification Brain (`familyReminder`). Server feed `/api/family/reminders/feed` owns the copy.
- **Tests:** server — `src/lib/family/*.test.js` (imported from `featureFlags.test.js`: the npm test line is at the
  Windows limit); app — `featureRoutes.test.ts`, `en.test.ts`, `modal-chrome`.
- **QA harness:** mock fixture `webqa/fixtures/family.mjs` (session 27e360b4 scratchpad) runs the real engines.

Open items for the owner:

1. **AI disclosure:** done in build 37 — a MEDIFAMILY line in `mobile/src/config/aiDisclosure.json` (ka + en), without
   bumping `CURRENT_AI_CONSENT_VERSION` (like the nutrition line): new users and Profile → Privacy see it, existing
   consents stay valid; the child-add consent also names Medi.
2. **Pediatrician review** of the triage table and the guide copy (research report, section on AI safety).
3. **v2 order:** second-parent invite → vaccine card PDF → web `/app` page → Medi recognising a child by name.
