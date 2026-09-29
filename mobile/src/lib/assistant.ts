import { localAccountId } from './localAccount';
import { tx } from '../i18n/locale.js';

export type AssistantScope = 'human' | 'pet';
export type AssistantAction = { tool: string; args: Record<string, unknown> };
export type AssistantReview = AssistantAction & { id: string; label: string; token: string };
export type AssistantPlan = { reply: string; review: AssistantReview | null; draft: AssistantAction | null; guidance?: { fields: string[]; question: string | null } | null; contextDomains: string[]; subject?: {id:string; name:string} | null; suggestions?: {label:string; text:string; petId?:string}[] };
export type AssistantSchema = { type?: string; properties?: Record<string, AssistantSchema>; required?: string[]; enum?: (string | number | boolean)[]; const?: string | number | boolean; items?: AssistantSchema; minimum?: number; maximum?: number; maxLength?: number };
export type AssistantChoices = Record<string, { value: string; label: string }[]>;
export type AssistantFeature = { id: string; label: string; group: string; description: string };
export type AssistantGroup = { id: string; label: string; icon: string };
export type AssistantTool = { group?: string; kind?: 'write' | 'handoff'; name: string; label: string; description: string; parameters: AssistantSchema };
export type AssistantNative = { route: string; message?: string; mode?: string; petId?: string; nutritionGoal?: {targetKg?:number;loseKg?:number} };
type Launch = AssistantNative & { owner: string; operationId: string; expires: number };
let launch: Launch | null = null;
const consumed = new Set<string>();
/** A URL cannot start a health AI request: only an in-memory, confirmed, account-bound handoff can. */
export function stageAssistantLaunch(owner: string, operationId: string, native: AssistantNative) {
  if (owner !== localAccountId() || consumed.has(operationId)) return false;
  launch = { ...native, owner, operationId, expires: Date.now() + 60000 };
  return true;
}
export function consumeAssistantPayload(owner: string, route: string): AssistantNative | null {
  const current = launch;
  if (!current || current.owner !== owner || localAccountId() !== owner || current.route !== route || current.expires < Date.now()) return null;
  launch = null;
  if (consumed.has(current.operationId)) return null;
  consumed.add(current.operationId);
  if (consumed.size > 100) consumed.delete(consumed.values().next().value!);
  return current;
}
export function consumeAssistantLaunch(owner:string,route:string):string|null {
  return consumeAssistantPayload(owner,route)?.message || null;
}
const assistantFieldLabelsKa: Record<string, string> = {
  loseKg: 'დასაკლები წონა · კგ', plannedMealId: 'რაციონის კვება', date: 'თარიღი', amountMl: 'წყალი · მლ', goalMl: 'დღიური მიზანი · მლ', targetKg: 'სასურველი წონა · კგ', startKg: 'მიმდინარე წონა · კგ',
  deadlineYmd: 'მიზნის ვადა', targetSteps: 'ნაბიჯების მიზანი', weightKg: 'წონა · კგ', heartRate: 'პულსი · წუთში',
  bloodPressureSystolic: 'ზედა წნევა', bloodPressureDiastolic: 'ქვედა წნევა', sleepHours: 'ძილი · საათი', nutritionKcal: 'დამატებული კალორიები · კკალ',
  startDate: 'დაწყების დღე', endDate: 'დასრულების დღე', courseDays: 'კურსი · დღე', medName: 'მედიკამენტი', dosage: 'შენი დოზა', frequency: 'მიღების დროები', notes: 'შენიშვნა', note: 'შენიშვნა', name: 'სახელი',
  speciesId: 'ცხოველის სახეობა', breedId: 'ჯიში', customBreed: 'ჯიშის დასახელება', sex: 'სქესი', neutered: 'სტერილიზაცია',
  ageKind: 'ასაკის სიზუსტე', birthDate: 'დაბადების თარიღი', approxAgeYears: 'სავარაუდო ასაკი · წელი', approxAgeMonths: 'დამატებით · თვე',
  id: 'ჩანაწერი', petId: 'ცხოველი', recordId: 'შენახული შედეგი', visitId: 'ვიზიტი', medicationId: 'მედიკამენტი', status: 'მდგომარეობა', time: 'დრო · HH:mm',
  doctorType: 'ექიმის სპეციალობა', doctorFirstName: 'ექიმის სახელი', doctorLastName: 'ექიმის გვარი', visitDate: 'ვიზიტის თარიღი', visitTime: 'ვიზიტის დრო', address: 'მისამართი',
  action: 'მოქმედება', flow: 'ინტენსივობა', symptoms: 'სიმპტომები', moods: 'განწყობა', bbt: 'ბაზალური ტემპერატურა · °C',
  ovulationTest: 'ოვულაციის ტესტი', pregnancyTest: 'ორსულობის ტესტი', sleepQuality: 'ძილის ხარისხი', stressLevel: 'სტრესი', energy: 'ენერგია', kickCount: 'დღის მოძრაობების რაოდენობა',
  inputValue: 'წონა', inputUnit: 'ერთეული', recordedOn: 'აღრიცხვის თარიღი', category: 'კატეგორია', reportedStatus: 'დადასტურება', reaction: 'რეაქცია', notedOn: 'შემჩნევის თარიღი', reportedBasis: 'ინფორმაციის წყარო', onsetOn: 'დაწყების თარიღი',
  heightCm: 'სიმაღლე · სმ', bloodType: 'სისხლის ჯგუფი', chronicConditions: 'ქრონიკული მდგომარეობები', allergies: 'ალერგიები', medications: 'მედიკამენტები',
  familyHistory: 'ოჯახური ისტორია', healthGoals: 'ჯანმრთელობის მიზნები', activityLevel: 'აქტივობა', dietType: 'კვება', smokingStatus: 'თამბაქო', alcoholUse: 'ალკოჰოლი',
  kind: 'მოვლის ტიპი', title: 'დასახელება', productId: 'პროდუქტი', formulation: 'ფორმა', batchId: 'პარტიის ნომერი', expiresOn: 'ვადა', dose: 'დოზა', doseUnit: 'დოზის ერთეული', route: 'მიღების გზა', startOn: 'დაწყების დღე', dueTime: 'მიღების დრო', recurrenceKind: 'გამეორება', intervalCount: 'ინტერვალი', recurrenceBasis: 'დათვლის წესი', source: 'ინფორმაციის წყარო', sourceNote: 'წყაროს შენიშვნა', courseEndsOn: 'კურსის დასრულება', timeMode: 'დროის რეჟიმი', timezone: 'დროის სარტყელი', administeredOn: 'ჩატარების დღე', administeredTime: 'ჩატარების დრო',
  avgCycleLength: 'ციკლის საშუალო ხანგრძლივობა', avgPeriodLength: 'პერიოდის ხანგრძლივობა', lastPeriodStart: 'ბოლო პერიოდის დაწყება', isIrregular: 'არარეგულარული ციკლი', dueDate: 'მშობიარობის სავარაუდო თარიღი', pregnancyReferenceDate: 'ორსულობის საწყისი თარიღი', pregnancyReferenceType: 'თარიღის საფუძველი', pregnancyConfirm: 'ორსულობის რეჟიმის დადასტურება', postpartumReferenceDate: 'მშობიარობის თარიღი', postpartumConfirm: 'მშობიარობის შემდგომი რეჟიმის დადასტურება',
  destination: 'გასახსნელი ფუნქცია', mode: 'კონსულტაციის ტიპი', message: 'შეტყობინება',
};
const assistantValueLabelsKa: Record<string, string> = {
  'care/history': 'მოვლის ისტორია', 'care/products': 'მოვლის პროდუქტები', 'care/plan': 'მოვლის დაგეგმვა', 'care/record': 'მოვლის აღრიცხვა', care: 'მოვლა', edit: 'პროფილის რედაქტირება', profile: 'პროფილი', weight: 'წონა', allergies: 'ალერგიები', conditions: 'ჯანმრთელობის ჩანაწერები',
  GP: 'ოჯახის ექიმი', DENTIST: 'სტომატოლოგი', CARDIO: 'კარდიოლოგი', GYN: 'გინეკოლოგი', NEURO: 'ნევროლოგი', ORTHO: 'ორთოპედი', THERAPIST: 'თერაპევტი', OPHTHALMO: 'ოფთალმოლოგი', DERM: 'დერმატოლოგი', PED: 'პედიატრი', OTHER: 'სხვა',
  TRACK_PERIOD: 'ციკლის აღრიცხვა', TRY_TO_CONCEIVE: 'დაორსულების მცდელობა', PREGNANCY: 'ორსულობა', PERIMENOPAUSE: 'პერიმენოპაუზა', POSTPARTUM: 'მშობიარობის შემდეგ', LMP: 'ბოლო მენსტრუაციის დაწყება', USER_SELECTED: 'ჩემ მიერ არჩეული თარიღი',
  VACCINATION: 'ვაქცინაცია', FLEA_TICK: 'რწყილი და ტკიპა', DEWORMING: 'ჭიებზე დამუშავება', MEDICATION: 'მედიკამენტი', ONCE: 'ერთჯერადად', EVERY_N_DAYS: 'ყოველ რამდენიმე დღეში', EVERY_N_WEEKS: 'ყოველ რამდენიმე კვირაში', EVERY_N_MONTHS: 'ყოველ რამდენიმე თვეში', DAILY_COURSE: 'ყოველდღიური კურსი', NONE: 'არ მეორდება', FIXED_CALENDAR: 'ფიქსირებული კალენდრით', FROM_ADMINISTRATION: 'ბოლო ჩატარებიდან', VETERINARIAN: 'ვეტერინარი', PRODUCT_INSTRUCTIONS: 'პროდუქტის ინსტრუქცია', USER_ENTERED: 'ჩემი ჩანაწერი', DATE_BASED: 'დღის მიხედვით', EXACT_TIME: 'ზუსტი დროით', oral: 'პერორალურად', topical: 'გარეგანად', injection: 'ინექციით',
  SEDENTARY: 'მჯდომარე', LIGHT: 'მსუბუქი', MODERATE: 'ზომიერი', ACTIVE: 'აქტიური', VERY_ACTIVE: 'ძალიან აქტიური', OMNIVORE: 'შერეული კვება', VEGETARIAN: 'ვეგეტარიანული', VEGAN: 'ვეგანური', KETO: 'კეტო', NEVER: 'არასდროს', FORMER: 'წარსულში', CURRENT: 'ამჟამად', OCCASIONAL: 'ზოგჯერ', REGULAR: 'რეგულარულად', poor: 'ცუდი', okay: 'საშუალო', good: 'კარგი', low: 'დაბალი', high: 'მაღალი', very_low: 'ძალიან დაბალი', very_high: 'ძალიან მაღალი', normal: 'ჩვეულებრივი', lb: 'ფუნტი', mixed: 'მეტისი',
  true: 'კი', false: 'არა', MALE: 'მამრობითი', FEMALE: 'მდედრობითი', UNKNOWN: 'უცნობია', EXACT: 'ზუსტი თარიღი', APPROXIMATE: 'სავარაუდო ასაკი',
  DOCTOR: 'Medi ექიმი', CONSILIUM: 'ღრმა ანალიზი', dog: 'ძაღლი', cat: 'კატა', unknown: 'უცნობია', custom: 'სხვა ჯიში',
  start: 'დაწყება', end: 'დასრულება', none: 'არ არის', spotting: 'ლაქები', light: 'მსუბუქი', medium: 'საშუალო', heavy: 'უხვი',
  positive: 'დადებითი', negative: 'უარყოფითი', unclear: 'გაურკვეველი', taken: 'მივიღე', skipped: 'გამოვტოვე',
  suspected: 'სავარაუდო', veterinarian_confirmed: 'ვეტერინარის მიერ დადასტურებული', owner_reported: 'ჩემი დაკვირვება', active: 'აქტიური', resolved: 'დასრულებული',
  kg: 'კგ', g: 'გრამი', medication: 'მედიკამენტი', food: 'საკვები', environmental: 'გარემო', other: 'სხვა',
};
const assistantFieldLabelsEn: Record<string, string> = {
  loseKg: 'Weight to lose · kg', plannedMealId: 'Planned meal', date: 'Date', amountMl: 'Water · ml', goalMl: 'Daily goal · ml', targetKg: 'Target weight · kg', startKg: 'Current weight · kg',
  deadlineYmd: 'Goal date', targetSteps: 'Step goal', weightKg: 'Weight · kg', heartRate: 'Heart rate · bpm',
  bloodPressureSystolic: 'Systolic pressure', bloodPressureDiastolic: 'Diastolic pressure', sleepHours: 'Sleep · hours', nutritionKcal: 'Added calories · kcal',
  startDate: 'Start date', endDate: 'End date', courseDays: 'Course · days', medName: 'Medication', dosage: 'Your dose', frequency: 'Dose times', notes: 'Note', note: 'Note', name: 'Name',
  speciesId: 'Species', breedId: 'Breed', customBreed: 'Breed name', sex: 'Sex', neutered: 'Spayed/neutered',
  ageKind: 'Age accuracy', birthDate: 'Date of birth', approxAgeYears: 'Approximate age · years', approxAgeMonths: 'Plus · months',
  id: 'Entry', petId: 'Pet', recordId: 'Saved result', visitId: 'Visit', medicationId: 'Medication', status: 'Status', time: 'Time · HH:mm',
  doctorType: 'Doctor specialty', doctorFirstName: "Doctor's first name", doctorLastName: "Doctor's last name", visitDate: 'Visit date', visitTime: 'Visit time', address: 'Address',
  action: 'Action', flow: 'Flow', symptoms: 'Symptoms', moods: 'Mood', bbt: 'Basal body temperature · °C',
  ovulationTest: 'Ovulation test', pregnancyTest: 'Pregnancy test', sleepQuality: 'Sleep quality', stressLevel: 'Stress', energy: 'Energy', kickCount: 'Kicks today',
  inputValue: 'Weight', inputUnit: 'Unit', recordedOn: 'Recorded on', category: 'Category', reportedStatus: 'Confirmation', reaction: 'Reaction', notedOn: 'Noticed on', reportedBasis: 'Source of information', onsetOn: 'Start date',
  heightCm: 'Height · cm', bloodType: 'Blood type', chronicConditions: 'Chronic conditions', allergies: 'Allergies', medications: 'Medications',
  familyHistory: 'Family history', healthGoals: 'Health goals', activityLevel: 'Activity', dietType: 'Diet', smokingStatus: 'Tobacco', alcoholUse: 'Alcohol',
  kind: 'Care type', title: 'Name', productId: 'Product', formulation: 'Form', batchId: 'Batch number', expiresOn: 'Expiry date', dose: 'Dose', doseUnit: 'Dose unit', route: 'Route', startOn: 'Start date', dueTime: 'Time', recurrenceKind: 'Repeat', intervalCount: 'Interval', recurrenceBasis: 'Counting rule', source: 'Source of information', sourceNote: 'Source note', courseEndsOn: 'Course ends', timeMode: 'Time mode', timezone: 'Time zone', administeredOn: 'Given on', administeredTime: 'Given at',
  avgCycleLength: 'Average cycle length', avgPeriodLength: 'Period length', lastPeriodStart: 'Last period start', isIrregular: 'Irregular cycle', dueDate: 'Estimated due date', pregnancyReferenceDate: 'Pregnancy reference date', pregnancyReferenceType: 'Date based on', pregnancyConfirm: 'Confirm pregnancy mode', postpartumReferenceDate: 'Birth date', postpartumConfirm: 'Confirm postpartum mode',
  destination: 'Feature to open', mode: 'Consultation type', message: 'Message',
};
const assistantValueLabelsEn: Record<string, string> = {
  'care/history': 'Care history', 'care/products': 'Care products', 'care/plan': 'Care planning', 'care/record': 'Care log', care: 'Care', edit: 'Edit profile', profile: 'Profile', weight: 'Weight', allergies: 'Allergies', conditions: 'Health records',
  GP: 'Family doctor', DENTIST: 'Dentist', CARDIO: 'Cardiologist', GYN: 'Gynecologist', NEURO: 'Neurologist', ORTHO: 'Orthopedist', THERAPIST: 'Internist', OPHTHALMO: 'Ophthalmologist', DERM: 'Dermatologist', PED: 'Pediatrician', OTHER: 'Other',
  TRACK_PERIOD: 'Cycle tracking', TRY_TO_CONCEIVE: 'Trying to conceive', PREGNANCY: 'Pregnancy', PERIMENOPAUSE: 'Perimenopause', POSTPARTUM: 'Postpartum', LMP: 'Last period start', USER_SELECTED: 'A date I chose',
  VACCINATION: 'Vaccination', FLEA_TICK: 'Fleas and ticks', DEWORMING: 'Deworming', MEDICATION: 'Medication', ONCE: 'Once', EVERY_N_DAYS: 'Every few days', EVERY_N_WEEKS: 'Every few weeks', EVERY_N_MONTHS: 'Every few months', DAILY_COURSE: 'Daily course', NONE: "Doesn't repeat", FIXED_CALENDAR: 'On a fixed calendar', FROM_ADMINISTRATION: 'From the last dose', VETERINARIAN: 'Veterinarian', PRODUCT_INSTRUCTIONS: 'Product instructions', USER_ENTERED: 'My own entry', DATE_BASED: 'By day', EXACT_TIME: 'At an exact time', oral: 'By mouth', topical: 'On the skin', injection: 'By injection',
  SEDENTARY: 'Sedentary', LIGHT: 'Light', MODERATE: 'Moderate', ACTIVE: 'Active', VERY_ACTIVE: 'Very active', OMNIVORE: 'Mixed diet', VEGETARIAN: 'Vegetarian', VEGAN: 'Vegan', KETO: 'Keto', NEVER: 'Never', FORMER: 'In the past', CURRENT: 'Currently', OCCASIONAL: 'Sometimes', REGULAR: 'Regularly', poor: 'Poor', okay: 'Okay', good: 'Good', low: 'Low', high: 'High', very_low: 'Very low', very_high: 'Very high', normal: 'Normal', lb: 'Pound', mixed: 'Mixed breed',
  true: 'Yes', false: 'No', MALE: 'Male', FEMALE: 'Female', UNKNOWN: 'Unknown', EXACT: 'Exact date', APPROXIMATE: 'Approximate age',
  DOCTOR: 'Medi doctor', CONSILIUM: 'Deep analysis', dog: 'Dog', cat: 'Cat', unknown: 'Unknown', custom: 'Other breed',
  start: 'Start', end: 'End', none: 'None', spotting: 'Spotting', light: 'Light', medium: 'Medium', heavy: 'Heavy',
  positive: 'Positive', negative: 'Negative', unclear: 'Unclear', taken: 'Taken', skipped: 'Skipped',
  suspected: 'Suspected', veterinarian_confirmed: 'Confirmed by a vet', owner_reported: 'My observation', active: 'Active', resolved: 'Resolved',
  kg: 'kg', g: 'Grams', medication: 'Medication', food: 'Food', environmental: 'Environmental', other: 'Other',
};
export const assistantFieldLabels: Record<string, string> = tx(assistantFieldLabelsKa, assistantFieldLabelsEn);
export const assistantValueLabels: Record<string, string> = tx(assistantValueLabelsKa, assistantValueLabelsEn);
export function assistantDisplay(value: unknown): string {
  if (Array.isArray(value)) return value.map(assistantDisplay).join(', ');
  if (value && typeof value === 'object') return Object.entries(value).map(([k, v]) => `${assistantFieldLabels[k] || k}: ${assistantDisplay(v)}`).join('\n');
  return assistantValueLabels[String(value)] || String(value ?? '');
}
