// Medi for a child: the deterministic safety layer. Danger signs are checked BEFORE the model writes a
// word; the model may raise the level, never lower it (rules from WHO IMCI, NICE fever traffic light,
// NHS 999/111, AAP — see docs/MEDIFAMILY-RESEARCH.md, section on AI safety). A Georgian
// pediatrician should review this table; tests in pediatricPolicy.test.js pin every rule.

export const LEVELS = Object.freeze(['INFO', 'HOME_CARE', 'ROUTINE', 'SEE_DOCTOR_24H', 'SEE_DOCTOR_TODAY', 'EMERGENCY_NOW']);
const RANK = Object.fromEntries(LEVELS.map((level, i) => [level, i]));

export function rankOf(level) {
  return RANK[level] ?? 0;
}

export function strongerLevel(a, b) {
  return rankOf(a) >= rankOf(b) ? (a || 'INFO') : (b || 'INFO');
}

/** Emergency signs at any age (Tier E) — Georgian stems and English. */
const EMERGENCY_SIGNS = [
  { key: 'breathing', re: /(სუნთქვა\s*(უჭირს|გაუჭირდა|შეუწყდა|უჩერდება|შეწყვიტა)|ვერ\s*სუნთქავს|არ\s*სუნთქავს|ხრიალებს|ჰაერი\s*არ\s*ყოფნის|ნეკნები\s*(ეწევა|ჩაეწევა)|can'?t\s+breathe|not\s+breathing|struggling\s+to\s+breathe|stopped\s+breathing|grunting|gasping)/i },
  { key: 'choking', re: /(ეხრჩობა|დაიხრჩო|გაეჭედა|გაიჭედა\s*ყელში|choking|choked)/i },
  { key: 'colour', re: /(გალურჯ|ლურჯი\s*(ტუჩ|კან|ენ)|ტუჩები\s*გაულურჯდა|ნაცრისფერი\s*(გახდა|კან)|მარმარილოსებრი\s*კან|turn(ed|ing)?\s+blue|blue\s+lips|grey\s+skin|mottled)/i },
  { key: 'unresponsive', re: /(არ\s*იღვიძებს|ვერ\s*(ვაღვიძებ|გავაღვიძე)|გონება\s*დაკარგა|უგონოდ|არ\s*რეაგირებს|გაითიშა|ძალიან\s*მოდუნებული|won'?t\s+wake|can'?t\s+wake|unresponsive|not\s+responding|passed\s+out|unconscious|floppy)/i },
  { key: 'seizure', re: /(კრუნჩხვ|გაეჭიმა\s*და\s*(კანკალ|ცახცახ)|seizure|convuls|fitting)/i },
  { key: 'rash', re: /(გამონაყარი.{0,40}(არ\s*ქრება|ჭიქ)|წერტილოვანი\s*(მეწამული|წითელი)?\s*გამონაყარი|მეწამული\s*ლაქ|rash.{0,30}(doesn'?t|does\s+not|won'?t)\s+fade|glass\s+test|purple\s+spots|petechia)/i },
  { key: 'neck', re: /(კისერი\s*(გაუშეშდა|უშეშდება|ვერ\s*მოხარა|არ\s*იხრება)|კისრის\s*სიხისტ|stiff\s+neck)/i },
  { key: 'greenVomit', re: /(მწვანე\s*(ფერის\s*)?ღებინ|ღებინებ\S*\s*მწვანე|ნაღვლიანი\s*ღებინ|green\s+vomit|vomit(ing)?\s+green|bilious)/i },
  { key: 'fontanelle', re: /(ყიფლიბანდი\s*(ამობურცული|ამოიბურცა|დაჭიმული|ამოწეული)|bulging\s+(soft\s+spot|fontanel))/i },
  { key: 'allergy', re: /(ტუჩ\S*|ენ(ა|ის)|სახე)\s*(გაუსივდა|შეშუპ|სივდება)|ალერგიული\s*შოკ|ანაფილაქს|swollen\s+(lips|tongue|face)|anaphyla/i },
  { key: 'poison', re: /(გადაყლაპა|შეჭამა\s*(აბ|წამალ|ბატარე)|დალია\s*(წამალ|სარეცხ|ქიმი|ალკოჰოლ)|მოწამვლ|ზედმეტი\s*დოზა|ორმაგი\s*დოზა|ორჯერ\s*მივეცი|swallowed|poison|overdose|double\s+dose|ate\s+(pills|medicine|a\s+battery))/i },
  { key: 'selfHarm', re: /(თავის\s*მოკვლ|თვითდაზიან|სიცოცხლე\s*აღარ\s*უნდა|suicid|self-?harm|kill\s+(him|her|them)sel)/i },
  { key: 'headInjury', re: /(თავი\s*(დაარტყა|დაეცა|დაიზიანა).{0,60}(ღებინ|გონ|ძილიან|უცნაურად)|head\s+injury.{0,60}(vomit|unconscious|drowsy))/i },
];

/** Same-day signs (Tier U) regardless of temperature. */
const TODAY_SIGNS = [
  { key: 'noUrine', re: /(არ\s*(უ)?შარდავს|მშრალი\s*საფენი|საფენი\s*(მშრალია|არ\s*დასველ)|no\s+wet\s+diaper|hasn'?t\s+peed|not\s+peeing)/i },
  { key: 'noDrink', re: /(არაფერს\s*(სვამს|წოვს)|არ\s*წოვს\s*მკერდს|არ\s*სვამს\s*არაფერს|ყველაფერს\s*აღებინებს|won'?t\s+drink|refus\w*\s+(all\s+)?(feeds|to\s+drink)|vomits?\s+everything)/i },
  { key: 'limp', re: /(კოჭლობ|ფეხს\s*ვერ\s*(ადგამს|დგამს)|სახსარი\s*გაუსივდა|limp(ing)?|won'?t\s+use\s+(his|her|their)\s+(arm|leg)|swollen\s+joint)/i },
  { key: 'pale', re: /(ძალიან\s*ფერმკრთალ|გაფითრდა|very\s+pale)/i },
  { key: 'headHit', re: /(თავი\s*(დაარტყა|დაეცა|დაიზიანა)|head\s+(injury|bump|hit))/i },
  { key: 'testis', re: /(სათესლე\s*(ჯირკვ|პარკ)\S*\s*(სტკივა|ტკივ|გაუსივდა)|testic\w*\s+pain)/i },
];

const FEVER_WORDS = /(სიცხ|ტემპერატურ|ცხელებ|°|გრადუს|fever|temp)/i;
const TEMP_RE = /(?<![\d.,])(3[4-9]|4[0-2])(?:[.,](\d))?(?![\d])/g;
const NOT_TEMP_AFTER = /^\s*(წუთ|საათ|სთ|დღ|კვირ|თვ|წლ|კგ|გრ(?!ად)|სმ|მლ|მგ|min|hour|hr|day|week|month|year|kg|g\b|cm|ml|mg|%)/i;
const FIVE_DAYS = /(5|ხუთი|მეხუთე|6|ექვსი|მეექვსე|7|შვიდი|კვირაა)\s*(დღე|დღეა|დღეზე\s*მეტ)|(5|five|6|six|7|seven)\s+days/i;
const THREE_DAYS = /(3|სამი|მესამე|4|ოთხი|მეოთხე)\s*(დღე|დღეა)|(3|three|4|four)\s+days/i;
const TWO_DAYS = /(2|ორი|მეორე)\s*(დღე|დღეა)|(გუშინდლიდან|გუშინ\s*დილიდან)|(2|two)\s+days|since\s+yesterday/i;

/** Highest temperature mentioned in the text (only when the text talks about fever/temperature). */
export function temperatureFromText(text) {
  const value = String(text || '');
  if (!FEVER_WORDS.test(value)) return null;
  let max = null;
  for (const match of value.matchAll(TEMP_RE)) {
    // „40 წუთი“, „36 საათია“, „38 კგ“ are not temperatures.
    if (NOT_TEMP_AFTER.test(value.slice(match.index + match[0].length, match.index + match[0].length + 12))) continue;
    const t = Number(`${match[1]}.${match[2] || '0'}`);
    if (t >= 34 && t <= 42.9) max = max == null ? t : Math.max(max, t);
  }
  return max;
}

/**
 * Rule triage. Inputs: the parent's message, the child's chronological age in days, temperatures the parent
 * logged in the last 24 h ({ c, at }), the longest fever stretch in days from the log, and saved conditions.
 * Returns { level, reasons } — reasons are keys the app and telemetry use (never free text).
 */
export function ruleTriage({ text = '', ageDays = 365 * 5, loggedTemps = [], feverDays = 0, conditions = [] } = {}) {
  const reasons = [];
  let level = 'INFO';
  const raise = (to, reason) => { level = strongerLevel(level, to); reasons.push(reason); };

  for (const sign of EMERGENCY_SIGNS) if (sign.re.test(text)) raise('EMERGENCY_NOW', sign.key);
  for (const sign of TODAY_SIGNS) if (sign.re.test(text)) raise('SEE_DOCTOR_TODAY', sign.key);

  const fromText = temperatureFromText(text);
  const fromLog = loggedTemps.reduce((max, row) => (Number(row.c) > max ? Number(row.c) : max), 0) || null;
  const temp = Math.max(fromText || 0, fromLog || 0) || null;
  const mentionsFever = FEVER_WORDS.test(text) || temp != null;

  if (temp != null) {
    if (ageDays < 90 && temp >= 38) raise('EMERGENCY_NOW', 'feverUnder3m');
    else if (ageDays < 90 && temp < 35.5) raise('SEE_DOCTOR_TODAY', 'coldUnder3m');
    else if (ageDays < 183 && temp >= 39) raise('SEE_DOCTOR_TODAY', 'fever39Under6m');
    else if (temp >= 40) raise('SEE_DOCTOR_TODAY', 'fever40');
    else if (temp >= 38) raise('HOME_CARE', 'fever');
  } else if (ageDays < 90 && /(სიცხ|ცხელებ|fever)/i.test(text)) {
    // A baby under three months „feels hot“ but no reading: ask to measure now — treat as same-day.
    raise('SEE_DOCTOR_TODAY', 'feverUnder3mUnmeasured');
  }

  if (mentionsFever) {
    const days = Math.max(feverDays, FIVE_DAYS.test(text) ? 5 : THREE_DAYS.test(text) ? 3 : TWO_DAYS.test(text) ? 2 : 0);
    if (days >= 5) raise('SEE_DOCTOR_TODAY', 'fever5Days');
    else if (days >= 3 && ageDays >= 730) raise('SEE_DOCTOR_24H', 'fever3Days');
    else if (days >= 2 && ageDays < 730) raise('SEE_DOCTOR_24H', 'fever24hUnder2');
    const fragile = (conditions || []).some((c) => /(გულ|იმუნ|ონკო|ლეიკ|ქიმიო|თირკმ|heart|immun|cancer|leuk|chemo|kidney)/i.test(String(c)));
    if (fragile && (temp == null || temp >= 38)) raise('SEE_DOCTOR_TODAY', 'feverFragile');
  }
  return { level, reasons: [...new Set(reasons)], temperature: temp };
}

/** What the app shows on the answer's urgency card. */
export const LEVEL_COPY = Object.freeze({
  EMERGENCY_NOW: { ka: 'ახლავე დარეკე 112-ზე ან წადი უახლოეს სასწრაფო განყოფილებაში.', en: 'Call 112 now or go to the nearest emergency department.' },
  SEE_DOCTOR_TODAY: { ka: 'დღესვე, უახლოეს საათებში აჩვენე ექიმს.', en: 'See a doctor today, within the next few hours.' },
  SEE_DOCTOR_24H: { ka: 'დაუკავშირდი პედიატრს 24 საათის განმავლობაში.', en: 'Contact your pediatrician within 24 hours.' },
  ROUTINE: { ka: 'უთხარი პედიატრს შემდეგ ვიზიტზე.', en: 'Mention it at the next pediatrician visit.' },
  HOME_CARE: { ka: 'ახლა სახლში მოვლა საკმარისია — ქვემოთ წერია, როდის მიმართო ექიმს.', en: 'Home care is enough for now — below is when to see a doctor.' },
});

export function levelCopy(level, lang = 'ka') {
  const copy = LEVEL_COPY[level];
  return copy ? copy[lang === 'en' ? 'en' : 'ka'] : null;
}

/** The model's own level travels as the first line: „[[LEVEL: SEE_DOCTOR_24H]]“. */
const LEVEL_TAG = /^\s*\[\[\s*LEVEL\s*:\s*([A-Z_0-9]+)\s*\]\]\s*\n?/;

export function splitLevelTag(text) {
  const value = String(text || '');
  const match = LEVEL_TAG.exec(value);
  if (!match) return { level: null, body: value };
  return { level: LEVELS.includes(match[1]) ? match[1] : null, body: value.slice(match[0].length) };
}

/**
 * Streaming helper: holds the first characters back until the level tag is known, so the parent never sees
 * „[[LEVEL…“ flash on screen. Returns { push(chunk) → text to emit, flush() → rest, level() }.
 */
export function levelTagStripper() {
  let head = '';
  let decided = false;
  let level = null;
  return {
    push(chunk) {
      if (decided) return chunk;
      head += chunk;
      const trimmed = head.trimStart();
      if (!trimmed.startsWith('[') && trimmed.length > 0) { decided = true; const out = head; head = ''; return out; }
      if (/\]\]/.test(head) || head.length > 60) {
        const split = splitLevelTag(head);
        level = split.level;
        decided = true;
        head = '';
        return split.body;
      }
      return '';
    },
    flush() {
      if (decided) return '';
      const split = splitLevelTag(head);
      level = split.level;
      decided = true;
      const out = split.body;
      head = '';
      return out;
    },
    level: () => level,
  };
}

/** Dose numbers next to a medicine word — Medi must never write them for a child. */
const DOSE_RE = /(\d+([.,]\d+)?\s*(მგ|მლ|mg|ml|მილიგრამ|მილილიტრ|ჩაის\s*კოვზ|teaspoon)(\s*\/\s*(კგ|kg))?)/i;
const MED_WORDS = /(პარაცეტამოლ|იბუპროფენ|ნუროფენ|პანადოლ|ეფერალგან|ცეფეკონ|ანტიბიოტიკ|paracetamol|acetaminophen|ibuprofen|nurofen|calpol|tylenol|antibiotic)/i;

export function mentionsDoseNumbers(text) {
  const value = String(text || '');
  return MED_WORDS.test(value) && DOSE_RE.test(value);
}

export const DOSE_GUARD_NOTE = Object.freeze({
  ka: 'ბავშვის დოზას Medi არ ასახელებს — გამოიყენე შეფუთვაზე/ინსტრუქციაში მოცემული ცხრილი ბავშვის ახლანდელი წონით და კომპლექტის საზომი შპრიცი; თუ ცხრილი არ ფარავს მის ასაკს ან წონას, ჰკითხე ფარმაცევტს ან პედიატრს.',
  en: 'Medi does not give children’s doses — use the chart on the box or leaflet with the child’s current weight and the syringe that comes with it; if the chart doesn’t cover their age or weight, ask a pharmacist or pediatrician.',
});
