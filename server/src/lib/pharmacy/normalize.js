const FORM_ALIASES = [
  [/ტაბლ(?:ეტ)?(?:ი)?/gi, 'tablet'],
  [/კაფს(?:ულ)?(?:ა)?/gi, 'capsule'],
  [/წვ(?:ეთ)?(?:ები)?/gi, 'drops'],
  [/ფხ(?:ვ)?(?:ინ)?(?:ილი)?/gi, 'powder'],
  [/ფლაკ(?:ონ)?(?:ი)?/gi, 'flakon'],
  [/შპრ(?:იც)?(?:ი)?/gi, 'syringe'],
  [/tablets?/gi, 'tablet'],
  [/capsules?/gi, 'capsule'],
  [/powder/gi, 'powder'],
  [/drops/gi, 'drops'],
];

const STRENGTH_RE = /(\d+(?:[.,]\d+)?)\s*(?:მ?გ|mg|mcg|g|ml|მლ|სе|iu|%-)/gi;
const PACK_RE = /#\s*(\d+)/i;
const QTY_RE = /(?:#|№)?\s*(\d+)\s*(?:ტ(?:აბ)?|tablet|კაფ|capsule|ცალი|unit)\b/i;

const MODIFIERS = ['forte', 'plus', 'express', 'extra', 'duo', 'es', 'max', 'rapid'];

const NOISE_PATTERNS = [
  /\d+[.,]\d+\s*₾/g,
  /\d+[.,]\d+\s*(?:gel|lari|ლარი)/gi,
  /-\s*\d+\s*%/g,
  /\(\s*-\s*\d+\s*%\s*\)/g,
  /პროდუქტი\s+არ\s+იყიდება\s+ონლაინ/gi,
  /არ\s+იყიდება\s+ონლაინ/gi,
  /\b(?:თურქეთი|საქართველო|გერმანია|ინდოეთი|საფრანგეთი|იტალია|შვედეთი|უკრაინა|რუსეთი|პოლონეთი|სომხეთი|ჩეხეთი|ბულგარეთი|ესპანეთი|პორტუგალია|ავსტრია|ჰუნგარეთი|სლოვაკეთი|სლოვენია|რუმინეთი|სერბეთი|ჩინეთი|იაპონია|japan|usa|uk)\b/gi,
  /\b(?:recipe|რეცეპტ|recept|rx)\b/gi,
  /ანოტაცია/gi,
];

let geoLatinCache = null;

export function cleanRawName(raw) {
  let s = String(raw || '');
  for (const re of NOISE_PATTERNS) s = s.replace(re, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

export function normalizeDrugName(raw) {
  if (!raw) return '';
  let s = cleanRawName(raw).toLowerCase().trim();
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

export function extractQuantityCount(raw) {
  const pack = extractPackSize(raw);
  if (pack) return pack;
  const m = String(raw || '').match(QTY_RE);
  return m ? m[1] : null;
}

export function extractStrengthTokens(raw) {
  const tokens = [];
  let m;
  const re = new RegExp(STRENGTH_RE.source, 'gi');
  while ((m = re.exec(String(raw || '')))) {
    tokens.push(m[1].replace(',', '.'));
  }
  return [...new Set(tokens)].sort().join('+');
}

export function extractForm(raw) {
  const s = normalizeDrugName(raw);
  if (/\btablet\b/.test(s)) return 'tablet';
  if (/\bcapsule\b/.test(s)) return 'capsule';
  if (/\bdrops\b/.test(s)) return 'drops';
  if (/\bpowder\b/.test(s)) return 'powder';
  if (/\bflakon\b/.test(s)) return 'flakon';
  return null;
}

/** Build Georgian→Latin map from "ქართული - Latin …" product titles. */
export function buildGeoLatinMap(names) {
  const map = new Map();
  for (const name of names) {
    const m = String(name || '').match(
      /([\u10a0-\u10ff][\u10a0-\u10ff\s®+-]{2,40}?)\s*-\s*([A-Za-z][A-Za-z0-9+-]{2,24})/,
    );
    if (!m) continue;
    const geo = m[1].replace(/®/g, '').trim().split(/\s+/)[0].toLowerCase();
    const lat = m[2].toLowerCase().split(/\s+/)[0];
    if (geo.length >= 4 && lat.length >= 4) map.set(geo, lat);
  }
  return map;
}

export function setGeoLatinMap(map) {
  geoLatinCache = map;
}

function canonicalBrand(raw, geoLatinMap = geoLatinCache) {
  const cleaned = cleanRawName(raw);
  const dashLatin = cleaned.match(/\s-\s*([A-Za-z][A-Za-z0-9+-]{2,20})/);
  if (dashLatin) return dashLatin[1].toLowerCase().split(/\s+/)[0];

  const inlineLatin = cleaned.match(/\b([A-Z][a-z]{3,})\b/);
  if (inlineLatin) return inlineLatin[1].toLowerCase();

  const geoWords = cleaned.match(/[\u10a0-\u10ff]{4,}/g) || [];
  const geo = geoWords[0]?.toLowerCase() ?? '';
  if (!geo) return '';

  if (geoLatinMap?.has(geo)) return geoLatinMap.get(geo);
  if (geoLatinMap) {
    for (const [g, l] of geoLatinMap) {
      if (geo.startsWith(g.slice(0, Math.min(5, g.length))) || g.startsWith(geo.slice(0, Math.min(5, geo.length)))) {
        return l;
      }
    }
  }
  return geo;
}

function extractModifiers(raw) {
  const lower = normalizeDrugName(raw);
  return MODIFIERS.filter((m) => lower.includes(m)).sort();
}

/** Cross-pharmacy identity key (includes pack size). */
export function buildMatchSignature(raw, geoLatinMap = geoLatinCache) {
  const cleaned = cleanRawName(raw);
  const brand = canonicalBrand(cleaned, geoLatinMap);
  const strength = extractStrengthTokens(cleaned);
  const qty = extractQuantityCount(cleaned);
  const form = extractForm(cleaned);
  const mods = extractModifiers(cleaned);

  if (!brand && !strength) return '';

  return [brand, mods.join('+'), strength, form || '', qty ? `q${qty}` : ''].filter(Boolean).join('|');
}

/** Looser key for cross-pharmacy compare (brand + strength + form, ignore pack count). */
export function buildLooseMatchSignature(raw, geoLatinMap = geoLatinCache) {
  const cleaned = cleanRawName(raw);
  const brand = canonicalBrand(cleaned, geoLatinMap);
  const strength = extractStrengthTokens(cleaned);
  const form = extractForm(cleaned);
  const mods = extractModifiers(cleaned);

  if (!brand || !strength) return '';

  return [brand, mods.join('+'), strength, form || ''].filter(Boolean).join('|');
}

export function buildNormalizedKey(raw) {
  return buildMatchSignature(raw) || normalizeDrugName(raw);
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

export function similarityScore(a, b) {
  const ta = tokenSet(a);
  const tb = tokenSet(b);
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter += 1;
  return inter / (ta.size + tb.size - inter);
}
