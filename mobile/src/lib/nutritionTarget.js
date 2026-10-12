/**
 * The plan wizard's live daily-target estimate — the same formula, floors and rules as the server
 * (`server/src/lib/nutritionProgram.js` `assessNutritionProgram`; a parity test there keeps them equal).
 * It lets the wizard say „≈ 1 260 კკალ“ or „ადგილი თითქმის არ რჩება“ as soon as activity and pace are
 * chosen, instead of a refusal on the last step. The server stays the judge (health answers, age, BMI).
 */

/** Women 1 200, men 1 500 kcal (NHLBI 2013). Mirrors the server's CALORIE_FLOOR. */
export const CALORIE_FLOOR = Object.freeze({ female: 1200, male: 1500 });
const MIN_LOSS_ROOM = 100;
const MULTIPLIER = Object.freeze({ sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725 });
const KCAL_PER_KG = 7700;

/**
 * @param {{ mode: "lose" | "maintain" | "gain", pace: "gentle" | "steady", weightKg: number, heightCm: number, age: number | null, sex: "female" | "male" | "" , activity: string }} input
 * @returns {{ maintenance: number, calories: number | null, floor: number, paceLimited: boolean, noRoom: boolean, weeklyKg: number | null } | null}
 */
export function estimateDailyTarget(input) {
  const { mode, pace, weightKg, heightCm, age, sex, activity } = input;
  const multiplier = MULTIPLIER[activity];
  if (!(weightKg > 0) || !(heightCm > 0) || age == null || !Number.isFinite(age) || (sex !== "female" && sex !== "male") || !multiplier) return null;
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === "male" ? 5 : -161);
  const maintenance = Math.round((bmr * multiplier) / 10) * 10;
  const requested = mode === "lose" ? -(pace === "gentle" ? 250 : 400) : mode === "gain" ? 200 : 0;
  const floor = CALORIE_FLOOR[sex];
  /** @type {number | null} */
  let calories = Math.round((maintenance + requested) / 10) * 10;
  let paceLimited = false;
  let noRoom = false;
  if (calories < floor) {
    if (mode !== "lose") calories = floor;
    else if (maintenance - floor >= MIN_LOSS_ROOM) {
      calories = floor;
      paceLimited = true;
    } else {
      calories = null;
      noRoom = true;
    }
  }
  const weeklyKg = calories == null ? null : Math.round((((calories - maintenance) * 7) / KCAL_PER_KG) * 100) / 100;
  return { maintenance, calories, floor, paceLimited, noRoom, weeklyKg };
}
