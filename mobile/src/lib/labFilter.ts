import type { LabFlag, LabParameter } from '@/types/lab';

export type LabFlagFilter = 'all' | 'watch' | 'H' | 'L' | 'N';
export type LabSort = 'new' | 'old' | 'name' | 'value';

const FLAG_WORDS: Record<LabFlag, string> = {
  H: 'მაღალი high above',
  L: 'დაბალი low below',
  N: 'ნორმა normal',
  U: 'უცნობი unknown',
};

export function labParamHaystack(param: LabParameter): string {
  return [
    param.nameKa,
    param.nameEn,
    param.key,
    param.display,
    param.unit,
    FLAG_WORDS[param.flag],
  ]
    .join(' ')
    .toLowerCase();
}

export function labParamMatches(param: LabParameter, query: string, flag: LabFlagFilter): boolean {
  if (flag === 'watch' && param.flag !== 'H' && param.flag !== 'L') return false;
  if (flag === 'H' && param.flag !== 'H') return false;
  if (flag === 'L' && param.flag !== 'L') return false;
  if (flag === 'N' && param.flag !== 'N') return false;
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return labParamHaystack(param).includes(q);
}

export function labFlagCounts(params: LabParameter[]): Record<LabFlagFilter, number> {
  let watch = 0;
  let high = 0;
  let low = 0;
  let normal = 0;
  for (const row of params) {
    if (row.flag === 'H') {
      high += 1;
      watch += 1;
    } else if (row.flag === 'L') {
      low += 1;
      watch += 1;
    } else if (row.flag === 'N') {
      normal += 1;
    }
  }
  return { all: params.length, watch, H: high, L: low, N: normal };
}

export function sortLabRows<T extends { nameKa: string; nameEn: string; value: number }>(
  rows: T[],
  sort: LabSort,
): T[] {
  const copy = [...rows];
  if (sort === 'old') return copy.reverse();
  if (sort === 'name') {
    return copy.sort((a, b) => (a.nameKa || a.nameEn).localeCompare(b.nameKa || b.nameEn, 'ka'));
  }
  if (sort === 'value') return copy.sort((a, b) => b.value - a.value);
  return copy;
}
