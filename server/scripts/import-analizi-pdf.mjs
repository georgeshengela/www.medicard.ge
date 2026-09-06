/**
 * Merge Desktop/analizi.pdf into an existing user's labPanels (does not wipe history).
 * Usage: node scripts/import-analizi-pdf.mjs --email=george@medicard.ge
 */
import 'dotenv/config';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { extractLabFromText } from '../src/lib/labExtract.js';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse/lib/pdf-parse.js');
const prisma = new PrismaClient();

const KEY_FIX = {
  volume_globulaire_moyen_mcv: 'mcv',
  teneur_moyenne_en_hb_mch: 'mch',
  indice_d_anisocytose_rdw: 'rdw',
  ratio_neutro_lympho: 'nlr',
  neutrophiles_abs: 'neutrophils',
  lymphocytes_abs: 'lymphocytes',
  monocytes_abs: 'monocytes',
  eosinophiles_abs: 'eosinophils',
  basophiles_abs: 'basophils',
  taux_de_prothrombine_quick: 'pt_percent',
  temps_de_prothrombine_quick: 'pt_time',
  inr_ratio: 'inr',
  acide_urique: 'uric_acid',
  chlorures: 'chloride',
  calcium_total: 'calcium',
  phosphore: 'phosphorus',
  bilirubine_totale: 'bilirubin',
  bilirubine_directe: 'bilirubin_direct',
  tgp_alat: 'alt',
  phosphatases_alcalines_totales: 'alp',
  ck_mb_masse: 'ck_mb',
  proteines_totales: 'total_protein',
};

const KA = {
  hemoglobin: '\u10f0\u10d4\u10db\u10dd\u10d2\u10da\u10dd\u10d1\u10d8\u10dc\u10d8',
  hct: '\u10f0\u10d4\u10db\u10d0\u10e2\u10dd\u10d9\u10e0\u10d8\u10e2\u10d8',
  rbc: '\u10d4\u10e0\u10d8\u10d7\u10e0\u10dd\u10ea\u10d8\u10e2\u10d4\u10d1\u10d8',
  wbc: '\u10da\u10d4\u10d8\u10d9\u10dd\u10ea\u10d8\u10e2\u10d4\u10d1\u10d8',
  plt: '\u10d7\u10e0\u10dd\u10db\u10d1\u10dd\u10ea\u10d8\u10e2\u10d4\u10d1\u10d8',
  mcv: '\u10e1\u10d0\u10e8\u10e3\u10d0\u10da\u10dd \u10d4\u10e0\u10d8\u10d7\u10e0\u10dd\u10ea\u10d8\u10e2\u10e3\u10da\u10d8 \u10db\u10dd\u10ea\u10e3\u10da\u10dd\u10d1\u10d0',
  mch: '\u10e1\u10d0\u10e8\u10e3\u10d0\u10da\u10dd \u10d4\u10e0\u10d8\u10d7\u10e0\u10dd\u10ea\u10d8\u10e2\u10e3\u10da\u10d8 \u10f0\u10d4\u10db\u10dd\u10d2\u10da\u10dd\u10d1\u10d8\u10dc\u10d8',
  rdw: '\u10d4\u10e0\u10d8\u10d7\u10e0\u10dd\u10ea\u10d8\u10e2\u10d4\u10d1\u10d8\u10e1 \u10d2\u10d0\u10dc\u10d0\u10ec\u10d8\u10da\u10d4\u10d1\u10d8\u10e1 \u10e1\u10d8\u10d2\u10d0\u10dc\u10d4',
  neutrophils: '\u10dc\u10d4\u10d8\u10e2\u10e0\u10dd\u10e4\u10d8\u10da\u10d4\u10d1\u10d8',
  neutrophils_pct: '\u10dc\u10d4\u10d8\u10e2\u10e0\u10dd\u10e4\u10d8\u10da\u10d4\u10d1\u10d8',
  lymphocytes: '\u10da\u10d8\u10db\u10e4\u10dd\u10ea\u10d8\u10e2\u10d4\u10d1\u10d8',
  lymphocytes_pct: '\u10da\u10d8\u10db\u10e4\u10dd\u10ea\u10d8\u10e2\u10d4\u10d1\u10d8',
  monocytes: '\u10db\u10dd\u10dc\u10dd\u10ea\u10d8\u10e2\u10d4\u10d1\u10d8',
  monocytes_pct: '\u10db\u10dd\u10dc\u10dd\u10ea\u10d8\u10e2\u10d4\u10d1\u10d8',
  eosinophils: '\u10d4\u10dd\u10d6\u10d8\u10dc\u10dd\u10e4\u10d8\u10da\u10d4\u10d1\u10d8',
  eosinophils_pct: '\u10d4\u10dd\u10d6\u10d8\u10dc\u10dd\u10e4\u10d8\u10da\u10d4\u10d1\u10d8',
  basophils: '\u10d1\u10d0\u10d6\u10dd\u10e4\u10d8\u10da\u10d4\u10d1\u10d8',
  basophils_pct: '\u10d1\u10d0\u10d6\u10dd\u10e4\u10d8\u10da\u10d4\u10d1\u10d8',
  nlr: '\u10dc\u10d4\u10d8\u10e2\u10e0\u10dd\u10e4\u10d8\u10da/\u10da\u10d8\u10db\u10e4\u10dd\u10ea\u10d8\u10e2\u10d7\u10d0 \u10d7\u10d0\u10dc\u10d0\u10e4\u10d0\u10e0\u10d3\u10dd\u10d1\u10d0',
  glucose: '\u10d2\u10da\u10e3\u10d9\u10dd\u10d6\u10d0',
  creatinine: '\u10d9\u10e0\u10d4\u10d0\u10e2\u10d8\u10dc\u10d8\u10dc\u10d8',
  uric_acid: '\u10e8\u10d0\u10e0\u10d3\u10db\u10df\u10d0\u10d5\u10d0',
  sodium: '\u10dc\u10d0\u10e2\u10e0\u10d8\u10e3\u10db\u10d8',
  potassium: '\u10d9\u10d0\u10da\u10d8\u10e3\u10db\u10d8',
  chloride: '\u10e5\u10da\u10dd\u10e0\u10d8\u10d3\u10d8',
  calcium: '\u10d9\u10d0\u10da\u10ea\u10d8\u10e3\u10db\u10d8',
  phosphorus: '\u10e4\u10dd\u10e1\u10e4\u10dd\u10e0\u10d8',
  magnesium: '\u10db\u10d0\u10d2\u10dc\u10d8\u10e3\u10db\u10d8',
  bilirubin: '\u10d1\u10d8\u10da\u10d8\u10e0\u10e3\u10d1\u10d8\u10dc\u10d8',
  bilirubin_direct: '\u10de\u10d8\u10e0\u10d3\u10d0\u10de\u10d8\u10e0\u10d8 \u10d1\u10d8\u10da\u10d8\u10e0\u10e3\u10d1\u10d8\u10dc\u10d8',
  alt: '\u10d0\u10da\u10d0\u10dc\u10d8\u10dc\u10d0\u10db\u10d8\u10dc\u10dd\u10e2\u10e0\u10d0\u10dc\u10e1\u10e4\u10d4\u10e0\u10d0\u10d6\u10d0',
  ggt: '\u10d2\u10d0\u10db\u10d0-\u10d2\u10da\u10e3\u10e2\u10d0\u10db\u10d8\u10da\u10e2\u10e0\u10d0\u10dc\u10e1\u10e4\u10d4\u10e0\u10d0\u10d6\u10d0',
  alp: '\u10e2\u10e3\u10e2\u10d4 \u10e4\u10dd\u10e1\u10e4\u10d0\u10e2\u10d0\u10d6\u10d0',
  ldh: '\u10da\u10d0\u10e5\u10e2\u10d0\u10e2\u10d3\u10d4\u10f0\u10d8\u10d3\u10e0\u10dd\u10d2\u10d4\u10dc\u10d0\u10d6\u10d0',
  lipase: '\u10da\u10d8\u10de\u10d0\u10d6\u10d0',
  cpk: '\u10d9\u10e0\u10d4\u10d0\u10e2\u10d8\u10dc\u10d9\u10d8\u10dc\u10d0\u10d6\u10d0',
  crp: 'C-\u10e0\u10d4\u10d0\u10e5\u10e2\u10d8\u10e3\u10da\u10d8 \u10ea\u10d8\u10da\u10d0',
  total_protein: '\u10e1\u10d0\u10d4\u10e0\u10d7\u10dd \u10ea\u10d8\u10da\u10d0',
  pt_percent: '\u10de\u10e0\u10dd\u10d7\u10e0\u10dd\u10db\u10d1\u10d8\u10dc\u10d8\u10e1 \u10d8\u10dc\u10d3\u10d4\u10e5\u10e1\u10d8',
  pt_time: '\u10de\u10e0\u10dd\u10d7\u10e0\u10dd\u10db\u10d1\u10d8\u10dc\u10d8\u10e1 \u10d3\u10e0\u10dd',
  inr: 'INR',
  ck_mb: 'CK-MB',
};

const EN = {
  hemoglobin: 'Hemoglobin',
  hct: 'Hematocrit',
  rbc: 'RBC',
  wbc: 'WBC',
  plt: 'Platelets',
  mcv: 'MCV',
  mch: 'MCH',
  rdw: 'RDW',
  neutrophils: 'Neutrophils',
  neutrophils_pct: 'Neutrophils %',
  lymphocytes: 'Lymphocytes',
  lymphocytes_pct: 'Lymphocytes %',
  monocytes: 'Monocytes',
  monocytes_pct: 'Monocytes %',
  eosinophils: 'Eosinophils',
  eosinophils_pct: 'Eosinophils %',
  basophils: 'Basophils',
  basophils_pct: 'Basophils %',
  nlr: 'NLR',
  glucose: 'Glucose',
  creatinine: 'Creatinine',
  uric_acid: 'Uric acid',
  sodium: 'Sodium',
  potassium: 'Potassium',
  chloride: 'Chloride',
  calcium: 'Calcium',
  phosphorus: 'Phosphorus',
  magnesium: 'Magnesium',
  bilirubin: 'Bilirubin',
  bilirubin_direct: 'Direct bilirubin',
  alt: 'ALT',
  ggt: 'GGT',
  alp: 'ALP',
  ldh: 'LDH',
  lipase: 'Lipase',
  cpk: 'CPK',
  ck_mb: 'CK-MB',
  crp: 'CRP',
  total_protein: 'Total protein',
  pt_percent: 'Prothrombin %',
  pt_time: 'Prothrombin time',
  inr: 'INR',
};

function tidyUnit(unit) {
  const raw = String(unit ?? '').replace(/\s+/g, '');
  const lower = raw.toLowerCase();
  if (lower.includes('10e6') || lower.includes('10.6/mcl')) return '10\u2076/\u00b5L';
  if (lower.includes('10e3') || lower.includes('10.3/mm')) return '10\u00b3/mm\u00b3';
  if (lower.includes('mcg/l') || lower.includes('\u03bcg/l')) return '\u00b5g/L';
  if (raw === '%%') return '%';
  if (raw === 'ss') return 's';
  const half = Math.floor(raw.length / 2);
  if (half >= 2 && lower.slice(0, half) === lower.slice(half)) return raw.slice(half);
  return raw;
}

function titled(param) {
  const key = KEY_FIX[param.key] || param.key;
  return {
    ...param,
    key,
    nameKa: KA[key] || param.nameKa || param.nameEn,
    nameEn: EN[key] || param.nameEn,
    unit: tidyUnit(param.unit),
  };
}

function arg(name, fallback) {
  const hit = process.argv.find((item) => item.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

async function main() {
  const email = String(arg('email', 'george@medicard.ge')).trim().toLowerCase();
  const file = arg('file', 'C:\\Users\\User\\Desktop\\analizi.pdf');
  const buf = readFileSync(file);
  const parsed = await pdfParse(buf);
  const extracted = extractLabFromText(parsed.text);
  if (!extracted.date || !extracted.parameters.length) {
    throw new Error('PDF produced no dated parameters');
  }

  const parameters = [];
  const seen = new Set();
  for (const row of extracted.parameters) {
    const next = titled(row);
    if (seen.has(next.key)) continue;
    seen.add(next.key);
    parameters.push(next);
  }
  parameters.sort((a, b) => a.nameKa.localeCompare(b.nameKa, 'ka'));

  const user = await prisma.user.findUnique({
    where: { email },
    include: { healthProfile: true },
  });
  if (!user?.healthProfile) throw new Error(`user or health profile not found: ${email}`);

  const extra =
    user.healthProfile.extraAnswers && typeof user.healthProfile.extraAnswers === 'object'
      ? { ...user.healthProfile.extraAnswers }
      : {};
  const panels = Array.isArray(extra.labPanels) ? [...extra.labPanels] : [];
  const existing = panels.find((row) => row.date === extracted.date);
  const incoming = {
    id: existing?.id ?? `pdf-${extracted.date}`,
    date: extracted.date,
    createdAt: existing?.createdAt ?? `${extracted.date}T12:00:00.000Z`,
    recordIds: existing?.recordIds ?? [],
    analysis: existing?.analysis ?? '',
    visionNotes: 'analizi.pdf \u2014 \u10e1\u10e0\u10e3\u10da\u10d8 \u10e4\u10e3\u10e0\u10ea\u10d4\u10da\u10d8',
    parameters,
  };

  if (existing) {
    const merged = new Map(existing.parameters.map((row) => [row.key, row]));
    for (const row of parameters) merged.set(row.key, row);
    incoming.parameters = [...merged.values()].sort((a, b) => a.nameKa.localeCompare(b.nameKa, 'ka'));
    extra.labPanels = panels.map((row) => (row.date === extracted.date ? incoming : row));
  } else {
    extra.labPanels = [incoming, ...panels].sort((a, b) => b.date.localeCompare(a.date));
  }

  await prisma.healthProfile.update({
    where: { userId: user.id },
    data: { extraAnswers: extra },
  });

  console.log(
    JSON.stringify(
      {
        email,
        date: extracted.date,
        added: incoming.parameters.length,
        keys: incoming.parameters.map((row) => row.key),
        panels: extra.labPanels.length,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error.message || error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
