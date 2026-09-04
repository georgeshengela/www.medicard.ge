import fs from 'fs';

const C = JSON.parse(fs.readFileSync(new URL('./lab-explain-entries.json', import.meta.url), 'utf8'));

const src = `import type { LabParameter } from '@/types/lab';
import { slugLabKey } from './labExtract.ts';

export type LabExplain = {
  title: string;
  alsoKnown: string;
  what: string;
  why: string;
  typicalNorm: string;
  high: string;
  low: string;
  note: string;
};

const CATALOG: Record<string, LabExplain> = ${JSON.stringify(C, null, 2)};

const HINTS: Array<[RegExp, string]> = [
  [/\\bldl\\b|ldl-c|ldl_c/, 'ldl'],
  [/\\bhdl\\b|hdl-c|hdl_c/, 'hdl'],
  [/triglycerid|triglyc|\u10e2\u10e0\u10d8\u10d2\u10da\u10d8\u10ea\u10d4\u10e0\u10d8\u10d3/, 'triglycerides'],
  [/cholesterol|\u10e5\u10dd\u10da\u10d4\u10e1\u10e2\u10d4\u10e0\u10d8\u10dc/, 'cholesterol'],
  [/hba1c|glycated|\\ba1c\\b|\u10d2\u10da\u10d8\u10d9\u10d8\u10e0\u10d4\u10d1/, 'hba1c'],
  [/vitamin.?d|25.?oh|\u10d5\u10d8\u10e2\u10d0\u10db\u10d8\u10dc.?d/, 'vitamin_d'],
  [/vitamin.?b12|cobalamin|\u10d5\u10d8\u10e2\u10d0\u10db\u10d8\u10dc.?b/, 'vitamin_b12'],
  [/uric.?acid|\u10e8\u10d0\u10e0\u10d3\u10db\u10df\u10d0\u10d5/, 'uric_acid'],
  [/ferritin|\u10e4\u10d4\u10e0\u10d8\u10e2\u10d8\u10dc/, 'ferritin'],
  [/creatinine|\u10d9\u10e0\u10d4\u10d0\u10e2\u10d8\u10dc\u10d8\u10dc/, 'creatinine'],
  [/hemoglobin|\u10f0\u10d4\u10db\u10dd\u10d2\u10da\u10dd\u10d1\u10d8\u10dc/, 'hemoglobin'],
  [/\\bwbc\\b|leukocyte|\u10da\u10d4\u10d8\u10d9\u10dd\u10ea\u10d8\u10e2/, 'wbc'],
  [/\\bcrp\\b|c-reactive|\u10e0\u10d4\u10d0\u10e5\u10e2\u10d8\u10e3\u10da/, 'crp'],
  [/\\btsh\\b|\u10d7\u10d8\u10e0\u10d4\u10dd\u10e2\u10e0\u10dd\u10de/, 'tsh'],
  [/glucose|\u10d2\u10da\u10e3\u10d9\u10dd\u10d6/, 'glucose'],
];

export function resolveLabExplainKey(param: Pick<LabParameter, 'key' | 'nameEn' | 'nameKa'>): string | null {
  const blobs = [param.key, param.nameEn, param.nameKa].filter(Boolean);
  for (const raw of blobs) {
    const key = slugLabKey(raw);
    if (CATALOG[key]) return key;
    for (const part of key.split('_')) {
      if (CATALOG[part]) return part;
    }
  }
  const hay = blobs.join(' ').toLowerCase();
  for (const [re, key] of HINTS) {
    if (CATALOG[key] && re.test(hay)) return key;
  }
  return null;
}

function generic(param: LabParameter): LabExplain {
  const name = param.nameKa || param.nameEn || param.key;
  const unit = param.unit ? \` \${param.unit}\` : '';
  return {
    title: name,
    alsoKnown: param.nameEn && param.nameEn !== name ? param.nameEn : param.key.toUpperCase(),
    what: \`\${name} \u10da\u10d0\u10d1\u10dd\u10e0\u10d0\u10e2\u10dd\u10e0\u10d8\u10e3\u10da\u10d8 \u10db\u10d0\u10e9\u10d5\u10d4\u10dc\u10d4\u10d1\u10d4\u10da\u10d8\u10d0. \u10ea\u10d8\u10e4\u10e0\u10d8\${unit} \u10d0\u10e9\u10d5\u10d4\u10dc\u10d4\u10d1\u10e1, \u10e0\u10d0 \u10e0\u10d0\u10dd\u10d3\u10d4\u10dc\u10dd\u10d1\u10d8\u10d7 \u10d0\u10e0\u10d8\u10e1 \u10d4\u10e1 \u10dc\u10d8\u10d5\u10d7\u10d8\u10d4\u10e0\u10d4\u10d1\u10d0 \u10d7\u10e5\u10d5\u10d4\u10dc\u10e1 \u10dc\u10d8\u10db\u10e3\u10e8\u10e8\u10d8.\`,
    why: '\u10d4\u10e5\u10d8\u10db\u10d8 \u10db\u10d0\u10e1 \u10e1\u10ee\u10d5\u10d0 \u10d0\u10dc\u10d0\u10da\u10d8\u10d6\u10d4\u10d1\u10e2\u10d0\u10dc \u10d3\u10d0 \u10e1\u10d8\u10db\u10de\u10e2\u10dd\u10db\u10d4\u10d1\u10e2\u10d0\u10dc \u10d4\u10e0\u10d7\u10d0\u10d3 \u10d9\u10d8\u10d7\u10ee\u10e3\u10da\u10dd\u10d1\u10e1. \u10d4\u10e0\u10d7\u10d8 \u10ea\u10d8\u10e4\u10e0\u10d8 \u10d3\u10d8\u10d0\u10d2\u10dc\u10dd\u10d6\u10e1 \u10d0\u10e0 \u10e1\u10d5\u10d0\u10db\u10e1.',
    typicalNorm: '\u10dc\u10dd\u10e0\u10db\u10d8\u10e1 \u10d6\u10e6\u10d5\u10d0\u10e0\u10d8 \u10da\u10d0\u10d1\u10dd\u10e0\u10d0\u10e2\u10dd\u10e0\u10d8\u10d8\u10d3\u10d0\u10dc \u10da\u10d0\u10d1\u10dd\u10e0\u10d0\u10e2\u10dd\u10e0\u10d8\u10d0\u10db\u10d3\u10d4 \u10d8\u10ea\u10d5\u10da\u10d4\u10d1\u10d0. \u10e7\u10d5\u10d4\u10da\u10d0\u10d6\u10d4 \u10d6\u10e3\u10e1\u10e2\u10d8 \u10d0\u10e0\u10d8\u10e1 \u10d7\u10e5\u10d5\u10d4\u10dc\u10d8 \u10e4\u10e3\u10e0\u10ea\u10da\u10d8\u10e1 \u10d3\u10d8\u10d0\u10de\u10d0\u10d6\u10dd\u10dc\u10d8.',
    high: '\u10db\u10d0\u10e6\u10d0\u10da\u10d8 \u10e8\u10d4\u10d3\u10d4\u10d2\u10d8 \u10dc\u10d8\u10e8\u10dc\u10d0\u10d5\u10e1, \u10e0\u10dd\u10db \u10ea\u10d8\u10e4\u10e0\u10d8 \u10da\u10d0\u10d1\u10dd\u10e0\u10d0\u10e2\u10dd\u10e0\u10d8\u10d8\u10e1 \u10d6\u10d4\u10d3\u10d0 \u10d6\u10e6\u10d5\u10d0\u10e0\u10e1 \u10e1\u10ea\u10d3\u10d4\u10d1\u10d0.',
    low: '\u10d3\u10d0\u10d1\u10d0\u10da\u10d8 \u10e8\u10d4\u10d3\u10d4\u10d2\u10d8 \u10dc\u10d8\u10e8\u10dc\u10d0\u10d5\u10e1, \u10e0\u10dd\u10db \u10ea\u10d8\u10e4\u10e0\u10d8 \u10e5\u10d5\u10d4\u10d3\u10d0 \u10d6\u10e6\u10d5\u10d0\u10e0\u10e1 \u10e9\u10d0\u10db\u10dd\u10e3\u10d5\u10d8\u10d3\u10d0. \u10d6\u10dd\u10d2 \u10db\u10d0\u10e9\u10d5\u10d4\u10dc\u10d4\u10d1\u10d4\u10da\u10d6\u10d4 \u10d4\u10e1 \u10d9\u10d0\u10e0\u10d2\u10d8\u10d0, \u10d6\u10dd\u10d2\u10d6\u10d4 \u2014 \u10e1\u10d0\u10e7\u10e3\u10e0\u10d0\u10d3\u10e6\u10d4\u10d1\u10dd.',
    note: '\u10e8\u10d4\u10d0\u10d3\u10d0\u10e0\u10d4\u10d7 \u10ec\u10d8\u10dc\u10d0 \u10d0\u10dc\u10d0\u10da\u10d8\u10d6\u10d4\u10d1\u10e1 \u10d3\u10d0 \u10d0\u10e9\u10d5\u10d4\u10dc\u10d4\u10d7 \u10d4\u10e5\u10d8\u10db\u10e1. Medicard \u10db\u10ee\u10dd\u10da\u10dd\u10d3 \u10ee\u10e1\u10dc\u10d8\u10e1 \u10ea\u10d8\u10e4\u10e0\u10e1 \u2014 \u10db\u10d9\u10e3\u10e0\u10dc\u10d0\u10da\u10dd\u10d1\u10d0\u10e1 \u10d0\u10e0 \u10dc\u10d8\u10e8\u10dc\u10d0\u10d5\u10e1.',
  };
}

export function explainLabParam(param: LabParameter): LabExplain {
  const key = resolveLabExplainKey(param);
  return (key && CATALOG[key]) || generic(param);
}

export function formatPrintedNorm(param: LabParameter): string | null {
  if (param.refLow != null && param.refHigh != null) {
    return \`\${param.refLow} \u2013 \${param.refHigh}\${param.unit ? \` \${param.unit}\` : ''}\`;
  }
  if (param.refHigh != null) return \`\u2264 \${param.refHigh}\${param.unit ? \` \${param.unit}\` : ''}\`;
  if (param.refLow != null) return \`\u2265 \${param.refLow}\${param.unit ? \` \${param.unit}\` : ''}\`;
  return null;
}
`;

fs.writeFileSync(new URL('../src/lib/labExplain.ts', import.meta.url), src, 'utf8');
console.log('ok', Object.keys(C).length, Object.keys(C).join(','));
