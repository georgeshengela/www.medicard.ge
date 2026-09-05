import OpenAI from 'openai';
import { env } from '../config/env.js';
import { AiEngineError } from './evidencemd.js';

const CATALOG = {
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
  eosinophils: { nameKa: 'ეოზინოფილები', nameEn: 'Eosinophils' },
  eosinophils_pct: { nameKa: 'ეოზინოფილები', nameEn: 'Eosinophils %' },
  basophils: { nameKa: 'ბაზოფილები', nameEn: 'Basophils' },
  basophils_pct: { nameKa: 'ბაზოფილები', nameEn: 'Basophils %' },
  nlr: { nameKa: 'ნეიტროფილ/ლიმფოციტთა თანაფარდობა', nameEn: 'NLR' },
  bilirubin: { nameKa: 'ბილირუბინი', nameEn: 'Bilirubin' },
  bilirubin_direct: { nameKa: 'პირდაპირი ბილირუბინი', nameEn: 'Direct bilirubin' },
  total_protein: { nameKa: 'საერთო ცილა', nameEn: 'Total protein' },
  cholesterol: { nameKa: 'საერთო ქოლესტერინი', nameEn: 'Cholesterol' },
  ldl: { nameKa: 'LDL ქოლესტერინი', nameEn: 'LDL' },
  hdl: { nameKa: 'HDL ქოლესტერინი', nameEn: 'HDL' },
  triglycerides: { nameKa: 'ტრიგლიცერიდები', nameEn: 'Triglycerides' },
  tsh: { nameKa: 'თირეოტროპინი', nameEn: 'TSH' },
  free_t4: { nameKa: 'თავისუფალი T4', nameEn: 'Free T4' },
  vitamin_d: { nameKa: 'ვიტამინი D', nameEn: 'Vitamin D' },
  vitamin_b12: { nameKa: 'ვიტამინი B12', nameEn: 'Vitamin B12' },
  folate: { nameKa: 'ფოლიუმის მჟავა', nameEn: 'Folate' },
  hba1c: { nameKa: 'გლიკირებული ჰემოგლობინი', nameEn: 'HbA1c' },
  albumin: { nameKa: 'ალბუმინი', nameEn: 'Albumin' },
  calcium: { nameKa: 'კალციუმი', nameEn: 'Calcium' },
  esr: { nameKa: 'ერითროციტების დალექვა', nameEn: 'ESR' },
  uric_acid: { nameKa: 'შარდმჟავა', nameEn: 'Uric acid' },
  phosphorus: { nameKa: 'ფოსფორი', nameEn: 'Phosphorus' },
  magnesium: { nameKa: 'მაგნიუმი', nameEn: 'Magnesium' },
  ldh: { nameKa: 'ლაქტატდეჰიდროგენაზა', nameEn: 'LDH' },
  lipase: { nameKa: 'ლიპაზა', nameEn: 'Lipase' },
  cpk: { nameKa: 'კრეატინკინაზა', nameEn: 'CPK' },
  ck_mb: { nameKa: 'CK-MB', nameEn: 'CK-MB' },
  inr: { nameKa: 'INR', nameEn: 'INR' },
  pt_percent: { nameKa: 'პროთრომბინის ინდექსი', nameEn: 'Prothrombin %' },
  pt_time: { nameKa: 'პროთრომბინის დრო', nameEn: 'Prothrombin time' },
};

const openrouter = env.OPENROUTER_API_KEY
  ? new OpenAI({
      apiKey: env.OPENROUTER_API_KEY,
      baseURL: env.OPENROUTER_BASE_URL,
      timeout: 90_000,
      maxRetries: 1,
      defaultHeaders: {
        'HTTP-Referer': 'https://medicard.ge',
        'X-Title': 'Medicard.GE',
      },
    })
  : null;

function titleOf(key) {
  return CATALOG[key] ?? null;
}

function uniqueAnalytes(rows) {
  const seen = new Map();
  for (const row of rows) {
    const key = String(row.key ?? '').trim();
    if (!key || seen.has(key)) continue;
    seen.set(key, {
      key,
      nameKa: String(row.nameKa ?? '').trim(),
      nameEn: String(row.nameEn ?? '').trim(),
      unit: String(row.unit ?? '').trim(),
    });
  }
  return [...seen.values()];
}

function parseMaps(raw) {
  const text = String(raw ?? '')
    .replace(/^```json?\s*/i, '')
    .replace(/```\s*$/, '')
    .trim();
  const parsed = JSON.parse(text);
  const list = Array.isArray(parsed?.maps) ? parsed.maps : [];
  return list
    .map((row) => ({
      from: String(row.from ?? row.key ?? '').trim(),
      to: String(row.to ?? '').trim(),
    }))
    .filter((row) => row.from && row.to && titleOf(row.to));
}

async function askOpenRouter(unknowns) {
  if (!openrouter) {
    throw new AiEngineError('სახელების შემოწმების სერვისი არ არის კონფიგურირებული.', { status: 503 });
  }
  const catalogLines = Object.entries(CATALOG)
    .map(([key, title]) => `${key} | ${title.nameKa} | ${title.nameEn}`)
    .join('\n');
  const unknownLines = unknowns
    .map((row) => `${row.key} | ${row.nameKa || '—'} | ${row.nameEn || '—'} | ${row.unit || ''}`)
    .join('\n');

  const completion = await openrouter.chat.completions.create({
    model: env.OPENROUTER_MODEL,
    temperature: 0,
    max_tokens: 2500,
    messages: [
      {
        role: 'system',
        content: `You are Medicard.GE's laboratory analyte aligner. Map printed names (French, Georgian, English, OCR) onto a closed catalog. Output ONLY JSON:
{"maps":[{"from":"hemoglobine","to":"hemoglobin"}]}
Rules:
- "to" MUST be a catalog key, or omit the row.
- Never invent numeric lab values. Names only.
- % / pourcent / pct → *_pct keys. G/L, 10^9, abs → absolute keys.
- fer serique → iron. ferritine → ferritin. Never swap those two.
- Do not map two different catalog keys onto each other.
- If unsure, omit the row.`,
      },
      {
        role: 'user',
        content: `CATALOG (key | Georgian | English):\n${catalogLines}\n\nUNKNOWN ANALYTES (key | nameKa | nameEn | unit):\n${unknownLines}`,
      },
    ],
  });

  const content = completion.choices?.[0]?.message?.content ?? '';
  let maps = [];
  try {
    maps = parseMaps(content);
  } catch {
    maps = [];
  }
  return {
    maps,
    model: completion.model ?? env.OPENROUTER_MODEL,
    content,
    usage: completion.usage ?? null,
  };
}

export async function alignLabAnalytes(rows) {
  const analytes = uniqueAnalytes(rows);
  const maps = [];
  const unknown = [];

  for (const row of analytes) {
    if (titleOf(row.key)) {
      maps.push({
        from: row.key,
        to: row.key,
        nameKa: CATALOG[row.key].nameKa,
        nameEn: CATALOG[row.key].nameEn,
        source: 'catalog',
      });
      continue;
    }
    unknown.push(row);
  }

  let model = env.OPENROUTER_MODEL;
  let engine = 'local';
  let raw = '';
  let tokenUsage = null;

  if (unknown.length) {
    const ai = await askOpenRouter(unknown);
    model = ai.model;
    engine = 'openrouter';
    raw = ai.content;
    tokenUsage = ai.usage;
    const used = new Set();
    for (const hit of ai.maps) {
      if (used.has(hit.from)) continue;
      used.add(hit.from);
      const title = titleOf(hit.to);
      maps.push({
        from: hit.from,
        to: hit.to,
        nameKa: title.nameKa,
        nameEn: title.nameEn,
        source: 'ai',
      });
    }
  }

  const remapped = new Set(maps.filter((row) => row.from !== row.to).map((row) => row.from));
  const leftover = unknown.filter((row) => !remapped.has(row.key));
  const joined = remapped.size;
  const already = maps.filter((row) => row.from === row.to && row.source === 'catalog').length;

  return {
    maps: maps.map(({ from, to, nameKa, nameEn }) => ({ from, to, nameKa, nameEn })),
    joined,
    already,
    leftover: leftover.map((row) => row.key),
    catalogSize: Object.keys(CATALOG).length,
    model,
    engine,
    raw,
    tokenUsage,
  };
}
