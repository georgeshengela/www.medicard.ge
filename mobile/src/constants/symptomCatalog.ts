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
  { id: 'head', labelKa: 'თავი', side: 'both', conditions: 86, hit: { x: 0.36, y: 0.0, w: 0.28, h: 0.12 } },
  { id: 'neck', labelKa: 'კისერი', side: 'both', conditions: 41, hit: { x: 0.4, y: 0.11, w: 0.2, h: 0.05 } },
  { id: 'chest', labelKa: 'გულმკერდი', side: 'front', conditions: 72, hit: { x: 0.3, y: 0.16, w: 0.4, h: 0.12 } },
  { id: 'shoulder', labelKa: 'მხარი', side: 'both', conditions: 54, hit: { x: 0.12, y: 0.16, w: 0.18, h: 0.1 } },
  { id: 'bicep', labelKa: 'ბიცეფსი', side: 'front', conditions: 28, hit: { x: 0.08, y: 0.24, w: 0.18, h: 0.1 } },
  { id: 'abs', labelKa: 'მუცელი', side: 'front', conditions: 64, hit: { x: 0.32, y: 0.28, w: 0.36, h: 0.14 } },
  { id: 'forearm', labelKa: 'წინამხარი', side: 'both', conditions: 33, hit: { x: 0.0, y: 0.34, w: 0.18, h: 0.12 } },
  { id: 'hand', labelKa: 'ხელი', side: 'both', conditions: 47, hit: { x: 0.0, y: 0.46, w: 0.16, h: 0.08 } },
  { id: 'upper-leg', labelKa: 'ბარძაყი', side: 'front', conditions: 39, hit: { x: 0.3, y: 0.48, w: 0.4, h: 0.18 } },
  { id: 'lower-leg', labelKa: 'წვივი', side: 'front', conditions: 36, hit: { x: 0.3, y: 0.68, w: 0.4, h: 0.2 } },
  { id: 'trap', labelKa: 'ტრაპეცია', side: 'back', conditions: 22, hit: { x: 0.32, y: 0.14, w: 0.36, h: 0.08 } },
  { id: 'back', labelKa: 'ზურგი', side: 'back', conditions: 61, hit: { x: 0.3, y: 0.22, w: 0.4, h: 0.2 } },
  { id: 'tricep', labelKa: 'ტრიცეფსი', side: 'back', conditions: 18, hit: { x: 0.08, y: 0.24, w: 0.18, h: 0.1 } },
  { id: 'glute', labelKa: 'დუნდულო', side: 'back', conditions: 24, hit: { x: 0.32, y: 0.42, w: 0.36, h: 0.1 } },
  { id: 'hamstring', labelKa: 'უკანა ბარძაყი', side: 'back', conditions: 21, hit: { x: 0.3, y: 0.52, w: 0.4, h: 0.16 } },
  { id: 'calf', labelKa: 'ხბო', side: 'back', conditions: 19, hit: { x: 0.3, y: 0.7, w: 0.4, h: 0.18 } },
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
  { id: 'brain', labelKa: 'ტვინი', conditions: 90, side: 'both', overlay: { x: 0.5, y: 0.055 } },
  { id: 'eye', labelKa: 'თვალი', conditions: 44, side: 'front', overlay: { x: 0.5, y: 0.085 } },
  { id: 'lung', labelKa: 'ფილტვი', conditions: 71, side: 'front', overlay: { x: 0.5, y: 0.215 } },
  { id: 'heart', labelKa: 'გული', conditions: 88, side: 'front', overlay: { x: 0.43, y: 0.225 } },
  { id: 'liver', labelKa: 'ღვიძლი', conditions: 63, side: 'front', overlay: { x: 0.6, y: 0.295 } },
  { id: 'stomach', labelKa: 'კუჭი', conditions: 57, side: 'front', overlay: { x: 0.45, y: 0.325 } },
  { id: 'gallbladder', labelKa: 'ნაღვლის ბუშტი', conditions: 29, side: 'front', overlay: { x: 0.62, y: 0.33 } },
  { id: 'pancreas', labelKa: 'პანკრეასი', conditions: 26, side: 'front', overlay: { x: 0.5, y: 0.345 } },
  { id: 'kidney', labelKa: 'თირკმელი', conditions: 48, side: 'back', overlay: { x: 0.62, y: 0.34 } },
  { id: 'small-intestine', labelKa: 'წვრილი ნაწლავი', conditions: 35, side: 'front', overlay: { x: 0.5, y: 0.4 } },
  { id: 'large-intestine', labelKa: 'მსხვილი ნაწლავი', conditions: 38, side: 'front', overlay: { x: 0.5, y: 0.445 } },
  { id: 'bladder', labelKa: 'შარდის ბუშტი', conditions: 31, side: 'front', overlay: { x: 0.5, y: 0.485 } },
  { id: 'spine', labelKa: 'ხერხემალი', conditions: 52, side: 'back', overlay: { x: 0.5, y: 0.28 } },
  { id: 'skin', labelKa: 'კანი', conditions: 67, side: 'both', overlay: { x: 0.78, y: 0.26 } },
  { id: 'breast', labelKa: 'მკერდი', conditions: 40, gender: 'FEMALE', side: 'front', overlay: { x: 0.4, y: 0.2 } },
  { id: 'genital', labelKa: 'სასქესო ორგანოები', conditions: 34, side: 'front', overlay: { x: 0.5, y: 0.505 } },
];

export const POPULAR_SYMPTOMS = [
  'თავის ტკივილი',
  'ცხელება',
  'ხველა',
  'ყელის ტკივილი',
  'გულისრევა',
  'დაღლილობა',
  'თავბრუსხვევა',
  'მუცლის ტკივილი',
  'გულმკერდის ტკივილი',
  'ქოშინი',
  'ზურგის ტკივილი',
  'სახსრების ტკივილი',
  'გამონაყარი',
  'უძილობა',
  'დიარეა',
  'ღებინება',
] as const;

export const DURATION_OPTIONS = [
  { id: 'today', labelKa: 'დღეს დაიწყო' },
  { id: '2d', labelKa: '2 დღეა' },
  { id: '1w', labelKa: 'დაახლოებით კვირა' },
  { id: '2w', labelKa: '2 კვირაზე მეტი' },
  { id: '1m', labelKa: 'თვეზე მეტია' },
] as const;

export const PAIN_LEVELS = [
  { level: 1, labelKa: 'ძალიან მსუბუქი' },
  { level: 2, labelKa: 'მსუბუქი' },
  { level: 3, labelKa: 'საშუალო' },
  { level: 4, labelKa: 'ძლიერი' },
  { level: 5, labelKa: 'ძალიან ძლიერი' },
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
  head: ['თავის ტკივილი', 'თავბრუსხვევა', 'შაკიკი', 'გულისრევა', 'სინათლის შიში', 'ყურის ტკივილი'],
  neck: ['კისრის ტკივილი', 'სიმტკიცე', 'ყელის ტკივილი', 'გადაყლაპვის გაძნელება', 'ლიმფური კვანძების შეშუპება'],
  chest: ['გულმკერდის ტკივილი', 'ქოშინი', 'ხველა', 'გულისცემის აჩქარება', 'წნევა გულმკერდში'],
  abs: ['მუცლის ტკივილი', 'გულისრევა', 'ღებინება', 'დიარეა', 'შებერილობა', 'მადის დაკარგვა'],
  shoulder: ['მხრის ტკივილი', 'მოძრაობის შეზღუდვა', 'სიმსივნე მხარზე', 'კუნთის კანკალი'],
  bicep: ['მკლავის ტკივილი', 'სისუსტე', 'კუნთის სიმტკიცე'],
  forearm: ['წინამხრის ტკივილი', 'დაბუჟება', 'მაჯის ტკივილი'],
  hand: ['ხელის ტკივილი', 'დაბუჟება', 'თითების სიმტკიცე', 'შეშუპება'],
  'upper-leg': ['ბარძაყის ტკივილი', 'კუნთის სიმტკიცე', 'სიარულის გაძნელება'],
  'lower-leg': ['წვივის ტკივილი', 'შეშუპება', 'კრუნჩხვა', 'სიმძიმე'],
  trap: ['ტრაპეციის ტკივილი', 'კისრის სიმტკიცე', 'თავის ტკივილი'],
  back: ['ზურგის ტკივილი', 'წელის ტკივილი', 'სიმტკიცე', 'გამოსხივებული ტკივილი'],
  tricep: ['ტრიცეფსის ტკივილი', 'მკლავის სისუსტე'],
  glute: ['დუნდულოს ტკივილი', 'სიარულის ტკივილი', 'იშორატული ტკივილი'],
  hamstring: ['უკანა ბარძაყის ტკივილი', 'კუნთის დაჭიმვა'],
  calf: ['ხბოს ტკივილი', 'კრუნჩხვა', 'შეშუპება'],
};

const SYMPTOMS_BY_ORGAN: Record<OrganId, string[]> = {
  brain: ['თავის ტკივილი', 'თავბრუსხვევა', 'მეხსიერების პრობლემა', 'დაბნეულობა', 'კრუნჩხვა'],
  eye: ['თვალის ტკივილი', 'დაბინდული მხედველობა', 'სიწითლე', 'ცრემლდენა', 'სინათლის შიში'],
  lung: ['ქოშინი', 'ხველა', 'ხიხინი', 'გულმკერდის ტკივილი', 'ნახველი'],
  heart: ['გულმკერდის ტკივილი', 'გულისცემის აჩქარება', 'ქოშინი', 'ოფლიანობა', 'სისუსტე'],
  liver: ['მარჯვენა ნეკნის ქვეშ ტკივილი', 'ყვითელი კანი', 'დაღლილობა', 'მუქი შარდი'],
  stomach: ['კუჭის ტკივილი', 'გულისრევა', 'ღებინება', 'გულძმარვა', 'მადის დაკარგვა'],
  kidney: ['წელის ტკივილი', 'ტკივილი შარდვისას', 'შეშუპება', 'სისხლი შარდში'],
  gallbladder: ['მარჯვენა ნეკნის ქვეშ ტკივილი', 'გულისრევა', 'ცხიმიანი საკვების აუტანლობა'],
  pancreas: ['ზედა მუცლის ტკივილი', 'გულისრევა', 'ზურგში გამოსხივება'],
  'small-intestine': ['მუცლის ტკივილი', 'დიარეა', 'შებერილობა', 'მალაბსორბცია'],
  'large-intestine': ['მუცლის ტკივილი', 'ყაბზობა', 'დიარეა', 'სისხლი განავალში'],
  bladder: ['ხშირი შარდვა', 'ტკივილი შარდვისას', 'შეუკავებლობა'],
  spine: ['ზურგის ტკივილი', 'სიმტკიცე', 'დაბუჟება ფეხებში', 'სისუსტე'],
  skin: ['გამონაყარი', 'ქავილი', 'სიწითლე', 'შეშუპება', 'წყლულები'],
  breast: ['მკერდის ტკივილი', 'სიმსივნე', 'კანის ცვლილება', 'გამონადენი'],
  genital: ['ტკივილი', 'გამონადენი', 'ქავილი', 'შეშუპება', 'შარდვის დისკომფორტი'],
};

export function symptomsForSelection(mode: 'muscle' | 'organ', partId?: BodyPartId | null, organId?: OrganId | null) {
  if (mode === 'organ' && organId) return SYMPTOMS_BY_ORGAN[organId] ?? [...POPULAR_SYMPTOMS];
  if (partId) return SYMPTOMS_BY_PART[partId] ?? [...POPULAR_SYMPTOMS];
  return [...POPULAR_SYMPTOMS];
}
