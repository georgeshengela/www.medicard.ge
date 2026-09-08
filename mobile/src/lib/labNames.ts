import type { LabPanel, LabParameter } from '@/types/lab';
import { slugLabKey } from './labKeys.ts';

type LabTitle = { nameKa: string; nameEn: string };

export const LAB_TITLE_CATALOG: Record<string, LabTitle> = {
  hemoglobin: { nameKa: 'ჰემოგლობინი', nameEn: 'Hemoglobin' },
  hct: { nameKa: 'ჰემატოკრიტი', nameEn: 'Hematocrit' },
  rbc: { nameKa: 'ერითროციტები', nameEn: 'RBC' },
  wbc: { nameKa: 'ლეიკოციტები', nameEn: 'WBC' },
  plt: { nameKa: 'თრომბოციტები', nameEn: 'Platelets' },
  mcv: { nameKa: 'საშუალო ერითროციტული მოცულობა', nameEn: 'MCV' },
  mch: { nameKa: 'საშუალო ერითროციტული ჰემოგლობინი', nameEn: 'MCH' },
  mchc: { nameKa: 'ჰემოგლობინის კონცენტრაცია', nameEn: 'MCHC' },
  rdw: { nameKa: 'ერითროციტების განაწილების სიგანე', nameEn: 'RDW' },
  mpv: { nameKa: 'თრომბოციტების საშუალო მოცულობა', nameEn: 'MPV' },
  iron: { nameKa: 'რკინა', nameEn: 'Serum iron' },
  tsat: { nameKa: 'ტრანსფერინის სატურაცია', nameEn: 'TSAT' },
  ferritin: { nameKa: 'ფერიტინი', nameEn: 'Ferritin' },
  ast: { nameKa: 'ასპარტატამინოტრანსფერაზა', nameEn: 'AST' },
  alt: { nameKa: 'ალანინამინოტრანსფერაზა', nameEn: 'ALT' },
  ggt: { nameKa: 'გამა-გლუტამილტრანსფერაზა', nameEn: 'GGT' },
  alp: { nameKa: 'ტუტე ფოსფატაზა', nameEn: 'ALP' },
  crp: { nameKa: 'C-რეაქტიული ცილა', nameEn: 'CRP' },
  potassium: { nameKa: 'კალიუმი', nameEn: 'Potassium' },
  sodium: { nameKa: 'ნატრიუმი', nameEn: 'Sodium' },
  chloride: { nameKa: 'ქლორიდი', nameEn: 'Chloride' },
  glucose: { nameKa: 'გლუკოზა', nameEn: 'Glucose' },
  creatinine: { nameKa: 'კრეატინინი', nameEn: 'Creatinine' },
  urea: { nameKa: 'შარდოვანა', nameEn: 'Urea' },
  egfr: { nameKa: 'თირკმლის ფილტრაციის სიჩქარე', nameEn: 'eGFR' },
  vancomycin: { nameKa: 'ვანკომიცინი', nameEn: 'Vancomycin' },
  lymphocytes: { nameKa: 'ლიმფოციტები', nameEn: 'Lymphocytes' },
  lymphocytes_pct: { nameKa: 'ლიმფოციტები', nameEn: 'Lymphocytes %' },
  neutrophils: { nameKa: 'ნეიტროფილები', nameEn: 'Neutrophils' },
  neutrophils_pct: { nameKa: 'ნეიტროფილები', nameEn: 'Neutrophils %' },
  monocytes: { nameKa: 'მონოციტები', nameEn: 'Monocytes' },
  monocytes_pct: { nameKa: 'მონოციტები', nameEn: 'Monocytes %' },
  eosinophils_pct: { nameKa: 'ეოზინოფილები', nameEn: 'Eosinophils %' },
  nlr: { nameKa: 'ნეიტროფილ/ლიმფოციტთა თანაფარდობა', nameEn: 'NLR' },
  bilirubin: { nameKa: 'ბილირუბინი', nameEn: 'Bilirubin' },
  total_protein: { nameKa: 'საერთო ცილა', nameEn: 'Total protein' },
  cholesterol: { nameKa: 'საერთო ქოლესტერინი', nameEn: 'Cholesterol' },
  ldl: { nameKa: 'LDL ქოლესტერინი', nameEn: 'LDL' },
  hdl: { nameKa: 'HDL ქოლესტერინი', nameEn: 'HDL' },
  triglycerides: { nameKa: 'ტრიგლიცერიდები', nameEn: 'Triglycerides' },
  tsh: { nameKa: 'თირეოტროპინი', nameEn: 'TSH' },
  vitamin_d: { nameKa: 'ვიტამინი D', nameEn: 'Vitamin D' },
  hba1c: { nameKa: 'გლიკირებული ჰემოგლობინი', nameEn: 'HbA1c' },
  albumin: { nameKa: 'ალბუმინი', nameEn: 'Albumin' },
  calcium: { nameKa: 'კალციუმი', nameEn: 'Calcium' },
  esr: { nameKa: 'ერითროციტების დალექვა', nameEn: 'ESR' },
  uric_acid: { nameKa: 'შარდმჟავა', nameEn: 'Uric acid' },
  phosphorus: { nameKa: 'ფოსფორი', nameEn: 'Phosphorus' },
  magnesium: { nameKa: 'მაგნიუმი', nameEn: 'Magnesium' },
  bilirubin_direct: { nameKa: 'პირდაპირი ბილირუბინი', nameEn: 'Direct bilirubin' },
  ldh: { nameKa: 'ლაქტატდეჰიდროგენაზა', nameEn: 'LDH' },
  lipase: { nameKa: 'ლიპაზა', nameEn: 'Lipase' },
  cpk: { nameKa: 'კრეატინკინაზა', nameEn: 'CPK' },
  ck_mb: { nameKa: 'CK-MB', nameEn: 'CK-MB' },
  inr: { nameKa: 'INR', nameEn: 'INR' },
  basophils: { nameKa: 'ბაზოფილები', nameEn: 'Basophils' },
  basophils_pct: { nameKa: 'ბაზოფილები', nameEn: 'Basophils %' },
  eosinophils: { nameKa: 'ეოზინოფილები', nameEn: 'Eosinophils' },
  pt_percent: { nameKa: 'პროთრომბინის ინდექსი', nameEn: 'Prothrombin %' },
  pt_time: { nameKa: 'პროთრომბინის დრო', nameEn: 'Prothrombin time' },
  vitamin_b12: { nameKa: 'ვიტამინი B12', nameEn: 'Vitamin B12' },
  folate: { nameKa: 'ფოლიუმის მჟავა', nameEn: 'Folate' },
  free_t4: { nameKa: 'თავისუფალი T4', nameEn: 'Free T4' },
  free_t3: { nameKa: 'თავისუფალი T3', nameEn: 'Free T3' },
  t3: { nameKa: 'T3', nameEn: 'T3' },
  t4: { nameKa: 'T4', nameEn: 'T4' },
  anti_tpo: { nameKa: 'Anti-TPO', nameEn: 'Anti-TPO' },
  anti_tg: { nameKa: 'Anti-TG', nameEn: 'Anti-TG' },
  insulin: { nameKa: 'ინსულინი', nameEn: 'Insulin' },
  homa_ir: { nameKa: 'HOMA-IR', nameEn: 'HOMA-IR' },
  cortisol: { nameKa: 'კორტიზოლი', nameEn: 'Cortisol' },
  testosterone: { nameKa: 'ტესტოსტერონი', nameEn: 'Testosterone' },
  estradiol: { nameKa: 'ესტრადიოლი', nameEn: 'Estradiol' },
  fsh: { nameKa: 'FSH', nameEn: 'FSH' },
  lh: { nameKa: 'LH', nameEn: 'LH' },
  prolactin: { nameKa: 'პროლაქტინი', nameEn: 'Prolactin' },
  progesterone: { nameKa: 'პროგესტერონი', nameEn: 'Progesterone' },
  amh: { nameKa: 'AMH', nameEn: 'AMH' },
  psa: { nameKa: 'PSA', nameEn: 'PSA' },
  free_psa: { nameKa: 'თავისუფალი PSA', nameEn: 'Free PSA' },
  amylase: { nameKa: 'ამილაზა', nameEn: 'Amylase' },
  d_dimer: { nameKa: 'D-დიმერი', nameEn: 'D-dimer' },
  fibrinogen: { nameKa: 'ფიბრინოგენი', nameEn: 'Fibrinogen' },
  aptt: { nameKa: 'aPTT', nameEn: 'aPTT' },
  transferrin: { nameKa: 'ტრანსფერინი', nameEn: 'Transferrin' },
  tibc: { nameKa: 'TIBC', nameEn: 'TIBC' },
  troponin: { nameKa: 'ტროპონინი', nameEn: 'Troponin' },
  homocysteine: { nameKa: 'ჰომოცისტეინი', nameEn: 'Homocysteine' },
  microalbumin: { nameKa: 'მიკროალბუმინი', nameEn: 'Microalbumin' },
  cea: { nameKa: 'CEA', nameEn: 'CEA' },
  afp: { nameKa: 'AFP', nameEn: 'AFP' },
  ca125: { nameKa: 'CA-125', nameEn: 'CA-125' },
  ca199: { nameKa: 'CA-19-9', nameEn: 'CA-19-9' },
  ca153: { nameKa: 'CA-15-3', nameEn: 'CA-15-3' },
  rheumatoid_factor: { nameKa: 'რევმატოიდული ფაქტორი', nameEn: 'Rheumatoid factor' },
  zinc: { nameKa: 'თუთია', nameEn: 'Zinc' },
  bilirubin_indirect: { nameKa: 'არაპირდაპირი ბილირუბინი', nameEn: 'Indirect bilirubin' },
};

function hasGeorgian(value: string): boolean {
  return /[\u10A0-\u10FF]/.test(value);
}

export function resolveCanonicalLabKey(
  param: Pick<LabParameter, 'key' | 'nameEn' | 'nameKa'> & { unit?: string },
): string {
  const unit = param.unit ?? '';
  for (const raw of [param.key, param.nameEn, param.nameKa]) {
    if (!raw) continue;
    const slug = slugLabKey(raw, unit);
    if (LAB_TITLE_CATALOG[slug]) return slug;
  }
  return slugLabKey(param.key || param.nameEn || param.nameKa || 'analyte', unit);
}

export function sameLabKey(
  a: Pick<LabParameter, 'key' | 'nameEn' | 'nameKa'> & { unit?: string },
  b: Pick<LabParameter, 'key' | 'nameEn' | 'nameKa'> & { unit?: string },
): boolean {
  return resolveCanonicalLabKey(a) === resolveCanonicalLabKey(b);
}

export function resolveLabTitle(param: Pick<LabParameter, 'key' | 'nameEn' | 'nameKa'>): LabTitle {
  const key = resolveCanonicalLabKey(param);
  const titled = LAB_TITLE_CATALOG[key];
  if (titled) return titled;
  if (hasGeorgian(param.nameKa)) {
    return { nameKa: param.nameKa, nameEn: param.nameEn || param.nameKa };
  }
  return {
    nameKa: param.nameKa || param.nameEn || key,
    nameEn: param.nameEn || param.nameKa || key,
  };
}

export function titledLabParam(param: LabParameter): LabParameter {
  const key = resolveCanonicalLabKey(param);
  const title = resolveLabTitle({ ...param, key });
  return { ...param, key, nameKa: title.nameKa, nameEn: title.nameEn };
}

export function collapseLabParameters(params: LabParameter[]): LabParameter[] {
  const merged = new Map<string, LabParameter>();
  for (const row of params) {
    const canon = titledLabParam(row);
    if (!merged.has(canon.key)) merged.set(canon.key, canon);
  }
  return [...merged.values()];
}

export function titledLabPanel(panel: LabPanel): LabPanel {
  return { ...panel, parameters: collapseLabParameters(panel.parameters) };
}

export function titledLabName(param: Pick<LabParameter, 'key' | 'nameEn' | 'nameKa'>): string {
  return resolveLabTitle(param).nameKa;
}
