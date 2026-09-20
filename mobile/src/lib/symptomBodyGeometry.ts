import { SYMPTOM_BODY_VIEWS, type BodyPath } from '../constants/symptomBodyPaths';
import type { BodyPartId, BodySide, SymptomGender } from '../types/symptoms';

const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
type Groups = Partial<Record<BodyPartId, number[]>>;
// Reviewed against the four original illustrations. Art layers are not anatomical hit boxes.
const GROUPS: Record<SymptomGender, Record<BodySide, Groups>> = {
  MALE: {
    front: { abs: [47,48,49,51,52,53], chest: [46,50,58,59], shoulder: [8,55], bicep: [1,3,35,37,56,57], forearm: [2,4,36,38], hand: [5,6,7,39,40,41], 'upper-leg': [12,13,19,20,23,24,25,26,27,28,29,30,31,32,33,34], 'lower-leg': [9,10,11,14,15,16,17,18,21,22], neck: [43,44,45], head: [54] },
    back: { calf: range(0,7), hamstring: [...range(8,15),19,20], back: [17,23,24,25,26], head: [18], glute: [21,22], trap: [27], shoulder: [28,39], tricep: [29,30,32,37,38,40,41,43,48,49], forearm: [31,33,42,44], hand: [34,35,36,45,46,47] },
  },
  FEMALE: {
    front: { 'lower-leg': range(0,25), 'upper-leg': range(26,35), bicep: [37,53,70,71], abs: range(38,47), neck: [48,49,50], head: [51], chest: [52,54,61,62], forearm: [55,56,57,59,65,66,68], hand: [58,60,67,69], shoulder: [63,64] },
    back: { calf: [0,1,2,3,6,9,48,49,50,51], back: [4,5,34,35,37,38,39,41,42], head: [7], glute: [8,46,47], hamstring: range(10,17), hand: [18,19,24,25], forearm: [20,21,22,26,27,28], tricep: [23,29,30,31,32,33], shoulder: [44,45], trap: [40,43] },
  },
};

/** Correctly interpret H/V as one coordinate; used for labels only, never tap detection. */
function controlBounds(d: string) {
  const tokens = d.match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g) || [];
  let x = 0, y = 0, startX = 0, startY = 0, command = '', i = 0;
  const xs: number[] = [], ys: number[] = [];
  const arity: Record<string, number> = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2 };
  while (i < tokens.length) {
    if (/^[a-zA-Z]$/.test(tokens[i])) command = tokens[i++];
    const upper = command.toUpperCase();
    if (upper === 'Z') { x = startX; y = startY; command = ''; continue; }
    const n = arity[upper];
    if (!n) throw new Error(`Unsupported body-art command: ${command}`);
    const values = tokens.slice(i, i + n).map(Number); i += n;
    if (values.length !== n || values.some(value => !Number.isFinite(value))) throw new Error('Invalid body-art path');
    const relative = command !== upper, baseX = relative ? x : 0, baseY = relative ? y : 0;
    if (upper === 'H') { x = values[0] + baseX; xs.push(x); ys.push(y); }
    else if (upper === 'V') { y = values[0] + baseY; xs.push(x); ys.push(y); }
    else {
      for (let k = 0; k < values.length; k += 2) { xs.push(values[k] + baseX); ys.push(values[k + 1] + baseY); }
      x = values[n - 2] + baseX; y = values[n - 1] + baseY;
      if (upper === 'M') { startX = x; startY = y; command = relative ? 'l' : 'L'; }
    }
  }
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  return { minX, maxX, minY, maxY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
}
export type AnatomicalPath = BodyPath & { key: string; sourceIndex: number; selectable: boolean; clip?: { y: number; height: number } };
export function buildSymptomBodyView(gender: SymptomGender, side: BodySide) {
  const original = SYMPTOM_BODY_VIEWS[gender][side], labels = new Map<number, BodyPartId>();
  for (const [part, indices] of Object.entries(GROUPS[gender][side])) for (const index of indices!) {
    if (labels.has(index) || !original.paths[index]) throw new Error('Invalid anatomical mapping');
    labels.set(index, part as BodyPartId);
  }
  const splitIndex = gender === 'MALE' ? 27 : 40, neckJoin = gender === 'MALE' ? 65.1316 : 78.2448;
  const paths: AnatomicalPath[] = original.paths.flatMap((path, sourceIndex) => {
    const partId = labels.get(sourceIndex), bounds = controlBounds(path.d);
    const base = { ...path, ...bounds, partId: partId || path.partId, key: String(sourceIndex), sourceIndex, selectable: !!partId && path.fill !== 'none' };
    if (side !== 'back' || sourceIndex !== splitIndex) return [base];
    return [
      { ...base, partId: 'neck' as const, key: `${sourceIndex}-neck`, maxY: neckJoin, cy: (bounds.minY + neckJoin) / 2, clip: { y: 0, height: neckJoin } },
      { ...base, minY: neckJoin, cy: (neckJoin + bounds.maxY) / 2, clip: { y: neckJoin, height: original.h - neckJoin } },
    ];
  });
  return { ...original, paths };
}
export const ANATOMICAL_BODY_VIEWS = {
  MALE: { front: buildSymptomBodyView('MALE','front'), back: buildSymptomBodyView('MALE','back') },
  FEMALE: { front: buildSymptomBodyView('FEMALE','front'), back: buildSymptomBodyView('FEMALE','back') },
};
