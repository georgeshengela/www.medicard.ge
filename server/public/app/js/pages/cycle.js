// MEDICARD web — Cycle („ციკლი“). Mirrors mobile/app/cycle/index.tsx + components/cycle/*:
// hero dial (CycleStatusGauge), one-tap „მენსტრუაცია დაიწყო“ with undo, month calendar with the app's
// grammar, day log (incl. the private sex & sex-drive section), „ჩემი ციკლი“ stats, cycle history,
// period-date editor (PUT /api/cycle/period/days) and daily tips.
// Honesty rules: every forecast is worded as an estimate („სავარაუდო“), never a diagnosis, no ISO dates in copy.
// Sex/sex-drive answers are HIGHLY_SENSITIVE: shown only to the owner, never sent to AI or analytics from here.
import {
  h, mount, icon, pageHead, section, card, button, iconButton, busy, empty, skeleton, errorBox, toast,
  openModal, confirmDialog, formModal, field, input, select, row, fmtDate, KA_MONTHS, KA_MONTHS_SHORT,
} from '../ui.js';
import { get, post, put, del } from '../api.js';
import { barChart, ring } from '../charts.js';
import { withAiConsent, aiDeclinedSlot, readAiConsent } from '../aiConsent.js';
import { featureOn, isFemale } from '../session.js';
import { t, isEn, plural } from '../i18n.js';

const CSS_HREF = '/app/css/cycle.css';
const APP_STORE = 'https://apps.apple.com/app/id6812517519';
const NS = 'http://www.w3.org/2000/svg';

function ensureCss() {
  if (!document.querySelector(`link[href="${CSS_HREF}"]`)) document.head.append(h('link', { rel: 'stylesheet', href: CSS_HREF }));
}

/* ── Catalogs (mobile/src/constants/cycle.ts, i18n ka.cycle) ─────────────────── */
const FLOWS = [
  { id: 'none', label: t('არა', 'None') }, { id: 'spotting', label: t('ლაქები', 'Spotting') }, { id: 'light', label: t('მსუბუქი', 'Light') },
  { id: 'medium', label: t('ზომიერი', 'Medium') }, { id: 'heavy', label: t('ძლიერი', 'Heavy') },
];
const SYMPTOMS = [
  ['cramps', t('სპაზმები', 'Cramps')], ['headache', t('თავის ტკივილი', 'Headache')], ['bloating', t('შებერილობა', 'Bloating')], ['fatigue', t('დაღლილობა', 'Fatigue')],
  ['back_pain', t('წელის ტკივილი', 'Lower back pain')], ['breast_tenderness', t('მკერდის მგრძნობელობა', 'Tender breasts')], ['acne', t('აკნე', 'Acne')], ['nausea', t('გულისრევა', 'Nausea')],
  ['cravings', t('საკვების ლტოლვა', 'Cravings')], ['insomnia', t('უძილობა', 'Insomnia')], ['migraine', t('მიგრენი', 'Migraine')], ['dizziness', t('თავბრუსხვევა', 'Dizziness')],
  ['pelvic_pain', t('მენჯის ტკივილი', 'Pelvic pain')], ['ovulation_pain', t('ოვულაციის ტკივილი', 'Ovulation pain')],
  ['breast_swelling', t('მკერდის შეშუპება', 'Breast swelling')], ['vomiting', t('ღებინება', 'Vomiting')], ['heartburn', t('გულძმარვა', 'Heartburn')], ['oversleep', t('ძილიანობა', 'Sleepiness')],
  ['appetite_up', t('მადის მატება', 'More appetite')], ['appetite_down', t('მადის კლება', 'Less appetite')], ['hot_flashes', t('ცხელი ტალღები', 'Hot flashes')], ['night_sweats', t('ღამის ოფლიანობა', 'Night sweats')],
  ['chills', t('შეცივება', 'Chills')], ['sweating', t('ოფლიანობა', 'Sweating')], ['constipation', t('ყაბზობა', 'Constipation')], ['diarrhea', t('დიარეა', 'Diarrhea')], ['gas', t('გაზები', 'Gas')],
  ['joint_pain', t('სახსრების ტკივილი', 'Joint pain')], ['muscle_pain', t('კუნთების ტკივილი', 'Muscle pain')], ['leg_cramps', t('ფეხის სპაზმები', 'Leg cramps')], ['swelling', t('შეშუპება', 'Swelling')],
  ['water_retention', t('წყლის შეკავება', 'Water retention')], ['dry_skin', t('მშრალი კანი', 'Dry skin')], ['oily_skin', t('ცხიმიანი კანი', 'Oily skin')], ['itchy_skin', t('ქავილი', 'Itchy skin')],
  ['hair_loss', t('თმის ცვენა', 'Hair loss')], ['sensitive_smell', t('სუნის მგრძნობელობა', 'Sensitive to smells')], ['tinnitus', t('ყურებში ხმაური', 'Ringing in ears')], ['palpitations', t('გულისცემა', 'Palpitations')],
  ['short_breath', t('სუნთქვის სიმძიმე', 'Short of breath')], ['frequent_urination', t('ხშირი შარდვა', 'Frequent urination')], ['uti_feel', t('შარდის დისკომფორტი', 'Urinary discomfort')],
  ['vaginal_dryness', t('საშოს სიმშრალე', 'Vaginal dryness')], ['discharge', t('გამონადენი', 'Discharge')], ['itching_vulva', t('ქავილი (გენიტალური)', 'Genital itching')], ['fever', t('ცხელება', 'Fever')],
  ['cold_symptoms', t('გაციების სიმპტომები', 'Cold symptoms')],
].map(([id, label]) => ({ id, label }));
const SYMPTOMS_VISIBLE = 14;
const MOODS = [
  ['energetic', t('ენერგიული', 'Energetic')], ['calm', t('მშვიდი', 'Calm')], ['happy', t('ბედნიერი', 'Happy')], ['confident', t('თავდაჯერებული', 'Confident')], ['sensitive', t('მგრძნობიარე', 'Sensitive')],
  ['anxious', t('შფოთვა', 'Anxious')], ['irritable', t('გაღიზიანება', 'Irritable')], ['angry', t('გაბრაზებული', 'Angry')], ['sad', t('სევდიანი', 'Sad')], ['tearful', t('ცრემლიანი', 'Tearful')],
  ['mood_swings', t('განწყობის ცვლა', 'Mood swings')], ['focused', t('კონცენტრირებული', 'Focused')], ['unfocused', t('გაფანტული', 'Distracted')], ['tired_mood', t('დაღლილი', 'Tired')],
  ['apathetic', t('აპათიური', 'Apathetic')], ['stressed', t('სტრესი', 'Stressed')], ['romantic', t('რომანტიკული', 'Romantic')], ['lonely', t('მარტოობა', 'Lonely')],
].map(([id, label]) => ({ id, label }));
/** Flo's "Sex and sex drive". Any activity chip = yes; „არ მქონია“ = no; nothing = not answered. */
const SEX_ACTIVITY = [
  ['protected', t('დაცული სექსი', 'Protected sex')], ['unprotected', t('დაუცველი სექსი', 'Unprotected sex')], ['oral_sex', t('ორალური', 'Oral')], ['anal_sex', t('ანალური', 'Anal')],
  ['sensual_touch', t('სენსუალური შეხება', 'Sensual touch')], ['masturbation', t('მასტურბაცია', 'Masturbation')], ['sex_toys', t('სათამაშოები', 'Sex toys')], ['orgasm', t('ორგაზმი', 'Orgasm')],
  ['pain_sex', t('ტკივილი სექსისას', 'Pain during sex')],
].map(([id, label]) => ({ id, label }));
const SEX_DRIVE = [{ id: 'high_drive', label: t('მაღალი', 'High') }, { id: 'neutral_drive', label: t('ჩვეულებრივი', 'Neutral') }, { id: 'low_drive', label: t('დაბალი', 'Low') }];
const SEX_ACTIVITY_IDS = new Set(SEX_ACTIVITY.map((o) => o.id));
const SEX_IDS = new Set([...SEX_ACTIVITY, ...SEX_DRIVE].map((o) => o.id));
const MUCUS = [
  { id: 'dry', label: t('მშრალი', 'Dry') }, { id: 'sticky', label: t('წებოვანი', 'Sticky') }, { id: 'creamy', label: t('კრემისებრი', 'Creamy') },
  { id: 'watery', label: t('წყლიანი', 'Watery') }, { id: 'eggwhite', label: t('კვერცხის ცილისებრი', 'Egg white') },
];
const TESTS = [{ id: 'negative', label: t('უარყოფითი', 'Negative') }, { id: 'positive', label: t('დადებითი', 'Positive') }, { id: 'unclear', label: t('გაურკვეველი', 'Unclear') }];
const PAIN_TYPES = [
  { id: 'cramps', label: t('სპაზმები', 'Cramps') }, { id: 'pelvic', label: t('მენჯის ტკივილი', 'Pelvic pain') }, { id: 'lower_back', label: t('წელის ტკივილი', 'Lower back pain') },
  { id: 'headache', label: t('თავის ტკივილი', 'Headache') }, { id: 'breast', label: t('მკერდის ტკივილი', 'Breast pain') }, { id: 'ovulation_side', label: t('ცალმხრივი ტკივილი', 'One-sided pain') },
  { id: 'other', label: t('სხვა', 'Other') },
];
const PAIN_SEVERITY = [{ id: 'mild', label: t('მსუბუქი', 'Mild') }, { id: 'moderate', label: t('ზომიერი', 'Moderate') }, { id: 'severe', label: t('ძლიერი', 'Severe') }];
const LIFESTYLE = [
  { key: 'sleepQuality', label: t('ძილი', 'Sleep'), options: [['poor', t('ცუდი', 'Poor')], ['okay', t('საშუალო', 'Okay')], ['good', t('კარგი', 'Good')]] },
  { key: 'stressLevel', label: t('სტრესი', 'Stress'), options: [['low', t('დაბალი', 'Low')], ['medium', t('საშუალო', 'Medium')], ['high', t('მაღალი', 'High')]] },
  { key: 'exerciseLevel', label: t('აქტივობა', 'Exercise'), options: [['none', t('არა', 'None')], ['light', t('მსუბუქი', 'Light')], ['moderate', t('ზომიერი', 'Moderate')], ['intense', t('ინტენსიური', 'Intense')]] },
  { key: 'caffeine', label: t('კოფეინი', 'Caffeine'), options: [['none', t('არა', 'None')], ['low', t('ცოტა', 'A little')], ['moderate', t('საშუალო', 'Moderate')], ['high', t('ბევრი', 'A lot')]] },
  { key: 'alcohol', label: t('ალკოჰოლი', 'Alcohol'), options: [['none', t('არა', 'None')], ['light', t('ცოტა', 'A little')], ['moderate', t('საშუალო', 'Moderate')], ['heavy', t('ბევრი', 'A lot')]] },
].map((g) => ({ ...g, options: g.options.map(([id, label]) => ({ id, label })) }));
const ENERGY = [
  { id: 'very_low', label: t('ძალიან დაბალი', 'Very low') }, { id: 'low', label: t('დაბალი', 'Low') }, { id: 'normal', label: t('ჩვეულებრივი', 'Normal') },
  { id: 'high', label: t('მაღალი', 'High') }, { id: 'very_high', label: t('ძალიან მაღალი', 'Very high') },
];
const WEEKDAYS = t(['ორშ', 'სამ', 'ოთხ', 'ხუთ', 'პარ', 'შაბ', 'კვი'], ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
const MODE_LABEL = {
  TRACK_PERIOD: t('ციკლის თვალყური', 'Track my cycle'), TRY_TO_CONCEIVE: t('ორსულობის მცდელობა', 'Trying to conceive'), PREGNANCY: t('ორსულობის რეჟიმი', 'Pregnancy mode'),
  PERIMENOPAUSE: t('პერიმენოპაუზის თვალყური', 'Perimenopause tracking'), POSTPARTUM: t('მშობიარობის შემდეგ', 'Postpartum'),
};
/** cycleModeCapabilityMatrix.js — the subset the web presents. */
const CAPS = {
  TRACK_PERIOD: { forecast: true, late: true, fertile: true },
  TRY_TO_CONCEIVE: { forecast: true, late: true, fertile: true, ttc: true },
  PREGNANCY: { forecast: false, late: false, fertile: false, pregnancy: true },
  PERIMENOPAUSE: { forecast: true, late: false, fertile: false, peri: true },
  POSTPARTUM: { forecast: false, late: false, fertile: false, postpartum: true },
};
const LABEL = Object.fromEntries([...FLOWS, ...SYMPTOMS, ...MOODS, ...SEX_ACTIVITY, ...MUCUS].map((o) => [o.id, o.label]));

/** cycleAdvice.ts DAILY_TIPS — soft, non-medical wording; three a day, rotating with the cycle day. */
const DAILY_TIPS = {
  period: [
    ['care', t('სითბო ამშვიდებს', 'Warmth soothes'), t('თბილი კომპრესი მუცელზე ან თბილი შხაპი სპაზმებისას ბევრს ეხმარება.', 'A warm pad on your belly or a warm shower helps many people with cramps.')],
    ['care', t('რკინით მდიდარი საკვები', 'Iron-rich foods'), t('ლობიო, ისპანახი, წითელი ხორცი ან თხილი რკინის მარაგის შენარჩუნებაში გეხმარება.', 'Beans, spinach, red meat or nuts help keep your iron up.')],
    ['energy', t('მსუბუქი მოძრაობა', 'Gentle movement'), t('ნელი სეირნობა ან გაწელვა ზოგს ტკივილს უმსუბუქებს — მოუსმინე სხეულს.', 'A slow walk or stretching eases pain for some people — listen to your body.')],
    ['calm', t('წყალი და თბილი ჩაი', 'Water and warm tea'), t('საკმარისი სითხე შებერილობას ამცირებს, თბილი ჩაი კი სიმშვიდეს გმატებს.', 'Enough fluids ease bloating, and warm tea adds a little calm.')],
    ['calm', t('დასვენება ნორმალურია', 'Resting is normal'), t('ენერგია დაბალია? დღეს ადრე დაძინება კარგი არჩევანია.', 'Low on energy? Going to bed early tonight is a good choice.')],
  ],
  follicular: [
    ['energy', t('ენერგიის დღეები', 'Energy days'), t('ენერგია ხშირად იზრდება — კარგი დროა აქტიური ვარჯიშისთვის ან ახალი გეგმისთვის.', 'Energy often rises — a good time for an active workout or a new plan.')],
    ['care', t('ცილა და ბოსტნეული', 'Protein and veggies'), t('ცილა, ბოსტნეული და მთლიანი მარცვლეული ენერგიას დღის განმავლობაში სტაბილურად ინარჩუნებს.', 'Protein, vegetables and whole grains keep your energy steady through the day.')],
    ['mood', t('ფოკუსის დრო', 'Focus time'), t('ამ დღეებში კონცენტრაცია ხშირად უფრო ადვილია — რთული საქმეები ახლა დაგეგმე.', 'Focusing is often easier these days — plan harder tasks now.')],
    ['energy', t('სცადე რამე ახალი', 'Try something new'), t('ახალი ვარჯიში, რეცეპტი ან ჰობი — ბევრი ქალი ამ ფაზაში უფრო ცნობისმოყვარედ გრძნობს თავს.', 'A new workout, recipe or hobby — many women feel more curious in this phase.')],
    ['calm', t('ძილის რიტმი', 'Sleep rhythm'), t('ერთსა და იმავე დროს დაძინება მთელი ციკლის განმავლობაში ენერგიას აწონასწორებს.', 'Going to bed at the same time throughout your cycle helps balance your energy.')],
  ],
  fertile: [
    ['energy', t('აქტიური დღეები', 'Active days'), t('ბევრი ქალი ამ დღეებში ყველაზე ენერგიულად და თავდაჯერებულად გრძნობს თავს.', 'Many women feel their most energetic and confident these days.')],
    ['calm', t('საკმარისი წყალი', 'Enough water'), t('დღეში 6–8 ჭიქა სითხე ენერგიასა და კონცენტრაციას ეხმარება.', '6–8 glasses of fluids a day help your energy and focus.')],
    ['care', t('სხეულის ნიშნები', 'Body signs'), t('გამონადენის ცვლილებები ამ დღეებში ჩვეულებრივია — შეგიძლია აღრიცხო და შენს რიტმს დაინახავ.', 'Changes in discharge are common these days — log them and you’ll see your pattern.')],
    ['mood', t('სოციალური დღეები', 'Social days'), t('ურთიერთობები ახლა ხშირად უფრო მარტივია — კარგი დროა შეხვედრებისთვის.', 'Connecting with people often feels easier now — a good time to meet up.')],
  ],
  luteal: [
    ['care', t('მაგნიუმით მდიდარი საკვები', 'Magnesium-rich foods'), t('მწვანე ფოთლოვანი ბოსტნეული, თხილეული და მუქი შოკოლადი მაგნიუმს შეიცავს — ზოგს PMS-ის შემსუბუქებაში ეხმარება.', 'Leafy greens, nuts and dark chocolate contain magnesium — it helps some people with PMS.')],
    ['calm', t('ძილი უფრო მნიშვნელოვანია', 'Sleep matters more'), t('ამ ფაზაში ძილი შეიძლება გაუარესდეს — ეკრანები დაძინებამდე ერთი საათით ადრე გამორთე.', 'Sleep can get worse in this phase — turn off screens an hour before bed.')],
    ['care', t('ნაკლები მარილი და კოფეინი', 'Less salt and caffeine'), t('შებერილობისა და მკერდის მგრძნობელობისას მარილისა და კოფეინის შემცირება ზოგს ეხმარება.', 'With bloating or breast tenderness, cutting back on salt and caffeine helps some people.')],
    ['energy', t('ნაზი მოძრაობა', 'Gentle movement'), t('იოგა, პილატესი ან სეირნობა განწყობასაც აუმჯობესებს და შებერილობასაც ამცირებს.', 'Yoga, Pilates or a walk can lift your mood and ease bloating.')],
    ['mood', t('იყავი შენთვის კეთილი', 'Be kind to yourself'), t('განწყობის რყევა ამ დღეებში ხშირია — დაგეგმე პატარა სასიამოვნო რამ საკუთარი თავისთვის.', 'Mood swings are common these days — plan something small and nice for yourself.')],
  ],
};
const TIP_ICON = { care: 'heart', energy: 'zap', fertile: 'flower', calm: 'moon', mood: 'sparkles', pregnancy: 'heart' };

function dailyTips(phase, day) {
  const key = phase === 'ovulation' ? 'fertile' : phase;
  const list = DAILY_TIPS[key];
  if (!list) return [];
  const start = (day ?? 0) % list.length;
  return [0, 1, 2].map((i) => {
    const [tone, title, body] = list[(start + i) % list.length];
    return { id: `tip_${key}_${i}`, tone, title, body, action: null };
  });
}

/* ── Date keys (civil, no time zone drift) ───────────────────────────────── */
const pad2 = (n) => String(n).padStart(2, '0');
const dateKey = (y, m, d) => `${y}-${pad2(m + 1)}-${pad2(d)}`;
const keyUtc = (k) => { const [y, m, d] = String(k).slice(0, 10).split('-').map(Number); return Date.UTC(y, m - 1, d); };
const daysBetween = (a, b) => Math.round((keyUtc(b) - keyUtc(a)) / 86400000);
const addKey = (k, n) => new Date(keyUtc(k) + n * 86400000).toISOString().slice(0, 10);
const deviceToday = () => { const n = new Date(); return dateKey(n.getFullYear(), n.getMonth(), n.getDate()); };
/** Server civil today, never behind the device (cycleCanonical.cycleToday). */
const cycleToday = (b) => { const s = b?.meta?.today; const d = deviceToday(); return !s ? d : d > s ? d : s; };
const shortDate = (k) => { const [, m, d] = k.split('-').map(Number); return `${d} ${KA_MONTHS_SHORT[m - 1]}`; };

const isBleed = (flow) => flow === 'light' || flow === 'medium' || flow === 'heavy';

/** „13–15 ოქტ“ inside one month, „30 სექ – 2 ოქტ“ across two (mobile cycleForecastCopy.shortDateRange). */
function shortRange(a, b) {
  if (!a || !b || a === b) return shortDate(a || b);
  if (a.slice(0, 7) === b.slice(0, 7)) return `${Number(a.slice(8, 10))}–${shortDate(b)}`;
  return `${shortDate(a)} – ${shortDate(b)}`;
}

/* ── Forecast honesty copy (mobile src/lib/cycleForecastCopy.ts — same words) ─ */
const FERTILITY_MIN_CYCLES = 3;
const clampCycles = (n, req) => Math.max(0, Math.min(req, Math.floor(n) || 0));
const learningBadgeText = (done, req = FERTILITY_MIN_CYCLES) => {
  const n = clampCycles(done, req);
  return t(`ვსწავლობთ შენს რიტმს · ${n}/${req} ციკლი`, `Learning your rhythm · ${n}/${req} ${req === 1 ? 'cycle' : 'cycles'}`);
};
const learningBadgeExplain = (req = FERTILITY_MIN_CYCLES) => t(
  `ნაყოფიერ დღეებს და სავარაუდო ოვულაციას ${req} სრული ციკლის აღრიცხვის შემდეგ ვაჩვენებთ — მანამდე ნებისმიერი თარიღი გამოცნობა იქნებოდა.`,
  `We show fertile days and estimated ovulation after ${req} logged, completed cycles — before that any date would be a guess.`,
);
const statsLearningChip = (done, req = FERTILITY_MIN_CYCLES) => {
  const n = clampCycles(done, req);
  return t(`ვსწავლობთ · ${n}/${req}`, `Learning · ${n}/${req}`);
};
const wideWindowLabel = () => t('ფართო დიაპაზონი, სანამ 3 ციკლს დავითვლით', 'A wide range until we have counted 3 cycles');
const ovulationSourceLabel = (source) => (source === 'manual' ? t('შენი აღნიშვნით', 'From your own mark') : source === 'opk' ? t('OPK-ის მიხედვით', 'Based on your OPK') : null);
function ovulationBandLine(range, source) {
  const base = t(`სავარაუდო ოვულაცია · ${shortRange(range.start, range.end)}`, `Estimated ovulation · ${shortRange(range.start, range.end)}`);
  const from = ovulationSourceLabel(source);
  return from ? `${base} · ${from}` : base;
}
/** „ან მომდევნო N დღეში“ (mobile cycleCenterCopy.windowOpenTail). */
const windowOpenTail = (days) => t(`ან მომდევნო ${days} დღეში`, days === 1 ? 'or tomorrow' : `or within the next ${days} days`);

/** The quiet badge where fertile days would be: three progress dots + „ვსწავლობთ შენს რიტმს · N/3 ციკლი“. */
function learningBadge(gate, { compact = false } = {}) {
  const req = gate.requiredCycles || FERTILITY_MIN_CYCLES;
  const done = clampCycles(gate.completedCycles, req);
  const text = compact ? statsLearningChip(done, req) : learningBadgeText(done, req);
  return h('span', { class: 'cy-learning', title: learningBadgeExplain(req), 'aria-label': `${text}. ${learningBadgeExplain(req)}` },
    h('span', { class: 'cy-learning-dots', 'aria-hidden': 'true' }, Array.from({ length: req }, (_, i) => h('i', { class: i < done ? 'on' : '' }))),
    text);
}

/* ── Tracking („მენსტრუაციას არ ველი“) copy (mobile src/lib/cycleTrackingCopy.ts) ─ */
const trackingCopy = {
  title: () => t('თვალყურის დევნება', 'Tracking'),
  howAreYou: () => t('როგორ ხარ დღეს?', 'How are you today?'),
  detail: () => t('პროგნოზებს არ ვაჩვენებთ — მხოლოდ იმას, რასაც აღრიცხავ.', 'No estimates — only what you log.'),
  newCycle: () => t('ახალი ციკლის დაწყება', 'Start a new cycle'),
  newCycleShort: () => t('ახალი ციკლი', 'New cycle'),
  bleedLegend: () => t('სისხლდენა', 'Bleeding'),
  endBleed: () => t('სისხლდენის დასრულება', 'End bleeding'),
  ringA11y: (bleedDays, loggedDays) => t(
    `ბოლო 4 კვირა: სისხლდენა ${bleedDays} დღე, სხვა აღრიცხული დღე ${loggedDays}.`,
    `Last 4 weeks: bleeding on ${bleedDays} ${bleedDays === 1 ? 'day' : 'days'}, ${loggedDays} other logged ${loggedDays === 1 ? 'day' : 'days'}.`,
  ),
  ringHint: () => t('ბოლო 4 კვირა · ვარდისფერი — აღრიცხული სისხლდენა', 'Last 4 weeks · rose = logged bleeding'),
  explainBody: () => [
    t('შენ მიუთითე, რომ მენსტრუაციას არ ელი (მაგ. ჰორმონული სპირალი, იმპლანტი, უწყვეტი აბი). ამიტომ შემდეგ მენსტრუაციას, დაგვიანებას და ნაყოფიერ დღეებს არ ვაფასებთ.',
      "You told us you don't expect periods (e.g. a hormonal IUD, an implant, a continuous pill), so we don't estimate your next period, a late period or fertile days."),
    t('რგოლზე ბოლო 4 კვირაა: ვარდისფერი — აღრიცხული სისხლდენა, წერტილი — აღრიცხული დღე. მოულოდნელი ან ლაქოვანი სისხლდენისას დააჭირე „ახალი ციკლის დაწყება“ — ჩაიწერება, პროგნოზი კი არ ჩაირთვება.',
      'The ring shows the last 4 weeks: rose is logged bleeding, a dot is a logged day. For unexpected bleeding or spotting tap “Start a new cycle” — it is logged, estimates stay off.'),
    t('თუ სისხლდენა მოულოდნელია ან რამე გაწუხებს, ესაუბრე ექიმს.', 'If bleeding is unexpected or something worries you, talk to your doctor.'),
  ],
  explainCaption: () => t('შეცვლა: ციკლის პარამეტრები', 'Change it in cycle settings'),
};
const trackingSettingsCopy = {
  section: () => t('მენსტრუაცია და ნაყოფიერი დღეები', 'Periods and fertile days'),
  expectsLabel: () => t('მენსტრუაციას არ ველი (მაგ. ჰორმონული სპირალი, იმპლანტი, უწყვეტი აბი)', "I don't expect periods (e.g. hormonal IUD, implant, continuous pill)"),
  expectsHint: () => t('შემდეგი მენსტრუაციის, დაგვიანებისა და ნაყოფიერი დღეების პროგნოზი ითიშება; აღრიცხვა რჩება.', 'Next-period, late and fertile-day estimates turn off; logging stays.'),
  fertilityLabel: () => t('ნაყოფიერი დღეების ჩვენება', 'Show fertile days'),
  fertilityHintOn: () => t('სავარაუდო ნაყოფიერი დღეები და ოვულაცია, როცა საკმარისი მონაცემია. კონტრაცეფციის მეთოდი არ არის.', 'Estimated fertile days and ovulation once there is enough data. Not a contraception method.'),
  fertilityHintOff: () => t('ნაყოფიერი დღეები, ოვულაცია და მათი შეხსენებები არსად გამოჩნდება.', 'Fertile days, ovulation and their reminders are hidden everywhere.'),
  forced: (forcedBy) => {
    if (forcedBy === 'ttc') return t('ორსულობის დაგეგმვისას ნაყოფიერი დღეები ყოველთვის ჩანს.', 'Always shown while trying to conceive.');
    if (forcedBy === 'contraception') return t('ჰორმონული კონტრაცეფციისას ნაყოფიერ დღეებს არ ვაჩვენებთ.', 'Not shown with hormonal contraception.');
    if (forcedBy === 'tracking') return t('არ ჩანს, სანამ „მენსტრუაციას არ ველი“ ჩართულია.', 'Hidden while “I don’t expect periods” is on.');
    if (forcedBy === 'mode') return t('ამ რეჟიმში ნაყოფიერ დღეებს არ ვაჩვენებთ.', 'Not shown in this mode.');
    return null;
  },
};

/** Tracking only: she expects no periods (server forecastEligibility NOT_EXPECTING_BLEEDING / bundle.tracking). */
function isTrackingOnly(b) {
  if (!b) return false;
  if (b.forecastEligibility?.reason === 'NOT_EXPECTING_BLEEDING') return true;
  if (typeof b.tracking?.trackingOnly === 'boolean') return b.tracking.trackingOnly;
  return b.profile?.expectsBleeding === false && (b.profile?.mode || 'TRACK_PERIOD') === 'TRACK_PERIOD';
}

/** `predictions.fertility` (server cycleForecastHonesty): READY | LEARNING (< 3 cycles) | WIDE (TTC < 3 cycles). */
function fertilityGateOf(b) {
  const sent = b?.predictions?.fertility;
  if (sent && typeof sent.status === 'string') {
    return {
      status: sent.status,
      completedCycles: Number(sent.completedCycles) || 0,
      requiredCycles: Number(sent.requiredCycles) || FERTILITY_MIN_CYCLES,
      window: sent.window ?? null,
      ovulationSource: sent.ovulationSource ?? null,
    };
  }
  const done = Number(b?.averages?.cycleCount) || 0;
  const status = done >= FERTILITY_MIN_CYCLES ? 'READY' : b?.profile?.mode === 'TRY_TO_CONCEIVE' ? 'WIDE' : 'LEARNING';
  return { status, completedCycles: done, requiredCycles: FERTILITY_MIN_CYCLES, window: null, ovulationSource: null };
}

/** The level „კი“ logs for today: the last bleeding level before today, else light (mobile cyclePeriodStatus.stillBleedingFlow). */
function stillBleedingFlow(logs, today) {
  let best = null;
  for (const l of logs || []) {
    if (!l?.date || l.date >= today || !isBleed(l.flow)) continue;
    if (!best || l.date > best.date) best = l;
  }
  return best?.flow ?? 'light';
}

/** Undo of a one-tap end: the day comes back exactly as it was (mobile cyclePeriodStatus.periodEndUndo). */
function periodEndUndo(before) {
  if (before && isBleed(before.flow)) return { kind: 'restoreFlow', flow: before.flow };
  if (before && (before.flow === 'none' || before.flow === 'spotting')) return { kind: 'keep' };
  return before ? { kind: 'clearFlow' } : { kind: 'removeLog' };
}

/* ── Deviations copy (mobile src/lib/cycleDeviationCopy.ts) ─────────────── */
const DEVIATION_RULES = { windowMonths: 6, minCycles: 3, spreadDays: 17, longPeriodDays: 10, factorTailDays: 90 };
const deviationCopy = {
  title: () => t('შენს ციკლში ცვლილება შევნიშნეთ', 'We noticed a change in your cycle'),
  doctorLine: () => t('ეს დიაგნოზი არ არის — ესაუბრე ექიმს, თუ გაწუხებს.', "This isn't a diagnosis — talk to a doctor if it worries you."),
  explainTitle: () => t('როგორ ვამჩნევთ ცვლილებას', 'How we notice a change'),
  explainBody: (rulesOff = []) => {
    const peri = rulesOff.includes('irregular');
    const rules = [
      t(`ციკლის სიგრძე: ყველაზე მოკლე და ყველაზე გრძელი ციკლი ${DEVIATION_RULES.spreadDays} ან მეტი დღით განსხვავდება.`, `Cycle length: your shortest and longest cycle differ by ${DEVIATION_RULES.spreadDays} days or more.`),
      t(`იშვიათი მენსტრუაცია: ${DEVIATION_RULES.windowMonths} თვეში მხოლოდ 1 ან 2 მენსტრუაცია აღირიცხა.`, `Infrequent periods: only 1 or 2 periods were logged in ${DEVIATION_RULES.windowMonths} months.`),
      t(`გრძელი მენსტრუაცია: მენსტრუაცია ${DEVIATION_RULES.longPeriodDays} ან მეტი დღე გაგრძელდა მინიმუმ ორჯერ.`, `Long periods: a period lasted ${DEVIATION_RULES.longPeriodDays} days or more at least twice.`),
      t('ლაქები: მენსტრუაციებს შორის ლაქები მინიმუმ 2 ციკლში აღინიშნა.', 'Spotting: spotting between periods was logged in at least 2 cycles.'),
    ];
    return [
      t(`ვუყურებთ მხოლოდ შენს აღრიცხვას ბოლო ${DEVIATION_RULES.windowMonths} თვეში. ბარათი ჩნდება მხოლოდ მაშინ, როცა ისტორია ${DEVIATION_RULES.windowMonths} თვეზე მეტია და მინიმუმ ${DEVIATION_RULES.minCycles} ციკლი დასრულდა.`,
        `We only look at what you logged in the last ${DEVIATION_RULES.windowMonths} months. The card appears only when your history is longer than ${DEVIATION_RULES.windowMonths} months and at least ${DEVIATION_RULES.minCycles} cycles have finished.`),
      ...(peri ? rules.slice(1) : rules),
      t(`ორსულობისას, მშობიარობის შემდგომ პერიოდში და ჰორმონული კონტრაცეფციისას ბარათი არ ჩნდება, ასევე მათი დასრულებიდან ${DEVIATION_RULES.factorTailDays} დღის განმავლობაში — ციკლი ამ დროს ბუნებრივად იცვლება.`,
        `During pregnancy, after giving birth and with hormonal contraception the card stays off, and for ${DEVIATION_RULES.factorTailDays} days after they end — the cycle naturally changes then.`),
      ...(peri ? [t('პერიმენოპაუზის რეჟიმში ციკლის სიგრძის წესი გამორთულია — ამ დროს სიგრძე ხშირად იცვლება.', 'In perimenopause mode the cycle-length rule is off — length often changes at this time.')] : []),
      t('ეს დაკვირვებაა შენი ჩანაწერებიდან და არა დიაგნოზი. გამოტოვებული ჩანაწერიც შეიძლება ცვლილებად გამოჩნდეს. თუ გაწუხებს, ესაუბრე ექიმს.',
        'This is an observation from your own log, not a diagnosis. A missed log can look like a change too. If it worries you, talk to a doctor.'),
    ];
  },
};
const numberWordKa = (n) => (n === 1 ? 'ერთი' : n === 2 ? 'ორი' : String(n));
const numberWordEn = (n) => (n === 1 ? 'one' : n === 2 ? 'two' : String(n));
function deviationFindingLine(f) {
  switch (f?.id) {
    case 'irregular': return t(`ბოლო 6 თვეში ციკლის სიგრძე ${f.shortestDays}-დან ${f.longestDays} დღემდე მერყეობს.`, `In the last 6 months your cycle length ranged from ${f.shortestDays} to ${f.longestDays} days.`);
    case 'infrequent': return t(`ბოლო 6 თვეში მხოლოდ ${numberWordKa(f.periods)} მენსტრუაცია აღირიცხა.`, `Only ${numberWordEn(f.periods)} ${f.periods === 1 ? 'period was' : 'periods were'} logged in the last 6 months.`);
    case 'prolonged': return t(`ბოლო 6 თვეში მენსტრუაცია ${f.periods}-ჯერ გაგრძელდა 10 ან მეტი დღე (ყველაზე გრძელი — ${f.longestDays} დღე).`, `In the last 6 months a period lasted 10 days or longer ${f.periods} times (the longest ${f.longestDays} days).`);
    case 'spotting': return t(`ბოლო 6 თვეში ლაქები მენსტრუაციებს შორის ${f.cycles} ციკლში აღინიშნა.`, `In the last 6 months spotting between periods was logged in ${f.cycles} cycles.`);
    default: return '';
  }
}
/** Lines in a fixed order; [] = no card (unknown ids from a newer server are skipped). */
function deviationLines(deviations) {
  const findings = Array.isArray(deviations?.findings) ? deviations.findings : [];
  return ['irregular', 'infrequent', 'prolonged', 'spotting'].flatMap((id) => findings.filter((f) => f?.id === id).map(deviationFindingLine)).filter(Boolean);
}

/** Pregnancy checklist (mobile constants/cycle.ts PREGNANCY_CHECKLIST = server PREGNANCY_CHECKLIST_IDS, same order). */
const PREGNANCY_CHECKLIST = [
  ['prenatal_vitamin', t('ორსულთა ვიტამინი', 'Prenatal vitamin')], ['folic_acid', t('ფოლის მჟავა', 'Folic acid')], ['water_2l', t('2ლ წყალი', '2 L water')],
  ['walk', t('სეირნობა', 'Walk')], ['doctor_appt', t('ექიმის ვიზიტი', 'Doctor visit')], ['ultrasound', t('ულტრაბგერა', 'Ultrasound')],
  ['blood_test', t('სისხლის ანალიზი', 'Blood test')], ['no_alcohol', t('ალკოჰოლის გარეშე', 'No alcohol')], ['no_smoking', t('მოწევის გარეშე', 'No smoking')],
  ['rest', t('დასვენება', 'Rest')],
].map(([id, label]) => ({ id, label }));
const PREGNANCY_CHECKLIST_IDS = PREGNANCY_CHECKLIST.map((o) => o.id);
const canonicalChecklist = (ids) => {
  const picked = new Set((Array.isArray(ids) ? ids : []).filter((id) => typeof id === 'string'));
  return PREGNANCY_CHECKLIST_IDS.filter((id) => picked.has(id));
};

function logHasFacts(l) {
  if (!l) return false;
  return Boolean(
    (l.symptoms && l.symptoms.length) || (l.moods && l.moods.length) || l.notes || (l.painEntries && l.painEntries.length)
    || l.sexualActivity === true || l.bbt != null || l.cervicalMucus || l.ovulationTest || l.pregnancyTest
    || l.sleepQuality || l.stressLevel || l.exerciseLevel || l.caffeine || l.alcohol || l.energy || l.observations?.energy
    || (Array.isArray(l.observations?.pregnancyChecklist) && l.observations.pregnancyChecklist.length),
  );
}

/* ── Derived presentation (CycleHero + cycleHonesty + cycleContraception) ─── */
function displayPhaseLabel(phase, phaseKa, loggedPeriod) {
  if (!phase || phase === 'unknown') return phaseKa || t('უცნობი ფაზა', 'Unknown phase');
  if (phase === 'period') return loggedPeriod ? t('მენსტრუაცია', 'Period') : t('სავარაუდო მენსტრუაცია', 'Estimated period');
  return t(`სავარაუდო ${phaseKa}`, `Estimated ${String(phaseKa).toLowerCase()}`);
}

function confidenceCopy(b) {
  const confidence = b.predictions?.confidence;
  const conditions = (b.profile?.conditions || []).map(String);
  if (b.profile?.isIrregular) return t('შენი ციკლები იცვლება, ამიტომ თარიღი შეიძლება გადაიწიოს', 'Your cycles vary, so the date may shift');
  if (confidence !== 'high' && confidence !== 'medium') return t('ჯერ ვსწავლობთ შენს რიტმს', 'Still learning your rhythm');
  if (conditions.includes('pcos')) return t('ჯერ ვსწავლობთ შენს რიტმს', 'Still learning your rhythm');
  if (confidence === 'medium') return t('რამდენიმე ციკლის მიხედვით · თარიღი შეიძლება გადაიწიოს', 'Based on a few cycles · the date may shift');
  return t('ბოლო ციკლების მიხედვით', 'Based on your recent cycles');
}

function derive(b) {
  const today = cycleToday(b);
  const mode = b.profile?.mode || 'TRACK_PERIOD';
  const caps = CAPS[mode] || CAPS.TRACK_PERIOD;
  const todayLog = (b.logs || []).find((l) => l.date === today);
  const loggedToday = isBleed(todayLog?.flow);
  const uncertain = b.contraception?.bleedingLabel === 'bleeding';
  const tracking = isTrackingOnly(b);
  const pres = b.contraception?.presentation;
  const fertilityVisible = caps.fertile && (!pres || (pres.showFertilityMarkers !== false && pres.showFertileWindow !== false));
  const forecastAllowed = !b.forecastEligibility || b.forecastEligibility.allowed === true;
  const hideLengthChrome = !forecastAllowed;
  const hidePredicted = !forecastAllowed;
  const cycleLen = b.averages?.usedCycleLength ?? b.profile?.avgCycleLength ?? 28;
  const periodLen = b.averages?.usedPeriodLength ?? b.profile?.avgPeriodLength ?? 5;
  const day = b.cycleDay ?? null;
  const phase = b.phase || 'unknown';
  const phaseKa = b.phaseKa || t('უცნობი ფაზა', 'Unknown phase');
  // Perimenopause (W3-4): only the server's window, never one date (none with < 2 cycles or on an older server).
  const next = caps.peri
    ? (b.predictions?.nextPeriodRange?.from ? b.predictions?.nextPeriodStart || null : null)
    : b.predictions?.nextPeriodStart || null;
  const cal = b.predictions?.calendar || {};
  const predictedToday = Boolean(cal[today]?.period && cal[today]?.predicted);
  const forecastOn = Boolean(next) && caps.forecast && !hidePredicted;
  const inDays = next ? daysBetween(today, next) : null;
  const conditions = (b.profile?.conditions || []).map(String);
  // Tracking never asks for a last period (mobile CycleOnboarding skips the date step).
  const needsOnboarding = !tracking && !['PREGNANCY', 'POSTPARTUM', 'PERIMENOPAUSE'].includes(mode) && !b.profile?.lastPeriodStart;

  // Period auto-end (server periodStatus; mobile cyclePeriodStatus.heroPeriodState): an open period stays a
  // period day through its usual length, the day after asks „ჯერ კიდევ გაქვს?“ once, then back to normal.
  // A status derived for another day, or anything logged today that is not bleeding, changes nothing.
  const ps = b.periodStatus;
  const psEnabled = (mode === 'TRACK_PERIOD' || mode === 'TRY_TO_CONCEIVE') && forecastAllowed && !uncertain && !tracking;
  let onPeriod = loggedToday;
  let askStill = false;
  if (!loggedToday && psEnabled && ps && b.meta?.today === today && !todayLog?.flow) {
    if (ps.state === 'active') onPeriod = true;
    else askStill = ps.state === 'askStill';
  }

  const phaseHint = tracking ? trackingCopy.title()
    : hideLengthChrome ? t('ციკლის ახალი ისტორია გროვდება', 'Building your new cycle history')
      : displayPhaseLabel(onPeriod ? 'period' : phase, phaseKa, loggedToday);

  // Variable cycles: the server's next-period window (`nextPeriodRange`) instead of one date; late only after it.
  const range = b.predictions?.nextPeriodRange;
  const spread = forecastOn && next && range?.from && range?.to
    ? { before: Math.max(0, daysBetween(range.from, next)), after: Math.max(0, daysBetween(next, range.to)) }
    : null;
  // The whole window as dates (mobile homeCycle.cyclePeriodWindow): every badge / caption prints from – to,
  // also once it is open — never from the single estimate.
  const periodWindow = spread
    ? (() => {
      const from = addKey(next, -spread.before);
      const to = addKey(next, spread.after);
      return { from, to, state: daysBetween(today, from) > 0 ? 'before' : daysBetween(today, to) >= 0 ? 'open' : 'late' };
    })()
    : null;
  let windowKind = null;
  let windowFrom = null;
  let windowTo = null;
  if (spread && inDays != null && !onPeriod) {
    windowTo = inDays + spread.after;
    windowFrom = inDays - spread.before;
    if (predictedToday) { windowKind = 'open'; windowTo = Math.max(0, windowTo); } else if (windowTo >= 0) windowKind = windowFrom <= 0 ? 'open' : 'countdown';
  }

  let statusLine = null;
  if (onPeriod && !loggedToday) statusLine = t('სავარაუდო მენსტრუაცია', 'Estimated period');
  else if (onPeriod) statusLine = uncertain ? t('დღეს აღრიცხული სისხლდენა', 'Bleeding logged today') : t('ახლა აღრიცხული მენსტრუაციაა', 'Period logged right now');
  else if (tracking) statusLine = trackingCopy.howAreYou();
  else if (windowKind && !hidePredicted) {
    const what = uncertain ? t('სისხლდენა', 'Bleeding') : t('მენსტრუაცია', 'Period');
    statusLine = windowKind === 'countdown'
      ? t(`${what} სავარაუდოდ ${windowFrom}–${windowTo} დღეში`, `${what} likely in ${windowFrom}–${windowTo} days`)
      : windowTo > 0
        ? t(`${what} სავარაუდოდ დღეს ან მომდევნო ${windowTo} დღეში`, windowTo === 1 ? `${what} likely today or tomorrow` : `${what} likely today or within the next ${windowTo} days`)
        : t('დღეს სავარაუდო მენსტრუაციის დღეა — მენსტრუაცია ჯერ არ არის აღრიცხული', 'Today is an estimated period day — no period logged yet');
  } else if (caps.pregnancy) {
    const age = b.pregnancy?.age;
    statusLine = b.pregnancy?.reviewRequired ? t('საცნობი თარიღი გადასახედია — კვირის შეფასება არ გამოჩნდება.', 'Your reference date needs a review — the week estimate won’t show.')
      : age ? t(`${age.week} კვირა + ${age.day} დღე`, `${plural(age.week, 'week')} + ${plural(age.day, 'day')}`) : t('ორსულობის რეჟიმი', 'Pregnancy mode');
  } else if (!hidePredicted) {
    if (predictedToday) statusLine = t('დღეს სავარაუდო მენსტრუაციის დღეა — მენსტრუაცია ჯერ არ არის აღრიცხული', 'Today is an estimated period day — no period logged yet');
    else if (next && caps.forecast && inDays != null && inDays >= 0) {
      if (inDays === 0) statusLine = t('დღეს სავარაუდო მენსტრუაციის დღეა — მენსტრუაცია ჯერ არ არის აღრიცხული', 'Today is an estimated period day — no period logged yet');
      else if (isEn) {
        const what = uncertain ? 'Bleeding' : 'Period';
        statusLine = inDays === 1 ? `${what} likely tomorrow` : `${what} likely in ${inDays} days`;
      } else {
        const what = uncertain ? 'სისხლდენა' : 'მენსტრუაცია';
        statusLine = inDays === 1 ? `${what} სავარაუდოდ ხვალ` : `${what} სავარაუდოდ ${inDays} დღეში`;
      }
    }
  }

  // Perimenopause without a live window: the calm line of its state (learning / passed / long gap / 12 months).
  if (caps.peri && !onPeriod && !windowKind) statusLine = periStatusNote(b, { periodWindow })?.title || statusLine;

  /** One number in the ring: bleeding day → „დღეს“ → countdown („სავარაუდოდ“) → cycle day. */
  let center;
  if (!hideLengthChrome) {
    if (onPeriod) center = { top: uncertain ? t('სისხლდენის დღე', 'Bleeding day') : t('მენსტრუაციის დღე', 'Period day'), value: day != null ? String(day) : '—', bottom: null, tone: 'period' };
    // Variable cycles (mobile cycleCenterText): „მენსტრუაციამდე · 3–7 · დღე · სავარაუდოდ“, or „დღეს“ once the window is open.
    else if (windowKind === 'countdown') center = { top: uncertain ? t('სისხლდენამდე', 'Until bleeding') : t('მენსტრუაციამდე', 'Until period'), value: `${windowFrom}–${windowTo}`, bottom: t('დღე · სავარაუდოდ', 'days · estimated') };
    else if (windowKind === 'open') center = { top: t('სავარაუდოდ', 'Likely'), value: t('დღეს', 'Today'), bottom: windowTo > 0 ? windowOpenTail(windowTo) : t('სავარაუდო მენსტრუაცია', 'Estimated period'), tone: 'period', word: true };
    else if (predictedToday || (forecastOn && inDays === 0)) center = { top: t('სავარაუდოდ', 'Likely'), value: t('დღეს', 'Today'), bottom: t('სავარაუდო მენსტრუაცია', 'Estimated period'), tone: 'period', word: true };
    else if (forecastOn && inDays > 0) center = { top: uncertain ? t('სისხლდენამდე', 'Until bleeding') : t('მენსტრუაციამდე', 'Until period'), value: String(inDays), bottom: t('დღე · სავარაუდოდ', inDays === 1 ? 'day · estimated' : 'days · estimated') };
    // Perimenopause never counts days „past the estimate“ (late alerts are noise there): the cycle day stays.
    else if (forecastOn && inDays < 0 && day != null && !caps.peri) center = { top: t('ციკლის დღე', 'Cycle day'), value: String(day), bottom: t(`სავარაუდო თარიღიდან ${-inDays} დღე`, `${plural(-inDays, 'day')} past the estimate`) };
  }

  const cycleStart = day != null && day > 0 ? addKey(today, -(day - 1)) : null;
  let fertileDays = null;
  if (cycleStart && cycleLen && !hidePredicted && fertilityVisible && b.predictions?.fertileWindow) {
    const fw = b.predictions.fertileWindow;
    const from = Math.max(1, daysBetween(cycleStart, fw.start) + 1);
    const to = Math.min(cycleLen, daysBetween(cycleStart, fw.end) + 1);
    if (from <= to) fertileDays = { from, to };
  }
  const recordedDays = cycleStart && !hideLengthChrome
    ? (b.logs || []).filter((l) => isBleed(l.flow)).map((l) => daysBetween(cycleStart, l.date) + 1).filter((d) => d >= 1 && d <= Math.max(cycleLen, day ?? 0))
    : [];
  // Forecast honesty (server predictions.fertility): before 3 cycles no fertile arc — a quiet badge stands in
  // its place; TTC gets one wide window (no ovulation day); ovulation is a 3-day band with its source.
  const gate = fertilityGateOf(b);
  const wideWindow = gate.status === 'WIDE' && gate.window === 'wide';
  const learning = fertilityVisible && caps.fertile && !hidePredicted && !hideLengthChrome && !fertileDays && Boolean(cycleStart) && gate.status === 'LEARNING';
  const ovulationRange = fertilityVisible && !hidePredicted && !wideWindow ? b.predictions?.ovulationRange ?? null : null;
  // No fertile arc (learning, or her display switch off): the ring still turns luteal where the server's phase words do.
  const fertileHidden = !fertilityVisible && caps.fertile && !hidePredicted && !hideLengthChrome;
  let lutealFrom = null;
  if ((learning || fertileHidden) && cycleStart && cycleLen) {
    for (let d = 1; d <= Math.max(cycleLen, day ?? 0); d += 1) {
      if (cal[addKey(cycleStart, d - 1)]?.phase === 'luteal') { lutealFrom = d; break; }
    }
  }
  const startLeads = !onPeriod && !askStill && (!forecastOn || predictedToday || (inDays != null && inDays <= 3));
  const startLabel = uncertain ? t('სისხლდენა დაიწყო', 'Bleeding started') : t('მენსტრუაცია დაიწყო', 'Period started');
  const showPredicted = caps.fertile && forecastAllowed; // calendar overlays follow the app (index.tsx showPredicted)

  return {
    today, mode, caps, todayLog, onPeriod, loggedToday, askStill, tracking, gate, wideWindow, learning, ovulationRange, lutealFrom,
    spread, periodWindow, windowKind, uncertain, fertilityVisible, forecastAllowed, hideLengthChrome, hidePredicted,
    cycleLen, periodLen, day, phase, phaseKa, next, inDays, forecastOn, predictedToday, phaseHint, statusLine, center,
    cycleStart, fertileDays, recordedDays, startLeads, startLabel, showPredicted, needsOnboarding,
    pcos: conditions.includes('pcos'),
    confidence: caps.peri ? periBasisLine(b) : confidenceCopy(b),
  };
}

/* ── Perimenopause forecast (W3-4; mobile src/lib/cyclePerimenopauseForecast.ts — same words) ── */
function periBasisLine(b) {
  const n = Math.max(2, Number(b.perimenopause?.forecast?.range?.basedOn) || 0);
  return t(`შენი ბოლო ${n} ციკლის მიხედვით · ერთ თარიღს არ ვამბობთ`, `From your last ${n} cycles · we don’t name one date`);
}

/** The calm line for the states without a live window; null while a window is ahead or open. */
function periStatusNote(b, v) {
  const f = b.perimenopause?.forecast || {};
  const since = f.daysSinceBleeding;
  if (f.status === 'no_bleeding_12m') {
    return { title: t('12 თვეა სისხლდენა არ აღგირიცხავს', 'No bleeding logged for 12 months'),
      body: t('ექიმს შეუძლია დაადასტუროს, დადგა თუ არა მენოპაუზა. თუ სისხლდენა ისევ გამოჩნდება, ესაუბრე ექიმს.', 'A doctor can confirm whether this is menopause. If bleeding comes back, talk to a doctor.') };
  }
  if (f.status === 'long_gap') {
    return { title: t('დიდი ხანია მენსტრუაცია არ ყოფილა', 'It has been a while since your last period'),
      body: since != null
        ? t(`ბოლო სისხლდენიდან ${since} დღე გავიდა. ესაუბრე ექიმს, თუ გაწუხებს.`, `${since} days since your last bleeding. Talk to a doctor if it worries you.`)
        : t('ესაუბრე ექიმს, თუ გაწუხებს.', 'Talk to a doctor if it worries you.') };
  }
  if (f.status !== 'range' || !v.periodWindow) {
    return { title: t('ვსწავლობთ შენს რიტმს', 'Learning your rhythm'),
      body: t('სანამ რამდენიმე ციკლს არ დავითვლით, თარიღს არ ვამბობთ.', 'Until we have counted a few cycles, we don’t give a date.') };
  }
  if (v.periodWindow.state === 'late') {
    return { title: t('სავარაუდო ფანჯარა გავიდა', 'The estimated window has passed'),
      body: t(`${shortRange(v.periodWindow.from, v.periodWindow.to)} · როცა დაიწყება, უბრალოდ აღნიშნე.`, `${shortRange(v.periodWindow.from, v.periodWindow.to)} · When it starts, just log it.`) };
  }
  return null;
}

/* ── „ბოლო ციკლები“ (W3-4; mobile src/lib/cycleComparisonCopy.ts — same words) ── */
function comparisonLine(cmp) {
  if (!cmp || !Number.isFinite(cmp.latestDays) || (cmp.cycles?.length ?? 0) < 2) return null;
  const latest = cmp.latestDays;
  const usual = cmp.usualDays;
  if (usual == null) return t(`ბოლო ციკლი ${latest} დღე იყო. შენს ჩვეულს 3 ციკლიდან შევადარებთ.`, `Your last cycle was ${latest} days. We compare it with your usual from 3 cycles on.`);
  const diff = latest - usual;
  if (diff === 0) return t(`ბოლო ციკლი ${latest} დღე იყო — შენი ჩვეულის (${usual}) ტოლი`, `Your last cycle was ${latest} days — the same as your usual (${usual})`);
  const n = Math.abs(diff);
  const daysKa = `${n} დღით`;
  const daysEn = n === 1 ? '1 day' : `${n} days`;
  return diff > 0
    ? t(`ბოლო ციკლი ${latest} დღე იყო — შენს ჩვეულზე (${usual}) ${daysKa} გრძელი`, `Your last cycle was ${latest} days — ${daysEn} longer than your usual (${usual})`)
    : t(`ბოლო ციკლი ${latest} დღე იყო — შენს ჩვეულზე (${usual}) ${daysKa} მოკლე`, `Your last cycle was ${latest} days — ${daysEn} shorter than your usual (${usual})`);
}

/** Bars of the last ≤ 6 completed, not hidden cycles (server `cycleComparison`), newest on top; null = nothing. */
function comparisonCard(b) {
  const cmp = b.cycleComparison;
  const cycles = (cmp?.cycles || []).filter((c) => Number.isFinite(c.length) && c.length > 0).slice(-6);
  if (cycles.length < 2) return null;
  const max = Math.max(...cycles.map((c) => c.length));
  const rows = cycles.map((c, i) => ({ ...c, latest: i === cycles.length - 1 })).reverse();
  const line = comparisonLine(cmp);
  return card(
    h('div', { class: 'cy-cmp', role: 'list' }, rows.map((r) => {
      const period = Math.max(0, Math.min(r.length, Math.round(r.periodDays || 0)));
      return h('div', { class: `cy-cmp-row${r.latest ? ' latest' : ''}`, role: 'listitem',
        'aria-label': t(`${shortDate(r.start)}: ${r.length} დღე, მენსტრუაცია ${period} დღე`, `${shortDate(r.start)}: ${r.length} days, period ${period} days`) },
      h('span', { class: 'cy-cmp-date' }, shortDate(r.start)),
      h('span', { class: 'cy-cmp-track' },
        h('span', { class: 'cy-cmp-bar', style: { width: `${Math.round((r.length / max) * 86)}%` } },
          h('i', { style: { width: `${Math.round((period / r.length) * 100)}%` } })),
        h('b', null, String(r.length))));
    })),
    h('div', { class: 'cy-cmp-legend', 'aria-hidden': 'true' },
      h('span', null, h('i', { class: 'period' }), t('მენსტრუაცია', 'Period')),
      h('span', null, h('i'), t('ციკლის დანარჩენი დღეები', 'Rest of the cycle'))),
    line ? h('p', { class: 'cy-cmp-line' }, line) : null,
    cmp?.usualDays != null ? h('p', { class: 'faint', style: { fontSize: '12px', marginTop: '4px' } }, t('ჩვეული — შენი წინა ციკლების შუა მნიშვნელობა (მედიანა)', 'Usual = the middle value of your earlier cycles (median)')) : null);
}

/** Calendar marks: server predictions + logged flow / facts (cycleFertility.mergeFertilityMarks). */
function buildMarks(b) {
  const out = {};
  for (const [k, v] of Object.entries(b.predictions?.calendar || {})) out[k] = { ...v };
  for (const l of b.logs || []) {
    const m = out[l.date] || {};
    m.flow = l.flow;
    m.logged = Boolean(m.logged) || logHasFacts(l);
    out[l.date] = m;
  }
  return out;
}

function classifyDay(m = {}, { showFertility, showPredicted }) {
  const loggedPeriod = Boolean(m.period && !m.predicted) || isBleed(m.flow);
  const spotting = !loggedPeriod && m.flow === 'spotting';
  return {
    loggedPeriod,
    spotting,
    predictedPeriod: showPredicted && Boolean(m.period && m.predicted) && !loggedPeriod,
    fertile: showPredicted && showFertility && Boolean(m.fertile && !m.ovulation),
    ovulation: showPredicted && showFertility && Boolean(m.ovulation),
    symptomDot: Boolean(m.logged) && !loggedPeriod && !spotting,
  };
}

/* ── Dial (CycleStatusGauge) ─────────────────────────────────────────────── */
function svg(tag, attrs = {}) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) el.setAttribute(k, String(v));
  return el;
}
let dialUid = 0;
const VB = 300; const C = VB / 2; const R = 120; const BAND = 18;
const toRad = (deg) => (deg * Math.PI) / 180;
const pt = (deg, r = R) => ({ x: C + r * Math.cos(toRad(deg)), y: C + r * Math.sin(toRad(deg)) });
const slotDeg = (pos, count) => -90 + (pos / count) * 360;
function arcPath(fromDeg, toDeg, r = R) {
  if (toDeg - fromDeg <= 0.2) return null;
  const p0 = pt(fromDeg, r); const p1 = pt(toDeg, r);
  return `M ${p0.x} ${p0.y} A ${r} ${r} 0 ${toDeg - fromDeg > 180 ? 1 : 0} 1 ${p1.x} ${p1.y}`;
}
const PHASE_VAR = { period: '--cy-period', follicular: '--cy-follicular', fertile: '--cy-fertile-fill', luteal: '--cy-luteal' };

/**
 * opts: { day, cycleLength, periodLength, hideLength, recordedDays, fertileDays, center, phase, periodActive,
 *         compact, describeDay(d) → center, onFertile, animate, label }
 */
function dial(opts) {
  const id = `cyg${++dialUid}`;
  const length = opts.hideLength ? 0 : Math.max(14, Math.round(opts.cycleLength) || 28);
  const count = length ? Math.max(length, opts.day ?? 0) : 28;
  const recorded = new Set(opts.recordedDays || []);
  const day = opts.hideLength ? null : opts.day;

  const phases = [];
  if (length) {
    const early = (opts.recordedDays || []).filter((d) => d <= 12);
    const loggedMax = early.length ? Math.max(...early) : 0;
    const periodEnd = Math.max(1, Math.min(loggedMax || opts.periodLength || 5, count));
    const fw = opts.fertileDays;
    const fStart = fw ? Math.min(fw.from, fw.to) : null;
    const fEnd = fw ? Math.max(fw.from, fw.to) : null;
    phases.push({ kind: 'period', from: 1, to: periodEnd });
    if (fStart != null && fEnd != null && fStart > periodEnd) {
      if (fStart - 1 > periodEnd) phases.push({ kind: 'follicular', from: periodEnd + 1, to: fStart - 1 });
      phases.push({ kind: 'fertile', from: fStart, to: Math.min(fEnd, count) });
      if (fEnd < count) phases.push({ kind: 'luteal', from: fEnd + 1, to: count });
    } else if (opts.lutealFrom && opts.lutealFrom > periodEnd && opts.lutealFrom <= count) {
      // No fertile arc (learning / display off): follicular → luteal where the server's phase words turn.
      if (opts.lutealFrom - 1 > periodEnd) phases.push({ kind: 'follicular', from: periodEnd + 1, to: opts.lutealFrom - 1 });
      phases.push({ kind: 'luteal', from: opts.lutealFrom, to: count });
    } else if (periodEnd < count) {
      phases.push({ kind: 'follicular', from: periodEnd + 1, to: count });
    }
  }
  const capDeg = ((BAND / 2 + 2) / R) * (180 / Math.PI);
  const glowVar = opts.periodActive || opts.phase === 'period' ? '--cy-period'
    : opts.phase === 'fertile' || opts.phase === 'ovulation' ? '--cy-fertile-fill'
      : opts.phase === 'luteal' ? '--cy-luteal' : opts.phase === 'follicular' ? '--cy-follicular' : '--cy-muted-soft';

  const root = svg('svg', { viewBox: `0 0 ${VB} ${VB}`, role: 'img', 'aria-label': opts.label || t('ციკლის რგოლი', 'Cycle ring'), class: opts.animate ? 'cy-dial-anim' : null });
  const defs = svg('defs');
  const grad = svg('radialGradient', { id: `${id}g`, cx: '50%', cy: '50%', r: '50%' });
  [[0, 0.18], [0.75, 0.04], [1, 0]].forEach(([o, a]) => grad.appendChild(svg('stop', { offset: o, style: `stop-color:var(${glowVar});stop-opacity:${a}` })));
  defs.appendChild(grad);
  root.appendChild(defs);
  const tickR = R - BAND / 2 - 9;
  root.appendChild(svg('circle', { cx: C, cy: C, r: tickR - 6, fill: `url(#${id}g)` }));

  if (length) {
    for (let i = 0; i < count; i += 1) {
      const d = i + 1;
      const deg = slotDeg(i + 0.5, count);
      const long = d === 1 || d % 7 === 0;
      const logged = recorded.has(d);
      const p0 = pt(deg, tickR); const p1 = pt(deg, tickR - (long ? 7 : logged ? 5 : 3));
      root.appendChild(svg('line', { x1: p0.x, y1: p0.y, x2: p1.x, y2: p1.y, class: `cy-tick${long ? ' long' : ''}${logged ? ' logged' : ''}` }));
    }
    for (const p of phases) {
      const from = slotDeg(p.from - 1, count) + capDeg;
      const to = slotDeg(p.to, count) - capDeg;
      const g = svg('g');
      const base = arcPath(from, Math.max(from, to));
      if (base) g.appendChild(svg('path', { d: base, class: `cy-arc base ${p.kind}`, 'stroke-width': BAND }));
      if (day != null && day >= p.from) {
        const livedTo = Math.min(to, slotDeg(Math.min(day, p.to), count) - capDeg);
        const lived = arcPath(from, Math.max(from, livedTo));
        if (lived) g.appendChild(svg('path', { d: lived, class: `cy-arc ${p.kind}`, 'stroke-width': BAND }));
      }
      if (p.kind === 'fertile' && opts.onFertile) {
        g.setAttribute('class', 'cy-fert-hit');
        g.addEventListener('click', (e) => { e.stopPropagation(); opts.onFertile(); });
      }
      root.appendChild(g);
    }
  } else {
    root.appendChild(svg('circle', { cx: C, cy: C, r: R, class: 'cy-arc empty', 'stroke-width': BAND }));
  }

  const knob = svg('g');
  root.appendChild(knob);
  const drawKnob = (d, scrubbing) => {
    while (knob.firstChild) knob.removeChild(knob.firstChild);
    if (d == null) return;
    const at = pt(slotDeg(d - 0.5, count));
    const kPhase = phases.find((p) => d >= p.from && d <= p.to)?.kind;
    const colorVar = recorded.has(d) ? '--cy-period' : kPhase ? PHASE_VAR[kPhase] : '--cy-ink';
    if (!scrubbing) knob.appendChild(svg('circle', { cx: at.x, cy: at.y, r: BAND * 0.95, class: 'cy-halo', style: `fill:var(${colorVar})` }));
    knob.appendChild(svg('circle', { cx: at.x, cy: at.y, r: BAND / 2 + 5, class: 'cy-knob-bg' }));
    knob.appendChild(svg('circle', { cx: at.x, cy: at.y, r: BAND / 2 + 1, class: 'cy-knob-ring', style: `stroke:var(${colorVar})` }));
    knob.appendChild(svg('circle', { cx: at.x, cy: at.y, r: 3, style: `fill:var(${colorVar})` }));
  };
  drawKnob(day, false);

  const topEl = h('div', { class: 'cy-dial-top' });
  const valEl = h('div', { class: 'cy-dial-value' });
  const botEl = h('div', { class: 'cy-dial-bottom' });
  const setCenter = (c) => {
    const value = c?.value ?? (opts.hideLength ? '—' : day != null ? String(day) : '—');
    const top = c ? c.top : t('ციკლის დღე', 'Cycle day');
    const bottom = c ? c.bottom : opts.hideLength ? null : t(`${length}-დან`, `of ${length}`);
    topEl.textContent = top || '';
    topEl.hidden = !top;
    valEl.textContent = value;
    valEl.className = `cy-dial-value${c?.tone === 'period' ? ' period' : ''}${c?.word || /\D/.test(value) && value !== '—' ? ' word' : ''}`;
    botEl.textContent = bottom || '';
    botEl.hidden = !bottom;
  };
  setCenter(opts.center);

  const wrap = h('div', { class: `cy-dial${opts.compact ? ' compact' : ''}` }, root, h('div', { class: 'cy-dial-center' }, topEl, valEl, botEl));

  // Hover / touch scrub along the ring: preview any day of this cycle; leaving returns to today.
  if (length && opts.describeDay && !opts.compact) {
    let current = null;
    const dayAt = (ev) => {
      const r = root.getBoundingClientRect();
      if (!r.width) return null;
      const scale = VB / r.width;
      const dx = (ev.clientX - r.left) * scale - C;
      const dy = (ev.clientY - r.top) * scale - C;
      const dist = Math.hypot(dx, dy);
      if (dist < R - BAND * 2.2 || dist > R + BAND * 1.6) return null;
      let deg = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
      if (deg < 0) deg += 360;
      return Math.min(count, Math.floor((deg / 360) * count) + 1);
    };
    const reset = () => { current = null; drawKnob(day, false); setCenter(opts.center); };
    wrap.addEventListener('pointermove', (ev) => {
      const d = dayAt(ev);
      if (d == null) { if (current != null) reset(); return; }
      if (d === current) return;
      current = d;
      drawKnob(d, true);
      setCenter(opts.describeDay(d) || opts.center);
    });
    wrap.addEventListener('pointerleave', reset);
    wrap.addEventListener('pointercancel', reset);
  }
  return wrap;
}

function describeDayFn(b, v) {
  return (d) => {
    if (!v.cycleStart) return null;
    const date = addKey(v.cycleStart, d - 1);
    const [, mm, dd] = date.split('-').map(Number);
    const mark = b.predictions?.calendar?.[date];
    const logged = (b.logs || []).some((l) => l.date === date && isBleed(l.flow));
    const phaseText = logged ? t('მენსტრუაცია · აღრიცხული', 'Period · logged')
      : !v.hidePredicted && mark?.phaseKa && mark.phase !== 'unknown' ? t(`სავარაუდოდ ${mark.phaseKa.toLowerCase()}`, `Likely ${mark.phaseKa.toLowerCase()}`) : null;
    return { top: date === v.today ? t('დღეს', 'Today') : `${dd} ${KA_MONTHS[mm - 1]}`, value: String(d), bottom: phaseText ?? t('ციკლის დღე', 'Cycle day'), tone: logged ? 'period' : 'ink' };
  };
}

function dialFor(b, v, extra = {}) {
  return dial({
    day: v.day,
    cycleLength: v.cycleLen,
    periodLength: v.periodLen,
    hideLength: v.hideLengthChrome,
    recordedDays: v.recordedDays,
    fertileDays: v.fertileDays,
    lutealFrom: v.lutealFrom,
    center: v.center,
    phase: v.phase,
    periodActive: v.onPeriod,
    describeDay: v.hideLengthChrome ? null : describeDayFn(b, v),
    label: [v.day != null ? t(`ციკლის დღე ${v.day}`, `Cycle day ${v.day}`) : null, v.phaseHint, v.statusLine].filter(Boolean).join('. '),
    ...extra,
  });
}

/** „სავარაუდო · 6 ოქტომბერი“, or a window „სავარაუდო · 6 – 10 ოქტომბერი“ for variable cycles (mobile PredictionBadge). */
function predBadge(date, until = null) {
  // A window reads like the app's badge and the calendar legend: „30 სექ – 9 ოქტ“ (full dates in the tooltip).
  const range = Boolean(until && until !== date);
  const text = range ? shortRange(date, until) : fmtDate(date);
  return h('span', { class: 'cy-pred', title: range ? `${t('სავარაუდო თარიღი', 'Estimated date')}: ${fmtDate(date)} – ${fmtDate(until)}` : t('სავარაუდო თარიღი', 'Estimated date') }, h('i', { class: 'cy-pred-dot' }), t(`სავარაუდო · ${text}`, `Estimated · ${text}`));
}

/** The estimate badge for the hero / Home: a variable cycle's whole window (mobile CycleHero + cyclePeriodWindow). */
function nextBadge(v) {
  if (!v.next || !v.forecastOn || v.onPeriod) return null;
  // Perimenopause: the window while it is ahead or open — never the single estimate, nothing once it passed.
  if (v.caps.peri) return v.periodWindow && v.windowKind ? predBadge(v.periodWindow.from, v.periodWindow.to) : null;
  if (v.periodWindow && v.windowKind) return predBadge(v.periodWindow.from, v.periodWindow.to);
  return predBadge(v.next);
}

/* ── Page ────────────────────────────────────────────────────────────────── */
export default async function cyclePage(root, ctx = {}) {
  ensureCss();
  root.classList.add('cy');
  const state = {
    bundle: null,
    cursor: null,
    editing: false,
    pending: { add: new Set(), remove: new Set() },
    firstPaint: true,
    alive: true,
    /** W3-2: AI consent read quietly (null = not known yet). The tips never open the disclosure on their own. */
    aiOn: null,
  };

  if (!isFemale()) {
    mount(root, pageHead(t('ციკლი', 'Cycle')), empty(t('ეს მოდული ხელმისაწვდომია ქალის პროფილისთვის.', 'This module is available for female profiles.'), t('პროფილში მიუთითე სქესი', 'Set your sex in your profile'), button(t('პროფილი', 'Profile'), { href: '/profile', variant: 'ghost' })));
    return () => root.classList.remove('cy');
  }

  const setBundle = (b) => {
    if (!b || !b.profile) return;
    state.bundle = b;
    if (state.alive) render();
  };

  const load = async () => {
    mount(root, pageHead(t('ციკლი', 'Cycle'), t('პროგნოზები, სიმპტომები და განწყობა', 'Predictions, symptoms and mood')),
      h('div', { class: 'cy-layout' }, h('div', { class: 'cy-col' }, skeleton(6)), h('div', { class: 'cy-col' }, skeleton(8))));
    try {
      const b = await get('/api/cycle');
      state.bundle = b;
      const tk = cycleToday(b).split('-').map(Number);
      state.cursor = { y: tk[0], m: tk[1] - 1 };
      render();
      // GET /api/ai-consent only reads the state — it never shows the disclosure or sends anything to the AI.
      readAiConsent().then((st) => { state.aiOn = st?.accepted === true; }, () => { state.aiOn = false; })
        .then(() => { if (state.alive && state.bundle) render(); });
    } catch (e) {
      mount(root, pageHead(t('ციკლი', 'Cycle')), errorBox(e, load));
    }
  };

  /* Writes ------------------------------------------------------------- */
  const startPeriod = async (btn) => {
    const v = derive(state.bundle);
    const date = v.today;
    await busy(btn, async () => {
      try {
        const b = await put('/api/cycle/period', { action: 'start', date, flow: 'medium' });
        setBundle(b);
        toast(t('მენსტრუაცია დაფიქსირდა — დღეს პირველი დღეა', 'Period logged — today is day 1'), 'ok', {
          ms: 8000,
          action: { label: t('გაუქმება', 'Undo'), onClick: () => undoStart(date) },
        });
      } catch (e) { toast(e.message, 'error'); }
    });
  };
  const undoStart = async (date) => {
    try {
      // "end" on the first day clears that one-day period again (server planEndPeriod).
      setBundle(await put('/api/cycle/period', { action: 'end', date }));
      toast(t('გაუქმდა', 'Undone'), 'info');
    } catch (e) { toast(e.message, 'error'); }
  };
  /**
   * One-tap end (the app's Flo-style end, no confirmation): „მენსტრუაციის დასრულება“ in the hero, the
   * Tracking card's end and „ჯერ კიდევ გაქვს?“ → „დასრულდა“ all use it. Same PUT as the app; the server
   * keeps today as flow „none“. Undo puts the day back exactly as it was (a bleeding level, an empty flow,
   * or no log).
   */
  const endPeriodNow = async (btn) => {
    const v = derive(state.bundle);
    const date = v.today;
    const undo = periodEndUndo(v.todayLog ? { flow: v.todayLog.flow } : null);
    await busy(btn, async () => {
      try {
        setBundle(await put('/api/cycle/period', { action: 'end', date }));
        toast(undo.kind === 'restoreFlow'
          ? t('მენსტრუაცია დასრულდა — დღევანდელი სისხლდენა მოიხსნა.', 'Period ended — today’s bleeding was removed.')
          : t('მენსტრუაცია დასრულდა — დღე სისხლდენის გარეშე აღირიცხა.', 'Period ended — today is logged without bleeding.'), 'ok', {
          ms: 8000,
          action: undo.kind === 'keep' ? null : { label: t('გაუქმება', 'Undo'), onClick: async () => {
            try {
              if (undo.kind === 'removeLog') setBundle(await del(`/api/cycle/logs/${date}`));
              else setBundle((await put(`/api/cycle/logs/${date}`, { flow: undo.kind === 'restoreFlow' ? undo.flow : null })).bundle);
            } catch (e) { toast(e.message, 'error'); }
          } },
        });
      } catch (e) { toast(e.message, 'error'); }
    });
  };
  /** A soft „…დასრულება“ button wired to the one-tap end (busy while the PUT runs). */
  const endButton = (label) => {
    const btn = button(label, { variant: 'ghost', class: 'cy-soft-btn' });
    btn.addEventListener('click', () => endPeriodNow(btn));
    return btn;
  };
  /** „ჯერ კიდევ გაქვს?“ → „კი“: today's flow at her last logged level, else light. */
  const stillBleeding = async (btn) => {
    const v = derive(state.bundle);
    await busy(btn, async () => {
      try {
        setBundle((await put(`/api/cycle/logs/${v.today}`, { flow: stillBleedingFlow(state.bundle.logs, v.today) })).bundle);
        toast(t('შენახულია', 'Saved'));
      } catch (e) { toast(e.message, 'error'); }
    });
  };

  /** Flo-style one tap: mark sex for today; the rest of the day's log is untouched (server merges fields). */
  const logSexNow = async (btn) => {
    const v = derive(state.bundle);
    const before = v.todayLog?.sexualActivity === true ? true : null;
    if (before === true || (v.todayLog?.symptoms || []).some((id) => SEX_ACTIVITY_IDS.has(id))) {
      openDayLog(v.today, { only: 'sex' });
      return;
    }
    await busy(btn, async () => {
      try {
        const res = await put(`/api/cycle/logs/${v.today}`, { sexualActivity: true });
        setBundle(res.bundle);
        toast(t('სექსი აღირიცხა — დღეს. მხოლოდ შენ ხედავ.', 'Sex logged — today. Only you can see this.'), 'ok', {
          ms: 8000,
          action: { label: t('გაუქმება', 'Undo'), onClick: async () => {
            try { setBundle((await put(`/api/cycle/logs/${v.today}`, { sexualActivity: before })).bundle); } catch (e) { toast(e.message, 'error'); }
          } },
        });
      } catch (e) { toast(e.message, 'error'); }
    });
  };

  const openDayLog = (date, opts = {}) => openDayModal(state.bundle, date, { ...opts, onBundle: setBundle });

  /**
   * „საშუალოდან დამალვა“ (W3-2, like the app's history list): one click, no confirmation, never asks why.
   * The whole list goes to PUT /api/cycle/profile; the toast offers „გაუქმება“.
   */
  const toggleHidden = async (start, hide, btn = null, isUndo = false) => {
    const list = new Set(state.bundle?.profile?.hiddenCycles || []);
    if (hide) list.add(start);
    else list.delete(start);
    const run = async () => {
      try {
        setBundle(await put('/api/cycle/profile', { hiddenCycles: [...list].sort() }));
        if (isUndo) return;
        toast(hide ? t('ციკლი საშუალოდან დაიმალა', 'Cycle hidden from averages') : t('ციკლი საშუალოში დაბრუნდა', 'Cycle counted again'), 'ok', {
          ms: 6000,
          action: { label: t('გაუქმება', 'Undo'), onClick: () => toggleHidden(start, !hide, null, true) },
        });
      } catch (e) { toast(e.message, 'error'); }
    };
    if (btn) await busy(btn, run);
    else await run();
  };

  const openSettings = () => openSettingsModal(state.bundle, setBundle);

  /* Render ------------------------------------------------------------- */
  function render() {
    const b = state.bundle;
    const v = derive(b);
    const subtitle = headerSubtitle(b, v);
    const head = pageHead(t('ციკლი', 'Cycle'), subtitle,
      button(t('აღრიცხვა', 'Log'), { icon: 'plus', variant: 'ghost', onClick: () => openDayLog(v.today) }),
      iconButton('settings', { title: t('ციკლის პარამეტრები', 'Cycle settings'), onClick: openSettings }));

    if (v.needsOnboarding) {
      mount(root, head, onboardingCard(b, setBundle));
      return;
    }

    const left = [];
    const right = [];

    for (const a of (b.alerts || []).filter((x) => x?.messageKa).slice(0, 2)) {
      if (!v.caps.late && a.late) continue;
      left.push(h('div', { class: `cy-alert ${a.level || 'info'}` }, icon(a.level === 'info' ? 'info' : 'alert', { size: 18 }), h('div', null, a.messageKa)));
    }

    if (v.caps.pregnancy) left.push(section(null, pregnancyCard(b, v, () => openDayLog(v.today))));
    else if (v.caps.postpartum) left.push(section(null, postpartumCard(b, v, () => openDayLog(v.today))));
    else if (v.tracking) left.push(section(null, trackingCard(b, v)));
    else left.push(section(null, heroCard(b, v)));

    if (v.caps.peri) left.push(section(t('პერიმენოპაუზის თვალყური', 'Perimenopause tracking'), periCard(b, v)));
    if (v.caps.ttc) {
      // TTC: the wide window before 3 cycles, else the 3-day ovulation band with its source (mobile CycleTtcCard).
      const ttcLine = v.wideWindow && b.predictions?.fertileWindow
        ? `${t('სავარაუდო ნაყოფიერი', 'Estimated fertile')} · ${shortRange(b.predictions.fertileWindow.start, b.predictions.fertileWindow.end)} · ${wideWindowLabel()}`
        : v.ovulationRange ? ovulationBandLine(v.ovulationRange, v.gate.ovulationSource) : null;
      left.push(section(null, h('div', { class: 'cy-mode-note' }, icon('info', { size: 18 }), h('div', null,
        ttcLine ? h('div', { class: 'cy-ttc-line' }, ttcLine) : null,
        t('ციკლის პროგნოზები სავარაუდოა. LH ტესტი, ტემპერატურა და ლორწო შენი აღრიცხვაა. ნაყოფიერების ჩანაწერებს დღის აღრიცხვაში იპოვი.', 'Cycle predictions are estimates. LH tests, temperature and mucus are your own logs. You’ll find fertility logs in the day log.')))));
    }
    if (b.contraception?.presentation?.showContextCard) {
      left.push(section(null, modeNote('shield', t('კონტრაცეფციის მეთოდის გამო პროგნოზები შეზღუდულია — ყველაზე ზუსტი შენი აღრიცხვებია. Medicard არ არის კონტრაცეფციის მეთოდი.', 'Because of your contraception method, predictions are limited — your own logs are the most accurate. Medicard is not a method of contraception.'))));
    }

    left.push(section(t('დღეს', 'Today'), todayCard(b, v, () => openDayLog(v.today))));
    if (!v.caps.pregnancy && !v.caps.postpartum) left.push(section(t('ჩემი ციკლი', 'My cycle'), statsCard(b)));
    // „ბოლო ციკლები“ (W3-4): the same cycles as the numbers above, as bars + the latest vs her usual.
    const comparison = !v.caps.pregnancy && !v.caps.postpartum ? comparisonCard(b) : null;
    if (comparison) left.push(section(t('ბოლო ციკლები', 'Recent cycles'), comparison));
    // „შენს ციკლში ცვლილება შევნიშნეთ“ — only when the server found something; no „not enough data“ state.
    const deviations = deviationsCard(b);
    if (deviations) left.push(section(null, deviations));

    right.push(section(t('კალენდარი', 'Calendar'), calendarCard(b, v), {
      action: state.editing ? null : button(t('თარიღების შესწორება', 'Edit dates'), { size: 'sm', variant: 'ghost', icon: 'edit', onClick: () => { state.editing = true; state.pending = { add: new Set(), remove: new Set() }; render(); } }),
    }));
    if (!v.caps.pregnancy) right.push(section(t('ციკლების ისტორია', 'Cycle history'), historyCard(b, toggleHidden)));
    right.push(section(t('დღის რჩევები', 'Tips for today'), tipsBlock(b, v, render, {
      on: state.aiOn,
      set: (on) => { state.aiOn = on; },
    })));

    mount(root, head, h('div', { class: 'cy-layout' }, h('div', { class: 'cy-col' }, left), h('div', { class: 'cy-col' }, right)));
    state.firstPaint = false;
  }

  function heroCard(b, v) {
    const actions = [];
    const logBtn = (primary) => button(v.onPeriod ? t('დღევანდელი სისხლდენა', 'Today’s flow') : t('დღის აღრიცხვა', 'Log today'), {
      icon: v.onPeriod ? 'droplet' : 'plus', variant: primary ? 'rose' : 'ghost', class: primary ? '' : 'cy-soft-btn', onClick: () => openDayLog(v.today),
    });
    const startBtn = (primary) => {
      const btn = button(v.startLabel, { icon: 'droplet', variant: primary ? 'rose' : 'ghost', class: primary ? '' : 'cy-soft-btn' });
      btn.addEventListener('click', () => startPeriod(btn));
      return btn;
    };
    const sexLogged = v.todayLog?.sexualActivity === true || (v.todayLog?.symptoms || []).some((id) => SEX_ACTIVITY_IDS.has(id));
    const sexBtn = h('button', {
      type: 'button', class: `cy-sex-btn${sexLogged ? ' on' : ''}`,
      title: sexLogged ? t('სექსი დღეს აღრიცხულია — დეტალების გახსნა', 'Sex logged today — open details') : t('სექსის აღრიცხვა დღეს — ერთი შეხებით', 'Log sex today — one tap'),
      'aria-label': sexLogged ? t('სექსი დღეს აღრიცხულია — დეტალების გახსნა', 'Sex logged today — open details') : t('სექსის აღრიცხვა დღეს — ერთი შეხებით', 'Log sex today — one tap'),
    }, icon(sexLogged ? 'check' : 'heart', { size: 16 }), t('სექსი', 'Sex'));
    sexBtn.addEventListener('click', () => logSexNow(sexBtn));

    const canStart = v.caps.forecast || v.caps.fertile; // not in pregnancy / postpartum
    if (v.onPeriod) {
      actions.push(logBtn(true), h('div', { class: 'cy-actions-row' }, endButton(t('მენსტრუაციის დასრულება', 'End period')), sexBtn));
    } else if (v.askStill) {
      // On the question day „მენსტრუაცია დაიწყო“ would only repeat „კი“ (mobile heroPlanWhileAsking).
      sexBtn.classList.add('wide');
      actions.push(logBtn(true), h('div', { class: 'cy-actions-row' }, sexBtn));
    } else if (v.startLeads && canStart) {
      actions.push(startBtn(true), h('div', { class: 'cy-actions-row' }, logBtn(false), sexBtn));
    } else {
      actions.push(logBtn(true), h('div', { class: 'cy-actions-row' }, canStart ? startBtn(false) : h('span', { style: { flex: 1 } }), sexBtn));
    }

    const explainFertile = v.fertileDays ? () => {
      const from = addKey(v.cycleStart, v.fertileDays.from - 1);
      const to = addKey(v.cycleStart, v.fertileDays.to - 1);
      const cautious = b.predictions?.confidence === 'low' || b.profile?.isIrregular || v.pcos;
      openModal({
        title: t('სავარაუდო ნაყოფიერი დღეები', 'Estimated fertile days'),
        size: 'sm',
        body: h('div', { class: 'stack' },
          h('strong', { class: 'cy-fertile-range' }, `${fmtDate(from)} – ${fmtDate(to)}`),
          v.wideWindow ? h('div', { class: 'cy-fertile-range' }, wideWindowLabel()) : null,
          v.ovulationRange ? h('div', { class: 'cy-fertile-range' }, ovulationBandLine(v.ovulationRange, v.gate.ovulationSource)) : null,
          h('p', { class: 'muted' }, cautious
            ? t('ეს დღე შეიძლება ნაყოფიერ ფანჯარაში იყოს. პროგნოზის სანდოობა დაბალია. Medicard არ არის კონტრაცეფციის მეთოდი.', 'These days may be in your fertile window. Prediction confidence is low. Medicard is not a method of contraception.')
            : v.caps.ttc ? t('სავარაუდო ნაყოფიერი ფანჯარა — TTC რეჟიმში ეს დღეები ხშირად უფრო ყურადღებადია. ეს არ ადასტურებს ოვულაციას.', 'Estimated fertile window — in TTC mode these days often get more attention. This does not confirm ovulation.')
              : t('ამ დღეებში სავარაუდო ნაყოფიერი ფანჯარაა — კალენდარული შეფასებაა, არა დადგენილი ნაყოფიერება. Medicard არ არის კონტრაცეფციის მეთოდი.', 'These days are your estimated fertile window — a calendar estimate, not confirmed fertility. Medicard is not a method of contraception.'))),
      });
    } : null;

    const explainPhase = () => openModal({
      title: t('როგორ ითვლება?', 'How is this calculated?'),
      size: 'sm',
      body: h('p', { class: 'muted' }, t('შენ აღრიცხავ მენსტრუაციის დაწყებას. Medicard ბოლო ციკლების საშუალო ხანგრძლივობით აფასებს შემდეგ თარიღებს. რაც მეტ ციკლს აღრიცხავ, მით უფრო ზუსტდება შეფასება. ეს ყოველთვის შეფასებაა და შეიძლება გადაიწიოს.', 'You log when your period starts. Medicard estimates the next dates from the average length of your recent cycles. The more cycles you log, the better the estimate gets. It is always an estimate and may shift.')),
    });

    const glowDot = v.onPeriod || v.phase === 'period' ? 'var(--cy-period)' : v.phase === 'fertile' || v.phase === 'ovulation' ? 'var(--cy-fertile-fill)'
      : v.phase === 'luteal' ? 'var(--cy-luteal)' : v.phase === 'follicular' ? 'var(--cy-follicular)' : 'var(--cy-muted-soft)';

    const cycleLenRound = Math.round(v.cycleLen) || 28;
    const underLine = v.center && v.day != null
      ? h('div', { class: 'cy-status' }, v.day > cycleLenRound ? t(`ჩვეულებრივ ციკლი ${cycleLenRound} დღეა`, `Your cycle is usually ${cycleLenRound} days`) : t(`ციკლის ${v.day}-ე დღე · ${cycleLenRound}-დან`, `Cycle day ${v.day} · of ${cycleLenRound}`))
      : h('div', { class: `cy-status${v.statusLine ? ' strong' : ''}` }, v.statusLine || (v.hideLengthChrome ? t('ციკლის პროგნოზისთვის ჯერ საკმარისი ახალი ისტორია არ არის.', 'There isn’t enough recent history yet for a cycle forecast.') : t('ვსწავლობთ შენს რიტმს — აღრიცხე შემდეგი მენსტრუაცია', 'Learning your rhythm — log your next period')));

    return card({ class: 'cy-hero' },
      dialFor(b, v, { animate: state.firstPaint, onFertile: explainFertile }),
      h('button', { type: 'button', class: `cy-phase-pill${v.onPeriod ? ' period' : ''}`, onClick: v.hideLengthChrome ? null : explainPhase, title: t('როგორ ითვლება?', 'How is this calculated?') },
        h('i', { style: { background: glowDot } }), v.phaseHint, v.hideLengthChrome ? null : icon('info', { size: 14 })),
      underLine,
      (v.caps.peri ? Boolean(v.windowKind) && !v.onPeriod : v.forecastOn || (v.caps.forecast && !v.hidePredicted))
        ? h('div', { class: 'cy-badges' }, nextBadge(v), h('span', { class: 'cy-conf' }, v.confidence))
        : null,
      !v.hideLengthChrome && (v.fertileDays || v.cycleStart)
        ? h('div', { class: 'cy-dial-legend', 'aria-hidden': 'true' },
          h('span', null, h('i', { class: 'cy-dot period' }), t('მენსტრუაცია', 'Period')),
          h('span', null, h('i', { class: 'cy-dot follicular' }), t('ფოლიკულური', 'Follicular')),
          v.fertileDays ? h('span', null, h('i', { class: 'cy-dot fertile' }), t('ნაყოფიერი', 'Fertile')) : null,
          v.fertileDays || v.lutealFrom ? h('span', null, h('i', { class: 'cy-dot luteal' }), t('ლუთეალური', 'Luteal')) : null)
        : null,
      // Before 3 cycles the fertile arc is not drawn — this quiet badge stands in its place.
      v.learning ? h('div', { class: 'cy-badges' }, learningBadge(v.gate)) : null,
      v.wideWindow && v.fertileDays ? h('div', { class: 'cy-wide' }, `${t('სავარაუდო ნაყოფიერი', 'Estimated fertile')} · ${wideWindowLabel()}`) : null,
      !v.hideLengthChrome ? h('div', { class: 'cy-hint' }, t('მიიტანე კურსორი რგოლზე — ნახე ნებისმიერი დღე', 'Move your cursor along the ring to see any day')) : null,
      v.pcos && v.fertilityVisible ? h('div', { class: 'cy-caution' }, t('შენ მიუთითე PCOS — სავარაუდო ოვულაცია ნაკლებად საიმედოა. ეს არ არის კონტრაცეფციის რჩევა.', 'You noted PCOS — estimated ovulation is less reliable. This is not contraception advice.')) : null,
      v.askStill ? stillRow() : null,
      h('div', { class: 'cy-actions' }, actions));
  }

  /** „ჯერ კიდევ გაქვს?“ [კი · დასრულდა] (mobile CycleStillBleedingRow). No answer → ended tomorrow, never asked again. */
  function stillRow() {
    const yes = h('button', { type: 'button', class: 'cy-still-btn yes', 'aria-label': t('კი, ჯერ კიდევ მაქვს — დღევანდელი სისხლდენის აღრიცხვა', 'Yes, still bleeding — log today’s flow') }, t('კი', 'Yes'));
    const ended = h('button', { type: 'button', class: 'cy-still-btn', 'aria-label': t('მენსტრუაცია დასრულდა', 'My period ended') }, t('დასრულდა', 'It ended'));
    yes.addEventListener('click', () => stillBleeding(yes));
    ended.addEventListener('click', () => endPeriodNow(ended));
    return h('div', { class: 'cy-still' }, h('span', { class: 'cy-still-q' }, t('ჯერ კიდევ გაქვს?', 'Still bleeding?')), h('span', { class: 'cy-still-choices' }, yes, ended));
  }

  /**
   * „თვალყურის დევნება“ / Tracking hero (mobile CycleTrackingHero): she expects no periods, so nothing is
   * estimated. The ring is the last four weeks of what she logged, today's date in the centre, then
   * „როგორ ხარ დღეს?“ and the log action. A manual new cycle stays and never turns forecasts back on.
   */
  function trackingCard(b, v) {
    const ring = trackingRingDays(v.today, b.logs);
    const [, mm, dd] = v.today.split('-').map(Number);
    const explain = () => openModal({
      title: trackingCopy.title(),
      size: 'sm',
      body: h('div', { class: 'stack' }, trackingCopy.explainBody().map((p) => h('p', { class: 'muted' }, p)), trackingLegend(), h('p', { class: 'faint', style: { fontSize: '12px' } }, trackingCopy.explainCaption())),
    });
    const startBtn = button(trackingCopy.newCycleShort(), { icon: 'droplet', variant: 'ghost', class: 'cy-soft-btn' });
    startBtn.setAttribute('aria-label', trackingCopy.newCycle());
    startBtn.title = trackingCopy.newCycle();
    startBtn.addEventListener('click', () => startPeriod(startBtn));
    const endBtn = endButton(trackingCopy.endBleed());
    const sexLogged = v.todayLog?.sexualActivity === true || (v.todayLog?.symptoms || []).some((id) => SEX_ACTIVITY_IDS.has(id));
    const sexBtn = h('button', {
      type: 'button', class: `cy-sex-btn${sexLogged ? ' on' : ''}`,
      'aria-label': sexLogged ? t('სექსი დღეს აღრიცხულია — დეტალების გახსნა', 'Sex logged today — open details') : t('სექსის აღრიცხვა დღეს — ერთი შეხებით', 'Log sex today — one tap'),
    }, icon(sexLogged ? 'check' : 'heart', { size: 16 }), t('სექსი', 'Sex'));
    sexBtn.addEventListener('click', () => logSexNow(sexBtn));
    return card({ class: 'cy-hero' },
      trackingDial(ring, { top: t('დღეს', 'Today'), value: String(dd), bottom: KA_MONTHS[mm - 1], label: `${trackingCopy.title()}. ${trackingCopy.ringA11y(ring.bleed.length, ring.logged.length + ring.spotting.length)}` }),
      h('button', { type: 'button', class: 'cy-phase-pill', onClick: explain, title: trackingCopy.title() },
        h('i', { style: { background: 'var(--cy-muted-soft)' } }), trackingCopy.title(), icon('info', { size: 14 })),
      h('div', { class: 'cy-status strong' }, trackingCopy.howAreYou()),
      h('div', { class: 'cy-status cy-status-sub' }, trackingCopy.detail()),
      trackingLegend(),
      h('div', { class: 'cy-hint' }, trackingCopy.ringHint()),
      h('div', { class: 'cy-actions' },
        button(t('დღის აღრიცხვა', 'Log today'), { icon: 'plus', variant: 'rose', onClick: () => openDayLog(v.today) }),
        h('div', { class: 'cy-actions-row' }, isBleed(v.todayLog?.flow) ? endBtn : startBtn, sexBtn)));
  }

  function calendarCard(b, v) {
    const marks = buildMarks(b);
    const { y, m } = state.cursor;
    const first = new Date(y, m, 1);
    const startPad = (first.getDay() + 6) % 7;
    const dim = new Date(y, m + 1, 0).getDate();
    const cells = [];
    WEEKDAYS.forEach((w) => cells.push(h('div', { class: 'cy-cal-h' }, w)));
    for (let i = 0; i < startPad; i += 1) cells.push(h('div'));
    const editing = state.editing;
    const { add, remove } = state.pending;
    for (let d = 1; d <= dim; d += 1) {
      const key = dateKey(y, m, d);
      const mark = marks[key] || {};
      const L = classifyDay(mark, { showFertility: v.fertilityVisible, showPredicted: v.showPredicted });
      const future = key > v.today;
      const cls = ['cy-day'];
      if (key === v.today) cls.push('today');
      if (L.loggedPeriod) cls.push('logged');
      else if (L.predictedPeriod) cls.push('expected');
      else if (L.ovulation) cls.push('ovulation');
      else if (L.fertile) cls.push('fertile');
      if (L.spotting) cls.push('spotting');
      if (editing && add.has(key)) cls.push('add');
      if (editing && remove.has(key)) cls.push('remove');
      const aria = [
        `${d} ${KA_MONTHS[m]}`,
        key === v.today ? t('დღეს', 'Today') : null,
        L.loggedPeriod ? (v.caps.postpartum ? t('სისხლდენა', 'Bleeding') : t('მენსტრუაცია', 'Period')) : null,
        L.spotting ? t('ლაქები', 'Spotting') : null,
        L.predictedPeriod ? t('სავარაუდო მენსტრუაცია', 'Estimated period') : null,
        L.ovulation ? t('სავარაუდო ოვულაცია', 'Estimated ovulation') : L.fertile ? t('სავარაუდო ნაყოფიერი', 'Estimated fertile') : null,
        L.symptomDot ? t('აღრიცხული', 'Logged') : null,
      ].filter(Boolean).join(', ');
      cells.push(h('button', {
        type: 'button', class: cls.join(' '), 'aria-label': aria, disabled: editing && future,
        onClick: () => {
          if (!editing) { openDayLog(key); return; }
          const isLogged = L.loggedPeriod;
          if (isLogged) { if (remove.has(key)) remove.delete(key); else remove.add(key); } else if (add.has(key)) add.delete(key); else add.add(key);
          render();
        },
      },
      h('span', { class: 'cy-day-ring' }, h('span', { class: 'cy-day-in' }, String(d))),
      L.symptomDot ? h('span', { class: 'cy-sym' }) : L.spotting ? h('span', { class: 'cy-spot' }) : null));
    }
    const shift = (delta) => {
      const n = new Date(y, m + delta, 1);
      state.cursor = { y: n.getFullYear(), m: n.getMonth() };
      render();
    };
    const tt = v.today.split('-').map(Number);
    const onTodayMonth = tt[0] === y && tt[1] - 1 === m;

    const changes = add.size + remove.size;
    // Before 3 cycles there are no fertile marks: the legend drops those rows and shows the learning badge.
    const calendarLearning = v.showPredicted && v.fertilityVisible && v.gate.status === 'LEARNING';
    const fertileLegend = v.showPredicted && v.fertilityVisible && !calendarLearning;
    const saveBtn = button(changes ? t(`შენახვა · ${changes} ცვლილება`, `Save · ${plural(changes, 'change')}`) : t('ცვლილება არ არის', 'No changes'), { size: 'sm', variant: 'rose', disabled: !changes });
    saveBtn.addEventListener('click', () => busy(saveBtn, async () => {
      try {
        const nb = await put('/api/cycle/period/days', { add: [...add], remove: [...remove] });
        state.editing = false;
        state.pending = { add: new Set(), remove: new Set() };
        setBundle(nb);
        toast(t('მენსტრუაციის თარიღები განახლდა', 'Period dates updated'));
      } catch (e) { toast(e.message, 'error'); }
    }));

    return card(
      h('div', { class: 'cy-cal-head' },
        iconButton('chevronLeft', { title: t('წინა თვე', 'Previous month'), onClick: () => shift(-1) }),
        h('h3', null, `${KA_MONTHS[m]} ${y}`),
        onTodayMonth ? null : button(t('დღეს', 'Today'), { size: 'sm', variant: 'ghost', onClick: () => { state.cursor = { y: tt[0], m: tt[1] - 1 }; render(); } }),
        iconButton('chevronRight', { title: t('შემდეგი თვე', 'Next month'), onClick: () => shift(1) })),
      h('div', { class: `cy-cal${editing ? ' editing' : ''}` }, cells),
      editing
        ? h('div', { class: 'cy-edit-bar' },
          h('span', { style: { flex: '1 1 240px' } }, t('მონიშნე დღეები, როცა მენსტრუაცია გქონდა, ან მოხსენი მონიშვნა. წყვეტილი წრე სავარაუდო დღეებს აჩვენებს.', 'Click the days you had your period, or click again to unmark. A dashed circle shows estimated days.')),
          h('div', { class: 'hstack' },
            button(t('გაუქმება', 'Cancel'), { size: 'sm', variant: 'ghost', onClick: () => { state.editing = false; state.pending = { add: new Set(), remove: new Set() }; render(); } }),
            saveBtn))
        : null,
      h('div', { class: 'cy-legend' },
        h('span', null, h('i', { class: 'cy-lg logged' }), v.caps.postpartum || v.tracking ? t('სისხლდენა', 'Bleeding') : t('მენსტრუაცია', 'Period')),
        // A variable cycle: the calendar paints the whole window — the legend names the same range as the hero badge.
        v.showPredicted ? h('span', null, h('i', { class: 'cy-lg expected' }), v.periodWindow && v.periodWindow.state !== 'late' && v.caps.forecast
          ? `${t('სავარაუდო მენსტრუაცია', 'Estimated period')} · ${shortRange(v.periodWindow.from, v.periodWindow.to)}`
          : t('სავარაუდო მენსტრუაცია', 'Estimated period')) : null,
        fertileLegend ? h('span', null, h('i', { class: 'cy-lg fertile' }), v.wideWindow ? `${t('სავარაუდო ნაყოფიერი', 'Estimated fertile')} · ${wideWindowLabel()}` : t('სავარაუდო ნაყოფიერი', 'Estimated fertile')) : null,
        fertileLegend && !v.wideWindow ? h('span', null, h('i', { class: 'cy-lg ovulation' }), t('სავარაუდო ოვულაცია', 'Estimated ovulation')) : null,
        h('span', null, h('i', { class: 'cy-lg sym' }), t('აღრიცხული', 'Logged'))),
      calendarLearning ? h('div', { class: 'cy-cal-learning' }, learningBadge(v.gate)) : null,
      v.showPredicted ? h('p', { class: 'disclaimer' }, icon('info', { size: 14 }), t('შეფასება ბოლო ციკლების მიხედვით — თარიღები შეიძლება შეიცვალოს.', 'Estimated from your recent cycles — dates may change.')) : null);
  }

  await load();
  return () => { state.alive = false; root.classList.remove('cy'); };
}

/* ── Tracking ring (mobile homeCycle.trackingRingDays + CycleStatusGauge trackingWindow) ── */
const TRACKING_DAYS = 28;
/** Slot 1 … 28 = the last four weeks, 28 = today. Bleeding fills its slot, spotting / other logged days are dots. */
function trackingRingDays(today, logs, days = TRACKING_DAYS) {
  const bleed = new Set(); const spotting = new Set(); const logged = new Set();
  for (const l of logs || []) {
    if (!l?.date) continue;
    const back = daysBetween(l.date, today);
    if (back < 0 || back >= days) continue;
    const pos = days - back;
    if (isBleed(l.flow)) bleed.add(pos);
    else if (l.flow === 'spotting') spotting.add(pos);
    else logged.add(pos);
  }
  const sort = (set) => [...set].sort((a, b) => a - b);
  return { days, bleed: sort(bleed), spotting: sort(spotting), logged: sort(logged) };
}

function trackingDial(ring, center, { compact = false } = {}) {
  const count = ring.days;
  const root = svg('svg', { viewBox: `0 0 ${VB} ${VB}`, role: 'img', 'aria-label': center.label });
  root.appendChild(svg('circle', { cx: C, cy: C, r: R, class: 'cy-arc empty', 'stroke-width': BAND }));
  const capDeg = ((BAND / 2 + 2) / R) * (180 / Math.PI);
  // Consecutive bleeding days are one rose run (the calendar's solid grammar).
  const runs = [];
  for (const d of ring.bleed) {
    const last = runs[runs.length - 1];
    if (last && d === last.to + 1) last.to = d; else runs.push({ from: d, to: d });
  }
  for (const r of runs) {
    const from = slotDeg(r.from - 1, count) + capDeg;
    const to = Math.max(from + 0.5, slotDeg(r.to, count) - capDeg);
    const d = arcPath(from, to);
    if (d) root.appendChild(svg('path', { d, class: 'cy-arc period', 'stroke-width': BAND }));
    else { const p = pt(slotDeg(r.from - 0.5, count)); root.appendChild(svg('circle', { cx: p.x, cy: p.y, r: BAND / 2, style: 'fill:var(--cy-period)' })); }
  }
  for (const d of ring.spotting) { const p = pt(slotDeg(d - 0.5, count)); root.appendChild(svg('circle', { cx: p.x, cy: p.y, r: 4, style: 'fill:var(--cy-period)' })); }
  for (const d of ring.logged) { const p = pt(slotDeg(d - 0.5, count)); root.appendChild(svg('circle', { cx: p.x, cy: p.y, r: 3.5, style: 'fill:var(--cy-luteal)' })); }
  // Today (slot 28): the calm ink knob.
  const at = pt(slotDeg(count - 0.5, count));
  root.appendChild(svg('circle', { cx: at.x, cy: at.y, r: BAND / 2 + 5, class: 'cy-knob-bg' }));
  root.appendChild(svg('circle', { cx: at.x, cy: at.y, r: BAND / 2 + 1, class: 'cy-knob-ring', style: 'stroke:var(--cy-ink)' }));
  root.appendChild(svg('circle', { cx: at.x, cy: at.y, r: 3, style: 'fill:var(--cy-ink)' }));
  return h('div', { class: `cy-dial${compact ? ' compact' : ''}` }, root, h('div', { class: 'cy-dial-center' },
    h('div', { class: 'cy-dial-top' }, center.top), h('div', { class: 'cy-dial-value' }, center.value), h('div', { class: 'cy-dial-bottom' }, center.bottom)));
}

function trackingLegend() {
  return h('div', { class: 'cy-dial-legend', 'aria-hidden': 'true' },
    h('span', null, h('i', { class: 'cy-dot period' }), trackingCopy.bleedLegend()),
    h('span', null, h('i', { class: 'cy-dot period', style: { width: '6px', height: '6px' } }), t('ლაქები', 'Spotting')),
    h('span', null, h('i', { class: 'cy-dot luteal', style: { width: '6px', height: '6px' } }), t('აღრიცხული', 'Logged')));
}

/* ── Deviations card (mobile CycleDeviationsCard): /cycle only, never Home ─── */
function deviationsCard(b) {
  const lines = deviationLines(b.deviations);
  if (!lines.length) return null;
  const explain = () => openModal({
    title: deviationCopy.explainTitle(),
    size: 'sm',
    body: h('div', { class: 'stack' }, deviationCopy.explainBody(b.deviations?.rulesOff ?? []).map((p) => h('p', { class: 'muted' }, p))),
  });
  return card({ class: 'cy-dev' },
    h('div', { class: 'cy-dev-head' },
      h('span', { class: 'cy-dev-tile' }, icon('calendar', { size: 19 })),
      h('h3', null, deviationCopy.title()),
      iconButton('info', { title: deviationCopy.explainTitle(), onClick: explain })),
    h('ul', { class: 'cy-dev-lines' }, lines.map((line) => h('li', null, line))),
    h('p', { class: 'cy-dev-doctor' }, deviationCopy.doctorLine()));
}

function headerSubtitle(b, v) {
  if (v.tracking) return trackingCopy.title();
  if (v.caps.pregnancy) {
    const age = b.pregnancy?.age;
    return age ? t(`${age.week} კვირა + ${age.day} დღე`, `${plural(age.week, 'week')} + ${plural(age.day, 'day')}`) : t('ორსულობის რეჟიმი', 'Pregnancy mode');
  }
  if (v.caps.peri) return t('პერიმენოპაუზის რეჟიმი', 'Perimenopause mode');
  if (v.caps.postpartum) {
    const e = b.postpartum?.elapsed;
    return e ? t(`${e.week} კვირა + ${e.day} დღე`, `${plural(e.week, 'week')} + ${plural(e.day, 'day')}`) : t('მშობიარობის შემდგომი თვალყური', 'Postpartum tracking');
  }
  if (v.hideLengthChrome) return t('ციკლის ახალი ისტორია გროვდება', 'Building your new cycle history');
  if (v.day != null) return t(`ციკლის დღე ${v.day} · ${v.phaseHint}`, `Cycle day ${v.day} · ${v.phaseHint}`);
  return t('ვსწავლობთ შენს რიტმს — აღრიცხე შემდეგი მენსტრუაცია', 'Learning your rhythm — log your next period');
}

function modeNote(ic, text) {
  return h('div', { class: 'cy-mode-note' }, icon(ic, { size: 18 }), h('div', null, text));
}

function appHint(text = t('ამ რეჟიმის დეტალური ინსტრუმენტები MEDICARD აპშია.', 'The detailed tools for this mode are in the MEDICARD app.')) {
  return h('div', { class: 'cy-mode-note' }, icon('smartphone', { size: 18 }),
    h('div', null, text, ' ', h('a', { href: APP_STORE, target: '_blank', rel: 'noopener', class: 'link' }, t('ამისთვის გამოიყენე MEDICARD აპი', 'Use the MEDICARD app for this'))));
}

/* ── Onboarding (no last period yet) ─────────────────────────────────────── */
function onboardingCard(b, onBundle) {
  const today = cycleToday(b);
  const dateInput = input({ type: 'date', max: today, min: addKey(today, -180), value: '', required: true, name: 'date' });
  const err = h('div', { class: 'form-error', hidden: true });
  const save = button(t('შენახვა', 'Save'), { variant: 'rose' });
  save.addEventListener('click', () => busy(save, async () => {
    err.hidden = true;
    const date = dateInput.value;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { err.textContent = t('აირჩიე თარიღი', 'Choose a date'); err.hidden = false; return; }
    try {
      const nb = await post('/api/cycle/last-period', { date });
      if (nb?.profile && nb.predictions) onBundle(nb);
      else onBundle(await get('/api/cycle'));
    } catch (e) { err.textContent = e.message; err.hidden = false; }
  }));
  return card({ class: 'pad-lg', style: { maxWidth: '560px' } },
    h('div', { class: 'stack', style: { gap: '16px' } },
      h('span', { class: 'tile ink-rose', style: { width: '52px', height: '52px' } }, icon('flower', { size: 26 })),
      h('h2', { style: { fontSize: '22px' } }, t('როდის დაიწყო ბოლო მენსტრუაცია?', 'When did your last period start?')),
      h('p', { class: 'muted' }, t('პირველი დღე საკმარისია. შემდეგ თარიღებს შენი ჩანაწერებით დავაზუსტებთ — ეს ყოველთვის შეფასებაა და შეიძლება გადაიწიოს.', 'The first day is enough. We’ll refine the next dates with your logs — it is always an estimate and may shift.')),
      field(t('ბოლო მენსტრუაციის დასაწყისი', 'Start of your last period'), dateInput),
      err,
      h('div', { class: 'hstack' }, save),
      appHint(t('ორსულობის, მშობიარობის შემდგომი და პერიმენოპაუზის რეჟიმების ჩართვა აპის ციკლის პარამეტრებშია.', 'Pregnancy, postpartum and perimenopause modes are turned on in the app’s cycle settings.'))));
}

/* ── Mode cards ──────────────────────────────────────────────────────────── */
function pregnancyCard(b, v, onLog) {
  const p = b.pregnancy || {};
  const age = p.reviewRequired ? null : p.age;
  return card({ class: 'cy-hero' },
    age ? ring({ value: age.dayOfPregnancy, max: 280, size: 200, stroke: 16, color: 'var(--cy-luteal)', label: `${age.week}`, sub: t('კვირა · სავარაუდოდ', age.week === 1 ? 'week · estimated' : 'weeks · estimated') })
      : h('span', { class: 'tile ink-violet', style: { width: '64px', height: '64px' } }, icon('heart', { size: 30 })),
    h('div', { class: 'cy-status strong' }, age ? t(`${age.week} კვირა + ${age.day} დღე`, `${plural(age.week, 'week')} + ${plural(age.day, 'day')}`) : p.reviewRequired ? t('საცნობი თარიღი გადასახედია — კვირის შეფასება არ გამოჩნდება.', 'Your reference date needs a review — the week estimate won’t show.') : t('ორსულობის რეჟიმი', 'Pregnancy mode')),
    age?.trimester ? h('div', { class: 'cy-status' }, t(`${age.trimester} ტრიმესტრი`, `Trimester ${age.trimester}`)) : null,
    p.dueDate ? h('div', { class: 'cy-badges' }, h('span', { class: 'cy-pred' }, t(`სავარაუდო მშობიარობის თარიღი · ${fmtDate(p.dueDate, { year: true })}`, `Estimated due date · ${fmtDate(p.dueDate, { year: true })}`))) : null,
    h('div', { class: 'cy-caution' }, t('კვირა და სავარაუდო თარიღი LMP-ზე / არჩეულ თარიღზეა დაფუძნებული. ეს არ არის ულტრაბგერის დათარიღება და არ არის დიაგნოზი.', 'The week and estimated date are based on your LMP / chosen date. This is not ultrasound dating and not a diagnosis.')),
    h('div', { class: 'cy-actions' }, button(t('დღის აღრიცხვა', 'Log today'), { icon: 'plus', variant: 'rose', onClick: onLog }), appHint(t('კვირის ვიზუალი, მოვლის გეგმა და ორსულობის ჩანაწერები MEDICARD აპშია.', 'Week-by-week visuals, the care plan and pregnancy notes are in the MEDICARD app.'))));
}

function postpartumCard(b, v, onLog) {
  const e = b.postpartum?.elapsed;
  return card({ class: 'cy-hero' },
    h('span', { class: 'tile ink-violet', style: { width: '64px', height: '64px' } }, icon('heart', { size: 30 })),
    h('div', { class: 'cy-status strong' }, e ? t(`${e.week} კვირა + ${e.day} დღე`, `${plural(e.week, 'week')} + ${plural(e.day, 'day')}`) : t('საწყისი თარიღი არ არის მითითებული.', 'No start date set.')),
    e ? h('div', { class: 'cy-status' }, t('შენს მითითებულ თარიღიდან. არ არის გამოჯანმრთელების პროგრესი.', 'Since the date you set. This is not recovery progress.')) : null,
    h('div', { class: 'cy-caution' }, t('ეს თვალყურის რეჟიმია, რომელსაც შენ ირჩევ. არ არის გამოჯანმრთელების დიაგნოზი.', 'This is a tracking mode you choose. It is not a recovery diagnosis.')),
    h('div', { class: 'cy-actions' }, button(t('დღის აღრიცხვა', 'Log today'), { icon: 'plus', variant: 'rose', onClick: onLog }), appHint(t('სისხლდენის კლასიფიკაცია და საწყისი თარიღის შეცვლა MEDICARD აპშია.', 'Bleeding classification and changing the start date are in the MEDICARD app.'))));
}

function periCard(b, v = null) {
  const p = b.perimenopause;
  const note = v ? periStatusNote(b, v) : null;
  if (!p) return card(h('p', { class: 'muted' }, t('ეს თვალყურის რეჟიმია, რომელსაც შენ ირჩევ. ეს არ არის პერიმენოპაუზის ან მენოპაუზის დიაგნოზი.', 'This is a tracking mode you choose. It is not a diagnosis of perimenopause or menopause.')));
  const vs = p.variabilitySummary || {};
  const st = (label, val) => h('div', { class: 'cy-stat' }, h('div', { class: 'cy-stat-label' }, label),
    h('div', { class: 'cy-stat-value' }, h('b', null, val != null ? String(val) : '—'), val != null ? h('small', null, t('დღე', val === 1 ? 'day' : 'days')) : null));
  return card(
    note ? h('div', { class: 'cy-peri-note' }, h('b', null, note.title), h('p', null, note.body)) : null,
    h('div', { class: 'cy-stats' }, st(t('უმოკლესი ინტერვალი', 'Shortest interval'), vs.shortestDays), st(t('უგრძესი ინტერვალი', 'Longest interval'), vs.longestDays), st(t('ბოლო ინტერვალი', 'Latest interval'), vs.recentIntervalDays)),
    vs.intervalCount != null ? h('p', { class: 'faint', style: { fontSize: '12px', marginTop: '10px' } }, t(`${vs.intervalCount} აღრიცხული ინტერვალის მიხედვით`, `Based on ${plural(vs.intervalCount, 'logged interval')}`)) : null,
    p.lastRecordedBleeding ? h('p', { class: 'muted', style: { fontSize: '13.5px', marginTop: '10px' } }, t(`ბოლო აღრიცხული სისხლდენა: ${fmtDate(p.lastRecordedBleeding.date)}`, `Last logged bleeding: ${fmtDate(p.lastRecordedBleeding.date)}`)) : null,
    (p.recentBleedingEpisodes || []).length ? h('div', { class: 'list', style: { marginTop: '8px' } },
      p.recentBleedingEpisodes.slice(-4).reverse().map((ep) => row({ icon: 'droplet', ink: 'rose', title: `${fmtDate(ep.start)} – ${fmtDate(ep.end)}`, sub: ep.durationDays ? t(`${ep.durationDays} დღე`, plural(ep.durationDays, 'day')) : null }))) : null,
    h('p', { class: 'disclaimer' }, icon('info', { size: 14 }), t('ეს თვალყურის რეჟიმია, რომელსაც შენ ირჩევ. ეს არ არის პერიმენოპაუზის ან მენოპაუზის დიაგნოზი.', 'This is a tracking mode you choose. It is not a diagnosis of perimenopause or menopause.')));
}

/* ── Today / stats / history ─────────────────────────────────────────────── */
function logFacts(l, { uncertain } = {}) {
  const out = [];
  if (!l) return out;
  if (isBleed(l.flow)) out.push(h('span', { class: 'cy-fact period' }, icon('droplet', { size: 13 }), `${uncertain ? t('სისხლდენა', 'Bleeding') : t('სისხლდენა', 'Flow')}: ${LABEL[l.flow]}`));
  else if (l.flow === 'spotting') out.push(h('span', { class: 'cy-fact period' }, t('ლაქები', 'Spotting')));
  const sym = (l.symptoms || []).filter((id) => !SEX_IDS.has(id) && LABEL[id]);
  sym.slice(0, 6).forEach((id) => out.push(h('span', { class: 'cy-fact' }, LABEL[id])));
  if (sym.length > 6) out.push(h('span', { class: 'cy-fact' }, `+${sym.length - 6}`));
  (l.painEntries || []).forEach((p) => out.push(h('span', { class: 'cy-fact' }, `${PAIN_TYPES.find((x) => x.id === p.type)?.label || t('ტკივილი', 'Pain')} · ${PAIN_SEVERITY.find((x) => x.id === p.severity)?.label || ''}`)));
  (l.moods || []).slice(0, 4).forEach((id) => out.push(h('span', { class: 'cy-fact' }, LABEL[id] || id)));
  const energy = l.energy || l.observations?.energy;
  if (energy) out.push(h('span', { class: 'cy-fact' }, `${t('ენერგია', 'Energy')}: ${ENERGY.find((e) => e.id === energy)?.label || energy}`));
  if (l.sexualActivity === true || (l.symptoms || []).some((id) => SEX_ACTIVITY_IDS.has(id))) out.push(h('span', { class: 'cy-fact private' }, icon('lock', { size: 12 }), t('სექსი', 'Sex')));
  if (l.bbt != null) out.push(h('span', { class: 'cy-fact' }, `BBT ${String(l.bbt).replace('.', ',')} °C`));
  if (l.cervicalMucus) out.push(h('span', { class: 'cy-fact' }, `${t('ლორწო', 'Mucus')}: ${LABEL[l.cervicalMucus] || ''}`));
  if (l.ovulationTest) out.push(h('span', { class: 'cy-fact' }, `${t('ოვულაციის ტესტი', 'Ovulation test')}: ${TESTS.find((x) => x.id === l.ovulationTest)?.label}`));
  if (l.pregnancyTest) out.push(h('span', { class: 'cy-fact' }, `${t('ორსულობის ტესტი', 'Pregnancy test')}: ${TESTS.find((x) => x.id === l.pregnancyTest)?.label}`));
  for (const id of canonicalChecklist(l.observations?.pregnancyChecklist)) {
    out.push(h('span', { class: 'cy-fact' }, icon('check', { size: 12 }), PREGNANCY_CHECKLIST.find((o) => o.id === id)?.label));
  }
  if (l.notes) out.push(h('span', { class: 'cy-fact' }, icon('edit', { size: 12 }), t('ჩანაწერი', 'Note')));
  return out;
}

function todayCard(b, v, onLog) {
  const facts = logFacts(v.todayLog, { uncertain: v.uncertain });
  return card(
    facts.length ? h('div', { class: 'cy-facts' }, facts) : h('p', { class: 'muted' }, t('დღეს ჯერ არაფერი არ არის აღრიცხული — დაამატე სისხლდენა, სიმპტომები ან განწყობა.', 'Nothing logged today yet — add flow, symptoms or mood.')),
    h('div', { class: 'hstack', style: { marginTop: '14px' } },
      button(facts.length ? t('რედაქტირება', 'Edit') : t('დღის აღრიცხვა', 'Log today'), { size: 'sm', variant: 'ghost', icon: facts.length ? 'edit' : 'plus', onClick: onLog })));
}

/** CycleStatsCard: typical adult ranges shown as reference, never as a diagnosis (cycle 21–35, bleeding 2–7). */
function statsCard(b) {
  const avg = b.averages || {};
  const cycle = avg.usedCycleLength ?? null;
  const period = avg.usedPeriodLength ?? null;
  const lengths = (b.trends?.cycleLengths || []).map((x) => x.length).filter((n) => Number.isFinite(n)).slice(-6);
  const variation = lengths.length >= 2 ? Math.max(...lengths) - Math.min(...lengths) : null;
  const inferred = avg.source === 'inferred' && (avg.cycleCount ?? 0) >= 2;
  // „საშუალოდან დამალვა“: these numbers already leave them out; say how many, never why.
  const hiddenCount = Array.isArray(b.profile?.hiddenCycles) ? b.profile.hiddenCycles.length : 0;
  const rangeTone = (val, lo, hi) => (val == null ? 'unknown' : val < lo ? 'shorter' : val > hi ? 'longer' : 'typical');
  // Verdicts („✓ ტიპური“ …) only from 3 completed cycles; before that the numbers and „ვსწავლობთ · N/3“.
  const gate = fertilityGateOf(b);
  const verdictsReady = gate.completedCycles >= FERTILITY_MIN_CYCLES;
  const tone = (tn) => {
    if (tn === 'unknown') return h('div', { class: 'cy-tone none' }, t('საჭიროა 2+ ციკლი', 'Needs 2+ cycles'));
    if (!verdictsReady) return h('div', { class: 'cy-tone none' }, statsLearningChip(gate.completedCycles, gate.requiredCycles));
    const label = { typical: t('ტიპური', 'Typical'), longer: t('ტიპურზე გრძელი', 'Longer than typical'), shorter: t('ტიპურზე მოკლე', 'Shorter than typical'), variable: t('ცვალებადი', 'Variable') }[tn];
    return h('div', { class: `cy-tone ${tn === 'typical' ? 'ok' : 'off'}` }, h('i'), label);
  };
  const tiles = [
    { label: t('ციკლი', 'Cycle'), value: cycle, tone: rangeTone(cycle, 21, 35), hint: t('ტიპური: 21–35 დღე', 'Typical: 21–35 days') },
    { label: t('პერიოდი', 'Period'), value: period, tone: rangeTone(period, 2, 7), hint: t('ტიპური: 2–7 დღე', 'Typical: 2–7 days') },
    { label: t('რყევა', 'Variation'), value: variation, tone: variation == null ? 'unknown' : variation <= 7 ? 'typical' : 'variable', hint: t('ყველაზე გრძელ და მოკლე ციკლს შორის', 'Between your longest and shortest cycle') },
  ];
  return card(
    h('div', { class: 'cy-stats' }, tiles.map((tl) => h('div', { class: 'cy-stat' },
      h('div', { class: 'cy-stat-label' }, tl.label),
      h('div', { class: 'cy-stat-value' }, h('b', null, tl.value != null ? String(tl.value) : '—'), tl.value != null ? h('small', null, t('დღე', tl.value === 1 ? 'day' : 'days')) : null),
      tone(tl.tone),
      h('div', { class: 'cy-stat-hint' }, tl.hint)))),
    h('p', { class: 'faint', style: { fontSize: '12px', marginTop: '12px' } },
      inferred ? t(`ბოლო ${avg.cycleCount} ციკლის მიხედვით`, `Based on your last ${plural(avg.cycleCount, 'cycle')}`) : t('შენი მითითებით — 2 ციკლის შემდეგ შენი მონაცემებით დავითვლით', 'From your settings — after 2 cycles we’ll use your own data')),
    hiddenCount ? h('p', { class: 'faint', style: { fontSize: '12px', marginTop: '4px' } }, t(`${hiddenCount} ციკლი დამალულია`, `${plural(hiddenCount, 'cycle')} hidden`)) : null,
    h('p', { class: 'disclaimer', style: { marginTop: '8px' } }, icon('info', { size: 14 }), t('ტიპური დიაპაზონი საორიენტაციოა და არა დიაგნოზი. თუ რამე გაწუხებს, მიმართე ექიმს.', 'Typical ranges are for reference, not a diagnosis. If something worries you, see a doctor.')));
}

function historyCard(b, onToggleHidden = null) {
  // Hidden cycles (W3-2): drawn and listed as usual, marked, and left out of the bars above (server trends).
  const hiddenList = Array.isArray(b.profile?.hiddenCycles) ? b.profile.hiddenCycles : null;
  const starts = b.inferred?.periodStarts || (b.periodRanges || []).map((r) => r.start);
  const lengths = (b.trends?.cycleLengths?.length ? b.trends.cycleLengths.map((x) => ({ start: x.start, length: x.length }))
    : (b.analytics?.cycleLengths || []).map((x) => ({ start: x.startDate, length: x.length })))
    .filter((x) => x.start && Number.isFinite(x.length)).slice(-12);
  const ranges = (b.periodRanges || []).slice(-6).reverse();
  const avgLen = b.averages?.usedCycleLength ?? null;
  return card(
    lengths.length
      ? h('div', null,
        h('div', { class: 'between', style: { marginBottom: '8px' } },
          h('div', { class: 'card-sub' }, t('ციკლის ხანგრძლივობა (დღე)', 'Cycle length (days)')),
          h('div', { class: 'legend' }, h('span', null, h('i', { style: { background: 'var(--cy-luteal)' } }), t('ციკლი', 'Cycle')))),
        barChart({
          labels: lengths.map((x) => shortDate(x.start)),
          tipLabels: lengths.map((x) => t(`${fmtDate(x.start)}-დან`, `From ${fmtDate(x.start)}`)),
          values: lengths.map((x) => x.length),
          color: 'var(--cy-luteal)',
          unit: t('დღე', 'days'),
          goal: avgLen || undefined,
          goalLabel: avgLen ? t(`საშუალო ${avgLen}`, `Average ${avgLen}`) : undefined,
          height: 200,
          fmt: (n) => String(Math.round(n)),
        }))
      : empty(t('ისტორია ჯერ მცირეა', 'Not much history yet'), t('ციკლების ხანგრძლივობა გამოჩნდება, როცა ორ მენსტრუაციას მაინც აღრიცხავ.', 'Cycle lengths will show once you log at least two periods.')),
    h('div', { class: 'hub-section-head', style: { marginTop: '18px', marginBottom: '4px' } }, h('h2', { style: { fontSize: '15px' } }, t('მენსტრუაციის ისტორია', 'Period history'))),
    ranges.length
      ? h('div', { class: 'list cy-period-list' }, ranges.map((r) => {
        const hidden = r.hidden === true || Boolean(hiddenList?.includes(r.start));
        // Older servers send no hiddenCycles → no toggle; a new hide stays within the server's cap of 24.
        const canToggle = onToggleHidden && hiddenList && starts.includes(r.start) && (hidden || hiddenList.length < 24);
        const toggle = canToggle
          ? button(hidden ? t('დაბრუნება', 'Bring back') : t('საშუალოდან დამალვა', 'Hide from averages'), { size: 'sm', variant: 'ghost', icon: hidden ? 'eye' : 'eyeOff', class: 'cy-hide-btn' })
          : null;
        toggle?.addEventListener('click', () => onToggleHidden(r.start, !hidden, toggle));
        return row({
          icon: 'droplet', ink: 'rose',
          title: r.start === r.end ? fmtDate(r.start) : `${fmtDate(r.start)} – ${fmtDate(r.end)}`,
          sub: h('span', null, t(`${r.lengthDays} აღრიცხული დღე`, plural(r.lengthDays, 'logged day')),
            hidden ? h('span', { class: 'cy-hidden-tag' }, icon('eyeOff', { size: 12 }), t('დამალულია საშუალოდან', 'Hidden from averages')) : null),
          trailing: toggle ?? undefined,
        });
      }))
      : h('p', { class: 'muted', style: { fontSize: '13.5px' } }, t('ჯერ არ არის აღრიცხული მენსტრუაცია.', 'No periods logged yet.')));
}

/* ── Tips (CycleInsightsPanel variant="tips") ────────────────────────────── */
function tipsBlock(b, v, rerender, consent = { on: null, set: () => {} }) {
  const ai = b.profile?.aiInsights;
  // Cached AI cards only while AI consent is on; otherwise the local tips alone (W3-2, like the app).
  const aiCards = consent.on === true && ai && ai.source === 'ai' && Array.isArray(ai.cards) ? ai.cards : null;
  const local = b.localInsights?.cards || [];
  const insightCards = (aiCards || local).slice(0, 3).map((c) => ({ ...c, src: aiCards ? 'Medi' : t('შენი ჩანაწერებით', 'From your logs') }));
  const tips = v.caps.pregnancy || v.caps.postpartum || v.caps.peri ? [] : dailyTips(v.phase, v.day).map((tp) => ({ ...tp, src: t('დღის რჩევა', 'Daily tip') }));
  const all = [...insightCards, ...tips];
  const headline = (aiCards ? ai.headline : b.localInsights?.headline) || null;

  const aiAllowed = featureOn('medi') && v.mode !== 'POSTPARTUM';
  // Consent on → the refresh button as before. Not answered / declined → one quiet row; only its click may
  // open the disclosure. Still reading → neither.
  const refresh = aiAllowed && consent.on === true
    ? button(aiCards ? t('Medi-ს რჩევების განახლება', 'Refresh Medi’s tips') : t('პერსონალური რჩევა Medi-სგან', 'Personal tips from Medi'), { size: 'sm', variant: 'ghost', icon: 'sparkles' })
    : null;
  const enableRow = aiAllowed && consent.on === false
    ? h('button', { type: 'button', class: 'cy-ai-row', 'aria-label': t('Medi-ს რჩევები ჩანაწერების მიხედვით. ჩართვა', 'Medi’s tips from your logs. Turn on') },
      icon('sparkles', { size: 15 }), h('span', null, t('Medi-ს რჩევები ჩანაწერების მიხედვით', 'Medi’s tips from your logs')), h('b', null, t('ჩართვა', 'Turn on')))
    : null;
  const trigger = refresh || enableRow;
  // Declined / closed the AI disclosure: the local tips stay; a calm line with „ხელახლა ცდა“ (only after this tap).
  const declined = aiDeclinedSlot();
  trigger?.addEventListener('click', () => busy(trigger, async () => {
    declined.hide();
    try {
      // POST /api/cycle/insights only reads/computes (the app lists it in READ_ONLY_WRITES); it sends cycle
      // context to the AI provider, so it is wrapped in the voluntary AI consent.
      const res = await withAiConsent(() => post('/api/cycle/insights', { refresh: true }));
      if (res?.declined) { consent.set(false); declined.show(() => trigger.click()); return; }
      if (!res) return;
      consent.set(true);
      if (res.insights) {
        b.profile.aiInsights = res.insights;
        b.profile.aiInsightsAt = new Date().toISOString();
        rerender();
      }
    } catch (e) { toast(e.message, 'error'); }
  }));

  return h('div', { class: 'stack', style: { gap: '12px' } },
    headline || refresh ? h('div', { class: 'between' }, headline ? h('div', { class: 'muted', style: { fontWeight: 600 } }, headline) : h('span'), refresh) : null,
    trigger ? declined : null,
    all.length
      ? h('div', { class: 'cy-tips' }, all.map((c) => h('article', { class: 'cy-tip' },
        h('div', { class: 'between' }, h('span', { class: `cy-tip-tile ${c.tone}` }, icon(TIP_ICON[c.tone] || 'sparkles', { size: 18 })), h('span', { class: 'cy-src' }, c.src)),
        h('h4', null, c.title),
        h('p', null, c.body),
        c.action ? h('div', { class: 'cy-tip-act' }, c.action) : null)))
      : card(h('p', { class: 'muted' }, t('რჩევები გამოჩნდება, როცა ციკლის რამდენიმე დღეს აღრიცხავ.', 'Tips will appear once you log a few days of your cycle.'))),
    enableRow,
    h('p', { class: 'disclaimer', style: { marginTop: '4px' } }, icon('info', { size: 14 }), t('Medi-ს რჩევები ზოგადი ინფორმაციაა შენი ფაზისა და ჩანაწერების მიხედვით — არა დიაგნოზი.', 'Medi’s tips are general information based on your phase and logs — not a diagnosis.')));
}

/* ── Day modal: details + log form (CycleQuickLogSheet / CycleLogTabs) ───── */
function formFromLog(l) {
  const all = l?.symptoms || [];
  return {
    flow: l?.flow ?? null,
    symptoms: all.filter((id) => !SEX_IDS.has(id) && SYMPTOMS.some((s) => s.id === id)),
    extraSymptoms: all.filter((id) => !SEX_IDS.has(id) && !SYMPTOMS.some((s) => s.id === id)),
    sexTags: all.filter((id) => SEX_IDS.has(id)),
    moods: [...(l?.moods || [])],
    // Stored false cannot be told apart from the old default "no" → show as unanswered (cycleLogSave.ts).
    sexual: l?.sexualActivity === true || all.some((id) => SEX_ACTIVITY_IDS.has(id)) ? true : null,
    bbt: l?.bbt != null ? String(l.bbt) : '',
    mucus: l?.cervicalMucus ?? null,
    ovulationTest: l?.ovulationTest ?? null,
    pregnancyTest: l?.pregnancyTest ?? null,
    notes: l?.notes || '',
    painEntries: (l?.painEntries || []).map((p) => ({ type: p.type, severity: p.severity })),
    sleepQuality: l?.sleepQuality ?? null,
    stressLevel: l?.stressLevel ?? null,
    exerciseLevel: l?.exerciseLevel ?? null,
    caffeine: l?.caffeine ?? null,
    alcohol: l?.alcohol ?? null,
    energy: l?.energy ?? l?.observations?.energy ?? null,
    // Pregnancy checklist: the stored ticks, or null = untouched (a save then sends nothing).
    pregnancyChecklist: (() => { const ids = canonicalChecklist(l?.observations?.pregnancyChecklist); return ids.length ? ids : null; })(),
  };
}

function payloadFromForm(f) {
  const raw = f.bbt.trim().replace(',', '.');
  const bbt = raw ? Number(raw) : null;
  if (raw && (!Number.isFinite(bbt) || bbt < 34 || bbt > 42)) throw new Error(t('BBT უნდა იყოს 34–42 °C შორის.', 'BBT must be between 34 and 42 °C.'));
  return {
    flow: f.flow,
    // Activity tags only when the answer is "yes"; sex drive is its own answer and is always kept.
    symptoms: [...f.symptoms, ...f.extraSymptoms, ...f.sexTags.filter((id) => f.sexual === true || !SEX_ACTIVITY_IDS.has(id))],
    moods: f.moods,
    sexualActivity: f.sexual,
    bbt,
    cervicalMucus: f.mucus,
    ovulationTest: f.ovulationTest,
    pregnancyTest: f.pregnancyTest,
    notes: f.notes.trim() || null,
    painEntries: f.painEntries,
    sleepQuality: f.sleepQuality,
    stressLevel: f.stressLevel,
    exerciseLevel: f.exerciseLevel,
    caffeine: f.caffeine,
    alcohol: f.alcohol,
    // pregnancyChecklist: untouched (null) → not sent; all unticked → null clears; else the canonical list.
    observations: f.pregnancyChecklist == null
      ? { energy: f.energy }
      : { energy: f.energy, pregnancyChecklist: f.pregnancyChecklist.length ? canonicalChecklist(f.pregnancyChecklist) : null },
    energy: f.energy,
  };
}

function chip(label, on, onClick, opts = {}) {
  return h('button', { type: 'button', class: `chip cy-chip${on ? ' on' : ''}${opts.teal ? ' teal' : ''}`, 'aria-pressed': on ? 'true' : 'false', onClick }, on ? icon('check', { size: 13 }) : null, label);
}

function openDayModal(b, date, { only, onBundle }) {
  const v = derive(b);
  const log = (b.logs || []).find((l) => l.date === date);
  const future = date > v.today;
  const mark = buildMarks(b)[date] || {};
  const L = classifyDay(mark, { showFertility: v.fertilityVisible, showPredicted: v.showPredicted });
  const f = formFromLog(log);
  const initial = JSON.stringify(payloadFromForm(f));
  let showAllSymptoms = f.symptoms.some((id) => SYMPTOMS.findIndex((s) => s.id === id) >= SYMPTOMS_VISIBLE);

  const title = only === 'sex' ? t('სექსი და ლიბიდო', 'Sex and sex drive') : `${fmtDate(date)}${date === v.today ? t(' · დღეს', ' · Today') : ''}`;
  const infoBits = [];
  if (mark.cycleDay) infoBits.push(t(`ციკლის ${mark.cycleDay}-ე დღე`, `Cycle day ${mark.cycleDay}`));
  if (L.loggedPeriod) infoBits.push(v.uncertain || v.caps.postpartum ? t('სისხლდენა · აღრიცხული', 'Bleeding · logged') : t('მენსტრუაცია · აღრიცხული', 'Period · logged'));
  else if (L.predictedPeriod) infoBits.push(t('სავარაუდო მენსტრუაცია', 'Estimated period'));
  else if (L.ovulation) infoBits.push(t('სავარაუდო ოვულაცია', 'Estimated ovulation'));
  else if (L.fertile) infoBits.push(t('სავარაუდო ნაყოფიერი', 'Estimated fertile'));
  else if (v.showPredicted && mark.phaseKa && mark.phase && mark.phase !== 'unknown') infoBits.push(t(`სავარაუდოდ ${mark.phaseKa.toLowerCase()}`, `Likely ${mark.phaseKa.toLowerCase()}`));

  const bodyEl = h('div', { class: 'cy-log' });
  const err = h('div', { class: 'form-error', hidden: true });

  const single = (options, key, opts = {}) => h('div', { class: 'chips' }, options.map((o) => chip(o.label, f[key] === o.id, () => { f[key] = f[key] === o.id ? null : o.id; paint(); }, opts)));
  const multi = (options, key) => h('div', { class: 'chips' }, options.map((o) => chip(o.label, f[key].includes(o.id), () => {
    f[key] = f[key].includes(o.id) ? f[key].filter((x) => x !== o.id) : [...f[key], o.id];
    paint();
  })));
  const sec = (heading, sub, ...content) => h('div', { class: 'cy-log-sec' }, h('h4', null, heading), sub ? h('div', { class: 'cy-sub' }, sub) : null, content);

  const sexSection = () => {
    const activity = f.sexTags.filter((id) => SEX_ACTIVITY_IDS.has(id));
    const drive = f.sexTags.find((id) => SEX_DRIVE.some((d) => d.id === id)) || null;
    const driveTags = drive ? [drive] : [];
    return h('div', { class: 'cy-log-sec' },
      only === 'sex' ? null : h('h4', null, icon('heart', { size: 15 }), t('სექსი და ლიბიდო', 'Sex and sex drive')),
      h('div', { class: 'cy-private' }, icon('lock', { size: 12 }), t('მხოლოდ შენ ხედავ — პარტნიორსა და Medi-ს არ ეგზავნება', 'Only you can see this — never sent to a partner or Medi')),
      h('div', { class: 'cy-sub-label' }, t('სექსი', 'Sex')),
      h('div', { class: 'chips' },
        chip(t('არ მქონია', 'Didn’t have sex'), f.sexual === false, () => {
          if (f.sexual === false) f.sexual = null; else { f.sexual = false; f.sexTags = driveTags; }
          paint();
        }),
        SEX_ACTIVITY.map((o) => chip(o.label, activity.includes(o.id), () => {
          const next = activity.includes(o.id) ? activity.filter((x) => x !== o.id) : [...activity, o.id];
          f.sexual = next.length ? true : null;
          f.sexTags = [...next, ...driveTags];
          paint();
        }))),
      h('div', { class: 'cy-sub-label' }, t('ლიბიდო', 'Sex drive')),
      h('div', { class: 'chips', role: 'radiogroup' }, SEX_DRIVE.map((o) => chip(o.label, drive === o.id, () => {
        f.sexTags = [...activity, ...(drive === o.id ? [] : [o.id])];
        paint();
      }))));
  };

  const painSection = () => {
    const has = (id) => f.painEntries.find((p) => p.type === id);
    return sec(t('ტკივილი', 'Pain'), t('აღრიცხვაა, არა დიაგნოზი. თუ ტკივილი ძლიერი, უეცარი ან გაწუხებს — მიმართე ექიმს.', 'This is a log, not a diagnosis. If the pain is severe, sudden or worries you — see a doctor.'),
      h('div', { class: 'chips' }, PAIN_TYPES.map((o) => chip(o.label, Boolean(has(o.id)), () => {
        if (has(o.id)) f.painEntries = f.painEntries.filter((p) => p.type !== o.id);
        else if (f.painEntries.length < 7) f.painEntries = [...f.painEntries, { type: o.id, severity: 'moderate' }];
        paint();
      }))),
      f.painEntries.length ? h('div', { style: { marginTop: '8px' } }, f.painEntries.map((p) => h('div', { class: 'cy-pain-row' },
        h('span', { class: 'cy-life-label' }, PAIN_TYPES.find((x) => x.id === p.type)?.label),
        h('div', { class: 'chips' }, PAIN_SEVERITY.map((s) => chip(s.label, p.severity === s.id, () => { p.severity = s.id; paint(); })))))) : null);
  };

  const fertilityShown = v.caps.fertile;
  function paint() {
    const visibleSymptoms = showAllSymptoms ? SYMPTOMS : SYMPTOMS.filter((s, i) => i < SYMPTOMS_VISIBLE || f.symptoms.includes(s.id));
    const parts = [];
    if (infoBits.length && only !== 'sex') parts.push(h('div', { class: 'cy-mode-note' }, icon('calendar', { size: 18 }), h('div', null, infoBits.join(' · '), L.predictedPeriod || L.fertile || L.ovulation ? h('div', { class: 'faint', style: { fontSize: '12px', marginTop: '2px' } }, t('შეფასება ბოლო ციკლების მიხედვით — არა დადგენილი თარიღი.', 'Estimated from your recent cycles — not a confirmed date.')) : null)));
    if (future) {
      parts.push(h('p', { class: 'muted' }, t('მომავალ დღეს ვერ აღრიცხავ. ამ დღის ინფორმაცია სავარაუდოა და შეიძლება შეიცვალოს.', 'You can’t log a future day. What’s shown for this day is an estimate and may change.')));
      mount(bodyEl, parts);
      return;
    }
    if (only === 'sex') {
      parts.push(sexSection());
    } else {
      if (v.caps.pregnancy) {
        // Pregnancy daily checklist (mobile CyclePregnancyQuickLog „დღის ჩეკლისტი“), saved in the day's observations.
        const ticked = f.pregnancyChecklist || [];
        parts.push(sec(t('დღის ჩეკლისტი', 'Checklist for the day'), t('რამდენიც გინდა', 'tick any'),
          h('div', { class: 'chips' }, PREGNANCY_CHECKLIST.map((o) => chip(o.label, ticked.includes(o.id), () => {
            f.pregnancyChecklist = canonicalChecklist(ticked.includes(o.id) ? ticked.filter((x) => x !== o.id) : [...ticked, o.id]);
            paint();
          })))));
      }
      parts.push(sec(v.uncertain || v.caps.postpartum ? t('სისხლდენა', 'Bleeding') : t('სისხლდენა', 'Flow'), t('აირჩიე ერთი ვარიანტი', 'Choose one'), single(FLOWS, 'flow')));
      parts.push(sexSection());
      parts.push(sec(t('სიმპტომები', 'Symptoms'), t('შეგიძლია რამდენიმე მონიშნო', 'You can pick several'), multi(visibleSymptoms, 'symptoms'),
        h('button', { type: 'button', class: 'link', style: { marginTop: '10px', background: 'none', border: 0, padding: 0, cursor: 'pointer', font: 'inherit', fontSize: '13px' }, onClick: () => { showAllSymptoms = !showAllSymptoms; paint(); } },
          showAllSymptoms ? t('ნაკლების ჩვენება', 'Show less') : t(`ყველა სიმპტომი (${SYMPTOMS.length})`, `All symptoms (${SYMPTOMS.length})`))));
      parts.push(sec(t('განწყობა', 'Mood'), t('როგორ გრძნობ თავს დღეს?', 'How do you feel today?'), multi(MOODS, 'moods')));
      parts.push(sec(t('ენერგია', 'Energy'), t('დღის საერთო დონე. დაღლილობა ცალკე სიმპტომია.', 'Your overall level today. Fatigue is a separate symptom.'), single(ENERGY, 'energy')));
      parts.push(painSection());
      parts.push(sec(t('ცხოვრების წესი', 'Lifestyle'), t('სუბიექტური აღრიცხვა.', 'How it felt to you.'), h('div', { class: 'cy-life' },
        LIFESTYLE.map((g) => [h('div', { class: 'cy-life-label' }, g.label), single(g.options, g.key)]))));
      if (fertilityShown) {
        const bbt = input({ type: 'text', inputmode: 'decimal', placeholder: t('მაგ. 36,6', 'e.g. 36.6'), value: f.bbt, style: { maxWidth: '160px' }, onInput: (e) => { f.bbt = e.target.value; } });
        parts.push(sec(t('ნაყოფიერების ჩანაწერები', 'Fertility logs'), t('ეს შენი დაკვირვებაა. Medicard ნაყოფიერებას ან ორსულობას არ ადასტურებს.', 'These are your own observations. Medicard does not confirm fertility or pregnancy.'),
          field(t('ბაზალური ტემპერატურა (°C)', 'Basal body temperature (°C)'), bbt),
          h('div', { class: 'cy-sub-label' }, t('ცერვიკალური ლორწო', 'Cervical mucus')), single(MUCUS, 'mucus', { teal: true }),
          h('div', { class: 'cy-sub-label' }, t('ოვულაციის ტესტი', 'Ovulation test')), single(TESTS, 'ovulationTest', { teal: true }),
          h('div', { class: 'cy-sub-label' }, t('ორსულობის ტესტი', 'Pregnancy test')), single(TESTS, 'pregnancyTest', { teal: true })));
      }
      const notes = h('textarea', { class: 'input textarea', maxlength: 2000, placeholder: t('როგორ გაიარა დღემ…', 'How did your day go…'), onInput: (e) => { f.notes = e.target.value; } });
      notes.value = f.notes;
      parts.push(sec(t('ჩანაწერი', 'Note'), t('არასავალდებულო. დღიური რჩება ამ ანგარიშზე და პარტნიორს არ ეგზავნება.', 'Optional. Your diary stays on this account and is never sent to a partner.'), notes));
    }
    parts.push(err);
    const scroll = bodyEl.closest('.modal-body')?.scrollTop;
    mount(bodyEl, parts);
    const mb = bodyEl.closest('.modal-body');
    if (mb && scroll != null) mb.scrollTop = scroll;
  }
  paint();

  const m = openModal({
    title,
    size: only === 'sex' ? 'md' : 'lg',
    body: bodyEl,
    footer: (close) => {
      if (future) return [button(t('დახურვა', 'Close'), { variant: 'ghost', onClick: () => close() })];
      const save = button(t('შენახვა', 'Save'), { variant: 'rose' });
      save.addEventListener('click', () => busy(save, async () => {
        err.hidden = true;
        try {
          const payload = payloadFromForm(f);
          if (JSON.stringify(payload) === initial) { close(); return; }
          const res = await put(`/api/cycle/logs/${date}`, only === 'sex' ? { sexualActivity: payload.sexualActivity, symptoms: payload.symptoms } : payload);
          onBundle(res.bundle);
          close();
          toast(t('შენახულია', 'Saved'));
        } catch (e) { err.textContent = e.message || t('ვერ შეინახა.', 'Couldn’t save.'); err.hidden = false; }
      }));
      const out = [];
      if (log && only !== 'sex') {
        const rm = button(t('დღის წაშლა', 'Delete day'), { variant: 'ghost', icon: 'trash' });
        rm.style.marginRight = 'auto';
        rm.addEventListener('click', async () => {
          const ok = await confirmDialog({ title: t('ჩანაწერის წაშლა', 'Delete log'), body: t(`${fmtDate(date)}-ის ყველა ჩანაწერი წაიშლება.`, `Everything logged for ${fmtDate(date)} will be deleted.`), confirm: t('წაშლა', 'Delete'), danger: true });
          if (!ok) return;
          try { onBundle(await del(`/api/cycle/logs/${date}`)); close(); toast(t('ჩანაწერი წაიშალა', 'Log deleted')); } catch (e) { toast(e.message, 'error'); }
        });
        out.push(rm);
      }
      out.push(button(t('გაუქმება', 'Cancel'), { variant: 'ghost', onClick: () => close() }), save);
      return out;
    },
  });
  m.el.classList.add('cy');
  return m;
}

/* ── Settings (defaults only; reminders, sharing, contraception and other modes stay in the app) ─ */
function openSettingsModal(b, onBundle) {
  const p = b.profile || {};
  const mode = p.mode || 'TRACK_PERIOD';
  const canSwitch = mode === 'TRACK_PERIOD' || mode === 'TRY_TO_CONCEIVE';
  const range = (a, z) => Array.from({ length: z - a + 1 }, (_, i) => ({ value: a + i, label: t(`${a + i} დღე`, `${a + i} days`) }));
  const conds = (p.conditions || []).map(String);
  const check = (name, label, checked) => h('label', { class: 'hstack', style: { gap: '10px', cursor: 'pointer', fontSize: '14px' } },
    h('input', { type: 'checkbox', name, checked }), label);

  // „მენსტრუაცია და ნაყოფიერი დღეები“ (mobile cycle settings, brief §9 wave 2 item 17): live while the form changes.
  const live = { mode, expects: p.expectsBleeding !== false, display: p.fertilityDisplay === 'off' ? 'off' : 'auto' };
  const fd = b.contraception?.presentation?.fertilityDisplay;
  const contraceptionHides = fd && fd.forcedBy !== undefined ? fd.forcedBy === 'contraception' : b.contraception?.presentation?.showFertileWindow === false;
  /** Same order as the server's resolveFertilityDisplay: contraception → Tracking → TTC → her choice. */
  const resolveDisplay = () => {
    if (contraceptionHides) return { effective: 'off', forcedBy: 'contraception', userCanChange: false };
    if (live.mode === 'TRACK_PERIOD' && !live.expects) return { effective: 'off', forcedBy: 'tracking', userCanChange: false };
    if (live.mode === 'TRY_TO_CONCEIVE') return { effective: 'on', forcedBy: 'ttc', userCanChange: false };
    return { effective: live.display === 'off' ? 'off' : 'on', forcedBy: null, userCanChange: true };
  };
  const switchRow = ({ name, label, hint, checked, disabled, onChange }) => h('label', { class: `cy-check${disabled ? ' disabled' : ''}` },
    h('input', { type: 'checkbox', name, checked, disabled, onChange }),
    h('span', { class: 'cy-check-text' }, h('span', { class: 'cy-check-label' }, label), hint ? h('span', { class: 'field-hint' }, hint) : null));
  const trackBox = h('div', { class: 'stack', style: { gap: '12px' } });
  const paintTrack = () => {
    const showSection = live.mode === 'TRACK_PERIOD' || live.mode === 'TRY_TO_CONCEIVE';
    trackBox.hidden = !showSection;
    if (!showSection) { mount(trackBox, []); return; }
    const display = resolveDisplay();
    mount(trackBox, [
      h('div', { class: 'field-label' }, trackingSettingsCopy.section()),
      live.mode === 'TRACK_PERIOD' ? switchRow({
        name: 'expectsNone', label: trackingSettingsCopy.expectsLabel(), hint: trackingSettingsCopy.expectsHint(), checked: !live.expects,
        onChange: (e) => { live.expects = !e.target.checked; paintTrack(); },
      }) : null,
      switchRow({
        name: 'fertilityShow', label: trackingSettingsCopy.fertilityLabel(),
        hint: trackingSettingsCopy.forced(display.forcedBy) ?? (display.effective === 'on' ? trackingSettingsCopy.fertilityHintOn() : trackingSettingsCopy.fertilityHintOff()),
        checked: display.effective === 'on', disabled: !display.userCanChange,
        onChange: (e) => { live.display = e.target.checked ? 'auto' : 'off'; paintTrack(); },
      }),
    ]);
  };
  paintTrack();

  const m = formModal({
    title: t('ციკლის პარამეტრები', 'Cycle settings'),
    size: 'md',
    fields: () => h('div', { class: 'stack', style: { gap: '16px' } },
      canSwitch ? field(t('რეჟიმი', 'Mode'), select([
        { value: 'TRACK_PERIOD', label: MODE_LABEL.TRACK_PERIOD },
        { value: 'TRY_TO_CONCEIVE', label: MODE_LABEL.TRY_TO_CONCEIVE },
      ], mode, { name: 'mode', onChange: (e) => { live.mode = e.target.value; paintTrack(); } }), mode === 'TRY_TO_CONCEIVE' ? t('სავარაუდო ნაყოფიერი დღეები კალენდარული შეფასებაა. აპი ორსულობას არ ჰპირდება.', 'Estimated fertile days are a calendar estimate. The app makes no promise about pregnancy.') : null)
        : field(t('რეჟიმი', 'Mode'), input({ value: MODE_LABEL[mode] || mode, disabled: true }), t('ამ რეჟიმის შეცვლა MEDICARD აპშია.', 'You can change this mode in the MEDICARD app.')),
      h('div', { class: 'grid grid-2' },
        field(t('საშუალო ციკლი', 'Average cycle'), select(range(21, 45), p.avgCycleLength || 28, { name: 'avgCycleLength' })),
        field(t('საშუალო მენსტრუაცია', 'Average period'), select(range(2, 10), p.avgPeriodLength || 5, { name: 'avgPeriodLength' }))),
      h('p', { class: 'faint', style: { fontSize: '12.5px' } }, t('გამოიყენება მხოლოდ საწყისად — შემდეგ შენი ჩანაწერებით ზუსტდება.', 'Used only as a starting point — your logs refine it over time.')),
      trackBox,
      check('isIrregular', t('არარეგულარული ციკლი', 'Irregular cycle'), Boolean(p.isIrregular)),
      h('div', { class: 'stack', style: { gap: '8px' } },
        h('div', { class: 'field-label' }, t('ჯანმრთელობა (სურვილისამებრ)', 'Health (optional)')),
        check('cond_pcos', 'PCOS', conds.includes('pcos')),
        check('cond_endometriosis', t('ენდომეტრიოზი', 'Endometriosis'), conds.includes('endometriosis'))),
      appHint(t('შეხსენებები, პარტნიორის გაზიარება, კონტრაცეფცია და ორსულობის / მშობიარობის შემდგომი / პერიმენოპაუზის რეჟიმები MEDICARD აპის ციკლის პარამეტრებშია.', 'Reminders, partner sharing, contraception and the pregnancy / postpartum / perimenopause modes are in the MEDICARD app’s cycle settings.'))),
    onSubmit: async (vals, close) => {
      const conditions = [...conds.filter((c) => c !== 'pcos' && c !== 'endometriosis')];
      if (vals.cond_pcos) conditions.push('pcos');
      if (vals.cond_endometriosis) conditions.push('endometriosis');
      const body = {
        avgCycleLength: Number(vals.avgCycleLength),
        avgPeriodLength: Number(vals.avgPeriodLength),
        isIrregular: Boolean(vals.isIrregular),
        conditions,
      };
      if (canSwitch && vals.mode && vals.mode !== mode) body.mode = vals.mode;
      // The same PUT the app uses. A forced fertile-days display (TTC, Tracking, contraception) is not her choice, so it is not written.
      if ((body.mode || mode) === 'TRACK_PERIOD') body.expectsBleeding = !vals.expectsNone;
      if ((body.mode || mode) === 'TRACK_PERIOD' || (body.mode || mode) === 'TRY_TO_CONCEIVE') {
        if (resolveDisplay().userCanChange) body.fertilityDisplay = vals.fertilityShow ? 'auto' : 'off';
      }
      const nb = await put('/api/cycle/profile', body);
      if (nb?.profile && nb.predictions) onBundle(nb);
      else onBundle(await get('/api/cycle'));
      close();
      toast(t('პარამეტრები შენახულია', 'Settings saved'));
    },
  });
  m.el.classList.add('cy');
}

/* ── Home card ───────────────────────────────────────────────────────────── */
/** Compact status for Home („ციკლი“ title sits above it). Loads its own data and never throws. */
export function homeCard() {
  try {
    ensureCss();
    const box = card({ class: 'cy' }, skeleton(3));
    const fill = async () => {
      try {
        const b = await get('/api/cycle');
        mount(box, homeContent(b));
      } catch (e) {
        mount(box, errorBox(e, () => { mount(box, skeleton(3)); fill(); }));
      }
    };
    fill();
    return box;
  } catch (e) {
    return card(errorBox(e));
  }
}

function homeContent(b) {
  const v = derive(b);
  const open = button(t('გახსნა', 'Open'), { href: '/cycle', size: 'sm', variant: 'ghost', icon: 'arrowRight' });
  if (v.needsOnboarding) {
    return h('div', { class: 'cy-home' },
      h('span', { class: 'tile ink-rose', style: { width: '52px', height: '52px' } }, icon('flower', { size: 24 })),
      h('div', { class: 'cy-home-main' },
        h('h3', null, t('მონიშნე ბოლო მენსტრუაცია', 'Mark your last period')),
        h('p', null, t('პროგნოზები და ფაზები გამოჩნდება — ყოველთვის როგორც შეფასება.', 'Predictions and phases will appear — always as estimates.')),
        h('div', null, button(t('დაწყება', 'Start'), { href: '/cycle', size: 'sm', variant: 'rose' }))));
  }
  if (v.caps.pregnancy || v.caps.postpartum) {
    const age = v.caps.pregnancy && !b.pregnancy?.reviewRequired ? b.pregnancy?.age : null;
    const e = v.caps.postpartum ? b.postpartum?.elapsed : null;
    return h('div', { class: 'cy-home' },
      age ? ring({ value: age.dayOfPregnancy, max: 280, size: 96, stroke: 10, color: 'var(--cy-luteal)', label: `${age.week}`, sub: t('კვირა', age.week === 1 ? 'week' : 'weeks') })
        : h('span', { class: 'tile ink-violet', style: { width: '52px', height: '52px' } }, icon('heart', { size: 24 })),
      h('div', { class: 'cy-home-main' },
        h('h3', null, v.caps.pregnancy ? t('ორსულობის რეჟიმი', 'Pregnancy mode') : t('მშობიარობის შემდგომი თვალყური', 'Postpartum tracking')),
        h('p', null, age ? `${t(`${age.week} კვირა + ${age.day} დღე`, `${plural(age.week, 'week')} + ${plural(age.day, 'day')}`)}${t(' · სავარაუდოდ', ' · estimated')}` : e ? t(`${e.week} კვირა + ${e.day} დღე`, `${plural(e.week, 'week')} + ${plural(e.day, 'day')}`) : t('დღის აღრიცხვა ერთ ადგილას.', 'Your daily log in one place.')),
        h('div', null, open)));
  }
  if (v.tracking) {
    const [, mm, dd] = v.today.split('-').map(Number);
    const tr = trackingRingDays(v.today, b.logs);
    return h('div', { class: 'cy-home' },
      trackingDial(tr, { top: t('დღეს', 'Today'), value: String(dd), bottom: KA_MONTHS[mm - 1], label: `${trackingCopy.title()}. ${trackingCopy.ringA11y(tr.bleed.length, tr.logged.length + tr.spotting.length)}` }, { compact: true }),
      h('div', { class: 'cy-home-main' },
        h('h3', null, trackingCopy.title()),
        h('p', null, `${trackingCopy.howAreYou()} ${trackingCopy.detail()}`),
        h('div', { style: { marginTop: '4px' } }, open)));
  }
  const cycleLenRound = Math.round(v.cycleLen) || 28;
  const line = v.statusLine || (v.day != null && !v.hideLengthChrome ? t(`ციკლის ${v.day}-ე დღე · ${cycleLenRound}-დან`, `Cycle day ${v.day} · of ${cycleLenRound}`) : t('ვსწავლობთ შენს რიტმს — აღრიცხე შემდეგი მენსტრუაცია', 'Learning your rhythm — log your next period'));
  return h('div', { class: 'cy-home' },
    dialFor(b, v, { compact: true, describeDay: null }),
    h('div', { class: 'cy-home-main' },
      h('h3', null, v.phaseHint),
      h('p', null, line),
      nextBadge(v) ? h('div', null, nextBadge(v)) : null,
      h('div', { style: { marginTop: '4px' } }, open)));
}
