/**
 * Authoritative sources for MEDICARD calculations and curated medical facts.
 * Each entry must support the number, band, or statement shown next to it.
 */
export type MedicalSource = {
  id: string;
  organization: string;
  title: string;
  titleKa: string;
  description: string;
  descriptionKa: string;
  url: string | null;
  /** When the link was last opened and found to still say what the description claims (YYYY-MM-DD). */
  checkedAt?: string;
};

export const medicalSources = {
  bmi: {
    id: 'bmi',
    organization: 'World Health Organization',
    title: 'A healthy lifestyle — BMI classification',
    titleKa: 'ჯანსაღი ცხოვრების წესი — BMI კლასიფიკაცია',
    description:
      'Adult BMI below 18.5 is underweight, 18.5–24.9 is a healthy weight, 25–29.9 is overweight, and 30 or above is obesity. MEDICARD uses these cut-offs for the gauge, category, and healthy weight range.',
    descriptionKa:
      'ზრდასრულებში BMI 18.5-ზე ნაკლები დაბალი წონაა, 18.5–24.9 ჯანსაღი წონა, 25–29.9 ჭარბი წონა, 30 და ზემოთ სიმსუქნე. MEDICARD ამ ზღვრებს იყენებს სკალაზე, კატეგორიასა და ჯანსაღი წონის დიაპაზონში.',
    url: 'https://www.who.int/europe/news-room/fact-sheets/item/a-healthy-lifestyle---who-recommendations',
  },
  weightPace: {
    id: 'weightPace',
    organization: 'Centers for Disease Control and Prevention',
    title: 'Losing weight',
    titleKa: 'წონის კლება',
    description:
      'CDC describes a gradual loss of about 1–2 pounds (roughly 0.5–0.9 kg) per week. MEDICARD offers 0.25, 0.5, and 0.75 kg per week, which stays at or below that range.',
    descriptionKa:
      'CDC თანდათანობით კლებად დაახლოებით 1–2 ფუნტს (დაახლოებით 0.5–0.9 კგ) კვირაში ასახელებს. MEDICARD გთავაზობს 0.25, 0.5 და 0.75 კგ-ს კვირაში — ამ დიაპაზონში ან მის ქვემოთ.',
    url: 'https://www.cdc.gov/healthy-weight-growth/losing-weight/index.html',
  },
  menstrualCycle: {
    id: 'menstrualCycle',
    organization: 'American College of Obstetricians and Gynecologists',
    title: 'Fertility awareness-based methods of family planning',
    titleKa: 'ნაყოფიერების ცნობიერებაზე დაფუძნებული მეთოდები',
    description:
      'Calendar estimates place ovulation about 14 days before the next period. MEDICARD estimates ovulation as cycle length minus 14 days and marks a fertile window from 5 days before that date through the day after. This is an estimate, not contraception or confirmed ovulation.',
    descriptionKa:
      'კალენდარული შეფასება ოვულაციას შემდეგ პერიოდამდე დაახლოებით 14 დღით ადრე დებს. MEDICARD ოვულაციას ითვლის როგორც ციკლის სიგრძე მინუს 14 დღე და ნაყოფიერ ფანჯარას აჩვენებს ამ თარიღამდე 5 დღიდან მომდევნო დღემდე. ეს შეფასებაა, არა კონტრაცეფცია ან დადასტურებული ოვულაცია.',
    url: 'https://www.acog.org/womens-health/faqs/fertility-awareness-based-methods-of-family-planning',
  },
  heavyMenstrualBleeding: {
    id: 'heavyMenstrualBleeding',
    organization: 'American College of Obstetricians and Gynecologists',
    title: 'Heavy menstrual bleeding',
    titleKa: 'ძლიერი მენსტრუალური სისხლდენა',
    description:
      'ACOG names the signs worth discussing with a clinician: bleeding that lasts more than 7 days, soaking through one or more pads or tampons every hour for several hours in a row, or passing clots larger than a quarter. MEDICARD shows a calm reminder of these signs after 3 consecutive days of heavy flow or a bleeding run longer than 7 days. It is a prompt to talk to a doctor, not a diagnosis.',
    descriptionKa:
      'ACOG ასახელებს ნიშნებს, რომლებზეც ექიმთან საუბარი ღირს: სისხლდენა 7 დღეზე მეტ ხანს, საფენის ან ტამპონის გაჟღენთვა ყოველ საათში რამდენიმე საათის განმავლობაში, ან მონეტაზე დიდი კოლტები. MEDICARD ამ ნიშნებს მშვიდად ახსენებს 3 ზედიზედ ძლიერი დღის ან 7 დღეზე გრძელი სისხლდენის შემდეგ. ეს ექიმთან საუბრის შეხსენებაა, არა დიაგნოზი.',
    url: 'https://www.acog.org/womens-health/faqs/heavy-menstrual-bleeding',
  },
  pregnancyDueDate: {
    id: 'pregnancyDueDate',
    organization: 'American College of Obstetricians and Gynecologists',
    title: 'Methods for estimating the due date',
    titleKa: 'მშობიარობის სავარაუდო თარიღის შეფასება',
    description:
      'An estimated due date from the last menstrual period is 280 days (40 weeks) after that date. MEDICARD labels this date as an estimate.',
    descriptionKa:
      'ბოლო მენსტრუაციიდან სავარაუდო თარიღი 280 დღეა (40 კვირა). MEDICARD ამ თარიღს შეფასებად აჩვენებს.',
    url: 'https://www.acog.org/clinical/clinical-guidance/committee-opinion/articles/2017/05/methods-for-estimating-the-due-date',
  },
  fetalGrowth: {
    id: 'fetalGrowth',
    organization: 'World Health Organization',
    title: 'WHO fetal growth charts',
    titleKa: 'WHO-ს ნაყოფის ზრდის ცხრილები',
    description:
      'Displayed weight from week 14 is the WHO 2017 estimated fetal weight 50th percentile, sexes combined, in grams. It is a population average, not this pregnancy’s measurement.',
    descriptionKa:
      'მე-14 კვირიდან ნაჩვენები წონა WHO-ს 2017 წლის ნაყოფის სავარაუდო წონის მე-50 პროცენტილია, სქესების გაერთიანებით, გრამებში. ეს პოპულაციის საშუალოა, არა ამ ორსულობის გაზომვა.',
    url: 'https://journals.plos.org/plosmedicine/article?id=10.1371/journal.pmed.1002220',
  },
  fetalLength: {
    id: 'fetalLength',
    organization: 'Radiological Society of North America',
    title: 'Fetal crown-rump length (Hadlock et al., 1992)',
    titleKa: 'ნაყოფის თავ-კუდუსუნის სიგრძე (Hadlock და სხვ., 1992)',
    description:
      'Length in weeks 5–18 uses crown-rump length by completed week from Hadlock 1992, rounded for display. Week 19 is omitted because the measurement switches from crown-rump to crown-heel. From week 20 the app shows an approximate crown-heel length that rises about 5 cm every 4 weeks (25 cm at week 20 to 50 cm at week 40), a general obstetric rule of thumb rather than a growth-chart percentile.',
    descriptionKa:
      'მე-5–18 კვირის სიგრძე Hadlock 1992-ის თავ-კუდუსუნის სიგრძეა დასრულებული კვირის მიხედვით, ჩვენებისთვის დამრგვალებული. მე-19 კვირა არ ჩანს, რადგან გაზომვა თავ-კუდუსუნიდან სრულ სიგრძეზე გადადის. მე-20 კვირიდან ნაჩვენებია მიახლოებითი სრული სიგრძე, რომელიც ყოველ 4 კვირაში დაახლოებით 5 სმ-ით იზრდება (25 სმ მე-20 კვირაზე, 50 სმ მე-40 კვირაზე) — ეს ზოგადი სამეანო ორიენტირია და არა ზრდის ცხრილის პროცენტილი.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/1732970/',
  },
  fetalDevelopment: {
    id: 'fetalDevelopment',
    organization: 'American College of Obstetricians and Gynecologists',
    title: 'How your fetus grows during pregnancy',
    titleKa: 'როგორ იზრდება ნაყოფი ორსულობისას',
    description:
      'Week-by-week development notes follow published educational descriptions of fetal growth. Illustrations are generic and are not an image of this pregnancy.',
    descriptionKa:
      'კვირების განვითარების ტექსტი ნაყოფის ზრდის გამოქვეყნებულ საგანმანათლებლო აღწერას ეყრდნობა. ილუსტრაციები ზოგადია და ამ ორსულობის სურათი არ არის.',
    url: 'https://www.acog.org/womens-health/faqs/how-your-fetus-grows-during-pregnancy',
  },
  pregnancyWeeks: {
    id: 'pregnancyWeeks',
    organization: 'National Health Service',
    title: 'Pregnancy week by week',
    titleKa: 'ორსულობა კვირების მიხედვით',
    description:
      'Trimester bands and general pregnancy-week education follow NHS week-by-week guidance. They are not a personal care schedule.',
    descriptionKa:
      'ტრიმესტრების ზოლები და ორსულობის კვირების ზოგადი განათლება NHS-ის კვირების გზამკვლევს ეყრდნობა. ეს პირადი მოვლის განრიგი არ არის.',
    url: 'https://www.nhs.uk/pregnancy/week-by-week/',
  },
  bloodPressure: {
    id: 'bloodPressure',
    organization: 'American Heart Association',
    title: 'Understanding blood pressure readings',
    titleKa: 'არტერიული წნევის მაჩვენებლების გაგება',
    description:
      'AHA categories: normal is below 120 systolic and below 80 diastolic; elevated is 120–129 and below 80; stage 1 hypertension is 130–139 or 80–89; stage 2 is 140 or higher or 90 or higher. MEDICARD shows "optimal" for normal, "elevated" for 120–129/<80, and "high" for stage 1 or 2. One reading is not a diagnosis.',
    descriptionKa:
      'AHA-ს კატეგორიები: ნორმა — სისტოლური 120-ზე ნაკლები და დიასტოლური 80-ზე ნაკლები; აწეული — 120–129 და 80-ზე ნაკლები; 1-ლი ხარისხის ჰიპერტენზია — 130–139 ან 80–89; მე-2 ხარისხი — 140 ან მეტი ან 90 ან მეტი. MEDICARD ნორმას „ოპტიმალურს“ უწოდებს, 120–129/<80-ს „აწეულს“, ხოლო 1-ლ ან მე-2 ხარისხს „მაღალ წნევას“. ერთი გაზომვა დიაგნოზი არ არის.',
    url: 'https://www.heart.org/en/health-topics/high-blood-pressure/understanding-blood-pressure-readings',
  },
  restingHeartRate: {
    id: 'restingHeartRate',
    organization: 'American Heart Association',
    title: 'All about heart rate (pulse)',
    titleKa: 'ყველაფერი პულსის შესახებ',
    description:
      'A normal resting heart rate for adults is 60 to 100 beats per minute. MEDICARD labels 60–100 bpm as normal, below 60 as low and above 100 as high. Athletes and some medicines can lower the resting rate.',
    descriptionKa:
      'ზრდასრულის ნორმალური მოსვენების პულსი წუთში 60–100 დარტყმაა. MEDICARD 60–100-ს ნორმად აჩვენებს, 60-ზე ნაკლებს — დაბალად, 100-ზე მეტს — მაღალად. სპორტსმენებში და ზოგი წამლის მიღებისას მოსვენების პულსი შეიძლება უფრო დაბალი იყოს.',
    url: 'https://www.heart.org/en/health-topics/high-blood-pressure/the-facts-about-high-blood-pressure/all-about-heart-rate-pulse',
  },
  sleepAdults: {
    id: 'sleepAdults',
    organization: 'Centers for Disease Control and Prevention',
    title: 'About sleep — how much sleep adults need',
    titleKa: 'ძილი — რამდენი ძილი სჭირდება ზრდასრულს',
    description:
      'CDC recommends 7 or more hours per night for adults aged 18–60 (7–9 hours at 61–64, 7–8 hours at 65+). MEDICARD labels 7 hours or more as enough sleep, 5 to under 7 hours as too little and under 5 hours as very little.',
    descriptionKa:
      'CDC 18–60 წლის ზრდასრულს ღამით 7 ან მეტ საათს ურჩევს (61–64 წლისას 7–9 საათს, 65+ ასაკში 7–8 საათს). MEDICARD 7 ან მეტ საათს საკმარის ძილად აჩვენებს, 5-დან 7 საათამდე — არასაკმარისად, 5 საათზე ნაკლებს — ძალიან ცოტად.',
    url: 'https://www.cdc.gov/sleep/about/index.html',
  },
  waterIntake: {
    id: 'waterIntake',
    organization: 'European Food Safety Authority',
    title: 'Dietary reference values for water (2010)',
    titleKa: 'წყლის რეკომენდებული მიღება (EFSA, 2010)',
    description:
      'EFSA sets adequate total water intake at 2.0 L per day for adult women and 2.5 L per day for adult men, from drinks and food (food usually provides about 20%). MEDICARD’s default drinks goal is 2,000 ml and you can change it. The metrics hub marks 1,800 ml or more as enough and 1,000 ml or more as moderate; hydration levels are shares of your goal (100%, 75%, 50%, 25%). Heat, exercise, pregnancy and illness change needs.',
    descriptionKa:
      'EFSA ზრდასრულისთვის წყლის საკმარის საერთო მიღებად ქალისთვის დღეში 2.0 ლ-ს, კაცისთვის 2.5 ლ-ს ასახელებს — სასმელიდან და საკვებიდან ერთად (საკვები ჩვეულებრივ დაახლოებით 20%-ს იძლევა). MEDICARD-ის ნაგულისხმევი სასმელის მიზანი 2,000 მლ-ია და შეგიძლია შეცვალო. მაჩვენებლების გვერდი 1,800 მლ-ს ან მეტს საკმარისად აჩვენებს, 1,000 მლ-ს ან მეტს — საშუალოდ; ჰიდრატაციის დონეები შენი მიზნის წილია (100%, 75%, 50%, 25%). სიცხე, ვარჯიში, ორსულობა და ავადმყოფობა საჭიროებას ცვლის.',
    url: 'https://www.efsa.europa.eu/en/efsajournal/pub/1459',
  },
  bodyFatDeurenberg: {
    id: 'bodyFatDeurenberg',
    organization: 'British Journal of Nutrition (Deurenberg et al., 1991)',
    title: 'Body mass index as a measure of body fatness: age- and sex-specific prediction formulas',
    titleKa: 'BMI როგორც ცხიმოვანი მასის საზომი: ასაკისა და სქესის მიხედვით ფორმულები',
    description:
      'Body fat % is estimated with the Deurenberg formula: 1.2 × BMI + 0.23 × age − 10.8 × sex (1 for men, 0 for women) − 5.4. Fat-free mass is 100 minus that percentage; it is not measured muscle. Estimates from BMI can be off by several percentage points, especially for athletes and older adults.',
    descriptionKa:
      'ცხიმის პროცენტი Deurenberg-ის ფორმულით ფასდება: 1.2 × BMI + 0.23 × ასაკი − 10.8 × სქესი (კაცი 1, ქალი 0) − 5.4. ცხიმისგან თავისუფალი მასა 100-ს მინუს ეს პროცენტია — ეს გაზომილი კუნთი არ არის. BMI-დან შეფასება რამდენიმე პროცენტით შეიძლება ცდებოდეს, განსაკუთრებით სპორტსმენებსა და ხანდაზმულებში.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/2043597/',
  },
  energyTarget: {
    id: 'energyTarget',
    organization: 'American Journal of Clinical Nutrition (Mifflin et al., 1990)',
    title: 'A new predictive equation for resting energy expenditure in healthy individuals',
    titleKa: 'მოსვენების ენერგიის ხარჯის ახალი ფორმულა (Mifflin–St Jeor)',
    description:
      'Resting energy uses Mifflin–St Jeor: 10 × weight (kg) + 6.25 × height (cm) − 5 × age + 5 for men or − 161 for women. MEDICARD multiplies it by your activity (1.2, 1.375, 1.55 or 1.725), then subtracts 250 or 400 kcal to lose weight or adds 200 kcal to gain. Automatic plans stay within 1,500–3,500 kcal a day. If you turn them on, the daily budget also adds burned calories and up to 200 kcal left over from yesterday.',
    descriptionKa:
      'მოსვენების ენერგია Mifflin–St Jeor-ით ითვლება: 10 × წონა (კგ) + 6.25 × სიმაღლე (სმ) − 5 × ასაკი + 5 კაცისთვის ან − 161 ქალისთვის. MEDICARD მას შენი აქტივობით ამრავლებს (1.2, 1.375, 1.55 ან 1.725), შემდეგ დასაკლებად 250 ან 400 კკალ-ს აკლებს, მოსამატებლად 200 კკალ-ს უმატებს. ავტომატური გეგმა დღეში 1,500–3,500 კკალ-ის ფარგლებშია. თუ ჩართავ, დღის ბიუჯეტს ემატება დამწვარი კალორია და გუშინდელი ნაშთი 200 კკალ-მდე.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/2305711/',
  },
  macroRanges: {
    id: 'macroRanges',
    organization: 'Health Canada (Dietary Reference Intakes)',
    title: 'Reference values for macronutrients',
    titleKa: 'მაკრონუტრიენტების რეკომენდებული დიაპაზონები',
    description:
      'Acceptable macronutrient distribution ranges for adults: protein 10–35%, carbohydrate 45–65% and fat 20–35% of energy. MEDICARD’s default split 20 / 50 / 30 sits inside these ranges. Other presets and custom splits (limits protein 10–40%, carbohydrate 15–65%, fat 15–50%) can fall outside them; that is your choice, not a recommendation. Grams use 4 kcal per gram of protein and carbohydrate and 9 kcal per gram of fat.',
    descriptionKa:
      'ზრდასრულისთვის მისაღები დიაპაზონები: ცილა ენერგიის 10–35%, ნახშირწყლები 45–65%, ცხიმი 20–35%. MEDICARD-ის ნაგულისხმევი განაწილება 20 / 50 / 30 ამ ფარგლებშია. სხვა ვარიანტები და საკუთარი განაწილება (ზღვრები: ცილა 10–40%, ნახშირწყლები 15–65%, ცხიმი 15–50%) შეიძლება მათ სცდებოდეს — ეს შენი არჩევანია, არა რეკომენდაცია. გრამები ითვლება 4 კკალ/გ ცილასა და ნახშირწყალზე, 9 კკალ/გ ცხიმზე.',
    url: 'https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/dietary-reference-intakes/tables/reference-values-macronutrients.html',
  },
  bodyWeightPlanner: {
    id: 'bodyWeightPlanner',
    organization: 'National Institute of Diabetes and Digestive and Kidney Diseases',
    title: 'Body Weight Planner',
    titleKa: 'წონის დამგეგმავი (NIDDK)',
    description:
      'NIDDK’s Body Weight Planner shows that weight change slows over time as the body adapts, so straight-line forecasts are only rough. MEDICARD’s projection is a straight-line trend through your last 28 weigh-ins (it needs at least 3 over 7 or more days) or, without that, your planned weekly pace. It is a guide, not a promise.',
    descriptionKa:
      'NIDDK-ის წონის დამგეგმავი აჩვენებს, რომ სხეულის შეგუებასთან ერთად წონის ცვლილება დროთა განმავლობაში ნელდება, ამიტომ სწორხაზოვანი პროგნოზი მხოლოდ მიახლოებითია. MEDICARD-ის პროგნოზი შენი ბოლო 28 აწონვის სწორხაზოვანი ტენდენციაა (საჭიროა მინიმუმ 3 აწონვა 7 ან მეტ დღეში), ან მის გარეშე — დაგეგმილი კვირის ტემპი. ეს ორიენტირია, არა დაპირება.',
    url: 'https://www.niddk.nih.gov/health-information/weight-management/body-weight-planner',
  },
  mealQuality: {
    id: 'mealQuality',
    organization: 'World Health Organization',
    title: 'Healthy diet — fact sheet',
    titleKa: 'ჯანსაღი კვება — ფაქტების ფურცელი',
    description:
      'WHO advises keeping free sugars below 10% of energy and total fat below 30%, eating less than 5 g of salt a day, and plenty of fiber-rich foods. MEDICARD’s 1–10 meal score is its own heuristic loosely based on these principles, not a WHO score: it rewards protein share and fiber and lowers the score when fat is over 45% of the meal’s calories, sugar over 15%, energy density over 2.5 kcal per gram or sodium over 1.2 mg per kcal. It is not a medical judgment.',
    descriptionKa:
      'WHO გირჩევს, თავისუფალი შაქარი ენერგიის 10%-ზე ნაკლები იყოს, მთლიანი ცხიმი — 30%-ზე ნაკლები, მარილი — დღეში 5 გ-ზე ნაკლები, და ბევრი ბოჭკოვანი საკვები. MEDICARD-ის 1–10 ქულა კერძისთვის საკუთარი მიახლოებითი წესია, ამ პრინციპებზე თავისუფლად დაფუძნებული, და არა WHO-ს ქულა: ქულას ზრდის ცილის წილი და ბოჭკო, ამცირებს — ცხიმი კერძის კალორიის 45%-ზე მეტი, შაქარი 15%-ზე მეტი, ენერგიის სიმკვრივე 2.5 კკალ/გ-ზე მეტი ან ნატრიუმი 1.2 მგ/კკალ-ზე მეტი. ეს სამედიცინო შეფასება არ არის.',
    url: 'https://www.who.int/news-room/fact-sheets/detail/healthy-diet',
  },
  activityMet: {
    id: 'activityMet',
    organization: 'Medicine & Science in Sports & Exercise (Ainsworth et al., 2011)',
    title: '2011 Compendium of Physical Activities',
    titleKa: 'ფიზიკური აქტივობების კომპენდიუმი (2011)',
    description:
      'The Compendium lists the energy cost of activities in METs; 1 MET is about 1 kcal per kg of body weight per hour (3.5 ml of oxygen per kg per minute). MEDICARD estimates burned calories as MET × weight (kg) × hours, the same as MET × 3.5 × kg / 200 per minute, using 70 kg when your weight is unknown. MEDIRUN picks a MET from your average speed (from 2.8 for slow walking to 14.5 for fast running) and assumes 0.72 m per step. Step energy uses about 0.04 kcal per step at 70 kg. These are estimates, not measurements.',
    descriptionKa:
      'კომპენდიუმი აქტივობების ენერგიის ხარჯს MET-ებში აღწერს; 1 MET დაახლოებით 1 კკალ-ია სხეულის წონის ყოველ კგ-ზე საათში (3.5 მლ ჟანგბადი კგ-ზე წუთში). MEDICARD დამწვარ კალორიას ითვლის როგორც MET × წონა (კგ) × საათები — იგივე, რაც MET × 3.5 × კგ / 200 წუთში; წონის უცნობობისას იყენებს 70 კგ-ს. MEDIRUN MET-ს საშუალო სიჩქარით ირჩევს (2.8 ნელი სიარულიდან 14.5 სწრაფ სირბილამდე) და ნაბიჯს 0.72 მ-ად თვლის. ნაბიჯების ენერგია 70 კგ-ზე დაახლოებით 0.04 კკალ-ია ნაბიჯზე. ეს შეფასებაა, არა გაზომვა.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/21681120/',
  },
  intermittentFasting: {
    id: 'intermittentFasting',
    organization: 'National Institute on Aging (NIH)',
    title: 'Research on intermittent fasting shows health benefits',
    titleKa: 'ინტერვალური შიმშილის კვლევები (NIA)',
    description:
      'NIA summarizes research on intermittent fasting and time-restricted eating; evidence in people is still limited and fasting is not right for everyone. MEDICARD offers only daily fasting windows of 10–20 hours (12:12 to 20:4), does not offer the timer under 18, in pregnancy or breastfeeding or with an eating-disorder history, and asks for your doctor’s confirmation if you take glucose-lowering medicine. It makes no claims about ketosis or autophagy.',
    descriptionKa:
      'NIA აჯამებს ინტერვალური შიმშილისა და დროში შეზღუდული კვების კვლევებს; ადამიანებზე მტკიცებულება ჯერ შეზღუდულია და შიმშილი ყველასთვის არ არის. MEDICARD მხოლოდ დღიურ 10–20-საათიან ფანჯრებს გთავაზობს (12:12-დან 20:4-მდე), ტაიმერს არ გთავაზობს 18 წლამდე, ორსულობისა და ძუძუთი კვებისას ან კვებითი აშლილობის ისტორიისას, ხოლო გლუკოზის დამწევი წამლის მიღებისას ექიმის დადასტურებას ითხოვს. კეტოზისა და აუტოფაგიის შესახებ მტკიცებებს არ აკეთებს.',
    url: 'https://www.nia.nih.gov/news/research-intermittent-fasting-shows-health-benefits',
  },
  physicalActivity: {
    id: 'physicalActivity',
    organization: 'World Health Organization',
    title: 'Physical activity — fact sheet',
    titleKa: 'ფიზიკური აქტივობა — ფაქტების ფურცელი',
    description:
      'WHO recommends that adults do at least 150–300 minutes of moderate-intensity or 75–150 minutes of vigorous-intensity aerobic activity a week, and that any activity is better than none. MEDICARD shows active minutes as a rough estimate of 100 steps per minute.',
    descriptionKa:
      'WHO ზრდასრულს კვირაში მინიმუმ 150–300 წუთ ზომიერ ან 75–150 წუთ ინტენსიურ აერობულ აქტივობას ურჩევს და აღნიშნავს, რომ ნებისმიერი მოძრაობა უმოძრაობას სჯობს. MEDICARD აქტიურ წუთებს მიახლოებით ითვლის — 100 ნაბიჯი წუთში.',
    url: 'https://www.who.int/news-room/fact-sheets/detail/physical-activity',
  },
  dailySteps: {
    id: 'dailySteps',
    organization: 'The Lancet Public Health (Paluch et al., 2022)',
    title: 'Daily steps and all-cause mortality: a meta-analysis of 15 international cohorts',
    titleKa: 'დღიური ნაბიჯები და სიკვდილობა: 15 კოჰორტის მეტა-ანალიზი',
    description:
      'In this meta-analysis more daily steps were linked with lower risk of death, with the benefit leveling off at about 6,000–8,000 steps a day for adults 60 and older and 8,000–10,000 for younger adults. MEDICARD’s default goal is 10,000 steps a day and you can change it. The status compares today with your goal (100%, 75%, 40%). Distance assumes 0.762 m per step, which is an estimate.',
    descriptionKa:
      'ამ მეტა-ანალიზში მეტი დღიური ნაბიჯი სიკვდილის დაბალ რისკთან იყო დაკავშირებული; სარგებელი 60+ ასაკში დაახლოებით 6,000–8,000 ნაბიჯზე სტაბილდებოდა, ახალგაზრდებში — 8,000–10,000-ზე. MEDICARD-ის ნაგულისხმევი მიზანი დღეში 10,000 ნაბიჯია და შეგიძლია შეცვალო. სტატუსი დღევანდელს შენს მიზანს ადარებს (100%, 75%, 40%). მანძილი ითვლება 0.762 მ ნაბიჯზე — ეს მიახლოებაა.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/35247352/',
  },
  labResults: {
    id: 'labResults',
    organization: 'MedlinePlus (U.S. National Library of Medicine)',
    title: 'How to understand your lab results',
    titleKa: 'როგორ გავიგოთ ლაბორატორიული ანალიზის შედეგი',
    description:
      'Reference ranges differ between laboratories, so a result is read against the range printed by the lab that ran it. MEDICARD’s above / below / within-range labels come from the flag or reference range printed on your lab report, not from its own norms. A value outside the range is not always a problem; discuss it with your clinician.',
    descriptionKa:
      'საცნობარო დიაპაზონი ლაბორატორიებს შორის განსხვავდება, ამიტომ შედეგი იმ ლაბორატორიის დაბეჭდილ დიაპაზონს უნდა შედარდეს, რომელმაც ანალიზი ჩაატარა. MEDICARD-ის ნიშნები — ზემოთ, ქვემოთ, ნორმაში — შენს ფურცელზე დაბეჭდილ ნიშანს ან საცნობარო დიაპაზონს ეფუძნება და არა აპის საკუთარ ნორმებს. დიაპაზონს გარეთ მნიშვნელობა ყოველთვის პრობლემას არ ნიშნავს — განიხილე ექიმთან.',
    url: 'https://medlineplus.gov/lab-tests/how-to-understand-your-lab-results/',
  },
  symptomsGeneral: {
    id: 'symptomsGeneral',
    organization: 'National Health Service',
    title: 'Health A to Z — conditions and when to get help',
    titleKa: 'ჯანმრთელობა A–Z — მდგომარეობები და როდის მივმართოთ ექიმს',
    description:
      'NHS condition pages describe symptoms and when to get urgent help. MEDICARD’s possible conditions and likelihood percentages are generated by AI from your answers; they are not a diagnosis. Call emergency services for severe symptoms.',
    descriptionKa:
      'NHS-ის გვერდები აღწერს სიმპტომებს და როდის გჭირდება სასწრაფო დახმარება. MEDICARD-ის შესაძლო მდგომარეობები და ალბათობის პროცენტები AI-ით იქმნება შენი პასუხებიდან — ეს დიაგნოზი არ არის. მძიმე სიმპტომებისას დარეკე გადაუდებელ სამსახურში.',
    url: 'https://www.nhs.uk/conditions/',
  },
  medicationInteractions: {
    id: 'medicationInteractions',
    organization: 'MedlinePlus (U.S. National Library of Medicine)',
    title: 'Drugs, herbs and supplements',
    titleKa: 'წამლები, მცენარეები და დანამატები',
    description:
      'MedlinePlus has reference information on medicines, including side effects and interactions. MEDICARD’s medication review is generated by AI from the list you entered; it can miss interactions and is not a prescription or diagnosis. Ask your doctor or pharmacist before changing any medicine.',
    descriptionKa:
      'MedlinePlus-ზე წამლების შესახებ საცნობარო ინფორმაციაა, მათ შორის გვერდითი ეფექტები და ურთიერთქმედებები. MEDICARD-ის წამლების მიმოხილვა AI-ით იქმნება შენ მიერ შეყვანილი სიიდან — შეიძლება ურთიერთქმედება გამოტოვოს და ეს არც დანიშნულებაა, არც დიაგნოზი. წამლის შეცვლამდე ჰკითხე ექიმს ან ფარმაცევტს.',
    url: 'https://medlineplus.gov/druginformation.html',
  },
  airQualityIndex: {
    id: 'airQualityIndex',
    organization: 'European Environment Agency',
    title: 'European Air Quality Index',
    titleKa: 'ევროპული ჰაერის ხარისხის ინდექსი',
    description:
      'The EEA index has six levels from good to extremely poor and follows the worst of PM2.5, PM10, NO2, O3 and SO2. MEDICARD shows the European AQI from Open-Meteo on a 0–100+ scale: 0–19 good, 20–39 fair, 40–59 moderate, 60–79 poor, 80–100 very poor and above 100 extremely poor. From 60 it suggests lighter outdoor activity.',
    descriptionKa:
      'EEA-ს ინდექსს ექვსი დონე აქვს — კარგიდან უკიდურესად ცუდამდე — და PM2.5, PM10, NO2, O3 და SO2-დან ყველაზე ცუდს მიჰყვება. MEDICARD აჩვენებს Open-Meteo-ს ევროპულ AQI-ს 0–100+ სკალაზე: 0–19 კარგი, 20–39 მისაღები, 40–59 საშუალო, 60–79 ცუდი, 80–100 ძალიან ცუდი, 100-ზე მეტი უკიდურესად ცუდი. 60-დან გარე აქტივობის შემსუბუქებას გირჩევს.',
    url: 'https://airindex.eea.europa.eu/AQI/index.html',
  },
  uvIndex: {
    id: 'uvIndex',
    organization: 'World Health Organization',
    title: 'Radiation: the ultraviolet (UV) index',
    titleKa: 'ულტრაიისფერი (UV) ინდექსი',
    description:
      'WHO UV index categories: 0–2 low, 3–5 moderate, 6–7 high, 8–10 very high and 11 or more extreme; sun protection is advised from 3. MEDICARD prefers outdoor windows with UV 2 or lower and marks 6–7 as high and 8 or more as very high.',
    descriptionKa:
      'WHO-ს UV ინდექსის კატეგორიები: 0–2 დაბალი, 3–5 ზომიერი, 6–7 მაღალი, 8–10 ძალიან მაღალი, 11 და მეტი უკიდურესი; მზისგან დაცვა 3-დან არის რეკომენდებული. MEDICARD გარეთ ყოფნისთვის UV 2-ს ან ნაკლებს ამჯობინებს, 6–7-ს მაღალად, 8-ს და მეტს ძალიან მაღალად აჩვენებს.',
    url: 'https://www.who.int/news-room/questions-and-answers/item/radiation-the-ultraviolet-(uv)-index',
  },
  // Cycle „გაიგე მეტი“ (src/i18n/cycle/learnMore.ts): plain explanations of what a woman logs.
  cycleBasics: {
    id: 'cycleBasics',
    organization: 'Office on Women’s Health (womenshealth.gov)',
    title: 'Your menstrual cycle',
    titleKa: 'შენი მენსტრუალური ციკლი',
    description:
      'Explains how a typical cycle works, how long periods usually last and what can change a cycle, such as stress or heavy exercise. MEDICARD’s „Learn more“ notes on bleeding and lifestyle are general information drawn from pages like this one, not advice about your own cycle.',
    descriptionKa:
      'აღწერს, როგორ მუშაობს ციკლი, რამდენ ხანს გრძელდება მენსტრუაცია და რა შეიძლება ცვლიდეს ციკლს, მაგალითად სტრესი ან ძლიერი დატვირთვა. MEDICARD-ის „გაიგე მეტი“ სისხლდენასა და ცხოვრების წესზე ზოგადი ინფორმაციაა, არა რჩევა შენს ციკლზე.',
    url: 'https://womenshealth.gov/menstrual-cycle/your-menstrual-cycle',
    checkedAt: '2026-10-04',
  },
  periodsNhs: {
    id: 'periodsNhs',
    organization: 'National Health Service',
    title: 'Periods — what is usual',
    titleKa: 'მენსტრუაცია',
    description:
      'NHS overview of periods: what is usual for flow, length and symptoms, and when to see a GP. MEDICARD uses it for the plain notes on logged bleeding and the signs that are worth a doctor’s visit.',
    descriptionKa:
      'NHS-ის მიმოხილვა მენსტრუაციაზე: რა არის ჩვეულებრივი სისხლდენის, ხანგრძლივობისა და ნიშნებისთვის და როდის მიმართო ექიმს. MEDICARD მას სისხლდენის ახსნებში იყენებს.',
    url: 'https://www.nhs.uk/conditions/periods/',
    checkedAt: '2026-10-04',
  },
  abnormalBleeding: {
    id: 'abnormalBleeding',
    organization: 'American College of Obstetricians and Gynecologists',
    title: 'Abnormal uterine bleeding',
    titleKa: 'არატიპური სისხლდენა',
    description:
      'ACOG lists bleeding that is worth discussing with a clinician: bleeding or spotting between periods, after sex, periods longer or heavier than usual, and bleeding after menopause. MEDICARD repeats these signs next to spotting; it does not judge what causes them.',
    descriptionKa:
      'ACOG ასახელებს სისხლდენას, რომელზეც ექიმთან საუბარი ღირს: სისხლდენა ან ლაქები მენსტრუაციებს შორის, სქესობრივი კავშირის შემდეგ, ჩვეულზე გრძელი ან ძლიერი მენსტრუაცია და სისხლდენა მენოპაუზის შემდეგ. MEDICARD ამ ნიშნებს ლაქების გვერდით იმეორებს და მიზეზს არ აფასებს.',
    url: 'https://www.acog.org/womens-health/faqs/abnormal-uterine-bleeding',
    checkedAt: '2026-10-04',
  },
  periodPain: {
    id: 'periodPain',
    organization: 'American College of Obstetricians and Gynecologists',
    title: 'Dysmenorrhea: painful periods',
    titleKa: 'მტკივნეული მენსტრუაცია',
    description:
      'ACOG explains period cramps: they usually start a day or two before or at the start of a period, can spread to the lower back and legs, may come with nausea or loose stools, and often ease within 1–3 days. Pain that disrupts daily life or gets worse over time is a reason to see a clinician.',
    descriptionKa:
      'ACOG აღწერს მენსტრუალურ სპაზმებს: ხშირად მენსტრუაციამდე ერთი-ორი დღით ადრე ან დაწყებისას იწყება, შეიძლება წელსა და ფეხებში გადაეცეს, გულისრევა ან თხელი განავალი ახლდეს და 1–3 დღეში მსუბუქდება. ტკივილი, რომელიც ყოველდღიურობას გიშლის ან დროთა განმავლობაში ძლიერდება, ექიმთან მისვლის მიზეზია.',
    url: 'https://www.acog.org/womens-health/faqs/dysmenorrhea-painful-periods',
    checkedAt: '2026-10-04',
  },
  pelvicPain: {
    id: 'pelvicPain',
    organization: 'American College of Obstetricians and Gynecologists',
    title: 'Chronic pelvic pain',
    titleKa: 'ხანგრძლივი მენჯის ტკივილი',
    description:
      'ACOG describes pelvic pain that lasts 6 months or longer, can come and go with the cycle or be constant, and why it deserves a clinician’s visit. MEDICARD uses it for the notes on pelvic and one-sided pain.',
    descriptionKa:
      'ACOG აღწერს მენჯის ტკივილს, რომელიც 6 თვე ან მეტხანს გრძელდება, ციკლთან ერთად მოდის ან მუდმივია, და რატომ ღირს ექიმთან მისვლა. MEDICARD მას მენჯისა და ცალმხრივი ტკივილის ახსნებში იყენებს.',
    url: 'https://www.acog.org/womens-health/faqs/chronic-pelvic-pain',
    checkedAt: '2026-10-04',
  },
  premenstrualSymptoms: {
    id: 'premenstrualSymptoms',
    organization: 'American College of Obstetricians and Gynecologists',
    title: 'Premenstrual syndrome (PMS)',
    titleKa: 'მენსტრუაციამდელი ნიშნები',
    description:
      'ACOG lists the body and mood changes many people notice in the 5 days or so before a period — tender breasts, bloating, tiredness, food cravings, irritability, sadness — and which ones are worth raising with a clinician. MEDICARD uses it for the notes on mood and body tiles.',
    descriptionKa:
      'ACOG ჩამოთვლის სხეულისა და განწყობის ცვლილებებს, რომლებსაც ბევრი ამჩნევს მენსტრუაციამდე დაახლოებით 5 დღით ადრე — მკერდის მგრძნობელობა, შებერილობა, დაღლილობა, საკვების ლტოლვა, გაღიზიანება, სევდა — და რომელზე ღირს ექიმთან საუბარი. MEDICARD მას განწყობისა და სხეულის ახსნებში იყენებს.',
    url: 'https://www.acog.org/womens-health/faqs/premenstrual-syndrome',
    checkedAt: '2026-10-04',
  },
  vaginalHealth: {
    id: 'vaginalHealth',
    organization: 'American College of Obstetricians and Gynecologists',
    title: 'Vaginitis — vaginal health',
    titleKa: 'საშოს ანთება',
    description:
      'ACOG explains that some vaginal discharge is normal and changes during the cycle, and which changes — itching, burning, an unusual colour or smell — are worth a clinician’s visit. MEDICARD uses it for the notes on discharge and genital itching.',
    descriptionKa:
      'ACOG განმარტავს, რომ გარკვეული გამონადენი ნორმაა და ციკლთან ერთად იცვლება, და რომელი ცვლილება — ქავილი, წვა, უჩვეულო ფერი ან სუნი — ღირს ექიმთან მისვლად. MEDICARD მას გამონადენისა და ქავილის ახსნებში იყენებს.',
    url: 'https://www.acog.org/womens-health/faqs/vaginitis',
    checkedAt: '2026-10-04',
  },
  vaginalDischarge: {
    id: 'vaginalDischarge',
    organization: 'National Health Service',
    title: 'Vaginal discharge',
    titleKa: 'საშოს გამონადენი',
    description:
      'NHS describes how discharge normally changes through the cycle (thicker, then clearer and wetter around ovulation) and the changes to see a GP about. MEDICARD uses it for the discharge note.',
    descriptionKa:
      'NHS აღწერს, როგორ იცვლება გამონადენი ციკლის განმავლობაში (სქელი, ოვულაციისას უფრო გამჭვირვალე და სველი) და რა ცვლილებისას მიმართო ექიმს. MEDICARD მას გამონადენის ახსნაში იყენებს.',
    url: 'https://www.nhs.uk/symptoms/vaginal-discharge/',
    checkedAt: '2026-10-04',
  },
  vaginalConditions: {
    id: 'vaginalConditions',
    organization: 'MedlinePlus (U.S. National Library of Medicine)',
    title: 'Vaginal diseases',
    titleKa: 'საშოს პრობლემები',
    description:
      'MedlinePlus overview of common vaginal problems, including dryness and itching, and links to when to see a clinician. MEDICARD uses it for the private dryness note, shown only inside the unlocked private group.',
    descriptionKa:
      'MedlinePlus-ის მიმოხილვა საშოს ხშირ პრობლემებზე, მათ შორის სიმშრალესა და ქავილზე. MEDICARD მას სიმშრალის პირად ახსნაში იყენებს, რომელიც მხოლოდ გახსნილ პირად ჯგუფში ჩანს.',
    url: 'https://medlineplus.gov/vaginaldiseases.html',
    checkedAt: '2026-10-04',
  },
  menopauseSymptoms: {
    id: 'menopauseSymptoms',
    organization: 'MedlinePlus (U.S. National Library of Medicine)',
    title: 'Menopause — health topic',
    titleKa: 'მენოპაუზა',
    description:
      'MedlinePlus explains the years around menopause and common changes such as hot flashes, night sweats and sleep problems. MEDICARD uses it for the hot flash and night sweat notes.',
    descriptionKa:
      'MedlinePlus აღწერს მენოპაუზის გარშემო წლებს და ხშირ ცვლილებებს — ცხელ ტალღებს, ღამის ოფლიანობას, ძილის პრობლემებს. MEDICARD მას ცხელი ტალღებისა და ღამის ოფლიანობის ახსნებში იყენებს.',
    url: 'https://medlineplus.gov/menopause.html',
    checkedAt: '2026-10-04',
  },
  digestiveHealth: {
    id: 'digestiveHealth',
    organization: 'MedlinePlus (U.S. National Library of Medicine)',
    title: 'Digestive diseases',
    titleKa: 'საჭმლის მონელება',
    description:
      'MedlinePlus overview of digestive symptoms such as heartburn, constipation and gas, with links to when to get care. MEDICARD uses it for the digestion notes that are not tied to the cycle.',
    descriptionKa:
      'MedlinePlus-ის მიმოხილვა მონელების ნიშნებზე — გულძმარვა, ყაბზობა, გაზები — და როდის მიმართო ექიმს. MEDICARD მას მონელების ახსნებში იყენებს.',
    url: 'https://medlineplus.gov/digestivediseases.html',
    checkedAt: '2026-10-04',
  },
  headache: {
    id: 'headache',
    organization: 'MedlinePlus (U.S. National Library of Medicine)',
    title: 'Headache — health topic',
    titleKa: 'თავის ტკივილი',
    description:
      'MedlinePlus describes common headaches and the warning signs that need urgent care, such as a sudden, very severe headache or one with weakness or vision changes. MEDICARD repeats those signs in the headache and migraine notes.',
    descriptionKa:
      'MedlinePlus აღწერს ხშირ თავის ტკივილებს და საგანგაშო ნიშნებს, რომლებიც სასწრაფო დახმარებას საჭიროებს — უეცარი, უძლიერესი ტკივილი ან ტკივილი სისუსტით, მხედველობის ცვლილებით. MEDICARD ამ ნიშნებს თავის ტკივილისა და მიგრენის ახსნებში იმეორებს.',
    url: 'https://medlineplus.gov/headache.html',
    checkedAt: '2026-10-04',
  },
  skinAcne: {
    id: 'skinAcne',
    organization: 'MedlinePlus (U.S. National Library of Medicine)',
    title: 'Acne — health topic',
    titleKa: 'აკნე და გამონაყარი',
    description:
      'MedlinePlus explains acne, why hormones can make it flare, and when to see a clinician. MEDICARD uses it for the skin notes.',
    descriptionKa:
      'MedlinePlus აღწერს აკნეს, რატომ შეიძლება ჰორმონებმა გაამძაფროს და როდის მიმართო ექიმს. MEDICARD მას კანის ახსნებში იყენებს.',
    url: 'https://medlineplus.gov/acne.html',
    checkedAt: '2026-10-04',
  },
  hairLoss: {
    id: 'hairLoss',
    organization: 'MedlinePlus (U.S. National Library of Medicine)',
    title: 'Hair loss — health topic',
    titleKa: 'თმის ცვენა',
    description:
      'MedlinePlus explains everyday hair shedding, what can increase it (stress, illness, hormonal changes) and when to see a clinician. MEDICARD uses it for the hair loss note.',
    descriptionKa:
      'MedlinePlus აღწერს ყოველდღიურ თმის ცვენას, რა შეიძლება ზრდიდეს მას (სტრესი, ავადმყოფობა, ჰორმონული ცვლილებები) და როდის მიმართო ექიმს. MEDICARD მას თმის ცვენის ახსნაში იყენებს.',
    url: 'https://medlineplus.gov/hairloss.html',
    checkedAt: '2026-10-04',
  },
  stress: {
    id: 'stress',
    organization: 'MedlinePlus (U.S. National Library of Medicine)',
    title: 'Stress — health topic',
    titleKa: 'სტრესი',
    description:
      'MedlinePlus explains how long-lasting stress affects sleep, mood and the body, and when to ask for help. MEDICARD uses it for the stress, anxiety and stress-level notes.',
    descriptionKa:
      'MedlinePlus აღწერს, როგორ მოქმედებს ხანგრძლივი სტრესი ძილზე, განწყობასა და სხეულზე და როდის ითხოვო დახმარება. MEDICARD მას სტრესისა და შფოთვის ახსნებში იყენებს.',
    url: 'https://medlineplus.gov/stress.html',
    checkedAt: '2026-10-04',
  },
  caffeine: {
    id: 'caffeine',
    organization: 'MedlinePlus (U.S. National Library of Medicine)',
    title: 'Caffeine — health topic',
    titleKa: 'კოფეინი',
    description:
      'MedlinePlus explains where caffeine is found and how too much of it can cause jitters, a fast heartbeat and poor sleep. MEDICARD uses it for the caffeine note.',
    descriptionKa:
      'MedlinePlus აღწერს, სად არის კოფეინი და როგორ შეიძლება ზედმეტმა კოფეინმა გამოიწვიოს კანკალი, გულის აჩქარება და ცუდი ძილი. MEDICARD მას კოფეინის ახსნაში იყენებს.',
    url: 'https://medlineplus.gov/caffeine.html',
    checkedAt: '2026-10-04',
  },
  alcohol: {
    id: 'alcohol',
    organization: 'MedlinePlus (U.S. National Library of Medicine)',
    title: 'Alcohol — health topic',
    titleKa: 'ალკოჰოლი',
    description:
      'MedlinePlus explains how alcohol affects sleep, mood and health, and where to get help when cutting down is hard. MEDICARD uses it for the alcohol note.',
    descriptionKa:
      'MedlinePlus აღწერს, როგორ მოქმედებს ალკოჰოლი ძილზე, განწყობასა და ჯანმრთელობაზე და სად მიიღო დახმარება, თუ შემცირება გიჭირს. MEDICARD მას ალკოჰოლის ახსნაში იყენებს.',
    url: 'https://medlineplus.gov/alcohol.html',
    checkedAt: '2026-10-04',
  },
  pregnancyTest: {
    id: 'pregnancyTest',
    organization: 'MedlinePlus (U.S. National Library of Medicine)',
    title: 'Pregnancy test',
    titleKa: 'ორსულობის ტესტი',
    description:
      'MedlinePlus explains that home pregnancy tests look for the hormone hCG in urine, are most reliable from the day a period is due, and why an early test can be negative. MEDICARD uses it for the pregnancy test note.',
    descriptionKa:
      'MedlinePlus განმარტავს, რომ სახლის ტესტი შარდში hCG ჰორმონს ეძებს, ყველაზე სანდოა მოსალოდნელი მენსტრუაციის დღიდან და რატომ შეიძლება ადრეული ტესტი უარყოფითი იყოს. MEDICARD მას ორსულობის ტესტის ახსნაში იყენებს.',
    url: 'https://medlineplus.gov/lab-tests/pregnancy-test/',
    checkedAt: '2026-10-04',
  },
  healthTopics: {
    id: 'healthTopics',
    organization: 'MedlinePlus (U.S. National Library of Medicine)',
    title: 'Health topics A–Z',
    titleKa: 'ჯანმრთელობის თემები A–Z',
    description:
      'MedlinePlus health topics describe common symptoms such as dizziness, palpitations, fever or swelling, and when to get care. MEDICARD’s notes on these body tiles are general information, not an assessment of your symptoms.',
    descriptionKa:
      'MedlinePlus-ის თემები აღწერს ხშირ ნიშნებს — თავბრუსხვევა, გულის ფრიალი, ცხელება, შეშუპება — და როდის მიმართო ექიმს. MEDICARD-ის ახსნები ზოგადი ინფორმაციაა და შენს ნიშნებს არ აფასებს.',
    url: 'https://medlineplus.gov/healthtopics.html',
    checkedAt: '2026-10-04',
  },
} as const satisfies Record<string, MedicalSource>;

export type MedicalSourceId = keyof typeof medicalSources;

export function sourcesFor(ids: readonly MedicalSourceId[]): MedicalSource[] {
  return ids.map((id) => medicalSources[id]);
}
