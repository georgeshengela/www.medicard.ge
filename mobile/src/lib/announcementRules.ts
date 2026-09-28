/**
 * Pure rules for Home news cards (no React Native imports, so node tests can load them).
 * ROUTE_ROOTS mirrors `server/src/lib/announcements.js` — a test keeps the two identical.
 */
export const ROUTE_ROOTS = [
  '(tabs)', 'assistant', 'cycle', 'nutrition', 'pets', 'medipulsi', 'run', 'medi-quest', 'community',
  'pharmacy', 'trainer', 'visits', 'lab', 'symptoms', 'health-metrics', 'medications', 'record',
  'profile', 'explore', 'weather', 'week', 'module', 'news',
] as const;

const ROUTE_RE = /^\/[A-Za-z0-9()_\-/]*(\?[A-Za-z0-9_\-=&%.]*)?$/;

export function isAllowedAppRoute(target: string): boolean {
  const value = String(target || '').trim();
  if (!ROUTE_RE.test(value) || value.includes('//')) return false;
  const root = value.slice(1).split(/[/?]/)[0];
  return (ROUTE_ROOTS as readonly string[]).includes(root);
}

/** Blank-line separated paragraphs for the details screen (falls back to the short text). */
export function detailParagraphs(card: { details?: string | null; body?: string | null }): string[] {
  const text = (card.details || card.body || '').replace(/\r\n/g, '\n').trim();
  return text ? text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean) : [];
}
