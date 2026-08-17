const FORM_ALIASES = [
  [/ტაბლ(?:ეტ)?(?:ი)?/gi, 'tablet'],
  [/კაფს(?:ულ)?(?:ა)?/gi, 'capsule'],
  [/წვ(?:ეთ)?(?:ები)?/gi, 'drops'],
  [/ფლაკ(?:ონ)?(?:ი)?/gi, 'flakon'],
  [/შპრ(?:იც)?(?:ი)?/gi, 'syringe'],
  [/tablets?/gi, 'tablet'],
  [/capsules?/gi, 'capsule'],
];

const STRENGTH_RE = /(\d+(?:[.,]\d+)?)\s*(?:მ?გ|mg|mcg|g|ml|მლ|სე|iu|%-)/gi;
const PACK_RE = /#\s*(\d+)/i;

/** Normalize a Georgian drug title for matching. */
export function normalizeDrugName(raw) {
  if (!raw) return '';
  let s = raw.toLowerCase().trim();
  for (const [re, rep] of FORM_ALIASES) s = s.replace(re, rep);
  s = s.replace(/\s+/g, ' ');
  s = s.replace(/[+]/g, '+');
  s = s.replace(/[^\p{L}\p{N}\s+#.+/-]/gu, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

export function extractPackSize(raw) {
  const m = String(raw || '').match(PACK_RE);
  return m ? m[1] : null;
}

export function extractStrengthTokens(raw) {
  const tokens = [];
  let m;
  const re = new RegExp(STRENGTH_RE.source, 'gi');
  while ((m = re.exec(String(raw || '')))) {
    tokens.push(m[1].replace(',', '.'));
  }
  return tokens.sort().join('+');
}

export function buildNormalizedKey(raw) {
  const base = normalizeDrugName(raw);
  const pack = extractPackSize(raw);
  const strength = extractStrengthTokens(raw);
  return [base, strength, pack ? `#${pack}` : ''].filter(Boolean).join('|');
}

export function slugify(text) {
  return normalizeDrugName(text)
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9+#.-]/g, '')
    .replace(/-+/g, '-')
    .slice(0, 120);
}

export function tokenSet(key) {
  return new Set(
    String(key || '')
      .split(/[\s|+#./-]+/)
      .filter((t) => t.length > 1),
  );
}

/** Jaccard similarity between two normalized keys. */
export function similarityScore(a, b) {
  const ta = tokenSet(a);
  const tb = tokenSet(b);
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter += 1;
  return inter / (ta.size + tb.size - inter);
}
