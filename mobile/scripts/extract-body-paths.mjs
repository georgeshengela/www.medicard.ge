import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const BODIES = path.join(ROOT, 'assets/figma/symptoms/bodies');

const FILES = {
  'MALE:front': 'male-front.svg',
  'MALE:back': 'male-back.svg',
  'FEMALE:front': 'female-front.svg',
  'FEMALE:back': 'female-back.svg',
};

function classify(side, nx, ny) {
  const arm = nx < 0.32 || nx > 0.68;
  if (ny < 0.125) return 'head';
  if (ny < 0.175) return arm ? 'shoulder' : 'neck';
  if (arm) {
    if (ny < 0.32) return 'shoulder';
    if (ny < 0.42) return side === 'front' ? 'bicep' : 'tricep';
    if (ny < 0.56) return 'forearm';
    return 'hand';
  }
  if (side === 'front') {
    if (ny < 0.3) return 'chest';
    if (ny < 0.46) return 'abs';
    if (ny < 0.7) return 'upper-leg';
    return 'lower-leg';
  }
  if (ny < 0.24) return 'trap';
  if (ny < 0.42) return 'back';
  if (ny < 0.52) return 'glute';
  if (ny < 0.7) return 'hamstring';
  return 'calf';
}

function extract(svg) {
  const vb = svg.match(/viewBox="([^"]+)"/)?.[1]?.split(/[\s,]+/).map(Number) ?? [0, 0, 100, 100];
  const [, , vw, vh] = vb;
  const paths = [];
  const re = /<path\b([^>]*)\/?>/g;
  let m;
  while ((m = re.exec(svg))) {
    const attrs = m[1];
    const d = attrs.match(/\bd="([^"]+)"/)?.[1];
    if (!d) continue;
    const fill = attrs.match(/\bfill="([^"]+)"/)?.[1] ?? 'none';
    const nums = [...d.matchAll(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi)].map((n) => Number(n[0]));
    if (nums.length < 4) continue;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let sx = 0;
    let sy = 0;
    let pairs = 0;
    for (let i = 0; i + 1 < nums.length; i += 2) {
      const x = nums[i];
      const y = nums[i + 1];
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      sx += x;
      sy += y;
      pairs += 1;
    }
    const cx = sx / pairs;
    const cy = sy / pairs;
    paths.push({
      d,
      fill,
      cx: +cx.toFixed(2),
      cy: +cy.toFixed(2),
      minX: +minX.toFixed(2),
      minY: +minY.toFixed(2),
      maxX: +maxX.toFixed(2),
      maxY: +maxY.toFixed(2),
    });
  }
  return { w: +vw.toFixed(3), h: +vh.toFixed(3), paths };
}

const views = {};
for (const [key, file] of Object.entries(FILES)) {
  const side = key.split(':')[1];
  const raw = fs.readFileSync(path.join(BODIES, file), 'utf8');
  const extracted = extract(raw);
  const paths = extracted.paths.map((p) => ({
    ...p,
    partId: classify(side, p.cx / extracted.w, p.cy / extracted.h),
  }));
  views[key] = { w: extracted.w, h: extracted.h, paths };
  const counts = {};
  for (const p of paths) counts[p.partId] = (counts[p.partId] ?? 0) + 1;
  console.log(key, extracted.w, 'x', extracted.h, 'paths', paths.length, counts);
}

const out = `import type { BodyPartId, BodySide, SymptomGender } from '@/types/symptoms';

export type BodyPath = {
  d: string;
  fill: string;
  partId: BodyPartId;
  cx: number;
  cy: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

export type BodyView = { w: number; h: number; paths: BodyPath[] };

export const SYMPTOM_BODY_VIEWS: Record<SymptomGender, Record<BodySide, BodyView>> = {
  MALE: {
    front: ${JSON.stringify(views['MALE:front'], null, 2)},
    back: ${JSON.stringify(views['MALE:back'], null, 2)},
  },
  FEMALE: {
    front: ${JSON.stringify(views['FEMALE:front'], null, 2)},
    back: ${JSON.stringify(views['FEMALE:back'], null, 2)},
  },
};
`;

fs.writeFileSync(path.join(ROOT, 'src/constants/symptomBodyPaths.ts'), out);
console.log('wrote src/constants/symptomBodyPaths.ts');
