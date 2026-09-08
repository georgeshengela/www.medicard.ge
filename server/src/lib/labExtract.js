function parseNumber(raw) {
  const cleaned = String(raw ?? '').replace(',', '.').replace(/[^\d.-]/g, '');
  if (!cleaned || cleaned === '-' || cleaned === '.') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function parseRange(raw) {
  const text = String(raw ?? '').replace(',', '.');
  const match = text.match(/(-?[\d.]+)\s*[-–—]\s*(-?[\d.]+)/);
  if (match) return { low: parseNumber(match[1]), high: parseNumber(match[2]) };
  const maxOnly = text.match(/^\s*[-–—<≤]\s*(-?[\d.]+)\s*$/);
  if (maxOnly) return { low: null, high: parseNumber(maxOnly[1]) };
  const minOnly = text.match(/^(-?[\d.]+)\s*[-–—>≥]\s*$/);
  if (minOnly) return { low: parseNumber(minOnly[1]), high: null };
  const lt = text.match(/[≤<]\s*(-?[\d.]+)/);
  if (lt) return { low: null, high: parseNumber(lt[1]) };
  const gt = text.match(/[≥>]\s*(-?[\d.]+)/);
  if (gt) return { low: parseNumber(gt[1]), high: null };
  return { low: null, high: null };
}

const ALIASES = {
  hemoglobin: 'hemoglobin',
  hemoglobine: 'hemoglobin',
  hémoglobine: 'hemoglobin',
  hgb: 'hemoglobin',
  hb: 'hemoglobin',
  hematocrite: 'hct',
  hématocrite: 'hct',
  hct: 'hct',
  'globules rouges': 'rbc',
  'globules blancs': 'wbc',
  plaquettes: 'plt',
  leukocytes: 'wbc',
  leucocytes: 'wbc',
  hematies: 'rbc',
  hematie: 'rbc',
  erythrocytes: 'rbc',
  glucose: 'glucose',
  glycemie: 'glucose',
  creatinine: 'creatinine',
  créatinine: 'creatinine',
  uree: 'urea',
  urée: 'urea',
  uremie: 'urea',
  creatininemie: 'creatinine',
  ferritine: 'ferritin',
  fer: 'iron',
  'fer serique': 'iron',
  glycemie: 'glucose',
  cholesterol_total: 'cholesterol',
  'cholesterol total': 'cholesterol',
  vitamine_d: 'vitamin_d',
  vitamine_b12: 'vitamin_b12',
  't4 libre': 'free_t4',
  t4l: 'free_t4',
  'hemoglobine glyquee': 'hba1c',
  'vitesse de sedimentation': 'esr',
  vs: 'esr',
  'debit de filtration': 'egfr',
  'phosphatases alcalines': 'alp',
  'polynucleaires neutrophiles': 'neutrophils_pct',
  'saturation transferrine': 'tsat',
  'saturation de la transferrine': 'tsat',
  natremie: 'sodium',
  kaliemie: 'potassium',
  chloremie: 'chloride',
  tgp: 'alt',
  alat: 'alt',
  tgo: 'ast',
  asat: 'ast',
  crp: 'crp',
  'gamma gt': 'ggt',
  inr: 'inr',
  sodium: 'sodium',
  potassium: 'potassium',
  'volume globulaire moyen': 'mcv',
  'volume globulaire moyen mcv': 'mcv',
  vgm: 'mcv',
  'teneur moyenne en hb': 'mch',
  'teneur moyenne en hb mch': 'mch',
  'indice d anisocytose': 'rdw',
  'indice d anisocytose rdw': 'rdw',
  neutrophiles: 'neutrophils_pct',
  'neutrophiles abs': 'neutrophils',
  lymphocytes: 'lymphocytes_pct',
  'lymphocytes abs': 'lymphocytes',
  monocytes: 'monocytes_pct',
  'monocytes abs': 'monocytes',
  eosinophiles: 'eosinophils_pct',
  'eosinophiles abs': 'eosinophils',
  basophiles: 'basophils_pct',
  'basophiles abs': 'basophils',
  'ratio neutro lympho': 'nlr',
  'acide urique': 'uric_acid',
  chlorures: 'chloride',
  'calcium total': 'calcium',
  phosphore: 'phosphorus',
  magnesium: 'magnesium',
  'bilirubine totale': 'bilirubin',
  'bilirubine directe': 'bilirubin_direct',
  'tgp alat': 'alt',
  ldh: 'ldh',
  'phosphatases alcalines totales': 'alp',
  lipase: 'lipase',
  cpk: 'cpk',
  'ck mb masse': 'ck_mb',
  'proteines totales': 'total_protein',
  'taux de prothrombine quick': 'pt_percent',
  'temps de prothrombine quick': 'pt_time',
  'inr ratio': 'inr',
  ft3: 'free_t3',
  't3 libre': 'free_t3',
  insulin: 'insulin',
  insuline: 'insulin',
  cortisol: 'cortisol',
  testosterone: 'testosterone',
  estradiol: 'estradiol',
  oestradiol: 'estradiol',
  prolactin: 'prolactin',
  prolactine: 'prolactin',
  progesterone: 'progesterone',
  psa: 'psa',
  amylase: 'amylase',
  'd dimer': 'd_dimer',
  fibrinogen: 'fibrinogen',
  fibrinogene: 'fibrinogen',
  aptt: 'aptt',
  transferrin: 'transferrin',
  transferrine: 'transferrin',
  tibc: 'tibc',
  troponin: 'troponin',
  troponine: 'troponin',
  homocysteine: 'homocysteine',
  zinc: 'zinc',
  'bilirubine indirecte': 'bilirubin_indirect',
};

const NAME_KA = {
  hemoglobin: 'ჰემოგლობინი',
  hct: 'ჰემატოკრიტი',
  rbc: 'ერითროციტები',
  wbc: 'ლეიკოციტები',
  plt: 'თრომბოციტები',
  glucose: 'გლუკოზა',
  creatinine: 'კრეატინინი',
  urea: 'შარდოვანა',
  alt: 'ALT',
  ast: 'AST',
  crp: 'CRP',
  ggt: 'გამა-გტ',
  inr: 'INR',
  sodium: 'ნატრიუმი',
  potassium: 'კალიუმი',
  mcv: 'საშუალო ერითროციტული მოცულობა',
  mch: 'საშუალო ერითროციტული ჰემოგლობინი',
  mchc: 'ჰემოგლობინის კონცენტრაცია',
  rdw: 'ერითროციტების განაწილების სიგანე',
  mpv: 'თრომბოციტების საშუალო მოცულობა',
  iron: 'რკინა',
  tsat: 'ტრანსფერინის სატურაცია',
  ferritin: 'ფერიტინი',
  vitamin_d: 'ვიტამინი D',
  vitamin_b12: 'ვიტამინი B12',
  folate: 'ფოლიუმის მჟავა',
  free_t4: 'თავისუფალი T4',
  hba1c: 'გლიკირებული ჰემოგლობინი',
  esr: 'ერითროციტების დალექვა',
  albumin: 'ალბუმინი',
  glucose: 'გლუკოზა',
  alt: 'ალანინამინოტრანსფერაზა',
  ast: 'ასპარტატამინოტრანსფერაზა',
  crp: 'C-რეაქტიული ცილა',
  ggt: 'გამა-გლუტამილტრანსფერაზა',
  chloride: 'ქლორიდი',
  calcium: 'კალციუმი',
  uric_acid: 'შარდმჟავა',
  phosphorus: 'ფოსფორი',
  magnesium: 'მაგნიუმი',
  bilirubin: 'ბილირუბინი',
  bilirubin_direct: 'პირდაპირი ბილირუბინი',
  alp: 'ტუტე ფოსფატაზა',
  total_protein: 'საერთო ცილა',
  neutrophils: 'ნეიტროფილები',
  neutrophils_pct: 'ნეიტროფილები',
  lymphocytes: 'ლიმფოციტები',
  lymphocytes_pct: 'ლიმფოციტები',
  monocytes: 'მონოციტები',
  monocytes_pct: 'მონოციტები',
  nlr: 'ნეიტროფილ/ლიმფოციტთა თანაფარდობა',
  inr: 'INR',
  free_t3: 'თავისუფალი T3',
  t3: 'T3',
  t4: 'T4',
  insulin: 'ინსულინი',
  cortisol: 'კორტიზოლი',
  testosterone: 'ტესტოსტერონი',
  estradiol: 'ესტრადიოლი',
  prolactin: 'პროლაქტინი',
  progesterone: 'პროგესტერონი',
  psa: 'PSA',
  amylase: 'ამილაზა',
  d_dimer: 'D-დიმერი',
  fibrinogen: 'ფიბრინოგენი',
  transferrin: 'ტრანსფერინი',
  troponin: 'ტროპონინი',
  homocysteine: 'ჰომოცისტეინი',
  zinc: 'თუთია',
};

function tidyUnit(unit) {
  const u = String(unit ?? '').replace(/\s+/g, '');
  if (!u) return '';
  if (u === '%%') return '%';
  if (u === 'ss') return 's';
  const lower = u.toLowerCase();
  const half = Math.floor(u.length / 2);
  if (half >= 2 && lower.slice(0, half) === lower.slice(half)) return u.slice(half);
  return u;
}

function slugKey(raw) {
  const compact = String(raw)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\[.*?\]/g, ' ')
    .replace(/[^a-z0-9\u10A0-\u10FF]+/gi, ' ')
    .trim();
  const first = compact.split(/\s+/)[0] ?? compact;
  const aliased = ALIASES[compact] ?? ALIASES[compact.replace(/\s+/g, '_')] ?? ALIASES[first];
  return aliased || compact.replace(/\s+/g, '_').slice(0, 48) || 'analyte';
}

function flagFrom(raw, value, low, high) {
  const letter = String(raw).trim().toUpperCase();
  if (letter.startsWith('H') || letter.includes('HIGH') || letter.includes('↑')) return 'H';
  if (letter.startsWith('L') || letter.includes('LOW') || letter.includes('↓')) return 'L';
  if (letter.startsWith('N') || letter.includes('NORM')) return 'N';
  if (low != null && value < low) return 'L';
  if (high != null && value > high) return 'H';
  if (low != null || high != null) return 'N';
  return 'U';
}

function normalizeLooseDate(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const iso = raw.trim().match(/(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
  const eu = raw.trim().match(/(\d{1,2})[-./](\d{1,2})[-./](\d{4})/);
  if (eu) return `${eu[3]}-${eu[2].padStart(2, '0')}-${eu[1].padStart(2, '0')}`;
  return null;
}

function parseDotSeparatedLab(text) {
  const rows = [];
  const skip =
    /^(biologie|date de|contenu|descriptif|hematologie|hemato|hemostase|biochimie|end\.?$|file:|https?:|non r[eé]alis|commentaire|l'ekfc|marqueurs|inflammation|proteines|glucides|tests globaux|hemogramme|\d+\/\d+$)/i;

  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.replace(/^[\s.]+/, '').trim();
    if (!line || skip.test(line) || !/\d/.test(line)) continue;
    const cells = line
      .split(/\.\s+/)
      .map((cell) => cell.replace(/^\.+|\.+$/g, '').trim())
      .filter(Boolean);
    if (cells.length < 3) continue;

    let name = cells[0];
    let idx = 1;
    let flag = '';
    if (cells[1] === '+' || cells[1] === '-') {
      flag = cells[1];
      idx = 2;
    }
    const valueRaw = cells[idx];
    if (valueRaw == null || !/^\d+(?:[.,]\d+)?$/.test(String(valueRaw).trim())) continue;
    if (/analyte|descriptif|valeur|norme|contenu/i.test(name) || name.length < 2 || name.length > 80) continue;

    const value = parseNumber(valueRaw);
    const unit = tidyUnit(cells[idx + 1] ?? '');
    const range = cells.slice(idx + 2).join(' ');
    const { low, high } = parseRange(range);
    const key = slugKey(name);
    rows.push({
      key,
      nameKa: NAME_KA[key] || name,
      nameEn: name,
      value,
      display: String(valueRaw).trim(),
      unit,
      refLow: low,
      refHigh: high,
      flag: flagFrom(flag === '+' ? 'H' : flag === '-' ? 'L' : flag, value, low, high),
    });
  }
  return rows;
}

function parsePipeTable(text) {
  const rows = [];
  for (const line of String(text).split(/\r?\n/)) {
    if (!line.includes('|')) continue;
    const cells = line
      .replace(/^ANALYTE\s*/i, '')
      .split('|')
      .map((cell) => cell.trim())
      .filter((cell, i, all) => !(i === 0 && cell === '') && !(i === all.length - 1 && cell === ''));
    if (cells.length < 3) continue;
    if (/analyte|---/i.test(cells[0])) continue;
    const value = parseNumber(cells[1]);
    if (value == null || /unread|illegib/i.test(cells[1])) continue;
    const { low, high } = parseRange(cells[3] ?? '');
    const name = cells[0];
    const key = slugKey(name);
    rows.push({
      key,
      nameKa: NAME_KA[key] || name,
      nameEn: name,
      value,
      display: cells[1].trim() || String(value),
      unit: cells[2] ?? '',
      refLow: low,
      refHigh: high,
      flag: flagFrom(cells[4] ?? '', value, low, high),
    });
  }
  return rows;
}

function parseLabJson(text) {
  const block = String(text).match(/```(?:labjson|json)\s*([\s\S]*?)```/i);
  const raw = block?.[1] ?? String(text).match(/\{\s*"parameters"\s*:\s*\[[\s\S]*?\]\s*\}/)?.[0];
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const parameters = (parsed.parameters ?? [])
      .map((row) => {
        const value = typeof row.value === 'number' ? row.value : parseNumber(row.value ?? row.display);
        if (value == null) return null;
        const nameKa = String(row.nameKa ?? row.name ?? '');
        const nameEn = String(row.nameEn ?? row.name ?? nameKa);
        const refLow = typeof row.refLow === 'number' ? row.refLow : parseNumber(row.refLow);
        const refHigh = typeof row.refHigh === 'number' ? row.refHigh : parseNumber(row.refHigh);
        const key = slugKey(row.key ?? nameEn ?? nameKa);
        return {
          key,
          nameKa: NAME_KA[key] || nameKa || nameEn,
          nameEn: nameEn || nameKa,
          value,
          display: String(row.display ?? value),
          unit: String(row.unit ?? ''),
          refLow,
          refHigh,
          flag: flagFrom(row.flag ?? '', value, refLow, refHigh),
        };
      })
      .filter(Boolean);
    return { date: normalizeLooseDate(parsed.date) ?? null, parameters };
  } catch {
    return null;
  }
}

export function extractLabFromText(...parts) {
  const text = parts.filter(Boolean).join('\n\n');
  const fromJson = parseLabJson(text);
  const fromTable = parsePipeTable(text);
  const fromDots = parseDotSeparatedLab(text);
  const merged = new Map();
  for (const row of [...(fromJson?.parameters ?? []), ...fromTable, ...fromDots]) merged.set(row.key, row);
  const labeled = text.match(
    /(?:date|collected|biologie|თარიღ|გაკეთდ)[^\d]{0,40}(\d{1,4}[-./]\d{1,2}[-./]\d{1,4})/i,
  );
  const any = text.match(/\b(\d{4}[-./]\d{1,2}[-./]\d{1,2}|\d{1,2}[-./]\d{1,2}[-./]\d{4})\b/);
  return {
    date: fromJson?.date ?? normalizeLooseDate(labeled?.[1] ?? any?.[1] ?? '') ?? null,
    parameters: [...merged.values()],
  };
}
