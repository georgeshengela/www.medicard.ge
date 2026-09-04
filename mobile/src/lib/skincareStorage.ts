import { getScopedPreference, setScopedPreference } from '@/lib/localAccount';

const KEY = 'medicard.skincare-routines';
const MAX = 12;

export type SavedSkincareRoutine = {
  recordId: string;
  createdAt: string;
  skinType: string;
  concerns: string[];
  products?: string;
  analysis: string;
};

type StoredRoutine = Omit<SavedSkincareRoutine, 'analysis'>;

export async function saveSkincareRoutine(routine: SavedSkincareRoutine) {
  const list = await loadSkincareHistory();
  const stored: StoredRoutine = {
    recordId: routine.recordId,
    createdAt: routine.createdAt,
    skinType: routine.skinType,
    concerns: routine.concerns,
    products: routine.products,
  };
  const next = [stored, ...list.filter((item) => item.recordId !== routine.recordId)].slice(0, MAX);
  await setScopedPreference(KEY, JSON.stringify(next));
}

export async function loadSkincareHistory(): Promise<StoredRoutine[]> {
  try {
    const raw = await getScopedPreference(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredRoutine[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function getLatestSkincareRoutine(): Promise<StoredRoutine | null> {
  const list = await loadSkincareHistory();
  return list[0] ?? null;
}

export function splitSkincareSections(markdown: string): { title: string; body: string }[] {
  const text = markdown.trim();
  if (!text || !/^#{1,3}\s+/m.test(text)) return [];

  return text
    .split(/\n(?=#{1,3}\s+)/)
    .map((chunk) => {
      const match = chunk.match(/^(#{1,3})\s+(.+?)(?:\n([\s\S]*))?$/);
      if (!match) return null;
      return { title: match[2].trim(), body: (match[3] ?? '').trim() };
    })
    .filter((section): section is { title: string; body: string } => Boolean(section?.title));
}
