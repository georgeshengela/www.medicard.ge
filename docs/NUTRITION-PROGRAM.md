# Nutrition program — 2026-09-24

The native nutrition hub links the existing food diary and camera estimator to a shared weight goal, daily targets, seven-day meal plan, shopping list and progress. Main database only. No AI is used to calculate targets or assemble recipes. Medi uses the existing consented, signed-action conversation.

## Data and boundaries

- Canonical weight goal remains `HealthProfile.extraAnswers.appState.weightGoal`. No second independent goal. Setup confirms a current weight, stores that measurement in `HealthMetricDaily`, updates profile weight/height and the canonical weight log. Keeping the same target preserves the original starting weight. Goal edits carry `updatedAt` for stale-client merge protection.
- `NutritionProgram`: one current revision per account. Its target snapshot changes only after explicit review. All three suitability answers must be provided. Existing profile conditions, age, known food allergies and protected reproductive mode can block automatic recommendations. General assistant context does not receive reproductive mode or screening answers.
- `NutritionTargetHistory`: date-specific target snapshots, including null on pause. No retroactive overwrite of prior-day targets. `NutritionMeal` alone is the diary intake source; legacy additive `nutritionKcal` is not combined with it.
- `NutritionRecipe`: administrator-managed catalog; initial values are from USDA SR Legacy April 2018, with FDC IDs, ingredient preparation state and allergens. Seed inserts missing IDs only, never overwrites administrator edits.
- `NutritionPlannedMeal`: immutable food snapshot until explicitly swapped/regenerated. Account/date/meal-type uniqueness; consumed snapshots survive regeneration. “I ate this” copies once to the diary under the same UUID; retries preserve later manual edits. Deleting the diary entry removes the consumed mark. Future meals cannot be marked eaten. Photos already recorded as meals should not be recorded again as a plan meal; the UI explains this.
- All reads/writes use authenticated ownership. Native API requests capture the account token and discard responses after account changes. Goal updates use optimistic revisions and row locking compatible with app-state writes. Profile updates preserve canonical app state.
- Pause stops target display and new recommendations but preserves the diary, history and weight goal. Changed weight by 2 kg, changed goal, or 28-day review age asks for explicit review, never silently reduces targets. Future plans remain visible as old snapshots, clearly marked.
- Admin: aggregated use, feature switches, recipe creation/edit/retirement, ingredient amounts and nutrient values, allergens, instructions, source and audit records. No private user meals exposed in this catalog interface.

## Calculation and research

Evidence: [Mifflin–St Jeor original paper](https://pubmed.ncbi.nlm.nih.gov/2305711/), [NIDDK Body Weight Planner scope](https://www.niddk.nih.gov/health-information/weight-management/body-weight-planner), [Health Canada AMDR](https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/dietary-reference-intakes/tables/reference-values-macronutrients.html), [USDA data documentation](https://fdc.nal.usda.gov/data-documentation/).

Product choices, **not individual clinical prescriptions**: 19–78 eligibility, 1.2/1.375/1.55/1.725 activity factors, gentle/steady loss adjustments of −250/−400 kcal, gain +200 kcal, 1500–3500 automatic-target range, BMI review boundaries, initial macro split 20% protein / 50% carbohydrate / 30% fat. Outside the range, refer rather than clamp a deficit into a surplus. No automated prescription in pregnancy/breastfeeding, eating-disorder history, relevant conditions or medical diets. An unrecognized profile allergy or free-text food exclusion is not silently assumed safe. Labels explicitly say estimates, not a clinician or dietitian replacement.

Meal allocation: breakfast 25%, lunch 35%, dinner 30%, snack 10% of energy. A bounded candidate search chooses menus close to the macro guide while discouraging repeated dishes. It skips impractical portion sizes; recipe nutrient values are never fabricated to meet targets. Regeneration uses one batched insert, with already consumed meals protected. Recipe macros are actual reference-derived sums, separately displayed; they are not forced to match the macro guide. No micronutrient-completeness claim. Shopping quantities remain in named edible/prepared states; do not misrepresent cooked grams as raw purchase amounts. Allergens cannot guarantee absence of cross-contamination: check packaging.

## Medi and privacy

`nutrition_goal` hands off a user-stated target OR weight-loss amount in an account-bound, expiring in-memory payload; native setup confirms missing facts and suitability. Legacy `weight_goal` also opens reviewed setup. `nutrition_eat` requires an owned planned-meal ID and explicit reported consumption, through signed confirmation and idempotency. Calorie queries load current targets, seven days of logged totals and today's planned meals. Missing food is unknown; no fasting/exercise compensation or background monitoring promises.

AI disclosure revision `2026-09-24.nutrition-program` adds the specific nutrition conversation category. The separate food-photo promise remains: only selected photo and description, no health profile. Privacy pages include program storage/use/deletion. There is no AI transmission during deterministic setup or planning.

## Verification

- Mobile TypeScript check passed (including final charts and weight-screen integration).
- 51 unit/HTTP checks passed across nutrition, assistant, shared app state and AI consent (including menu balance and unsafe-portion exclusion).
- `node scripts/test-nutrition-program-db.mjs`: 20 checks in a main-database transaction with synthetic accounts, all rolled back; persistence, shared goal, intake vs plan, cross-account denial, future-meal rejection, retry safety, portion edits, regeneration and goal-review preservation.
- Browser UI verified against the main https://medicard.ge API: four-step setup, required-answer validation, known-profile safety block, successful 86 → 76 kg synthetic goal with 1920 kcal guide, seven-day generation, recipe substitution, consumption → diary → energy balance, shopping list, and the matching target on the existing weight screen. The separate account nutrition.qa.20260924@medicard.test is explicitly marked synthetic and retained for review; it contains no real patient information and was not granted AI consent.
- Main database: additive migration and 15 reference-derived recipes installed. The hosted admin asset and live nutrition endpoints were verified after the feature push. Local admin catalog/editor and aggregate usage rendered with the main DB.
- New custom energy dial, three macro indicators, selectable seven-day intake bars and weight area chart checked at mobile widths (390 and 430 px), in light and navy dark themes. Empty days remain unknown, zero-target rings do not invent percentages. Reduced Motion disables the entrance animation. Fixed stray JSX text nodes and web SVG warnings.
- Shared weight history merges daily health measurements with newer canonical weight logs, and the old weight page now displays the real nutrition target rather than a disconnected pace-derived calorie hint. Failed refreshes do not leave an old nutrition target visible.
- Voice recognition and live AI interpretation were not re-tested with personal data; the goal handoff, context scoping, strict action validation and consent gates are covered by automated tests.
- Native iPhone keyboard, camera and haptics need device verification; web screenshots and Expo compilation do not prove hardware behavior.

Apply additive schema and missing catalog entries with `node scripts/install-nutrition.mjs` from server working directory. Release command already runs this installer. Never use schema reset or switch databases.
