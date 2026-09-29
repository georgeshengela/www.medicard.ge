/**
 * English for the Georgian messages the Pets API returns (validation, conflicts, not-found, schema).
 *
 * Pets are feature-frozen, so the libraries keep their Georgian `fail(...)` / `{ error }` copy
 * byte-identical; `petsEnglishErrors` (mounted once on the /api/pets router) swaps the `error`
 * string of any JSON response for English when the request is English. Unknown strings pass
 * through unchanged.
 */

const MESSAGES_EN = Object.freeze({
  // Ownership / schema
  'ცხოველი ვერ მოიძებნა.': 'Pet not found.',
  'ჩანაწერი ვერ მოიძებნა.': 'Entry not found.',
  'ცხოველების მოდული ჯერ მზად არ არის.': 'My pets is not ready yet.',
  'ცხოველის ჯანმრთელობის ჩანაწერები ჯერ მზად არ არის.': 'Pet health records are not ready yet.',
  'ცხოველის მოვლის ჩანაწერები ჯერ მზად არ არის.': 'Pet care records are not ready yet.',
  'Medi Vet-ის საუბარი ჯერ მზად არ არის.': 'Medi Vet chat is not ready yet.',
  // Pet profile
  'შეიყვანე ცხოველის სახელი.': "Enter your pet's name.",
  'აირჩიე სახეობა.': 'Choose a species.',
  'ეს ჯიში ამ სახეობას არ ერგება.': "This breed doesn't match the species.",
  'ჩაწერე ჯიში.': 'Enter the breed.',
  'ჯიშის სახელი ძალიან გრძელია.': 'The breed name is too long.',
  'აირჩიე სქესი.': 'Choose a sex.',
  'სტერილიზაციის სტატუსი არასწორია.': 'The spay/neuter status is not valid.',
  'აირჩიე ასაკის ტიპი.': 'Choose how to enter the age.',
  'ტექსტი ძალიან გრძელია.': 'The text is too long.',
  'უცნობი ასაკისთვის დაბადების თარიღი არ ინახება.': "A birth date isn't saved when the age is unknown.",
  'უცნობი ასაკისთვის მიახლოებითი ასაკი არ ინახება.': "An approximate age isn't saved when the age is unknown.",
  'ასეთი თარიღი არ არსებობს.': 'That date does not exist.',
  'დაბადების თარიღი მომავალში ვერ იქნება.': 'The birth date cannot be in the future.',
  'შეამოწმე დაბადების თარიღი.': 'Please check the birth date.',
  'ზუსტი თარიღისთვის მიახლოებითი ასაკი არ ინახება.': "An approximate age isn't saved with an exact birth date.",
  'მიახლოებითი ასაკისთვის დაბადების თარიღი არ იწერება.': "A birth date isn't saved with an approximate age.",
  'მიუთითე წლები ან თვეები.': 'Enter years or months.',
  'ასაკი არასწორია.': 'The age is not valid.',
  'თვეები უნდა იყოს 0–11.': 'Months must be 0–11.',
  'მიუთითე ასაკი, ან აირჩიე უცნობი.': 'Enter an age, or choose unknown.',
  'ასაკის ჩაწერის თარიღი არასწორია.': 'The date the age was recorded is not valid.',
  'ასაკის ჩაწერის თარიღი მომავალში ვერ იქნება.': 'The date the age was recorded cannot be in the future.',
  'ერთ ანგარიშზე მაქსიმუმ 20 ცხოველია.': 'You can add up to 20 pets per account.',
  'ფოტო არ არის ატვირთული.': 'No photo was uploaded.',
  'ატვირთე JPEG, PNG ან WEBP ფოტო.': 'Upload a JPEG, PNG or WEBP photo.',
  'დაშვებულია მხოლოდ JPG, PNG, WEBP ან GIF ფოტო.': 'Only JPG, PNG, WEBP or GIF photos are allowed.',
  'არასწორი იდენტიფიკატორი': 'Invalid ID',
  // Health
  'შეიყვანე სახელი.': 'Enter a name.',
  'თარიღი სავალდებულოა.': 'The date is required.',
  'თარიღი არასწორია.': 'The date is not valid.',
  'მომავალი თარიღი არ დაიშვება.': "A future date isn't allowed.",
  'წონა უნდა იყოს დადებითი რიცხვი.': 'Weight must be a positive number.',
  'შეიყვანე წონა.': 'Enter the weight.',
  'აირჩიე ერთეული: კგ, გ ან ფუნტი.': 'Choose a unit: kg, g or lb.',
  'წონა ამ დიაპაზონში ვერ ინახება.': "That weight is outside the range we can save.",
  'აირჩიე ალერგიის კატეგორია.': 'Choose an allergy category.',
  'მიუთითე, სავარაუდოა თუ ვეტერინარის დადასტურებული.': "Say whether it's suspected or confirmed by a vet.",
  'აირჩიე მდგომარეობის სტატუსი.': 'Choose a condition status.',
  'მიუთითე, მფლობელის ჩანაწერია თუ ვეტერინარის დადასტურებული.': "Say whether it's your own note or confirmed by a vet.",
  'დასრულების თარიღი მხოლოდ დასრულებული მდგომარეობისთვის ინახება.': 'An end date is only saved for a resolved condition.',
  'დასრულების თარიღი დაწყების თარიღზე ადრე ვერ იქნება.': 'The end date cannot be before the start date.',
  'არასწორი მოთხოვნის იდენტიფიკატორი.': 'Invalid request ID.',
  'წონის ჩანაწერების ლიმიტი ამოვწურა.': 'You have reached the limit of weight entries.',
  'ალერგიების ლიმიტი ამოვწურა.': 'You have reached the limit of allergies.',
  'მდგომარეობების ლიმიტი ამოვწურა.': 'You have reached the limit of conditions.',
  // Care
  'აირჩიე მოვლის კატეგორია.': 'Choose a care category.',
  'დრო უნდა იყოს სთ:წთ ფორმატში.': 'Time must be in HH:mm format.',
  'აირჩიე მიღების გზა.': 'Choose how it is given.',
  'დოზის ერთეული სავალდებულოა.': 'The dose unit is required.',
  'დოზა სავალდებულოა ერთეულთან ერთად.': 'Enter a dose together with the unit.',
  'აირჩიე გეგმის წყარო.': 'Choose where the plan comes from.',
  'აირჩიე გამეორება.': 'Choose how often it repeats.',
  'წლიური ინტერვალი ამ ვერსიაში არ არის მხარდაჭერილი.': "Yearly intervals aren't supported in this version.",
  'ერთჯერადი მოვლა გამეორების საფუძველს არ იყენებს.': "One-time care doesn't use a repeat basis.",
  'ყოველდღიური კურსი მხოლოდ კალენდარულ თარიღებს მიჰყვება.': 'A daily course follows calendar dates only.',
  'აირჩიე, კალენდარს მიჰყვება თუ დადასტურებულ მიღებას.': 'Choose whether it follows the calendar or the last confirmed dose.',
  'ერთჯერად მოვლას ინტერვალი არ აქვს.': "One-time care doesn't have an interval.",
  'მიუთითე ინტერვალი.': 'Enter an interval.',
  'დღეების ინტერვალი ძალიან დიდია.': 'The interval in days is too long.',
  'კვირების ინტერვალი ძალიან დიდია.': 'The interval in weeks is too long.',
  'თვეების ინტერვალი ძალიან დიდია.': 'The interval in months is too long.',
  'ყოველდღიურ კურსს სჭირდება მინიმუმ ერთი დრო.': 'A daily course needs at least one time.',
  'დროების რაოდენობა ძალიან დიდია.': 'Too many times.',
  'რამდენიმე დღიური დრო მხოლოდ ყოველდღიურ კურსზეა.': 'Several times a day is only for a daily course.',
  'კურსის დასასრული დაწყებაზე ადრე ვერ იქნება.': 'The course end cannot be before the start.',
  'გამეორებების ლიმიტი არასწორია.': 'The repeat limit is not valid.',
  'ყოველდღიურ კურსს სჭირდება დასასრული ან გამეორებების ლიმიტი.': 'A daily course needs an end date or a repeat limit.',
  'ყოველდღიური კურსი დროს მოითხოვს.': 'A daily course needs a time.',
  'საათობრივი წანაცვლება არასწორია.': 'The time zone offset is not valid.',
  'მიუთითე მოვლის შემთხვევა.': 'Choose the care occurrence.',
  'გეგმის ვერსია არასწორია.': 'The plan version is not valid.',
  'პროდუქტი ამ ცხოველს არ ეკუთვნის.': "This product doesn't belong to this pet.",
  'ეს პროდუქტი არქივშია.': 'This product is archived.',
  'პროდუქტების ლიმიტი ამოვწურა.': 'You have reached the limit of products.',
  'გეგმების ლიმიტი ამოვწურა.': 'You have reached the limit of care plans.',
  'გეგმა გაუქმებულია. განაახლე სია.': 'This plan was cancelled. Refresh the list.',
  'შეხსენებამ გეგმა არ უნდა შეცვალოს.': "A reminder can't change the care plan.",
  'მოვლის შემთხვევა არასწორია.': 'The care occurrence is not valid.',
  'გეგმა აღარ არის აქტიური. განაახლე სია.': 'This plan is no longer active. Refresh the list.',
  'გეგმა შეიცვალა. განაახლე სია და სცადე ხელახლა.': 'The plan has changed. Refresh the list and try again.',
  'ეს შემთხვევა ამ გეგმას აღარ ეკუთვნის.': 'This occurrence no longer belongs to this plan.',
  'იგივე მოთხოვნა სხვა მონაცემებით უკვე გამოყენებულია.': 'This request was already used with different details.',
  'ეს შემთხვევა უკვე აღრიცხულია.': 'This occurrence is already logged.',
  'ეს შემთხვევა უკვე დასრულებულია. განაახლე სია.': 'This occurrence is already resolved. Refresh the list.',
  'ეს შემთხვევა უკვე დასრულებულია.': 'This occurrence is already resolved.',
  'გეგმა ამ ცხოველს არ ეკუთვნის.': "This plan doesn't belong to this pet.",
  'ისტორიის ლიმიტი ამოვწურა.': 'You have reached the history limit.',
  'გაუქმებული ჩანაწერი აღარ იცვლება.': "A voided entry can't be changed.",
  'დადასტურებული მიღებიდან გამეორება შეიცვლება.': 'Repeats counted from the last confirmed dose will change.',
});

/** Field names used inside the Georgian templates below. */
const FIELDS_EN = Object.freeze({
  'სათაური': 'Title',
  'სახელი': 'Name',
  'თარიღი': 'Date',
  'დოზა': 'Dose',
  'ერთეული': 'Unit',
  'ფორმა / სიძლიერე': 'Form / strength',
  'პარტია': 'Batch',
  'შენიშვნა': 'Note',
  'ვადა': 'Expiry date',
  'დაწყების თარიღი': 'Start date',
  'კურსის დასასრული': 'Course end',
  'წყაროს შენიშვნა': 'Source note',
  'საათობრივი სარტყელი': 'Time zone',
  'მიღების თარიღი': 'Date given',
  'რეაქცია': 'Reaction',
});

const fieldEn = (field) => FIELDS_EN[field] || field;

/** English for a Georgian Pets message, or null when we don't know it. */
export function petsMessageEn(message) {
  if (typeof message !== 'string' || !message) return null;
  if (MESSAGES_EN[message]) return MESSAGES_EN[message];
  let m = /^(.+) მაქსიმუმ (\d+) სიმბოლოა\.$/.exec(message);
  if (m) return `${fieldEn(m[1])} can be at most ${m[2]} characters.`;
  m = /^(.+) სავალდებულოა\.$/.exec(message);
  if (m && FIELDS_EN[m[1]]) return `${fieldEn(m[1])} is required.`;
  m = /^(.+) არასწორია\.$/.exec(message);
  if (m && FIELDS_EN[m[1]]) return `${fieldEn(m[1])} is not valid.`;
  m = /^სახელი უნდა იყოს 1–(\d+) სიმბოლო\.$/.exec(message);
  if (m) return `The name must be 1–${m[1]} characters.`;
  return null;
}

/** Message in the request language ('ka' returns the Georgian unchanged). */
export function petsMessage(message, lang = 'ka') {
  if (lang !== 'en') return message;
  return petsMessageEn(message) || message;
}

/**
 * Express middleware: for English requests, JSON bodies with a Georgian `error` string get the
 * English copy. Georgian requests are untouched.
 */
export function petsEnglishErrors(req, res, next) {
  if (req.lang !== 'en') return next();
  const json = res.json.bind(res);
  res.json = (body) => {
    if (body && typeof body === 'object' && !Array.isArray(body) && typeof body.error === 'string') {
      const en = petsMessageEn(body.error);
      if (en) return json({ ...body, error: en });
    }
    return json(body);
  };
  return next();
}
