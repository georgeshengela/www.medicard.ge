import { readFileSync } from "node:fs";
import { recipeInput } from "./nutritionProgram.js";
// USDA SR Legacy, April 2018. All amounts are edible weights in the named preparation state.
export const nutritionFoods = JSON.parse(
  readFileSync(
    new URL("../data/nutrition-foods.json", import.meta.url),
    "utf8",
  ),
);
function recipe(
  id,
  title,
  type,
  diet,
  allergens,
  parts,
  instructions,
  minutes = 15,
) {
  const items = parts.map(([key, grams]) => ({
    name: nutritionFoods[key].name,
    grams,
    ...Object.fromEntries(
      Object.entries(nutritionFoods[key].per100g).map(([k, v]) => [
        k,
        Math.round(((v * grams) / 100) * 10) / 10,
      ]),
    ),
  }));
  const source =
    "USDA FoodData Central · SR Legacy · " +
    parts.map(([key]) => nutritionFoods[key].fdcId).join(", ");
  return {
    id,
    data: recipeInput.parse({
      title,
      type,
      diet,
      allergens,
      items,
      instructions,
      minutes,
      source,
    }),
  };
}
export const defaultNutritionRecipes = [
  recipe(
    "oat-banana",
    "შვრია ბანანითა და თესლით",
    "breakfast",
    "vegan",
    ["gluten"],
    [
      ["oats", 55],
      ["banana", 100],
      ["seeds", 15],
    ],
    "შვრია მოხარშე წყალში. დაამატე დაჭრილი ბანანი და თესლი. შვრიის წონა მითითებულია მშრალი სახით.",
  ),
  recipe(
    "quinoa-apple",
    "ქინოას თბილი ჯამი ვაშლით",
    "breakfast",
    "vegan",
    [],
    [
      ["quinoa", 220],
      ["apple", 120],
      ["seeds", 20],
    ],
    "მოხარშულ ქინოას შეურიე დაჭრილი ვაშლი და თესლი. სურვილისამებრ დაამატე დარიჩინი.",
  ),
  recipe(
    "yogurt-oat",
    "იოგურტი შვრიითა და ბანანით",
    "breakfast",
    "vegetarian",
    ["milk", "gluten"],
    [
      ["yogurt", 200],
      ["oats", 45],
      ["banana", 100],
    ],
    "შვრია დაალბე იოგურტში, მაცივარში. ჭამის წინ დაამატე ბანანი. გამოიყენე უშაქრო იოგურტი.",
  ),
  recipe(
    "egg-quinoa",
    "კვერცხი ქინოასა და პომიდორთან",
    "breakfast",
    "vegetarian",
    ["eggs"],
    [
      ["egg", 100],
      ["quinoa", 160],
      ["tomato", 120],
      ["oil", 5],
    ],
    "მოხარშულ კვერცხს დაუმატე მზა ქინოა და გარეცხილი პომიდორი. მოასხი მითითებული ზეთი.",
  ),
  recipe(
    "lentil-bowl",
    "ოსპისა და ბრინჯის ჯამი",
    "lunch",
    "vegan",
    [],
    [
      ["lentil", 220],
      ["rice", 130],
      ["tomato", 150],
      ["oil", 10],
    ],
    "მოხარშული ოსპი და ბრინჯი შეურიე პომიდორს. მოასხი ზეთი. პარკოსნებისა და ბრინჯის წონა მზა პროდუქტს ეხება.",
  ),
  recipe(
    "chickpea-quinoa",
    "მუხუდო ქინოათი და მწვანილით",
    "lunch",
    "vegan",
    [],
    [
      ["chickpea", 180],
      ["quinoa", 140],
      ["spinach", 60],
      ["oil", 8],
    ],
    "გარეცხილ ისპანახს დაამატე მოხარშული მუხუდო და ქინოა. მოასხი ზეთი და კარგად აურიე.",
  ),
  recipe(
    "chicken-rice",
    "ქათამი ბრინჯითა და ბროკოლით",
    "lunch",
    "balanced",
    [],
    [
      ["chicken", 130],
      ["rice", 200],
      ["broccoli", 170],
      ["oil", 10],
    ],
    "ქათამი სრულად მოამზადე. გვერდით დაუმატე მოხარშული ბრინჯი და ბროკოლი, მოასხი ზეთი. წონები მზა პროდუქტს ეხება.",
    30,
  ),
  recipe(
    "salmon-quinoa",
    "ორაგული ქინოასა და ბროკოლით",
    "lunch",
    "balanced",
    ["fish"],
    [
      ["salmon", 130],
      ["quinoa", 180],
      ["broccoli", 150],
      ["oil", 5],
    ],
    "თევზი სრულად მოამზადე ღუმელში. მიირთვი მოხარშულ ქინოასა და ბროკოლთან ერთად. მითითებულია მზა წონა.",
    30,
  ),
  recipe(
    "lentil-salad",
    "ოსპის თბილი სალათი",
    "dinner",
    "vegan",
    [],
    [
      ["lentil", 240],
      ["quinoa", 100],
      ["tomato", 150],
      ["spinach", 50],
      ["oil", 8],
    ],
    "მოხარშულ ოსპსა და ქინოას დაამატე გარეცხილი ბოსტნეული და ზეთი. შეურიე სუნელები სურვილისამებრ.",
  ),
  recipe(
    "chickpea-rice",
    "მუხუდო და ბროკოლი",
    "dinner",
    "vegan",
    [],
    [
      ["chickpea", 180],
      ["rice", 100],
      ["broccoli", 180],
      ["oil", 8],
    ],
    "მოხარშულ მუხუდოსა და ბრინჯს შეურიე ბროკოლი. მითითებული ზეთი დაამატე ბოლოს.",
  ),
  recipe(
    "chicken-salad",
    "ქათმის მსუბუქი ჯამი",
    "dinner",
    "balanced",
    [],
    [
      ["chicken", 120],
      ["quinoa", 150],
      ["tomato", 150],
      ["spinach", 50],
      ["oil", 10],
    ],
    "სრულად მომზადებული ქათამი დაჭერი, შეურიე ქინოა და გარეცხილი ბოსტნეული. მოასხი ზეთი.",
    25,
  ),
  recipe(
    "eggs-lentil",
    "ოსპი კვერცხით",
    "dinner",
    "vegetarian",
    ["eggs"],
    [
      ["egg", 100],
      ["lentil", 180],
      ["tomato", 120],
      ["oil", 5],
    ],
    "მოხარშულ ოსპს დაუმატე დაჭრილი მოხარშული კვერცხი და პომიდორი. მოასხი ზეთი.",
  ),
  recipe(
    "apple-seeds",
    "ვაშლი და გოგრის თესლი",
    "snack",
    "vegan",
    [],
    [
      ["apple", 160],
      ["seeds", 20],
    ],
    "ვაშლი გარეცხე და დაჭერი. მიირთვი გარჩეულ გოგრის თესლთან ერთად.",
    5,
  ),
  recipe(
    "banana-walnut",
    "ბანანი და ნიგოზი",
    "snack",
    "vegan",
    ["nuts"],
    [
      ["banana", 100],
      ["walnut", 15],
    ],
    "ბანანი დაჭერი, დაუმატე გარჩეული ნიგოზი. წონები საკვებ ნაწილს ეხება.",
    5,
  ),
  recipe(
    "yogurt-apple",
    "იოგურტი ვაშლით",
    "snack",
    "vegetarian",
    ["milk"],
    [
      ["yogurt", 170],
      ["apple", 130],
    ],
    "უშაქრო იოგურტს შეურიე გარეცხილი, დაჭრილი ვაშლი.",
    5,
  ),
];
