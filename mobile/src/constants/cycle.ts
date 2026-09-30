/** Symptom / mood catalog for cycle logging — Georgian labels (~70+ inputs), English via tx(). */
import { tx } from '../i18n/locale.js';

export type CycleChip = { id: string; label: string };

export const FLOW_OPTIONS: CycleChip[] = [
  { id: 'none', label: tx('არა', 'None') },
  { id: 'spotting', label: tx('ლაქები', 'Spotting') },
  { id: 'light', label: tx('მსუბუქი', 'Light') },
  { id: 'medium', label: tx('ზომიერი', 'Medium') },
  { id: 'heavy', label: tx('ძლიერი', 'Heavy') },
];

/** ფიზიკური სიმპტომები */
export const PHYSICAL_SYMPTOMS: CycleChip[] = [
  { id: 'cramps', label: tx('კრუნჩხვები', 'Cramps') },
  { id: 'headache', label: tx('თავის ტკივილი', 'Headache') },
  { id: 'migraine', label: tx('მიგრენი', 'Migraine') },
  { id: 'bloating', label: tx('შებერილობა', 'Bloating') },
  { id: 'acne', label: tx('აკნე', 'Acne') },
  { id: 'fatigue', label: tx('დაღლილობა', 'Fatigue') },
  { id: 'back_pain', label: tx('წელის ტკივილი', 'Lower back pain') },
  { id: 'breast_tenderness', label: tx('მკერდის მგრძნობელობა', 'Tender breasts') },
  { id: 'breast_swelling', label: tx('მკერდის შეშუპება', 'Breast swelling') },
  { id: 'nausea', label: tx('გულისრევა', 'Nausea') },
  { id: 'vomiting', label: tx('ღებინება', 'Vomiting') },
  { id: 'heartburn', label: tx('გულძმარვა', 'Heartburn') },
  { id: 'dizziness', label: tx('თავბრუსხვევა', 'Dizziness') },
  { id: 'insomnia', label: tx('უძილობა', 'Insomnia') },
  { id: 'oversleep', label: tx('ძილიანობა', 'Sleepiness') },
  { id: 'appetite_up', label: tx('მადის მატება', 'More appetite') },
  { id: 'appetite_down', label: tx('მადის კლება', 'Less appetite') },
  { id: 'cravings', label: tx('საკვების ლტოლვა', 'Cravings') },
  { id: 'hot_flashes', label: tx('ცხელი ტალღები', 'Hot flashes') },
  { id: 'night_sweats', label: tx('ღამის ოფლიანობა', 'Night sweats') },
  { id: 'chills', label: tx('შეცივება', 'Chills') },
  { id: 'sweating', label: tx('ოფლიანობა', 'Sweating') },
  { id: 'constipation', label: tx('ყაბზობა', 'Constipation') },
  { id: 'diarrhea', label: tx('დიარეა', 'Diarrhea') },
  { id: 'gas', label: tx('გაზები', 'Gas') },
  { id: 'joint_pain', label: tx('სახსრების ტკივილი', 'Joint pain') },
  { id: 'muscle_pain', label: tx('კუნთების ტკივილი', 'Muscle pain') },
  { id: 'pelvic_pain', label: tx('მენჯის ტკივილი', 'Pelvic pain') },
  { id: 'ovulation_pain', label: tx('ოვულაციის ტკივილი', 'Ovulation pain') },
  { id: 'leg_cramps', label: tx('ფეხის კრუნჩხვები', 'Leg cramps') },
  { id: 'swelling', label: tx('შეშუპება', 'Swelling') },
  { id: 'water_retention', label: tx('წყლის შეკავება', 'Water retention') },
  { id: 'dry_skin', label: tx('მშრალი კანი', 'Dry skin') },
  { id: 'oily_skin', label: tx('ცხიმიანი კანი', 'Oily skin') },
  { id: 'itchy_skin', label: tx('ქავილი', 'Itchy skin') },
  { id: 'hair_loss', label: tx('თმის ცვენა', 'Hair loss') },
  { id: 'sensitive_smell', label: tx('სუნის მგრძნობელობა', 'Sensitive to smells') },
  { id: 'tinnitus', label: tx('ყურებში ხმაური', 'Ringing in ears') },
  { id: 'palpitations', label: tx('გულის ფრიალი', 'Palpitations') },
  { id: 'short_breath', label: tx('სუნთქვის სიმძიმე', 'Shortness of breath') },
  { id: 'frequent_urination', label: tx('ხშირი შარდვა', 'Frequent urination') },
  { id: 'uti_feel', label: tx('შარდის დისკომფორტი', 'Urinary discomfort') },
  { id: 'vaginal_dryness', label: tx('საშოს სიმშრალე', 'Vaginal dryness') },
  { id: 'discharge', label: tx('გამონადენი', 'Discharge') },
  { id: 'itching_vulva', label: tx('ქავილი (გენიტალური)', 'Genital itching') },
  { id: 'fever', label: tx('ცხელება', 'Fever') },
  { id: 'cold_symptoms', label: tx('გაციების სიმპტომები', 'Cold symptoms') },
];

/** განწყობა და ემოციები */
export const MOOD_OPTIONS: CycleChip[] = [
  { id: 'energetic', label: tx('ენერგიული', 'Energetic') },
  { id: 'calm', label: tx('მშვიდი', 'Calm') },
  { id: 'happy', label: tx('ბედნიერი', 'Happy') },
  { id: 'confident', label: tx('თავდაჯერებული', 'Confident') },
  { id: 'sensitive', label: tx('მგრძნობიარე', 'Sensitive') },
  { id: 'anxious', label: tx('შფოთვა', 'Anxious') },
  { id: 'irritable', label: tx('გაღიზიანება', 'Irritable') },
  { id: 'angry', label: tx('გაბრაზებული', 'Angry') },
  { id: 'sad', label: tx('სევდიანი', 'Sad') },
  { id: 'tearful', label: tx('ცრემლიანი', 'Tearful') },
  { id: 'mood_swings', label: tx('განწყობის ცვლა', 'Mood swings') },
  { id: 'focused', label: tx('კონცენტრირებული', 'Focused') },
  { id: 'unfocused', label: tx('გაფანტული', 'Distracted') },
  { id: 'tired_mood', label: tx('დაღლილი', 'Tired') },
  { id: 'apathetic', label: tx('აპათიური', 'Apathetic') },
  { id: 'stressed', label: tx('სტრესი', 'Stressed') },
  { id: 'romantic', label: tx('რომანტიკული', 'Romantic') },
  { id: 'lonely', label: tx('მარტოობა', 'Lonely') },
];

/** სექსი / ნაყოფიერება — დამატებითი ჩიპები (ლოგში ასევეა switch + libido) */
/** What happened (Flo's "Sex and sex drive" set). Any of these means sexual activity = yes. */
export const SEX_ACTIVITY_OPTIONS: CycleChip[] = [
  { id: 'protected', label: tx('დაცული სექსი', 'Protected sex') },
  { id: 'unprotected', label: tx('დაუცველი სექსი', 'Unprotected sex') },
  { id: 'oral_sex', label: tx('ორალური', 'Oral') },
  { id: 'anal_sex', label: tx('ანალური', 'Anal') },
  { id: 'sensual_touch', label: tx('სენსუალური შეხება', 'Sensual touch') },
  { id: 'masturbation', label: tx('მასტურბაცია', 'Masturbation') },
  { id: 'sex_toys', label: tx('სათამაშოები', 'Sex toys') },
  { id: 'orgasm', label: tx('ორგაზმი', 'Orgasm') },
  { id: 'pain_sex', label: tx('ტკივილი სექსისას', 'Pain during sex') },
];

/** Sex drive — one answer, independent of whether anything happened. */
export const SEX_DRIVE_OPTIONS: CycleChip[] = [
  { id: 'high_drive', label: tx('მაღალი', 'High') },
  { id: 'neutral_drive', label: tx('ჩვეულებრივი', 'Usual') },
  { id: 'low_drive', label: tx('დაბალი', 'Low') },
];

export const SEXUAL_OPTIONS: CycleChip[] = [...SEX_ACTIVITY_OPTIONS, ...SEX_DRIVE_OPTIONS];

export const MUCUS_OPTIONS: CycleChip[] = [
  { id: 'dry', label: tx('მშრალი', 'Dry') },
  { id: 'sticky', label: tx('წებოვანი', 'Sticky') },
  { id: 'creamy', label: tx('კრემისებრი', 'Creamy') },
  { id: 'watery', label: tx('წყლიანი', 'Watery') },
  { id: 'eggwhite', label: tx('კვერცხის ცილისებრი', 'Egg white') },
];

/** User-logged OPK / pregnancy-test results — not a diagnosis. */
export const CYCLE_TEST_OPTIONS: CycleChip[] = [
  { id: 'negative', label: tx('უარყოფითი', 'Negative') },
  { id: 'positive', label: tx('დადებითი', 'Positive') },
  { id: 'unclear', label: tx('გაურკვეველი', 'Unclear') },
];

/** ორსულობის შემოწმების ჩეკლისტი */
export const PREGNANCY_CHECKLIST: CycleChip[] = [
  { id: 'prenatal_vitamin', label: tx('პრენატალური ვიტამინი', 'Prenatal vitamin') },
  { id: 'folic_acid', label: tx('ფოლის მჟავა', 'Folic acid') },
  { id: 'water_2l', label: tx('2ლ წყალი', '2 L water') },
  { id: 'walk', label: tx('სეირნობა', 'Walk') },
  { id: 'doctor_appt', label: tx('ექიმის ვიზიტი', 'Doctor visit') },
  { id: 'ultrasound', label: tx('ულტრაბგერა', 'Ultrasound') },
  { id: 'blood_test', label: tx('სისხლის ანალიზი', 'Blood test') },
  { id: 'no_alcohol', label: tx('ალკოჰოლის გარეშე', 'No alcohol') },
  { id: 'no_smoking', label: tx('მოწევის გარეშე', 'No smoking') },
  { id: 'rest', label: tx('დასვენება', 'Rest') },
];

export const MONTHS_KA = tx([
  'იანვარი',
  'თებერვალი',
  'მარტი',
  'აპრილი',
  'მაისი',
  'ივნისი',
  'ივლისი',
  'აგვისტო',
  'სექტემბერი',
  'ოქტომბერი',
  'ნოემბერი',
  'დეკემბერი',
], ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']);

export const WEEKDAYS_KA = tx(['ორშ', 'სამ', 'ოთხ', 'ხუთ', 'პარ', 'შაბ', 'კვი'], ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
