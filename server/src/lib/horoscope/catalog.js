// MEDIHOROSCOPE fixed catalogue: tarot major arcana, dream symbols, compatibility and Chinese relations,
// numerology. Deterministic facts live here; the texts come from the library (library.js).
import { SIGNS, PLANETS, CHINESE_ANIMALS, ELEMENT_OF, MODALITY_OF } from './astro.js';

// ── Tarot (22 major arcana; Golden Dawn planet/sign for the card face glyph) ──

export const TAROT = [
  { id: 'fool', n: 0, ka: 'სულელი', en: 'The Fool', glyph: 'uranus' },
  { id: 'magician', n: 1, ka: 'მაგი', en: 'The Magician', glyph: 'mercury' },
  { id: 'priestess', n: 2, ka: 'ქურუმი ქალი', en: 'The High Priestess', glyph: 'moon' },
  { id: 'empress', n: 3, ka: 'იმპერატრიცა', en: 'The Empress', glyph: 'venus' },
  { id: 'emperor', n: 4, ka: 'იმპერატორი', en: 'The Emperor', glyph: 'aries' },
  { id: 'hierophant', n: 5, ka: 'მასწავლებელი', en: 'The Hierophant', glyph: 'taurus' },
  { id: 'lovers', n: 6, ka: 'შეყვარებულები', en: 'The Lovers', glyph: 'gemini' },
  { id: 'chariot', n: 7, ka: 'ეტლი', en: 'The Chariot', glyph: 'cancer' },
  { id: 'strength', n: 8, ka: 'ძალა', en: 'Strength', glyph: 'leo' },
  { id: 'hermit', n: 9, ka: 'განდეგილი', en: 'The Hermit', glyph: 'virgo' },
  { id: 'wheel', n: 10, ka: 'ბედის ბორბალი', en: 'Wheel of Fortune', glyph: 'jupiter' },
  { id: 'justice', n: 11, ka: 'სამართლიანობა', en: 'Justice', glyph: 'libra' },
  { id: 'hanged', n: 12, ka: 'ჩამოკიდებული', en: 'The Hanged Man', glyph: 'neptune' },
  // XIII and XV keep their classic meaning under gentler names (a health app never shows „Death“ / „Devil“).
  { id: 'transformation', n: 13, ka: 'გარდაქმნა', en: 'Transformation', glyph: 'scorpio' },
  { id: 'temperance', n: 14, ka: 'ზომიერება', en: 'Temperance', glyph: 'sagittarius' },
  { id: 'temptation', n: 15, ka: 'ცდუნება', en: 'Temptation', glyph: 'capricorn' },
  { id: 'tower', n: 16, ka: 'კოშკი', en: 'The Tower', glyph: 'mars' },
  { id: 'star', n: 17, ka: 'ვარსკვლავი', en: 'The Star', glyph: 'aquarius' },
  { id: 'moon', n: 18, ka: 'მთვარე', en: 'The Moon', glyph: 'pisces' },
  { id: 'sun', n: 19, ka: 'მზე', en: 'The Sun', glyph: 'sun' },
  { id: 'awakening', n: 20, ka: 'გამოღვიძება', en: 'Awakening', glyph: 'pluto' },
  { id: 'world', n: 21, ka: 'სამყარო', en: 'The World', glyph: 'saturn' },
];

const ROMAN = ['0', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX', 'XXI'];
export const tarotRoman = (n) => ROMAN[n] || String(n);

function hash32(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** The person's card of the day: stable for the day, different per person. */
export function tarotOfDay(userId, ymd) {
  return TAROT[hash32(`${userId}:${ymd}:tarot`) % TAROT.length];
}

/** Three different cards for a spread (past · present · future), stable per person and day. */
export function tarotSpread(userId, ymd, salt = 'spread') {
  const pool = [...TAROT];
  const out = [];
  let seed = hash32(`${userId}:${ymd}:${salt}`);
  for (let i = 0; i < 3; i++) {
    seed = Math.imul(seed ^ (seed >>> 15), 2246822507) >>> 0;
    out.push(pool.splice(seed % pool.length, 1)[0]);
  }
  return out;
}

/** A fresh random draw (the Oracle's „ამომიღე კარტი“). */
export function tarotDraw(count = 1, random = Math.random) {
  const pool = [...TAROT];
  return Array.from({ length: Math.min(count, pool.length) }, () => pool.splice(Math.floor(random() * pool.length), 1)[0]);
}

// ── Sign compatibility ─────────────────────────────────────────────────

const DISTANCE_SCORE = { 0: 78, 1: 58, 2: 84, 3: 52, 4: 92, 5: 50, 6: 74 };
const COMPATIBLE_ELEMENTS = new Set(['fire:air', 'air:fire', 'earth:water', 'water:earth']);

/** Classic sign-to-sign compatibility (0–100) from the angle between the signs and their elements. */
export function compatScore(a, b) {
  const d = Math.abs(SIGNS.indexOf(a) - SIGNS.indexOf(b));
  const dist = Math.min(d, 12 - d);
  let score = DISTANCE_SCORE[dist];
  if (dist === 6 && COMPATIBLE_ELEMENTS.has(`${ELEMENT_OF[a]}:${ELEMENT_OF[b]}`)) score += 4;
  if (dist === 0 && MODALITY_OF[a] === 'fixed') score -= 4;
  return score;
}

export const compatKey = (a, b) => {
  const [x, y] = [a, b].sort((p, q) => SIGNS.indexOf(p) - SIGNS.indexOf(q));
  return `compat:${x}:${y}`;
};

export function compatRelation(a, b) {
  const d = Math.abs(SIGNS.indexOf(a) - SIGNS.indexOf(b));
  return ['same sign', 'neighbouring signs (semi-sextile)', 'sextile', 'square', 'trine', 'quincunx', 'opposite signs'][Math.min(d, 12 - d)];
}

// ── Chinese zodiac relations ───────────────────────────────────────────

const TRINES = [['rat', 'dragon', 'monkey'], ['ox', 'snake', 'rooster'], ['tiger', 'horse', 'dog'], ['rabbit', 'goat', 'pig']];
const SIX_HARMONY = [['rat', 'ox'], ['tiger', 'pig'], ['rabbit', 'dog'], ['dragon', 'rooster'], ['snake', 'monkey'], ['horse', 'goat']];

export function chineseRelation(a, b) {
  if (a === b) return 'same';
  if (TRINES.some((t) => t.includes(a) && t.includes(b))) return 'trine';
  if (SIX_HARMONY.some(([x, y]) => (x === a && y === b) || (x === b && y === a))) return 'harmony';
  const d = Math.abs(CHINESE_ANIMALS.indexOf(a) - CHINESE_ANIMALS.indexOf(b));
  if (d === 6) return 'clash';
  return 'neutral';
}

export function chineseBestMatches(animal) {
  return CHINESE_ANIMALS.filter((x) => ['trine', 'harmony'].includes(chineseRelation(animal, x)));
}

/** Year animal (Gregorian year, by Chinese New Year inside it) for the year forecasts. */
export const yearAnimal = (year) => CHINESE_ANIMALS[((year - 4) % 12 + 12) % 12];

// ── Numerology ─────────────────────────────────────────────────────────

export const LIFE_PATHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 22, 33];

// ── Dream symbols (curated; the texts are written by the library) ──────

export const DREAMS = [
  ['water', 'წყალი', 'Water'], ['sea', 'ზღვა', 'Sea'], ['river', 'მდინარე', 'River'], ['rain', 'წვიმა', 'Rain'],
  ['snow', 'თოვლი', 'Snow'], ['fire', 'ცეცხლი', 'Fire'], ['house', 'სახლი', 'House'], ['door', 'კარი', 'Door'],
  ['window', 'ფანჯარა', 'Window'], ['stairs', 'კიბე', 'Stairs'], ['elevator', 'ლიფტი', 'Elevator'], ['car', 'მანქანა', 'Car'],
  ['plane', 'თვითმფრინავი', 'Airplane'], ['train', 'მატარებელი', 'Train'], ['bridge', 'ხიდი', 'Bridge'], ['road', 'გზა', 'Road'],
  ['forest', 'ტყე', 'Forest'], ['mountain', 'მთა', 'Mountain'], ['flowers', 'ყვავილები', 'Flowers'], ['tree', 'ხე', 'Tree'],
  ['garden', 'ბაღი', 'Garden'], ['dog', 'ძაღლი', 'Dog'], ['cat', 'კატა', 'Cat'], ['horse', 'ცხენი', 'Horse'],
  ['snake', 'გველი', 'Snake'], ['fish', 'თევზი', 'Fish'], ['bird', 'ჩიტი', 'Bird'], ['spider', 'ობობა', 'Spider'],
  ['mouse', 'თაგვი', 'Mouse'], ['lion', 'ლომი', 'Lion'], ['bear', 'დათვი', 'Bear'], ['wolf', 'მგელი', 'Wolf'],
  ['butterfly', 'პეპელა', 'Butterfly'], ['bee', 'ფუტკარი', 'Bee'], ['teeth', 'კბილები', 'Teeth'], ['hair', 'თმა', 'Hair'],
  ['mirror', 'სარკე', 'Mirror'], ['clothes', 'ტანსაცმელი', 'Clothes'], ['shoes', 'ფეხსაცმელი', 'Shoes'], ['ring', 'ბეჭედი', 'Ring'],
  ['gold', 'ოქრო', 'Gold'], ['money', 'ფული', 'Money'], ['gift', 'საჩუქარი', 'Gift'], ['letter', 'წერილი', 'Letter'],
  ['phone', 'ტელეფონი', 'Phone'], ['key', 'გასაღები', 'Key'], ['bag', 'ჩანთა', 'Bag'], ['clock', 'საათი', 'Clock'],
  ['book', 'წიგნი', 'Book'], ['school', 'სკოლა', 'School'], ['exam', 'გამოცდა', 'Exam'], ['wedding', 'ქორწილი', 'Wedding'],
  ['wedding_dress', 'საქორწილო კაბა', 'Wedding dress'], ['child', 'ბავშვი', 'Child'], ['flying', 'ფრენა', 'Flying'], ['falling', 'ვარდნა', 'Falling'],
  ['chase', 'დევნა', 'Being chased'], ['lost', 'გზის დაბნევა', 'Getting lost'], ['late', 'დაგვიანება', 'Being late'], ['swimming', 'ცურვა', 'Swimming'],
  ['dancing', 'ცეკვა', 'Dancing'], ['singing', 'სიმღერა', 'Singing'], ['tears', 'ცრემლები', 'Tears'], ['laughter', 'სიცილი', 'Laughter'],
  ['quarrel', 'ჩხუბი', 'Quarrel'], ['kiss', 'კოცნა', 'Kiss'], ['ex', 'ყოფილი', 'Ex-partner'], ['friend', 'მეგობარი', 'Friend'],
  ['mother', 'დედა', 'Mother'], ['father', 'მამა', 'Father'], ['grandmother', 'ბებია', 'Grandmother'], ['stranger', 'უცნობი', 'Stranger'],
  ['bread', 'პური', 'Bread'], ['fruit', 'ხილი', 'Fruit'], ['apple', 'ვაშლი', 'Apple'], ['grapes', 'ყურძენი', 'Grapes'],
  ['wine', 'ღვინო', 'Wine'], ['coffee', 'ყავა', 'Coffee'], ['cake', 'ტორტი', 'Cake'], ['egg', 'კვერცხი', 'Egg'],
  ['honey', 'თაფლი', 'Honey'], ['milk', 'რძე', 'Milk'], ['moon', 'მთვარე', 'Moon'], ['sun', 'მზე', 'Sun'],
  ['star', 'ვარსკვლავი', 'Star'], ['rainbow', 'ცისარტყელა', 'Rainbow'], ['storm', 'ქარიშხალი', 'Storm'], ['fog', 'ნისლი', 'Fog'],
  ['wind', 'ქარი', 'Wind'], ['earthquake', 'მიწისძვრა', 'Earthquake'], ['church', 'ტაძარი', 'Church'], ['candle', 'სანთელი', 'Candle'],
  ['money_find', 'ფულის პოვნა', 'Finding money'], ['ship', 'გემი', 'Ship'], ['island', 'კუნძული', 'Island'], ['desert', 'უდაბნო', 'Desert'],
  ['cave', 'გამოქვაბული', 'Cave'], ['castle', 'ციხე-სიმაგრე', 'Castle'], ['market', 'ბაზარი', 'Market'], ['shop', 'მაღაზია', 'Shop'],
  ['work', 'სამსახური', 'Work'], ['boss', 'უფროსი', 'Boss'], ['celebrity', 'ცნობილი ადამიანი', 'Celebrity'], ['police', 'პოლიცია', 'Police'],
  ['naked', 'სიშიშვლე', 'Being naked'], ['old_house', 'ძველი სახლი', 'Old house'], ['moving', 'გადასვლა ახალ სახლში', 'Moving house'], ['suitcase', 'ჩემოდანი', 'Suitcase'],
  ['baby_animal', 'ლეკვი ან კნუტი', 'Puppy or kitten'], ['rose', 'ვარდი', 'Rose'], ['wheat', 'ხორბალი', 'Wheat'], ['well', 'ჭა', 'Well'],
  ['bell', 'ზარი', 'Bell'], ['crown', 'გვირგვინი', 'Crown'], ['sword', 'ხმალი', 'Sword'], ['mask', 'ნიღაბი', 'Mask'],
].map(([id, ka, en]) => ({ id, ka, en }));

// ── Library keys ───────────────────────────────────────────────────────

const NATAL_POINTS = [...PLANETS, 'asc', 'mc'];
const ASPECT_KEYS = ['conjunction', 'sextile', 'square', 'trine', 'opposition'];

/** Every library key, in the order the filler writes them (most visible first). */
export function libraryKeys({ year = new Date().getUTCFullYear() } = {}) {
  const keys = [];
  for (const s of SIGNS) keys.push(`sign:${s}`);
  for (let i = 0; i < 12; i++) for (let j = i; j < 12; j++) keys.push(`compat:${SIGNS[i]}:${SIGNS[j]}`);
  for (const t of TAROT) keys.push(`tarot:${t.id}`);
  for (const n of LIFE_PATHS) keys.push(`number:${n}`);
  for (let n = 1; n <= 9; n++) keys.push(`pday:${n}`);
  for (let n = 1; n <= 9; n++) keys.push(`pyear:${n}`);
  for (const p of ['new', 'waxing_crescent', 'first_quarter', 'waxing_gibbous', 'full', 'waning_gibbous', 'last_quarter', 'waning_crescent']) keys.push(`moon_phase:${p}`);
  for (const p of PLANETS.slice(2)) keys.push(`retro:${p}`);
  for (const a of ASPECT_KEYS) keys.push(`aspect_kind:${a}`);
  for (const p of NATAL_POINTS) keys.push(`planet:${p}`);
  for (let h = 1; h <= 12; h++) keys.push(`house:${h}`);
  for (const e of ['fire', 'earth', 'air', 'water']) keys.push(`element:${e}`);
  for (const a of CHINESE_ANIMALS) keys.push(`chinese:${a}`);
  for (const a of CHINESE_ANIMALS) keys.push(`chinese_year:${year}:${a}`);
  for (const s of SIGNS) keys.push(`asc:${s}`);
  for (const p of PLANETS) for (const s of SIGNS) keys.push(`planet_sign:${p}:${s}`);
  for (const p of PLANETS) for (let h = 1; h <= 12; h++) keys.push(`planet_house:${p}:${h}`);
  for (const t of PLANETS) for (const a of ASPECT_KEYS) for (const n of NATAL_POINTS) keys.push(`transit:${t}:${a}:${n}`);
  for (let i = 0; i < NATAL_POINTS.length; i++) {
    for (let j = i + 1; j < NATAL_POINTS.length; j++) {
      if (NATAL_POINTS[i] === 'asc' && NATAL_POINTS[j] === 'mc') continue;
      for (const a of ASPECT_KEYS) keys.push(`aspect:${NATAL_POINTS[i]}:${a}:${NATAL_POINTS[j]}`);
    }
  }
  for (const d of DREAMS) keys.push(`dream:${d.id}`);
  return keys;
}

/** Canonical natal aspect key (points in NATAL_POINTS order). */
export function natalAspectKey(a, aspect, b) {
  const [x, y] = [a, b].sort((p, q) => NATAL_POINTS.indexOf(p) - NATAL_POINTS.indexOf(q));
  return `aspect:${x}:${aspect}:${y}`;
}
