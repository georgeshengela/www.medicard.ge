import { tx } from '../i18n/locale.js';
import type { BodyPartId, BodySide, OrganId } from '@/types/symptoms';

export type BodyPartDef = {
  id: BodyPartId;
  labelKa: string;
  side: BodySide | 'both';
  conditions: number;
  /** Normalized hit rect on the body illustration (0–1). */
  hit: { x: number; y: number; w: number; h: number };
};

export const BODY_PARTS: BodyPartDef[] = [
  { id: 'head', labelKa: tx('თავი', 'Head'), side: 'both', conditions: 86, hit: { x: 0.36, y: 0.0, w: 0.28, h: 0.12 } },
  { id: 'neck', labelKa: tx('კისერი', 'Neck'), side: 'both', conditions: 41, hit: { x: 0.4, y: 0.11, w: 0.2, h: 0.05 } },
  { id: 'chest', labelKa: tx('გულმკერდი', 'Chest'), side: 'front', conditions: 72, hit: { x: 0.3, y: 0.16, w: 0.4, h: 0.12 } },
  { id: 'shoulder', labelKa: tx('მხარი', 'Shoulder'), side: 'both', conditions: 54, hit: { x: 0.12, y: 0.16, w: 0.18, h: 0.1 } },
  { id: 'bicep', labelKa: tx('ბიცეფსი', 'Biceps'), side: 'front', conditions: 28, hit: { x: 0.08, y: 0.24, w: 0.18, h: 0.1 } },
  { id: 'abs', labelKa: tx('მუცელი', 'Abdomen'), side: 'front', conditions: 64, hit: { x: 0.32, y: 0.28, w: 0.36, h: 0.14 } },
  { id: 'forearm', labelKa: tx('წინამხარი', 'Forearm'), side: 'both', conditions: 33, hit: { x: 0.0, y: 0.34, w: 0.18, h: 0.12 } },
  { id: 'hand', labelKa: tx('ხელი', 'Hand'), side: 'both', conditions: 47, hit: { x: 0.0, y: 0.46, w: 0.16, h: 0.08 } },
  { id: 'upper-leg', labelKa: tx('ბარძაყი', 'Thigh'), side: 'front', conditions: 39, hit: { x: 0.3, y: 0.48, w: 0.4, h: 0.18 } },
  { id: 'lower-leg', labelKa: tx('წვივი', 'Shin'), side: 'front', conditions: 36, hit: { x: 0.3, y: 0.68, w: 0.4, h: 0.2 } },
  { id: 'trap', labelKa: tx('ტრაპეცია', 'Trapezius'), side: 'back', conditions: 22, hit: { x: 0.32, y: 0.14, w: 0.36, h: 0.08 } },
  { id: 'back', labelKa: tx('ზურგი', 'Back'), side: 'back', conditions: 61, hit: { x: 0.3, y: 0.22, w: 0.4, h: 0.2 } },
  { id: 'tricep', labelKa: tx('ტრიცეფსი', 'Triceps'), side: 'back', conditions: 18, hit: { x: 0.08, y: 0.24, w: 0.18, h: 0.1 } },
  { id: 'glute', labelKa: tx('დუნდულო', 'Buttock'), side: 'back', conditions: 24, hit: { x: 0.32, y: 0.42, w: 0.36, h: 0.1 } },
  { id: 'hamstring', labelKa: tx('უკანა ბარძაყი', 'Hamstring'), side: 'back', conditions: 21, hit: { x: 0.3, y: 0.52, w: 0.4, h: 0.16 } },
  { id: 'calf', labelKa: tx('ხბო', 'Calf'), side: 'back', conditions: 19, hit: { x: 0.3, y: 0.7, w: 0.4, h: 0.18 } },
];

export const BODY_PART_GRID: Exclude<BodyPartId, 'head'>[] = [
  'upper-leg',
  'lower-leg',
  'abs',
  'chest',
  'shoulder',
  'bicep',
  'forearm',
  'neck',
  'hand',
  'tricep',
  'hamstring',
  'glute',
  'calf',
  'back',
  'trap',
];


export type OrganDef = {
  id: OrganId;
  labelKa: string;
  conditions: number;
  gender?: 'FEMALE' | 'MALE';
  side: BodySide | 'both';
  /** Overlay position on the body illustration (0–1). */
  overlay: { x: number; y: number };
};

export const ORGANS: OrganDef[] = [
  { id: 'brain', labelKa: tx('ტვინი', 'Brain'), conditions: 90, side: 'both', overlay: { x: 0.5, y: 0.055 } },
  { id: 'eye', labelKa: tx('თვალი', 'Eye'), conditions: 44, side: 'front', overlay: { x: 0.5, y: 0.085 } },
  { id: 'lung', labelKa: tx('ფილტვი', 'Lung'), conditions: 71, side: 'front', overlay: { x: 0.5, y: 0.215 } },
  { id: 'heart', labelKa: tx('გული', 'Heart'), conditions: 88, side: 'front', overlay: { x: 0.43, y: 0.225 } },
  { id: 'liver', labelKa: tx('ღვიძლი', 'Liver'), conditions: 63, side: 'front', overlay: { x: 0.6, y: 0.295 } },
  { id: 'stomach', labelKa: tx('კუჭი', 'Stomach'), conditions: 57, side: 'front', overlay: { x: 0.45, y: 0.325 } },
  { id: 'gallbladder', labelKa: tx('ნაღვლის ბუშტი', 'Gallbladder'), conditions: 29, side: 'front', overlay: { x: 0.62, y: 0.33 } },
  { id: 'pancreas', labelKa: tx('პანკრეასი', 'Pancreas'), conditions: 26, side: 'front', overlay: { x: 0.5, y: 0.345 } },
  { id: 'kidney', labelKa: tx('თირკმელი', 'Kidney'), conditions: 48, side: 'back', overlay: { x: 0.62, y: 0.34 } },
  { id: 'small-intestine', labelKa: tx('წვრილი ნაწლავი', 'Small intestine'), conditions: 35, side: 'front', overlay: { x: 0.5, y: 0.4 } },
  { id: 'large-intestine', labelKa: tx('მსხვილი ნაწლავი', 'Large intestine'), conditions: 38, side: 'front', overlay: { x: 0.5, y: 0.445 } },
  { id: 'bladder', labelKa: tx('შარდის ბუშტი', 'Bladder'), conditions: 31, side: 'front', overlay: { x: 0.5, y: 0.485 } },
  { id: 'spine', labelKa: tx('ხერხემალი', 'Spine'), conditions: 52, side: 'back', overlay: { x: 0.5, y: 0.28 } },
  { id: 'skin', labelKa: tx('კანი', 'Skin'), conditions: 67, side: 'both', overlay: { x: 0.78, y: 0.26 } },
  { id: 'breast', labelKa: tx('მკერდი', 'Breast'), conditions: 40, gender: 'FEMALE', side: 'front', overlay: { x: 0.4, y: 0.2 } },
  { id: 'genital', labelKa: tx('სასქესო ორგანოები', 'Genitals'), conditions: 34, side: 'front', overlay: { x: 0.5, y: 0.505 } },
];

export const POPULAR_SYMPTOMS = [
  tx('თავის ტკივილი', 'Headache'),
  tx('ცხელება', 'Fever'),
  tx('ხველა', 'Cough'),
  tx('ყელის ტკივილი', 'Sore throat'),
  tx('გულისრევა', 'Nausea'),
  tx('დაღლილობა', 'Fatigue'),
  tx('თავბრუსხვევა', 'Dizziness'),
  tx('მუცლის ტკივილი', 'Abdominal pain'),
  tx('გულმკერდის ტკივილი', 'Chest pain'),
  tx('ქოშინი', 'Shortness of breath'),
  tx('ზურგის ტკივილი', 'Back pain'),
  tx('სახსრების ტკივილი', 'Joint pain'),
  tx('გამონაყარი', 'Rash'),
  tx('უძილობა', 'Insomnia'),
  tx('დიარეა', 'Diarrhea'),
  tx('ღებინება', 'Vomiting'),
] as const;

const DURATION_LABELS = [
  { id: 'today', ka: 'დღეს დაიწყო', en: 'Started today' },
  { id: '2d', ka: '2 დღეა', en: 'For 2 days' },
  { id: '1w', ka: 'დაახლოებით კვირა', en: 'About a week' },
  { id: '2w', ka: '2 კვირაზე მეტი', en: 'Over 2 weeks' },
  { id: '1m', ka: 'თვეზე მეტია', en: 'Over a month' },
] as const;

export const DURATION_OPTIONS = DURATION_LABELS.map(({ id, ka, en }) => ({ id, labelKa: tx<string>(ka, en) }));

/** Duration id from a saved label in either language (records saved in Georgian must still resolve in English). */
export function durationIdFromLabel(label: string | null | undefined): string | null {
  if (!label) return null;
  return DURATION_LABELS.find((d) => d.ka === label || d.en === label)?.id ?? null;
}

export const PAIN_LEVELS = [
  { level: 1, labelKa: tx('ძალიან მსუბუქი', 'Very mild') },
  { level: 2, labelKa: tx('მსუბუქი', 'Mild') },
  { level: 3, labelKa: tx('საშუალო', 'Moderate') },
  { level: 4, labelKa: tx('ძლიერი', 'Severe') },
  { level: 5, labelKa: tx('ძალიან ძლიერი', 'Very severe') },
] as const;

export function bodyPartById(id: string | null | undefined) {
  return BODY_PARTS.find((p) => p.id === id) ?? null;
}

export function organById(id: string | null | undefined) {
  return ORGANS.find((o) => o.id === id) ?? null;
}

export function partsForSide(side: BodySide) {
  return BODY_PARTS.filter((p) => p.side === 'both' || p.side === side);
}

export function organsForGender(gender: 'MALE' | 'FEMALE') {
  return ORGANS.filter((o) => !o.gender || o.gender === gender);
}

export function organsForView(gender: 'MALE' | 'FEMALE', side: BodySide) {
  return organsForGender(gender).filter((o) => o.side === 'both' || o.side === side);
}

const SYMPTOMS_BY_PART: Record<BodyPartId, string[]> = {
  head: [tx('თავის ტკივილი', 'Headache'), tx('თავბრუსხვევა', 'Dizziness'), tx('შაკიკი', 'Migraine'), tx('გულისრევა', 'Nausea'), tx('სინათლის შიში', 'Light sensitivity'), tx('ყურის ტკივილი', 'Earache')],
  neck: [tx('კისრის ტკივილი', 'Neck pain'), tx('სიხისტე', 'Stiffness'), tx('ყელის ტკივილი', 'Sore throat'), tx('გადაყლაპვის გაძნელება', 'Trouble swallowing'), tx('ლიმფური კვანძების შეშუპება', 'Swollen lymph nodes')],
  chest: [tx('გულმკერდის ტკივილი', 'Chest pain'), tx('ქოშინი', 'Shortness of breath'), tx('ხველა', 'Cough'), tx('გულისცემის აჩქარება', 'Racing heartbeat'), tx('წნევა გულმკერდში', 'Chest pressure')],
  abs: [tx('მუცლის ტკივილი', 'Abdominal pain'), tx('გულისრევა', 'Nausea'), tx('ღებინება', 'Vomiting'), tx('დიარეა', 'Diarrhea'), tx('შებერილობა', 'Bloating'), tx('მადის დაკარგვა', 'Loss of appetite')],
  shoulder: [tx('მხრის ტკივილი', 'Shoulder pain'), tx('მოძრაობის შეზღუდვა', 'Limited movement'), tx('სიმსივნე მხარზე', 'Lump on the shoulder'), tx('კუნთის კანკალი', 'Muscle twitching')],
  bicep: [tx('მკლავის ტკივილი', 'Arm pain'), tx('სისუსტე', 'Weakness'), tx('კუნთის სიხისტე', 'Muscle stiffness')],
  forearm: [tx('წინამხრის ტკივილი', 'Forearm pain'), tx('დაბუჟება', 'Numbness'), tx('მაჯის ტკივილი', 'Wrist pain')],
  hand: [tx('ხელის ტკივილი', 'Hand pain'), tx('დაბუჟება', 'Numbness'), tx('თითების სიხისტე', 'Stiff fingers'), tx('შეშუპება', 'Swelling')],
  'upper-leg': [tx('ბარძაყის ტკივილი', 'Thigh pain'), tx('კუნთის სიხისტე', 'Muscle stiffness'), tx('სიარულის გაძნელება', 'Difficulty walking')],
  'lower-leg': [tx('წვივის ტკივილი', 'Shin pain'), tx('შეშუპება', 'Swelling'), tx('კრუნჩხვა', 'Cramps'), tx('სიმძიმე', 'Heaviness')],
  trap: [tx('ტრაპეციის ტკივილი', 'Upper back and neck pain'), tx('კისრის სიხისტე', 'Stiff neck'), tx('თავის ტკივილი', 'Headache')],
  back: [tx('ზურგის ტკივილი', 'Back pain'), tx('წელის ტკივილი', 'Lower back pain'), tx('სიხისტე', 'Stiffness'), tx('გამოსხივებული ტკივილი', 'Radiating pain')],
  tricep: [tx('ტრიცეფსის ტკივილი', 'Triceps pain'), tx('მკლავის სისუსტე', 'Arm weakness')],
  glute: [tx('დუნდულოს ტკივილი', 'Buttock pain'), tx('ტკივილი სიარულისას', 'Pain when walking'), tx('იშიასური ტკივილი', 'Sciatic pain')],
  hamstring: [tx('უკანა ბარძაყის ტკივილი', 'Hamstring pain'), tx('კუნთის დაჭიმვა', 'Muscle strain')],
  calf: [tx('ხბოს ტკივილი', 'Calf pain'), tx('კრუნჩხვა', 'Cramps'), tx('შეშუპება', 'Swelling')],
};

const SYMPTOMS_BY_ORGAN: Record<OrganId, string[]> = {
  brain: [tx('თავის ტკივილი', 'Headache'), tx('თავბრუსხვევა', 'Dizziness'), tx('მეხსიერების პრობლემა', 'Memory problems'), tx('დაბნეულობა', 'Confusion'), tx('კრუნჩხვა', 'Seizures')],
  eye: [tx('თვალის ტკივილი', 'Eye pain'), tx('დაბინდული მხედველობა', 'Blurred vision'), tx('სიწითლე', 'Redness'), tx('ცრემლდენა', 'Watery eyes'), tx('სინათლის შიში', 'Light sensitivity')],
  lung: [tx('ქოშინი', 'Shortness of breath'), tx('ხველა', 'Cough'), tx('ხიხინი', 'Wheezing'), tx('გულმკერდის ტკივილი', 'Chest pain'), tx('ნახველი', 'Phlegm')],
  heart: [tx('გულმკერდის ტკივილი', 'Chest pain'), tx('გულისცემის აჩქარება', 'Racing heartbeat'), tx('ქოშინი', 'Shortness of breath'), tx('ოფლიანობა', 'Sweating'), tx('სისუსტე', 'Weakness')],
  liver: [tx('მარჯვენა ნეკნის ქვეშ ტკივილი', 'Pain under the right ribs'), tx('ყვითელი კანი', 'Yellow skin'), tx('დაღლილობა', 'Fatigue'), tx('მუქი შარდი', 'Dark urine')],
  stomach: [tx('კუჭის ტკივილი', 'Stomach pain'), tx('გულისრევა', 'Nausea'), tx('ღებინება', 'Vomiting'), tx('გულძმარვა', 'Heartburn'), tx('მადის დაკარგვა', 'Loss of appetite')],
  kidney: [tx('წელის ტკივილი', 'Lower back pain'), tx('ტკივილი შარდვისას', 'Pain when urinating'), tx('შეშუპება', 'Swelling'), tx('სისხლი შარდში', 'Blood in urine')],
  gallbladder: [tx('მარჯვენა ნეკნის ქვეშ ტკივილი', 'Pain under the right ribs'), tx('გულისრევა', 'Nausea'), tx('ცხიმიანი საკვების აუტანლობა', 'Intolerance to fatty food')],
  pancreas: [tx('ზედა მუცლის ტკივილი', 'Upper abdominal pain'), tx('გულისრევა', 'Nausea'), tx('ზურგში გამოსხივება', 'Pain spreading to the back')],
  'small-intestine': [tx('მუცლის ტკივილი', 'Abdominal pain'), tx('დიარეა', 'Diarrhea'), tx('შებერილობა', 'Bloating'), tx('მალაბსორბცია', 'Malabsorption')],
  'large-intestine': [tx('მუცლის ტკივილი', 'Abdominal pain'), tx('ყაბზობა', 'Constipation'), tx('დიარეა', 'Diarrhea'), tx('სისხლი განავალში', 'Blood in stool')],
  bladder: [tx('ხშირი შარდვა', 'Frequent urination'), tx('ტკივილი შარდვისას', 'Pain when urinating'), tx('შეუკავებლობა', 'Incontinence')],
  spine: [tx('ზურგის ტკივილი', 'Back pain'), tx('სიხისტე', 'Stiffness'), tx('დაბუჟება ფეხებში', 'Numb legs'), tx('სისუსტე', 'Weakness')],
  skin: [tx('გამონაყარი', 'Rash'), tx('ქავილი', 'Itching'), tx('სიწითლე', 'Redness'), tx('შეშუპება', 'Swelling'), tx('წყლულები', 'Sores')],
  breast: [tx('მკერდის ტკივილი', 'Breast pain'), tx('სიმსივნე', 'Lump'), tx('კანის ცვლილება', 'Skin changes'), tx('გამონადენი', 'Discharge')],
  genital: [tx('ტკივილი', 'Pain'), tx('გამონადენი', 'Discharge'), tx('ქავილი', 'Itching'), tx('შეშუპება', 'Swelling'), tx('შარდვის დისკომფორტი', 'Urinary discomfort')],
};

export function symptomsForSelection(mode: 'muscle' | 'organ', partId?: BodyPartId | null, organId?: OrganId | null) {
  if (mode === 'organ' && organId) return SYMPTOMS_BY_ORGAN[organId] ?? [...POPULAR_SYMPTOMS];
  if (partId) return SYMPTOMS_BY_PART[partId] ?? [...POPULAR_SYMPTOMS];
  return [...POPULAR_SYMPTOMS];
}
