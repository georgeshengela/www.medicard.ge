export type RankPlace = 1 | 2 | 3;

export type RankTone = {
  ink: string;
  fill: string;
  ring: string;
  pedestal: number;
};

const LIGHT: Record<RankPlace, RankTone> = {
  1: { ink: '#B45309', fill: '#FEF3C7', ring: '#F59E0B', pedestal: 72 },
  2: { ink: '#475569', fill: '#F1F5F9', ring: '#94A3B8', pedestal: 52 },
  3: { ink: '#C2410C', fill: '#FFEDD5', ring: '#EA580C', pedestal: 40 },
};

const DARK: Record<RankPlace, RankTone> = {
  1: { ink: '#FBBF24', fill: '#3A2A0B', ring: '#F59E0B', pedestal: 72 },
  2: { ink: '#E2E8F0', fill: '#1E293B', ring: '#94A3B8', pedestal: 52 },
  3: { ink: '#FDBA74', fill: '#431407', ring: '#EA580C', pedestal: 40 },
};

export function rankTone(rank: number | null | undefined, dark: boolean): RankTone | null {
  if (rank === 1 || rank === 2 || rank === 3) return (dark ? DARK : LIGHT)[rank];
  return null;
}

export function takeRankPodium<T extends { rank?: number | null }>(rows: T[]) {
  const first = rows.find((row) => row.rank === 1) ?? null;
  const second = rows.find((row) => row.rank === 2) ?? null;
  const third = rows.find((row) => row.rank === 3) ?? null;
  const top = [first, second, third].filter((row): row is T => Boolean(row));
  const rest = rows.filter((row) => !top.includes(row));
  return { first, second, third, rest, hasPodium: top.length > 0 };
}
