// MEDIHOROSCOPE writer: real-sky facts for one sign and period → a Georgian reading written natively
// by the author model, polished by the Georgian editor model, plus an English version written on its own
// from the same sky (never a translation). No account data ever goes into these prompts.
import { SIGNS, positions, moonPhase, lunarDay, skyEvents, zonedToUtc } from './astro.js';
import { SIGN_INFO, PLANET_NAMES, HOUSE_THEMES, MOON_PHASE_NAMES, LUCKY_COLORS } from './signs.js';
import { TZ, periodWindow, exactAspects } from './generate.js';
import { askJson } from './llm.js';
import { brokenRule } from './contentRules.js';

// ── Sky facts for one sign ──────────────────────────────────────────────

const FAST = new Set(['moon', 'sun', 'mercury', 'venus', 'mars']);
const houseFrom = (sign, bodySign) => ((SIGNS.indexOf(bodySign) - SIGNS.indexOf(sign) + 12) % 12) + 1;

/**
 * Structured real-sky facts for one sign and period, plus a compact snapshot stored with the
 * reading (admin shows it; the app draws the sky from it).
 */
export function skyFacts(sign, kind, key) {
  const { from, to } = periodWindow(kind, key);
  const mid = new Date((from.getTime() + to.getTime()) / 2);
  const at = kind === 'day' ? zonedToUtc(key, '12:00', TZ) : mid;
  const bodies = positions(at).map((b) => ({ ...b, house: houseFrom(sign, b.sign) }));
  const events = skyEvents(from, to).filter((e) => kind === 'day' || kind === 'week' || e.type !== 'moon_ingress');
  const lunations = events.filter((e) => e.type === 'new_moon' || e.type === 'full_moon');
  const phase = kind === 'day' ? moonPhase(at) : (lunations.length ? null : moonPhase(mid));
  const slowPair = (x) => kind !== 'year' || !(FAST.has(x.a) && FAST.has(x.b));
  const aspects = exactAspects(from, to, { moon: kind === 'day' }).filter(slowPair).slice(0, kind === 'day' ? 10 : 24);
  const cap = kind === 'year' ? 40 : kind === 'month' ? 30 : 20;
  return {
    sign, kind, key, at,
    bodies: kind === 'day' ? bodies : bodies.filter((b) => b.key !== 'moon'),
    ruler: bodies.find((b) => b.key === SIGN_INFO[sign].ruler) || null,
    phase,
    lunarDay: kind === 'day' ? lunarDay(at) : null,
    events: events.slice(0, cap).map((e) => ({ ...e, house: e.sign ? houseFrom(sign, e.sign) : null })),
    aspects,
    snapshot: {
      at: at.toISOString(),
      bodies: bodies.map((b) => ({ key: b.key, sign: b.sign, degree: b.degree, retro: b.retro, house: b.house })),
      events: events.slice(0, 40).map((e) => ({ type: e.type, at: e.at, body: e.body, sign: e.sign, kind: e.kind })),
      aspects: aspects.slice(0, 30),
    },
  };
}

// Georgian forms used in the facts (the author copies their spelling).
export const KA_IN = {
  aries: 'ვერძში', taurus: 'კუროში', gemini: 'ტყუპებში', cancer: 'კირჩხიბში', leo: 'ლომში', virgo: 'ქალწულში',
  libra: 'სასწორში', scorpio: 'მორიელში', sagittarius: 'მშვილდოსანში', capricorn: 'თხის რქაში', aquarius: 'მერწყულში', pisces: 'თევზებში',
};
const KA_ELEMENT = { fire: 'ცეცხლის', earth: 'მიწის', air: 'ჰაერის', water: 'წყლის' };
const KA_MODALITY = { cardinal: 'კარდინალური', fixed: 'ფიქსირებული', mutable: 'ცვალებადი' };
const KA_ECLIPSE = { total: 'სრული', partial: 'ნაწილობრივი', annular: 'რგოლისებრი', penumbral: 'ნახევარჩრდილოვანი' };
const ASPECT_KA = { conjunction: 'შეერთება', sextile: 'სექსტილი', square: 'კვადრატი', trine: 'ტრიგონი', opposition: 'ოპოზიცია' };
export const KA_MONTHS = ['იანვარი', 'თებერვალი', 'მარტი', 'აპრილი', 'მაისი', 'ივნისი', 'ივლისი', 'აგვისტო', 'სექტემბერი', 'ოქტომბერი', 'ნოემბერი', 'დეკემბერი'];
const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const kaPlanet = (k) => PLANET_NAMES[k]?.ka || k;
const enPlanet = (k) => PLANET_NAMES[k]?.en || k;
const enSign = (s) => SIGN_INFO[s].en;

const tbParts = (iso) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ, day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return { day: Number(p.day), month: Number(p.month), time: `${p.hour}:${p.minute}` };
};
const kaWhen = (iso, withDate) => { const p = tbParts(iso); return withDate ? `${p.day} ${KA_MONTHS[p.month - 1]}, ${p.time}` : p.time; };
const enWhen = (iso, withDate) => { const p = tbParts(iso); return withDate ? `${p.day} ${EN_MONTHS[p.month - 1]} ${p.time}` : p.time; };
const kaHouse = (h) => `შენი მე-${h} სახლი (${HOUSE_THEMES[h].ka})`;
const enHouse = (h) => `your solar house ${h} (${HOUSE_THEMES[h].en})`;

function kaEvent(e, withDate) {
  const when = kaWhen(e.at, withDate);
  const h = e.house ? ` — ${kaHouse(e.house)}` : '';
  switch (e.type) {
    case 'new_moon': return `${when} — ახალი მთვარე ${KA_IN[e.sign]}${h}`;
    case 'full_moon': return `${when} — სავსე მთვარე ${KA_IN[e.sign]}${h}`;
    case 'lunar_eclipse': return `${when} — მთვარის ${KA_ECLIPSE[e.kind] || ''} დაბნელება ${KA_IN[e.sign]}${h}`;
    case 'solar_eclipse': return `${when} — მზის ${KA_ECLIPSE[e.kind] || ''} დაბნელება ${KA_IN[e.sign]}${h}`;
    case 'ingress': return `${when} — ${kaPlanet(e.body)} გადადის ${KA_IN[e.sign]}${e.retro ? ' (უკუსვლით)' : ''}${h}`;
    case 'moon_ingress': return `${when} — მთვარე გადადის ${KA_IN[e.sign]}${h}`;
    case 'station_retrograde': return `${when} — ${kaPlanet(e.body)} იწყებს უკუსვლას (რეტროგრადი) ${KA_IN[e.sign]}${h}`;
    case 'station_direct': return `${when} — ${kaPlanet(e.body)} ასრულებს უკუსვლას და პირდაპირ სვლაზე გადადის ${KA_IN[e.sign]}${h}`;
    default: return null;
  }
}

function enEvent(e, withDate) {
  const when = enWhen(e.at, withDate);
  const h = e.house ? ` — ${enHouse(e.house)}` : '';
  switch (e.type) {
    case 'new_moon': return `${when}: New Moon in ${enSign(e.sign)}${h}`;
    case 'full_moon': return `${when}: Full Moon in ${enSign(e.sign)}${h}`;
    case 'lunar_eclipse': return `${when}: ${e.kind} lunar eclipse in ${enSign(e.sign)}${h}`;
    case 'solar_eclipse': return `${when}: ${e.kind} solar eclipse in ${enSign(e.sign)}${h}`;
    case 'ingress': return `${when}: ${enPlanet(e.body)} enters ${enSign(e.sign)}${e.retro ? ' (retrograde)' : ''}${h}`;
    case 'moon_ingress': return `${when}: Moon enters ${enSign(e.sign)}${h}`;
    case 'station_retrograde': return `${when}: ${enPlanet(e.body)} turns retrograde in ${enSign(e.sign)}${h}`;
    case 'station_direct': return `${when}: ${enPlanet(e.body)} turns direct in ${enSign(e.sign)}${h}`;
    default: return null;
  }
}

export function factsKa(f) {
  const info = SIGN_INFO[f.sign];
  const withDate = f.kind !== 'day';
  const out = [`ნიშანი: ${info.ka} — ${KA_ELEMENT[info.element]} სტიქია, ${KA_MODALITY[info.modality]} ნიშანი, მმართველი პლანეტა: ${kaPlanet(info.ruler)}.`];
  out.push(f.kind === 'day' ? 'პლანეტები დღეს (შუადღისას):' : 'პლანეტები პერიოდის შუაში:');
  for (const b of f.bodies) out.push(`- ${kaPlanet(b.key)} ${KA_IN[b.sign]}, ${b.degree}°${b.retro ? ', უკუსვლაშია (რეტროგრადული)' : ''} — ${kaHouse(b.house)}`);
  if (f.ruler) out.push(`შენი მმართველი პლანეტა — ${kaPlanet(f.ruler.key)} — ახლა ${KA_IN[f.ruler.sign]}ა${f.ruler.retro ? ' და უკუსვლაშია' : ''}.`);
  if (f.phase) out.push(`მთვარის ფაზა: ${MOON_PHASE_NAMES[f.phase.key].ka}, განათებულია ${Math.round(f.phase.illumination * 100)}%${f.lunarDay ? `, მთვარის მე-${f.lunarDay} დღე` : ''}.`);
  const ev = f.events.map((e) => kaEvent(e, withDate)).filter(Boolean);
  if (ev.length) out.push('ცის მოვლენები (თბილისის დროით):', ...ev.map((l) => `- ${l}`));
  if (f.aspects.length) {
    out.push('ზუსტი ასპექტები (თბილისის დროით):',
      ...f.aspects.map((x) => `- ${kaWhen(x.at, withDate)} — ${kaPlanet(x.a)} და ${kaPlanet(x.b)}: ${ASPECT_KA[x.aspect]}`));
  }
  return out;
}

export function factsEn(f) {
  const info = SIGN_INFO[f.sign];
  const withDate = f.kind !== 'day';
  const out = [`Sign: ${info.en} (${info.element}, ${info.modality}, ruled by ${enPlanet(info.ruler)}).`];
  for (const b of f.bodies) out.push(`- ${enPlanet(b.key)} in ${enSign(b.sign)} ${b.degree}°${b.retro ? ', retrograde' : ''} — ${enHouse(b.house)}`);
  if (f.ruler) out.push(`Your ruler ${enPlanet(f.ruler.key)} is in ${enSign(f.ruler.sign)}${f.ruler.retro ? ' and retrograde' : ''}.`);
  if (f.phase) out.push(`Moon phase: ${MOON_PHASE_NAMES[f.phase.key].en}, ${Math.round(f.phase.illumination * 100)}% lit${f.lunarDay ? `, lunar day ${f.lunarDay}` : ''}.`);
  const ev = f.events.map((e) => enEvent(e, withDate)).filter(Boolean);
  if (ev.length) out.push('Sky events (Tbilisi time):', ...ev.map((l) => `- ${l}`));
  if (f.aspects.length) out.push('Exact aspects (Tbilisi time):', ...f.aspects.map((x) => `- ${enWhen(x.at, withDate)}: ${enPlanet(x.a)} ${x.aspect} ${enPlanet(x.b)}`));
  return out;
}

// ── Prompts ─────────────────────────────────────────────────────────────

export const WRITER_KA = `შენ ხარ MEDIHOROSCOPE-ის ასტროლოგი და ავტორი. MEDIHOROSCOPE არის MEDICARD-ის მოდული — უფასო ქართული აპლიკაციის ნაწილი.
წერ ზოდიაქოს ნიშნის ჰოროსკოპს რეალური ცის მიხედვით. პლანეტების მდებარეობა, ასპექტები და მოვლენები ასტრონომიულად ზუსტადაა გამოთვლილი თბილისის დროით და ქვემოთ გეძლევა — სხვა მდებარეობებს ნუ მოიგონებ.

როგორ წერ:
- წერ პირდაპირ ქართულად, როგორც კარგი ქართველი ავტორი პოპულარული ჟურნალისთვის. ეს არ არის თარგმანი: ქართული სიტყვათწყობა, ბუნებრივი ზმნები და ბრუნვები, ცოცხალი, თბილი, თანამედროვე ენა. მოკლე და მკაფიო წინადადებები ჯობია გრძელსა და ჩახლართულს.
- მკითხველს მიმართავ „შენ“-ით (მხოლობითი რიცხვი), სქესის მითითების გარეშე.
- ტექსტი კონკრეტულია ამ ნიშნისა და ამ პერიოდისთვის. ერთი-ორი რეალური ფაქტი ცისგან ჩართე უბრალო სიტყვებით (მაგალითად: „მთვარე დღეს მორიელშია“, „ვენერა უკუსვლაშია“) და აუხსენი, რას ნიშნავს ეს ადამიანისთვის. ტერმინს თუ ახსენებ, მოკლედ განმარტე.
- ფაქტებს ნუ ჩამოთვლი და ტექნიკურ დეტალებს (გრადუსებს, სახლების ნომრებს) ნუ გადმოიტან. ზუსტი საათი — მაქსიმუმ ერთხელ და მხოლოდ თუ მართლა მნიშვნელოვანია.
- შტამპები აკრძალულია: „ვარსკვლავები გეუბნებიან“, „სამყარო გიგზავნის“, „კოსმოსური ენერგია“, „ბედი გიღიმის“. არც ძახილის ნიშნები ზედიზედ, არც ემოჯი.
- პლანეტების ქართული სახელები: მზე, მთვარე, მერკური, ვენერა, მარსი, იუპიტერი, სატურნი, ურანი, ნეპტუნი, პლუტონი.

არასოდეს:
- ჯანმრთელობა და მედიცინა: არც დაავადება, სიმპტომი, სხეულის ნაწილები, დიეტა, წამალი, ორსულობა, ექიმი, ძილის პრობლემები. „განწყობა“ ეხება მხოლოდ ემოციურ ფონსა და ენერგიას.
- ფინანსური რჩევა: არც ინვესტიცია, კრიპტო, აზარტული თამაში, ლატარია, სესხი, კონკრეტული შენაძენი. წერე საქმეზე, გადაწყვეტილებებზე, ფულისადმი დამოკიდებულებაზე.
- შიში და ბედისწერა: არც წყევლა, საფრთხე, უბედური შემთხვევა, სიკვდილი, „ცუდი დღე“; არც დაპირება, რომ რამე აუცილებლად მოხდება. წერე შესაძლებლობებზე და არჩევანზე.
- პოლიტიკა, რელიგია, რეალური ადამიანები, ბრენდები.

პასუხი — მხოლოდ JSON ობიექტი, სხვა არაფერი.`;

export const EDITOR_KA = `შენ ხარ გამოცდილი ქართველი ლიტერატურული რედაქტორი. გეძლევა ჰოროსკოპის ქართული ტექსტი JSON-ში.
გააუმჯობესე მხოლოდ ენა: გრამატიკა, ბრუნვები, ზმნის ფორმები (მიმართვა „შენ“-ით, მხოლობითი), მართლწერა, სასვენი ნიშნები, ბუნებრივი ქართული სიტყვათწყობა.
მოაშორე კალკები და „თარგმნილი“ გამოთქმები, უხერხული, ბუნდოვანი ან ზედმეტად წიგნური ფრაზები, გამეორებები — ჩაანაცვლე ბუნებრივი ქართული გამოთქმით.
არ შეცვალო შინაარსი, ასტროლოგიური ფაქტები, დრო, თარიღები, რიცხვები და აზრი; სიგრძე დატოვე დაახლოებით იგივე. კარგ წინადადებას ნუ შეეხები. ახალ ინფორმაციას ნუ დაამატებ.
დააბრუნე ზუსტად იგივე JSON სტრუქტურა და იგივე გასაღებები — მხოლოდ JSON.`;

export const WRITER_EN = `You are the astrologer of MEDIHOROSCOPE, a module of MEDICARD — a free Georgian app.
Write a sun-sign horoscope in natural, warm, modern English, grounded in the REAL sky facts given (true positions for Tbilisi time; do not invent others).
- Address the reader as "you", gender-neutral. Specific to this sign and period; weave in one or two sky facts in plain words and say what they mean. No lists of jargon, no degrees or house numbers, at most one clock time.
- No clichés ("the stars are telling you", "the universe sends"), no emojis.
Never: health or medicine (no illness, symptoms, body, diet, medicines, pregnancy, doctors, sleep problems — "mood" is emotional tone only); money advice (no investments, crypto, gambling, lotteries, loans, purchases); fear or fate (no curses, danger, accidents, death, "bad days", no certain outcomes); politics, religion, real people, brands.
Return ONLY a JSON object.`;

const SHAPE_KA = {
  day: `{"headline":"სათაური, მაქს. 6 სიტყვა","general":"3–4 წინადადება","love":"1–2 წინადადება სიყვარულზე და ურთიერთობებზე","money":"1–2 წინადადება საქმეზე და ფულთან დაკავშირებულ გადაწყვეტილებებზე","mood":"1–2 წინადადება ემოციურ ფონსა და ენერგიაზე","tip":"დღის რჩევა — ერთი მოკლე, პრაქტიკული წინადადება","scores":{"love":1-5,"money":1-5,"mood":1-5},"lucky":{"number":1-99,"color":"${Object.keys(LUCKY_COLORS).join('|')}","time":"HH:00, 07:00-დან 22:00-მდე"}}`,
  week: '{"headline":"სათაური, მაქს. 6 სიტყვა","general":"4–5 წინადადება","love":"2 წინადადება","money":"2 წინადადება","mood":"2 წინადადება","tip":"ერთი მოკლე წინადადება","scores":{"love":1-5,"money":1-5,"mood":1-5},"bestDay":"mon|tue|wed|thu|fri|sat|sun"}',
  month: '{"headline":"სათაური, მაქს. 6 სიტყვა","general":"5–6 წინადადება","love":"2–3 წინადადება","money":"2–3 წინადადება","mood":"2 წინადადება","tip":"ერთი მოკლე წინადადება","scores":{"love":1-5,"money":1-5,"mood":1-5},"keyDates":[{"date":"YYYY-MM-DD","text":"მაქს. 10 სიტყვა"}] (2–4 თარიღი მოვლენებიდან)}',
  year: '{"headline":"სათაური, მაქს. 6 სიტყვა","general":"6–8 წინადადება","love":"3 წინადადება","money":"3 წინადადება","mood":"2–3 წინადადება","tip":"ერთი მოკლე წინადადება","scores":{"love":1-5,"money":1-5,"mood":1-5},"highlights":[{"month":"YYYY-MM","text":"მაქს. 12 სიტყვა"}] (4–6 თვე მოვლენებიდან)}',
};
const SHAPE_EN = {
  day: '{"headline":"≤ 6 words","general":"3–4 sentences","love":"1–2 sentences","money":"1–2 sentences on work and money decisions","mood":"1–2 sentences on emotional tone","tip":"one short practical sentence"}',
  week: '{"headline":"≤ 6 words","general":"4–5 sentences","love":"2 sentences","money":"2 sentences","mood":"2 sentences","tip":"one short sentence"}',
  month: '{"headline":"≤ 6 words","general":"5–6 sentences","love":"2–3 sentences","money":"2–3 sentences","mood":"2 sentences","tip":"one short sentence","keyDates":[{"date":"YYYY-MM-DD","text":"≤ 10 words"}] (2–4 dates from the events)}',
  year: '{"headline":"≤ 6 words","general":"6–8 sentences","love":"3 sentences","money":"3 sentences","mood":"2–3 sentences","tip":"one short sentence","highlights":[{"month":"YYYY-MM","text":"≤ 12 words"}] (4–6 months from the events)}',
};

const KA_PERIOD = {
  day: (k) => { const [, m, d] = k.split('-').map(Number); return `დღისთვის: ${d} ${KA_MONTHS[m - 1]}`; },
  week: (k) => { const [, m, d] = k.split('-').map(Number); return `კვირისთვის, რომელიც ორშაბათს, ${d} ${KA_MONTHS[m - 1]}-ს იწყება`; },
  month: (k) => `თვისთვის: ${KA_MONTHS[Number(k.slice(5)) - 1]}, ${k.slice(0, 4)}`,
  year: (k) => `${k} წლისთვის`,
};
const EN_PERIOD = {
  day: (k) => `the day ${k}`,
  week: (k) => `the week starting Monday ${k}`,
  month: (k) => `the month ${k}`,
  year: (k) => `the year ${k}`,
};
const KA_KIND = { day: 'დღის', week: 'კვირის', month: 'თვის', year: 'წლის' };

export function writerPromptKa(f, extraStyle = '') {
  return {
    system: extraStyle ? `${WRITER_KA}\n\nრედაქციის დამატებითი მითითებები:\n${extraStyle}` : WRITER_KA,
    user: `დაწერე ${KA_KIND[f.kind]} ჰოროსკოპი ნიშნისთვის „${SIGN_INFO[f.sign].ka}“ — ${KA_PERIOD[f.kind](f.key)}.\n\nრეალური ცა:\n${factsKa(f).join('\n')}\n\nდააბრუნე JSON ზუსტად ამ ფორმით:\n${SHAPE_KA[f.kind]}`,
  };
}

export function writerPromptEn(f, extraStyle = '') {
  return {
    system: extraStyle ? `${WRITER_EN}\n\nEditor's house style:\n${extraStyle}` : WRITER_EN,
    user: `Write the ${f.kind} horoscope for ${SIGN_INFO[f.sign].en} for ${EN_PERIOD[f.kind](f.key)}.\n\nReal sky facts:\n${factsEn(f).join('\n')}\n\nReturn JSON exactly in this shape:\n${SHAPE_EN[f.kind]}`,
  };
}

// ── Validation ──────────────────────────────────────────────────────────

const TEXT_KEYS = ['headline', 'general', 'love', 'money', 'mood', 'tip'];
const clampScore = (n) => Math.max(1, Math.min(5, Math.round(Number(n) || 3)));
const LATIN_WORD = /[A-Za-z]{4,}/;

export function readingTexts(obj, label, { georgian = false } = {}) {
  const out = {};
  for (const k of TEXT_KEYS) {
    const v = String(obj?.[k] || '').trim();
    if (!v) throw new Error(`${label}: missing ${k}`);
    const broken = brokenRule(v);
    if (broken) throw new Error(`${label}: ${k} broke a content rule („${broken}“)`);
    if (georgian && LATIN_WORD.test(v.replace(/MEDI[A-Z]+/g, ''))) throw new Error(`${label}: ${k} has Latin words`);
    out[k] = v;
  }
  return out;
}

/** Checks the Georgian author/editor answer and pulls the shared numbers out of it. */
export function normaliseKa(kind, data) {
  const out = { ka: readingTexts(data, 'ka', { georgian: true }) };
  out.scores = { love: clampScore(data?.scores?.love), money: clampScore(data?.scores?.money), mood: clampScore(data?.scores?.mood) };
  if (kind === 'day') {
    const lucky = data?.lucky || {};
    out.lucky = {
      number: Math.max(1, Math.min(99, Math.round(Number(lucky.number) || 7))),
      color: LUCKY_COLORS[lucky.color] ? lucky.color : 'gold',
      time: /^(0[7-9]|1\d|2[0-2]):00$/.test(lucky.time) ? lucky.time : '12:00',
    };
  }
  if (kind === 'week') out.bestDay = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].includes(data?.bestDay) ? data.bestDay : null;
  if (kind === 'month') {
    out.keyDates = (Array.isArray(data?.keyDates) ? data.keyDates : [])
      .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d?.date) && d.text).slice(0, 4).map((d) => ({ date: d.date, ka: String(d.text) }));
  }
  if (kind === 'year') {
    out.highlights = (Array.isArray(data?.highlights) ? data.highlights : [])
      .filter((d) => /^\d{4}-\d{2}$/.test(d?.month) && d.text).slice(0, 6).map((d) => ({ month: d.month, ka: String(d.text) }));
  }
  return out;
}

/** Adds the English answer to a Georgian reading; dates/months are matched by value. */
export function mergeEn(kind, reading, data) {
  const out = { ...reading, en: readingTexts(data, 'en') };
  const byKey = (arr, k) => new Map((Array.isArray(arr) ? arr : []).map((x) => [x?.[k], String(x?.text || '')]));
  if (kind === 'month') {
    const en = byKey(data?.keyDates, 'date');
    out.keyDates = reading.keyDates.map((d) => ({ ...d, en: en.get(d.date) || '' }));
  }
  if (kind === 'year') {
    const en = byKey(data?.highlights, 'month');
    out.highlights = reading.highlights.map((d) => ({ ...d, en: en.get(d.month) || '' }));
  }
  return out;
}

/** The editor's JSON: the six texts plus dated lines, all in Georgian. */
export function editorInput(reading) {
  const out = {};
  for (const k of TEXT_KEYS) out[k] = reading.ka[k];
  if (reading.keyDates) out.keyDates = reading.keyDates.map((d) => ({ date: d.date, text: d.ka }));
  if (reading.highlights) out.highlights = reading.highlights.map((d) => ({ month: d.month, text: d.ka }));
  return out;
}

export function applyEditor(reading, edited) {
  const next = { ...reading, ka: readingTexts(edited, 'ka-edited', { georgian: true }) };
  if (reading.keyDates && Array.isArray(edited?.keyDates)) {
    const m = new Map(edited.keyDates.map((d) => [d?.date, String(d?.text || '')]));
    next.keyDates = reading.keyDates.map((d) => ({ ...d, ka: m.get(d.date) || d.ka }));
  }
  if (reading.highlights && Array.isArray(edited?.highlights)) {
    const m = new Map(edited.highlights.map((d) => [d?.month, String(d?.text || '')]));
    next.highlights = reading.highlights.map((d) => ({ ...d, ka: m.get(d.month) || d.ka }));
  }
  return next;
}

// ── Pipeline ────────────────────────────────────────────────────────────

const MAX_TOKENS = { day: 6000, week: 7000, month: 9000, year: 12000 };

async function twice(fn) {
  try {
    return await fn(0);
  } catch {
    return fn(1);
  }
}

/**
 * One reading in three passes: the Georgian author writes, the Georgian editor polishes the
 * language, the English author writes its own version from the same sky.
 * models = { writer, editor ('none' skips it), english } — OpenRouter ids from llm.js.
 */
export async function generateSignReading({ sign, kind, key, models = {}, extraStyle = '' }) {
  const f = skyFacts(sign, kind, key);
  const usage = [];
  const track = (res) => { usage.push({ model: res.model, cost: Number(res.usage?.cost) || 0 }); return res.data; };

  const draft = await twice(async (attempt) => normaliseKa(kind, track(await askJson({
    ...writerPromptKa(f, extraStyle), model: models.writer, maxTokens: MAX_TOKENS[kind], temperature: attempt ? 0.6 : 0.85,
  }))));

  let reading = draft;
  if (models.editor !== 'none') {
    try {
      reading = applyEditor(draft, track(await askJson({
        system: EDITOR_KA, user: JSON.stringify(editorInput(draft), null, 1), model: models.editor, maxTokens: MAX_TOKENS[kind], temperature: 0.2,
      })));
    } catch {
      reading = draft; // the unedited draft is still a valid reading
    }
  }

  const en = await twice(async (attempt) => track(await askJson({
    ...writerPromptEn(f, extraStyle), model: models.english || models.writer, maxTokens: MAX_TOKENS[kind], temperature: attempt ? 0.6 : 0.8,
  })));
  const body = mergeEn(kind, reading, en);
  return {
    body,
    draftKa: reading === draft ? null : draft.ka,
    snapshot: f.snapshot,
    model: [...new Set(usage.map((u) => u.model))].join(' + '),
    costUsd: Math.round(usage.reduce((s, u) => s + u.cost, 0) * 10000) / 10000,
  };
}
