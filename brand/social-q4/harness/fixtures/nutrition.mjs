// Nutrition + weight for the MEDICARD web-QA mock (Home layouts standard / women / active / weight and the
// nutrition hub screens they open).
//
// Shapes are copied from the real server:
//   server/src/routes/nutrition.routes.js, nutrition-program.routes.js, nutrition-plus.routes.js,
//   nutrition-fasting.routes.js; server/src/lib/nutrition.js, nutritionProgram.js, nutritionProgramStore.js
//   (nutritionDashboard / nutritionFacts / programState), nutritionPlus.js, nutritionMore.js,
//   nutritionAllergies.js, nutritionFoods.js; catalog values from server/src/data/nutrition-catalog.json and the
//   built-in recipes from server/src/lib/nutritionRecipes.js.
// Client types: mobile/src/lib/nutritionProgram.ts (NutritionDashboard …), mobile/src/lib/nutrition.ts,
//   mobile/src/lib/fasting.ts, mobile/src/types/weightGoal.ts.
//
// Weight contract with the module that owns GET/PUT /api/account/app-state:
//   state.weight = { goal: WeightGoal, logs: WeightLog[] (newest first), measured: [{ date, weightKg }] }
//   `goal` and `logs` are what app-state serves. `measured` is optional: HealthMetricDaily weight rows (a module
//   that handles /api/health-metrics/sync may push { date, weightKg } there). The dashboard reads state.weight on
//   every request, so writes made by other modules show up in facts.current / weightHistory / projection.
import { createHash } from 'node:crypto';
import { addDays, diffDays, isoAt, seeded, tbilisiToday } from '../lib.mjs';

/* ------------------------------------------------------------------ helpers */

const r1 = (n) => Math.round(n * 10) / 10;
const shift = addDays;
const finite = (n) => typeof n === 'number' && Number.isFinite(n);
const isCivil = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v;
const isUuid = (v) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'];
const MEAL_SOURCES = ['manual', 'photo', 'plan', 'text', 'label', 'barcode', 'search', 'saved', 'voice'];
const NUTRIENT_KEYS = ['calories', 'protein', 'carbs', 'fat'];
const MICRO_KEYS = ['fiber', 'sugar', 'sodium'];

/** Deterministic RFC-4122-looking v4 id (server ids are UUIDs and several routes validate them). */
function uuidFrom(seed) {
  const h = createHash('sha1').update(`medicard-mock-nutrition:${seed}`).digest('hex');
  const variant = ((parseInt(h[16], 16) & 3) | 8).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
const freshUuid = () => uuidFrom(`${Date.now()}:${Math.random()}`);
const nowIso = () => new Date().toISOString();

/* ------------------------------------------------------------------ English copy (server: nutritionEnglish) */

const EN = new Map(
  Object.entries({
    // errors
    'აირჩიე მაქსიმუმ 31 დღე.': 'Choose 31 days at most.',
    'ჩანაწერის ნომერი არ ემთხვევა.': "The entry ID doesn't match.",
    'ჩანაწერი ვერ მოიძებნა.': 'Entry not found.',
    'მომავალი დღის კვება ვერ ჩაიწერება.': "You can't log meals for a future day.",
    'არასწორი თარიღი': 'Invalid date',
    'რეცეპტი ვერ მოიძებნა.': 'Recipe not found.',
    'დასაკოპირებელი კვება ვერ მოიძებნა.': 'No meals to copy were found.',
    'მომავალი დღის ვარჯიში ჯერ ვერ ჩაიწერება.': "You can't log a workout for a future day yet.",
    'მომავალი თარიღი ვერ ჩაიწერება.': "You can't log a future date.",
    'ჯერ უპასუხე უსაფრთხოების მოკლე კითხვებს.': 'First answer the short safety questions.',
    'შიმშილი უკვე მიმდინარეობს. ჯერ დაასრულე ის.': 'A fast is already running. End it first.',
    'აირჩიე ახლო პერიოდი.': 'Choose a nearer period.',
    'გეგმა შეიცვალა. განაახლე გვერდი.': 'The plan has changed. Refresh the page.',
    'ახალი რაციონი დღევანდელი ან მომავალი დღიდან შეადგინე.': 'Start a new meal plan from today or a future day.',
    'ჯერ მოქმედი კვების გეგმა შეარჩიე.': 'First choose an active nutrition plan.',
    'ამ ასაკში კვების მიზანი სპეციალისტთან ერთად შეარჩიე.': 'At this age, choose a nutrition goal together with a specialist.',
    'დაკლების მიზანი მიმდინარე წონაზე ნაკლები უნდა იყოს.': 'A weight-loss goal must be below your current weight.',
    'მომატების მიზანი მიმდინარე წონაზე მეტი უნდა იყოს.': 'A weight-gain goal must be above your current weight.',
    'შენარჩუნებისას სამიზნე მიმდინარე წონაა.': 'When maintaining, the target is your current weight.',
    'წონის მიზანი შეიცვალა. კვების გეგმა ხელახლა გადაამოწმე.': 'Your weight goal has changed. Review your nutrition plan again.',
    'მიმდინარე წონა შეიცვალა. დღის სამიზნე ხელახლა გადაამოწმე.': 'Your current weight has changed. Review your daily target again.',
    'გეგმის განახლების დროა — გადაამოწმე წონა, აქტივობა და ჯანმრთელობის ინფორმაცია.': "It's time to update your plan: check your weight, activity and health information.",
    'გეგმა სხვა ეკრანზე შეიცვალა. განაახლე გვერდი და გადაამოწმე.': 'The plan was changed on another screen. Refresh the page and check it.',
    'ჯერ მოქმედი კვების გეგმა გადაამოწმე.': 'First review your active nutrition plan.',
    'კვება ვერ მოიძებნა.': 'Meal not found.',
    'მომავალი კვება მიღებულად ჯერ ვერ ჩაითვლება.': "A future meal can't be marked as eaten yet.",
    'მიღებული კვება დღიურში შეასწორე.': 'Edit an eaten meal in your diary.',
    'ჯერ მოქმედი გეგმა გადაამოწმე.': 'First review your active plan.',
    'ეს კერძი არჩეულ კვებასა და შეზღუდვებს არ შეესაბამება.': "This dish doesn't fit the chosen meal and your restrictions.",
    'მიუთითე მინიმუმ ერთი ზომა.': 'Enter at least one measurement.',
    'ცილის, ნახშირწყლებისა და ცხიმის ჯამი 100% უნდა იყოს.': 'Protein, carbs and fat must add up to 100%.',
    'აღწერე რა მიირთვი — მაგ. „ორი ხინკალი და სალათი“.': 'Describe what you ate, e.g. "two khinkali and a salad".',
    'დაწერე რა უნდა შესწორდეს.': 'Write what should be corrected.',
    'შეავსე ყველა ველი სწორად.': 'Fill in every field correctly.',
    'საწყისი მიახლოებითი გეგმა: ფორმულა და შენ მიერ არჩეული აქტივობა. ვარჯიშის კალორიები ავტომატურად არ ემატება. გადაამოწმე პროგრესი 2–4 კვირაში; ეს ექიმის ან დიეტოლოგის შეფასებას არ ცვლის.':
      "A starting estimate: the formula and the activity you chose. Workout calories aren't added automatically. Check your progress in 2–4 weeks; this doesn't replace an assessment by a doctor or dietitian.",
    // notes, activity and serving labels
    'რაციონიდან დამატებული': 'Added from meal plan',
    'სიარული': 'Walking',
    'სირბილი': 'Running',
    'ველოსიპედი': 'Cycling',
    'ძალოვანი ვარჯიში': 'Strength training',
    'ცურვა': 'Swimming',
    'იოგა / სტრეჩინგი': 'Yoga / stretching',
    'სპორტული თამაში': 'Team sport',
    'ცეკვა': 'Dancing',
    'სხვა აქტივობა': 'Other activity',
    'პორცია': 'serving',
    'ნაჭერი': 'slice',
    'ერთი': 'one',
    'თეფში': 'plate',
    'თასი': 'bowl',
    'ერთი ხინკალი': 'one khinkali',
    'ორი კვერცხი': 'two eggs',
    'ქოთანი': 'pot',
    'ჭიქა': 'glass',
    'სუფრის კოვზი': 'tablespoon',
    'კონა': 'bunch',
    'მტევანი': 'bunch',
    'მუჭა': 'handful',
    'ქილა': 'jar',
    // estimate copy
    'პორცია ფოტოდან შეფასდა. ზეთი და სოუსი ფოტოზე შეიძლება არ ჩანდეს — შენახვამდე გადაამოწმე.':
      "The portion was estimated from the photo. Oil and sauce may not show in a photo, so check before saving.",
    'შეფასება აღწერიდან: რაოდენობა ჩვეული პორციით ავიღე.': 'Estimated from your description: amounts use a typical portion.',
    'აღწერა ზოგადია — პორცია და შემადგენლობა მიახლოებითია.': 'The description is general, so the portion and contents are approximate.',
    'შესწორება გავითვალისწინე.': 'Your correction was applied.',
  }),
);
function translateDeep(value, depth = 0) {
  if (typeof value === 'string') return EN.get(value) ?? value;
  if (!value || typeof value !== 'object' || depth > 12) return value;
  if (Array.isArray(value)) return value.map((v) => translateDeep(v, depth + 1));
  const out = {};
  for (const [k, v] of Object.entries(value)) out[k] = translateDeep(v, depth + 1);
  return out;
}
const out = (rq, body) => (rq.lang === 'en' ? translateDeep(body) : body);
const fail = (rq, status, message) => rq.reply(status, { error: rq.lang === 'en' ? EN.get(message) ?? message : message });

/* ------------------------------------------------------------------ catalog (nutrition-catalog.json subset) */

// [id, name, nameEn, kcal, protein, carbs, fat, fiber, sugar, sodium, servingGrams, servingLabel, quality, aliases]
const CATALOG_ROWS = [
  ['bread_white', 'თეთრი პური', 'White bread', 265, 9, 49, 3.2, 2.7, 5, 490, 40, 'ნაჭერი', 'reference', 'puri bread хлеб'],
  ['shotis_puri', 'შოთის პური', 'Shoti bread', 270, 9, 52, 2, 2.5, 2, 500, 80, 'ნაჭერი', 'estimate', 'shoti tonis puri თონის პური georgian bread'],
  ['lavashi', 'ლავაში', 'Lavash', 275, 9, 55, 1.5, 2, 2, 480, 60, 'ერთი', 'reference', 'lavash лаваш'],
  ['rice_cooked', 'ბრინჯი · მოხარშული', 'Rice · cooked', 130, 2.7, 28, 0.3, 0.4, 0, 1, 150, 'თეფში', 'reference', 'brinji rice рис'],
  ['buckwheat_cooked', 'წიწიბურა · მოხარშული', 'Buckwheat · cooked', 92, 3.4, 19.9, 0.6, 2.7, 0.9, 4, 150, 'თეფში', 'reference', 'tsitsibura buckwheat гречка'],
  ['pasta_cooked', 'მაკარონი · მოხარშული', 'Pasta · cooked', 158, 5.8, 31, 0.9, 1.8, 0.6, 1, 150, 'თეფში', 'reference', 'makaroni pasta spaghetti макароны'],
  ['oatmeal_water', 'შვრიის ფაფა · წყალზე', 'Oatmeal · with water', 71, 2.5, 12, 1.5, 1.7, 0.3, 4, 250, 'თასი', 'reference', 'shvria oatmeal porridge овсянка'],
  ['ghomi', 'ღომი', 'Ghomi (corn porridge)', 90, 1.9, 19.5, 0.4, 1.2, 0.3, 5, 250, 'თეფში', 'estimate', 'gomi ghomi corn grits'],
  ['mchadi', 'მჭადი', 'Mchadi (cornbread)', 220, 5, 40, 4, 3, 1, 300, 100, 'ერთი', 'estimate', 'mchadi cornbread'],
  ['khachapuri_imeruli', 'ხაჭაპური · იმერული', 'Khachapuri · Imeruli', 290, 12, 30, 13, 1.5, 2, 520, 150, 'ნაჭერი', 'estimate', 'khachapuri xachapuri хачапури'],
  ['khachapuri_adjaruli', 'ხაჭაპური · აჭარული', 'Khachapuri · Adjarian', 330, 13, 28, 18, 1.2, 2, 560, 300, 'ერთი', 'estimate', 'adjaruli acharuli khachapuri adjaruli'],
  ['lobiani', 'ლობიანი', 'Lobiani (bean bread)', 250, 8, 32, 10, 4, 1.5, 450, 150, 'ნაჭერი', 'estimate', 'lobiani bean bread'],
  ['khinkali_meat', 'ხინკალი · ხორცით', 'Khinkali · meat', 205, 9, 22, 9, 1, 0.8, 380, 65, 'ერთი ხინკალი', 'estimate', 'khinkali xinkali хинкали'],
  ['khinkali_cheese', 'ხინკალი · ყველით', 'Khinkali · cheese', 230, 10, 24, 11, 1, 1, 450, 60, 'ერთი ხინკალი', 'estimate', 'khinkali cheese ყველიანი ხინკალი'],
  ['potato_boiled', 'კარტოფილი · მოხარშული', 'Potatoes · boiled', 87, 1.9, 20, 0.1, 1.8, 0.9, 4, 150, 'პორცია', 'reference', 'kartopili potato картофель'],
  ['chicken_breast', 'ქათმის მკერდი', 'Chicken breast', 165, 31, 0, 3.6, 0, 0, 74, 120, 'პორცია', 'reference', 'qatami chicken breast курица'],
  ['beef_stew', 'საქონლის ხორცი · ჩაშუშული', 'Beef · stewed', 250, 26, 0, 16, 0, 0, 55, 120, 'პორცია', 'reference', 'saqonlis khortsi beef говядина'],
  ['mtsvadi', 'მწვადი · ღორის', 'Mtsvadi · pork', 280, 25, 0, 20, 0, 0, 400, 150, 'პორცია', 'estimate', 'mtsvadi shashlik шашлык'],
  ['trout', 'კალმახი', 'Trout', 148, 21, 0, 6.6, 0, 0, 50, 150, 'პორცია', 'reference', 'kalmakhi trout форель თევზი'],
  ['salmon', 'ორაგული', 'Salmon', 208, 20, 0, 13, 0, 0, 59, 150, 'პორცია', 'reference', 'oraguli salmon лосось'],
  ['egg', 'კვერცხი · მოხარშული', 'Egg · boiled', 155, 13, 1.1, 11, 0, 1.1, 124, 55, 'ერთი', 'reference', 'kvertskhi egg яйцо'],
  ['fried_eggs', 'ერბოკვერცხი', 'Fried eggs', 196, 14, 0.9, 15, 0, 0.8, 400, 120, 'ორი კვერცხი', 'estimate', 'erbokvertskhi fried eggs яичница'],
  ['omelette', 'ომლეტი', 'Omelette', 154, 11, 1.5, 12, 0, 1.2, 380, 150, 'პორცია', 'reference', 'omleti omelette омлет'],
  ['beans_boiled', 'ლობიო · მოხარშული', 'Beans · boiled', 127, 8.7, 23, 0.5, 6.4, 0.3, 1, 200, 'თასი', 'reference', 'lobio beans фасоль'],
  ['lobio_walnut', 'ლობიო · ნიგვზით', 'Lobio · with walnuts', 160, 8, 18, 7, 6, 1, 350, 250, 'ქოთანი', 'estimate', 'lobio nigvzit georgian beans'],
  ['lentils', 'ოსპი · მოხარშული', 'Lentils · boiled', 116, 9, 20, 0.4, 7.9, 1.8, 2, 200, 'თასი', 'reference', 'ospi lentils чечевица'],
  ['chakhokhbili', 'ჩახოხბილი', 'Chakhokhbili', 190, 18, 4, 11, 1, 2, 350, 250, 'პორცია', 'estimate', 'chakhokhbili чахохбили'],
  ['ojakhuri', 'ოჯახური', 'Ojakhuri', 210, 12, 16, 11, 1.8, 1.5, 380, 300, 'პორცია', 'estimate', 'ojakhuri ojaxuri оджахури'],
  ['chakapuli', 'ჩაქაფული', 'Chakapuli', 140, 14, 3, 8, 1, 1, 350, 300, 'პორცია', 'estimate', 'chakapuli чакапули'],
  ['kharcho', 'ხარჩო', 'Kharcho', 95, 7, 8, 4, 1, 1, 350, 300, 'თასი', 'estimate', 'kharcho xarcho харчо'],
  ['chikhirtma', 'ჩიხირთმა', 'Chikhirtma', 70, 6, 4, 3.5, 0.2, 0.5, 380, 300, 'თასი', 'estimate', 'chikhirtma чихиртма'],
  ['matsoni', 'მაწონი', 'Matsoni', 60, 3.4, 4.5, 3.2, 0, 4.5, 45, 200, 'ჭიქა', 'estimate', 'matsoni мацони'],
  ['yogurt_plain', 'იოგურტი · ნატურალური', 'Yogurt · plain', 61, 3.5, 4.7, 3.3, 0, 4.7, 46, 150, 'ჭიქა', 'reference', 'iogurti yogurt йогурт'],
  ['greek_yogurt', 'ბერძნული იოგურტი', 'Greek yogurt', 97, 9, 3.6, 5, 0, 3.6, 35, 150, 'ჭიქა', 'reference', 'greek yogurt'],
  ['cottage_cheese', 'ხაჭო · 9%', 'Cottage cheese · 9%', 159, 16, 3, 9, 0, 3, 40, 100, 'პორცია', 'estimate', 'khacho cottage cheese творог'],
  ['sulguni', 'სულგუნი', 'Sulguni', 290, 20, 1, 23, 0, 0.5, 900, 50, 'ნაჭერი', 'estimate', 'sulguni сулугуни ყველი'],
  ['imeruli_cheese', 'იმერული ყველი', 'Imeruli cheese', 250, 18, 1, 19, 0, 0.5, 800, 50, 'ნაჭერი', 'estimate', 'imeruli imeretian cheese имеретинский сыр'],
  ['tomato', 'პომიდორი', 'Tomato', 18, 0.9, 3.9, 0.2, 1.2, 2.6, 5, 120, 'ერთი', 'reference', 'pomidori tomato помидор'],
  ['cucumber', 'კიტრი', 'Cucumber', 15, 0.7, 3.6, 0.1, 0.5, 1.7, 2, 100, 'ერთი', 'reference', 'kitri cucumber огурец'],
  ['salad_simple', 'სალათი · კიტრი, პომიდორი, ხახვი', 'Salad · cucumber, tomato, onion', 40, 1, 5, 2, 1.2, 2.5, 150, 200, 'თეფში', 'estimate', 'salati salad салат'],
  ['salad_walnut', 'სალათი · ნიგვზით', 'Salad · with walnuts', 110, 3, 6, 9, 2, 2.5, 200, 200, 'თეფში', 'estimate', 'nigvziani salati walnut salad'],
  ['badrijani', 'ბადრიჯანი · ნიგვზით', 'Eggplant · with walnuts', 200, 4, 8, 17, 3, 3, 300, 150, 'პორცია', 'estimate', 'badrijani eggplant walnut баклажаны с орехами'],
  ['pkhali', 'ფხალი · ისპანახის', 'Pkhali · spinach', 130, 4, 8, 9, 3, 2, 300, 100, 'პორცია', 'estimate', 'pkhali mkhali пхали'],
  ['herbs', 'მწვანილი', 'Fresh herbs', 23, 2.9, 3.6, 0.4, 2.5, 0.8, 40, 20, 'კონა', 'reference', 'mtsvanili herbs зелень ქინძი'],
  ['broccoli', 'ბროკოლი', 'Broccoli', 34, 2.8, 6.6, 0.4, 2.6, 1.7, 33, 100, 'პორცია', 'reference', 'brokoli broccoli брокколи'],
  ['apple', 'ვაშლი', 'Apple', 52, 0.3, 13.8, 0.2, 2.4, 10.4, 1, 180, 'ერთი', 'reference', 'vashli apple яблоко'],
  ['banana', 'ბანანი', 'Banana', 89, 1.1, 22.8, 0.3, 2.6, 12.2, 1, 120, 'ერთი', 'reference', 'banani banana банан'],
  ['orange', 'ფორთოხალი', 'Orange', 47, 0.9, 11.8, 0.1, 2.4, 9.4, 0, 150, 'ერთი', 'reference', 'portokhali orange апельсин'],
  ['mandarin', 'მანდარინი', 'Mandarin', 53, 0.8, 13.3, 0.3, 1.8, 10.6, 2, 80, 'ერთი', 'reference', 'mandarini mandarin tangerine мандарин'],
  ['grapes', 'ყურძენი', 'Grapes', 69, 0.7, 18, 0.2, 0.9, 15.5, 2, 150, 'მტევანი', 'reference', 'qurdzeni grapes виноград'],
  ['persimmon', 'ხურმა', 'Persimmon', 70, 0.6, 18.6, 0.2, 3.6, 12.5, 1, 170, 'ერთი', 'reference', 'khurma persimmon хурма'],
  ['walnut', 'ნიგოზი', 'Walnuts', 654, 15.2, 13.7, 65.2, 6.7, 2.6, 2, 30, 'მუჭა', 'reference', 'nigozi walnut грецкий орех'],
  ['hazelnut', 'თხილი', 'Hazelnuts', 628, 15, 16.7, 60.8, 9.7, 4.3, 0, 30, 'მუჭა', 'reference', 'tkhili hazelnut фундук'],
  ['almond', 'ნუში', 'Almonds', 579, 21, 21.6, 49.9, 12.5, 4.4, 1, 30, 'მუჭა', 'reference', 'nushi almond миндаль'],
  ['churchkhela', 'ჩურჩხელა', 'Churchkhela', 350, 5, 60, 10, 2, 40, 10, 100, 'ერთი', 'estimate', 'churchkhela чурчхела'],
  ['honey', 'თაფლი', 'Honey', 304, 0.3, 82, 0, 0.2, 82, 4, 20, 'სუფრის კოვზი', 'reference', 'tapli honey мёд'],
  ['muesli', 'მიუსლი', 'Muesli', 340, 9, 62, 6, 8, 20, 100, 50, 'პორცია', 'reference', 'miusli muesli granola мюсли'],
  ['coffee_black', 'ყავა · შავი', 'Coffee · black', 2, 0.1, 0, 0, 0, 0, 2, 200, 'ჭიქა', 'reference', 'qava coffee кофе ესპრესო americano'],
  ['coffee_milk_sugar', 'ყავა · რძით და შაქრით', 'Coffee · with milk and sugar', 45, 1.5, 7, 1.4, 0, 6, 20, 200, 'ჭიქა', 'estimate', 'qava rdzit latte cappuccino კაპუჩინო ლატე'],
  ['tea_sugar', 'ჩაი · შაქრით', 'Tea · with sugar', 20, 0, 5, 0, 0, 5, 1, 250, 'ჭიქა', 'reference', 'chai tea чай'],
  ['olive_oil', 'ზეითუნის ზეთი', 'Olive oil', 884, 0, 0, 100, 0, 0, 2, 10, 'სუფრის კოვზი', 'reference', 'zeti olive oil масло'],
  ['tkemali', 'ტყემალი', 'Tkemali', 40, 0.5, 9, 0.2, 1, 6, 400, 30, 'სუფრის კოვზი', 'estimate', 'tkemali ткемали'],
  ['protein_shake', 'პროტეინის შეიქი · წყალზე', 'Protein shake · with water', 40, 8, 1, 0.5, 0, 0.5, 40, 300, 'ერთი', 'estimate', 'proteini protein shake whey'],
];
const CATALOG = CATALOG_ROWS.map(([id, name, nameEn, calories, protein, carbs, fat, fiber, sugar, sodium, grams, label, quality, aliases]) => ({
  id,
  name,
  nameEn,
  aliases: aliases.split(' '),
  per100: { calories, protein, carbs, fat, fiber, sugar, sodium },
  serving: grams ? { grams, label } : null,
  quality,
}));
const FOOD = Object.fromEntries(CATALOG.map((f) => [f.id, f]));
for (const f of CATALOG) EN.set(f.name, f.nameEn);

/** server foodToItem: per-100 g facts → one portion (micronutrients kept when known). */
function foodToItem(food, grams, name = food.name) {
  const ratio = grams / 100;
  const item = { name: (food.brand ? `${name} · ${food.brand}` : name).slice(0, 120), grams: r1(grams) };
  for (const k of NUTRIENT_KEYS) item[k] = r1((food.per100[k] || 0) * ratio);
  for (const k of MICRO_KEYS) if (finite(food.per100[k])) item[k] = r1(food.per100[k] * ratio);
  return item;
}
const item = (id, grams) => foodToItem(FOOD[id], grams);

/* ------------------------------------------------------------------ built-in recipes (nutritionRecipes.js) */

// [id, type, diet, allergens, minutes, title, titleEn, instructions, instructionsEn, fdcIds, items[[name, g, kcal, p, c, f]]]
const RECIPE_ROWS = [
  ['oat-banana', 'breakfast', 'vegan', ['gluten'], 15, 'შვრია ბანანითა და თესლით', 'Oats with banana and seeds', 'შვრია მოხარშე წყალში. დაამატე დაჭრილი ბანანი და თესლი. შვრიის წონა მითითებულია მშრალი სახით.', 'Cook the oats in water. Add sliced banana and the seeds. The oat weight is for dry oats.', '169705, 173944, 170556', [['შვრია · მშრალი', 55, 214, 9.3, 36.4, 3.8], ['ბანანი · გაფცქვნილი', 100, 89, 1.1, 22.8, 0.3], ['გოგრის თესლი · გარჩეული', 15, 83.9, 4.5, 1.6, 7.4]]],
  ['quinoa-apple', 'breakfast', 'vegan', [], 15, 'ქინოას თბილი ჯამი ვაშლით', 'Warm quinoa bowl with apple', 'მოხარშულ ქინოას შეურიე დაჭრილი ვაშლი და თესლი. სურვილისამებრ დაამატე დარიჩინი.', 'Stir chopped apple and the seeds into cooked quinoa. Add cinnamon if you like.', '168917, 171688, 170556', [['ქინოა · მოხარშული', 220, 264, 9.7, 46.9, 4.2], ['ვაშლი · კანით', 120, 62.4, 0.3, 16.6, 0.2], ['გოგრის თესლი · გარჩეული', 20, 111.8, 6, 2.1, 9.8]]],
  ['yogurt-oat', 'breakfast', 'vegetarian', ['milk', 'gluten'], 15, 'იოგურტი შვრიითა და ბანანით', 'Yogurt with oats and banana', 'შვრია დაალბე იოგურტში, მაცივარში. ჭამის წინ დაამატე ბანანი. გამოიყენე უშაქრო იოგურტი.', 'Soak the oats in the yogurt in the fridge. Add the banana just before eating. Use unsweetened yogurt.', '170894, 169705, 173944', [['ბერძნული იოგურტი · უცხიმო', 200, 118, 20.4, 7.2, 0.8], ['შვრია · მშრალი', 45, 175.1, 7.6, 29.8, 3.1], ['ბანანი · გაფცქვნილი', 100, 89, 1.1, 22.8, 0.3]]],
  ['egg-quinoa', 'breakfast', 'vegetarian', ['eggs'], 15, 'კვერცხი ქინოასა და პომიდორთან', 'Egg with quinoa and tomato', 'მოხარშულ კვერცხს დაუმატე მზა ქინოა და გარეცხილი პომიდორი. მოასხი მითითებული ზეთი.', 'Add ready quinoa and a washed tomato to the boiled egg. Drizzle with the listed oil.', '173424, 168917, 170457, 171413', [['კვერცხი · მოხარშული, გარჩეული', 100, 155, 12.6, 1.1, 10.6], ['ქინოა · მოხარშული', 160, 192, 7, 34.1, 3.1], ['პომიდორი · უმი', 120, 21.6, 1.1, 4.7, 0.2], ['ზეითუნის ზეთი', 5, 44.2, 0, 0, 5]]],
  ['lentil-bowl', 'lunch', 'vegan', [], 15, 'ოსპისა და ბრინჯის ჯამი', 'Lentil and rice bowl', 'მოხარშული ოსპი და ბრინჯი შეურიე პომიდორს. მოასხი ზეთი. პარკოსნებისა და ბრინჯის წონა მზა პროდუქტს ეხება.', 'Mix boiled lentils and rice with the tomato. Drizzle with oil. Legume and rice weights are for the cooked product.', '172421, 169704, 170457, 171413', [['ოსპი · მოხარშული', 220, 255.2, 19.8, 44.3, 0.8], ['ყავისფერი ბრინჯი · მოხარშული', 130, 159.9, 3.6, 33.3, 1.3], ['პომიდორი · უმი', 150, 27, 1.3, 5.8, 0.3], ['ზეითუნის ზეთი', 10, 88.4, 0, 0, 10]]],
  ['chickpea-quinoa', 'lunch', 'vegan', [], 15, 'მუხუდო ქინოათი და მწვანილით', 'Chickpeas with quinoa and greens', 'გარეცხილ ისპანახს დაამატე მოხარშული მუხუდო და ქინოა. მოასხი ზეთი და კარგად აურიე.', 'Add boiled chickpeas and quinoa to washed spinach. Drizzle with oil and mix well.', '173757, 168917, 168462, 171413', [['მუხუდო · მოხარშული', 180, 295.2, 15.9, 49.4, 4.7], ['ქინოა · მოხარშული', 140, 168, 6.2, 29.8, 2.7], ['ისპანახი · უმი', 60, 13.8, 1.7, 2.2, 0.2], ['ზეითუნის ზეთი', 8, 70.7, 0, 0, 8]]],
  ['chicken-rice', 'lunch', 'balanced', [], 30, 'ქათამი ბრინჯითა და ბროკოლით', 'Chicken with rice and broccoli', 'ქათამი სრულად მოამზადე. გვერდით დაუმატე მოხარშული ბრინჯი და ბროკოლი, მოასხი ზეთი. წონები მზა პროდუქტს ეხება.', 'Cook the chicken through. Serve with boiled rice and broccoli and drizzle with oil. Weights are for the cooked product.', '171477, 169704, 169967, 171413', [['ქათმის მკერდი · მომზადებული', 130, 214.5, 40.3, 0, 4.6], ['ყავისფერი ბრინჯი · მოხარშული', 200, 246, 5.5, 51.2, 1.9], ['ბროკოლი · მოხარშული', 170, 59.5, 4, 12.2, 0.7], ['ზეითუნის ზეთი', 10, 88.4, 0, 0, 10]]],
  ['salmon-quinoa', 'lunch', 'balanced', ['fish'], 30, 'ორაგული ქინოასა და ბროკოლით', 'Salmon with quinoa and broccoli', 'თევზი სრულად მოამზადე ღუმელში. მიირთვი მოხარშულ ქინოასა და ბროკოლთან ერთად. მითითებულია მზა წონა.', 'Bake the fish until cooked through. Serve with boiled quinoa and broccoli. Cooked weight is listed.', '175168, 168917, 169967, 171413', [['ორაგული · მომზადებული', 130, 267.8, 28.7, 0, 16.1], ['ქინოა · მოხარშული', 180, 216, 7.9, 38.3, 3.5], ['ბროკოლი · მოხარშული', 150, 52.5, 3.6, 10.8, 0.6], ['ზეითუნის ზეთი', 5, 44.2, 0, 0, 5]]],
  ['lentil-salad', 'dinner', 'vegan', [], 15, 'ოსპის თბილი სალათი', 'Warm lentil salad', 'მოხარშულ ოსპსა და ქინოას დაამატე გარეცხილი ბოსტნეული და ზეთი. შეურიე სუნელები სურვილისამებრ.', 'Add washed vegetables and oil to boiled lentils and quinoa. Stir in spices if you like.', '172421, 168917, 170457, 168462, 171413', [['ოსპი · მოხარშული', 240, 278.4, 21.6, 48.3, 0.9], ['ქინოა · მოხარშული', 100, 120, 4.4, 21.3, 1.9], ['პომიდორი · უმი', 150, 27, 1.3, 5.8, 0.3], ['ისპანახი · უმი', 50, 11.5, 1.4, 1.8, 0.2], ['ზეითუნის ზეთი', 8, 70.7, 0, 0, 8]]],
  ['chickpea-rice', 'dinner', 'vegan', [], 15, 'მუხუდო და ბროკოლი', 'Chickpeas and broccoli', 'მოხარშულ მუხუდოსა და ბრინჯს შეურიე ბროკოლი. მითითებული ზეთი დაამატე ბოლოს.', 'Mix the broccoli into boiled chickpeas and rice. Add the listed oil at the end.', '173757, 169704, 169967, 171413', [['მუხუდო · მოხარშული', 180, 295.2, 15.9, 49.4, 4.7], ['ყავისფერი ბრინჯი · მოხარშული', 100, 123, 2.7, 25.6, 1], ['ბროკოლი · მოხარშული', 180, 63, 4.3, 12.9, 0.7], ['ზეითუნის ზეთი', 8, 70.7, 0, 0, 8]]],
  ['chicken-salad', 'dinner', 'balanced', [], 25, 'ქათმის მსუბუქი ჯამი', 'Light chicken bowl', 'სრულად მომზადებული ქათამი დაჭერი, შეურიე ქინოა და გარეცხილი ბოსტნეული. მოასხი ზეთი.', 'Chop fully cooked chicken and mix with quinoa and washed vegetables. Drizzle with oil.', '171477, 168917, 170457, 168462, 171413', [['ქათმის მკერდი · მომზადებული', 120, 198, 37.2, 0, 4.3], ['ქინოა · მოხარშული', 150, 180, 6.6, 32, 2.9], ['პომიდორი · უმი', 150, 27, 1.3, 5.8, 0.3], ['ისპანახი · უმი', 50, 11.5, 1.4, 1.8, 0.2], ['ზეითუნის ზეთი', 10, 88.4, 0, 0, 10]]],
  ['eggs-lentil', 'dinner', 'vegetarian', ['eggs'], 15, 'ოსპი კვერცხით', 'Lentils with egg', 'მოხარშულ ოსპს დაუმატე დაჭრილი მოხარშული კვერცხი და პომიდორი. მოასხი ზეთი.', 'Add a chopped boiled egg and tomato to boiled lentils. Drizzle with oil.', '173424, 172421, 170457, 171413', [['კვერცხი · მოხარშული, გარჩეული', 100, 155, 12.6, 1.1, 10.6], ['ოსპი · მოხარშული', 180, 208.8, 16.2, 36.2, 0.7], ['პომიდორი · უმი', 120, 21.6, 1.1, 4.7, 0.2], ['ზეითუნის ზეთი', 5, 44.2, 0, 0, 5]]],
  ['apple-seeds', 'snack', 'vegan', [], 5, 'ვაშლი და გოგრის თესლი', 'Apple and pumpkin seeds', 'ვაშლი გარეცხე და დაჭერი. მიირთვი გარჩეულ გოგრის თესლთან ერთად.', 'Wash and slice the apple. Eat it with shelled pumpkin seeds.', '171688, 170556', [['ვაშლი · კანით', 160, 83.2, 0.4, 22.1, 0.3], ['გოგრის თესლი · გარჩეული', 20, 111.8, 6, 2.1, 9.8]]],
  ['banana-walnut', 'snack', 'vegan', ['nuts'], 5, 'ბანანი და ნიგოზი', 'Banana and walnuts', 'ბანანი დაჭერი, დაუმატე გარჩეული ნიგოზი. წონები საკვებ ნაწილს ეხება.', 'Slice the banana and add shelled walnuts. Weights are for the edible part.', '173944, 170187', [['ბანანი · გაფცქვნილი', 100, 89, 1.1, 22.8, 0.3], ['ნიგოზი · გარჩეული', 15, 98.1, 2.3, 2.1, 9.8]]],
  ['yogurt-apple', 'snack', 'vegetarian', ['milk'], 5, 'იოგურტი ვაშლით', 'Yogurt with apple', 'უშაქრო იოგურტს შეურიე გარეცხილი, დაჭრილი ვაშლი.', 'Mix a washed, chopped apple into unsweetened yogurt.', '170894, 171688', [['ბერძნული იოგურტი · უცხიმო', 170, 100.3, 17.3, 6.1, 0.7], ['ვაშლი · კანით', 130, 67.6, 0.3, 18, 0.2]]],
];
const RECIPE_FOOD_EN = {
  'შვრია · მშრალი': 'Oats · dry', 'ბანანი · გაფცქვნილი': 'Banana · peeled', 'გოგრის თესლი · გარჩეული': 'Pumpkin seeds · shelled',
  'ქინოა · მოხარშული': 'Quinoa · cooked', 'ვაშლი · კანით': 'Apple · with skin', 'ბერძნული იოგურტი · უცხიმო': 'Greek yogurt · nonfat',
  'კვერცხი · მოხარშული, გარჩეული': 'Egg · boiled, peeled', 'პომიდორი · უმი': 'Tomato · raw', 'ზეითუნის ზეთი': 'Olive oil',
  'ოსპი · მოხარშული': 'Lentils · boiled', 'ყავისფერი ბრინჯი · მოხარშული': 'Brown rice · cooked', 'მუხუდო · მოხარშული': 'Chickpeas · boiled',
  'ისპანახი · უმი': 'Spinach · raw', 'ქათმის მკერდი · მომზადებული': 'Chicken breast · cooked', 'ბროკოლი · მოხარშული': 'Broccoli · boiled',
  'ორაგული · მომზადებული': 'Salmon · cooked', 'ნიგოზი · გარჩეული': 'Walnuts · shelled',
};
for (const [ka, en] of Object.entries(RECIPE_FOOD_EN)) EN.set(ka, en);
const RECIPES = RECIPE_ROWS.map(([id, type, diet, allergens, minutes, title, titleEn, instructions, instructionsEn, fdc, items]) => {
  EN.set(title, titleEn);
  EN.set(instructions, instructionsEn);
  return {
    id,
    active: true,
    data: {
      title,
      type,
      diet,
      allergens,
      items: items.map(([name, grams, calories, protein, carbs, fat]) => ({ name, grams, calories, protein, carbs, fat })),
      instructions,
      minutes,
      source: `USDA FoodData Central · SR Legacy · ${fdc}`,
    },
  };
});
const RECIPE_BY_ID = Object.fromEntries(RECIPES.map((r) => [r.id, r]));
const FRACTIONS = { breakfast: 0.25, lunch: 0.35, dinner: 0.3, snack: 0.1 };

/* ------------------------------------------------------------------ server math (ported) */

/** server/src/lib/nutrition.js totals(). */
function totals(items) {
  const t = Object.fromEntries(NUTRIENT_KEYS.map((k) => [k, r1(items.reduce((s, i) => s + (i[k] || 0), 0))]));
  for (const k of MICRO_KEYS) {
    const known = items.filter((i) => finite(i[k]));
    t[k] = known.length && known.length === items.length ? r1(known.reduce((s, i) => s + i[k], 0)) : null;
  }
  return t;
}
/** server/src/lib/nutrition.js healthScore(). */
function healthScore(items) {
  if (!items?.length) return null;
  const t = totals(items);
  if (t.calories <= 0) return null;
  const grams = items.reduce((s, i) => s + i.grams, 0) || 1;
  const proteinShare = (t.protein * 4) / t.calories;
  const fatShare = (t.fat * 9) / t.calories;
  const density = t.calories / grams;
  let score = 6;
  score += Math.min(2, proteinShare * 6);
  if (fatShare > 0.45) score -= (fatShare - 0.45) * 5;
  if (density > 2.5) score -= Math.min(2, (density - 2.5) * 1.2);
  else if (density < 1.2) score += 0.5;
  if (t.fiber != null) score += Math.min(1.5, (t.fiber / t.calories) * 400);
  if (t.sugar != null) {
    const sugarShare = (t.sugar * 4) / t.calories;
    if (sugarShare > 0.15) score -= Math.min(2.5, (sugarShare - 0.15) * 10);
  }
  if (t.sodium != null) {
    const perKcal = t.sodium / t.calories;
    if (perKcal > 1.2) score -= Math.min(2, (perKcal - 1.2) * 1.5);
  }
  return Math.max(1, Math.min(10, Math.round(score)));
}
const publicMeal = (row) => ({ ...row, totals: totals(row.items), healthScore: healthScore(row.items) });
const mealSummary = (m) => ({ id: m.id, date: m.date, type: m.type, title: m.title || '', source: m.source, names: m.items.map((i) => i.name), totals: totals(m.items) });

const MILESTONES = [3, 7, 14, 30, 60, 100, 365];
function computeStreak(dates, today) {
  const set = new Set(dates);
  let cursor = set.has(today) ? today : shift(today, -1);
  let current = 0;
  while (set.has(cursor) && current < 3660) {
    current++;
    cursor = shift(cursor, -1);
  }
  let best = 0;
  let run = 0;
  let previous = null;
  for (const d of [...set].sort()) {
    run = previous && shift(previous, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    previous = d;
  }
  return {
    current,
    best: Math.max(best, current),
    loggedToday: set.has(today),
    nextMilestone: MILESTONES.find((m) => m > current) || null,
    reached: MILESTONES.filter((m) => m <= Math.max(best, current)),
  };
}
const ACTIVITY_KINDS = {
  walk: { met: 3.5, label: 'სიარული' },
  run: { met: 9.8, label: 'სირბილი' },
  cycle: { met: 7.5, label: 'ველოსიპედი' },
  strength: { met: 5, label: 'ძალოვანი ვარჯიში' },
  swim: { met: 7, label: 'ცურვა' },
  yoga: { met: 2.5, label: 'იოგა / სტრეჩინგი' },
  hiit: { met: 8, label: 'HIIT' },
  sport: { met: 7, label: 'სპორტული თამაში' },
  dance: { met: 5.5, label: 'ცეკვა' },
  other: { met: 4, label: 'სხვა აქტივობა' },
};
function activityKcal(kind, minutes, weightKg = 70) {
  const met = ACTIVITY_KINDS[kind]?.met || 4;
  const kg = finite(weightKg) && weightKg > 0 ? weightKg : 70;
  return Math.round(((met * 3.5 * kg) / 200) * minutes);
}
function stepsKcal(steps, weightKg = 70) {
  const kg = finite(weightKg) && weightKg > 0 ? weightKg : 70;
  return Math.round(Math.max(0, steps || 0) * kg * 0.00057);
}
const ROLLOVER_CAP = 200;
function energyBudget({ target, preferences, burned, yesterday }) {
  if (!target) return { budget: null, rollover: 0, burnedCounted: 0 };
  const rollover =
    preferences.rollover && yesterday?.target && yesterday.recorded
      ? Math.max(0, Math.min(ROLLOVER_CAP, Math.round(yesterday.target - yesterday.eaten)))
      : 0;
  const burnedCounted = preferences.addBurned ? Math.max(0, Math.round(burned || 0)) : 0;
  return { budget: target + burnedCounted + rollover, rollover, burnedCounted };
}
function weightProjection(history, goal, today, pacePerWeek) {
  const points = (history || []).filter((p) => finite(p.weightKg) && p.date <= today).slice(-28);
  const current = points.at(-1)?.weightKg ?? null;
  const target = goal?.targetKg ?? null;
  const res = { current, target, trendKgPerWeek: null, trendEta: null, planEta: null, direction: null, remainingKg: null };
  if (current == null || target == null) return res;
  res.remainingKg = r1(target - current);
  res.direction = res.remainingKg < 0 ? 'down' : res.remainingKg > 0 ? 'up' : 'reached';
  if (res.direction !== 'reached' && pacePerWeek > 0)
    res.planEta = shift(today, Math.min(730, Math.ceil((Math.abs(res.remainingKg) / pacePerWeek) * 7)));
  if (points.length >= 3) {
    const t0 = Date.parse(points[0].date);
    const xs = points.map((p) => (Date.parse(p.date) - t0) / 86400000);
    const ys = points.map((p) => p.weightKg);
    if (xs.at(-1) >= 7) {
      const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
      const my = ys.reduce((a, b) => a + b, 0) / ys.length;
      const slope = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0) / (xs.reduce((s, x) => s + (x - mx) ** 2, 0) || 1);
      res.trendKgPerWeek = Math.round(slope * 7 * 100) / 100;
      const toward = res.direction === 'down' ? slope < -0.005 : slope > 0.005;
      if (toward && res.direction !== 'reached') {
        const days = Math.abs(res.remainingKg / slope);
        res.trendEta = days <= 730 ? shift(today, Math.ceil(days)) : null;
      }
    }
  }
  return res;
}
function weekSummary(days) {
  const recorded = days.filter((d) => d.recorded);
  const withTarget = recorded.filter((d) => d.target?.calories);
  const onTarget = withTarget.filter((d) => d.totals.calories <= d.target.calories * 1.05 && d.totals.calories >= d.target.calories * 0.6);
  const balance = withTarget.reduce((s, d) => s + (d.totals.calories - d.target.calories), 0);
  return {
    recordedDays: recorded.length,
    targetDays: withTarget.length,
    onTargetDays: onTarget.length,
    averageCalories: recorded.length ? Math.round(recorded.reduce((s, d) => s + d.totals.calories, 0) / recorded.length) : null,
    balanceCalories: withTarget.length ? Math.round(balance) : null,
    averageProtein: recorded.length ? Math.round(recorded.reduce((s, d) => s + d.totals.protein, 0) / recorded.length) : null,
  };
}
function summarizeDays(meals, from, count, history) {
  return Array.from({ length: count }, (_, i) => {
    const date = shift(from, i);
    const rows = meals.filter((m) => m.date === date);
    const target = history.filter((h) => h.date <= date).sort((a, b) => b.date.localeCompare(a.date))[0]?.targets || null;
    return { date, mealCount: rows.length, recorded: rows.length > 0, totals: totals(rows.flatMap((r) => r.items)), target };
  });
}
function applyMacroSplit(targets, macros) {
  if (!targets?.calories || macros?.mode !== 'custom') return targets;
  const kcal = targets.calories;
  return {
    ...targets,
    protein: Math.round((kcal * macros.protein) / 100 / 4),
    carbs: Math.round((kcal * macros.carbs) / 100 / 4),
    fat: Math.round((kcal * macros.fat) / 100 / 9),
    split: { protein: macros.protein, carbs: macros.carbs, fat: macros.fat },
  };
}
function portionRecipe(recipe, calories) {
  const r = recipe.data || recipe;
  const ratio = calories / totals(r.items).calories;
  if (!finite(ratio) || ratio < 0.2 || ratio > 5) return null;
  const items = r.items.map((i) => ({ ...i, ...Object.fromEntries(['grams', 'calories', 'protein', 'carbs', 'fat'].map((k) => [k, r1(i[k] * ratio)])) }));
  return {
    title: r.title,
    items,
    instructions: r.instructions,
    minutes: r.minutes,
    allergens: r.allergens,
    source: r.source,
    servings: Math.round(ratio * 100) / 100,
    totals: totals(items),
  };
}
function recipeAllowed(recipe, config) {
  const r = recipe.data || recipe;
  if (recipe.active === false) return false;
  if (config.diet === 'vegan' && r.diet !== 'vegan') return false;
  if (config.diet === 'vegetarian' && r.diet === 'balanced') return false;
  return !r.allergens.some((a) => config.allergens.includes(a));
}
function shoppingList(planned) {
  const map = new Map();
  for (const meal of planned) for (const it of (meal.data || meal).items) map.set(it.name, (map.get(it.name) || 0) + it.grams);
  return [...map].map(([name, grams]) => ({ name, grams: Math.round(grams) }));
}

/* allergies (nutritionAllergies.js) */
const ALLERGEN_PATTERNS = {
  milk: /milk|dairy|რძ|ლაქტოზ/i,
  eggs: /egg|კვერცხ/i,
  fish: /\bfish\b|თევზ/i,
  shellfish: /shellfish|crustacean|shrimp|prawn|კიბოსნაირ|კრევეტ/i,
  nuts: /\bnuts?\b|walnut|almond|hazelnut|თხილ|ნიგო|ნუშ/i,
  peanuts: /peanut|მიწის თხილ/i,
  soy: /\bsoy\b|soya|სოია/i,
  gluten: /gluten|wheat|გლუტენ|ხორბალ/i,
  sesame: /sesame|სეზამ/i,
  celery: /celery|ნიახურ/i,
  mustard: /mustard|მდოგვ/i,
  sulphites: /sulph?ites|sulfites|სულფიტ/i,
  lupin: /lupin|ლუპინ/i,
  molluscs: /mollus[ck]|mussel|oyster|squid|მოლუსკ|მიდი|ხამანწკ|კალმარ/i,
};
const ALLERGENS = Object.keys(ALLERGEN_PATTERNS);
function profileNutritionAllergies(values) {
  const labels = [...new Set((Array.isArray(values) ? values : []).filter((v) => typeof v === 'string' && v.trim()).map((v) => v.trim()))];
  const required = new Set();
  const unclassifiedAllergies = [];
  for (const label of labels) {
    const withoutPeanut = label.replace(/peanuts?|მიწის თხილ\S*/gi, '');
    Object.entries(ALLERGEN_PATTERNS)
      .filter(([key, pattern]) => pattern.test(key === 'nuts' ? withoutPeanut : label))
      .forEach(([key]) => required.add(key));
    const parts = label
      .replace(/ალერგია|\ballerg(?:y|ies)\b/gi, '')
      .trim()
      .split(/[,;/+&]|\s+(?:და|and)\s+/i)
      .map((v) => v.trim())
      .filter(Boolean);
    const knownOnly =
      parts.length &&
      parts.every((part) => Object.values(ALLERGEN_PATTERNS).some((pattern) => new RegExp(`^(?:${pattern.source})(?:[ა-ჰ]{0,8})?$`, 'i').test(part)));
    if (!knownOnly) unclassifiedAllergies.push(label);
  }
  return { requiredAllergens: [...required], unclassifiedAllergies, unknownAllergies: unclassifiedAllergies.length > 0 };
}
function nutritionMealPlanning(config, facts = {}) {
  const reasons = [];
  const labels = facts.unclassifiedAllergies || [];
  const unresolvedAllergies = labels.filter((label) => {
    const answers = (config.allergyClarifications || []).filter((a) => a.label === label);
    if (answers.length !== 1) return true;
    const a = answers[0];
    return a.kind !== 'non_food' && !(a.kind === 'food' && a.allergens.length && a.allergens.every((x) => config.allergens.includes(x)));
  });
  if (unresolvedAllergies.length)
    reasons.push(`პროფილის ჩანაწერი დასაზუსტებელია: ${unresolvedAllergies.map((v) => `„${v}“`).join(', ')}. კვების არჩევანში მიუთითე, უკავშირდება თუ არა საკვებს და რომელი ალერგენები უნდა გამოირიცხოს.`);
  if (facts.unknownAllergies && !labels.length) reasons.push('პროფილის ალერგიები დააზუსტე კვების არჩევანში.');
  if ((facts.requiredAllergens || []).some((a) => !config.allergens.includes(a))) reasons.push('პროფილში მითითებული საკვები ალერგენები განახლდა. გადაამოწმე კვების არჩევანი.');
  if (config.avoidFoods?.trim())
    reasons.push(`დამატებითი შეზღუდვა: „${config.avoidFoods.trim()}“. ამ ტექსტს რეცეპტების ინგრედიენტებს საიმედოდ ვერ ვუსადაგებთ; რაციონი სპეციალისტთან შეარჩიე. დღის სამიზნე და დღიური ხელმისაწვდომია.`);
  return { eligible: reasons.length === 0, reasons, unresolvedAllergies };
}

/* program assessment (nutritionProgram.js assessNutritionProgram, without zod) */
const METHOD = 'Mifflin–St Jeor';
const EXPLANATION =
  'საწყისი მიახლოებითი გეგმა: ფორმულა და შენ მიერ არჩეული აქტივობა. ვარჯიშის კალორიები ავტომატურად არ ემატება. გადაამოწმე პროგრესი 2–4 კვირაში; ეს ექიმის ან დიეტოლოგის შეფასებას არ ცვლის.';
function ageOn(birth, day) {
  const b = String(birth || '').slice(0, 10);
  if (!isCivil(b)) return null;
  return Number(day.slice(0, 4)) - Number(b.slice(0, 4)) - (day.slice(5) < b.slice(5) ? 1 : 0);
}
function validProgramInput(raw) {
  const v = raw && typeof raw === 'object' ? raw : null;
  if (!v) return null;
  const okNum = (n, lo, hi) => finite(n) && n >= lo && n <= hi;
  if (!['lose', 'maintain', 'gain'].includes(v.mode)) return null;
  if (!okNum(v.weightKg, 30, 300) || !okNum(v.targetKg, 30, 300) || !okNum(v.heightCm, 130, 220)) return null;
  if (!isCivil(v.birthDate) || !['female', 'male'].includes(v.sex)) return null;
  if (!['sedentary', 'light', 'moderate', 'active'].includes(v.activity) || !['gentle', 'steady'].includes(v.pace)) return null;
  if (!['balanced', 'vegetarian', 'vegan'].includes(v.diet)) return null;
  if (!Array.isArray(v.allergens) || v.allergens.some((a) => !ALLERGENS.includes(a))) return null;
  if (typeof v.avoidFoods !== 'string' || !v.screening || typeof v.screening !== 'object') return null;
  return {
    mode: v.mode,
    weightKg: v.weightKg,
    heightCm: v.heightCm,
    birthDate: v.birthDate,
    sex: v.sex,
    targetKg: v.targetKg,
    activity: v.activity,
    pace: v.pace,
    diet: v.diet,
    allergens: [...v.allergens],
    avoidFoods: v.avoidFoods.trim().slice(0, 300),
    allergyClarifications: Array.isArray(v.allergyClarifications) ? v.allergyClarifications : [],
    screening: {
      pregnancyOrBreastfeeding: !!v.screening.pregnancyOrBreastfeeding,
      eatingDisorder: !!v.screening.eatingDisorder,
      medicalDiet: !!v.screening.medicalDiet,
    },
  };
}
function assessProgram(rawInput, facts, day) {
  const input = validProgramInput(rawInput);
  if (!input) return null;
  input.allergens = [
    ...new Set([
      ...input.allergens,
      ...(facts.requiredAllergens || []),
      ...input.allergyClarifications.filter((a) => a.kind === 'food' && (facts.unclassifiedAllergies || []).includes(a.label)).flatMap((a) => a.allergens || []),
    ]),
  ];
  const age = ageOn(input.birthDate, day);
  const profileAge = facts.birthDate ? ageOn(facts.birthDate, day) : age;
  const bmi = input.weightKg / (input.heightCm / 100) ** 2;
  const targetBmi = input.targetKg / (input.heightCm / 100) ** 2;
  const reasons = [];
  if (age == null || profileAge == null || age < 19 || age > 78 || profileAge < 19 || profileAge > 78) reasons.push('ამ ასაკში კვების მიზანი სპეციალისტთან ერთად შეარჩიე.');
  if (facts.sensitiveRestriction || input.screening.pregnancyOrBreastfeeding) reasons.push('ამ ეტაპზე კალორიული გეგმა სპეციალისტთან ერთად უნდა შეარჩიო.');
  if (input.screening.eatingDisorder)
    reasons.push('კვებითი ქცევის სირთულისას გირჩევ სპეციალისტის მხარდაჭერას; აპი კალორიების სამიზნეს არ დაგინიშნავს.');
  if (facts.medicalRestriction || input.screening.medicalDiet)
    reasons.push('ჯანმრთელობის მდგომარეობის ან სამკურნალო დიეტის გამო პერსონალური გეგმა ექიმმა ან დიეტოლოგმა უნდა შეარჩიოს.');
  if (bmi < 18.5 || bmi >= 40 || targetBmi < 18.5 || targetBmi >= 40) reasons.push('მიმდინარე ან სასურველი წონისთვის ინდივიდუალური შეფასებაა საჭირო.');
  if (input.mode === 'lose' && input.targetKg >= input.weightKg) reasons.push('დაკლების მიზანი მიმდინარე წონაზე ნაკლები უნდა იყოს.');
  if (input.mode === 'gain' && input.targetKg <= input.weightKg) reasons.push('მომატების მიზანი მიმდინარე წონაზე მეტი უნდა იყოს.');
  if (input.mode === 'maintain' && Math.abs(input.targetKg - input.weightKg) > 0.1) reasons.push('შენარჩუნებისას სამიზნე მიმდინარე წონაა.');
  const bmr = 10 * input.weightKg + 6.25 * input.heightCm - 5 * age + (input.sex === 'male' ? 5 : -161);
  const multiplier = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725 }[input.activity];
  const maintenance = Math.round((bmr * multiplier) / 10) * 10;
  const adjustment = input.mode === 'lose' ? -(input.pace === 'gentle' ? 250 : 400) : input.mode === 'gain' ? 200 : 0;
  const calories = Math.round((maintenance + adjustment) / 10) * 10;
  if (calories < 1500 || calories > 3500) reasons.push('გამოთვლილი საჭიროება აპის ავტომატური გეგმის ფარგლებს სცდება — შეარჩიე სპეციალისტთან.');
  return {
    eligible: reasons.length === 0,
    reasons,
    mealPlanning: nutritionMealPlanning(input, facts),
    methodVersion: '2026-09-24.1',
    targets: reasons.length ? null : targetsFor(calories, maintenance, adjustment),
    explanation: EXPLANATION,
    input,
  };
}
function targetsFor(calories, maintenance, adjustment = -400) {
  return {
    calories,
    protein: Math.round((calories * 0.2) / 4),
    carbs: Math.round((calories * 0.5) / 4),
    fat: Math.round((calories * 0.3) / 9),
    maintenance,
    adjustment,
    method: METHOD,
  };
}
function programGoalChanged(program, weightGoal) {
  if (!program) return false;
  if (program.goalLink) return program.goalLink.id !== weightGoal?.id || program.goalLink.targetKg !== weightGoal?.targetKg;
  return !!weightGoal && finite(program.config?.targetKg) && weightGoal.targetKg !== program.config.targetKg;
}
function programState(program, facts, today) {
  if (!program) return { program: null, needsReview: false, reasons: [], targets: null };
  const review = assessProgram(program.config, facts, today);
  const reasons = [...(review?.reasons || [])];
  if (programGoalChanged(program, facts.weightGoal)) reasons.push('წონის მიზანი შეიცვალა. კვების გეგმა ხელახლა გადაამოწმე.');
  if (facts.current && Math.abs(facts.current.kg - program.config.weightKg) >= 2) reasons.push('მიმდინარე წონა შეიცვალა. დღის სამიზნე ხელახლა გადაამოწმე.');
  if (today > shift(program.startedOn, 28)) reasons.push('გეგმის განახლების დროა — გადაამოწმე წონა, აქტივობა და ჯანმრთელობის ინფორმაცია.');
  return {
    program,
    mealPlanning: nutritionMealPlanning(program.config, facts),
    needsReview: reasons.length > 0,
    reasons,
    targets: program.active && !reasons.length ? program.targets : null,
  };
}

/* fasting (nutritionMore.js) */
const FASTING_PROTOCOLS = { '12:12': 720, '14:10': 840, '16:8': 960, '18:6': 1080, '20:4': 1200 };
const FAST_MIN = 600;
const FAST_MAX = 1200;
function publicFast(row, now = new Date()) {
  const end = row.endedAt ? new Date(row.endedAt) : now;
  const minutes = Math.max(0, Math.round((end.getTime() - new Date(row.startedAt).getTime()) / 60000));
  return {
    id: row.id,
    startedAt: new Date(row.startedAt).toISOString(),
    endedAt: row.endedAt ? new Date(row.endedAt).toISOString() : null,
    targetMinutes: row.targetMinutes,
    protocol: row.protocol,
    note: row.note || '',
    minutes,
    completed: minutes >= row.targetMinutes,
    goalAt: new Date(new Date(row.startedAt).getTime() + row.targetMinutes * 60000).toISOString(),
  };
}
function fastingStats(fasts, now = new Date()) {
  const done = fasts.filter((f) => f.endedAt).map((f) => publicFast(f, now));
  const today = tbilisiToday(now);
  const dayOf = (d) => tbilisiToday(new Date(d));
  const weekFrom = shift(today, -6);
  const week = done.filter((f) => dayOf(f.endedAt) >= weekFrom);
  const completedDays = new Set(done.filter((f) => f.completed).map((f) => dayOf(f.endedAt)));
  let cursor = completedDays.has(today) ? today : shift(today, -1);
  let streak = 0;
  while (completedDays.has(cursor) && streak < 3660) {
    streak++;
    cursor = shift(cursor, -1);
  }
  return {
    total: done.length,
    completed: done.filter((f) => f.completed).length,
    week: {
      count: week.length,
      completed: week.filter((f) => f.completed).length,
      averageMinutes: week.length ? Math.round(week.reduce((s, f) => s + f.minutes, 0) / week.length) : null,
    },
    longestMinutes: done.reduce((m, f) => Math.max(m, f.minutes), 0) || null,
    streak,
  };
}
function fastingEligibility({ facts, screening, programConfig, today }) {
  const blocks = [];
  const age = facts?.birthDate ? ageOn(facts.birthDate, today) : null;
  if (age != null && age < 18) blocks.push('18 წლამდე შიმშილის ფანჯრებს არ გირჩევთ — ზრდის პერიოდში რეგულარული კვება მნიშვნელოვანია.');
  if (facts?.sensitiveRestriction || screening?.pregnancy || programConfig?.screening?.pregnancyOrBreastfeeding)
    blocks.push('ორსულობისა და ძუძუთი კვების პერიოდში შიმშილის ტაიმერი არ გამოიყენება.');
  if (screening?.eatingDisorder || programConfig?.screening?.eatingDisorder)
    blocks.push('კვებითი ქცევის სირთულის ისტორიისას შიმშილის ფანჯრები შეიძლება ზიანის მომტანი იყოს. ტაიმერს არ ვთავაზობთ — სჯობს სპეციალისტის მხარდაჭერა.');
  const needsDoctor = !!(screening?.diabetesMedication || facts?.medicalRestriction || programConfig?.screening?.medicalDiet);
  const doctorReasons = [];
  if (screening?.diabetesMedication) doctorReasons.push('ინსულინი ან შაქრის დამწევი წამალი შიმშილისას საშიშად დაბალი შაქრის რისკს ზრდის.');
  else if (needsDoctor) doctorReasons.push('ჯანმრთელობის პროფილში ქრონიკული მდგომარეობა ან სამკურნალო დიეტაა მონიშნული.');
  const answered = !!screening?.answeredAt;
  const doctorOk = !needsDoctor || !!screening?.doctorApproved;
  return {
    eligible: answered && blocks.length === 0 && doctorOk,
    needsScreening: !answered,
    blocked: blocks.length > 0,
    reasons: blocks,
    needsDoctor: needsDoctor && blocks.length === 0,
    doctorReasons,
    maxMinutes: FAST_MAX,
  };
}

/* ------------------------------------------------------------------ scenario */

// Weight: 96.0 → 85.0 kg goal, 92.4 kg weighed today. [day offset, kg, Tbilisi time]
const WEIGHT_POINTS = [
  [-63, 96.0, '08:05'],
  [-56, 95.6, '07:50'],
  [-49, 95.3, '08:10'],
  [-42, 94.8, '07:45'],
  [-35, 94.4, '08:00'],
  [-28, 94.0, '07:55'],
  [-20, 93.4, null], // saved with the nutrition plan (server: wlog-nutrition-<day>)
  [-14, 93.1, '07:40'],
  [-7, 92.8, '08:15'],
  [-3, 92.6, '07:35'],
  [0, 92.4, '07:50'],
];
const GOAL = { startKg: 96.0, targetKg: 85.0, startOffset: -63, programOffset: -20, programKg: 93.4, paceKgPerWeek: 0.4 };
const PLAN_KCAL = 2180;
const PLAN_MAINTENANCE = 2580;
const OLD_KCAL = 2220;
const OLD_MAINTENANCE = 2620;

// Today: breakfast + lunch + snack = 1 240 kcal exactly.
const TODAY_MEALS = [
  { type: 'breakfast', time: '08:40', source: 'photo', title: 'ერბოკვერცხი შოთის პურით და სალათით', titleEn: 'Fried eggs with shoti bread and salad', foods: [['fried_eggs', 120], ['shotis_puri', 40], ['tomato', 160], ['cucumber', 100], ['coffee_black', 200]] },
  { type: 'lunch', time: '13:50', source: 'search', title: '', foods: [['lobio_walnut', 250], ['mchadi', 100], ['herbs', 20]] },
  { type: 'snack', time: '17:05', source: 'manual', title: '', foods: [['apple', 180], ['walnut', 20]] },
];
// Earlier days rotate through these (each ≈ 1 850–2 020 kcal, inside the on-target band of a 2 180 plan).
const DAY_TEMPLATES = [
  [
    { type: 'breakfast', time: '08:20', source: 'saved', title: '', foods: [['oatmeal_water', 300], ['banana', 120], ['honey', 10]] },
    { type: 'lunch', time: '13:30', source: 'photo', title: 'ჩახოხბილი პურით', titleEn: 'Chakhokhbili with bread', foods: [['chakhokhbili', 300], ['shotis_puri', 60], ['salad_simple', 150]] },
    { type: 'snack', time: '16:30', source: 'manual', title: '', foods: [['greek_yogurt', 150]] },
    { type: 'dinner', time: '19:40', source: 'search', title: '', foods: [['trout', 180], ['rice_cooked', 150], ['broccoli', 150], ['olive_oil', 5]] },
  ],
  [
    { type: 'breakfast', time: '08:45', source: 'photo', title: 'ხაჭო თაფლით', titleEn: 'Cottage cheese with honey', foods: [['cottage_cheese', 180], ['honey', 15], ['coffee_milk_sugar', 200]] },
    { type: 'lunch', time: '14:00', source: 'search', title: '', foods: [['kharcho', 350], ['ghomi', 250], ['sulguni', 50], ['herbs', 20]] },
    { type: 'snack', time: '17:00', source: 'manual', title: '', foods: [['mandarin', 160], ['hazelnut', 25]] },
    { type: 'dinner', time: '19:30', source: 'text', title: 'ქათმის მკერდი წიწიბურით', titleEn: 'Chicken breast with buckwheat', foods: [['chicken_breast', 180], ['buckwheat_cooked', 200], ['salad_simple', 200], ['olive_oil', 10]] },
  ],
  [
    { type: 'breakfast', time: '09:00', source: 'saved', title: '', foods: [['omelette', 150], ['lavashi', 60], ['tomato', 120], ['tea_sugar', 250]] },
    { type: 'lunch', time: '13:40', source: 'photo', title: 'ხინკალი სალათით', titleEn: 'Khinkali with salad', foods: [['khinkali_meat', 325], ['salad_simple', 200]] },
    { type: 'snack', time: '16:45', source: 'manual', title: '', foods: [['matsoni', 200], ['apple', 180]] },
    { type: 'dinner', time: '20:00', source: 'search', title: '', foods: [['lentils', 250], ['pkhali', 100], ['shotis_puri', 40]] },
  ],
  [
    { type: 'breakfast', time: '08:30', source: 'search', title: '', foods: [['matsoni', 200], ['muesli', 60], ['banana', 120]] },
    { type: 'lunch', time: '14:10', source: 'photo', title: 'ოჯახური სალათით', titleEn: 'Ojakhuri with salad', foods: [['ojakhuri', 300], ['salad_simple', 200]] },
    { type: 'snack', time: '17:20', source: 'manual', title: '', foods: [['churchkhela', 50]] },
    { type: 'dinner', time: '19:50', source: 'saved', title: '', foods: [['salmon', 150], ['potato_boiled', 200], ['broccoli', 150]] },
  ],
  [
    { type: 'breakfast', time: '08:10', source: 'photo', title: 'ერბოკვერცხი პომიდვრით', titleEn: 'Fried eggs with tomatoes', foods: [['fried_eggs', 120], ['tomato', 120], ['bread_white', 40], ['coffee_black', 200]] },
    { type: 'lunch', time: '13:20', source: 'search', title: '', foods: [['lobio_walnut', 250], ['mchadi', 100], ['pkhali', 100]] },
    { type: 'snack', time: '16:00', source: 'manual', title: '', foods: [['persimmon', 170], ['almond', 20]] },
    { type: 'dinner', time: '19:20', source: 'text', title: 'ჩაქაფული', titleEn: 'Chakapuli', foods: [['chakapuli', 300], ['shotis_puri', 40]] },
  ],
];
for (const m of [...TODAY_MEALS, ...DAY_TEMPLATES.flat()]) if (m.title && m.titleEn) EN.set(m.title, m.titleEn);
EN.set('ქათმის სალათი ბოსტნეულით', 'Chicken salad with vegetables');

// Days with at least one meal (offsets from today). Streak today = 3 (0, -1, -2; -3 empty); best run = 19 (-26 … -8).
const LOGGED_OFFSETS = [-45, -44, -41, -36, -35, -30, ...Array.from({ length: 19 }, (_, i) => -26 + i), -5, -4, -2, -1];

const MEASUREMENTS = {
  women: [
    [-28, { waistCm: 98, hipsCm: 118, chestCm: 110, armCm: 35, thighCm: 66 }],
    [-14, { waistCm: 96.5, hipsCm: 117, chestCm: 109, armCm: 34.5, thighCm: 65 }],
    [-2, { waistCm: 95, hipsCm: 116, chestCm: 108, armCm: 34, thighCm: 64.5 }],
  ],
  man: [
    [-28, { waistCm: 108, hipsCm: 110, chestCm: 116, armCm: 37, thighCm: 62 }],
    [-14, { waistCm: 106.5, hipsCm: 109, chestCm: 115, armCm: 36.5, thighCm: 61.5 }],
    [-2, { waistCm: 105, hipsCm: 108, chestCm: 114, armCm: 36, thighCm: 61 }],
  ],
};

function makeMeal(userId, date, spec, idSeed) {
  const at = isoAt(date, spec.time);
  return {
    id: uuidFrom(idSeed),
    userId,
    date,
    type: spec.type,
    items: spec.foods.map(([id, grams]) => item(id, grams)),
    note: '',
    source: spec.source,
    createdAt: at,
    updatedAt: at,
    title: spec.title || '',
  };
}

const defaultPreferences = () => ({
  rollover: false,
  addBurned: false,
  countSteps: true,
  reminders: { enabled: false, breakfast: '08:30', lunch: '13:30', dinner: '19:30' },
  macros: { mode: 'auto', protein: 20, carbs: 50, fat: 30 },
  fasting: { screening: null, protocol: '16:8', targetMinutes: 960, notify: true },
});

function recipeToFood(input, userId, at) {
  const t = totals(input.items);
  const grams = input.items.reduce((s, i) => s + i.grams, 0);
  const per100 = {};
  for (const k of NUTRIENT_KEYS) per100[k] = Math.min(k === 'calories' ? 1000 : 100, r1((t[k] * 100) / grams));
  for (const k of MICRO_KEYS) if (t[k] != null) per100[k] = Math.min(k === 'sodium' ? 50000 : 100, r1((t[k] * 100) / grams));
  return {
    id: input.id,
    userId,
    name: input.name,
    brand: '',
    per100,
    serving: { grams: r1(grams / input.servings), label: 'პორცია' },
    source: 'recipe',
    barcode: null,
    favorite: input.favorite !== false,
    useCount: input.useCount || 0,
    lastUsedAt: at,
    createdAt: at,
    updatedAt: at,
    recipe: { servings: input.servings, items: input.items, totalGrams: r1(grams) },
  };
}
function savedFoodRow(userId, catalogId, { favorite, useCount, at, serving }) {
  const f = FOOD[catalogId];
  return {
    id: uuidFrom(`food:${catalogId}`),
    userId,
    name: f.name,
    brand: '',
    per100: { ...f.per100 },
    serving: serving || f.serving,
    source: 'catalog',
    barcode: null,
    favorite,
    useCount,
    lastUsedAt: at,
    createdAt: at,
    updatedAt: at,
    recipe: null,
  };
}

function seed(state, persona, today) {
  const women = persona !== 'man';
  const user = state.user || {};
  const profile = state.healthProfile || {};
  const userId = user.id || `mock-user-${women ? 'women' : 'man'}`;
  const sex = user.gender === 'MALE' ? 'male' : user.gender === 'FEMALE' ? 'female' : women ? 'female' : 'male';
  const birthDate = isCivil(String(user.birthDate || '').slice(0, 10)) ? String(user.birthDate).slice(0, 10) : women ? '1994-05-14' : '1989-11-02';
  const heightCm = finite(profile.heightCm) ? profile.heightCm : women ? 168 : 182;
  const allergyFacts = profileNutritionAllergies(profile.allergies);

  const goalStart = shift(today, GOAL.startOffset);
  const programDay = shift(today, GOAL.programOffset);
  const programAt = isoAt(programDay, '20:15');
  const pace = GOAL.paceKgPerWeek;
  const goal = {
    id: `wgoal-${Date.parse(isoAt(goalStart, '08:20'))}`,
    targetKg: GOAL.targetKg,
    startKg: GOAL.startKg,
    startedYmd: goalStart,
    // saveNutritionProgram: deadline = plan day + max(28, ceil(|target − weight| / pace × 7))
    deadlineYmd: shift(programDay, Math.max(28, Math.ceil((Math.abs(GOAL.targetKg - GOAL.programKg) / pace) * 7))),
    paceKgPerWeek: pace,
    pace: 'moderate',
    reminderEnabled: true,
    reminderDays: [1, 3, 4],
    reminderHour: 9,
    reminderMinute: 0,
    completedSeen: false,
    updatedAt: programAt,
  };
  const logs = WEIGHT_POINTS.map(([offset, kg, time]) => {
    const date = shift(today, offset);
    if (time == null) return { id: `wlog-nutrition-${date}`, date, at: programAt, kg };
    const at = isoAt(date, time);
    return { id: `wlog-${Date.parse(at)}-${createHash('sha1').update(at).digest('hex').slice(0, 5)}`, kg, at, date };
  }).sort((a, b) => b.at.localeCompare(a.at));
  state.weight = { goal, logs, measured: [] };

  const config = {
    mode: 'lose',
    weightKg: GOAL.programKg,
    heightCm,
    birthDate,
    sex,
    targetKg: GOAL.targetKg,
    // Women: Mifflin gives exactly 2 180 kcal; men (182 cm, profile age) land within ~30 kcal — the stored targets win.
    activity: women ? 'moderate' : 'light',
    pace: 'steady',
    diet: 'balanced',
    allergens: [...allergyFacts.requiredAllergens],
    avoidFoods: '',
    // Profile labels that are not food (e.g. dust mite) were answered as non-food when the plan was made.
    allergyClarifications: allergyFacts.unclassifiedAllergies.map((label) => ({ label, kind: 'non_food', allergens: [] })),
    screening: { pregnancyOrBreastfeeding: false, eatingDisorder: false, medicalDiet: false },
  };
  const targets = targetsFor(PLAN_KCAL, PLAN_MAINTENANCE);
  const program = {
    userId,
    revision: uuidFrom(`program-revision:${programDay}`),
    active: true,
    config,
    targets,
    goalLink: { id: goal.id, targetKg: goal.targetKg },
    startedOn: programDay,
    updatedAt: programAt,
  };

  const meals = [];
  TODAY_MEALS.forEach((spec) => meals.push(makeMeal(userId, today, spec, `meal:${today}:${spec.type}`)));
  for (const offset of LOGGED_OFFSETS) {
    const date = shift(today, offset);
    const template = DAY_TEMPLATES[((offset % DAY_TEMPLATES.length) + DAY_TEMPLATES.length) % DAY_TEMPLATES.length];
    const skipSnack = seeded(`snack:${date}`) < 0.3;
    for (const spec of template) {
      if (spec.type === 'snack' && skipSnack) continue;
      meals.push(makeMeal(userId, date, spec, `meal:${date}:${spec.type}`));
    }
  }

  const dinner = portionRecipe(RECIPE_BY_ID['chicken-salad'], targets.calories * FRACTIONS.dinner);
  const planned = [
    {
      id: uuidFrom(`plan:${today}:dinner`),
      userId,
      date: today,
      type: 'dinner',
      recipeId: 'chicken-salad',
      programRevision: program.revision,
      data: dinner,
      updatedAt: isoAt(shift(today, -1), '21:10'),
    },
  ];

  const kgToday = GOAL.programKg;
  const activities = [
    { id: uuidFrom(`act:${today}:walk`), date: today, kind: 'walk', minutes: 35, kcal: activityKcal('walk', 35, 92.4), note: '', source: 'manual', createdAt: isoAt(today, '07:20') },
    { id: uuidFrom(`act:${shift(today, -1)}:strength`), date: shift(today, -1), kind: 'strength', minutes: 45, kcal: activityKcal('strength', 45, 92.4), note: '', source: 'manual', createdAt: isoAt(shift(today, -1), '19:05') },
    { id: uuidFrom(`act:${shift(today, -2)}:walk`), date: shift(today, -2), kind: 'walk', minutes: 50, kcal: activityKcal('walk', 50, kgToday), note: '', source: 'manual', createdAt: isoAt(shift(today, -2), '18:30') },
  ];

  const foodsAt = isoAt(shift(today, -1), '13:55');
  const foods = [
    savedFoodRow(userId, 'matsoni', { favorite: true, useCount: 11, at: isoAt(shift(today, -3), '16:45') }),
    savedFoodRow(userId, 'lobio_walnut', { favorite: true, useCount: 7, at: isoAt(today, '13:50') }),
    savedFoodRow(userId, 'cottage_cheese', { favorite: false, useCount: 4, at: isoAt(shift(today, -9), '08:45'), serving: { grams: 180, label: 'პორცია' } }),
    recipeToFood(
      {
        id: uuidFrom('recipe:chicken-salad'),
        name: 'ქათმის სალათი ბოსტნეულით',
        servings: 2,
        items: [item('chicken_breast', 300), item('salad_simple', 400), item('olive_oil', 15)],
        favorite: true,
        useCount: 3,
      },
      userId,
      foodsAt,
    ),
  ];

  state.nutrition = {
    seedDay: today,
    persona,
    userId,
    program,
    targetHistory: [
      { date: goalStart, targets: targetsFor(OLD_KCAL, OLD_MAINTENANCE) },
      { date: programDay, targets },
    ],
    meals,
    planned,
    activities,
    preferences: defaultPreferences(),
    measurements: (MEASUREMENTS[women ? 'women' : 'man'] || []).map(([offset, m]) => ({ date: shift(today, offset), ...m })),
    foods,
    fasts: [],
    steps: 6400, // same as health.mjs today total
    water: { ml: 1250, goalMl: 2500 },
    settings: { photoEnabled: true, programEnabled: true },
  };
}

/** The nutrition slice, re-seeded when the Tbilisi day changed since it was built. */
function ns(rq) {
  const st = rq.state;
  if (!st.nutrition || st.nutrition.seedDay !== rq.today) seed(st, rq.persona || st.persona, rq.today);
  if (!st.weight || typeof st.weight !== 'object') st.weight = { goal: null, logs: [], measured: [] };
  return st.nutrition;
}

/** server nutritionFacts(): read from the live state (user, profile, shared weight). */
function nutritionFacts(rq) {
  const today = rq.today;
  const user = rq.state.user || {};
  const profile = rq.state.healthProfile || {};
  const W = rq.state.weight || {};
  const plausible = (kg) => finite(kg) && kg >= 20 && kg <= 300;
  const logs = (Array.isArray(W.logs) ? W.logs : [])
    .filter((v) => v && v.date <= today && plausible(v.kg))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const measured = (Array.isArray(W.measured) ? W.measured : [])
    .filter((v) => v && v.date <= today && plausible(v.weightKg))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, 28)
    .map((v) => ({ date: v.date, weightKg: v.weightKg }));
  const current =
    measured[0] && (!logs[0] || measured[0].date >= logs[0].date)
      ? { kg: measured[0].weightKg, date: measured[0].date, source: 'measurement' }
      : logs[0]
        ? { kg: logs[0].kg, date: logs[0].date, source: 'weight_log' }
        : plausible(profile.weightKg)
          ? { kg: profile.weightKg, date: null, source: 'profile' }
          : null;
  const weightHistory = [
    ...new Map([
      ...logs.slice().reverse().map((v) => [v.date, { date: v.date, weightKg: v.kg }]),
      ...measured.map((v) => [v.date, v]),
    ]).values(),
  ]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-28);
  const birth = String(user.birthDate || '').slice(0, 10);
  return {
    ...profileNutritionAllergies(profile.allergies),
    birthDate: isCivil(birth) ? birth : null,
    sex: user.gender === 'FEMALE' ? 'female' : user.gender === 'MALE' ? 'male' : null,
    heightCm: profile.heightCm || null,
    current,
    weightGoal: W.goal || null,
    weightHistory,
    activity: { SEDENTARY: 'sedentary', LIGHT: 'light', MODERATE: 'moderate', ACTIVE: 'active', VERY_ACTIVE: 'active' }[profile.activityLevel] || null,
    diet: { OMNIVORE: 'balanced', VEGETARIAN: 'vegetarian', VEGAN: 'vegan' }[profile.dietType] || 'balanced',
    sensitiveRestriction: false,
    medicalRestriction: (Array.isArray(profile.chronicConditions) && profile.chronicConditions.length > 0) || profile.extraAnswers?.hasConditions === true,
  };
}
function publicFacts(facts) {
  const { sensitiveRestriction, medicalRestriction, ...safe } = facts;
  return { ...safe, professionalReviewNeeded: !!(sensitiveRestriction || medicalRestriction) };
}
const isEaten = (N, id) => N.meals.some((m) => m.id === id);
const byDateTime = (a, b) => a.date.localeCompare(b.date) || String(a.createdAt).localeCompare(String(b.createdAt));
const publicPrefs = (p) => {
  const { fasting: _fasting, ...rest } = p;
  return rest;
};
const publicActivity = ({ createdAt: _c, ...a }) => a;

/** GET /api/nutrition/program/dashboard — server nutritionDashboard(). */
function dashboard(rq) {
  const N = ns(rq);
  const day = rq.today;
  const from = shift(day, -6);
  const yesterday = shift(day, -1);
  const facts = nutritionFacts(rq);
  const plan = programState(N.program, facts, day);
  const state = { ...plan, targets: applyMacroSplit(plan.targets, N.preferences.macros) };
  const meals = N.meals.filter((m) => m.date >= from && m.date <= day).sort(byDateTime);
  const history = N.targetHistory.filter((h) => h.date <= day).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 35);
  const todayMeals = meals.filter((m) => m.date === day);
  const today = totals(todayMeals.flatMap((m) => m.items));
  const days = summarizeDays(meals, from, 7, history);
  const steps = Math.max(0, Number(N.steps) || 0);
  const weightKg = facts.current?.kg || N.program?.config?.weightKg || null;
  const activities = N.activities.filter((a) => a.date === day).sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  const burned = {
    activities: activities.reduce((s, a) => s + (a.kcal || 0), 0),
    steps: N.preferences.countSteps ? stepsKcal(steps, weightKg) : 0,
  };
  burned.total = burned.activities + burned.steps;
  const yd = days.find((d) => d.date === yesterday);
  const budget = energyBudget({
    target: state.targets?.calories || null,
    preferences: N.preferences,
    burned: burned.total,
    yesterday: yd ? { target: yd.target?.calories || null, eaten: yd.totals.calories, recorded: yd.recorded } : null,
  });
  const program = N.program;
  const pace = program?.config?.mode === 'gain' ? 0.2 : program?.config?.pace === 'gentle' ? 0.25 : 0.4;
  const streakFrom = shift(day, -400);
  const mealDates = [...new Set(N.meals.filter((m) => m.date >= streakFrom && m.date <= day).map((m) => m.date))];
  const openFast = N.fasts.find((f) => !f.endedAt);
  return {
    ...state,
    facts: publicFacts(facts),
    date: day,
    today,
    remaining: state.targets ? (budget.budget ?? state.targets.calories) - today.calories : null,
    budget: budget.budget,
    rollover: budget.rollover,
    burned: { ...burned, counted: budget.burnedCounted },
    days,
    week: weekSummary(days),
    mealCount: todayMeals.length,
    todayMeals: todayMeals.map(mealSummary),
    activities: activities.map(publicActivity),
    steps,
    water: { ml: Math.max(0, Number(N.water?.ml) || 0), goalMl: Number(N.water?.goalMl) || null },
    streak: computeStreak(mealDates, day),
    projection: weightProjection(facts.weightHistory, facts.weightGoal, day, program?.active ? pace : 0),
    preferences: publicPrefs(N.preferences),
    fasting: { active: openFast ? publicFast(openFast) : null },
    measurements: N.measurements.filter((m) => m.date <= day).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12),
    planned: N.planned
      .filter((p) => p.date === day)
      .sort((a, b) => a.type.localeCompare(b.type))
      .map((p) => ({ ...p, eaten: isEaten(N, p.id) }))
      .filter((p) => p.programRevision === program?.revision && (state.mealPlanning?.eligible !== false || p.eaten)),
    intakeSource: 'nutrition_meals_only',
  };
}

/* ------------------------------------------------------------------ input validation (light zod stand-ins) */

function parseFoodItem(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  const amount = (n) => finite(n) && n >= 0 && n <= 10000;
  if (!name || name.length > 120 || !finite(raw.grams) || raw.grams <= 0 || raw.grams > 10000) return null;
  if (!NUTRIENT_KEYS.every((k) => amount(raw[k]))) return null;
  const it = { name, grams: raw.grams, calories: raw.calories, protein: raw.protein, carbs: raw.carbs, fat: raw.fat };
  for (const k of MICRO_KEYS) if (raw[k] != null) {
    if (!finite(raw[k]) || raw[k] < 0 || raw[k] > 100000) return null;
    it[k] = raw[k];
  }
  return it;
}
function parseMealInput(body) {
  const b = body && typeof body === 'object' ? body : {};
  if (!isUuid(b.id) || !isCivil(b.date) || !MEAL_TYPES.includes(b.type)) return null;
  if (!Array.isArray(b.items) || !b.items.length || b.items.length > 25) return null;
  const items = b.items.map(parseFoodItem);
  if (items.some((i) => !i)) return null;
  const source = b.source ?? 'manual';
  if (!MEAL_SOURCES.includes(source)) return null;
  return {
    id: b.id,
    date: b.date,
    type: b.type,
    items,
    note: typeof b.note === 'string' ? b.note.trim().slice(0, 500) : '',
    title: typeof b.title === 'string' ? b.title.trim().slice(0, 120) : '',
    source,
  };
}
function saveMeal(N, input) {
  const existing = N.meals.find((m) => m.id === input.id);
  const now = nowIso();
  if (existing) {
    Object.assign(existing, { date: input.date, type: input.type, items: input.items, note: input.note, title: input.title || '', source: input.source, updatedAt: now });
    return existing;
  }
  const row = { id: input.id, userId: N.userId, date: input.date, type: input.type, items: input.items, note: input.note, source: input.source, createdAt: now, updatedAt: now, title: input.title || '' };
  N.meals.push(row);
  return row;
}
function rangeQuery(rq, fromRaw, toRaw) {
  const from = fromRaw;
  const to = toRaw || from;
  if (!isCivil(from) || !isCivil(to)) return { error: fail(rq, 400, 'არასწორი თარიღი') };
  if (to < from || diffDays(from, to) > 31) return { error: fail(rq, 400, 'აირჩიე მაქსიმუმ 31 დღე.') };
  return { from, to };
}

/* naive "AI" estimator for text / quick-log (the mock never calls a model) */
const COUNT_WORDS = { ერთი: 1, ორი: 2, სამი: 3, ოთხი: 4, ხუთი: 5, ექვსი: 6, შვიდი: 7, რვა: 8, ცხრა: 9, ათი: 10, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, a: 1, an: 1 };
const fold = (s) => String(s || '').toLowerCase().replace(/[·,.()!?;:"„“]/g, ' ').replace(/\s+/g, ' ').trim();
function estimateFromText(description) {
  const text = fold(description);
  const words = text.split(' ').filter(Boolean);
  const stemOf = (key) => (key.length > 5 ? key.slice(0, key.length - 1) : key);
  const findWord = (key) => words.findIndex((w) => w.startsWith(stemOf(key)));
  // Variants share a head ("ხინკალი · ხორცით" / "· ყველით"): one item per head, the variant whose qualifier is mentioned.
  const groups = new Map();
  for (const food of CATALOG) {
    const head = fold(food.name.split(' · ')[0]);
    if (!groups.has(head)) groups.set(head, []);
    groups.get(head).push(food);
  }
  const items = [];
  for (const [head, variants] of groups) {
    const keys = [head, fold(variants[0].nameEn.split(' · ')[0]), ...variants.flatMap((f) => f.aliases.map(fold))].filter((k) => k.length >= 3);
    let at = -1;
    for (const key of keys) {
      at = findWord(key);
      if (at >= 0) break;
    }
    if (at < 0) continue;
    const qualified = variants.find((f) => {
      const qualifier = fold(f.name.split(' · ')[1] || '');
      return qualifier && qualifier.split(' ').some((q) => q.length >= 3 && findWord(q) >= 0);
    });
    const food = qualified || variants[0];
    const before = [words[at - 1], words[at - 2]].filter(Boolean);
    const count = before.map((w) => COUNT_WORDS[w] || (/^\d+$/.test(w) ? Number(w) : 0)).find((n) => n > 0) || 1;
    items.push(foodToItem(food, (food.serving?.grams || 100) * Math.min(count, 20)));
    if (items.length >= 6) break;
  }
  if (!items.length) {
    const name = String(description || '').trim().slice(0, 60) || 'კერძი';
    return {
      foodDetected: true,
      dishName: name,
      items: [{ name, grams: 300, calories: 360, protein: 18, carbs: 40, fat: 14 }],
      uncertainty: 'high',
      explanation: 'აღწერა ზოგადია — პორცია და შემადგენლობა მიახლოებითია.',
    };
  }
  return {
    foodDetected: true,
    dishName: items.length === 1 ? items[0].name : `${items[0].name} და სხვა`,
    items,
    uncertainty: 'medium',
    explanation: 'შეფასება აღწერიდან: რაოდენობა ჩვეული პორციით ავიღე.',
  };
}
function photoEstimate() {
  return {
    foodDetected: true,
    dishName: 'იმერული ხაჭაპური სალათით',
    items: [item('khachapuri_imeruli', 150), item('salad_simple', 200)],
    uncertainty: 'medium',
    explanation: 'პორცია ფოტოდან შეფასდა. ზეთი და სოუსი ფოტოზე შეიძლება არ ჩანდეს — შენახვამდე გადაამოწმე.',
  };
}
EN.set('იმერული ხაჭაპური სალათით', 'Imeruli khachapuri with salad');
const withScore = (estimate, mode) => ({ ...estimate, mode, totals: totals(estimate.items), healthScore: healthScore(estimate.items) });

/* planned week */
function weekView(N, from) {
  const to = shift(from, 6);
  const meals = N.planned
    .filter((p) => p.date >= from && p.date <= to)
    .sort((a, b) => a.date.localeCompare(b.date) || a.type.localeCompare(b.type))
    .map((p) => ({ ...p, eaten: isEaten(N, p.id) }));
  return { from, to, meals, shopping: shoppingList(meals) };
}
function activeProgramState(rq, N) {
  return programState(N.program, nutritionFacts(rq), rq.today);
}

/* fasting state */
function fastingState(rq, N) {
  const settings = N.preferences.fasting;
  const facts = nutritionFacts(rq);
  const eligibility = fastingEligibility({ facts, screening: settings.screening, programConfig: N.program?.config, today: rq.today });
  const rows = [...N.fasts].sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt)));
  const active = rows.find((f) => !f.endedAt);
  return {
    eligibility,
    settings: { protocol: settings.protocol, targetMinutes: settings.targetMinutes, notify: settings.notify, screened: !!settings.screening },
    screening: settings.screening,
    active: active ? publicFast(active) : null,
    history: rows.filter((f) => f.endedAt).slice(0, 30).map((f) => publicFast(f)),
    stats: fastingStats(rows),
  };
}
function fastTimesProblem(startedAt, endedAt, now = new Date()) {
  const start = new Date(startedAt).getTime();
  const clock = now.getTime();
  if (!Number.isFinite(start)) return 'დაწყების დრო არასწორია.';
  if (start > clock + 60000) return 'დაწყების დრო მომავალში ვერ იქნება.';
  if (clock - start > 7 * 86400000 && endedAt == null) return 'დაწყება ერთ კვირაზე ძველი ვერ იქნება.';
  if (endedAt != null) {
    const end = new Date(endedAt).getTime();
    if (!Number.isFinite(end) || end <= start) return 'დასრულება დაწყების შემდეგ უნდა იყოს.';
    if (end > clock + 60000) return 'დასრულების დრო მომავალში ვერ იქნება.';
    if ((end - start) / 60000 > 48 * 60) return 'ჩანაწერი 48 საათზე გრძელი ვერ იქნება. მიუთითე, როდის დაასრულე სინამდვილეში.';
  }
  return null;
}

/* ------------------------------------------------------------------ module contract */

export function init(state, ctx) {
  seed(state, ctx.persona, ctx.today);
}

const B = '/api/nutrition';
export const routes = [
  /* ---------- dashboard + program (nutrition-program.routes.js) ---------- */
  { method: 'GET', path: `${B}/program/dashboard`, handler: (rq) => out(rq, dashboard(rq)) },
  {
    method: 'POST',
    path: `${B}/program/preview`,
    handler: (rq) => {
      ns(rq);
      const res = assessProgram(rq.body, nutritionFacts(rq), rq.today);
      if (!res) return fail(rq, 400, 'შეავსე ყველა ველი სწორად.');
      return out(rq, res);
    },
  },
  {
    method: 'PUT',
    path: `${B}/program`,
    handler: (rq) => {
      const N = ns(rq);
      const body = rq.body || {};
      const day = rq.today;
      if ((N.program?.revision || null) !== (body.expectedRevision ?? null)) return fail(rq, 409, 'გეგმა სხვა ეკრანზე შეიცვალა. განაახლე გვერდი და გადაამოწმე.');
      const facts = nutritionFacts(rq);
      const assessment = assessProgram(body.config, facts, day);
      if (!assessment) return fail(rq, 400, 'შეავსე ყველა ველი სწორად.');
      if (!assessment.eligible) return rq.reply(422, { error: assessment.reasons.map((r) => (rq.lang === 'en' ? EN.get(r) ?? r : r)).join(' ') });
      const input = assessment.input;
      const oldGoal = facts.weightGoal;
      const sameGoal = oldGoal?.targetKg === input.targetKg;
      const pace = input.mode === 'gain' ? 0.2 : input.pace === 'gentle' ? 0.25 : 0.4;
      const weeks = Math.abs(input.targetKg - input.weightKg) / pace;
      const updatedAt = nowIso();
      const goal = {
        ...(oldGoal || {}),
        id: oldGoal?.id || freshUuid(),
        startKg: sameGoal ? oldGoal.startKg : input.weightKg,
        targetKg: input.targetKg,
        startedYmd: sameGoal ? oldGoal.startedYmd : day,
        deadlineYmd: shift(day, Math.max(28, Math.ceil(weeks * 7))),
        paceKgPerWeek: pace,
        pace: pace <= 0.25 ? 'slow' : 'moderate',
        reminderEnabled: oldGoal?.reminderEnabled || false,
        reminderDays: oldGoal?.reminderDays || [],
        reminderHour: oldGoal?.reminderHour ?? 9,
        reminderMinute: oldGoal?.reminderMinute ?? 0,
        completedSeen: sameGoal ? oldGoal.completedSeen : false,
        updatedAt,
      };
      const weightLog = { id: `wlog-nutrition-${day}`, date: day, at: updatedAt, kg: input.weightKg };
      const W = rq.state.weight;
      W.goal = goal;
      W.logs = [weightLog, ...(Array.isArray(W.logs) ? W.logs : []).filter((v) => v.date !== day)].slice(0, 1000);
      if (rq.state.healthProfile) {
        rq.state.healthProfile.weightKg = input.weightKg;
        rq.state.healthProfile.heightCm = input.heightCm;
      }
      N.program = {
        userId: N.userId,
        revision: freshUuid(),
        active: true,
        config: input,
        targets: assessment.targets,
        goalLink: { id: goal.id, targetKg: goal.targetKg },
        startedOn: day,
        updatedAt,
      };
      N.targetHistory = [...N.targetHistory.filter((h) => h.date !== day), { date: day, targets: assessment.targets }];
      return out(rq, { program: N.program, goal, weightLog });
    },
  },
  {
    method: 'POST',
    path: `${B}/program/pause`,
    handler: (rq) => {
      const N = ns(rq);
      const expected = rq.body?.expectedRevision ?? null;
      if (!N.program || N.program.revision !== expected) return fail(rq, 409, 'გეგმა შეიცვალა. განაახლე გვერდი.');
      N.program = { ...N.program, active: false, revision: freshUuid(), updatedAt: nowIso() };
      N.targetHistory = [...N.targetHistory.filter((h) => h.date !== rq.today), { date: rq.today, targets: null }];
      return { ok: true };
    },
  },
  {
    method: 'GET',
    path: `${B}/plan`,
    handler: (rq) => {
      const N = ns(rq);
      const from = rq.query.from || rq.today;
      if (!isCivil(from)) return fail(rq, 400, 'არასწორი თარიღი');
      if (from < shift(rq.today, -90) || from > shift(rq.today, 28)) return fail(rq, 400, 'აირჩიე ახლო პერიოდი.');
      return out(rq, weekView(N, from));
    },
  },
  {
    method: 'POST',
    path: `${B}/plan/generate`,
    handler: (rq) => {
      const N = ns(rq);
      const body = rq.body || {};
      const from = body.from;
      if (!isCivil(from)) return fail(rq, 400, 'არასწორი თარიღი');
      if (from < shift(rq.today, -90) || from > shift(rq.today, 28)) return fail(rq, 400, 'აირჩიე ახლო პერიოდი.');
      if (from < rq.today) return fail(rq, 400, 'ახალი რაციონი დღევანდელი ან მომავალი დღიდან შეადგინე.');
      const st = activeProgramState(rq, N);
      if (!st.targets || N.program.revision !== body.expectedRevision) return fail(rq, 409, 'ჯერ მოქმედი კვების გეგმა გადაამოწმე.');
      if (st.mealPlanning && !st.mealPlanning.eligible) return rq.reply(422, { error: st.mealPlanning.reasons.join(' ') });
      const variant = Number.isInteger(body.variant) ? body.variant : 0;
      const config = N.program.config;
      for (let d = 0; d < 7; d++) {
        const date = shift(from, d);
        for (const type of MEAL_TYPES) {
          const choices = RECIPES.filter((r) => r.data.type === type && recipeAllowed(r, config));
          if (!choices.length) continue;
          const recipe = choices[(variant + d) % choices.length];
          const data = portionRecipe(recipe, st.targets.calories * FRACTIONS[type]);
          if (!data) continue;
          const existing = N.planned.find((p) => p.date === date && p.type === type);
          if (existing) {
            if (isEaten(N, existing.id)) continue;
            Object.assign(existing, { recipeId: recipe.id, programRevision: N.program.revision, data, updatedAt: nowIso() });
          } else {
            N.planned.push({ id: freshUuid(), userId: N.userId, date, type, recipeId: recipe.id, programRevision: N.program.revision, data, updatedAt: nowIso() });
          }
        }
      }
      return out(rq, weekView(N, from));
    },
  },
  {
    method: 'POST',
    path: `${B}/plan/:id/eat`,
    handler: (rq) => {
      const N = ns(rq);
      const meal = N.planned.find((p) => p.id === rq.params.id);
      if (!meal) return fail(rq, 404, 'კვება ვერ მოიძებნა.');
      if (meal.date > rq.today) return fail(rq, 400, 'მომავალი კვება მიღებულად ჯერ ვერ ჩაითვლება.');
      if (!isEaten(N, meal.id)) {
        const now = nowIso();
        N.meals.push({ id: meal.id, userId: N.userId, date: meal.date, type: meal.type, items: JSON.parse(JSON.stringify(meal.data.items)), note: 'რაციონიდან დამატებული', source: 'plan', createdAt: now, updatedAt: now, title: '' });
      }
      return { ok: true };
    },
  },
  {
    method: 'PUT',
    path: `${B}/plan/:id/swap`,
    handler: (rq) => {
      const N = ns(rq);
      const meal = N.planned.find((p) => p.id === rq.params.id);
      if (!meal) return fail(rq, 404, 'კვება ვერ მოიძებნა.');
      if (isEaten(N, meal.id)) return fail(rq, 409, 'მიღებული კვება დღიურში შეასწორე.');
      const st = activeProgramState(rq, N);
      if (!st.targets || meal.programRevision !== N.program.revision) return fail(rq, 409, 'ჯერ მოქმედი გეგმა გადაამოწმე.');
      const recipe = RECIPE_BY_ID[rq.body?.recipeId];
      if (!recipe || !recipeAllowed(recipe, N.program.config) || recipe.data.type !== meal.type) return fail(rq, 400, 'ეს კერძი არჩეულ კვებასა და შეზღუდვებს არ შეესაბამება.');
      const data = portionRecipe(recipe, totals(meal.data.items).calories);
      if (!data) return fail(rq, 400, 'ეს კერძი არჩეულ კვებასა და შეზღუდვებს არ შეესაბამება.');
      Object.assign(meal, { recipeId: recipe.id, data, updatedAt: nowIso() });
      return { ok: true };
    },
  },
  {
    // With ?type= this is the meal-plan recipe list (program router); without it, the personal recipes (plus router).
    method: 'GET',
    path: `${B}/recipes`,
    handler: (rq) => {
      const N = ns(rq);
      if (rq.query.type) {
        if (!MEAL_TYPES.includes(rq.query.type)) return fail(rq, 400, 'შეავსე ყველა ველი სწორად.');
        const st = activeProgramState(rq, N);
        if (!st.targets) return fail(rq, 409, 'ჯერ მოქმედი კვების გეგმა შეარჩიე.');
        if (st.mealPlanning && !st.mealPlanning.eligible) return rq.reply(422, { error: st.mealPlanning.reasons.join(' ') });
        const recipes = RECIPES.filter((r) => r.data.type === rq.query.type && recipeAllowed(r, N.program.config))
          .map((r) => {
            const portion = portionRecipe(r, st.targets.calories * FRACTIONS[rq.query.type]);
            return portion ? { id: r.id, ...portion } : null;
          })
          .filter(Boolean);
        return out(rq, { recipes });
      }
      const recipes = N.foods
        .filter((f) => f.source === 'recipe')
        .sort((a, b) => Number(b.favorite) - Number(a.favorite) || String(b.lastUsedAt).localeCompare(String(a.lastUsedAt)))
        .map((row) => ({ ...row, kind: 'saved' }));
      return out(rq, { recipes });
    },
  },
  {
    method: 'GET',
    path: `${B}/recipes/:id`,
    handler: (rq) => {
      const N = ns(rq);
      const row = N.foods.find((f) => f.id === rq.params.id && f.source === 'recipe');
      if (!row) return fail(rq, 404, 'რეცეპტი ვერ მოიძებნა.');
      return out(rq, { recipe: { ...row, kind: 'saved' } });
    },
  },
  {
    method: 'PUT',
    path: `${B}/recipes/:id`,
    handler: (rq) => {
      const N = ns(rq);
      const b = rq.body || {};
      if (b.id !== rq.params.id) return fail(rq, 400, 'ჩანაწერის ნომერი არ ემთხვევა.');
      const items = Array.isArray(b.items) ? b.items.map(parseFoodItem) : [];
      const name = typeof b.name === 'string' ? b.name.trim() : '';
      if (!isUuid(b.id) || !name || !Number.isInteger(b.servings) || b.servings < 1 || b.servings > 50 || !items.length || items.some((i) => !i))
        return fail(rq, 400, 'შეავსე ყველა ველი სწორად.');
      const existing = N.foods.find((f) => f.id === b.id);
      if (existing && existing.source !== 'recipe') return fail(rq, 404, 'რეცეპტი ვერ მოიძებნა.');
      const at = nowIso();
      const row = recipeToFood({ id: b.id, name, servings: b.servings, items, favorite: b.favorite !== false, useCount: existing?.useCount || 0 }, N.userId, at);
      if (existing) Object.assign(existing, { ...row, createdAt: existing.createdAt, lastUsedAt: existing.lastUsedAt });
      else N.foods.push(row);
      const t = totals(items);
      return out(rq, {
        recipe: { ...(existing || row), kind: 'saved' },
        totals: t,
        perServing: Object.fromEntries(Object.entries(t).map(([k, v]) => [k, v == null ? null : r1(v / b.servings)])),
        healthScore: healthScore(items),
      });
    },
  },

  /* ---------- diary (nutrition.routes.js) ---------- */
  { method: 'GET', path: `${B}/settings`, handler: (rq) => ({ ...ns(rq).settings }) },
  {
    method: 'GET',
    path: `${B}/meals`,
    handler: (rq) => {
      const N = ns(rq);
      const range = rangeQuery(rq, rq.query.from, rq.query.to);
      if (range.error) return range.error;
      const rows = N.meals
        .filter((m) => m.date >= range.from && m.date <= range.to)
        .sort((a, b) => b.date.localeCompare(a.date) || String(b.createdAt).localeCompare(String(a.createdAt)));
      return out(rq, { meals: rows.slice(0, 1000).map(publicMeal), truncated: rows.length > 1000 });
    },
  },
  {
    method: 'POST',
    path: `${B}/meals/copy`,
    handler: (rq) => {
      const N = ns(rq);
      const b = rq.body || {};
      if (!isCivil(b.date) || !Array.isArray(b.copies) || !b.copies.length || (b.type != null && !MEAL_TYPES.includes(b.type))) return fail(rq, 400, 'შეავსე ყველა ველი სწორად.');
      if (b.date > rq.today) return fail(rq, 400, 'მომავალი დღის კვება ვერ ჩაიწერება.');
      const created = [];
      for (const c of b.copies) {
        const src = N.meals.find((m) => m.id === c?.fromId);
        if (!src || !isUuid(c.id)) continue;
        if (!N.meals.some((m) => m.id === c.id)) {
          const now = nowIso();
          N.meals.push({ id: c.id, userId: N.userId, date: b.date, type: b.type || src.type, items: JSON.parse(JSON.stringify(src.items)), note: src.note || '', source: src.source, createdAt: now, updatedAt: now, title: src.title || '' });
        }
        created.push(N.meals.find((m) => m.id === c.id));
      }
      if (!created.length) return fail(rq, 404, 'დასაკოპირებელი კვება ვერ მოიძებნა.');
      return out(rq, { meals: created.map(publicMeal) });
    },
  },
  {
    method: 'PUT',
    path: `${B}/meals/:id`,
    handler: (rq) => {
      const N = ns(rq);
      const input = parseMealInput(rq.body);
      if (!input) return fail(rq, 400, 'შეავსე ყველა ველი სწორად.');
      if (input.id !== rq.params.id) return fail(rq, 400, 'ჩანაწერის ნომერი არ ემთხვევა.');
      return out(rq, { meal: publicMeal(saveMeal(N, input)) });
    },
  },
  {
    method: 'DELETE',
    path: `${B}/meals/:id`,
    handler: (rq) => {
      const N = ns(rq);
      N.meals = N.meals.filter((m) => m.id !== rq.params.id);
      return { ok: true };
    },
  },
  {
    method: 'POST',
    path: `${B}/estimate`,
    handler: (rq) => {
      ns(rq);
      const b = rq.body || {};
      // Multipart (photo / label) reaches the mock as { __raw, __type }: answer with a photo estimate.
      if (b.__raw != null) return out(rq, withScore(photoEstimate(), 'photo'));
      const mode = b.mode || 'photo';
      if (mode === 'text') {
        const description = String(b.description || '').trim();
        if (description.length < 3) return fail(rq, 400, 'აღწერე რა მიირთვი — მაგ. „ორი ხინკალი და სალათი“.');
        return out(rq, withScore(estimateFromText(description), 'text'));
      }
      if (mode === 'fix') {
        const previous = Array.isArray(b.previous) ? b.previous.map(parseFoodItem).filter(Boolean) : [];
        const correction = String(b.correction || '').trim();
        if (!previous.length || correction.length < 2) return fail(rq, 400, 'დაწერე რა უნდა შესწორდეს.');
        const half = /ნახევ|half/i.test(correction);
        const items = half ? previous.map((i) => ({ ...i, ...Object.fromEntries(['grams', ...NUTRIENT_KEYS].map((k) => [k, r1(i[k] / 2)])) })) : previous;
        return out(rq, withScore({ foodDetected: true, dishName: items[0]?.name || '', items, uncertainty: 'medium', explanation: 'შესწორება გავითვალისწინე.' }, 'fix'));
      }
      return out(rq, withScore(photoEstimate(), mode === 'label' ? 'label' : 'photo'));
    },
  },
  {
    method: 'POST',
    path: `${B}/quick-log`,
    handler: (rq) => {
      const N = ns(rq);
      const b = rq.body || {};
      const description = String(b.description || '').trim();
      if (description.length < 3 || description.length > 500) return fail(rq, 400, 'აღწერე რა მიირთვი — მაგ. „ორი ხინკალი და სალათი“.');
      const day = b.date || rq.today;
      if (!isCivil(day)) return fail(rq, 400, 'არასწორი თარიღი');
      if (day > rq.today) return fail(rq, 400, 'მომავალი დღის კვება ვერ ჩაიწერება.');
      const estimate = estimateFromText(description);
      const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tbilisi', hour: '2-digit', hour12: false }).format(new Date())) % 24;
      const type = MEAL_TYPES.includes(b.mealType) ? b.mealType : hour < 11 ? 'breakfast' : hour < 16 ? 'lunch' : hour < 21 ? 'dinner' : 'snack';
      const row = saveMeal(N, {
        id: isUuid(b.id) ? b.id : freshUuid(),
        date: day,
        type,
        items: estimate.items,
        note: description,
        title: estimate.dishName || '',
        source: b.source === 'voice' ? 'voice' : 'text',
      });
      return out(rq, { meal: publicMeal(row), uncertainty: estimate.uncertainty, explanation: estimate.explanation });
    },
  },

  /* ---------- saved foods, search, barcode (nutrition-plus.routes.js) ---------- */
  {
    method: 'GET',
    path: `${B}/foods/search`,
    handler: (rq) => {
      const N = ns(rq);
      const q = String(rq.query.q || '').trim().slice(0, 80);
      if (q.length < 2) return { saved: [], catalog: [], products: [] };
      const lower = q.toLowerCase();
      const saved = N.foods
        .filter((f) => f.name.toLowerCase().includes(lower) || f.brand.toLowerCase().includes(lower))
        .sort((a, b) => Number(b.favorite) - Number(a.favorite) || String(b.lastUsedAt).localeCompare(String(a.lastUsedAt)))
        .slice(0, 10)
        .map((r) => ({ ...r, kind: 'saved' }));
      const fq = fold(q);
      const tokens = fq.split(' ').filter(Boolean);
      const catalog = CATALOG.map((food, index) => {
        const hay = fold([food.name, food.nameEn, ...food.aliases].join(' '));
        const first = fold(food.name).startsWith(fq) ? 2 : 0;
        const hits = tokens.filter((t) => hay.includes(t)).length;
        return { food, index, score: hits === tokens.length ? 3 + first : hits > 0 && tokens.length > 1 ? 1 : 0 };
      })
        .filter((v) => v.score > 0)
        .sort((a, b) => b.score - a.score || a.index - b.index)
        .slice(0, 12)
        .map(({ food }) => ({ ...food, kind: 'catalog' }));
      return out(rq, { saved, catalog, products: [] });
    },
  },
  {
    method: 'GET',
    path: `${B}/foods/recent`,
    handler: (rq) => {
      const N = ns(rq);
      const from = shift(rq.today, -30);
      const foods = [...N.foods].sort((a, b) => Number(b.favorite) - Number(a.favorite) || String(b.lastUsedAt).localeCompare(String(a.lastUsedAt))).slice(0, 20);
      const seen = new Set();
      const meals = N.meals
        .filter((m) => m.date >= from && m.date <= rq.today)
        .sort((a, b) => b.date.localeCompare(a.date) || String(b.createdAt).localeCompare(String(a.createdAt)))
        .slice(0, 40)
        .filter((m) => {
          const key = (m.title || m.items.map((i) => i.name).join('|')).toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .slice(0, 20)
        .map(({ id, date, type, title, items, source }) => ({ id, date, type, title, items, source }));
      return out(rq, { foods, meals });
    },
  },
  {
    method: 'GET',
    path: `${B}/foods`,
    handler: (rq) => {
      const N = ns(rq);
      const favorite = rq.query.favorite === '1' ? true : rq.query.favorite === '0' ? false : null;
      const foods = N.foods
        .filter((f) => favorite == null || f.favorite === favorite)
        .sort((a, b) => (favorite == null ? Number(b.favorite) - Number(a.favorite) : 0) || String(b.lastUsedAt).localeCompare(String(a.lastUsedAt)))
        .slice(0, 60);
      return out(rq, { foods });
    },
  },
  {
    method: 'POST',
    path: `${B}/foods/from-item`,
    handler: (rq) => {
      const N = ns(rq);
      const it = parseFoodItem(rq.body?.item);
      if (!it) return fail(rq, 400, 'შეავსე ყველა ველი სწორად.');
      const ratio = 100 / it.grams;
      const per100 = {};
      for (const k of NUTRIENT_KEYS) per100[k] = r1((it[k] || 0) * ratio);
      for (const k of MICRO_KEYS) if (finite(it[k])) per100[k] = r1(it[k] * ratio);
      const at = nowIso();
      const row = { id: freshUuid(), userId: N.userId, name: it.name, brand: '', per100, serving: { grams: it.grams, label: 'პორცია' }, source: 'meal', barcode: null, favorite: rq.body?.favorite !== false, useCount: 0, lastUsedAt: at, createdAt: at, updatedAt: at, recipe: null };
      N.foods.push(row);
      return out(rq, { food: row });
    },
  },
  {
    method: 'POST',
    path: `${B}/foods/used`,
    handler: (rq) => {
      const N = ns(rq);
      const ids = Array.isArray(rq.body?.ids) ? rq.body.ids : [];
      const at = nowIso();
      for (const f of N.foods) if (ids.includes(f.id)) Object.assign(f, { useCount: (f.useCount || 0) + 1, lastUsedAt: at });
      return { ok: true };
    },
  },
  {
    method: 'POST',
    path: `${B}/foods/portion`,
    handler: (rq) => {
      const food = rq.body?.food;
      const grams = rq.body?.grams;
      if (!food?.name || !food.per100 || !finite(grams) || grams <= 0 || grams > 10000) return fail(rq, 400, 'შეავსე ყველა ველი სწორად.');
      return out(rq, { item: foodToItem({ brand: '', ...food }, grams) });
    },
  },
  {
    method: 'PUT',
    path: `${B}/foods/:id`,
    handler: (rq) => {
      const N = ns(rq);
      const b = rq.body || {};
      if (b.id !== rq.params.id) return fail(rq, 400, 'ჩანაწერის ნომერი არ ემთხვევა.');
      const name = typeof b.name === 'string' ? b.name.trim() : '';
      if (!isUuid(b.id) || !name || !b.per100 || !NUTRIENT_KEYS.every((k) => finite(b.per100[k]))) return fail(rq, 400, 'შეავსე ყველა ველი სწორად.');
      const existing = N.foods.find((f) => f.id === b.id);
      if (existing && existing.source === 'recipe') return fail(rq, 404, 'ჩანაწერი ვერ მოიძებნა.');
      const at = nowIso();
      const fields = {
        name,
        brand: typeof b.brand === 'string' ? b.brand.trim().slice(0, 80) : '',
        per100: b.per100,
        serving: b.serving ?? null,
        source: b.source || 'custom',
        barcode: b.barcode ?? null,
        favorite: !!b.favorite,
        updatedAt: at,
      };
      let row = existing;
      if (row) Object.assign(row, fields);
      else {
        row = { id: b.id, userId: N.userId, ...fields, useCount: 0, lastUsedAt: at, createdAt: at, recipe: null };
        N.foods.push(row);
      }
      return out(rq, { food: row });
    },
  },
  {
    method: 'PATCH',
    path: `${B}/foods/:id`,
    handler: (rq) => {
      const N = ns(rq);
      if (typeof rq.body?.favorite !== 'boolean') return fail(rq, 400, 'შეავსე ყველა ველი სწორად.');
      const row = N.foods.find((f) => f.id === rq.params.id);
      if (row) Object.assign(row, { favorite: rq.body.favorite, updatedAt: nowIso() });
      return { ok: true };
    },
  },
  {
    method: 'DELETE',
    path: `${B}/foods/:id`,
    handler: (rq) => {
      const N = ns(rq);
      N.foods = N.foods.filter((f) => f.id !== rq.params.id);
      return { ok: true };
    },
  },
  {
    method: 'GET',
    path: `${B}/barcode/:code`,
    handler: (rq) => {
      const N = ns(rq);
      const code = rq.params.code;
      if (!/^\d{6,14}$/.test(code)) return fail(rq, 400, 'შეავსე ყველა ველი სწორად.');
      const own = N.foods.find((f) => f.barcode === code);
      if (own) return out(rq, { product: { ...own, kind: 'saved', quality: 'label' }, code });
      return out(rq, {
        product: {
          name: 'იოგურტი · ნატურალური 3.2%',
          brand: '',
          per100: { calories: 61, protein: 3.5, carbs: 4.7, fat: 3.2, sugar: 4.7, sodium: 46 },
          serving: { grams: 150, label: 'ქილა' },
          barcode: code,
          nutriscore: 'b',
          quality: 'label',
          kind: 'product',
          source: 'openfoodfacts',
        },
        code,
      });
    },
  },

  /* ---------- activities, preferences, measurements ---------- */
  {
    method: 'GET',
    path: `${B}/activities`,
    handler: (rq) => {
      const N = ns(rq);
      const to = rq.query.to || rq.today;
      const range = rangeQuery(rq, rq.query.from || to, to);
      if (range.error) return range.error;
      const activities = N.activities
        .filter((a) => a.date >= range.from && a.date <= range.to)
        .sort((a, b) => b.date.localeCompare(a.date) || String(b.createdAt).localeCompare(String(a.createdAt)))
        .map(publicActivity);
      return out(rq, { activities, kinds: ACTIVITY_KINDS });
    },
  },
  {
    method: 'PUT',
    path: `${B}/activities/:id`,
    handler: (rq) => {
      const N = ns(rq);
      const b = rq.body || {};
      if (b.id !== rq.params.id) return fail(rq, 400, 'ჩანაწერის ნომერი არ ემთხვევა.');
      if (!isUuid(b.id) || !isCivil(b.date) || !ACTIVITY_KINDS[b.kind] || !Number.isInteger(b.minutes) || b.minutes < 1 || b.minutes > 600)
        return fail(rq, 400, 'შეავსე ყველა ველი სწორად.');
      if (b.date > rq.today) return fail(rq, 400, 'მომავალი დღის ვარჯიში ჯერ ვერ ჩაიწერება.');
      const estimated = b.kcal == null;
      const kcal = estimated ? activityKcal(b.kind, b.minutes, nutritionFacts(rq).current?.kg) : Math.max(0, Math.round(b.kcal));
      const fields = { date: b.date, kind: b.kind, minutes: b.minutes, kcal, note: typeof b.note === 'string' ? b.note.trim().slice(0, 200) : '' };
      let row = N.activities.find((a) => a.id === b.id);
      if (row) Object.assign(row, fields);
      else {
        row = { id: b.id, ...fields, source: 'manual', createdAt: nowIso() };
        N.activities.push(row);
      }
      return out(rq, { activity: publicActivity(row), estimated });
    },
  },
  {
    method: 'DELETE',
    path: `${B}/activities/:id`,
    handler: (rq) => {
      const N = ns(rq);
      N.activities = N.activities.filter((a) => a.id !== rq.params.id);
      return { ok: true };
    },
  },
  { method: 'GET', path: `${B}/preferences`, handler: (rq) => ({ preferences: publicPrefs(ns(rq).preferences) }) },
  {
    method: 'PUT',
    path: `${B}/preferences`,
    handler: (rq) => {
      const N = ns(rq);
      const b = rq.body && typeof rq.body === 'object' ? rq.body : {};
      const next = { ...N.preferences, ...b, fasting: N.preferences.fasting };
      next.reminders = { ...N.preferences.reminders, ...(b.reminders || {}) };
      next.macros = { ...N.preferences.macros, ...(b.macros || {}) };
      const m = next.macros;
      const within = (k, lo, hi) => Number.isInteger(m[k]) && m[k] >= lo && m[k] <= hi;
      if (!['auto', 'custom'].includes(m.mode) || !within('protein', 10, 40) || !within('carbs', 15, 65) || !within('fat', 15, 50))
        return fail(rq, 400, 'შეავსე ყველა ველი სწორად.');
      if (m.protein + m.carbs + m.fat !== 100) return fail(rq, 400, 'ცილის, ნახშირწყლებისა და ცხიმის ჯამი 100% უნდა იყოს.');
      for (const k of ['rollover', 'addBurned', 'countSteps']) next[k] = !!next[k];
      N.preferences = {
        rollover: next.rollover,
        addBurned: next.addBurned,
        countSteps: next.countSteps,
        reminders: next.reminders,
        macros: { mode: m.mode, protein: m.protein, carbs: m.carbs, fat: m.fat },
        fasting: next.fasting,
      };
      return { preferences: publicPrefs(N.preferences) };
    },
  },
  {
    method: 'GET',
    path: `${B}/measurements`,
    handler: (rq) => ({ measurements: [...ns(rq).measurements].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 120) }),
  },
  {
    method: 'PUT',
    path: `${B}/measurements/:date`,
    handler: (rq) => {
      const N = ns(rq);
      const date = rq.params.date;
      if (!isCivil(date)) return fail(rq, 400, 'არასწორი თარიღი');
      if (date > rq.today) return fail(rq, 400, 'მომავალი თარიღი ვერ ჩაიწერება.');
      const b = rq.body || {};
      const m = Object.fromEntries(['waistCm', 'hipsCm', 'chestCm', 'armCm', 'thighCm'].map((k) => [k, finite(b[k]) ? b[k] : null]));
      if (!Object.values(m).some((v) => v != null)) return fail(rq, 400, 'მიუთითე მინიმუმ ერთი ზომა.');
      N.measurements = [...N.measurements.filter((x) => x.date !== date), { date, ...m }];
      return { ok: true, measurement: { date, ...m } };
    },
  },
  {
    method: 'DELETE',
    path: `${B}/measurements/:date`,
    handler: (rq) => {
      const N = ns(rq);
      N.measurements = N.measurements.filter((x) => x.date !== rq.params.date);
      return { ok: true };
    },
  },

  /* ---------- fasting (nutrition-fasting.routes.js) — static paths before /:id ---------- */
  { method: 'GET', path: `${B}/fasting`, handler: (rq) => out(rq, fastingState(rq, ns(rq))) },
  {
    method: 'PUT',
    path: `${B}/fasting/screening`,
    handler: (rq) => {
      const N = ns(rq);
      const b = rq.body || {};
      if (!['eatingDisorder', 'pregnancy', 'diabetesMedication'].every((k) => typeof b[k] === 'boolean')) return fail(rq, 400, 'შეავსე ყველა ველი სწორად.');
      N.preferences.fasting = {
        ...N.preferences.fasting,
        screening: { eatingDisorder: b.eatingDisorder, pregnancy: b.pregnancy, diabetesMedication: b.diabetesMedication, doctorApproved: !!b.doctorApproved, answeredAt: nowIso() },
      };
      return out(rq, fastingState(rq, N));
    },
  },
  {
    method: 'PUT',
    path: `${B}/fasting/settings`,
    handler: (rq) => {
      const N = ns(rq);
      const b = rq.body || {};
      const okProtocol = b.protocol === 'custom' || FASTING_PROTOCOLS[b.protocol] === b.targetMinutes;
      if (!Number.isInteger(b.targetMinutes) || b.targetMinutes < FAST_MIN || b.targetMinutes > FAST_MAX || typeof b.notify !== 'boolean' || !okProtocol)
        return fail(rq, 400, 'შეავსე ყველა ველი სწორად.');
      N.preferences.fasting = { ...N.preferences.fasting, protocol: b.protocol, targetMinutes: b.targetMinutes, notify: b.notify };
      return { settings: { protocol: b.protocol, targetMinutes: b.targetMinutes, notify: b.notify, screened: !!N.preferences.fasting.screening } };
    },
  },
  {
    method: 'POST',
    path: `${B}/fasting/start`,
    handler: (rq) => {
      const N = ns(rq);
      const b = rq.body || {};
      if (!isUuid(b.id) || !Number.isInteger(b.targetMinutes) || b.targetMinutes < FAST_MIN || b.targetMinutes > FAST_MAX) return fail(rq, 400, 'შეავსე ყველა ველი სწორად.');
      const existing = N.fasts.find((f) => f.id === b.id);
      if (existing) return { fast: publicFast(existing) };
      const st = fastingState(rq, N);
      if (!st.eligibility.eligible)
        return fail(rq, 403, st.eligibility.reasons[0] || (st.eligibility.needsScreening ? 'ჯერ უპასუხე უსაფრთხოების მოკლე კითხვებს.' : 'ამ ეტაპზე შიმშილის ტაიმერი ექიმთან შეთანხმების გარეშე არ ირთვება.'));
      if (N.fasts.some((f) => !f.endedAt)) return fail(rq, 409, 'შიმშილი უკვე მიმდინარეობს. ჯერ დაასრულე ის.');
      const startedAt = b.startedAt ? new Date(b.startedAt).toISOString() : nowIso();
      const problem = fastTimesProblem(startedAt, null);
      if (problem) return fail(rq, 400, problem);
      const row = { id: b.id, startedAt, endedAt: null, targetMinutes: b.targetMinutes, protocol: b.protocol || 'custom', note: '' };
      N.fasts.push(row);
      return { fast: publicFast(row) };
    },
  },
  {
    method: 'POST',
    path: `${B}/fasting/:id/end`,
    handler: (rq) => {
      const N = ns(rq);
      const row = N.fasts.find((f) => f.id === rq.params.id);
      if (!row) return fail(rq, 404, 'ჩანაწერი ვერ მოიძებნა.');
      if (row.endedAt) return { fast: publicFast(row) };
      const end = rq.body?.endedAt ? new Date(rq.body.endedAt).toISOString() : nowIso();
      const problem = fastTimesProblem(row.startedAt, end);
      if (problem) return fail(rq, 400, problem);
      row.endedAt = end;
      return { fast: publicFast(row) };
    },
  },
  {
    method: 'PUT',
    path: `${B}/fasting/:id`,
    handler: (rq) => {
      const N = ns(rq);
      const b = rq.body || {};
      const row = N.fasts.find((f) => f.id === rq.params.id);
      if (!row) return fail(rq, 404, 'ჩანაწერი ვერ მოიძებნა.');
      if (!b.startedAt || !Number.isInteger(b.targetMinutes)) return fail(rq, 400, 'შეავსე ყველა ველი სწორად.');
      const problem = fastTimesProblem(b.startedAt, b.endedAt ?? null);
      if (problem) return fail(rq, 400, problem);
      if (row.endedAt && b.endedAt == null) return fail(rq, 400, 'დასრულებული შიმშილისთვის მიუთითე დასრულების დრო.');
      Object.assign(row, { startedAt: new Date(b.startedAt).toISOString(), endedAt: b.endedAt ? new Date(b.endedAt).toISOString() : null, targetMinutes: b.targetMinutes, note: typeof b.note === 'string' ? b.note.trim().slice(0, 200) : '' });
      return { fast: publicFast(row) };
    },
  },
  {
    method: 'DELETE',
    path: `${B}/fasting/:id`,
    handler: (rq) => {
      const N = ns(rq);
      N.fasts = N.fasts.filter((f) => f.id !== rq.params.id);
      return { ok: true };
    },
  },
  // Harness control (not an app route): a person who answered the safety questions, fasts 16:8 most days and
  // is 13 h 45 min into tonight's fast (started yesterday 20:30). POST /__seed/fasting after /__reset.
  {
    method: 'POST',
    path: '/__seed/fasting',
    handler: (rq) => {
      const N = ns(rq);
      const t = rq.today;
      N.preferences.fasting = { ...N.preferences.fasting, protocol: '16:8', targetMinutes: 960, notify: true, screening: { eatingDisorder: false, pregnancy: false, diabetesMedication: false, doctorApproved: false, answeredAt: isoAt(shift(t, -15), '20:05') } };
      const done = [[-2, '20:40', 975], [-3, '21:00', 990], [-4, '20:15', 965], [-5, '20:50', 920], [-6, '20:30', 1010], [-8, '21:10', 960], [-9, '20:20', 985]];
      N.fasts = done.map(([d, hhmm, minutes], i) => {
        const startedAt = isoAt(shift(t, d), hhmm);
        return { id: uuidFrom(`fast:${t}:${i}`), startedAt, endedAt: new Date(Date.parse(startedAt) + minutes * 60000).toISOString(), targetMinutes: 960, protocol: '16:8', note: '' };
      });
      N.fasts.push({ id: uuidFrom(`fast:${t}:open`), startedAt: isoAt(shift(t, -1), '20:30'), endedAt: null, targetMinutes: 960, protocol: '16:8', note: '' });
      return { ok: true, fasts: N.fasts.length };
    },
  },
];
