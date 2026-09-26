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
const QTY_RE = /(?:#|№)?\s*(\d+)\s*(?:ტ(?:აბ(?:l)?)?|tablet|კაფ|capsule|ცალი|unit)\b/i;

const MODIFIERS = ['forte', 'plus', 'express', 'extra', 'duo', 'es', 'max', 'rapid'];

/** Georgian spellings of the same modifiers — a Latin-named source writes "Forte", a
 * Georgian-only one writes "ფორტე", and without this the two signatures diverge on
 * this token alone even when the brand and strength already agree. */
const MODIFIER_ALIASES_GEO = {
  forte: ['ფორტე', 'ფორტ'],
  plus: ['პლუსი', 'პლუს'],
  express: ['ექსპრესი', 'ექსპრეს'],
  extra: ['ექსტრა'],
  duo: ['დუო'],
  max: ['მაქსი', 'მაქსიმუმ'],
  rapid: ['რაპიდი', 'რაპიდ'],
};

/**
 * Generic dosage-form / container words — never a drug's identity, so never a
 * valid brand key. Without this, a product name shaped "{form word} {actual
 * brand} - Latin" registers the FORM word as the brand: "ქრონობიენ LP 1.9მგ
 * 60 ტაბლეტი პილეჟე - Pileje" put "ტაბლეტი" (plain "tablet") in the map as
 * the key for "pileje" — and since almost every tablet-form drug's name
 * contains the word "ტაბლეტი", that one bad entry was silently reachable
 * from hundreds of completely unrelated products the next time any of them
 * got re-matched.
 */
const GENERIC_FORM_WORDS = new Set([
  'ტაბლეტი', 'ტაბლეტები', 'ტაბ',
  'კაფსულა', 'კაფსულები', 'კაფს',
  'გელი', 'ჟელე',
  'კრემი',
  'სიროფი',
  'ხსნარი',
  'მალამო',
  'წვეთები', 'წვეთი',
  'ფხვნილი',
  'ამპულა', 'ამპულები',
  'ფლაკონი',
  'სუსპენზია',
  'ლოსიონი',
  'სპრეი',
  'პასტა',
  'შამპუნი',
  'ინექცია', 'საინექციო',
  'ტუბი', 'ტუბიკი',
  'პაკეტი', 'პაკეტები',
  'სანთელი', 'სუპოზიტორია',
]);

function stripGenericFormWords(words) {
  return words.filter((w) => !GENERIC_FORM_WORDS.has(w.toLowerCase()));
}

/** Well-known Georgian trade names → Latin INN/brand for cross-pharmacy matching. */
const STATIC_GEO_TO_LATIN = {
  ვიაგრა: 'viagra',
  სიალის: 'cialis',
  ნუროფენ: 'nurofen',
  პარაცეტამოლი: 'paracetamol',
};

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
  if (m) return m[1];
  const tabCount = String(raw || '').match(/(?:^|[\s-])(\d+)\s*ტაბლ/i);
  if (tabCount) return tabCount[1];
  const hashTab = String(raw || '').match(/#\s*(\d+)\s*ტ/i);
  if (hashTab) return hashTab[1];
  return null;
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
  if (/#\d+\s*ტ/i.test(String(raw || '')) || /\d+\s*ტაბლ/i.test(String(raw || ''))) return 'tablet';
  return null;
}

/**
 * A Latin brand phrase — up to 3 space-separated Latin-starting words, so a
 * two-word brand (e.g. "Dip Rilif", "Cran Juice Forte") is captured whole
 * instead of truncating to its first word.
 */
const LATIN_PHRASE_SRC = '[A-Za-z][A-Za-z0-9+-]*(?:\\s+[A-Za-z][A-Za-z0-9+-]*){0,2}';
/** An optional trailing bare variant letter, e.g. the "A" in "Lorinden A". */
const VARIANT_GAP_SRC = '(?:\\s[A-Za-z])?';

function canonicalizePhrase(phrase) {
  return phrase.toLowerCase().replace(/\s+/g, '');
}

/** Build Georgian→Latin map from "ქართული - Latin …" *or* "Latin - ქართული …" product titles. */
export function buildGeoLatinMap(names) {
  const map = new Map();
  const geoFirst = new RegExp(
    `([\\u10a0-\\u10ff][\\u10a0-\\u10ff\\s®+-]{2,40}?${VARIANT_GAP_SRC})\\s*-\\s*(${LATIN_PHRASE_SRC}${VARIANT_GAP_SRC})`,
  );
  const latinFirst = new RegExp(
    `(${LATIN_PHRASE_SRC}${VARIANT_GAP_SRC})\\s*-\\s*([\\u10a0-\\u10ff][\\u10a0-\\u10ff\\s®+-]{2,40}?${VARIANT_GAP_SRC})(?=\\s|$)`,
  );
  for (const name of names) {
    const raw = String(name || '');
    const m = raw.match(geoFirst);
    const rev = !m ? raw.match(latinFirst) : null;
    const geoPart = m ? m[1] : rev ? rev[2] : null;
    const latPart = m ? m[2] : rev ? rev[1] : null;
    if (!geoPart || !latPart) continue;

    const latCanon = canonicalizePhrase(latPart);
    if (latCanon.length < 4) continue;

    // Register ONLY the first word of the Georgian phrase — never the second.
    // A length threshold ("only skip the second word when the first is long
    // enough") looked safe but wasn't: "პარა დენკი" (Para-Denk) has a short
    // first word too, so it still registered "დენკი" standalone, which then
    // wrongly matched "დოლო-დენკი" (Dolo-Denk, an unrelated gel) to
    // "სიმვა-დენკი" (Simva-Denk tablets) — same failure as before, just
    // triggered by a different short-first-word pair. A shared second word is
    // very often a generic manufacturer or chemical-class suffix ("Denk",
    // "Sulfate", "EGIS", "Normon", ...) that identifies nothing about the drug
    // itself, so it must never be registered as an independent lookup key —
    // no length threshold makes that safe. The first word alone is already
    // enough for every real case: canonicalBrand's own lookup checks a
    // product's words in the same left-to-right order, so it reaches this
    // exact first word too, however short (e.g. "დიპ" in "დიპ რილიფი").
    const geoWords = stripGenericFormWords(
      geoPart.replace(/®/g, '').trim().split(/\s+/).filter((w) => w.length >= 3),
    );
    const first = geoWords[0];
    if (first) {
      const key = first.toLowerCase();
      if (key.length >= 3 && !map.has(key)) map.set(key, latCanon);
    }
    // Also register the full phrase (letters + any trailing variant letter) as
    // its own exact key, so "Lorinden A" and "Lorinden N" don't collapse into
    // the same bare "lorinden" bucket once the variant letter is stripped.
    const fullGeoKey = canonicalizePhrase(geoPart.replace(/®/g, '').trim());
    if (fullGeoKey.length >= 3 && !map.has(fullGeoKey)) map.set(fullGeoKey, latCanon);
  }
  return map;
}

export function setGeoLatinMap(map) {
  geoLatinCache = map;
}

function canonicalBrand(raw, geoLatinMap = geoLatinCache) {
  const cleaned = cleanRawName(raw);
  const dashLatin = cleaned.match(new RegExp(`\\s-\\s*(${LATIN_PHRASE_SRC}${VARIANT_GAP_SRC})`));
  if (dashLatin) return canonicalizePhrase(dashLatin[1]);

  const inlineLatin = cleaned.match(/\b([A-Z][a-z]{3,})\b/);
  if (inlineLatin) return inlineLatin[1].toLowerCase();

  const geoWords = stripGenericFormWords(cleaned.match(/[\u10a0-\u10ff]{3,}/g) || []);
  const longWords = geoWords.filter((w) => w.length >= 4);
  if (!longWords.length) return '';

  for (const w of geoWords) {
    const geo = w.toLowerCase();
    if (geo.length < 3) continue;
    if (STATIC_GEO_TO_LATIN[geo]) return STATIC_GEO_TO_LATIN[geo];
    if (geoLatinMap?.has(geo)) return geoLatinMap.get(geo);
  }

  const geo = longWords[0].toLowerCase();
  if (geoLatinMap) {
    // A short shared prefix is often just a common pharmacological word root
    // (e.g. "ლეტროზოლ-ფარმოზი" vs "ლეტრომარა" both start with "ლეტრო…") rather
    // than the same brand — that would wrongly merge two different drugs under
    // one price comparison. Require the shorter side to be fully covered by an
    // 8-char-or-more shared prefix before trusting the match, and skip very
    // short registered keys (they carry no useful prefix to compare).
    for (const [g, l] of geoLatinMap) {
      if (g.length < 5) continue;
      if (geo.startsWith(g.slice(0, Math.min(8, g.length))) || g.startsWith(geo.slice(0, Math.min(8, geo.length)))) {
        return l;
      }
    }
  }
  return geo;
}

function extractModifiers(raw) {
  const lower = normalizeDrugName(raw);
  const cleaned = cleanRawName(raw);
  // Word-boundary match, not a plain substring check: short modifiers like "es"
  // or "max" otherwise match inside an unrelated brand word (e.g. "algestin"
  // contains "es"), silently changing the signature and breaking the match.
  // Also check the Georgian spelling — a Latin-named source writes "Forte" and
  // a Georgian-only one writes "ფორტე" for the exact same product, and without
  // this only one side of the pair gets the modifier token.
  return MODIFIERS.filter((m) => {
    if (new RegExp(`\\b${m}\\b`).test(lower)) return true;
    const aliases = MODIFIER_ALIASES_GEO[m];
    return aliases?.some((geo) => cleaned.includes(geo));
  }).sort();
}

/** Cross-pharmacy identity key (brand + strength + pack). Form wording differs by source. */
export function buildMatchSignature(raw, geoLatinMap = geoLatinCache) {
  return buildLooseMatchSignature(raw, geoLatinMap);
}

/** Looser key for cross-pharmacy compare (brand + strength + pack when known). */
export function buildLooseMatchSignature(raw, geoLatinMap = geoLatinCache) {
  const cleaned = cleanRawName(raw);
  const brand = canonicalBrand(cleaned, geoLatinMap);
  const strength = extractStrengthTokens(cleaned);
  const qty = extractQuantityCount(cleaned);
  const mods = extractModifiers(cleaned);

  if (!brand || !strength) return '';

  return [brand, mods.join('+'), strength, qty ? `q${qty}` : ''].filter(Boolean).join('|');
}

export function buildNormalizedKey(raw, geoLatinMap = geoLatinCache) {
  return buildLooseMatchSignature(raw, geoLatinMap) || normalizeDrugName(raw);
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
