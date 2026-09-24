# კვების დღიური — 2026-09-24

Native route: `/nutrition`; admin: `#/nutrition`. App revision: `1.0.0.11.19` / iOS `1.11.19`.

## User flow

Home daily-care entry and feature directory → choose day → add meal → camera, gallery or manual entry → review each food and its portion → save. Meal types: breakfast, lunch, dinner, snack. Calories, protein, carbohydrates and fat are totals for the portion, not per 100 g. Half/double portion buttons scale all nutrients. Manual fields allow correction from a food label. Saved entries can be edited or deleted after confirmation. Previous days are accessible with date arrows. There is no automatically prescribed calorie deficit, diet or medical recommendation.

Photo analysis is an estimate. Hidden oil, sauces, preparation and scale are uncertain. AI responses must contain bounded, validated numbers and food items; an unclear/non-food image does not create a meal. AI estimates never save automatically. Unsupported images, missing fields, timeouts and connection failures show an actionable error. Failed saves retain the draft; a stable UUID prevents duplicates on retry.

## Storage and privacy

- Uses the existing main database and `https://medicard.ge` API. No database switch.
- Additive `20260924-nutrition.sql` installed on the main DB. Installer is in the release command and is idempotent.
- `NutritionMeal` belongs to one authenticated user. All reads/writes/deletes enforce that ownership. Account deletion cascades to meals.
- Camera/gallery permission is requested from a user button. AI upload requires current disclosure consent on client and server, including a second provider-side check before transmission.
- Only chosen photo + typed description are sent through OpenRouter to the disclosed Google Vertex host. No general health profile, cycle, medication or location context is attached.
- Photos are resized and re-encoded (metadata stripped), processed in memory, and not permanently stored. The saved diary contains confirmed structured food data and optional note.
- The disclosure manifest and privacy policy name this use. The changed disclosure requires a new user decision; no existing real account was pre-accepted.
- Scan metrics have duration/success only, without user identity, food text or images. Admin sees aggregates, not personal diaries.

## API and administration

`GET /api/nutrition/settings`, `GET /api/nutrition/meals?from=YYYY-MM-DD&to=YYYY-MM-DD`, `PUT /api/nutrition/meals/:id`, `DELETE /api/nutrition/meals/:id`, `POST /api/nutrition/estimate` (multipart `photo`, optional `description`). Read window ≤31 days; capped response reports truncation. Photo endpoint is rate-limited. Manual entry remains available when photo AI is disabled.

`GET /api/admin/nutrition/overview` requires `NUTRITION_VIEW`; `PATCH /api/admin/nutrition/settings` additionally requires `NUTRITION_MANAGE`. Existing full-access administrators retain access. Settings changes enter the admin audit log. The dashboard shows users/meals, seven-day counts, failed scans and average duration, plus the photo-service switch.

## Verified

- TypeScript typecheck passed.
- 6 server nutrition validation/calculation tests; 6 consent-routing regression tests; 1 HTTP gate suite (authentication, wrong role, refused consent, invalid dates/body, missing/corrupt image); 3 mobile portion/date tests passed.
- 8 actual main-database checks passed: save, retry deduplication, account isolation, foreign-account overwrite/delete rejection, edit, date filtering and account-delete cascade. All synthetic rows were inside a rolled-back transaction; no real profile was modified.
- Live AI provider accepted the structured-response contract and rejected an in-memory synthetic non-food image. No personal data was sent. This verifies connectivity/non-food handling, **not food-calorie accuracy**.
- Browser: actual main API loads diary; manual food form, totals and doubled portion checked without saving to an existing account. Admin dashboard loads; saving the existing enabled setting returns success.
- Backend commit `c84d67b` was pushed and the main nutrition endpoint changed from 404 to authenticated 401 as expected; signed-in browser reads then succeeded.

## Remaining device validation

Android Maestro attempts were interrupted by stale Expo navigation/CLI connection and then a disconnected/hung driver. They do **not** establish native keyboard or camera success for this module. Temporary emulator handwriting override was restored. iPhone/iPad camera/gallery, consent decline/allow and final save should still be exercised on a real device. No App Store build was made here.

Before release, test varied real food photos (especially Georgian mixed dishes) against known weighed portions/labels; no numerical accuracy claim is justified yet. Barcode scanning, food database search, meal plans and personalized dietary targets are not part of this initial photo/manual diary.

## Design references

- [Cal AI](https://www.calai.app/): photo → estimate → diary inspiration, without copying branding or claiming its advertised accuracy.
- [NIDDK — Food portions](https://www.niddk.nih.gov/health-information/weight-management/just-enough-food-portions): distinction between portion and serving; label-based checking.
- [Review of AI-based image dietary assessment](https://pmc.ncbi.nlm.nih.gov/articles/PMC10836267/): food/portion estimation requires validation against reference data. Manual correction and explicitly estimated results are deliberate product choices.

## Scan reliability correction — 2026-09-24

Reproduced a 503 on the main API with a generated, non-personal banana illustration. The same direct provider request succeeded locally. A real multipart HTTP regression exposed lost AsyncLocalStorage account context after Multer callbacks; the SDK wrapped the consent failure as a connection error. The estimate call now re-enters the authenticated account context and preserves nested consent-revocation errors. The transport still rechecks current consent immediately before sending. The regression fails before the fix and passes after, including revocation between upload and transmission. No consent bypass or provider-routing change.
