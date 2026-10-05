// MEDICARD web — Medi: ONE chat (owner 2026-10-03), mirrors mobile/src/components/medi/MediChat.tsx + lib/mediThread.ts.
//   Every message goes to the planner (POST /api/assistant/plan). A health question comes back as a `consult`
//   action and the clinical answer (POST /api/ai/query DOCTOR) streams right into the same thread, no tap.
//   The „კონსილიუმი“ switch on the composer sends straight to /api/ai/query CONSILIUM.
//   Writes still come back as a review card (Save / Cancel); nothing is saved without the click.
// Storage: the thread is an ASSISTANT ChatSession; each clinical answer also lives in its own DOCTOR / CONSILIUM
// session and the thread's copy carries `kind` + `linkedSessionId`. An old consultation opened here continues
// in a new thread that copies its last 30 turns.
// Query: ?session=<id> (also ?sessionId=); old links ?mode=doctor (next question straight to the doctor) and
// ?mode=deep (switch on) still work. Drafts from other pages travel in sessionStorage, never in the URL.
// Every request that sends data to an AI goes through withAiConsent first.
import {
  h, mount, clear, icon, button, iconButton, toast, openModal, confirmDialog, markdown, relDay, fmtTime, fmtDate, parseDate, ymd,
} from '../ui.js';
import { get, post, del, stream, invalidate, ApiError } from '../api.js';
import { withAiConsent } from '../aiConsent.js';
import { t, isEn } from '../i18n.js';
import { session, firstName, featureOn } from '../session.js';

const CSS_HREF = '/app/css/medi.css';
const APP_STORE = 'https://apps.apple.com/app/id6812517519';
const LIMIT = 4000;
const DISCLAIMER = t('ეს არ არის დიაგნოზი — საჭიროებისას ექიმს მიმართე.', 'This is not a diagnosis — see a doctor when needed.');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ANSWER_IN_HISTORY = 1500;

function ensureCss() {
  if (!document.querySelector(`link[href="${CSS_HREF}"]`)) document.head.append(h('link', { rel: 'stylesheet', href: CSS_HREF }));
}

const STARTERS = [
  { icon: 'droplet', ink: 'sky', text: t('დღეს 500 მლ წყალი დავლიე', 'I drank 500 ml of water today') },
  { icon: 'pill', ink: 'teal', text: t('მინდა ახალი წამალი დავამატო', 'I want to add a new medication') },
  { icon: 'brain', ink: 'violet', text: t('სამი დღეა თავი მტკივა', 'I’ve had a headache for three days') },
  { icon: 'calendar', ink: 'amber', text: t('ექიმთან ვიზიტი დამიგეგმე', 'Plan a doctor visit for me') },
];
const CONSILIUM_CHECKLIST = isEn
  ? ['What’s bothering you and for how long', 'Chronic conditions and allergies', 'Tests and scans you’ve had', 'What you take now and what you’ve tried']
  : ['რა გაწუხებს და რამდენი ხანია', 'ქრონიკული დაავადებები და ალერგიები', 'ჩატარებული ანალიზები და კვლევები', 'რას იღებ ახლა და რა სცადე'];
/** Admin „მოდულები“: `mediDoctor` off → the planner answers with the admin's message; `mediDeep` off → no switch. */
const doctorOn = () => featureOn('mediDoctor');
const deepOn = () => featureOn('mediDeep');
/** How a saved session reads in the history list. */
const SESSION_LOOK = {
  ASSISTANT: { label: 'Medi', icon: 'sparkles', ink: 'teal' },
  DOCTOR: { label: t('კონსულტაცია', 'Consultation'), icon: 'stethoscope', ink: 'blue' },
  CONSILIUM: { label: t('კონსილიუმი', 'Consilium'), icon: 'users', ink: 'violet' },
};

const MONTHS_KA = ['იანვარი', 'თებერვალი', 'მარტი', 'აპრილი', 'მაისი', 'ივნისი', 'ივლისი', 'აგვისტო', 'სექტემბერი', 'ოქტომბერი', 'ნოემბერი', 'დეკემბერი'];
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
/** Card values in words (mobile mediThread.humanCardValue): an ISO date never reaches the screen. */
function humanDates(value) {
  const year = new Date().getFullYear();
  return String(value).replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, (all, y, m, d) => {
    const month = (isEn ? MONTHS_EN : MONTHS_KA)[Number(m) - 1];
    if (!month) return all;
    const day = isEn ? `${month} ${Number(d)}` : `${Number(d)} ${month}`;
    return Number(y) === year ? day : `${day} ${y}`;
  });
}

/** The planner asked for the clinical model (mobile mediThread.consultFromReview). */
function consultFromReview(review, fallback) {
  if (!review || review.tool !== 'consult') return null;
  const m = typeof review.args?.message === 'string' && review.args.message.trim().length >= 2 ? review.args.message.trim() : String(fallback || '').trim();
  return { message: m.slice(0, LIMIT), mode: review.args?.mode === 'CONSILIUM' ? 'CONSILIUM' : 'DOCTOR' };
}

/* ── Planner review helpers (ported from mobile/src/lib/assistant.ts + assistantDialog.ts) ── */
function dialogIntent(text) {
  const v = text.trim().replace(/[.!?։,;]+$/g, '').trim().replace(/\s+/g, ' ').toLowerCase();
  if (['კი', 'დიახ', 'შეინახე', 'დაადასტურე', 'კი შეინახე', 'დიახ შეინახე', 'კი დაადასტურე', 'გააგრძელე', 'ვეთანხმები'].includes(v)) return 'confirm';
  if (['yes', 'yeah', 'yep', 'save', 'confirm', 'yes save', 'yes confirm', 'continue', 'i agree', 'save it'].includes(v)) return 'confirm';
  if (['არა', 'გააუქმე', 'გაუქმება', 'არა გააუქმე', 'არ შეინახო', 'შეჩერდი'].includes(v)) return 'cancel';
  if (['no', 'nope', 'cancel', 'no cancel', "don't save", 'stop'].includes(v)) return 'cancel';
  return 'message';
}

const FIELD_LABELS_KA = {
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
  destination: 'გასახსნელი ფუნქცია', mode: 'კონსულტაციის ტიპი', message: 'შეტყობინება', values: 'ცვლილებები',
};
const VALUE_LABELS_KA = {
  'care/history': 'მოვლის ისტორია', 'care/products': 'მოვლის პროდუქტები', 'care/plan': 'მოვლის დაგეგმვა', 'care/record': 'მოვლის აღრიცხვა', care: 'მოვლა', edit: 'პროფილის რედაქტირება', profile: 'პროფილი', weight: 'წონა', allergies: 'ალერგიები', conditions: 'ჯანმრთელობის ჩანაწერები',
  GP: 'ოჯახის ექიმი', DENTIST: 'სტომატოლოგი', CARDIO: 'კარდიოლოგი', GYN: 'გინეკოლოგი', NEURO: 'ნევროლოგი', ORTHO: 'ორთოპედი', THERAPIST: 'თერაპევტი', OPHTHALMO: 'ოფთალმოლოგი', DERM: 'დერმატოლოგი', PED: 'პედიატრი', OTHER: 'სხვა',
  TRACK_PERIOD: 'ციკლის აღრიცხვა', TRY_TO_CONCEIVE: 'დაორსულების მცდელობა', PREGNANCY: 'ორსულობა', PERIMENOPAUSE: 'პერიმენოპაუზა', POSTPARTUM: 'მშობიარობის შემდეგ', LMP: 'ბოლო მენსტრუაციის დაწყება', USER_SELECTED: 'ჩემ მიერ არჩეული თარიღი',
  VACCINATION: 'ვაქცინაცია', FLEA_TICK: 'რწყილი და ტკიპა', DEWORMING: 'ჭიებზე დამუშავება', MEDICATION: 'მედიკამენტი', ONCE: 'ერთჯერადად', EVERY_N_DAYS: 'ყოველ რამდენიმე დღეში', EVERY_N_WEEKS: 'ყოველ რამდენიმე კვირაში', EVERY_N_MONTHS: 'ყოველ რამდენიმე თვეში', DAILY_COURSE: 'ყოველდღიური კურსი', NONE: 'არ მეორდება', FIXED_CALENDAR: 'ფიქსირებული კალენდრით', FROM_ADMINISTRATION: 'ბოლო ჩატარებიდან', VETERINARIAN: 'ვეტერინარი', PRODUCT_INSTRUCTIONS: 'პროდუქტის ინსტრუქცია', USER_ENTERED: 'ჩემი ჩანაწერი', DATE_BASED: 'დღის მიხედვით', EXACT_TIME: 'ზუსტი დროით', oral: 'პერორალურად', topical: 'გარეგანად', injection: 'ინექციით',
  SEDENTARY: 'მჯდომარე', LIGHT: 'მსუბუქი', MODERATE: 'ზომიერი', ACTIVE: 'აქტიური', VERY_ACTIVE: 'ძალიან აქტიური', OMNIVORE: 'შერეული კვება', VEGETARIAN: 'ვეგეტარიანული', VEGAN: 'ვეგანური', KETO: 'კეტო', NEVER: 'არასდროს', FORMER: 'წარსულში', CURRENT: 'ამჟამად', OCCASIONAL: 'ზოგჯერ', REGULAR: 'რეგულარულად', poor: 'ცუდი', okay: 'საშუალო', good: 'კარგი', low: 'დაბალი', high: 'მაღალი', very_low: 'ძალიან დაბალი', very_high: 'ძალიან მაღალი', normal: 'ჩვეულებრივი', lb: 'ფუნტი', mixed: 'მეტისი',
  true: 'კი', false: 'არა', MALE: 'მამრობითი', FEMALE: 'მდედრობითი', UNKNOWN: 'უცნობია', EXACT: 'ზუსტი თარიღი', APPROXIMATE: 'სავარაუდო ასაკი',
  DOCTOR: 'Medi ექიმი', CONSILIUM: 'კონსილიუმი', dog: 'ძაღლი', cat: 'კატა', unknown: 'უცნობია', custom: 'სხვა ჯიში',
  start: 'დაწყება', end: 'დასრულება', none: 'არ არის', spotting: 'ლაქები', light: 'მსუბუქი', medium: 'საშუალო', heavy: 'უხვი',
  positive: 'დადებითი', negative: 'უარყოფითი', unclear: 'გაურკვეველი', taken: 'მივიღე', skipped: 'გამოვტოვე',
  suspected: 'სავარაუდო', veterinarian_confirmed: 'ვეტერინარის მიერ დადასტურებული', owner_reported: 'ჩემი დაკვირვება', active: 'აქტიური', resolved: 'დასრულებული',
  kg: 'კგ', g: 'გრამი', medication: 'მედიკამენტი', food: 'საკვები', environmental: 'გარემო', other: 'სხვა',
};
// English copies of mobile/src/lib/assistant.ts assistantFieldLabelsEn / assistantValueLabelsEn.
const FIELD_LABELS_EN = {
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
  destination: 'Feature to open', mode: 'Consultation type', message: 'Message', values: 'Changes',
};
const VALUE_LABELS_EN = {
  'care/history': 'Care history', 'care/products': 'Care products', 'care/plan': 'Care planning', 'care/record': 'Care log', care: 'Care', edit: 'Edit profile', profile: 'Profile', weight: 'Weight', allergies: 'Allergies', conditions: 'Health records',
  GP: 'Family doctor', DENTIST: 'Dentist', CARDIO: 'Cardiologist', GYN: 'Gynecologist', NEURO: 'Neurologist', ORTHO: 'Orthopedist', THERAPIST: 'Internist', OPHTHALMO: 'Ophthalmologist', DERM: 'Dermatologist', PED: 'Pediatrician', OTHER: 'Other',
  TRACK_PERIOD: 'Cycle tracking', TRY_TO_CONCEIVE: 'Trying to conceive', PREGNANCY: 'Pregnancy', PERIMENOPAUSE: 'Perimenopause', POSTPARTUM: 'Postpartum', LMP: 'Last period start', USER_SELECTED: 'A date I chose',
  VACCINATION: 'Vaccination', FLEA_TICK: 'Fleas and ticks', DEWORMING: 'Deworming', MEDICATION: 'Medication', ONCE: 'Once', EVERY_N_DAYS: 'Every few days', EVERY_N_WEEKS: 'Every few weeks', EVERY_N_MONTHS: 'Every few months', DAILY_COURSE: 'Daily course', NONE: "Doesn't repeat", FIXED_CALENDAR: 'On a fixed calendar', FROM_ADMINISTRATION: 'From the last dose', VETERINARIAN: 'Veterinarian', PRODUCT_INSTRUCTIONS: 'Product instructions', USER_ENTERED: 'My own entry', DATE_BASED: 'By day', EXACT_TIME: 'At an exact time', oral: 'By mouth', topical: 'On the skin', injection: 'By injection',
  SEDENTARY: 'Sedentary', LIGHT: 'Light', MODERATE: 'Moderate', ACTIVE: 'Active', VERY_ACTIVE: 'Very active', OMNIVORE: 'Mixed diet', VEGETARIAN: 'Vegetarian', VEGAN: 'Vegan', KETO: 'Keto', NEVER: 'Never', FORMER: 'In the past', CURRENT: 'Currently', OCCASIONAL: 'Sometimes', REGULAR: 'Regularly', poor: 'Poor', okay: 'Okay', good: 'Good', low: 'Low', high: 'High', very_low: 'Very low', very_high: 'Very high', normal: 'Normal', lb: 'Pound', mixed: 'Mixed breed',
  true: 'Yes', false: 'No', MALE: 'Male', FEMALE: 'Female', UNKNOWN: 'Unknown', EXACT: 'Exact date', APPROXIMATE: 'Approximate age',
  DOCTOR: 'Medi doctor', CONSILIUM: 'Consilium', dog: 'Dog', cat: 'Cat', unknown: 'Unknown', custom: 'Other breed',
  start: 'Start', end: 'End', none: 'None', spotting: 'Spotting', light: 'Light', medium: 'Medium', heavy: 'Heavy',
  positive: 'Positive', negative: 'Negative', unclear: 'Unclear', taken: 'Taken', skipped: 'Skipped',
  suspected: 'Suspected', veterinarian_confirmed: 'Confirmed by a vet', owner_reported: 'My observation', active: 'Active', resolved: 'Resolved',
  kg: 'kg', g: 'Grams', medication: 'Medication', food: 'Food', environmental: 'Environmental', other: 'Other',
};
const FIELD_LABELS = t(FIELD_LABELS_KA, FIELD_LABELS_EN);
const VALUE_LABELS = t(VALUE_LABELS_KA, VALUE_LABELS_EN);
const HIDDEN_ROWS = new Set(['recurrenceBasis', 'source', 'timeMode', 'timezone']);
const HANDOFF_TOOLS = ['open', 'consult', 'pet_consult', 'pet_open', 'record_open', 'visit_open', 'medication_open', 'nutrition_goal', 'weight_goal'];

function display(value) {
  if (Array.isArray(value)) return value.map(display).join(', ');
  if (value && typeof value === 'object') return Object.entries(value).map(([k, v]) => `${FIELD_LABELS[k] || k}: ${display(v)}`).join('\n');
  return VALUE_LABELS[String(value)] || String(value ?? '');
}

/* ── Native app route → web route (null = only in the app) ─────────── */
function webRouteFor(route) {
  const r = String(route || '').split('?')[0];
  const seg = r.split('/').filter(Boolean);
  if (r === '/(tabs)/home' || r === '/') return '/';
  if (r === '/(tabs)/records') return '/records';
  if (seg[0] === 'record' && UUID.test(seg[1] || '')) return `/records/${seg[1]}`;
  if (r === '/(tabs)/profile' || seg[0] === 'profile') return '/profile';
  if (seg[0] === 'health-metrics' || seg[0] === 'week') return '/health';
  if (seg[0] === 'nutrition') return '/nutrition';
  if (seg[0] === 'medications') return UUID.test(seg[1] || '') ? `/medications/${seg[1]}` : '/medications';
  if (seg[0] === 'visits') return '/visits';
  if (seg[0] === 'cycle') return '/cycle';
  if (seg[0] === 'lab') return '/lab';
  if (seg[0] === 'medi-quest') return '/quest';
  if (seg[0] === 'pets') return UUID.test(seg[1] || '') ? `/pets/${seg[1]}` : '/pets';
  return null; // symptoms, imaging/skin modules, pharmacy, MEDIRUN, weather, permissions …
}

/* In-memory, account-bound, one-shot consult handoff (never from a URL) — like stageAssistantLaunch. */
let staged = null;
const consumedOps = new Set();

/* ══════════════════════════════════════════════════════════════════ */
export default async function mediPage(root, ctx) {
  ensureCss();
  ctx.setTitle('Medi');
  const owner = session.user?.id;
  let alive = true;
  let generation = 0;
  const same = () => alive && session.user?.id === owner;
  const legacyMode = String(ctx.query.mode || '').trim().toLowerCase();

  const st = {
    consilium: (legacyMode === 'deep' || legacyMode === 'consilium') && deepOn(),
    conv: { sessionId: ctx.query.session || ctx.query.sessionId || null, key: 0 },
    /** Clinical sessions this thread continues (DOCTOR / CONSILIUM → session id). */
    clinical: {},
    /** An old consultation reopened here: its last turns are copied into the new thread on the first save. */
    copyOnFirstSave: null,
    /** The next question goes straight to the doctor (a drafted question from another page, ?mode=doctor). */
    directNext: legacyMode === 'doctor' ? 'DOCTOR' : null,
    /** Cycle context from the cycle page — a removable chip; sent once with the first clinical question. */
    context: null,
    messages: [],
    loadState: 'ready', // loading | ready | error
    busy: false,
    controller: null,
    stopRequested: false,
    error: null,
    failed: null,
    note: null,
    // planner
    review: null,
    draft: null,
    suggestions: [],
    persistChain: Promise.resolve(),
    catalog: null,
    // history
    sessions: null,
    sessionsError: null,
    filter: '',
  };
  if (!UUID.test(String(st.conv.sessionId || ''))) st.conv.sessionId = null;

  /* ── Layout ──────────────────────────────────────────── */
  const side = h('aside', { class: 'medi-side', 'aria-label': t('საუბრები', 'Conversations') });
  const head = h('div', { class: 'medi-head' });
  const thread = h('div', { class: 'medi-thread' });
  const log = h('div', { class: 'medi-log', role: 'log', 'aria-live': 'polite' }, thread);
  const jump = h('button', { class: 'medi-jump', type: 'button', hidden: true, onClick: () => scrollToEnd(true, true) }, icon('arrowDown', { size: 16 }), t('ბოლო შეტყობინება', 'Latest message'));
  const status = h('div', { class: 'medi-status' });
  const chipSlot = h('div', { class: 'medi-ctx-slot' });
  const ta = h('textarea', {
    rows: 1, maxlength: LIMIT, 'aria-label': t('შეტყობინება Medi-სთვის', 'Message to Medi'),
    onInput: () => { autoGrow(); updateSend(); },
    onKeydown: (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); submit(); }
      else if (e.key === 'Escape' && st.busy) { e.preventDefault(); stop(); }
    },
  });
  const sendBtn = h('button', { class: 'medi-send', type: 'button', 'aria-label': t('გაგზავნა', 'Send'), title: t('გაგზავნა', 'Send'), onClick: () => (st.busy ? stop() : submit()) });
  const counter = h('span', { class: 'medi-count', hidden: true });
  const deepBtn = h('button', { type: 'button', class: 'medi-deep', 'aria-pressed': 'false', onClick: () => toggleConsilium() });
  const composer = h('div', { class: 'medi-composer' }, ta, counter, deepBtn, sendBtn);
  const foot = h('div', { class: 'medi-foot' },
    h('span', { class: 'medi-disc' }, icon('info', { size: 14 }), DISCLAIMER),
    h('span', { class: 'medi-keys' }, h('span', { class: 'kbd' }, 'Enter'), t(' გაგზავნა · ', ' to send · '), h('span', { class: 'kbd' }, 'Shift+Enter'), t(' ახალი ხაზი', ' for a new line')));
  const dock = h('div', { class: 'medi-dock' }, status, chipSlot, composer, foot);
  const main = h('section', { class: 'medi-main' }, head, h('div', { class: 'medi-body' }, log, jump), dock);
  const shell = h('div', { class: 'medi' }, side, main);
  mount(root, shell);

  log.addEventListener('scroll', () => { jump.hidden = nearBottom() || !st.messages.length; }, { passive: true });

  /* ── Small utilities ─────────────────────────────────── */
  function nearBottom() { return log.scrollHeight - log.scrollTop - log.clientHeight < 120; }
  function scrollToEnd(force = false, smooth = false) {
    if (!force && !nearBottom()) { jump.hidden = !st.messages.length; return; }
    requestAnimationFrame(() => {
      log.scrollTo({ top: log.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
      jump.hidden = true;
    });
  }
  function autoGrow() {
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 220)}px`;
  }
  function setComposer(text, focus = true) {
    ta.value = text || '';
    autoGrow();
    updateSend();
    if (focus) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
  }
  function updateSend() {
    const len = ta.value.length;
    counter.hidden = len < LIMIT - 400;
    counter.textContent = `${len}/${LIMIT}`;
    const stoppable = st.busy && Boolean(st.controller);
    mount(sendBtn, icon(stoppable ? 'stopSquare' : 'arrowUp', { size: stoppable ? 16 : 20, stroke: 2.4 }));
    sendBtn.classList.toggle('is-stop', stoppable);
    sendBtn.setAttribute('aria-label', stoppable ? t('შეჩერება', 'Stop') : t('გაგზავნა', 'Send'));
    sendBtn.title = stoppable ? t('შეჩერება (Esc)', 'Stop (Esc)') : t('გაგზავნა', 'Send');
    sendBtn.disabled = st.busy ? !stoppable : (!ta.value.trim() || st.loadState !== 'ready');
  }
  const consiliumOn = () => st.consilium && deepOn();
  /** „კონსილიუმი“ on the composer: the composer, orb and answers turn indigo while it is on. */
  function paintDeep() {
    const on = consiliumOn();
    deepBtn.hidden = !deepOn();
    deepBtn.classList.toggle('on', on);
    deepBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    deepBtn.title = on ? t('კონსილიუმი ჩართულია — რამდენიმე სპეციალისტის ხედვა', 'Consilium is on — several specialists’ views') : t('კონსილიუმი: რამდენიმე სპეციალისტის ხედვა', 'Consilium: several specialists’ views');
    mount(deepBtn, icon('users', { size: 15 }), h('span', null, t('კონსილიუმი', 'Consilium')));
    shell.classList.toggle('is-deep', on);
    ta.placeholder = on ? t('აღწერე შემთხვევა დეტალურად…', 'Describe the case in detail…') : t('ჰკითხე ან დაწერე, რით დაგეხმარო…', 'Ask, or tell me how I can help…');
  }
  function toggleConsilium(force) {
    if (st.busy) return;
    st.consilium = typeof force === 'boolean' ? force : !st.consilium;
    paintDeep();
    renderHead();
    if (!st.messages.length) renderThread();
    ta.focus({ preventScroll: true });
  }
  function errorText(e, fallback) {
    const fields = e?.body?.fields;
    if (Array.isArray(fields) && fields.length) {
      return fields.map((f) => { const key = String(f.field || '').split('.').pop(); return `${FIELD_LABELS[key] || t('ველი', 'Field')}: ${f.message}`; }).join('\n');
    }
    return e?.message || fallback;
  }
  function syncUrl(push = false) {
    const q = new URLSearchParams();
    if (st.conv.sessionId) q.set('session', st.conv.sessionId);
    const url = `/app/medi${q.toString() ? `?${q}` : ''}`;
    if (url === location.pathname + location.search) return;
    history[push ? 'pushState' : 'replaceState']({}, '', url);
  }

  /* ── Header ──────────────────────────────────────────── */
  function renderHead() {
    const deep = consiliumOn();
    mount(head,
      h('div', { class: 'medi-id' },
        h('span', { class: `medi-orb sm ink-${deep ? 'violet' : 'teal'}` }, icon(deep ? 'users' : 'sparkles', { size: 18 })),
        h('div', { class: 'medi-id-text' }, h('b', null, 'Medi'), h('span', null, deep ? t('კონსილიუმი ჩართულია', 'Consilium is on') : t('შენი ჯანმრთელობის ასისტენტი', 'Your health assistant')))),
      h('div', { class: 'medi-actions' },
        iconButton('history', { title: t('საუბრები', 'Conversations'), class: 'medi-only-narrow', onClick: openHistoryModal }),
        iconButton('compass', { title: t('რას აკეთებს Medi', 'What Medi can do'), onClick: openDirectory }),
        iconButton('squarePen', { title: t('ახალი საუბარი', 'New conversation'), onClick: () => openConversation(null, { push: true }) }),
        iconButton('shield', { title: t('AI და კონფიდენციალურობა', 'AI and privacy'), onClick: () => ctx.navigate('/profile') })));
  }

  /* ── Cycle context chip (mobile MediContextChip) ─────── */
  function renderChip() {
    const c = st.context;
    if (!c) { clear(chipSlot); return; }
    const details = h('ul', { class: 'medi-ctx-lines', hidden: true }, c.lines.map((l) => h('li', null, l)));
    const toggle = h('button', { type: 'button', class: 'medi-ctx-main', 'aria-expanded': 'false', title: t('რა გაიგზავნება', 'What will be sent') },
      icon('flower', { size: 14 }), h('span', null, c.chipLabel), icon('chevronDown', { size: 14 }));
    toggle.addEventListener('click', () => {
      details.hidden = !details.hidden;
      toggle.setAttribute('aria-expanded', details.hidden ? 'false' : 'true');
    });
    mount(chipSlot, h('div', { class: 'medi-ctx' },
      h('div', { class: 'medi-ctx-row' }, toggle,
        h('button', { type: 'button', class: 'medi-ctx-x', 'aria-label': t('კონტექსტის მოხსნა', 'Remove the context'), title: t('მოხსნა — მხოლოდ კითხვა გაიგზავნება', 'Remove — only the question is sent'), onClick: () => { st.context = null; renderChip(); } }, icon('x', { size: 14 }))),
      details,
      h('div', { class: 'medi-ctx-note' }, t('გაიგზავნება მხოლოდ პირველ კითხვასთან ერთად, AI-ზე თანხმობის შემდეგ.', 'Sent only with your first question, after the AI consent.'))));
  }

  /* ── Thread ──────────────────────────────────────────── */
  function renderThread() {
    clear(thread);
    if (st.loadState === 'loading') {
      thread.append(h('div', { class: 'medi-loading' }, h('span', { class: 'typing' }, h('i'), h('i'), h('i')), t('საუბარი იტვირთება…', 'Loading conversation…')));
      updateSend();
      return;
    }
    if (st.loadState === 'error') {
      thread.append(h('div', { class: 'error-box medi-inline-error' }, icon('alert', { size: 20 }),
        h('div', null, h('strong', null, t('საუბარი ვერ ჩაიტვირთა', 'Couldn’t load the conversation')), h('p', null, t('შეამოწმე კავშირი და სცადე ხელახლა.', 'Check your connection and try again.'))),
        button(t('ხელახლა', 'Retry'), { variant: 'ghost', size: 'sm', onClick: () => loadConversation() })));
      updateSend();
      return;
    }
    if (!st.messages.length) thread.append(emptyHero());
    else st.messages.forEach((msg, i) => thread.append(messageEl(msg, i)));
    const task = taskEl();
    if (task) thread.append(task);
    updateSend();
  }

  function emptyHero() {
    const deep = consiliumOn();
    return h('div', { class: 'medi-hero' },
      h('div', { class: `medi-orb lg ink-${deep ? 'violet' : 'teal'}` }, icon(deep ? 'users' : 'sparkles', { size: 30 })),
      h('h2', null, deep ? t('კონსილიუმი', 'Consilium') : firstName() ? t(`გამარჯობა, ${firstName()}`, `Hello, ${firstName()}`) : t('გამარჯობა', 'Hello')),
      h('p', null, deep
        ? t('აღწერე სრული სურათი: ჩივილები, ანამნეზი, ჩატარებული კვლევები და მიმდინარე მკურნალობა. სისტემა შეარჩევს რელევანტურ სპეციალისტებს.', 'Describe the full picture: complaints, medical history, tests done and current treatment. The system will pick the relevant specialists.')
        : t('ჰკითხე ჯანმრთელობაზე ან მითხარი, რა გინდა — წამლის დამატება, წყლის ჩაწერა, ვიზიტის დაგეგმვა. ჩანაწერს შენახვამდე ყოველთვის გადაგამოწმებინებ.', 'Ask about your health or tell me what you need — add a medication, log water, plan a visit. I’ll always ask you to check an entry before saving it.')),
      deep ? h('ul', { class: 'medi-checklist' }, CONSILIUM_CHECKLIST.map((c) => h('li', null, icon('check', { size: 15 }), c))) : null,
      deep ? null : h('div', { class: 'medi-starters' }, STARTERS.map((s) => h('button', {
        type: 'button', class: 'medi-starter', onClick: () => { if (!st.busy) send(s.text); },
      }, h('span', { class: `tile ink-${s.ink}`, style: { width: '34px', height: '34px' } }, icon(s.icon, { size: 17 })), h('span', null, s.text), icon('arrowRight', { size: 16, className: 'medi-starter-go' })))),
      deep ? null : h('button', { type: 'button', class: 'medi-link', onClick: openDirectory }, icon('compass', { size: 16 }), t('ნახე, რას აკეთებს Medi', 'See what Medi can do')));
  }

  function aiAvatar(msg) {
    const deep = msg.kind === 'answer' && msg.deep;
    return h('span', { class: `medi-orb xs ink-${deep ? 'violet' : 'teal'}`, 'aria-hidden': 'true' }, icon(deep ? 'users' : 'sparkles', { size: 14 }));
  }

  function messageEl(msg, index) {
    if (msg.role === 'user') {
      return h('div', { class: 'medi-msg me' },
        h('div', { class: 'medi-bubble me' }, msg.content),
        msg.timestamp ? h('div', { class: 'medi-meta' }, fmtTime(msg.timestamp)) : null);
    }
    const body = h('div', { class: 'medi-answer' });
    msg.bodyEl = body;
    paintBody(msg);
    const tools = [];
    if (!msg.streaming && !msg.pending && msg.content && !msg.local) {
      tools.push(iconButton('copy', { title: t('კოპირება', 'Copy'), size: 16, class: 'medi-tool', onClick: () => copyText(msg.content) }));
      if (msg.interactionId) {
        tools.push(h('span', { class: 'medi-tools-sep' }));
        for (const [rating, name, label] of [[1, 'thumbsUp', t('კარგი პასუხია', 'Good answer')], [-1, 'thumbsDown', t('პასუხი არ მომეწონა', 'I didn’t like this answer')]]) {
          const b = iconButton(name, { title: label, size: 16, class: `medi-tool ${msg.feedbackRating === rating ? 'on' : ''}`, onClick: () => rate(index, rating) });
          if (msg.feedbackRating) b.disabled = true;
          tools.push(b);
        }
      }
    }
    return h('div', { class: `medi-msg ai ${msg.local ? 'local' : ''} ${msg.kind === 'answer' ? `answer${msg.deep ? ' deep' : ''}` : ''}` },
      aiAvatar(msg),
      h('div', { class: 'medi-msg-col' },
        msg.kind === 'answer' && msg.deep ? h('div', { class: 'medi-kicker' }, icon('users', { size: 13 }), t('კონსილიუმი', 'Consilium')) : null,
        body,
        msg.stopped ? h('div', { class: 'medi-stopped' }, icon('info', { size: 14 }), t('შეჩერდა · ეს პასუხი არ შეინახა', 'Stopped · this answer wasn’t saved')) : null,
        msg.appOnly ? h('a', { class: 'btn btn-secondary btn-sm medi-app-link', href: APP_STORE, target: '_blank', rel: 'noopener' }, icon('smartphone', { size: 16 }), h('span', null, t('MEDICARD აპის გადმოწერა', 'Get the MEDICARD app'))) : null,
        tools.length || msg.timestamp ? h('div', { class: 'medi-tools' }, tools, msg.timestamp && !msg.streaming && !msg.pending ? h('span', { class: 'medi-meta' }, fmtTime(msg.timestamp)) : null) : null));
  }

  function paintBody(msg) {
    const el = msg.bodyEl;
    if (!el) return;
    if (msg.pending || (msg.streaming && !msg.content)) {
      const label = msg.label || (msg.kind === 'answer' ? (msg.deep ? t('სპეციალისტები განიხილავენ…', 'The specialists are reviewing…') : t('Medi ფიქრობს…', 'Medi is thinking…')) : t('ვფიქრობ…', 'Thinking…'));
      mount(el, h('div', { class: 'medi-thinking' }, h('span', { class: 'typing' }, h('i'), h('i'), h('i')), h('span', null, label)));
      return;
    }
    const md = markdown(msg.content);
    if (msg.streaming) {
      let target = md.lastElementChild || md;
      if (target.tagName === 'UL' || target.tagName === 'OL') target = target.lastElementChild || target;
      target.append(h('span', { class: 'medi-caret', 'aria-hidden': 'true' }));
    }
    mount(el, md);
  }

  let paintQueued = false;
  let lastPaint = 0;
  function schedulePaint(msg) {
    if (paintQueued) return;
    paintQueued = true;
    const wait = Math.max(0, 60 - (performance.now() - lastPaint));
    setTimeout(() => requestAnimationFrame(() => {
      paintQueued = false;
      lastPaint = performance.now();
      if (!alive) return;
      const stick = nearBottom();
      paintBody(msg);
      if (stick) scrollToEnd(true);
    }), wait);
  }

  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); toast(t('დაკოპირდა', 'Copied')); }
    catch { toast(t('კოპირება ვერ მოხერხდა', 'Couldn’t copy'), 'error'); }
  }

  async function rate(index, rating) {
    const msg = st.messages[index];
    if (!msg?.interactionId || msg.feedbackRating) return;
    msg.feedbackRating = rating;
    renderThread();
    try {
      await post('/api/ai/feedback', { interactionId: msg.interactionId, rating });
      if (same()) toast(t('მადლობა შეფასებისთვის', 'Thanks for your feedback'));
    } catch {
      if (!same()) return;
      msg.feedbackRating = undefined;
      renderThread();
      toast(t('შეფასება ვერ შეინახა', 'Couldn’t save your rating'), 'error');
    }
  }

  /* ── Status line (error / consent note / draft) ──────── */
  function renderStatus() {
    clear(status);
    if (st.note) {
      const again = st.declined;
      status.append(h('div', { class: 'medi-note' }, icon('shield', { size: 16 }),
        h('span', null, st.note),
        again ? h('button', { type: 'button', class: 'medi-retry', onClick: () => {
          // The question in the composer wins (she may have edited it); else the one she tried to send.
          const text = ta.value.trim() || again.text;
          st.note = null; st.declined = null; renderStatus(); send(text, again.petId, again.route);
        } }, t('ხელახლა ცდა', 'Try again')) : null,
        iconButton('x', { title: t('დახურვა', 'Close'), size: 16, onClick: () => { st.note = null; st.declined = null; renderStatus(); } })));
    }
    if (st.error) {
      status.append(h('div', { class: 'medi-error', role: 'alert' }, icon('alert', { size: 16 }),
        h('span', null, st.error),
        st.failed ? h('button', { type: 'button', class: 'medi-retry', onClick: () => { const f = st.failed; st.failed = null; st.error = null; renderStatus(); send(f.text, f.petId, f.route); } }, icon('refresh', { size: 14 }), t('ხელახლა', 'Retry')) : null,
        iconButton('x', { title: t('დახურვა', 'Close'), size: 16, onClick: () => { st.error = null; st.failed = null; renderStatus(); } })));
    }
    if (st.draft && !st.review) {
      const label = toolLabel(st.draft.tool);
      status.append(h('div', { class: 'medi-draft' }, icon('edit', { size: 15 }),
        h('span', null, t('მიმდინარე: ', 'In progress: '), h('b', null, label), t(' — უპასუხე Medi-ს კითხვას', ' — answer Medi’s question')),
        h('button', { type: 'button', class: 'medi-retry', onClick: cancelReview }, t('გაუქმება', 'Cancel'))));
    }
  }

  /* ── Conversation lifecycle ─────────────────────────── */
  function abortCurrent() {
    generation++;
    if (st.controller) { st.stopRequested = false; try { st.controller.abort(); } catch { /* ignore */ } }
    st.controller = null;
    st.busy = false;
  }

  function openConversation(sessionId, { push = false } = {}) {
    abortCurrent();
    st.conv = { sessionId: sessionId || null, key: (st.conv?.key || 0) + 1 };
    st.clinical = {};
    st.copyOnFirstSave = null;
    st.messages = [];
    st.review = null; st.draft = null; st.suggestions = [];
    st.error = null; st.failed = null; st.note = null; st.declined = null;
    st.context = null; st.directNext = null;
    st.persistChain = Promise.resolve();
    st.loadState = sessionId ? 'loading' : 'ready';
    paintDeep();
    renderHead();
    renderStatus();
    renderChip();
    renderThread();
    renderSide();
    syncUrl(push);
    ctx.setTitle('Medi');
    if (sessionId) loadConversation();
    loadCatalog();
    if (matchMedia('(pointer: fine)').matches) ta.focus({ preventScroll: true });
  }

  /** A saved session back into turns (mobile turnsFromSession): threads keep their kinds; old consultations become answers. */
  function turnsFromSession(s) {
    const deepSession = s.mode === 'CONSILIUM';
    return (Array.isArray(s.messages) ? s.messages : []).filter((m) => typeof m?.content === 'string' && m.content.trim()).map((m) => {
      if (m.role === 'user') return { role: 'user', content: m.content, timestamp: m.timestamp };
      if (s.mode === 'ASSISTANT' && !m.kind) return { role: 'assistant', kind: 'medi', content: m.content, timestamp: m.timestamp };
      return {
        role: 'assistant', kind: 'answer', deep: s.mode === 'ASSISTANT' ? m.kind === 'deep' : deepSession, content: m.content, timestamp: m.timestamp,
        interactionId: m.interactionId, feedbackRating: m.feedbackRating, sessionId: s.mode === 'ASSISTANT' ? m.linkedSessionId : s.id,
      };
    });
  }
  /** Turns as stored in the ASSISTANT thread (mobile storedTurns): unfinished answers, cards and local notes are not stored. */
  function storedTurns(list) {
    const out = [];
    for (const m of list) {
      if (m.local || m.pending || m.streaming || !String(m.content || '').trim()) continue;
      const content = String(m.content).slice(0, LIMIT);
      if (m.role === 'user') out.push({ role: 'user', content });
      else if (m.kind === 'answer') out.push({ role: 'assistant', content, kind: m.deep ? 'deep' : 'answer', ...(m.sessionId ? { linkedSessionId: m.sessionId } : {}) });
      else out.push({ role: 'assistant', content });
    }
    return out;
  }

  async function loadConversation() {
    const conv = st.conv;
    st.loadState = 'loading';
    renderThread();
    try {
      const r = await get(`/api/chats/${encodeURIComponent(conv.sessionId)}`);
      if (!same() || conv !== st.conv) return;
      const s = r.session || {};
      st.messages = turnsFromSession(s);
      for (const m of st.messages) if (m.kind === 'answer' && m.sessionId) st.clinical[m.deep ? 'CONSILIUM' : 'DOCTOR'] = m.sessionId;
      if (s.mode !== 'ASSISTANT') {
        // An old consultation continues in a new Medi thread that carries its last 30 turns.
        st.copyOnFirstSave = storedTurns(st.messages).slice(-30);
        conv.sessionId = null;
        syncUrl(false);
        if (s.mode === 'CONSILIUM' && deepOn()) { st.consilium = true; paintDeep(); renderHead(); }
      }
      st.loadState = 'ready';
      ctx.setTitle(s.title ? `Medi · ${s.title}` : 'Medi');
      renderThread();
      renderSide();
      scrollToEnd(true);
    } catch (e) {
      if (!same() || conv !== st.conv) return;
      if (e instanceof ApiError && e.status === 404) {
        toast(t('საუბარი ვერ მოიძებნა', 'Conversation not found'), 'info');
        openConversation(null);
        return;
      }
      st.loadState = 'error';
      renderThread();
    }
  }

  /* ── Sending ─────────────────────────────────────────── */
  function submit() {
    const text = ta.value;
    if (!text.trim() || st.busy || st.loadState !== 'ready') return;
    send(text);
  }

  function stop() {
    if (!st.busy || !st.controller) return;
    st.stopRequested = true;
    st.controller.abort();
  }

  /** route: 'plan' | 'DOCTOR' | 'CONSILIUM' (a retry keeps the route it failed on). */
  async function send(text, petId, route) {
    if (st.busy || st.loadState !== 'ready') return;
    const value = String(text || '').trim();
    if (!value) return;
    if (value.length > LIMIT) { st.error = t(`შეტყობინება ძალიან გრძელია (მაქს. ${LIMIT} სიმბოლო).`, `Your message is too long (max ${LIMIT} characters).`); renderStatus(); return; }
    if (value.length < 2) { st.error = t('შეკითხვა ძალიან მოკლეა.', 'Your question is too short.'); renderStatus(); return; }
    st.note = null; st.declined = null; st.error = null; st.failed = null;
    const intent = dialogIntent(value);
    if (st.review && intent === 'confirm') { setComposer('', false); await confirmReview(); return; }
    if ((st.review || st.draft) && intent === 'cancel') { setComposer('', false); cancelReview(); return; }
    const target = route || (consiliumOn() ? 'CONSILIUM' : st.directNext && doctorOn() ? st.directNext : 'plan');
    st.directNext = null;
    // A new message replaces a card that was never answered (mobile: the card turns „cancelled“).
    if (target !== 'plan') { st.review = null; st.suggestions = []; }
    renderStatus();
    st.busy = true;
    updateSend();
    const gen = ++generation;
    let result;
    try {
      result = await withAiConsent(() => (target === 'plan' ? runPlan(value, gen, petId) : runAnswer(value, target, gen, null)));
    } catch (e) {
      if (gen === generation && same()) {
        st.error = errorText(e, t('კავშირი შეფერხდა. სცადე ხელახლა.', 'Connection problem. Please try again.'));
        st.failed = { text: value, petId, route: e?.route || target };
        if (!ta.value.trim()) setComposer(value, false);
      }
    } finally {
      if (gen === generation && same()) {
        st.busy = false;
        st.controller = null;
        st.stopRequested = false;
        if (result?.declined) {
          // Declining / closing is a valid choice: nothing was sent. A calm note with „ხელახლა ცდა“
          // (opens the disclosure again), never an error (App Review 2026-09-22).
          st.note = t('AI-ს არაფერი გაეგზავნა. როცა გინდა, შეგიძლია ხელახლა სცადო.', 'Nothing was sent to the AI. You can try again whenever you like.');
          st.declined = { text: value, petId, route: target };
          if (!ta.value.trim()) setComposer(value, false);
        }
        renderStatus();
        renderThread();
        if (matchMedia('(pointer: fine)').matches) ta.focus({ preventScroll: true });
      }
    }
  }

  /** What the planner sees (mobile plannerHistory): words only, clinical answers shortened, cards left out. */
  function historyTurns(exclude) {
    return st.messages.filter((m) => m !== exclude && !m.local && !m.pending && !m.streaming && m.content.trim())
      .map((m) => ({ role: m.role, content: m.kind === 'answer' && m.content.length > ANSWER_IN_HISTORY ? `${m.content.slice(0, ANSWER_IN_HISTORY)}…` : m.content.slice(0, LIMIT) }))
      .slice(-10);
  }

  /**
   * The clinical answer streams into the thread: SSE `data: {type:'delta'|'done'|'error'}` from /api/ai/query.
   * `userMsg` = the turn already shown (planner path); null = add it here (consilium / direct doctor).
   */
  async function runAnswer(message, mode, gen, userMsg) {
    const conv = st.conv;
    const ctrl = new AbortController();
    st.controller = ctrl;
    st.stopRequested = false;
    updateSend();
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; ctrl.abort(); }, 180_000);
    const now = new Date().toISOString();
    const deep = mode === 'CONSILIUM';
    const user = userMsg || { role: 'user', content: message, timestamp: now };
    const aiMsg = { role: 'assistant', kind: 'answer', deep, content: '', timestamp: now, streaming: true };
    if (!userMsg) st.messages.push(user);
    st.messages.push(aiMsg);
    setComposer('', false);
    renderThread();
    scrollToEnd(true);
    const live = () => gen === generation && same() && conv === st.conv;
    // The cycle context rides only with the first question that goes through (consent runs first).
    const context = st.clinical[mode] ? undefined : st.context?.text;
    let done = null;
    try {
      await stream('/api/ai/query', {
        message, mode, ...(st.clinical[mode] ? { sessionId: st.clinical[mode] } : {}), ...(context ? { context } : {}), stream: true,
      }, (event, data) => {
        if (!live()) return;
        const type = (data && typeof data === 'object' && data.type) || event;
        if (type === 'delta' && data.text) { aiMsg.content += data.text; schedulePaint(aiMsg); }
        else if (type === 'done') done = data;
        else if (type === 'error') throw new ApiError(data?.error || t('პასუხი ვერ მივიღე. სცადე ხელახლა.', 'I couldn’t get an answer. Please try again.'), Number(data?.status) || 502, { code: 'AI_ENGINE_ERROR' });
      }, { signal: ctrl.signal });
      if (!live()) return {};
      if (!done || typeof done.answer !== 'string' || !done.answer.trim()) throw new ApiError(t('პასუხი სრულად ვერ მივიღეთ. გთხოვ, სცადე ხელახლა.', 'The answer didn’t arrive in full. Please try again.'), 502);
      Object.assign(aiMsg, { content: done.answer, streaming: false, interactionId: done.interactionId, timestamp: new Date().toISOString(), sessionId: done.sessionId });
      if (done.sessionId) st.clinical[mode] = done.sessionId;
      if (context) { st.context = null; renderChip(); }
      persist(conv, storedTurns([user, aiMsg]));
      invalidate('/api/quests');
      return done;
    } catch (e) {
      if (!live()) return {};
      const drop = () => { st.messages = st.messages.filter((m) => m !== aiMsg && m !== user); };
      if (ctrl.signal.aborted && st.stopRequested) {
        // Stopped by the person: keep what arrived, clearly marked as not saved (the server discards it).
        aiMsg.streaming = false;
        if (aiMsg.content.trim()) aiMsg.stopped = true;
        else { drop(); setComposer(message, false); }
        return {};
      }
      drop();
      const err = timedOut ? new ApiError(t('პასუხის მოლოდინის დრო ამოიწურა. გთხოვ, სცადე ხელახლა.', 'The answer took too long. Please try again.'), 408)
        : e instanceof ApiError ? e : new ApiError(t('ინტერნეტთან კავშირი ვერ დამყარდა.', 'Couldn’t connect to the internet.'), 0);
      err.route = mode;
      throw err;
    } finally {
      clearTimeout(timer);
      if (!ctrl.signal.aborted) ctrl.abort(); // release the stream if an error event ended it early
    }
  }

  /** Medi planner: reply + optional signed review / partial draft. A `consult` review = answer here, no tap. */
  async function runPlan(value, gen, petId) {
    const conv = st.conv;
    const ctrl = new AbortController();
    st.controller = ctrl;
    st.stopRequested = false;
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; ctrl.abort(); }, 120_000);
    const currentDraft = st.review ? { tool: st.review.tool, args: st.review.args } : st.draft;
    const history = historyTurns();
    const now = new Date().toISOString();
    const userMsg = { role: 'user', content: value, timestamp: now };
    const pending = { role: 'assistant', kind: 'medi', content: '', pending: true, timestamp: now };
    st.messages.push(userMsg, pending);
    st.review = null; st.suggestions = [];
    setComposer('', false);
    renderStatus();
    renderThread();
    scrollToEnd(true);
    const live = () => gen === generation && same() && conv === st.conv;
    let result;
    try {
      result = await post('/api/assistant/plan', {
        text: value, scope: 'auto', history, draft: currentDraft || null, ...(petId ? { subjectId: petId } : {}),
      }, { signal: ctrl.signal });
    } catch (e) {
      clearTimeout(timer);
      if (!live()) return {};
      st.messages = st.messages.filter((m) => m !== pending && m !== userMsg);
      st.draft = currentDraft || null;
      if (ctrl.signal.aborted && st.stopRequested) { setComposer(value, false); return {}; }
      if (timedOut) throw new ApiError(t('პასუხის მოლოდინის დრო ამოიწურა. გთხოვ, სცადე ხელახლა.', 'The answer took too long. Please try again.'), 408);
      throw e;
    }
    clearTimeout(timer);
    if (!live()) return {};
    // A health question: the clinical model answers right here.
    const consult = consultFromReview(result.review, value);
    if (consult) {
      st.messages = st.messages.filter((m) => m !== pending);
      st.draft = null;
      return runAnswer(consult.message, consult.mode === 'CONSILIUM' && deepOn() ? 'CONSILIUM' : 'DOCTOR', gen, userMsg);
    }
    Object.assign(pending, { content: String(result.reply || ''), pending: false, timestamp: new Date().toISOString() });
    st.review = result.review || null;
    st.draft = result.review ? null : result.draft || null;
    st.suggestions = Array.isArray(result.suggestions) ? result.suggestions : [];
    persist(conv, storedTurns([userMsg, pending]));
    scrollToEnd(true);
    return result;
  }

  /** The thread is a ChatSession mode ASSISTANT (same as the app); a reopened consultation's turns go first. */
  function persist(conv, turns) {
    const copy = conv === st.conv ? st.copyOnFirstSave : null;
    const batch = copy ? [...copy, ...turns] : turns;
    if (!batch.length) return;
    st.persistChain = st.persistChain
      .then(() => post('/api/chats/assistant', { ...(conv.sessionId ? { sessionId: conv.sessionId } : {}), turns: batch }))
      .then((r) => {
        if (!same() || !r?.sessionId) return;
        const first = !conv.sessionId;
        conv.sessionId = r.sessionId;
        if (conv === st.conv) st.copyOnFirstSave = null;
        if (conv === st.conv && first) syncUrl(false);
        refreshSessions();
      })
      .catch(() => undefined);
  }

  /* ── Planner review / task card ─────────────────────── */
  async function loadCatalog() {
    if (st.catalog) return;
    try {
      const c = await get('/api/assistant/catalog', { scope: 'auto' });
      if (!same()) return;
      st.catalog = c;
      renderStatus();
      renderThread();
    } catch { /* the conversation works without it; labels fall back */ }
  }
  const tools = () => st.catalog?.tools || [];
  const choices = () => st.catalog?.choices || {};
  function toolLabel(name) { return tools().find((x) => x.name === name)?.label || t('ჩანაწერი', 'Entry'); }
  function isHandoff(name) { return tools().find((x) => x.name === name)?.kind === 'handoff' || HANDOFF_TOOLS.includes(name); }

  function reviewRows(action) {
    const ch = choices();
    return Object.entries(action.args || {}).filter(([k]) => !HIDDEN_ROWS.has(k)).map(([key, value]) => {
      const list = key === 'id' ? (action.tool.startsWith('visit_') ? ch.visitId : ch.medicationId)
        : key === 'breedId' ? ch[`breedId:${action.args.speciesId}`]
          : key === 'productId' ? ch[`productId:${action.args.petId}`] : ch[key];
      const named = Array.isArray(list) ? list.find((o) => o.value === value)?.label : null;
      const label = key === 'petId' ? t('ცხოველი', 'Pet') : key === 'medicationId' ? t('მედიკამენტი', 'Medication') : key === 'id' ? t('ჩანაწერი', 'Entry') : key === 'dueTime' ? t('დრო', 'Time') : key === 'destination' ? t('გვერდი', 'Page') : FIELD_LABELS[key] || key;
      return { key, label, value: named || humanDates(display(value)) };
    }).filter((r) => r.value !== '');
  }

  function taskEl() {
    if (st.busy && !st.review) return null;
    const wrap = h('div', { class: 'medi-task' });
    if (st.suggestions.length) {
      wrap.append(h('div', { class: 'medi-suggest' }, st.suggestions.map((s) => h('button', {
        type: 'button', class: 'chip', onClick: () => send(s.text, s.petId),
      }, s.label))));
    }
    if (st.review) {
      const r = st.review;
      const handoff = isHandoff(r.tool);
      const rows = reviewRows(r);
      const saveBtn = button(handoff ? t('გახსნა', 'Open') : t('შენახვა', 'Save'), { variant: 'primary', icon: handoff ? 'arrowRight' : 'check', onClick: () => confirmReview() });
      wrap.append(h('div', { class: 'medi-review' },
        h('div', { class: 'medi-review-head' },
          h('span', { class: `tile ink-${r.tool.startsWith('pet_') ? 'amber' : 'teal'}`, style: { width: '38px', height: '38px' } }, icon(r.tool.startsWith('pet_') ? 'paw' : handoff ? 'externalLink' : 'check', { size: 18 })),
          h('div', null,
            h('div', { class: 'medi-review-kicker' }, handoff ? t('მზადაა გასახსნელად', 'Ready to open') : t('გადაამოწმე შენახვამდე', 'Check before saving')),
            h('div', { class: 'medi-review-title' }, r.label || toolLabel(r.tool)))),
        rows.length ? h('dl', { class: 'medi-review-rows' }, rows.map((row) => h('div', null, h('dt', null, row.label), h('dd', null, row.value)))) : null,
        handoff ? null : h('p', { class: 'medi-review-hint' }, t('შესასწორებლად უბრალოდ დაწერე, რა შევცვალო — მაგ. „არა, 200 მლ“.', 'To correct it, just write what to change — e.g. “no, 200 ml”.')),
        h('div', { class: 'medi-review-actions' },
          button(t('გაუქმება', 'Cancel'), { variant: 'ghost', onClick: cancelReview }),
          saveBtn)));
    }
    return wrap.childNodes.length ? wrap : null;
  }

  function cancelReview() {
    if (st.busy) return;
    st.review = null; st.draft = null; st.suggestions = [];
    const reply = t('კარგი, გაუქმებულია.', 'Okay, cancelled.');
    st.messages.push({ role: 'assistant', kind: 'medi', content: reply, timestamp: new Date().toISOString() });
    persist(st.conv, [{ role: 'assistant', content: reply }]);
    renderStatus();
    renderThread();
    scrollToEnd(true);
  }

  async function confirmReview() {
    const current = st.review;
    if (!current || st.busy) return;
    const conv = st.conv;
    const gen = ++generation;
    st.busy = true;
    st.error = null;
    renderStatus();
    renderThread();
    const handoff = isHandoff(current.tool);
    const pending = { role: 'assistant', kind: 'medi', content: '', pending: true, label: handoff ? t('ვხსნი…', 'Opening…') : t('ვინახავ…', 'Saving…') };
    st.messages.push(pending);
    renderThread();
    scrollToEnd(true);
    const live = () => gen === generation && same() && conv === st.conv;
    let followUp = null;
    try {
      const result = await post('/api/assistant/execute', { token: current.token, confirmed: true }, { timeoutMs: 60_000 });
      if (!live()) return;
      st.messages = st.messages.filter((m) => m !== pending);
      st.review = null; st.draft = null; st.suggestions = [];
      if (result.native) {
        followUp = handleNative(result.native);
      } else {
        const petName = (choices().petId || []).find((p) => p.value === current.args.petId)?.label;
        const reply = current.tool === 'medication_add' ? t(`${String(current.args.medName)} დამატებულია.`, `${String(current.args.medName)} added.`)
          : current.tool === 'pet_care_plan' && petName ? t(`${petName}-ის გეგმა შენახულია.`, `${petName}’s plan is saved.`)
            : t('შენახულია.', 'Saved.');
        st.messages.push({ role: 'assistant', kind: 'medi', content: reply, timestamp: new Date().toISOString() });
        persist(conv, [{ role: 'assistant', content: reply }]);
        invalidate(''); // the write went through the server's own domain endpoint: re-read everything
        st.catalog = null;
        loadCatalog();
        toast(t('შენახულია', 'Saved'));
      }
    } catch (e) {
      if (!live()) return;
      st.messages = st.messages.filter((m) => m !== pending);
      st.error = errorText(e, t('მოქმედება ვერ შესრულდა.', 'The action couldn’t be completed.'));
    } finally {
      if (gen === generation && same()) {
        st.busy = false;
        renderStatus();
        renderThread();
        scrollToEnd(true);
      }
    }
    // An older planner reply (a /chat/… handoff with a message): answer here instead of opening another screen.
    if (followUp) send(followUp.message, undefined, followUp.mode);
  }

  /** A confirmed handoff: a consultation answers in this thread; pages open on the web when they exist. */
  function handleNative(native) {
    const route = String(native?.route || '');
    if (/^\/chat\//.test(route)) {
      const deep = /^\/chat\/(deep|consilium)/i.test(route) || native.mode === 'CONSILIUM';
      if (native.message) return { message: String(native.message).slice(0, LIMIT), mode: deep && deepOn() ? 'CONSILIUM' : 'DOCTOR' };
      if (deep && deepOn()) toggleConsilium(true);
      return null;
    }
    const web = webRouteFor(route);
    if (web) { ctx.navigate(web); return null; }
    const reply = t('ეს ფუნქცია MEDICARD აპშია — იქ გააგრძელე.', 'This feature is in the MEDICARD app — continue there.');
    st.messages.push({ role: 'assistant', kind: 'medi', content: reply, timestamp: new Date().toISOString(), local: true, appOnly: true });
    return null;
  }

  /* ── Capability directory ("რას აკეთებს Medi") ───────── */
  const FEATURE_WEB = {
    home: '/', metrics: '/health', hydration: '/health', hydration_history: '/health', hydration_calendar: '/health', hydration_log: '/health',
    weight: '/health', weight_history: '/health', weight_goal: '/health', weight_progress: '/health', steps: '/health', steps_history: '/health',
    steps_goal: '/health', steps_progress: '/health', week: '/health',
    nutrition: '/nutrition', nutrition_diary: '/nutrition', nutrition_goal: '/nutrition', nutrition_plan: '/nutrition', nutrition_progress: '/nutrition',
    medications: '/medications', medication_add: '/medications', medication_reminders: '/medications', medication_calendar: '/medications', medication_interactions: '/medications',
    visits: '/visits', visit_editor: '/visits',
    cycle: '/cycle', cycle_log: '/cycle', cycle_journal: '/cycle', cycle_trends: '/cycle', cycle_summary: '/cycle', cycle_settings: '/cycle', pregnancy: '/cycle', pregnancy_timeline: '/cycle', pregnancy_care: '/cycle',
    lab: '/lab', lab_history: '/lab', records: '/records',
    quest: '/quest', quest_achievements: '/quest', quest_history: '/quest', quest_wallet: '/quest', quest_rewards: '/quest', quest_mine: '/quest',
    pets: '/pets', pet_add: '/pets',
    profile: '/profile', health_profile: '/profile', settings: '/profile', ai_sharing: '/profile', ai_settings: '/profile', privacy: '/profile', terms: '/profile', notifications: '/profile', streak: '/profile',
  };
  const GROUP_ICON = { daily: ['heart', 'rose'], treatment: ['pill', 'teal'], cycle: ['flower', 'rose'], analysis: ['stethoscope', 'blue'], activity: ['footprints', 'green'], pets: ['paw', 'amber'], account: ['settings', 'neutral'] };

  async function openDirectory() {
    const body = h('div', { class: 'medi-dir' }, h('div', { class: 'skeleton-card' }, h('div', { class: 'sk' }), h('div', { class: 'sk', style: { width: '70%' } })));
    const m = openModal({ title: t('რას აკეთებს Medi', 'What Medi can do'), size: 'lg', body });
    try {
      await loadCatalog();
      if (!st.catalog) st.catalog = await get('/api/assistant/catalog', { scope: 'auto' });
    } catch (e) {
      mount(body, h('div', { class: 'error-box' }, icon('alert', { size: 20 }), h('div', null, h('strong', null, t('ვერ ჩაიტვირთა', 'Couldn’t load')), h('p', null, e?.message || ''))));
      return;
    }
    const c = st.catalog || {};
    const writes = (c.tools || []).filter((t) => t.kind === 'write');
    const search = h('input', { class: 'input', type: 'search', placeholder: t('მოძებნე ფუნქცია…', 'Search features…'), 'aria-label': t('ძებნა', 'Search') });
    const list = h('div', { class: 'medi-dir-groups' });
    const renderList = () => {
      const q = search.value.trim().toLowerCase();
      clear(list);
      const writeHits = writes.filter((t) => !q || `${t.label} ${t.description}`.toLowerCase().includes(q));
      if (writeHits.length) {
        list.append(h('div', { class: 'medi-dir-group' },
          h('div', { class: 'medi-dir-title' }, icon('message', { size: 16 }), t('ჩაწერა საუბრით', 'Log by chatting')),
          h('p', { class: 'faint', style: { fontSize: '13px', margin: '0 0 10px' } }, t('აირჩიე და დაწერე დეტალები — Medi ჩანაწერს შენახვამდე გადაგამოწმებინებს.', 'Pick one and write the details — Medi will ask you to check the entry before saving.')),
          h('div', { class: 'chips' }, writeHits.map((t) => h('button', {
            type: 'button', class: 'chip', title: t.description,
            onClick: () => { m.close(); setComposer(`${t.label}: `); },
          }, t.label)))));
      }
      for (const g of c.groups || []) {
        const feats = (c.features || []).filter((f) => f.group === g.id && (!q || `${f.label} ${f.description}`.toLowerCase().includes(q)));
        if (!feats.length) continue;
        const [ic, ink] = GROUP_ICON[g.id] || ['grid', 'neutral'];
        list.append(h('div', { class: 'medi-dir-group' },
          h('div', { class: 'medi-dir-title' }, h('span', { class: `tile ink-${ink}`, style: { width: '28px', height: '28px' } }, icon(ic, { size: 15 })), g.label),
          h('div', { class: 'medi-dir-grid' }, feats.map((f) => {
            const consult = f.id === 'doctor' ? 'doctor' : f.id === 'consilium' && deepOn() ? 'deep' : null;
            const web = FEATURE_WEB[f.id];
            return h('button', {
              type: 'button', class: 'medi-dir-item',
              onClick: () => {
                m.close();
                if (consult) { toggleConsilium(consult === 'deep'); setComposer(ta.value); }
                else if (web) ctx.navigate(web);
                else {
                  st.messages.push({ role: 'assistant', content: t(t(`„${f.label}“ MEDICARD აპშია — იქ გააგრძელე.`, `“${f.label}” is in the MEDICARD app — continue there.`), `“${f.label}” is in the MEDICARD app — continue there.`), timestamp: new Date().toISOString(), local: true, appOnly: true });
                  renderThread(); scrollToEnd(true);
                }
              },
            }, h('b', null, f.label), h('span', null, f.description), !consult && !web ? h('em', { class: 'badge badge-neutral' }, t('აპში', 'In app')) : null);
          }))));
      }
      if (!list.childNodes.length) list.append(h('p', { class: 'muted', style: { padding: '20px 0', textAlign: 'center' } }, t('ვერაფერი მოიძებნა.', 'Nothing found.')));
    };
    search.addEventListener('input', renderList);
    renderList();
    mount(body, search, list);
    search.focus();
  }

  /* ── History (left column / modal on mobile) ────────── */
  let refreshTimer = 0;
  function refreshSessions() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(loadSessions, 400);
  }
  async function loadSessions() {
    try {
      const r = await get('/api/chats');
      if (!same()) return;
      st.sessions = (r.sessions || []).filter((s) => ['ASSISTANT', 'DOCTOR', 'CONSILIUM'].includes(s.mode));
      st.sessionsError = null;
    } catch (e) {
      if (!same()) return;
      st.sessionsError = e;
    }
    renderSide();
  }

  function bucket(v) {
    const d = parseDate(v);
    if (!d) return t('ადრე', 'Earlier');
    const diff = Math.round((new Date(ymd()) - new Date(ymd(d))) / 86400000);
    if (diff <= 0) return t('დღეს', 'Today');
    if (diff === 1) return t('გუშინ', 'Yesterday');
    if (diff < 7) return t('ბოლო 7 დღე', 'Last 7 days');
    if (diff < 30) return t('ბოლო 30 დღე', 'Last 30 days');
    return t('ადრე', 'Earlier');
  }

  function historyList(onPick) {
    const wrap = h('div', { class: 'medi-hist' });
    if (st.sessionsError && !st.sessions) {
      wrap.append(h('div', { class: 'medi-hist-empty' }, t('ისტორია ვერ ჩაიტვირთა.', 'Couldn’t load your history.'), button(t('ხელახლა', 'Retry'), { variant: 'ghost', size: 'sm', onClick: loadSessions })));
      return wrap;
    }
    if (!st.sessions) {
      wrap.append(...Array.from({ length: 6 }, () => h('div', { class: 'medi-hist-sk' }, h('div', { class: 'sk' }), h('div', { class: 'sk', style: { width: '60%' } }))));
      return wrap;
    }
    const q = st.filter.trim().toLowerCase();
    const items = st.sessions.filter((s) => !q || `${s.title || ''} ${s.preview || ''}`.toLowerCase().includes(q));
    if (!items.length) {
      wrap.append(h('div', { class: 'medi-hist-empty' }, q ? t('ვერაფერი მოიძებნა.', 'Nothing found.') : t('საუბრები აქ გამოჩნდება.', 'Your conversations will appear here.')));
      return wrap;
    }
    let last = '';
    for (const s of items) {
      const b = bucket(s.updatedAt);
      if (b !== last) { wrap.append(h('div', { class: 'medi-hist-group' }, b)); last = b; }
      const m = SESSION_LOOK[s.mode] || SESSION_LOOK.ASSISTANT;
      const active = s.id === st.conv.sessionId;
      const d = parseDate(s.updatedAt);
      const when = d ? (bucket(s.updatedAt) === t('დღეს', 'Today') ? fmtTime(d) : relDay(d) === t('გუშინ', 'Yesterday') ? t('გუშინ', 'Yesterday') : fmtDate(d, { short: true })) : '';
      const delBtn = h('button', {
        type: 'button', class: 'medi-hist-del', title: t('წაშლა', 'Delete'), 'aria-label': t(t(`წაშლა: ${s.title || ''}`, `Delete: ${s.title || ''}`), `Delete: ${s.title || ''}`),
        onClick: (e) => { e.stopPropagation(); removeSession(s); },
      }, icon('trash', { size: 15 }));
      wrap.append(h('div', {
        class: `medi-hist-item ${active ? 'on' : ''}`, role: 'button', tabindex: '0', 'aria-current': active ? 'true' : undefined,
        onClick: () => { onPick?.(); if (!active) openConversation(s.id, { push: true }); },
        onKeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click(); } },
      },
      h('span', { class: `tile ink-${m.ink}`, style: { width: '30px', height: '30px' } }, icon(m.icon, { size: 15 })),
      h('div', { class: 'medi-hist-main' },
        h('div', { class: 'medi-hist-title' }, s.title || t('საუბარი', 'Conversation')),
        h('div', { class: 'medi-hist-sub' }, h('span', null, m.label), when ? h('span', null, ` · ${when}`) : null)),
      delBtn));
    }
    return wrap;
  }

  function sideTop(onPick) {
    const search = h('input', {
      class: 'input medi-hist-search', type: 'search', placeholder: t('ძებნა საუბრებში', 'Search conversations'), value: st.filter, 'aria-label': t('ძებნა საუბრებში', 'Search conversations'),
      onInput: (e) => { st.filter = e.target.value; const list = e.target.closest('.medi-side, .modal-body')?.querySelector('.medi-hist'); if (list) list.replaceWith(historyList(onPick)); },
    });
    return h('div', { class: 'medi-side-top' },
      button(t('ახალი საუბარი', 'New conversation'), { variant: 'primary', icon: 'plus', class: 'medi-new', onClick: () => { onPick?.(); openConversation(null, { push: true }); } }),
      search);
  }

  function renderSide() {
    mount(side, sideTop(null), historyList(null));
  }

  let histModal = null;
  function openHistoryModal() {
    const pick = () => histModal?.modal.close();
    const modal = openModal({
      title: t('საუბრები', 'Conversations'), size: 'md',
      body: h('div', { class: 'medi-side in-modal' }, sideTop(pick), historyList(pick)),
      onClose: () => { histModal = null; },
    });
    histModal = { modal, pick };
  }

  async function removeSession(s) {
    const ok = await confirmDialog({ title: t('საუბრის წაშლა', 'Delete conversation'), body: t(`„${s.title || 'საუბარი'}“ სამუდამოდ წაიშლება.`, `“${s.title || 'Conversation'}” will be deleted permanently.`), confirm: t('წაშლა', 'Delete'), danger: true });
    if (!ok || !same()) return;
    try {
      await del(`/api/chats/${encodeURIComponent(s.id)}`);
      if (!same()) return;
      st.sessions = (st.sessions || []).filter((x) => x.id !== s.id);
      if (histModal) histModal.modal.el.querySelector('.medi-hist')?.replaceWith(historyList(histModal.pick));
      toast(t('საუბარი წაიშალა', 'Conversation deleted'));
      if (s.id === st.conv.sessionId) openConversation(null);
      else renderSide();
    } catch (e) {
      toast(e?.message || t('წაშლა ვერ მოხერხდა', 'Couldn’t delete'), 'error');
    }
  }

  /* ── Boot ────────────────────────────────────────────── */
  // Other pages hand over a draft through sessionStorage (health text never goes in the URL): the question
  // goes to the composer (never auto-sent); `mode: 'doctor'` sends it straight to the doctor; the cycle page
  // adds a context the person sees as a removable chip.
  let stored = null;
  try {
    stored = JSON.parse(sessionStorage.getItem('medicard.web.mediPrefill') || 'null');
    sessionStorage.removeItem('medicard.web.mediPrefill');
  } catch { stored = null; }
  const fresh = stored && typeof stored.text === 'string' && Date.now() - Number(stored.at || 0) < 5 * 60_000;
  const directBoot = st.directNext;
  openConversation(st.conv.sessionId, { push: false });
  if (!st.conv.sessionId) {
    st.directNext = directBoot;
    if (fresh) {
      if (stored.mode === 'doctor') st.directNext = 'DOCTOR';
      const c = stored.context;
      if (c && typeof c.text === 'string' && Array.isArray(c.lines) && typeof c.chipLabel === 'string') {
        st.context = { text: c.text.slice(0, LIMIT), lines: c.lines.map(String).slice(0, 8), chipLabel: c.chipLabel.slice(0, 120) };
        st.directNext = 'DOCTOR';
        renderChip();
      }
      setComposer(stored.text.slice(0, LIMIT), true);
    }
  }
  loadSessions();

  return () => {
    alive = false;
    generation++;
    clearTimeout(refreshTimer);
    try { st.controller?.abort(); } catch { /* ignore */ }
  };
}
