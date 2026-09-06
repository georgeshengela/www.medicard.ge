/** Printed-name / OCR aliases → canonical keys used by /lab charts. */
const ALIASES: Record<string, string> = {
  hemoglobin: 'hemoglobin',
  hemoglobine: 'hemoglobin',
  hgb: 'hemoglobin',
  hb: 'hemoglobin',
  wbc: 'wbc',
  leukocytes: 'wbc',
  leucocytes: 'wbc',
  rbc: 'rbc',
  erythrocytes: 'rbc',
  hematies: 'rbc',
  hematie: 'rbc',
  hct: 'hct',
  hematocrit: 'hct',
  hematocrite: 'hct',
  plt: 'plt',
  platelets: 'plt',
  plaquettes: 'plt',
  glucose: 'glucose',
  glycemie: 'glucose',
  creatinine: 'creatinine',
  creatininemie: 'creatinine',
  urea: 'urea',
  uree: 'urea',
  uremie: 'urea',
  alt: 'alt',
  alat: 'alt',
  tgp: 'alt',
  'tgp alat': 'alt',
  transaminase_alat: 'alt',
  ast: 'ast',
  asat: 'ast',
  tgo: 'ast',
  transaminase_asat: 'ast',
  tsh: 'tsh',
  cholesterol: 'cholesterol',
  'total cholesterol': 'cholesterol',
  'cholesterol total': 'cholesterol',
  totalcholesterol: 'cholesterol',
  cholesterol_total: 'cholesterol',
  chol: 'cholesterol',
  tc: 'cholesterol',
  ldl: 'ldl',
  'ldl c': 'ldl',
  'ldl cholesterol': 'ldl',
  ldlc: 'ldl',
  hdl: 'hdl',
  'hdl c': 'hdl',
  'hdl cholesterol': 'hdl',
  hdlc: 'hdl',
  triglycerides: 'triglycerides',
  triglyceride: 'triglycerides',
  trigly: 'triglycerides',
  tg: 'triglycerides',
  ferritin: 'ferritin',
  ferritine: 'ferritin',
  vitamin_d: 'vitamin_d',
  'vitamin d': 'vitamin_d',
  vitamine_d: 'vitamin_d',
  '25 oh': 'vitamin_d',
  '25-oh': 'vitamin_d',
  vitamin_b12: 'vitamin_b12',
  vitamine_b12: 'vitamin_b12',
  b12: 'vitamin_b12',
  folate: 'folate',
  'acide folique': 'folate',
  free_t4: 'free_t4',
  t4l: 'free_t4',
  't4 libre': 'free_t4',
  'ft4': 'free_t4',
  ჰემოგლობინი: 'hemoglobin',
  ლეიკოციტები: 'wbc',
  ერითროციტები: 'rbc',
  ჰემატოკრიტი: 'hct',
  თრომბოციტები: 'plt',
  გლუკოზა: 'glucose',
  კრეატინინი: 'creatinine',
  შარდი: 'urea',
  შარდოვანა: 'urea',
  ქოლესტერინი: 'cholesterol',
  'საერთო ქოლესტერინი': 'cholesterol',
  'ქოლესტერინი საერთო': 'cholesterol',
  ტრიგლიცერიდები: 'triglycerides',
  ფერიტინი: 'ferritin',
  'globules rouges': 'rbc',
  'globules blancs': 'wbc',
  vgm: 'mcv',
  'volume globulaire moyen': 'mcv',
  'volume globulaire moyen mcv': 'mcv',
  tcmh: 'mch',
  'teneur moyenne en hb': 'mch',
  'teneur moyenne en hb mch': 'mch',
  'concentration moyenne en hb': 'mchc',
  ccmh: 'mchc',
  idr: 'rdw',
  'indice d anisocytose': 'rdw',
  'indice d anisocytose rdw': 'rdw',
  vpm: 'mpv',
  fer: 'iron',
  'fer serique': 'iron',
  iron: 'iron',
  fe: 'iron',
  'coefficient de saturation': 'tsat',
  'saturation transferrine': 'tsat',
  'saturation de la transferrine': 'tsat',
  tsat: 'tsat',
  kaliemie: 'potassium',
  natremie: 'sodium',
  chloremie: 'chloride',
  chlore: 'chloride',
  chlorures: 'chloride',
  lymphocytes: 'lymphocytes_pct',
  'lymphocytes abs': 'lymphocytes',
  neutrophiles: 'neutrophils_pct',
  'neutrophiles abs': 'neutrophils',
  'polynucleaires neutrophiles': 'neutrophils_pct',
  monocytes: 'monocytes_pct',
  'monocytes abs': 'monocytes',
  eosinophiles: 'eosinophils_pct',
  'eosinophiles abs': 'eosinophils',
  'polynucleaires eosinophiles': 'eosinophils_pct',
  basophiles: 'basophils_pct',
  'basophiles abs': 'basophils',
  'polynucleaires basophiles': 'basophils_pct',
  'ratio neutro lympho': 'nlr',
  'acide urique': 'uric_acid',
  'calcium total': 'calcium',
  phosphore: 'phosphorus',
  magnesium: 'magnesium',
  bilirubine: 'bilirubin',
  'bilirubine totale': 'bilirubin',
  'bilirubine directe': 'bilirubin_direct',
  ldh: 'ldh',
  'phosphatases alcalines': 'alp',
  'phosphatases alcalines totales': 'alp',
  lipase: 'lipase',
  cpk: 'cpk',
  'ck mb masse': 'ck_mb',
  'proteines totales': 'total_protein',
  'taux de prothrombine': 'pt_percent',
  'taux de prothrombine quick': 'pt_percent',
  'temps de prothrombine': 'pt_time',
  'temps de prothrombine quick': 'pt_time',
  'inr ratio': 'inr',
  inr: 'inr',
  dfg: 'egfr',
  'debit de filtration': 'egfr',
  vancomycine: 'vancomycin',
  crp: 'crp',
  'crp us': 'crp',
  'gamma gt': 'ggt',
  ggt: 'ggt',
  mch: 'mch',
  mchc: 'mchc',
  rdw: 'rdw',
  mpv: 'mpv',
  vanc: 'vancomycin',
  vancomycin: 'vancomycin',
  egfr: 'egfr',
  k: 'potassium',
  na: 'sodium',
  cl: 'chloride',
  neu: 'neutrophils',
  lym: 'lymphocytes',
  mon: 'monocytes',
  vs: 'esr',
  'vitesse de sedimentation': 'esr',
  hba1c: 'hba1c',
  'hemoglobine glyquee': 'hba1c',
  gb: 'wbc',
  gr: 'rbc',
  plq: 'plt',
  plaquette: 'plt',
  ht: 'hct',
  hte: 'hct',
  pnn: 'neutrophils_pct',
  pn: 'neutrophils_pct',
  pne: 'eosinophils_pct',
  pnb: 'basophils_pct',
  pal: 'alp',
  cst: 'tsat',
  'crp us': 'crp',
  crpus: 'crp',
  dfge: 'egfr',
  'ckd epi': 'egfr',
  ckdepi: 'egfr',
  'idr cv': 'rdw',
  idrcv: 'rdw',
};

const FAMILY: Record<string, { pct: string; abs: string }> = {
  lymphocytes: { pct: 'lymphocytes_pct', abs: 'lymphocytes' },
  lymphocytes_pct: { pct: 'lymphocytes_pct', abs: 'lymphocytes' },
  neutrophiles: { pct: 'neutrophils_pct', abs: 'neutrophils' },
  neutrophils: { pct: 'neutrophils_pct', abs: 'neutrophils' },
  neutrophils_pct: { pct: 'neutrophils_pct', abs: 'neutrophils' },
  monocytes: { pct: 'monocytes_pct', abs: 'monocytes' },
  monocytes_pct: { pct: 'monocytes_pct', abs: 'monocytes' },
  eosinophiles: { pct: 'eosinophils_pct', abs: 'eosinophils' },
  eosinophils: { pct: 'eosinophils_pct', abs: 'eosinophils' },
  eosinophils_pct: { pct: 'eosinophils_pct', abs: 'eosinophils' },
  basophiles: { pct: 'basophils_pct', abs: 'basophils' },
  basophils: { pct: 'basophils_pct', abs: 'basophils' },
  basophils_pct: { pct: 'basophils_pct', abs: 'basophils' },
};

const PCT_HINT = /%|pct|pourcent/;
const ABS_HINT = /\babs\b|absolu|g\/l|10\s*\^?\s*9|10e9|\/µl|\/ul|\/mm|10\^3/;

function foldLabText(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\[.*?\]/g, ' ')
    .replace(/[^a-z0-9\u10A0-\u10FF\u0400-\u04FF]+/gi, ' ')
    .trim();
}

function aliasLookup(compact: string): string | undefined {
  if (!compact) return undefined;
  const underscored = compact.replace(/\s+/g, '_');
  if (ALIASES[compact]) return ALIASES[compact];
  if (ALIASES[underscored]) return ALIASES[underscored];
  const parts = compact.split(/\s+/).filter(Boolean);
  for (let i = parts.length; i >= 2; i -= 1) {
    const slice = parts.slice(0, i).join(' ');
    const hit = ALIASES[slice] ?? ALIASES[slice.replace(/\s+/g, '_')];
    if (hit) return hit;
  }
  return ALIASES[parts[0] ?? ''];
}

function applyUnitFamily(key: string, compact: string, unit: string): string {
  const family = FAMILY[key] ?? FAMILY[compact.split(/\s+/)[0] ?? ''];
  if (!family) return key;
  const hint = `${compact} ${unit}`;
  if (ABS_HINT.test(hint)) return family.abs;
  if (PCT_HINT.test(hint)) return family.pct;
  return key;
}

export function slugLabKey(raw: string, unit = ''): string {
  const compact = foldLabText(raw);
  const underscored = compact.replace(/\s+/g, '_');
  const aliased = aliasLookup(compact) ?? underscored.slice(0, 48) ?? 'analyte';
  return applyUnitFamily(aliased, compact, foldLabText(unit));
}
