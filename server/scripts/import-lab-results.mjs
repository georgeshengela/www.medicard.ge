/**
 * Import a desktop lab_results.json into one user's HealthProfile.extraAnswers.labPanels.
 * Usage: node server/scripts/import-lab-results.mjs --email=george@medicard.ge --file=C:\Users\User\Desktop\lab_results.json
 */
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const KA = {
  hemoglobin: '\u10f0\u10d4\u10db\u10dd\u10d2\u10da\u10dd\u10d1\u10d8\u10dc\u10d8',
  hct: '\u10f0\u10d4\u10db\u10d0\u10e2\u10dd\u10d9\u10e0\u10d8\u10e2\u10d8',
  rbc: '\u10d4\u10e0\u10d8\u10d7\u10e0\u10dd\u10ea\u10d8\u10e2\u10d4\u10d1\u10d8',
  wbc: '\u10da\u10d4\u10d8\u10d9\u10dd\u10ea\u10d8\u10e2\u10d4\u10d1\u10d8',
  iron: '\u10e0\u10d9\u10d8\u10dc\u10d0',
  tsat: '\u10e2\u10e0\u10d0\u10dc\u10e1\u10e4\u10d4\u10e0\u10d8\u10dc\u10d8\u10e1 \u10e1\u10d0\u10e2\u10e3\u10e0\u10d0\u10ea\u10d8\u10d0',
  ferritin: '\u10e4\u10d4\u10e0\u10d8\u10e2\u10d8\u10dc\u10d8',
  ggt: '\u10d2\u10d0\u10db\u10d0-\u10d2\u10e2',
  crp: 'C-\u10e0\u10d4\u10d0\u10e5\u10e2\u10d8\u10e3\u10da\u10d8 \u10ea\u10d8\u10da\u10d0',
  potassium: '\u10d9\u10d0\u10da\u10d8\u10e3\u10db\u10d8',
  sodium: '\u10dc\u10d0\u10e2\u10e0\u10d8\u10e3\u10db\u10d8',
  chloride: '\u10e5\u10da\u10dd\u10e0\u10d8\u10d3\u10d8',
  glucose: '\u10d2\u10da\u10e3\u10d9\u10dd\u10d6\u10d0',
  vancomycin: '\u10d5\u10d0\u10dc\u10d9\u10dd\u10db\u10d8\u10ea\u10d8\u10dc\u10d8',
  lymphocytes_pct: '\u10da\u10d8\u10db\u10e4\u10dd\u10ea\u10d8\u10e2\u10d4\u10d1\u10d8 %',
  neutrophils: '\u10dc\u10d4\u10d8\u10e2\u10e0\u10dd\u10e4\u10d8\u10da\u10d4\u10d1\u10d8',
  neutrophils_pct: '\u10dc\u10d4\u10d8\u10e2\u10e0\u10dd\u10e4\u10d8\u10da\u10d4\u10d1\u10d8 %',
  monocytes: '\u10db\u10dd\u10dc\u10dd\u10ea\u10d8\u10e2\u10d4\u10d1\u10d8',
  monocytes_pct: '\u10db\u10dd\u10dc\u10dd\u10ea\u10d8\u10e2\u10d4\u10d1\u10d8 %',
  eosinophils_pct: '\u10d4\u10dd\u10d6\u10d8\u10dc\u10dd\u10e4\u10d8\u10da\u10d4\u10d1\u10d8 %',
  bilirubin: '\u10d1\u10d8\u10da\u10d8\u10e0\u10e3\u10d1\u10d8\u10dc\u10d8',
  total_protein: '\u10e1\u10d0\u10d4\u10e0\u10d7\u10dd \u10ea\u10d8\u10da\u10d0',
};

const CATALOG = {
  Hb: { key: 'hemoglobin', nameEn: 'Hemoglobin', refLow: 13, refHigh: 17 },
  HCT: { key: 'hct', nameEn: 'Hematocrit', refLow: 40, refHigh: 50 },
  RBC: { key: 'rbc', nameEn: 'RBC', refLow: 4.5, refHigh: 5.9 },
  WBC: { key: 'wbc', nameEn: 'WBC', refLow: 4, refHigh: 10 },
  MCV: { key: 'mcv', nameEn: 'MCV', refLow: 80, refHigh: 96 },
  MCH: { key: 'mch', nameEn: 'MCH', refLow: 27, refHigh: 33 },
  MCHC: { key: 'mchc', nameEn: 'MCHC', refLow: 32, refHigh: 36 },
  RDW: { key: 'rdw', nameEn: 'RDW', refLow: 11.5, refHigh: 14.5 },
  MPV: { key: 'mpv', nameEn: 'MPV', refLow: 7.5, refHigh: 12 },
  IRON: { key: 'iron', nameEn: 'Serum iron', refLow: 65, refHigh: 175 },
  TSAT: { key: 'tsat', nameEn: 'TSAT', refLow: 20, refHigh: 50 },
  FER: { key: 'ferritin', nameEn: 'Ferritin', refLow: 30, refHigh: 400 },
  ASAT: { key: 'ast', nameEn: 'AST', refLow: 10, refHigh: 40 },
  GGT: { key: 'ggt', nameEn: 'GGT', refLow: 10, refHigh: 60 },
  CRP: { key: 'crp', nameEn: 'CRP', refLow: 0, refHigh: 5 },
  K: { key: 'potassium', nameEn: 'Potassium', refLow: 3.5, refHigh: 5.1 },
  NA: { key: 'sodium', nameEn: 'Sodium', refLow: 135, refHigh: 145 },
  CL: { key: 'chloride', nameEn: 'Chloride', refLow: 98, refHigh: 107 },
  GLU: { key: 'glucose', nameEn: 'Glucose', refLow: 70, refHigh: 100 },
  EGFR: { key: 'egfr', nameEn: 'eGFR', refLow: 90, refHigh: null },
  VANC: { key: 'vancomycin', nameEn: 'Vancomycin', refLow: 10, refHigh: 20 },
  LYM_PCT: { key: 'lymphocytes_pct', nameEn: 'Lymphocytes %', refLow: 20, refHigh: 40 },
  NEU: { key: 'neutrophils', nameEn: 'Neutrophils', refLow: 1.8, refHigh: 7.5 },
  NEU_PCT: { key: 'neutrophils_pct', nameEn: 'Neutrophils %', refLow: 40, refHigh: 70 },
  MON: { key: 'monocytes', nameEn: 'Monocytes', refLow: 0.2, refHigh: 0.8 },
  MON_PCT: { key: 'monocytes_pct', nameEn: 'Monocytes %', refLow: 2, refHigh: 10 },
  EOS_PCT: { key: 'eosinophils_pct', nameEn: 'Eosinophils %', refLow: 0.5, refHigh: 5 },
  NLR: { key: 'nlr', nameEn: 'Neutrophil/lymphocyte', refLow: 1, refHigh: 3 },
  BIL: { key: 'bilirubin', nameEn: 'Bilirubin', refLow: 0.2, refHigh: 1.2 },
  TP: { key: 'total_protein', nameEn: 'Total protein', refLow: 64, refHigh: 83 },
};

function nameKa(key, fallback) {
  return KA[key] || fallback;
}

function flagOf(value, refLow, refHigh) {
  if (refLow != null && value < refLow) return 'L';
  if (refHigh != null && value > refHigh) return 'H';
  if (refLow != null || refHigh != null) return 'N';
  return 'U';
}

function implausible(type, value) {
  if (!Number.isFinite(value)) return true;
  if (type === 'RBC' && value > 15) return true;
  if (type === 'Hb' && (value < 3 || value > 22)) return true;
  if (type === 'HCT' && (value < 10 || value > 70)) return true;
  if (type.endsWith('_PCT') && (value < 0 || value > 100)) return true;
  if (type === 'CRP' && (value < 0 || value > 400)) return true;
  return false;
}

function displayOf(value) {
  if (Number.isInteger(value)) return String(value);
  return String(Math.round(value * 100) / 100);
}

function tidyUnit(unit) {
  return String(unit ?? '')
    .replace('\u03bc', '\u00b5')
    .replace('/mcl/L', '10\u2076/\u00b5L')
    .replace('mcg/L', '\u00b5g/L')
    .trim();
}

function summarize(date, parameters) {
  const watch = parameters.filter((row) => row.flag === 'H' || row.flag === 'L');
  const high = watch.filter((row) => row.flag === 'H').length;
  const low = watch.filter((row) => row.flag === 'L').length;
  const notables = watch
    .slice(0, 4)
    .map((row) => `${row.nameKa} ${row.display} ${row.unit}`.trim())
    .join(', ');
  const tone =
    high && low
      ? `${high} \u10db\u10d0\u10e6\u10d0\u10da\u10d8 \u10d3\u10d0 ${low} \u10d3\u10d0\u10d1\u10d0\u10da\u10d8`
      : high
        ? `${high} \u10db\u10d0\u10e6\u10d0\u10da\u10d8`
        : low
          ? `${low} \u10d3\u10d0\u10d1\u10d0\u10da\u10d8`
          : '\u10e7\u10d5\u10d4\u10da\u10d0 \u10dc\u10dd\u10e0\u10db\u10d0\u10e8\u10d8 \u10d0\u10dc \u10e1\u10d0\u10ea\u10dc\u10dd\u10d1\u10d0\u10e0\u10dd \u10d6\u10e6\u10d5\u10e0\u10d8\u10e1 \u10d2\u10d0\u10e0\u10d4\u10e8\u10d4';
  const head = `${date} \u2014 ${parameters.length} \u10db\u10d0\u10e9\u10d5\u10d4\u10dc\u10d4\u10d1\u10d4\u10da\u10d8. ${tone}.`;
  const attention = '\u10e7\u10e3\u10e0\u10d0\u10d3\u10e6\u10d4\u10d1\u10d0';
  return notables ? `${head} ${attention}: ${notables}.` : head;
}

export function buildLabPanels(rows) {
  const byDate = new Map();
  let skipped = 0;
  const unknown = new Set();

  const sorted = [...rows].sort((a, b) => Number(a.id) - Number(b.id));
  for (const row of sorted) {
    const type = String(row.type ?? '').trim();
    const date = String(row.date ?? '').trim();
    const value = Number(row.value);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      skipped += 1;
      continue;
    }
    const spec = CATALOG[type];
    if (!spec) {
      unknown.add(type);
      skipped += 1;
      continue;
    }
    if (implausible(type, value)) {
      skipped += 1;
      continue;
    }
    const param = {
      key: spec.key,
      nameKa: nameKa(spec.key, spec.nameEn),
      nameEn: spec.nameEn,
      value,
      display: displayOf(value),
      unit: tidyUnit(row.unit) || '',
      refLow: spec.refLow,
      refHigh: spec.refHigh,
      flag: flagOf(value, spec.refLow, spec.refHigh),
    };
    const current = byDate.get(date) ?? new Map();
    current.set(spec.key, param);
    byDate.set(date, current);
  }

  const panels = [...byDate.entries()]
    .map(([date, params]) => {
      const parameters = [...params.values()].sort((a, b) => a.nameKa.localeCompare(b.nameKa, 'ka'));
      return {
        id: `import-${date}`,
        date,
        createdAt: `${date}T12:00:00.000Z`,
        recordIds: [],
        analysis: summarize(date, parameters),
        visionNotes: '\u10d8\u10e1\u10e2\u10dd\u10e0\u10d8\u10e3\u10da\u10d8 \u10d0\u10dc\u10d0\u10da\u10d8\u10d6\u10d4\u10d1\u10d8 \u2014 \u10d8\u10db\u10de\u10dd\u10e0\u10e2\u10d8',
        parameters,
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  return { panels, skipped, unknown: [...unknown] };
}

function arg(name, fallback) {
  const hit = process.argv.find((item) => item.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

async function main() {
  const email = String(arg('email', 'george@medicard.ge')).trim().toLowerCase();
  const file = resolve(arg('file', 'C:\\Users\\User\\Desktop\\lab_results.json'));
  const raw = JSON.parse(readFileSync(file, 'utf8'));
  if (!Array.isArray(raw)) throw new Error('lab_results.json must be an array');

  const { panels, skipped, unknown } = buildLabPanels(raw);
  if (!panels.length) throw new Error('no usable lab panels');

  const user = await prisma.user.findUnique({
    where: { email },
    include: { healthProfile: true },
  });
  if (!user) throw new Error(`user not found: ${email}`);

  const extra =
    user.healthProfile?.extraAnswers && typeof user.healthProfile.extraAnswers === 'object'
      ? { ...user.healthProfile.extraAnswers }
      : {};
  extra.labPanels = panels;
  extra.firstHealthMetricLogged = true;

  if (user.healthProfile) {
    await prisma.healthProfile.update({
      where: { userId: user.id },
      data: { extraAnswers: extra },
    });
  } else {
    await prisma.healthProfile.create({
      data: { userId: user.id, extraAnswers: extra },
    });
  }

  const dates = panels.map((row) => row.date);
  console.log(
    JSON.stringify(
      {
        email,
        userId: user.id,
        rows: raw.length,
        panels: panels.length,
        parameters: panels.reduce((n, row) => n + row.parameters.length, 0),
        skipped,
        unknown,
        first: dates[dates.length - 1],
        last: dates[0],
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
