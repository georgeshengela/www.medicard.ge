/** Symptom / mood catalog for cycle logging — Georgian labels (~70+ inputs). */

export type CycleChip = { id: string; label: string };

export const FLOW_OPTIONS: CycleChip[] = [
  { id: 'none', label: 'არა' },
  { id: 'spotting', label: 'მსუბუქი (spotting)' },
  { id: 'light', label: 'მსუბუქი' },
  { id: 'medium', label: 'ზომიერი' },
  { id: 'heavy', label: 'ძლიერი' },
];

/** ფიზიკური სიმპტომები */
export const PHYSICAL_SYMPTOMS: CycleChip[] = [
  { id: 'cramps', label: 'კრუნჩხვები' },
  { id: 'headache', label: 'თავის ტკივილი' },
  { id: 'migraine', label: 'მიგრენი' },
  { id: 'bloating', label: 'შებერილობა' },
  { id: 'acne', label: 'აკნე' },
  { id: 'fatigue', label: 'დაღლილობა' },
  { id: 'back_pain', label: 'წელის ტკივილი' },
  { id: 'breast_tenderness', label: 'მკერდის მგრძნობელობა' },
  { id: 'breast_swelling', label: 'მკერდის შეშუპება' },
  { id: 'nausea', label: 'გულისრევა' },
  { id: 'vomiting', label: 'ღებინება' },
  { id: 'dizziness', label: 'თავბრუსხვევა' },
  { id: 'insomnia', label: 'უძილობა' },
  { id: 'oversleep', label: 'ძილიანობა' },
  { id: 'appetite_up', label: 'მადის მატება' },
  { id: 'appetite_down', label: 'მადის კლება' },
  { id: 'cravings', label: 'კრავინგი' },
  { id: 'hot_flashes', label: 'ცხელი ტალღები' },
  { id: 'chills', label: 'შეარყუნება' },
  { id: 'sweating', label: 'ოფლიანობა' },
  { id: 'constipation', label: 'ყაბზობა' },
  { id: 'diarrhea', label: 'დიარეა' },
  { id: 'gas', label: 'გაზები' },
  { id: 'joint_pain', label: 'სახსრების ტკივილი' },
  { id: 'muscle_pain', label: 'კუნთების ტკივილი' },
  { id: 'pelvic_pain', label: 'მენჯის ტკივილი' },
  { id: 'ovulation_pain', label: 'ოვულაციის ტკივილი' },
  { id: 'leg_cramps', label: 'ფეხის კრუნჩხვები' },
  { id: 'swelling', label: 'შეშუპება' },
  { id: 'water_retention', label: 'წყლის შეკავება' },
  { id: 'dry_skin', label: 'მშრალი კანი' },
  { id: 'itchy_skin', label: 'ქავილი' },
  { id: 'hair_loss', label: 'თმის ცვენა' },
  { id: 'sensitive_smell', label: 'სუნის მგრძნობელობა' },
  { id: 'tinnitus', label: 'ყურებში ხმაური' },
  { id: 'palpitations', label: 'გულისცემა' },
  { id: 'short_breath', label: 'სუნთქვის სიმძიმე' },
  { id: 'frequent_urination', label: 'ხშირი შარდვა' },
  { id: 'uti_feel', label: 'შარდის დისკომფორტი' },
  { id: 'vaginal_dryness', label: 'საშოს სიმშრალე' },
  { id: 'discharge', label: 'გამონადენი' },
  { id: 'itching_vulva', label: 'ქავილი (გენიტალური)' },
  { id: 'fever', label: 'ცხელება' },
  { id: 'cold_symptoms', label: 'გაციების სიმპტომები' },
];

/** განწყობა და ემოციები */
export const MOOD_OPTIONS: CycleChip[] = [
  { id: 'energetic', label: 'ენერგიული' },
  { id: 'calm', label: 'მშვიდი' },
  { id: 'happy', label: 'ბედნიერი' },
  { id: 'confident', label: 'თავდაჯერებული' },
  { id: 'sensitive', label: 'მგრძნობიარე' },
  { id: 'anxious', label: 'შფოთვა' },
  { id: 'irritable', label: 'გაღიზიანება' },
  { id: 'angry', label: 'გაბრაზებული' },
  { id: 'sad', label: 'სევდიანი' },
  { id: 'tearful', label: 'ცრემლიანი' },
  { id: 'mood_swings', label: 'განწყობის ცვლა' },
  { id: 'focused', label: 'კონცენტრირებული' },
  { id: 'unfocused', label: 'გაფანტული' },
  { id: 'tired_mood', label: 'დაღლილი' },
  { id: 'apathetic', label: 'აპათიური' },
  { id: 'stressed', label: 'სტრესი' },
  { id: 'romantic', label: 'რომანტიკული' },
  { id: 'lonely', label: 'მარტოობა' },
];

/** სექსი / ნაყოფიერება — დამატებითი ჩიპები (ლოგში ასევეა switch + libido) */
export const SEXUAL_OPTIONS: CycleChip[] = [
  { id: 'protected', label: 'დაცული' },
  { id: 'unprotected', label: 'დაუცველი' },
  { id: 'high_drive', label: 'მაღალი ლიბიდო' },
  { id: 'low_drive', label: 'დაბალი ლიბიდო' },
  { id: 'orgasm', label: 'ორგაზმი' },
  { id: 'pain_sex', label: 'ტკივილი სექსისას' },
];

export const MUCUS_OPTIONS: CycleChip[] = [
  { id: 'dry', label: 'მშრალი' },
  { id: 'sticky', label: 'წებოვანი' },
  { id: 'creamy', label: 'კრემისებრი' },
  { id: 'watery', label: 'წყლიანი' },
  { id: 'eggwhite', label: 'კვერცხის ცილისებრი' },
];

/** User-logged OPK / pregnancy-test results — not a diagnosis. */
export const CYCLE_TEST_OPTIONS: CycleChip[] = [
  { id: 'negative', label: 'უარყოფითი' },
  { id: 'positive', label: 'დადებითი' },
  { id: 'unclear', label: 'გაურკვეველი' },
];

/** ორსულობის შემოწმების ჩეკლისტი */
export const PREGNANCY_CHECKLIST: CycleChip[] = [
  { id: 'prenatal_vitamin', label: 'პრენატალური ვიტამინი' },
  { id: 'folic_acid', label: 'ფოლის მჟავა' },
  { id: 'water_2l', label: '2ლ წყალი' },
  { id: 'walk', label: 'სეირნობა' },
  { id: 'doctor_appt', label: 'ექიმის ვიზიტი' },
  { id: 'ultrasound', label: 'ულტრაბგერა' },
  { id: 'blood_test', label: 'სისხლის ანალიზი' },
  { id: 'no_alcohol', label: 'ალკოჰოლის გარეშე' },
  { id: 'no_smoking', label: 'მოწევის გარეშე' },
  { id: 'rest', label: 'დასვენება' },
];

export const MONTHS_KA = [
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
];

export const WEEKDAYS_KA = ['ორშ', 'სამ', 'ოთხ', 'ხუთ', 'პარ', 'შაბ', 'კვი'];
