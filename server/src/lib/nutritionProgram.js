import { z } from "zod";
import { civilDate, foodItem, totals } from "./nutrition.js";

export const NUTRITION_METHOD_VERSION = "2026-09-24.1";
export const ALLERGENS = [
  "milk",
  "eggs",
  "fish",
  "shellfish",
  "nuts",
  "peanuts",
  "soy",
  "gluten",
  "sesame",
  "celery",
  "mustard",
  "sulphites",
  "lupin",
  "molluscs",
];
export const programInput = z
  .object({
    mode: z.enum(["lose", "maintain", "gain"]),
    weightKg: z.number().min(30).max(300),
    heightCm: z.number().min(130).max(220),
    birthDate: civilDate,
    sex: z.enum(["female", "male"]),
    targetKg: z.number().min(30).max(300),
    activity: z.enum(["sedentary", "light", "moderate", "active"]),
    pace: z.enum(["gentle", "steady"]),
    diet: z.enum(["balanced", "vegetarian", "vegan"]),
    allergens: z.array(z.enum(ALLERGENS)).max(14),
    avoidFoods: z.string().trim().max(300),
    screening: z
      .object({
        pregnancyOrBreastfeeding: z.boolean(),
        eatingDisorder: z.boolean(),
        medicalDiet: z.boolean(),
      })
      .strict(),
  })
  .strict();
export const recipeInput = z
  .object({
    title: z.string().trim().min(3).max(120),
    type: z.enum(["breakfast", "lunch", "dinner", "snack"]),
    diet: z.enum(["balanced", "vegetarian", "vegan"]),
    allergens: z.array(z.enum(ALLERGENS)).max(14),
    items: z.array(foodItem).min(1).max(20),
    instructions: z.string().trim().min(10).max(2000),
    minutes: z.number().int().min(1).max(240),
    source: z.string().trim().min(3).max(300),
  })
  .strict()
  .refine(
    (v) => totals(v.items).calories >= 40 && totals(v.items).calories <= 1500,
    "ერთი საბაზისო პორცია უნდა შეიცავდეს 40–1500 კკალ-ს.",
  );

export function shiftCivil(day, n) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function ageOn(birth, day) {
  if (!birth || !civilDate.safeParse(String(birth).slice(0, 10)).success)
    return null;
  const b = String(birth).slice(0, 10);
  return (
    Number(day.slice(0, 4)) -
    Number(b.slice(0, 4)) -
    (day.slice(5) < b.slice(5) ? 1 : 0)
  );
}
/** Conservative product eligibility, not a diagnosis or a clinical prescription. */
export function assessNutritionProgram(raw, facts = {}, day) {
  const input = programInput.parse(raw);
  const age = ageOn(input.birthDate, day);
  const profileAge = facts.birthDate ? ageOn(facts.birthDate, day) : age;
  const bmi = input.weightKg / (input.heightCm / 100) ** 2;
  const targetBmi = input.targetKg / (input.heightCm / 100) ** 2;
  const reasons = [];
  if (facts.unknownAllergies)
    reasons.push(
      "პროფილში ალერგიაა, რომლის კვებით შესაბამისობას ავტომატურად ვერ ვადასტურებთ. გეგმა სპეციალისტთან გადაამოწმე.",
    );
  if ((facts.requiredAllergens || []).some((a) => !input.allergens.includes(a)))
    reasons.push(
      "პროფილში მითითებული საკვები ალერგენებიც უნდა გამორიცხო კვების არჩევანში.",
    );
  if (
    age == null ||
    profileAge == null ||
    age < 19 ||
    age > 78 ||
    profileAge < 19 ||
    profileAge > 78
  )
    reasons.push("ამ ასაკში კვების მიზანი სპეციალისტთან ერთად შეარჩიე.");
  if (facts.sensitiveRestriction || input.screening.pregnancyOrBreastfeeding)
    reasons.push("ამ ეტაპზე კალორიული გეგმა სპეციალისტთან ერთად უნდა შეარჩიო.");
  if (input.screening.eatingDisorder)
    reasons.push(
      "კვებითი ქცევის სირთულისას გირჩევ სპეციალისტის მხარდაჭერას; აპი კალორიების სამიზნეს არ დაგინიშნავს.",
    );
  if (facts.medicalRestriction || input.screening.medicalDiet)
    reasons.push(
      "ჯანმრთელობის მდგომარეობის ან სამკურნალო დიეტის გამო პერსონალური გეგმა ექიმმა ან დიეტოლოგმა უნდა შეარჩიოს.",
    );
  if (bmi < 18.5 || bmi >= 40 || targetBmi < 18.5 || targetBmi >= 40)
    reasons.push(
      "მიმდინარე ან სასურველი წონისთვის ინდივიდუალური შეფასებაა საჭირო.",
    );
  if (input.mode === "lose" && input.targetKg >= input.weightKg)
    reasons.push("დაკლების მიზანი მიმდინარე წონაზე ნაკლები უნდა იყოს.");
  if (input.mode === "gain" && input.targetKg <= input.weightKg)
    reasons.push("მომატების მიზანი მიმდინარე წონაზე მეტი უნდა იყოს.");
  if (
    input.mode === "maintain" &&
    Math.abs(input.targetKg - input.weightKg) > 0.1
  )
    reasons.push("შენარჩუნებისას სამიზნე მიმდინარე წონაა.");
  const bmr =
    10 * input.weightKg +
    6.25 * input.heightCm -
    5 * age +
    (input.sex === "male" ? 5 : -161);
  const multiplier = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
  }[input.activity];
  const maintenance = Math.round((bmr * multiplier) / 10) * 10;
  const adjustment =
    input.mode === "lose"
      ? -(input.pace === "gentle" ? 250 : 400)
      : input.mode === "gain"
        ? 200
        : 0;
  // Universal conservative floor; do not silently clamp a requested deficit into a surplus.
  const calories = Math.round((maintenance + adjustment) / 10) * 10;
  if (calories < 1500 || calories > 3500)
    reasons.push(
      "გამოთვლილი საჭიროება აპის ავტომატური გეგმის ფარგლებს სცდება — შეარჩიე სპეციალისტთან.",
    );
  return {
    eligible: reasons.length === 0,
    reasons,
    methodVersion: NUTRITION_METHOD_VERSION,
    targets: reasons.length
      ? null
      : {
          calories,
          protein: Math.round((calories * 0.2) / 4),
          carbs: Math.round((calories * 0.5) / 4),
          fat: Math.round((calories * 0.3) / 9),
          maintenance,
          adjustment,
          method: "Mifflin–St Jeor",
        },
    explanation:
      "საწყისი მიახლოებითი გეგმა: ფორმულა და შენ მიერ არჩეული აქტივობა. ვარჯიშის კალორიები ავტომატურად არ ემატება. გადაამოწმე პროგრესი 2–4 კვირაში; ეს ექიმის ან დიეტოლოგის შეფასებას არ ცვლის.",
    input,
  };
}

export function recipeAllowed(recipe, config) {
  const r = recipe.data || recipe;
  if (recipe.active === false) return false;
  if (config.diet === "vegan" && r.diet !== "vegan") return false;
  if (config.diet === "vegetarian" && r.diet === "balanced") return false;
  return !r.allergens.some((a) => config.allergens.includes(a));
}
export function portionRecipe(recipe, calories) {
  const r = recipe.data || recipe;
  const ratio = calories / totals(r.items).calories;
  if (!Number.isFinite(ratio) || ratio < 0.2 || ratio > 5)
    throw Object.assign(
      new Error("ამ კერძისთვის სხვა პორცია ან ალტერნატივა შეარჩიე."),
      { status: 400 },
    );
  const items = r.items.map((i) => ({
    ...i,
    ...Object.fromEntries(
      ["grams", "calories", "protein", "carbs", "fat"].map((k) => [
        k,
        Math.round(i[k] * ratio * 10) / 10,
      ]),
    ),
  }));
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
export function buildWeek(config, target, recipes, from, variant = 0) {
  if (config.avoidFoods)
    throw Object.assign(
      new Error(
        "დამატებითი შეზღუდვები გაქვს მითითებული. რაციონი ინდივიდუალურად შეარჩიე სპეციალისტთან; უცნობ შეზღუდვას ავტომატურად ვერ გამოვრიცხავთ.",
      ),
      { status: 422 },
    );
  const selected = recipes.filter((r) => recipeAllowed(r, config));
  const fractions = { breakfast: 0.25, lunch: 0.35, dinner: 0.3, snack: 0.1 };
  const result = [];
  for (let n = 0; n < 7; n++)
    for (const [type, fraction] of Object.entries(fractions)) {
      const choices = selected.filter((r) => (r.data || r).type === type);
      if (!choices.length)
        throw Object.assign(
          new Error(
            "ამ შეზღუდვებით ყველა კვებისთვის საკმარისი კერძი ჯერ არ გვაქვს. შეცვალე მხოლოდ რეალური არჩევანი ან შეავსე რაციონი ხელით.",
          ),
          { status: 422 },
        );
      const recipe = choices[(n + variant) % choices.length];
      result.push({
        date: shiftCivil(from, n),
        type,
        recipeId: recipe.id,
        ...portionRecipe(recipe, target.calories * fraction),
      });
    }
  return result;
}

export function summarizeNutritionDays(meals, from, count, history = []) {
  return Array.from({ length: count }, (_, i) => {
    const date = shiftCivil(from, i),
      rows = meals.filter((m) => m.date === date);
    const target =
      history
        .filter((h) => h.date <= date)
        .sort((a, b) => b.date.localeCompare(a.date))[0]?.targets || null;
    return {
      date,
      mealCount: rows.length,
      recorded: rows.length > 0,
      totals: totals(rows.flatMap((r) => r.items)),
      target,
    };
  });
}

export function shoppingList(planned) {
  const map = new Map();
  for (const meal of planned)
    for (const item of (meal.data || meal).items)
      map.set(item.name, (map.get(item.name) || 0) + item.grams);
  return [...map].map(([name, grams]) => ({ name, grams: Math.round(grams) }));
}
