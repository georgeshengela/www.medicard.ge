/**
 * English for the Georgian text the nutrition API writes: errors, eligibility reasons, fasting
 * safety copy, activity / serving labels, built-in recipes and catalog food names.
 *
 * The nutrition libraries keep their Georgian byte-identical (many strings are also stored with
 * programs and meals). `nutritionEnglish` (mounted on /api/nutrition) rewrites exact Georgian strings
 * anywhere in an English JSON response; everything else — user-written names, notes, third-party
 * products — passes through unchanged.
 */
import { readFileSync } from "node:fs";
import { NUTRITION_RECIPES_EN, defaultNutritionRecipes, nutritionFoods } from "./nutritionRecipes.js";

const MESSAGES_EN = {
  // Diary / estimate
  "ძალიან ბევრი შეფასებაა მოთხოვნილი. ცოტა ხანში სცადე ხელახლა.": "Too many estimates requested. Please try again in a little while.",
  "ძალიან ბევრი მოთხოვნაა. ცოტა ხანში სცადე ხელახლა.": "Too many requests. Please try again in a little while.",
  "აირჩიე მაქსიმუმ 31 დღე.": "Choose 31 days at most.",
  "ჩანაწერის ნომერი არ ემთხვევა.": "The entry ID doesn't match.",
  "ჩანაწერი ვერ მოიძებნა.": "Entry not found.",
  "წინა შეფასება ვერ წავიკითხე.": "We couldn't read the previous estimate.",
  "AI შეფასება დროებით გამორთულია. ჩანაწერი ხელით დაამატე.": "AI estimates are turned off for now. Please add the entry manually.",
  "შეფასების სერვისი ჯერ არ არის ჩართული.": "The estimate service isn't turned on yet.",
  "გადაიღე ეტიკეტის ფოტო.": "Take a photo of the label.",
  "აირჩიე საკვების ფოტო.": "Choose a photo of your food.",
  "აღწერე რა მიირთვი — მაგ. „ორი ხინკალი და სალათი“.": "Describe what you ate, e.g. \"two khinkali and a salad\".",
  "დაწერე რა უნდა შესწორდეს.": "Write what should be corrected.",
  "ფოტო ვერ გაიხსნა. აირჩიე JPEG, PNG ან HEIC ფოტო.": "The photo couldn't be opened. Choose a JPEG, PNG or HEIC photo.",
  "შეფასება ვერ დასრულდა. სცადე ხელახლა ან შეავსე ხელით.": "The estimate couldn't be finished. Try again or fill it in manually.",
  "შეფასება ვერ დასრულდა. სცადე უფრო ნათელი ფოტო, ზუსტი აღწერა ან დაამატე ხელით.": "The estimate couldn't be finished. Try a clearer photo, a more exact description, or add it manually.",
  "მომავალი დღის კვება ვერ ჩაიწერება.": "You can't log meals for a future day.",
  "აღწერიდან საკვები ვერ ამოვიცანი. სცადე უფრო კონკრეტულად, მაგ. „ერთი ხაჭაპური და ჭიქა მაწონი“.": "We couldn't recognize food in your description. Try being more specific, e.g. \"one khachapuri and a glass of matsoni\".",
  "არასწორი თარიღი": "Invalid date",
  // Saved foods, recipes, copy, barcode, activities
  "შენახული საკვების ლიმიტი (500) ამოწურულია. წაშალე ძველი ჩანაწერები.": "You've reached the limit of 500 saved foods. Delete some old entries.",
  "რეცეპტი ვერ მოიძებნა.": "Recipe not found.",
  "დასაკოპირებელი კვება ვერ მოიძებნა.": "No meals to copy were found.",
  "ეს პროდუქტი ბაზაში ვერ მოიძებნა. გადაიღე ეტიკეტი ან შეავსე ხელით — შემდეგ ჯერზე შტრიხკოდიც იმუშავებს.": "This product isn't in the database. Take a photo of the label or fill it in manually, and the barcode will work next time.",
  "პროდუქტების ბაზა ამჟამად მიუწვდომელია. სცადე ეტიკეტის სკანი ან ხელით შეყვანა.": "The product database is unavailable right now. Try scanning the label or entering it manually.",
  "მომავალი დღის ვარჯიში ჯერ ვერ ჩაიწერება.": "You can't log a workout for a future day yet.",
  "მომავალი თარიღი ვერ ჩაიწერება.": "You can't log a future date.",
  "მიუთითე მინიმუმ ერთი ზომა.": "Enter at least one measurement.",
  "ცილის, ნახშირწყლებისა და ცხიმის ჯამი 100% უნდა იყოს.": "Protein, carbs and fat must add up to 100%.",
  "კოპირების ჩანაწერები ერთმანეთს ემთხვევა.": "The copied entries overlap.",
  "რეჟიმი და ხანგრძლივობა არ ემთხვევა.": "The schedule and duration don't match.",
  // Fasting
  "ჯერ უპასუხე უსაფრთხოების მოკლე კითხვებს.": "First answer the short safety questions.",
  "ამ ეტაპზე შიმშილის ტაიმერი ექიმთან შეთანხმების გარეშე არ ირთვება.": "For now, the fasting timer can't be turned on without your doctor's agreement.",
  "შიმშილი უკვე მიმდინარეობს. ჯერ დაასრულე ის.": "A fast is already running. End it first.",
  "დაწყება 24 საათზე ძველი ვერ იქნება.": "The start can't be more than 24 hours ago.",
  "დასრულებული შიმშილისთვის მიუთითე დასრულების დრო.": "Enter an end time for a finished fast.",
  "18 წლამდე შიმშილის ფანჯრებს არ გირჩევთ — ზრდის პერიოდში რეგულარული კვება მნიშვნელოვანია.": "We don't recommend fasting windows under 18: regular meals matter while you are still growing.",
  "ორსულობისა და ძუძუთი კვების პერიოდში შიმშილის ტაიმერი არ გამოიყენება.": "The fasting timer isn't used during pregnancy or breastfeeding.",
  "კვებითი ქცევის სირთულის ისტორიისას შიმშილის ფანჯრები შეიძლება ზიანის მომტანი იყოს. ტაიმერს არ ვთავაზობთ — სჯობს სპეციალისტის მხარდაჭერა.": "With a history of disordered eating, fasting windows can be harmful. We don't offer the timer; support from a specialist is the better path.",
  "ინსულინი ან შაქრის დამწევი წამალი შიმშილისას საშიშად დაბალი შაქრის რისკს ზრდის.": "Insulin or glucose-lowering medication raises the risk of dangerously low blood sugar while fasting.",
  "ჯანმრთელობის პროფილში ქრონიკული მდგომარეობა ან სამკურნალო დიეტაა მონიშნული.": "Your health profile lists a chronic condition or a medical diet.",
  "დაწყების დრო არასწორია.": "The start time is not valid.",
  "დაწყების დრო მომავალში ვერ იქნება.": "The start time can't be in the future.",
  "დაწყება ერთ კვირაზე ძველი ვერ იქნება.": "The start can't be more than a week ago.",
  "დასრულება დაწყების შემდეგ უნდა იყოს.": "The end must be after the start.",
  "დასრულების დრო მომავალში ვერ იქნება.": "The end time can't be in the future.",
  "ჩანაწერი 48 საათზე გრძელი ვერ იქნება. მიუთითე, როდის დაასრულე სინამდვილეში.": "An entry can't be longer than 48 hours. Enter when you actually finished.",
  // Program
  "რაციონის შედგენა დროებით შეჩერებულია. კვების დღიური კვლავ ხელმისაწვდომია.": "Meal planning is paused for now. Your food diary is still available.",
  "აირჩიე ახლო პერიოდი.": "Choose a nearer period.",
  "გეგმა შეიცვალა. განაახლე გვერდი.": "The plan has changed. Refresh the page.",
  "ახალი რაციონი დღევანდელი ან მომავალი დღიდან შეადგინე.": "Start a new meal plan from today or a future day.",
  "ჯერ მოქმედი კვების გეგმა შეარჩიე.": "First choose an active nutrition plan.",
  "ერთი საბაზისო პორცია უნდა შეიცავდეს 40–1500 კკალ-ს.": "One base serving must contain 40–1500 kcal.",
  "ამ ასაკში კვების მიზანი სპეციალისტთან ერთად შეარჩიე.": "At this age, choose a nutrition goal together with a specialist.",
  "ამ ეტაპზე კალორიული გეგმა სპეციალისტთან ერთად უნდა შეარჩიო.": "For now, a calorie plan should be chosen together with a specialist.",
  "კვებითი ქცევის სირთულისას გირჩევ სპეციალისტის მხარდაჭერას; აპი კალორიების სამიზნეს არ დაგინიშნავს.": "With disordered eating, we recommend support from a specialist; the app won't set a calorie target for you.",
  "ჯანმრთელობის მდგომარეობის ან სამკურნალო დიეტის გამო პერსონალური გეგმა ექიმმა ან დიეტოლოგმა უნდა შეარჩიოს.": "Because of a health condition or medical diet, a personal plan should be chosen by a doctor or dietitian.",
  "მიმდინარე ან სასურველი წონისთვის ინდივიდუალური შეფასებაა საჭირო.": "Your current or target weight needs an individual assessment.",
  "დაკლების მიზანი მიმდინარე წონაზე ნაკლები უნდა იყოს.": "A weight-loss goal must be below your current weight.",
  "მომატების მიზანი მიმდინარე წონაზე მეტი უნდა იყოს.": "A weight-gain goal must be above your current weight.",
  "შენარჩუნებისას სამიზნე მიმდინარე წონაა.": "When maintaining, the target is your current weight.",
  "გამოთვლილი საჭიროება აპის ავტომატური გეგმის ფარგლებს სცდება — შეარჩიე სპეციალისტთან.": "Your calculated needs are outside what the app's automatic plan covers. Choose a plan with a specialist.",
  "საწყისი მიახლოებითი გეგმა: ფორმულა და შენ მიერ არჩეული აქტივობა. ვარჯიშის კალორიები ავტომატურად არ ემატება. გადაამოწმე პროგრესი 2–4 კვირაში; ეს ექიმის ან დიეტოლოგის შეფასებას არ ცვლის.": "A starting estimate: a formula plus the activity level you chose. Workout calories aren't added automatically. Review your progress in 2–4 weeks; this doesn't replace an assessment by a doctor or dietitian.",
  "ამ კერძისთვის სხვა პორცია ან ალტერნატივა შეარჩიე.": "Choose a different portion or an alternative for this dish.",
  "დამატებითი შეზღუდვები გაქვს მითითებული. რაციონი ინდივიდუალურად შეარჩიე სპეციალისტთან; უცნობ შეზღუდვას ავტომატურად ვერ გამოვრიცხავთ.": "You've listed additional restrictions. Choose a meal plan individually with a specialist; we can't automatically exclude a restriction we don't recognize.",
  "ამ შეზღუდვებით ყველა კვებისთვის საკმარისი კერძი ჯერ არ გვაქვს. შეცვალე მხოლოდ რეალური არჩევანი ან შეავსე რაციონი ხელით.": "We don't have enough dishes for every meal with these restrictions yet. Change only what truly applies, or fill in the plan manually.",
  "წონის მიზანი შეიცვალა. კვების გეგმა ხელახლა გადაამოწმე.": "Your weight goal has changed. Review your nutrition plan again.",
  "მიმდინარე წონა შეიცვალა. დღის სამიზნე ხელახლა გადაამოწმე.": "Your current weight has changed. Review your daily target again.",
  "გეგმის განახლების დროა — გადაამოწმე წონა, აქტივობა და ჯანმრთელობის ინფორმაცია.": "It's time to update your plan: check your weight, activity and health information.",
  "გეგმა სხვა ეკრანზე შეიცვალა. განაახლე გვერდი და გადაამოწმე.": "The plan was changed on another screen. Refresh the page and check it.",
  "ჯერ მოქმედი კვების გეგმა გადაამოწმე.": "First review your active nutrition plan.",
  "კვება ვერ მოიძებნა.": "Meal not found.",
  "მომავალი კვება მიღებულად ჯერ ვერ ჩაითვლება.": "A future meal can't be marked as eaten yet.",
  "მიღებული კვება დღიურში შეასწორე.": "Edit an eaten meal in your diary.",
  "ჯერ მოქმედი გეგმა გადაამოწმე.": "First review your active plan.",
  "ეს კერძი არჩეულ კვებასა და შეზღუდვებს არ შეესაბამება.": "This dish doesn't fit the chosen meal and your restrictions.",
  "რაციონიდან დამატებული": "Added from meal plan",
  // Allergies (fixed parts; templated ones below)
  "პროფილის ალერგიები დააზუსტე კვების არჩევანში.": "Clarify your profile allergies in your food preferences.",
  "პროფილში მითითებული საკვები ალერგენები განახლდა. გადაამოწმე კვების არჩევანი.": "The food allergens in your profile were updated. Review your food preferences.",
  // Activity labels
  "სიარული": "Walking",
  "სირბილი": "Running",
  "ველოსიპედი": "Cycling",
  "ძალოვანი ვარჯიში": "Strength training",
  "ცურვა": "Swimming",
  "იოგა / სტრეჩინგი": "Yoga / stretching",
  "სპორტული თამაში": "Team sport",
  "ცეკვა": "Dancing",
  "სხვა აქტივობა": "Other activity",
  // Serving labels (built-in catalog and defaults)
  "პორცია": "serving",
  "ულუფა": "serving",
  "ნაჭერი": "slice",
  "ერთი": "one",
  "თეფში": "plate",
  "თასი": "bowl",
  "ერთი ხინკალი": "one khinkali",
  "ქილა": "jar",
  "ორი კვერცხი": "two eggs",
  "ქოთანი": "pot",
  "ორი ზოლი": "two strips",
  "ორი ნაჭერი": "two slices",
  "ჭიქა": "glass",
  "ჩაის კოვზი": "teaspoon",
  "სუფრის კოვზი": "tablespoon",
  "კონა": "bunch",
  "ნახევარი": "half",
  "მტევანი": "bunch",
  "მუჭა": "handful",
  "ფილის ნახევარი": "half a bar",
  "ორი ცალი": "two pieces",
  "პაკეტი": "pack",
  "ბოთლი": "bottle",
};

const EXACT = new Map(Object.entries(MESSAGES_EN));

// Built-in recipes (title + instructions) and food names.
for (const recipe of defaultNutritionRecipes) {
  const en = NUTRITION_RECIPES_EN[recipe.id];
  if (!en) continue;
  EXACT.set(recipe.data.title, en.title);
  EXACT.set(recipe.data.instructions, en.instructions);
}
for (const food of Object.values(nutritionFoods)) {
  if (food?.name && food.nameEn && !EXACT.has(food.name)) EXACT.set(food.name, food.nameEn);
}
try {
  const catalog = JSON.parse(readFileSync(new URL("../data/nutrition-catalog.json", import.meta.url), "utf8"));
  for (const food of catalog) {
    if (food?.name && food.nameEn && !EXACT.has(food.name)) EXACT.set(food.name, food.nameEn);
  }
} catch {
  /* catalog unreadable: food names stay Georgian */
}

/** English for one Georgian nutrition string, or null when unknown. */
export function nutritionTextEn(text) {
  if (typeof text !== "string" || !text) return null;
  const exact = EXACT.get(text);
  if (exact) return exact;
  let m = /^პროფილის ჩანაწერი დასაზუსტებელია: (.+)\. კვების არჩევანში მიუთითე, უკავშირდება თუ არა საკვებს და რომელი ალერგენები უნდა გამოირიცხოს\.$/.exec(text);
  if (m) {
    return `Your profile entry needs clarifying: ${m[1].replace(/„([^“]*)“/g, "\"$1\"")}. In your food preferences, say whether it relates to food and which allergens should be excluded.`;
  }
  m = /^დამატებითი შეზღუდვა: „([\s\S]*)“\. ამ ტექსტს რეცეპტების ინგრედიენტებს საიმედოდ ვერ ვუსადაგებთ; რაციონი სპეციალისტთან შეარჩიე\. დღის სამიზნე და დღიური ხელმისაწვდომია\.$/.exec(text);
  if (m) {
    return `Additional restriction: "${m[1]}". We can't reliably match this text to recipe ingredients, so choose a meal plan with a specialist. Your daily target and diary are still available.`;
  }
  // Catalog food saved with a brand: "<name> · <brand>"
  const dot = text.lastIndexOf(" · ");
  if (dot > 0) {
    const head = EXACT.get(text.slice(0, dot));
    if (head) return `${head} · ${text.slice(dot + 3)}`;
  }
  return null;
}

const MAX_DEPTH = 12;

function translateDeep(value, depth) {
  if (typeof value === "string") return nutritionTextEn(value) ?? value;
  if (!value || typeof value !== "object" || depth > MAX_DEPTH) return value;
  if (value instanceof Date || Buffer.isBuffer(value)) return value;
  if (Array.isArray(value)) {
    let changed = false;
    const out = value.map((item) => {
      const next = translateDeep(item, depth + 1);
      if (next !== item) changed = true;
      return next;
    });
    return changed ? out : value;
  }
  if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) return value;
  let out = null;
  for (const [key, item] of Object.entries(value)) {
    const next = translateDeep(item, depth + 1);
    if (next !== item) {
      if (!out) out = { ...value };
      out[key] = next;
    }
  }
  return out ?? value;
}

/** Translate known Georgian strings in a JSON payload (new objects only where something changed). */
export function nutritionPayloadEn(body) {
  return translateDeep(body, 0);
}

/** Express middleware: English requests get the English copy of known nutrition strings. */
export function nutritionEnglish(req, res, next) {
  if (req.lang !== "en") return next();
  const json = res.json.bind(res);
  res.json = (body) => json(nutritionPayloadEn(body));
  return next();
}
