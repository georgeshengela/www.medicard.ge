/**
 * What a pharmacy says about a box, in one shape for every source — and the identity built from it.
 *
 * PSP (Magento GraphQL) and Pharmadepot/GPC (the Next.js data inside every listing page) publish
 * structured product data next to the name: active substance, dose, dosage form, count, volume,
 * manufacturer, country, and (Pharmadepot/GPC) whether a prescription is needed. Matching the same
 * box across pharmacies on these facts instead of on free-text names is what makes the comparison
 * exact (2026-10-13: name-only matching compared 19 % of the catalogue and split many boxes in two).
 *
 * Everything here is pure: the sync stores the facts on each offer, `cluster.js` groups offers into
 * products, the API reads the derived fields.
 */

/* ------------------------------------------------------------------ text keys */

const KA_TO_LATIN = {
  ა: 'a', ბ: 'b', გ: 'g', დ: 'd', ე: 'e', ვ: 'v', ზ: 'z', თ: 't', ი: 'i', კ: 'k', ლ: 'l', მ: 'm',
  ნ: 'n', ო: 'o', პ: 'p', ჟ: 'zh', რ: 'r', ს: 's', ტ: 't', უ: 'u', ფ: 'f', ქ: 'k', ღ: 'gh', ყ: 'k',
  შ: 'sh', ჩ: 'ch', ც: 'ts', ძ: 'dz', წ: 'ts', ჭ: 'ch', ხ: 'kh', ჯ: 'j', ჰ: 'h',
};

export function transliterateKa(text) {
  let out = '';
  for (const ch of String(text || '')) out += KA_TO_LATIN[ch] ?? ch;
  return out;
}

const GEORGIAN_RE = /[Ⴀ-ჿ]/;
export const hasGeorgian = (text) => GEORGIAN_RE.test(String(text || ''));

/**
 * One spelling for a word written in Georgian or Latin letters: „ნუროფენი“ and „Nurofen“ → nurofen,
 * „კონკორი“ and „Concor“ → konkor, „ცეტირიზინი“ and „Cetirizine“ → setirizin.
 */
export function phon(word) {
  let w = String(word || '').toLowerCase();
  // Georgian genitive („ტროქსერუტინის გელი“) names the same thing as the nominative.
  if (/^[Ⴀ-ჿ]{4,}ის$/.test(w)) w = w.slice(0, -2);
  let s = transliterateKa(w);
  s = s.replace(/[^a-z]/g, '');
  if (!s) return '';
  s = s
    .replace(/ph/g, 'f')
    .replace(/th/g, 't')
    .replace(/kh/g, 'h')
    .replace(/gh/g, 'g')
    .replace(/ch/g, 'k')
    .replace(/ck/g, 'k')
    .replace(/c(?=[eiy])/g, 's')
    .replace(/c/g, 'k')
    .replace(/q/g, 'k')
    .replace(/x/g, 'ks')
    .replace(/y/g, 'i')
    .replace(/w/g, 'v')
    .replace(/ts|tz/g, 's')
    .replace(/(.)\1+/g, '$1');
  // Georgian adds a vowel to most foreign words („ნუროფენ-ი“); English often ends in a silent e.
  if (s.length > 3) s = s.replace(/[aeiou]+$/, '');
  return s;
}

/** Consonants only — tolerant of the vowels the two alphabets add or drop (ჰიდროქლორთიაზიდი ~ hydrochlorothiazide). */
export function skeleton(word) {
  return phon(word).replace(/[aeiou]/g, '');
}

/* ------------------------------------------------------------------ numbers */

const num = (s) => Number(String(s).replace(/\s+/g, '').replace(',', '.'));

function roundKey(v) {
  if (!Number.isFinite(v)) return '';
  const r = Number(v.toPrecision(4));
  return String(r);
}

/** Unit words → base unit + factor. Masses go to mg, IU stays IU, % is handled separately. */
const AMOUNT_UNITS = [
  [/^(?:მკგ|მკ|mcg|mkg|µg|μg|ug)$/i, 'mg', 0.001],
  [/^(?:მგ|mg)$/i, 'mg', 1],
  [/^(?:გრ?|g|gr)$/i, 'mg', 1000],
  [/^(?:მლნ\s*სე|მლნსე|mln\s*iu)$/i, 'iu', 1e6],
  [/^(?:სე|ლსე|iu|ie|me|ед)$/i, 'iu', 1],
  [/^(?:მლრდ|bln|billion)$/i, 'cfu', 1e9],
  [/^(?:მლნ|mln)$/i, 'cfu', 1e6],
];

function amountUnit(unit) {
  const u = String(unit || '').trim();
  for (const [re, base, factor] of AMOUNT_UNITS) if (re.test(u)) return { base, factor };
  return null;
}

const DOSE_UNIT_SRC = 'მკგ|მკ|mcg|mkg|µg|μg|მგ|mg|მლნ\\s*სე|მლრდ|მლნ|სე|ლსე|IU|iu|გრ|გ|g|%';
const AMOUNT_RE = new RegExp(`(\\d+(?:[\\s ]\\d{3})*(?:[.,]\\d+)?)\\s*(${DOSE_UNIT_SRC})?`, 'giu');

/**
 * „5მგ+25მგ“, „(500მგ+125მგ)/5მლ“, „7.5მგ/5მლ“, „1000სე/1გრ“, „5%“, „100მკგ/დოზა“ → a key such as
 * `5mg+25mg`, `100mg+25mg/u`, `1.5mg/u`, `50mg/u`. Concentrations become amounts per one ml or g
 * (`/u`), so 7.5მგ/5მლ and 1.5მგ/მლ agree, and 5 % equals 50 mg per g.
 */
export function parseDose(text) {
  let s = String(text || '').trim();
  if (!s) return null;
  s = s.replace(/(\d)[\s ](?=\d{3}(?!\d))/g, '$1').replace(/,(?=\d)/g, '.');

  let numerator = s;
  let perAmount = null;
  let perDose = false;
  const slash = s.match(/^(.*?)\/\s*(\d+(?:\.\d+)?)?\s*(მლ|ml|გრ?|gr|g|დოზა|dose|doza)/i);
  if (slash) {
    numerator = slash[1];
    const unit = slash[3].toLowerCase();
    // „50მკგ/დოზა“: a spray's dose per puff is just its dose (PSP writes „50მკგ 140 დოზა“).
    if (/დოზა|dose|doza/.test(unit)) perDose = true;
    else perAmount = slash[2] ? num(slash[2]) : 1;
  } else {
    // „(Nმგ+Nმგ)5მლ“ / „(Nმგ+Nმგ)მლ“ — the slash is sometimes missing after the bracket.
    const bracket = s.match(/^\((.*)\)\s*(\d+(?:\.\d+)?)?\s*(მლ|ml|გრ?|g)$/i);
    if (bracket) {
      numerator = bracket[1];
      perAmount = bracket[2] ? num(bracket[2]) : 1;
    }
  }

  const parts = [];
  let percent = null;
  AMOUNT_RE.lastIndex = 0;
  let m;
  const raw = [];
  while ((m = AMOUNT_RE.exec(numerator))) raw.push({ value: num(m[1]), unit: m[2] || null });
  if (!raw.length) return null;
  // „500+125მგ“: a bare number takes the unit written after it.
  for (let i = raw.length - 2; i >= 0; i -= 1) if (!raw[i].unit && raw[i + 1].unit) raw[i].unit = raw[i + 1].unit;
  for (const r of raw) {
    if (!Number.isFinite(r.value) || r.value <= 0) continue;
    if (r.unit === '%') {
      percent = r.value;
      parts.push({ value: r.value * 10, base: 'mg', per: true });
      continue;
    }
    const u = amountUnit(r.unit);
    if (!u) {
      // A bare number with no unit anywhere („0.25“ on ნახშირი) is not a dose we can compare.
      if (raw.length === 1) return null;
      continue;
    }
    parts.push({ value: r.value * u.factor, base: u.base, per: false });
  }
  if (!parts.length) return null;

  const isPer = perAmount != null || percent != null;
  // Amounts per one ml/g for concentrations, per unit otherwise.
  const amounts = parts.map((p) => ({ value: !p.per && perAmount ? p.value / perAmount : p.value, base: p.base }));
  return { key: doseKey(amounts, isPer), amounts, per: isPer, perDose, percent };
}

function doseKey(amounts, per) {
  const keyParts = amounts.map((a) => `${roundKey(a.value)}${a.base}`);
  keyParts.sort((a, b) => parseFloat(a) - parseFloat(b) || a.localeCompare(b));
  return `${keyParts.join('+')}${per ? '/u' : ''}`;
}

/**
 * Every way the same dose is written: „875მგ+125მგ“ is also „1000მგ“ on PSP; an ampoule's
 * „150მგ+1.5მგ 3მლ“ is „(150მგ+1.5მგ)/3მლ“ elsewhere. Two offers agree when any of these agree.
 */
export function doseKeys(dose, volume) {
  if (!dose) return [];
  const keys = [dose.key];
  const sameBase = dose.amounts.length > 1 && dose.amounts.every((a) => a.base === dose.amounts[0].base);
  if (sameBase) keys.push(doseKey([{ value: dose.amounts.reduce((s, a) => s + a.value, 0), base: dose.amounts[0].base }], dose.per));
  if (volume?.unit === 'ml' && volume.value > 0) {
    if (!dose.per) keys.push(doseKey(dose.amounts.map((a) => ({ value: a.value / volume.value, base: a.base })), true));
    else keys.push(doseKey(dose.amounts.map((a) => ({ value: a.value * volume.value, base: a.base })), false));
  }
  return [...new Set(keys)];
}

/** Dose written inside a product name: the first amount with a strength unit (mg, mcg, IU, %), never „50გრ“ of a tube. */
const NAME_DOSE_RE = new RegExp(
  `(?<![\\p{L}\\d.,])\\(?\\d+(?:[\\s ]\\d{3})*(?:[.,]\\d+)?\\s*(?:მკგ|მგ|mg|mcg|სე|IU|%)?(?:\\s*[+/]\\s*\\(?\\d+(?:[.,]\\d+)?\\s*(?:მკგ|მგ|mg|mcg|სე|IU|%|მლ|ml|გრ?|g)?\\)?)*\\s*(?:მკგ|მგ|mg|mcg|სე|IU|%|გ(?=\\s*\\/)|g(?=\\s*\\/))(?:\\s*\\/\\s*(?:\\d+(?:[.,]\\d+)?\\s*)?(?:მლ|ml|გრ?|g|დოზა))?`,
  'iu',
);

export function doseTextFromName(name) {
  const m = String(name || '').match(NAME_DOSE_RE);
  return m ? m[0].trim() : null;
}

/** „200მლ“, „50გრ“, „150 მლ“ → { value, unit: 'ml'|'g', key: '200ml' }. */
export function parseVolume(text) {
  const m = String(text || '').replace(/,(?=\d)/g, '.').match(/(\d+(?:\.\d+)?)\s*(მლ|ml|გრ?|gr|g|ლ|l)(?![a-z])/i);
  if (!m) return null;
  let value = Number(m[1]);
  let unit = /მლ|ml/i.test(m[2]) ? 'ml' : /^(?:ლ|l)$/i.test(m[2]) ? 'ml' : 'g';
  if (/^(?:ლ|l)$/i.test(m[2])) value *= 1000;
  if (!Number.isFinite(value) || value <= 0) return null;
  return { value, unit, key: `${roundKey(value)}${unit}` };
}

/** The pack volume in a name: an amount of ml/g that is not the denominator of a concentration. */
export function volumeTextFromName(name) {
  const s = String(name || '').replace(/,(?=\d)/g, '.');
  const re = /(?<![/\d.])(\d+(?:\.\d+)?)\s*(მლ|ml|გრ|გ|g)(?![\p{L}])/giu;
  let m;
  let last = null;
  while ((m = re.exec(s))) {
    const before = s.slice(Math.max(0, m.index - 2), m.index);
    if (/\/\s*$/.test(before)) continue;
    last = `${m[1]}${m[2]}`;
  }
  return last;
}

const COUNT_WORDS = 'ტაბლეტი|ტაბლეტ|ტაბ|კაფსულა|კაფსულ|კაფ|პაკეტი|პაკეტ|ამპულა|ამპულ|სუპოზიტორია|სუპოზიტ|სანთელი|სანთ|ფლაკონი|ფლაკონ|საშე|ცალი|ცალ|დრაჟე|პასტილა|ოვულა|შპრიცი|შპრიც|ფირფიტა|პლასტირი|დოზა|tablets?|caps(?:ules?)?|pcs|sachets?';
const COUNT_RE = new RegExp(`(?:^|[\\s(.,])(\\d{1,4})\\s*(?:${COUNT_WORDS})`, 'iu');

/** Units in the box: „#30“, „30 ტაბლეტი“, „10 ამპულა“. */
export function countFromName(name) {
  const s = String(name || '');
  const hash = s.match(/[#№]\s*(\d{1,4})/);
  if (hash) return Number(hash[1]);
  const m = s.match(COUNT_RE);
  return m ? Number(m[1]) : null;
}

/* ------------------------------------------------------------------ dosage form */

/**
 * Coarse dosage-form groups. Sources disagree on the fine print (PSP marks many plain tablets
 * „საღეჭი“), so only the group takes part in matching; the order of the checks matters.
 */
const FORM_RULES = [
  ['vaginal', /ვაგინალ|ოვულა|პესარი|vagin/i],
  ['rectal', /რექტალ|სუპოზიტ|სანთ|suppos|rectal/i],
  ['injection', /საინექც|საინფუზ|ინექც|ინფუზ|ლიოფილ|მზა შპრიც|შპრიც-კალამ|ი\/მ|ი\/ვ|inject|infus/i],
  ['inhaler', /საინჰალ|ინჰალ|ტურბუჰ|დისკჰ|inhal/i],
  ['tablet-eff', /შუშხუნ|effervesc/i],
  ['lozenge', /საწუწნ|პასტილ|lozenge|pastil/i],
  ['patch', /პლასტირ|ემპლასტ|patch|ტრანსდერმ/i],
  ['eye', /თვალის|ophthalm|eye/i],
  ['ear', /ყურის|\botic\b|\bear\b/i],
  ['nasal', /ცხვირის|nasal|\bnose\b/i],
  ['capsule', /კაფსულ|capsul|caps\b/i],
  ['tablet', /ტაბლეტ|ტაბ\.|დრაჟე|\bაბი\b|tablet|\btab\b|ფირფიტა ოროდისპ/i],
  ['powder', /ფხვნილ|გრანულ|პუდრა|საშე|პაკეტ|powder|granul|sachet/i],
  ['spray', /სპრეი|აეროზოლ|spray|aerosol/i],
  ['drops', /წვეთ|drops?\b/i],
  ['oral-liquid', /სიროფ|სუსპენზ|ელექსირ|მიქსტურ|ემულსი|ხსნარი ორალ|ნაყენ|syrup|suspens|elixir/i],
  // Cream, ointment and gel of one brand are different boxes (Advantan cream ≠ Advantan ointment).
  ['topical', /კრემ-?გელ|cream-?gel/i],
  ['ointment', /მალამ|ointment/i],
  ['cream', /კრემ|cream/i],
  ['gel', /გელ|\bgel\b|emulgel/i],
  ['topical', /ლოსიონ|ბალზამ|ლინიმენტ|პასტა|შამპუნ|ქაფ|ლაქი|lotion|balm|shampoo/i],
  ['liquid', /ხსნარ|solution/i],
];

/** The first text that names a form decides (the source's form field before the name, whose brand may say „გელ“). */
export function formGroupOf(...texts) {
  for (const s of texts) {
    if (!s || !String(s).trim()) continue;
    for (const [group, re] of FORM_RULES) if (re.test(s)) return group;
  }
  return null;
}

/** Groups that may describe the same box when one source is vaguer than the other. */
const FORM_COMPATIBLE = {
  liquid: new Set(['oral-liquid', 'drops', 'injection', 'spray', 'eye', 'ear', 'nasal']),
  drops: new Set(['eye', 'ear', 'nasal', 'oral-liquid', 'liquid']),
  // A powder for injection or for an oral solution; „პაკეტი“ can hold a liquid too.
  powder: new Set(['injection', 'oral-liquid', 'liquid']),
  spray: new Set(['nasal', 'inhaler']),
  topical: new Set(['eye', 'nasal', 'ointment', 'cream', 'gel']),
  ointment: new Set(['eye', 'nasal']),
  cream: new Set(['vaginal']),
  gel: new Set(['eye', 'nasal', 'oral-liquid']),
};

export function formsCompatible(a, b) {
  if (!a || !b || a === b) return true;
  return Boolean(FORM_COMPATIBLE[a]?.has(b) || FORM_COMPATIBLE[b]?.has(a));
}

/** Georgian and English labels for a group — what the app shows as „ფორმა“. */
export const FORM_LABELS = {
  tablet: ['ტაბლეტი', 'Tablet'],
  'tablet-eff': ['შუშხუნა ტაბლეტი', 'Effervescent tablet'],
  lozenge: ['საწუწნი ტაბლეტი', 'Lozenge'],
  capsule: ['კაფსულა', 'Capsule'],
  powder: ['ფხვნილი / გრანულა', 'Powder / granules'],
  'oral-liquid': ['სიროფი / სუსპენზია', 'Syrup / suspension'],
  liquid: ['ხსნარი', 'Solution'],
  drops: ['წვეთები', 'Drops'],
  eye: ['თვალის საშუალება', 'Eye product'],
  ear: ['ყურის წვეთები', 'Ear drops'],
  nasal: ['ცხვირის საშუალება', 'Nasal product'],
  spray: ['სპრეი', 'Spray'],
  inhaler: ['საინჰალაციო', 'Inhaler'],
  topical: ['გარეგანი საშუალება', 'For external use'],
  ointment: ['მალამო', 'Ointment'],
  cream: ['კრემი', 'Cream'],
  gel: ['გელი', 'Gel'],
  patch: ['პლასტირი', 'Patch'],
  rectal: ['რექტალური სანთელი', 'Rectal suppository'],
  vaginal: ['ვაგინალური საშუალება', 'Vaginal product'],
  injection: ['საინექციო', 'Injection'],
};

/** What one unit in the box is called, for „ერთი ტაბლეტის ფასი“. */
/** [Georgian, English one, English many] — Georgian keeps the singular after a number („30 ტაბლეტი“). */
export const UNIT_LABELS = {
  tablet: ['ტაბლეტი', 'tablet', 'tablets'],
  'tablet-eff': ['ტაბლეტი', 'tablet', 'tablets'],
  lozenge: ['ტაბლეტი', 'lozenge', 'lozenges'],
  capsule: ['კაფსულა', 'capsule', 'capsules'],
  powder: ['პაკეტი', 'sachet', 'sachets'],
  rectal: ['სანთელი', 'suppository', 'suppositories'],
  vaginal: ['ცალი', 'unit', 'units'],
  injection: ['ამპულა', 'ampoule', 'ampoules'],
  patch: ['პლასტირი', 'patch', 'patches'],
};

/* ------------------------------------------------------------------ brand */

/** Words that describe a product, never which product it is. */
const STOP_WORDS = new Set(
  [
    'ტაბლეტი', 'ტაბლეტები', 'ტაბ', 'კაფსულა', 'კაფსულები', 'კაფს', 'გელი', 'კრემი', 'სიროფი', 'ხსნარი', 'მალამო',
    'წვეთები', 'წვეთი', 'ფხვნილი', 'ამპულა', 'ამპულები', 'ფლაკონი', 'სუსპენზია', 'ლოსიონი', 'სპრეი', 'პასტა',
    'შამპუნი', 'საინექციო', 'საინფუზიო', 'ტუბი', 'პაკეტი', 'პაკეტები', 'სანთელი', 'სუპოზიტორია', 'დრაჟე',
    'გრანულა', 'გრანულები', 'პასტილა', 'საწუწნი', 'საღეჭი', 'შუშხუნა', 'ორალური', 'გარეგანი', 'თვალის', 'ყურის',
    'ცხვირის', 'ვაგინალური', 'რექტალური', 'შემოგარსული', 'გარსით', 'დაფარული', 'ხსნადი', 'ცალი', 'კოლოფი',
    'მოსამზადებლად', 'სუსპენზიის', 'ხსნარის', 'სუსპენზიისთვის', 'ორალური', 'და', 'ან', 'tablet', 'tablets', 'tab',
    'caps', 'capsule', 'capsules', 'syrup', 'gel', 'cream', 'spray', 'drops', 'solution', 'ointment', 'sachet',
    'ბოთლი', 'შპრიცი', 'აეროზოლი', 'ბალზამი', 'ემულსია', 'ნაყენი', 'პლასტირი', 'ლიოფილიზატი', 'კონცენტრატი',
  ].map((w) => w.toLowerCase()),
);

/**
 * Words that change which product it is (a forte is not the plain one). Matched on the phonetic key of
 * every word of the name, Georgian or Latin, so „ფორტე“ and „Forte“ agree.
 */
const MODIFIER_WORDS = {
  forte: ['forte', 'ფორტე', 'ფორტ'],
  plus: ['plus', 'პლუსი', 'პლუს'],
  express: ['express', 'ექსპრესი', 'ექსპრეს'],
  extra: ['extra', 'ექსტრა'],
  duo: ['duo', 'დუო'],
  max: ['max', 'maxi', 'მაქსი', 'მაქს', 'მაქსიმუმ'],
  rapid: ['rapid', 'რაპიდი', 'რაპიდ'],
  advance: ['advance', 'advanced', 'ადვანსი', 'ადვანს'],
  retard: ['retard', 'რეტარდი', 'რეტარდ'],
  mini: ['mini', 'მინი'],
  junior: ['junior', 'ჯუნიორი', 'ჯუნიორ'],
  kids: ['kids', 'kid', 'children', 'baby', 'ბეიბი', 'კიდსი', 'კიდს', 'საბავშვო', 'ბავშვთა', 'ბავშვებისთვის', 'ჩვილებისთვის'],
  neo: ['neo', 'ნეო'],
  ultra: ['ultra', 'ულტრა'],
  intensive: ['intensive', 'intens', 'ინტენსივი', 'ინტენსივ'],
  acute: ['akut', 'acute', 'აკუტი', 'აკუტ'],
  combi: ['combi', 'comp', 'compositum', 'კომბი', 'კომპ', 'კომპოზიტუმ'],
  cardio: ['cardio', 'კარდიო'],
  long: ['long', 'ლონგ', 'ლონგი'],
  night: ['night', 'ღამის'],
  lady: ['lady', 'women', 'ქალის', 'ქალებისთვის'],
  men: ['men', 'მამაკაცის', 'მამაკაცებისთვის'],
  sensitive: ['sensitive', 'სენსიტივი', 'სენსიტივ'],
  active: ['active', 'aktiv', 'აქტივი', 'აქტივ'],
  bi: ['bi', 'ბი'],
};

const MODIFIER_BY_PHON = new Map();
for (const [mod, words] of Object.entries(MODIFIER_WORDS)) for (const w of words) MODIFIER_BY_PHON.set(phon(w) || w, mod);

/** Release and variant marks written in capitals: MR, SR, XR, HD, H, N, RM … */
const RELEASE_MARKS = new Set(['mr', 'sr', 'xr', 'xl', 'cr', 'lp', 'la', 'od', 'cd', 'er', 'zok', 'retard']);

function wordsOf(text) {
  return String(text || '')
    .replace(/[®™©]/g, ' ')
    .split(/[\s,;:()/"„“”«»]+|(?<=[\p{L}])-(?=[\p{L}])/u)
    .map((w) => w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''))
    .filter(Boolean);
}

const isNumberish = (w) => /\d/.test(w);

/** The words that can name the product: no numbers, no dosage-form or filler words. */
function brandWords(text) {
  return wordsOf(text).filter((w) => !isNumberish(w) && !STOP_WORDS.has(w.toLowerCase()) && w.length > 1);
}

/** A variant letter written in Georgian („ასკოფენი ლ“, „ვიტამინი დ3“) is the same mark as the Latin one. */
const VARIANT_LETTERS_KA = { ა: 'a', ბ: 'b', დ: 'd', ე: 'e', ლ: 'l', ს: 's', ჰ: 'h' };

export function modifiersOf(text) {
  const mods = new Set();
  for (const w of wordsOf(text)) {
    if (isNumberish(w)) continue;
    const lower = w.toLowerCase();
    if (VARIANT_LETTERS_KA[w]) mods.add(VARIANT_LETTERS_KA[w]);
    else if (/^[A-Z]{1,4}$/.test(w) && !/^(?:MG|ML|IU|N|G|GEO|NEW)$/.test(w)) mods.add(lower);
    else if (RELEASE_MARKS.has(lower) && /^[A-Za-z]+$/.test(w)) mods.add(lower);
    const mod = MODIFIER_BY_PHON.get(phon(w));
    if (mod) mods.add(mod);
  }
  // „H“ alone and „HCT“ both mean hydrochlorothiazide added.
  if (mods.has('hct')) {
    mods.delete('hct');
    mods.add('h');
  }
  return [...mods].sort();
}

/** Split „ქართული - Latin …“ / „Latin - ქართული …“ PSP names into their two halves. */
export function splitBilingualName(name) {
  const parts = String(name || '').split(/\s+-\s+/);
  if (parts.length < 2) return { ka: hasGeorgian(name) ? name : null, latin: hasGeorgian(name) ? null : name };
  const first = parts[0];
  const rest = parts.slice(1).join(' - ');
  if (hasGeorgian(first) && !hasGeorgian(rest.split(/\s+/)[0])) return { ka: first, latin: rest };
  if (!hasGeorgian(first) && hasGeorgian(rest)) return { ka: rest, latin: first };
  return { ka: first, latin: rest };
}

/**
 * The leading brand phrase: the words before the first number or dosage-form word. Hyphenated words stay
 * whole („ფერო-ფოლგამა“, „L-Thyroxin“) — the brand key decides how to read them.
 */
function leadingPhrase(text) {
  const out = [];
  for (const raw of String(text || '').replace(/[®™©]/g, ' ').split(/[\s,;:()/"„“”«»]+/)) {
    const w = raw.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
    if (!w) continue;
    if (isNumberish(w) || STOP_WORDS.has(w.toLowerCase())) break;
    out.push(w);
  }
  return out;
}

/**
 * The brand key of a phrase. A brand that is just the active substance („პაროქსეტინი ნორმონი“,
 * „Ibuprofen-Normon“) keeps its maker word, since several makers sell the same generic; a trailing
 * variant mark („ევატონი-T“) is a modifier, not part of the brand.
 */
/** Words of a chemical name: „კალცი გლუკონატი“ and „კალცი ქლორიდი“ differ only in the second word. */
const CHEMICAL_WORDS = new Set(
  [
    'კალცი', 'კალციუმი', 'calcium', 'calci', 'ნატრიუმი', 'sodium', 'natrium', 'natrii', 'მაგნიუმი', 'magnesium',
    'კალიუმი', 'potassium', 'kalium', 'თუთია', 'zinc', 'რკინა', 'iron', 'ferrum', 'ვიტამინი', 'vitamin', 'მჟავა',
    'acid', 'ქლორიდი', 'chloride', 'იოდი', 'iodine', 'ბორის', 'boric', 'სალიცილის', 'salicylic', 'სულფატი', 'sulfate',
    'გლუკონატი', 'gluconate', 'კარბონატი', 'carbonate', 'ციტრატი', 'citrate', 'ჰიდროკარბონატი', 'bicarbonate',
  ].map((w) => phon(w)),
);

/**
 * The brand key of a phrase. A box named by its substance or a chemical name („პაროქსეტინი ნორმონი“,
 * „Ibuprofen-Normon“, „კალცი გლუკონატი“) keeps the rest of its name and its maker word, since several
 * makers sell the same generic; `generic` says no maker word was found. A trailing variant mark
 * („ევატონი-T“) is a modifier, not part of the brand.
 */
function brandKeyOf(words, innSkeletons) {
  const isInn = (w) => innSkeletons.has(skeleton(w)) || innSkeletons.has(innComponentKey(w));
  const named = (w) => isInn(w) || CHEMICAL_WORDS.has(phon(w));
  const usable = words.filter((w) => !MODIFIER_BY_PHON.has(phon(w)) && !/^[A-Z]{1,4}$/.test(w) && phon(w).length >= 2);
  if (!usable.length) return null;
  const parts = usable[0].split('-').filter(Boolean);
  while (parts.length > 1 && /^[A-Za-z]{1,3}$/.test(parts[parts.length - 1]) && /[A-Z]/.test(parts[parts.length - 1])) parts.pop();
  let key;
  let generic = false;
  if (parts.length > 1 && named(parts[0])) key = `${phon(parts[0])}~${phon(parts.slice(1).join(''))}`;
  else if (named(usable[0])) {
    const name = [phon(parts.join(''))];
    let i = 1;
    while (i < usable.length && named(usable[i])) name.push(phon(usable[i++]));
    const maker = usable.slice(i).find((w) => phon(w).length >= 3);
    key = [...name, maker ? phon(maker) : null].filter(Boolean).join('~');
    generic = !maker;
  } else key = phon(parts.join(''));
  return key.length >= 3 ? { key, generic } : null;
}

/** The maker's spelling key: its first real word („ლაბ. ნორმონი“ → normon, „MERCK (Germany)“ → merk). */
const MAKER_FILLER = new Set(['lab', 'labs', 'laboratorios', 'laboratoires', 'laboratory', 'laboratories', 'ლაბ', 'ლაბორატორია', 'jsc', 'llc', 'ltd', 'sc', 'ооо', 'შპს', 'სს'].map((w) => w.toLowerCase()));
export function makerKey(manufacturer) {
  for (const w of String(manufacturer || '').split(/[\s.,()/-]+/)) {
    if (!w || MAKER_FILLER.has(w.toLowerCase())) continue;
    const p = phon(w);
    if (p.length >= 3) return p.slice(0, 5);
  }
  return null;
}

/* ------------------------------------------------------------------ active substance */

const INN_PLACEHOLDERS =
  /^(?:.*\bcomb(?:ined)?\.?\s*drugs?|.*homeopath.*|.*herbal.*|vitamins?(?: and minerals)?|essential oils?|(?:multi|poly)[\s-]?vitamins?|plant extracts?|.*ჰომეოპათ.*|.*კომბინირებ.*|.*მცენარეულ.*|მულტივიტამინ\S*|პოლივიტამინ\S*|ვიტამინები|-|—|\s*)$/i;

/** Salt and hydrate words: levothyroxine sodium = levothyroxine for matching. */
const SALT_WORDS = new Set(
  [
    'sodium', 'potassium', 'hydrochloride', 'hydrochlorid', 'hcl', 'maleate', 'fumarate', 'besylate', 'besilate',
    'mesylate', 'mesilate', 'sulfate', 'sulphate', 'phosphate', 'acetate', 'citrate', 'tartrate', 'succinate',
    'dihydrochloride', 'dihydrochlorid', 'hydrobromide', 'monohydrate', 'dihydrate', 'trihydrate', 'hemihydrate',
    'magnesium', 'calcium', 'arginine', 'tert-butylamine', 'erbumine', 'dipropionate', 'propionate', 'valerate',
    'ნატრიუმი', 'ნატრიუმის', 'კალიუმის', 'ჰიდროქლორიდი', 'მალეატი', 'ფუმარატი', 'ბეზილატი', 'სულფატი', 'ფოსფატი',
    'აცეტატი', 'ციტრატი', 'სუქცინატი', 'მონოჰიდრატი', 'არგინინი', 'მაგნიუმის',
  ].map((w) => w.toLowerCase()),
);

/** Vitamins go by many names across the sources („vit.D3“, „ვიტამინი D3“, „ქოლეკალციფეროლი“). */
const VITAMIN_SYNONYMS = [
  [/ქოლეკალციფ|cholecalcif|colecalcif|(?:vit(?:amin)?\.?|ვიტამინი?)\s*d3?\b|^d3$/i, 'cholecalciferol'],
  [/ტოკოფერ|tocopher|(?:vit(?:amin)?\.?|ვიტამინი?)\s*e\b/i, 'tocopherol'],
  [/ასკორბინ|ascorbic|(?:vit(?:amin)?\.?|ვიტამინი?)\s*c\b/i, 'ascorbic acid'],
  [/ციანოკობალ|cyanocobal|cobalamin|(?:vit(?:amin)?\.?|ვიტამინი?)\s*b12/i, 'cyanocobalamin'],
  [/პირიდოქს|pyridox|(?:vit(?:amin)?\.?|ვიტამინი?)\s*b6/i, 'pyridoxine'],
  [/თიამინ|thiamin|(?:vit(?:amin)?\.?|ვიტამინი?)\s*b1\b/i, 'thiamine'],
  [/ფოლიუმის მჟავ|folic acid|(?:vit(?:amin)?\.?|ვიტამინი?)\s*b9/i, 'folic acid'],
  [/რეტინოლ|retinol|(?:vit(?:amin)?\.?|ვიტამინი?)\s*a\b/i, 'retinol'],
];

function innComponentKey(component) {
  let text = String(component || '').toLowerCase();
  for (const [re, name] of VITAMIN_SYNONYMS) if (re.test(text)) return skeleton(name.replace(/\s+/g, ''));
  // „ქოლეკალციფეროლი (ვიტამინი D3)“: the bracket repeats the name in other words.
  text = text.replace(/\([^)]*\)/g, ' ');
  const words = text.split(/[\s-]+/).filter(Boolean);
  const core = words.filter((w) => !SALT_WORDS.has(w));
  const use = core.length ? core : words;
  return use.map(skeleton).filter(Boolean).join('');
}

/** „amoxicillin+clavulanic acid“, „რამიპრილი+ჰიდროქლორთიაზიდი“ → components; null for placeholders. */
export function splitInn(text) {
  const s = String(text || '').trim();
  if (!s || INN_PLACEHOLDERS.test(s)) return null;
  const parts = s
    .split(/\s*[+,;]\s*|\s+\/\s+|\s+და\s+/)
    .map((p) => p.replace(/^\/|\/$/g, '').trim())
    .filter(Boolean);
  if (!parts.length || parts.some((p) => INN_PLACEHOLDERS.test(p))) return null;
  return parts;
}

/** A comparable key for an active-substance list, whatever the alphabet: sorted consonant skeletons. */
export function innKey(components) {
  if (!components?.length) return null;
  const keys = components.map(innComponentKey).filter(Boolean);
  return keys.length ? [...new Set(keys)].sort().join('+') : null;
}

/* ------------------------------------------------------------------ country */

const COUNTRY_KA = {
  თურქეთი: 'TR', გერმანია: 'DE', ესპანეთი: 'ES', უნგრეთი: 'HU', საქართველო: 'GE', საფრანგეთი: 'FR', იტალია: 'IT',
  ინდოეთი: 'IN', პოლონეთი: 'PL', უკრაინა: 'UA', სლოვენია: 'SI', ბულგარეთი: 'BG', 'რუსეთის ფედერაცია': 'RU',
  რუსეთი: 'RU', საბერძნეთი: 'GR', რუმინეთი: 'RO', ბელარუსი: 'BY', პორტუგალია: 'PT', 'დიდი ბრიტანეთი': 'GB',
  'გაერთიანებული სამეფო': 'GB', ინგლისი: 'GB', ლატვია: 'LV', კანადა: 'CA', ნიდერლანდები: 'NL', ჰოლანდია: 'NL',
  ირლანდია: 'IE', ბელგია: 'BE', შვეიცარია: 'CH', ბანგლადეში: 'BD', 'კორეის რესპუბლიკა': 'KR', 'სამხრეთ კორეა': 'KR',
  ავსტრია: 'AT', კვიპროსი: 'CY', ეგვიპტე: 'EG', არგენტინა: 'AR', სლოვაკეთი: 'SK', მალტა: 'MT', მოლდოვა: 'MD',
  მაკედონია: 'MK', 'ჩრდილოეთ მაკედონია': 'MK', ვიეტნამი: 'VN', სერბეთი: 'RS', პაკისტანი: 'PK', შვედეთი: 'SE',
  'ჩეხეთის რესპუბლიკა': 'CZ', ჩეხეთი: 'CZ', 'ამერიკის შეერთებული შტატები': 'US', აშშ: 'US', უზბეკეთი: 'UZ',
  დანია: 'DK', ხორვატია: 'HR', ესტონეთი: 'EE', 'ბოსნია და ჰერცეგოვინა': 'BA', ჩინეთი: 'CN', ტაილანდი: 'TH',
  სომხეთი: 'AM', ფინეთი: 'FI', ნორვეგია: 'NO', ისრაელი: 'IL', პერუ: 'PE', მონტენეგრო: 'ME', ურუგვაი: 'UY',
  'სამხრეთ აფრიკის რესპუბლიკა': 'ZA', 'სამხრეთ აფრიკა': 'ZA', სინგაპური: 'SG', მაროკო: 'MA',
  'არაბთა გაერთიანებული საამიროები': 'AE', ლიეტუვა: 'LT', ავსტრალია: 'AU', ალჟირი: 'DZ', ბრაზილია: 'BR',
  იაპონია: 'JP', კოლუმბია: 'CO', მექსიკა: 'MX', მონაკო: 'MC', 'სან მარინო': 'SM', ტაივანი: 'TW', ყაზახეთი: 'KZ',
  აზერბაიჯანი: 'AZ', ირანი: 'IR', იორდანია: 'JO', ლიბანი: 'LB', ლუქსემბურგი: 'LU', 'ახალი ზელანდია': 'NZ',
  ინდონეზია: 'ID', მალაიზია: 'MY', 'საუდის არაბეთი': 'SA', ტუნისი: 'TN', ისლანდია: 'IS', სირია: 'SY', ერაყი: 'IQ',
  ჩილე: 'CL', კუბა: 'CU', ბრიტანეთი: 'GB',
};

const COUNTRY_NAME_BY_ISO = {};
for (const [name, iso] of Object.entries(COUNTRY_KA)) if (!COUNTRY_NAME_BY_ISO[iso]) COUNTRY_NAME_BY_ISO[iso] = name;
COUNTRY_NAME_BY_ISO.GB = 'დიდი ბრიტანეთი';
COUNTRY_NAME_BY_ISO.RU = 'რუსეთი';
COUNTRY_NAME_BY_ISO.US = 'აშშ';
COUNTRY_NAME_BY_ISO.KR = 'სამხრეთ კორეა';
COUNTRY_NAME_BY_ISO.CZ = 'ჩეხეთი';

export function countryIso(text) {
  const s = String(text || '').trim();
  if (!s) return null;
  if (/^[A-Z]{2}$/.test(s)) return s;
  const iso = s.match(/\(([A-Z]{2})\)\s*$/);
  if (iso) return iso[1];
  const ka = s.split(/\s*[/(]\s*/)[0].trim();
  return COUNTRY_KA[ka] ?? null;
}

export function countryNameKa(iso) {
  return iso ? COUNTRY_NAME_BY_ISO[iso] ?? null : null;
}

/* ------------------------------------------------------------------ what is not a medicine */

const NON_MEDICINE_RE =
  /პრეზერვატივ|კონდომ|შპრიც(?!-კალამ)|გადასხმის სისტემ|სისტემა პეპელა|ნემსი|კათეტერ|სპეისერ|აპლიკატორ|ტესტ-?ზოლ|ტესტი|გლუკომეტრ|თერმომეტრ|ტონომეტრ|ბინტი|ხალათი|ხელთათმან|ნიღაბ|საფენ|ლანცეტ|condom|syringe|spacer|test strip|thermometer/i;

/* ------------------------------------------------------------------ facts per source */

const trimOrNull = (v) => {
  const s = typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim();
  return s ? s : null;
};
const firstOf = (v) => (Array.isArray(v) ? trimOrNull(v[0]) : trimOrNull(v));
const listOf = (v) => (Array.isArray(v) ? v.map(trimOrNull).filter(Boolean) : trimOrNull(v) ? [trimOrNull(v)] : []);

/**
 * PSP: the GraphQL item with its direct fields (moqmedi_nivtiereba, doza, migebis_forma, moculoba,
 * raodenoba_forma, country_of_manufacture) and `attrs` from custom_attributesV2 (generics2, units,
 * custom_manufacturer, drug_forms, med_dosage, product_country). Categories are PSP's own names.
 */
export function factsFromPsp(item) {
  const attrs = item.attrs || {};
  const generics = listOf(attrs.generics2)
    .map((g) => g.split(/\s+\/\s+/))
    .filter((pair) => pair.length === 2 && pair[0].trim() && pair[1].trim());
  return {
    v: 1,
    inn: trimOrNull(item.moqmedi_nivtiereba),
    innPairs: generics.length ? generics.map(([ka, en]) => [ka.trim(), en.trim()]) : null,
    dose: trimOrNull(item.doza) || firstOf(attrs.med_dosage),
    form: trimOrNull(item.migebis_forma) || firstOf(attrs.drug_forms),
    volume: trimOrNull(item.moculoba),
    pack: trimOrNull(item.raodenoba_forma),
    count: Number.isFinite(Number(attrs.units)) && Number(attrs.units) > 0 ? Number(attrs.units) : null,
    manufacturer: trimOrNull(attrs.custom_manufacturer),
    country: countryIso(trimOrNull(item.country_of_manufacture) || firstOf(attrs.product_country)),
    rx: null,
    categories: (item.categories || []).map((c) => trimOrNull(c?.name ?? c)).filter(Boolean),
    medCode: null,
  };
}

/**
 * PSP's slow attributes (read once per product, see sources/psp.js) folded into its stored facts:
 * Georgian/Latin substance pairs, units in the box, maker, and fallbacks for dose/form/country.
 */
export function enrichPspFacts(facts, attrs = {}) {
  const extra = factsFromPsp({ attrs });
  return {
    ...facts,
    innPairs: extra.innPairs ?? facts.innPairs ?? null,
    count: extra.count ?? facts.count ?? null,
    manufacturer: extra.manufacturer ?? facts.manufacturer ?? null,
    dose: facts.dose ?? extra.dose ?? null,
    form: facts.form ?? extra.form ?? null,
    country: facts.country ?? extra.country ?? null,
    // The leaflet's „გაცემის პირობები“ (sources/psp.js prescriptionFromLeaflet).
    // A fresh reading replaces an older one, also when it finds nothing.
    rx: 'rx' in attrs ? (typeof attrs.rx === 'boolean' ? attrs.rx : null) : facts.rx ?? null,
    enriched: true,
    leaflet: 2,
  };
}

/** Pharmadepot / GPC: one object of the listing page's flight data. */
export function factsFromPharmadepot(obj) {
  const c = obj.medicament_characteristic || {};
  return {
    v: 1,
    brand: trimOrNull(obj.name),
    innKa: trimOrNull(c.generic),
    dose: trimOrNull(c.dose),
    form: trimOrNull(c.shape || obj.shape),
    packaging: trimOrNull(c.packaging || obj.packaging),
    volume: trimOrNull(c.volume),
    count: Number(c.numerus ?? obj.numerus) > 0 ? Number(c.numerus ?? obj.numerus) : null,
    manufacturer: trimOrNull(c.manufacturer),
    country: countryIso(trimOrNull(c.manufacturer_country_name)),
    rx: typeof c.need_recipe === 'boolean' ? c.need_recipe : null,
    subCategoryId: c.medicament_sub_category_id != null ? String(c.medicament_sub_category_id) : null,
    medCode: trimOrNull(obj.med_code),
    approvals: Array.isArray(c.medication_approvals) ? c.medication_approvals.map((a) => a?.id_name).filter(Boolean) : null,
  };
}

/* ------------------------------------------------------------------ identity */

/**
 * Everything the matcher compares, derived from the name and the stored facts. `brands` holds one or two
 * phonetic brand keys (PSP names carry the brand in both alphabets); a brand that is just the active
 * substance („პაროქსეტინი ნორმონი“) keeps its maker word, since several makers sell the same generic.
 */
export function identityOf(name, facts = {}, sourceId = null) {
  const f = facts || {};
  const { ka, latin } = splitBilingualName(name);

  // Active substance: PSP gives Latin plus Georgian/Latin pairs, Pharmadepot gives Georgian.
  const innLatin = splitInn(f.inn) || (f.innPairs ? f.innPairs.map((p) => p[1]) : null);
  const innKaList = splitInn(f.innKa) || (f.innPairs ? f.innPairs.map((p) => p[0]) : null);
  const inn = innKey(innLatin) || innKey(innKaList);
  // Every spelling of the substance, whole and word by word, in both alphabets („ნატრიუმის ქლორიდი“).
  const innSkeletons = new Set();
  for (const component of [...(innLatin || []), ...(innKaList || [])]) {
    innSkeletons.add(innComponentKey(component));
    for (const w of String(component).split(/[\s()-]+/)) if (skeleton(w).length >= 3) innSkeletons.add(skeleton(w));
  }
  innSkeletons.delete('');

  // Brand: Pharmadepot's `name` is the clean brand phrase; PSP's name holds it in both alphabets.
  const phrases = [];
  if (f.brand) phrases.push(leadingPhrase(f.brand).length ? leadingPhrase(f.brand) : brandWords(f.brand));
  else {
    if (latin) phrases.push(leadingPhrase(latin));
    if (ka) phrases.push(leadingPhrase(ka));
    if (!phrases.some((p) => p.length)) phrases.push(brandWords(name));
  }
  const brands = new Set();
  // Named only by its substance („კაპტოპრილი 25მგ #40“): which maker it is shows only in the country.
  let generic = false;
  for (const words of phrases) {
    const brand = brandKeyOf(words, innSkeletons);
    if (!brand) continue;
    brands.add(brand.key);
    generic = generic || brand.generic;
  }

  // PSP's structured fields are hand-filled and sometimes wrong („15მგ/მლ“ for 15მგ/5მლ, 5 ml for a
  // 10 ml bottle); its name is the more careful text, so the name wins there. Pharmadepot's are generated.
  const nameDoseText = doseTextFromName(name);
  const psp = sourceId === 'PSP';
  const nameDose = parseDose(nameDoseText);
  const factDose = parseDose(f.dose);
  const dose = psp ? nameDose || factDose : factDose || nameDose;
  const doseText = dose === nameDose ? nameDoseText : f.dose;
  const nameVolume = parseVolume(volumeTextFromName(name));
  const factVolume = parseVolume(f.volume);
  const volume = psp ? nameVolume || factVolume : factVolume || nameVolume;

  const packCount = Number(String(f.pack || '').match(/^\s*(\d{1,4})(?!\d|[.,]\d)/)?.[1]) || null;
  const count = f.count ?? packCount ?? countFromName(name) ?? null;
  const formGroup = formGroupOf(f.form, f.packaging, name);
  const mods = modifiersOf(`${f.brand || ''} ${name}`);
  const kind = NON_MEDICINE_RE.test(`${name} ${(f.categories || []).join(' ')}`) && !inn ? 'other' : 'medicine';
  const brandSet = new Set([...brands].flatMap((b) => b.split('~')));
  const words = descriptiveWords(name, brandSet);

  return {
    brands: [...brands],
    generic,
    mods,
    inn,
    innLatin,
    innKa: innKaList,
    dose: dose?.key ?? null,
    doses: doseKeys(dose, volume),
    doseText: doseText || null,
    words,
    volume: volume?.key ?? null,
    count: count && Number.isFinite(count) ? count : null,
    formGroup,
    country: f.country ?? null,
    maker: makerKey(f.manufacturer),
    rx: typeof f.rx === 'boolean' ? f.rx : null,
    medCode: f.medCode ?? null,
    kind,
  };
}

/**
 * Two active-substance keys rule a match out only when both name one clear, different substance. The
 * sources list multi-component, herbal and vitamin products very differently („vit.D3“ vs
 * „ქოლეკალციფეროლი“, eight essential oils vs three), so those never block a match that brand, dose,
 * count and form already agree on.
 */
export function innCompatible(a, b) {
  if (!a || !b || a === b) return true;
  const sa = a.split('+');
  const sb = b.split('+');
  if (sa.length > 1 || sb.length > 1) return true;
  const [x] = sa;
  const [y] = sb;
  if (x.length < 4 || y.length < 4 || x.startsWith(y) || y.startsWith(x)) return true;
  // Spellings differ by alphabet (მაგნიუმი ~ magnesium, კვეტიაპინი ~ quetiapine): compare letter pairs.
  return dice(x, y) >= 0.5;
}

function dice(a, b) {
  const pairs = (s) => {
    const out = new Map();
    for (let i = 0; i < s.length - 1; i += 1) out.set(s.slice(i, i + 2), (out.get(s.slice(i, i + 2)) || 0) + 1);
    return out;
  };
  const pa = pairs(a);
  const pb = pairs(b);
  let common = 0;
  for (const [k, n] of pa) common += Math.min(n, pb.get(k) || 0);
  return (2 * common) / (a.length - 1 + (b.length - 1));
}

/**
 * The other words of a name (flavours, plant names, „სუროს“, „მრავალძარღვას“) — not part of the identity,
 * but when one brand has several boxes that differ only in such a word, they pick the right twin.
 */
function descriptiveWords(name, brandSet) {
  const out = new Set();
  for (const w of wordsOf(name)) {
    if (isNumberish(w) || STOP_WORDS.has(w.toLowerCase())) continue;
    const p = phon(w);
    if (p.length < 4 || brandSet.has(p) || MODIFIER_BY_PHON.has(p)) continue;
    out.add(p);
  }
  return [...out];
}
