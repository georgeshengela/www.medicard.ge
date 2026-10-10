import type { LabFlag, LabParameter } from '../types/lab.ts';
import { tx } from '../i18n/locale.js';

/**
 * MEDILAB „ანალიზი სხეულზე“ (owner 2026-10-10): every value belongs to a body system, gets a plain
 * name a non-medical reader understands („რკინის მარაგი“ for ferritin), a one-word status and a place
 * on the body map. Pure helpers — the screen and the tests share them.
 */

export type LabSystemId =
  | 'blood'
  | 'heart'
  | 'liver'
  | 'sugar'
  | 'kidney'
  | 'thyroid'
  | 'hormones'
  | 'vitamins'
  | 'markers'
  | 'other';

/** Fixed reading order (head to toe, then the systems without one place on the body). */
export const LAB_SYSTEM_ORDER: LabSystemId[] = ['thyroid', 'heart', 'blood', 'liver', 'sugar', 'kidney', 'hormones', 'vitamins', 'markers', 'other'];

const SYSTEM_OF: Record<string, LabSystemId> = {};
const PLAIN: Record<string, [string, string]> = {};
function put(system: LabSystemId, rows: Record<string, [string, string]>) {
  for (const [key, plain] of Object.entries(rows)) {
    SYSTEM_OF[key] = system;
    PLAIN[key] = plain;
  }
}

put('blood', {
  hemoglobin: ['ჟანგბადის გადამტანი', 'Carries oxygen'],
  rbc: ['წითელი უჯრედები', 'Red cells'],
  hct: ['წითელი უჯრედების წილი', 'Share of red cells'],
  mcv: ['წითელი უჯრედის ზომა', 'Red cell size'],
  mch: ['ჰემოგლობინი ერთ უჯრედში', 'Hemoglobin per cell'],
  mchc: ['ჰემოგლობინის სიმკვრივე', 'Hemoglobin density'],
  rdw: ['უჯრედების ზომის სხვაობა', 'Spread of red cell sizes'],
  wbc: ['იმუნიტეტის უჯრედები', 'Immune cells'],
  neutrophils: ['ბაქტერიების წინააღმდეგ მებრძოლები', 'Bacteria fighters'],
  neutrophils_pct: ['ბაქტერიების წინააღმდეგ მებრძოლები', 'Bacteria fighters'],
  lymphocytes: ['ვირუსების წინააღმდეგ მებრძოლები', 'Virus fighters'],
  lymphocytes_pct: ['ვირუსების წინააღმდეგ მებრძოლები', 'Virus fighters'],
  monocytes: ['„დამლაგებელი“ უჯრედები', 'Clean-up cells'],
  monocytes_pct: ['„დამლაგებელი“ უჯრედები', 'Clean-up cells'],
  eosinophils: ['ალერგიის უჯრედები', 'Allergy cells'],
  eosinophils_pct: ['ალერგიის უჯრედები', 'Allergy cells'],
  basophils: ['ალერგიის სიგნალის უჯრედები', 'Allergy signal cells'],
  basophils_pct: ['ალერგიის სიგნალის უჯრედები', 'Allergy signal cells'],
  nlr: ['ანთების ბალანსი', 'Inflammation balance'],
  plt: ['სისხლის შედედება', 'Blood clotting'],
  mpv: ['თრომბოციტის ზომა', 'Platelet size'],
  crp: ['ანთების სწრაფი ნიშანი', 'Fast inflammation sign'],
  esr: ['ანთების ნელი ნიშანი', 'Slow inflammation sign'],
  pt_percent: ['შედედების სიჩქარე', 'Clotting speed'],
  pt_time: ['შედედების სიჩქარე', 'Clotting speed'],
  inr: ['შედედების სიჩქარე', 'Clotting speed'],
  aptt: ['შედედების დრო', 'Clotting time'],
  fibrinogen: ['შედედების ცილა', 'Clotting protein'],
  d_dimer: ['თრომბის კვალი', 'Clot trace'],
  ferritin: ['რკინის მარაგი', 'Iron stores'],
  iron: ['რკინა სისხლში', 'Iron in the blood'],
  tsat: ['რკინით დატვირთვა', 'Iron saturation'],
  transferrin: ['რკინის გადამტანი', 'Iron carrier'],
  tibc: ['რკინის შებოჭვის უნარი', 'Iron binding capacity'],
});
put('heart', {
  cholesterol: ['ქოლესტერინი ჯამში', 'Cholesterol in total'],
  ldl: ['„ცუდი“ ქოლესტერინი', '“Bad” cholesterol'],
  hdl: ['„კარგი“ ქოლესტერინი', '“Good” cholesterol'],
  triglycerides: ['ცხიმი სისხლში', 'Fat in the blood'],
  troponin: ['გულის კუნთის მარკერი', 'Heart muscle marker'],
  ck_mb: ['გულის კუნთის ფერმენტი', 'Heart muscle enzyme'],
  homocysteine: ['სისხლძარღვების მარკერი', 'Blood vessel marker'],
});
put('liver', {
  alt: ['ღვიძლის ფერმენტი', 'Liver enzyme'],
  ast: ['ღვიძლის ფერმენტი', 'Liver enzyme'],
  ggt: ['ღვიძლისა და ნაღვლის ფერმენტი', 'Liver and bile enzyme'],
  alp: ['ღვიძლისა და ძვლის ფერმენტი', 'Liver and bone enzyme'],
  bilirubin: ['ნაღვლის პიგმენტი', 'Bile pigment'],
  bilirubin_direct: ['ნაღვლის პიგმენტი, პირდაპირი', 'Bile pigment, direct'],
  bilirubin_indirect: ['ნაღვლის პიგმენტი, არაპირდაპირი', 'Bile pigment, indirect'],
  total_protein: ['ცილა სისხლში', 'Protein in the blood'],
});
put('sugar', {
  glucose: ['შაქარი სისხლში ახლა', 'Blood sugar right now'],
  hba1c: ['შაქარი ბოლო 3 თვეში', 'Sugar over the last 3 months'],
  insulin: ['შაქრის მართვის ჰორმონი', 'Sugar-control hormone'],
  homa_ir: ['ინსულინისადმი წინააღმდეგობა', 'Insulin resistance'],
  amylase: ['პანკრეასის ფერმენტი', 'Pancreas enzyme'],
  lipase: ['პანკრეასის ფერმენტი', 'Pancreas enzyme'],
});
put('kidney', {
  creatinine: ['თირკმლის ფილტრი', 'Kidney filter'],
  urea: ['ცილის ნარჩენი', 'Protein waste'],
  egfr: ['თირკმლის ფილტრაციის სიჩქარე', 'Kidney filtering speed'],
  uric_acid: ['პოდაგრის მარკერი', 'Gout marker'],
  microalbumin: ['ცილა შარდში', 'Protein in urine'],
  sodium: ['მარილი, ნატრიუმი', 'Salt, sodium'],
  potassium: ['გულისა და კუნთების მარილი', 'Heart and muscle salt'],
  chloride: ['მარილების ბალანსი', 'Salt balance'],
});
put('thyroid', {
  tsh: ['ფარისებრის მართვის სიგნალი', 'Thyroid control signal'],
  free_t4: ['ფარისებრის მთავარი ჰორმონი', 'Main thyroid hormone'],
  t4: ['ფარისებრის მთავარი ჰორმონი', 'Main thyroid hormone'],
  free_t3: ['ფარისებრის აქტიური ჰორმონი', 'Active thyroid hormone'],
  t3: ['ფარისებრის აქტიური ჰორმონი', 'Active thyroid hormone'],
  anti_tpo: ['ფარისებრის ანტისხეულები', 'Thyroid antibodies'],
  anti_tg: ['ფარისებრის ანტისხეულები', 'Thyroid antibodies'],
});
put('hormones', {
  testosterone: ['ძალისა და ლიბიდოს ჰორმონი', 'Strength and libido hormone'],
  estradiol: ['ქალის მთავარი ჰორმონი', 'Main female hormone'],
  progesterone: ['ციკლის მეორე ნახევრის ჰორმონი', 'Second-half cycle hormone'],
  fsh: ['სასქესო ჯირკვლების სიგნალი', 'Signal to the ovaries or testes'],
  lh: ['სასქესო ჯირკვლების სიგნალი', 'Signal to the ovaries or testes'],
  prolactin: ['რძის ჰორმონი', 'Milk hormone'],
  amh: ['კვერცხუჯრედების მარაგი', 'Egg reserve'],
  cortisol: ['სტრესის ჰორმონი', 'Stress hormone'],
});
put('vitamins', {
  vitamin_d: ['ძვლები და იმუნიტეტი', 'Bones and immunity'],
  vitamin_b12: ['ნერვები და სისხლი', 'Nerves and blood'],
  folate: ['უჯრედების განახლება', 'Cell renewal'],
  zinc: ['იმუნიტეტი და კანი', 'Immunity and skin'],
  calcium: ['ძვლები და კუნთები', 'Bones and muscles'],
  phosphorus: ['ძვლები და ენერგია', 'Bones and energy'],
  magnesium: ['კუნთები და ნერვები', 'Muscles and nerves'],
});
put('markers', {
  psa: ['პროსტატის მარკერი', 'Prostate marker'],
  free_psa: ['პროსტატის მარკერი', 'Prostate marker'],
  cea: ['სპეციალური მარკერი', 'Special marker'],
  afp: ['სპეციალური მარკერი', 'Special marker'],
  ca125: ['სპეციალური მარკერი', 'Special marker'],
  ca199: ['სპეციალური მარკერი', 'Special marker'],
  ca153: ['სპეციალური მარკერი', 'Special marker'],
  rheumatoid_factor: ['სახსრების ანთების მარკერი', 'Joint inflammation marker'],
});
put('other', {
  ldh: ['ქსოვილის ფერმენტი', 'Tissue enzyme'],
  cpk: ['კუნთის ფერმენტი', 'Muscle enzyme'],
});

export function labSystemOf(key: string): LabSystemId {
  return SYSTEM_OF[key] ?? 'other';
}

/** Plain-language name of a canonical key, or null when we have none (the printed name stays). */
export function labPlainName(key: string): string | null {
  const plain = PLAIN[key];
  return plain ? tx(plain[0], plain[1]) : null;
}

export function labSystemName(id: LabSystemId): string {
  switch (id) {
    case 'blood': return tx('სისხლი და რკინა', 'Blood and iron');
    case 'heart': return tx('გული და ქოლესტერინი', 'Heart and cholesterol');
    case 'liver': return tx('ღვიძლი', 'Liver');
    case 'sugar': return tx('შაქარი და პანკრეასი', 'Sugar and pancreas');
    case 'kidney': return tx('თირკმელი და მარილები', 'Kidneys and salts');
    case 'thyroid': return tx('ფარისებრი ჯირკვალი', 'Thyroid');
    case 'hormones': return tx('ჰორმონები', 'Hormones');
    case 'vitamins': return tx('ვიტამინები და მინერალები', 'Vitamins and minerals');
    case 'markers': return tx('სპეციალური მარკერები', 'Special markers');
    default: return tx('სხვა მაჩვენებლები', 'Other values');
  }
}

export type LabBodyGender = 'MALE' | 'FEMALE';

export type LabTone = 'ok' | 'warn' | 'unknown';

export function flagTone(flag: LabFlag): LabTone {
  return flag === 'H' || flag === 'L' ? 'warn' : flag === 'N' ? 'ok' : 'unknown';
}

/** The range the bar can draw: a 0 lower bound means „only an upper limit“ (e.g. LDL < 3.0). */
export function labBounds(p: Pick<LabParameter, 'refLow' | 'refHigh'>): { low: number | null; high: number | null } | null {
  const low = p.refLow != null && Number.isFinite(p.refLow) && p.refLow > 0 ? p.refLow : null;
  const high = p.refHigh != null && Number.isFinite(p.refHigh) ? p.refHigh : null;
  if (low == null && high == null) return null;
  if (low != null && high != null && high <= low) return null;
  return { low, high };
}

/** „ნორმაში“, „ოდნავ დაბალი“, „მაღალი“ … — the one word under the name. */
export function labStatusWord(p: Pick<LabParameter, 'value' | 'flag' | 'refLow' | 'refHigh'>): string {
  if (p.flag === 'N') return tx('ნორმაში', 'In range');
  if (p.flag === 'U') return tx('ნორმა უცნობია', 'No range');
  const b = labBounds(p);
  if (p.flag === 'L') {
    const slight = b?.low != null && Number.isFinite(p.value) && p.value < b.low && (b.low - p.value) / b.low < 0.1;
    return slight ? tx('ოდნავ დაბალი', 'Slightly low') : tx('დაბალი', 'Low');
  }
  const slight = b?.high != null && b.high > 0 && Number.isFinite(p.value) && p.value > b.high && (p.value - b.high) / b.high < 0.15;
  return slight ? tx('ოდნავ მაღალი', 'Slightly high') : tx('მაღალი', 'High');
}

/**
 * The ruler's zones and the dot. Two-sided: low 22 % · normal 56 % · high 22 %. Upper limit only:
 * normal 78 % · high 22 %. Lower limit only: low 22 % · normal 78 %. The dot stays on the bar.
 */
export type LabRuler = { lowZone: number; highZone: number; at: number };
export function labRuler(value: number, bounds: { low: number | null; high: number | null }): LabRuler {
  const { low, high } = bounds;
  let lowZone = 0;
  let highZone = 0;
  let at: number;
  if (low != null && high != null) {
    lowZone = 0.22;
    highZone = 0.22;
    at = 0.22 + ((value - low) / (high - low)) * 0.56;
  } else if (high != null) {
    highZone = 0.22;
    at = high > 0 ? (value / high) * 0.78 : 0.5;
  } else {
    lowZone = 0.22;
    const l = low as number;
    at = value < l ? (value / l) * 0.22 : 0.22 + Math.min(1, (value - l) / l) * 0.6;
  }
  return { lowZone, highZone, at: Math.min(0.97, Math.max(0.03, at)) };
}

/** How far a value sits outside its range, relative to the bound it crossed (0 = inside). */
function outside(value: number, bounds: { low: number | null; high: number | null }): number {
  const { low, high } = bounds;
  if (low != null && value < low) return (low - value) / Math.abs(low);
  if (high != null && value > high) return (value - high) / Math.max(Math.abs(high), 1e-6);
  return 0;
}

export type LabChangeKind = 'back-in-range' | 'left-range' | 'closer' | 'further';
export type LabChange = {
  key: string;
  kind: LabChangeKind;
  better: boolean;
  prev: number;
  prevDisplay: string;
  last: LabParameter;
};
export type LabComparison = {
  prevDate: string;
  changes: LabChange[];
  better: number;
  worse: number;
  steady: number;
};

/**
 * „რა შეიცვალა“: this test against the one before it. A value counts as better when it moves into
 * or toward its range, worse when it leaves or moves away; values that stay inside are steady.
 */
export function compareLabTests(
  current: LabParameter[],
  previous: LabParameter[],
  prevDate: string,
): LabComparison | null {
  const before = new Map(previous.map((row) => [row.key, row]));
  const changes: LabChange[] = [];
  let shared = 0;
  for (const row of current) {
    const old = before.get(row.key);
    if (!old || !Number.isFinite(row.value) || !Number.isFinite(old.value)) continue;
    shared += 1;
    const bounds = labBounds(row) ?? labBounds(old);
    const wasOff = bounds ? outside(old.value, bounds) > 0 : flagTone(old.flag) === 'warn';
    const isOff = bounds ? outside(row.value, bounds) > 0 : flagTone(row.flag) === 'warn';
    let kind: LabChangeKind | null = null;
    if (wasOff && !isOff) kind = 'back-in-range';
    else if (!wasOff && isOff) kind = 'left-range';
    else if (wasOff && isOff && bounds) {
      const a = outside(old.value, bounds);
      const b = outside(row.value, bounds);
      if (Math.abs(b - a) >= 0.02) kind = b < a ? 'closer' : 'further';
    }
    if (!kind) continue;
    changes.push({
      key: row.key,
      kind,
      better: kind === 'back-in-range' || kind === 'closer',
      prev: old.value,
      prevDisplay: old.display || String(old.value),
      last: row,
    });
  }
  if (!shared) return null;
  const rank: Record<LabChangeKind, number> = { 'left-range': 0, further: 1, 'back-in-range': 2, closer: 3 };
  changes.sort((a, b) => rank[a.kind] - rank[b.kind]);
  const better = changes.filter((c) => c.better).length;
  const worse = changes.length - better;
  return { prevDate, changes, better, worse, steady: shared - changes.length };
}

export function labChangeLine(kind: LabChangeKind): string {
  switch (kind) {
    case 'back-in-range': return tx('ნორმაში დაბრუნდა', 'Back in range');
    case 'left-range': return tx('ნორმიდან გავიდა', 'Left the range');
    case 'closer': return tx('ნორმას უახლოვდება', 'Moving toward the range');
    default: return tx('ნორმას შორდება', 'Moving away from the range');
  }
}

export type LabSystemGroup<T extends LabParameter = LabParameter> = { id: LabSystemId; rows: T[]; off: number; tone: LabTone };

/** Values grouped by system: systems with something outside first, rows outside first inside each. */
export function groupLabBySystem<T extends LabParameter>(rows: T[]): LabSystemGroup<T>[] {
  const map = new Map<LabSystemId, T[]>();
  for (const row of rows) {
    const id = labSystemOf(row.key);
    map.set(id, [...(map.get(id) ?? []), row]);
  }
  const offOf = (r: LabParameter) => (flagTone(r.flag) === 'warn' ? 1 : 0);
  return LAB_SYSTEM_ORDER.filter((id) => map.has(id))
    .map((id) => {
      const list = map.get(id)!;
      const sorted = list.map((row, i) => ({ row, i })).sort((a, b) => offOf(b.row) - offOf(a.row) || a.i - b.i).map(({ row }) => row);
      const off = list.filter((r) => offOf(r)).length;
      const tone: LabTone = off ? 'warn' : list.some((r) => r.flag === 'N') ? 'ok' : 'unknown';
      return { id, rows: sorted, off, tone };
    })
    .sort((a, b) => Number(b.off > 0) - Number(a.off > 0) || LAB_SYSTEM_ORDER.indexOf(a.id) - LAB_SYSTEM_ORDER.indexOf(b.id));
}
