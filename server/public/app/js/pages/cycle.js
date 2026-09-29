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
import { withAiConsent } from '../aiConsent.js';
import { featureOn, isFemale } from '../session.js';

const CSS_HREF = '/app/css/cycle.css';
const APP_STORE = 'https://apps.apple.com/app/id6812517519';
const NS = 'http://www.w3.org/2000/svg';

function ensureCss() {
  if (!document.querySelector(`link[href="${CSS_HREF}"]`)) document.head.append(h('link', { rel: 'stylesheet', href: CSS_HREF }));
}

/* ── Catalogs (mobile/src/constants/cycle.ts, i18n ka.cycle) ─────────────────── */
const FLOWS = [
  { id: 'none', label: 'არა' }, { id: 'spotting', label: 'ლაქები' }, { id: 'light', label: 'მსუბუქი' },
  { id: 'medium', label: 'ზომიერი' }, { id: 'heavy', label: 'ძლიერი' },
];
const SYMPTOMS = [
  ['cramps', 'კრუნჩხვები'], ['headache', 'თავის ტკივილი'], ['bloating', 'შებერილობა'], ['fatigue', 'დაღლილობა'],
  ['back_pain', 'წელის ტკივილი'], ['breast_tenderness', 'მკერდის მგრძნობელობა'], ['acne', 'აკნე'], ['nausea', 'გულისრევა'],
  ['cravings', 'საკვების ლტოლვა'], ['insomnia', 'უძილობა'], ['migraine', 'მიგრენი'], ['dizziness', 'თავბრუსხვევა'],
  ['pelvic_pain', 'მენჯის ტკივილი'], ['ovulation_pain', 'ოვულაციის ტკივილი'],
  ['breast_swelling', 'მკერდის შეშუპება'], ['vomiting', 'ღებინება'], ['heartburn', 'გულძმარვა'], ['oversleep', 'ძილიანობა'],
  ['appetite_up', 'მადის მატება'], ['appetite_down', 'მადის კლება'], ['hot_flashes', 'ცხელი ტალღები'], ['night_sweats', 'ღამის ოფლიანობა'],
  ['chills', 'შეცივება'], ['sweating', 'ოფლიანობა'], ['constipation', 'ყაბზობა'], ['diarrhea', 'დიარეა'], ['gas', 'გაზები'],
  ['joint_pain', 'სახსრების ტკივილი'], ['muscle_pain', 'კუნთების ტკივილი'], ['leg_cramps', 'ფეხის კრუნჩხვები'], ['swelling', 'შეშუპება'],
  ['water_retention', 'წყლის შეკავება'], ['dry_skin', 'მშრალი კანი'], ['oily_skin', 'ცხიმიანი კანი'], ['itchy_skin', 'ქავილი'],
  ['hair_loss', 'თმის ცვენა'], ['sensitive_smell', 'სუნის მგრძნობელობა'], ['tinnitus', 'ყურებში ხმაური'], ['palpitations', 'გულისცემა'],
  ['short_breath', 'სუნთქვის სიმძიმე'], ['frequent_urination', 'ხშირი შარდვა'], ['uti_feel', 'შარდის დისკომფორტი'],
  ['vaginal_dryness', 'საშოს სიმშრალე'], ['discharge', 'გამონადენი'], ['itching_vulva', 'ქავილი (გენიტალური)'], ['fever', 'ცხელება'],
  ['cold_symptoms', 'გაციების სიმპტომები'],
].map(([id, label]) => ({ id, label }));
const SYMPTOMS_VISIBLE = 14;
const MOODS = [
  ['energetic', 'ენერგიული'], ['calm', 'მშვიდი'], ['happy', 'ბედნიერი'], ['confident', 'თავდაჯერებული'], ['sensitive', 'მგრძნობიარე'],
  ['anxious', 'შფოთვა'], ['irritable', 'გაღიზიანება'], ['angry', 'გაბრაზებული'], ['sad', 'სევდიანი'], ['tearful', 'ცრემლიანი'],
  ['mood_swings', 'განწყობის ცვლა'], ['focused', 'კონცენტრირებული'], ['unfocused', 'გაფანტული'], ['tired_mood', 'დაღლილი'],
  ['apathetic', 'აპათიური'], ['stressed', 'სტრესი'], ['romantic', 'რომანტიკული'], ['lonely', 'მარტოობა'],
].map(([id, label]) => ({ id, label }));
/** Flo's "Sex and sex drive". Any activity chip = yes; „არ მქონია“ = no; nothing = not answered. */
const SEX_ACTIVITY = [
  ['protected', 'დაცული სექსი'], ['unprotected', 'დაუცველი სექსი'], ['oral_sex', 'ორალური'], ['anal_sex', 'ანალური'],
  ['sensual_touch', 'სენსუალური შეხება'], ['masturbation', 'მასტურბაცია'], ['sex_toys', 'სათამაშოები'], ['orgasm', 'ორგაზმი'],
  ['pain_sex', 'ტკივილი სექსისას'],
].map(([id, label]) => ({ id, label }));
const SEX_DRIVE = [{ id: 'high_drive', label: 'მაღალი' }, { id: 'neutral_drive', label: 'ჩვეულებრივი' }, { id: 'low_drive', label: 'დაბალი' }];
const SEX_ACTIVITY_IDS = new Set(SEX_ACTIVITY.map((o) => o.id));
const SEX_IDS = new Set([...SEX_ACTIVITY, ...SEX_DRIVE].map((o) => o.id));
const MUCUS = [
  { id: 'dry', label: 'მშრალი' }, { id: 'sticky', label: 'წებოვანი' }, { id: 'creamy', label: 'კრემისებრი' },
  { id: 'watery', label: 'წყლიანი' }, { id: 'eggwhite', label: 'კვერცხის ცილისებრი' },
];
const TESTS = [{ id: 'negative', label: 'უარყოფითი' }, { id: 'positive', label: 'დადებითი' }, { id: 'unclear', label: 'გაურკვეველი' }];
const PAIN_TYPES = [
  { id: 'cramps', label: 'კრუნჩხვები' }, { id: 'pelvic', label: 'მენჯის ტკივილი' }, { id: 'lower_back', label: 'წელის ტკივილი' },
  { id: 'headache', label: 'თავის ტკივილი' }, { id: 'breast', label: 'მკერდის ტკივილი' }, { id: 'ovulation_side', label: 'ცალმხრივი ტკივილი' },
  { id: 'other', label: 'სხვა' },
];
const PAIN_SEVERITY = [{ id: 'mild', label: 'მსუბუქი' }, { id: 'moderate', label: 'ზომიერი' }, { id: 'severe', label: 'ძლიერი' }];
const LIFESTYLE = [
  { key: 'sleepQuality', label: 'ძილი', options: [['poor', 'ცუდი'], ['okay', 'საშუალო'], ['good', 'კარგი']] },
  { key: 'stressLevel', label: 'სტრესი', options: [['low', 'დაბალი'], ['medium', 'საშუალო'], ['high', 'მაღალი']] },
  { key: 'exerciseLevel', label: 'აქტივობა', options: [['none', 'არა'], ['light', 'მსუბუქი'], ['moderate', 'ზომიერი'], ['intense', 'ინტენსიური']] },
  { key: 'caffeine', label: 'კოფეინი', options: [['none', 'არა'], ['low', 'ცოტა'], ['moderate', 'საშუალო'], ['high', 'ბევრი']] },
  { key: 'alcohol', label: 'ალკოჰოლი', options: [['none', 'არა'], ['light', 'ცოტა'], ['moderate', 'საშუალო'], ['heavy', 'ბევრი']] },
].map((g) => ({ ...g, options: g.options.map(([id, label]) => ({ id, label })) }));
const ENERGY = [
  { id: 'very_low', label: 'ძალიან დაბალი' }, { id: 'low', label: 'დაბალი' }, { id: 'normal', label: 'ჩვეულებრივი' },
  { id: 'high', label: 'მაღალი' }, { id: 'very_high', label: 'ძალიან მაღალი' },
];
const WEEKDAYS = ['ორშ', 'სამ', 'ოთხ', 'ხუთ', 'პარ', 'შაბ', 'კვი'];
const MODE_LABEL = {
  TRACK_PERIOD: 'ციკლის თვალყური', TRY_TO_CONCEIVE: 'ორსულობის მცდელობა', PREGNANCY: 'ორსულობის რეჟიმი',
  PERIMENOPAUSE: 'პერიმენოპაუზის თვალყური', POSTPARTUM: 'მშობიარობის შემდეგ',
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
    ['care', 'სითბო ამშვიდებს', 'თბილი საფენი მუცელზე ან თბილი შხაპი კრუნჩხვისას ბევრს ეხმარება.'],
    ['care', 'რკინით მდიდარი საკვები', 'ლობიო, ისპანახი, წითელი ხორცი ან თხილი რკინის მარაგის შენარჩუნებაში გეხმარება.'],
    ['energy', 'მსუბუქი მოძრაობა', 'ნელი სეირნობა ან გაწელვა ზოგს ტკივილს უმსუბუქებს — მოუსმინე სხეულს.'],
    ['calm', 'წყალი და თბილი ჩაი', 'საკმარისი სითხე შებერილობას ამცირებს, თბილი ჩაი კი სიმშვიდეს გმატებს.'],
    ['calm', 'დასვენება ნორმალურია', 'ენერგია დაბალია? დღეს ადრე დაძინება კარგი არჩევანია.'],
  ],
  follicular: [
    ['energy', 'ენერგიის დღეები', 'ენერგია ხშირად იზრდება — კარგი დროა აქტიური ვარჯიშისთვის ან ახალი გეგმისთვის.'],
    ['care', 'ცილა და ბოსტნეული', 'ცილა, ბოსტნეული და მთლიანი მარცვლეული ენერგიას დღის განმავლობაში სტაბილურად ინარჩუნებს.'],
    ['mood', 'ფოკუსის დრო', 'ამ დღეებში კონცენტრაცია ხშირად უფრო ადვილია — რთული საქმეები ახლა დაგეგმე.'],
    ['energy', 'სცადე რამე ახალი', 'ახალი ვარჯიში, რეცეპტი ან ჰობი — ბევრი ქალი ამ ფაზაში უფრო ცნობისმოყვარედ გრძნობს თავს.'],
    ['calm', 'ძილის რიტმი', 'ერთსა და იმავე დროს დაძინება მთელი ციკლის განმავლობაში ენერგიას აწონასწორებს.'],
  ],
  fertile: [
    ['energy', 'აქტიური დღეები', 'ბევრი ქალი ამ დღეებში ყველაზე ენერგიულად და თავდაჯერებულად გრძნობს თავს.'],
    ['calm', 'საკმარისი წყალი', 'დღეში 6–8 ჭიქა სითხე ენერგიასა და კონცენტრაციას ეხმარება.'],
    ['care', 'სხეულის ნიშნები', 'გამონადენის ცვლილებები ამ დღეებში ჩვეულებრივია — შეგიძლია აღრიცხო და პატერნს დაინახავ.'],
    ['mood', 'სოციალური დღეები', 'ურთიერთობები ახლა ხშირად უფრო მარტივია — კარგი დროა შეხვედრებისთვის.'],
  ],
  luteal: [
    ['care', 'მაგნიუმით მდიდარი საკვები', 'მწვანე ფოთლოვანი, თხილეული და მუქი შოკოლადი მაგნიუმს შეიცავს — ზოგს PMS-ის შემსუბუქებაში ეხმარება.'],
    ['calm', 'ძილი უფრო მნიშვნელოვანია', 'ამ ფაზაში ძილი შეიძლება გაუარესდეს — ეკრანები დაძინებამდე ერთი საათით ადრე გამორთე.'],
    ['care', 'ნაკლები მარილი და კოფეინი', 'შებერილობისა და მკერდის მგრძნობელობისას მარილისა და კოფეინის შემცირება ზოგს ეხმარება.'],
    ['energy', 'ნაზი მოძრაობა', 'იოგა, პილატესი ან სეირნობა განწყობასაც აუმჯობესებს და შებერილობასაც ამცირებს.'],
    ['mood', 'იყავი შენთვის კეთილი', 'განწყობის რყევა ამ დღეებში ხშირია — დაგეგმე პატარა სასიამოვნო რამ საკუთარი თავისთვის.'],
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

function logHasFacts(l) {
  if (!l) return false;
  return Boolean(
    (l.symptoms && l.symptoms.length) || (l.moods && l.moods.length) || l.notes || (l.painEntries && l.painEntries.length)
    || l.sexualActivity === true || l.bbt != null || l.cervicalMucus || l.ovulationTest || l.pregnancyTest
    || l.sleepQuality || l.stressLevel || l.exerciseLevel || l.caffeine || l.alcohol || l.energy || l.observations?.energy,
  );
}

/* ── Derived presentation (CycleHero + cycleHonesty + cycleContraception) ─── */
function displayPhaseLabel(phase, phaseKa, loggedPeriod) {
  if (!phase || phase === 'unknown') return phaseKa || 'უცნობი ფაზა';
  if (phase === 'period') return loggedPeriod ? 'მენსტრუაცია' : 'სავარაუდო მენსტრუაცია';
  return `სავარაუდო ${phaseKa}`;
}

function confidenceCopy(b) {
  const confidence = b.predictions?.confidence;
  const conditions = (b.profile?.conditions || []).map(String);
  if (b.profile?.isIrregular) return 'შენი ციკლები იცვლება, ამიტომ თარიღი შეიძლება გადაიწიოს';
  if (confidence !== 'high' && confidence !== 'medium') return 'ჯერ ვსწავლობთ შენს რიტმს';
  if (conditions.includes('pcos')) return 'ჯერ ვსწავლობთ შენს რიტმს';
  if (confidence === 'medium') return 'რამდენიმე ციკლის მიხედვით · თარიღი შეიძლება გადაიწიოს';
  return 'ბოლო ციკლების მიხედვით';
}

function derive(b) {
  const today = cycleToday(b);
  const mode = b.profile?.mode || 'TRACK_PERIOD';
  const caps = CAPS[mode] || CAPS.TRACK_PERIOD;
  const todayLog = (b.logs || []).find((l) => l.date === today);
  const onPeriod = isBleed(todayLog?.flow);
  const uncertain = b.contraception?.bleedingLabel === 'bleeding';
  const pres = b.contraception?.presentation;
  const fertilityVisible = caps.fertile && (!pres || (pres.showFertilityMarkers !== false && pres.showFertileWindow !== false));
  const forecastAllowed = !b.forecastEligibility || b.forecastEligibility.allowed === true;
  const hideLengthChrome = !forecastAllowed;
  const hidePredicted = !forecastAllowed;
  const cycleLen = b.averages?.usedCycleLength ?? b.profile?.avgCycleLength ?? 28;
  const periodLen = b.averages?.usedPeriodLength ?? b.profile?.avgPeriodLength ?? 5;
  const day = b.cycleDay ?? null;
  const phase = b.phase || 'unknown';
  const phaseKa = b.phaseKa || 'უცნობი ფაზა';
  // Perimenopause: a precise next date only when the server says the recent history supports it.
  const next = caps.peri && b.perimenopause?.forecast?.showPreciseNextPeriod === false ? null : b.predictions?.nextPeriodStart || null;
  const cal = b.predictions?.calendar || {};
  const predictedToday = Boolean(cal[today]?.period && cal[today]?.predicted);
  const forecastOn = Boolean(next) && caps.forecast && !hidePredicted;
  const inDays = next ? daysBetween(today, next) : null;
  const conditions = (b.profile?.conditions || []).map(String);
  const needsOnboarding = !['PREGNANCY', 'POSTPARTUM', 'PERIMENOPAUSE'].includes(mode) && !b.profile?.lastPeriodStart;

  const phaseHint = hideLengthChrome ? 'ციკლის ახალი ისტორია გროვდება' : displayPhaseLabel(phase, phaseKa, onPeriod);

  let statusLine = null;
  if (onPeriod) statusLine = uncertain ? 'დღეს აღრიცხული სისხლდენა' : 'ახლა აღრიცხული მენსტრუაციაა';
  else if (caps.pregnancy) {
    const age = b.pregnancy?.age;
    statusLine = b.pregnancy?.reviewRequired ? 'საცნობი თარიღი გადასახედია — კვირის შეფასება არ გამოჩნდება.'
      : age ? `${age.week} კვირა + ${age.day} დღე` : 'ორსულობის რეჟიმი';
  } else if (!hidePredicted) {
    if (predictedToday) statusLine = 'დღეს სავარაუდო მენსტრუაციის დღეა — მენსტრუაცია ჯერ არ არის აღრიცხული';
    else if (next && caps.forecast && inDays != null && inDays >= 0) {
      if (inDays === 0) statusLine = 'დღეს სავარაუდო მენსტრუაციის დღეა — მენსტრუაცია ჯერ არ არის აღრიცხული';
      else {
        const what = uncertain ? 'სისხლდენა' : 'მენსტრუაცია';
        statusLine = inDays === 1 ? `${what} სავარაუდოდ ხვალ` : `${what} სავარაუდოდ ${inDays} დღეში`;
      }
    }
  }

  /** One number in the ring: bleeding day → „დღეს“ → countdown („სავარაუდოდ“) → cycle day. */
  let center;
  if (!hideLengthChrome) {
    if (onPeriod) center = { top: uncertain ? 'სისხლდენის დღე' : 'მენსტრუაციის დღე', value: day != null ? String(day) : '—', bottom: null, tone: 'period' };
    else if (predictedToday || (forecastOn && inDays === 0)) center = { top: 'სავარაუდოდ', value: 'დღეს', bottom: 'სავარაუდო მენსტრუაცია', tone: 'period', word: true };
    else if (forecastOn && inDays > 0) center = { top: uncertain ? 'სისხლდენამდე' : 'მენსტრუაციამდე', value: String(inDays), bottom: 'დღე · სავარაუდოდ' };
    else if (forecastOn && inDays < 0 && day != null) center = { top: 'ციკლის დღე', value: String(day), bottom: `სავარაუდო თარიღიდან ${-inDays} დღე` };
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
  const startLeads = !onPeriod && (!forecastOn || predictedToday || (inDays != null && inDays <= 3));
  const startLabel = uncertain ? 'სისხლდენა დაიწყო' : 'მენსტრუაცია დაიწყო';
  const showPredicted = caps.fertile && forecastAllowed; // calendar overlays follow the app (index.tsx showPredicted)

  return {
    today, mode, caps, todayLog, onPeriod, uncertain, fertilityVisible, forecastAllowed, hideLengthChrome, hidePredicted,
    cycleLen, periodLen, day, phase, phaseKa, next, inDays, forecastOn, predictedToday, phaseHint, statusLine, center,
    cycleStart, fertileDays, recordedDays, startLeads, startLabel, showPredicted, needsOnboarding,
    pcos: conditions.includes('pcos'),
    confidence: confidenceCopy(b),
  };
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
    } else if (periodEnd < count) {
      phases.push({ kind: 'follicular', from: periodEnd + 1, to: count });
    }
  }
  const capDeg = ((BAND / 2 + 2) / R) * (180 / Math.PI);
  const glowVar = opts.periodActive || opts.phase === 'period' ? '--cy-period'
    : opts.phase === 'fertile' || opts.phase === 'ovulation' ? '--cy-fertile-fill'
      : opts.phase === 'luteal' ? '--cy-luteal' : opts.phase === 'follicular' ? '--cy-follicular' : '--cy-muted-soft';

  const root = svg('svg', { viewBox: `0 0 ${VB} ${VB}`, role: 'img', 'aria-label': opts.label || 'ციკლის რგოლი', class: opts.animate ? 'cy-dial-anim' : null });
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
    const top = c ? c.top : 'ციკლის დღე';
    const bottom = c ? c.bottom : opts.hideLength ? null : `${length}-დან`;
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
    const phaseText = logged ? 'მენსტრუაცია · აღრიცხული'
      : !v.hidePredicted && mark?.phaseKa && mark.phase !== 'unknown' ? `სავარაუდოდ ${mark.phaseKa.toLowerCase()}` : null;
    return { top: date === v.today ? 'დღეს' : `${dd} ${KA_MONTHS[mm - 1]}`, value: String(d), bottom: phaseText ?? 'ციკლის დღე', tone: logged ? 'period' : 'ink' };
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
    center: v.center,
    phase: v.phase,
    periodActive: v.onPeriod,
    describeDay: v.hideLengthChrome ? null : describeDayFn(b, v),
    label: [v.day != null ? `ციკლის დღე ${v.day}` : null, v.phaseHint, v.statusLine].filter(Boolean).join('. '),
    ...extra,
  });
}

function predBadge(date) {
  return h('span', { class: 'cy-pred', title: 'სავარაუდო თარიღი' }, h('i', { class: 'cy-pred-dot' }), `სავარაუდო · ${fmtDate(date)}`);
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
  };

  if (!isFemale()) {
    mount(root, pageHead('ციკლი'), empty('ეს მოდული ხელმისაწვდომია ქალის პროფილისთვის.', 'პროფილში მიუთითე სქესი', button('პროფილი', { href: '/profile', variant: 'ghost' })));
    return () => root.classList.remove('cy');
  }

  const setBundle = (b) => {
    if (!b || !b.profile) return;
    state.bundle = b;
    if (state.alive) render();
  };

  const load = async () => {
    mount(root, pageHead('ციკლი', 'პროგნოზები, სიმპტომები და განწყობა'),
      h('div', { class: 'cy-layout' }, h('div', { class: 'cy-col' }, skeleton(6)), h('div', { class: 'cy-col' }, skeleton(8))));
    try {
      const b = await get('/api/cycle');
      state.bundle = b;
      const t = cycleToday(b).split('-').map(Number);
      state.cursor = { y: t[0], m: t[1] - 1 };
      render();
    } catch (e) {
      mount(root, pageHead('ციკლი'), errorBox(e, load));
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
        toast('მენსტრუაცია დაფიქსირდა — დღეს პირველი დღეა', 'ok', {
          ms: 8000,
          action: { label: 'გაუქმება', onClick: () => undoStart(date) },
        });
      } catch (e) { toast(e.message, 'error'); }
    });
  };
  const undoStart = async (date) => {
    try {
      // "end" on the first day clears that one-day period again (server planEndPeriod).
      setBundle(await put('/api/cycle/period', { action: 'end', date }));
      toast('გაუქმდა', 'info');
    } catch (e) { toast(e.message, 'error'); }
  };
  const endPeriod = async () => {
    const ok = await confirmDialog({ title: 'მენსტრუაციის დასრულება', body: 'დღევანდელი გამონადენი წაიშლება. გამოტოვებული დღეები არ შეივსება.', confirm: 'მენსტრუაციის დასრულება' });
    if (!ok) return;
    try { setBundle(await put('/api/cycle/period', { action: 'end', date: derive(state.bundle).today })); } catch (e) { toast(e.message, 'error'); }
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
        toast('სექსი აღირიცხა — დღეს. მხოლოდ შენ ხედავ.', 'ok', {
          ms: 8000,
          action: { label: 'გაუქმება', onClick: async () => {
            try { setBundle((await put(`/api/cycle/logs/${v.today}`, { sexualActivity: before })).bundle); } catch (e) { toast(e.message, 'error'); }
          } },
        });
      } catch (e) { toast(e.message, 'error'); }
    });
  };

  const openDayLog = (date, opts = {}) => openDayModal(state.bundle, date, { ...opts, onBundle: setBundle });

  const openSettings = () => openSettingsModal(state.bundle, setBundle);

  /* Render ------------------------------------------------------------- */
  function render() {
    const b = state.bundle;
    const v = derive(b);
    const subtitle = headerSubtitle(b, v);
    const head = pageHead('ციკლი', subtitle,
      button('აღრიცხვა', { icon: 'plus', variant: 'ghost', onClick: () => openDayLog(v.today) }),
      iconButton('settings', { title: 'ციკლის პარამეტრები', onClick: openSettings }));

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
    else left.push(section(null, heroCard(b, v)));

    if (v.caps.peri) left.push(section('პერიმენოპაუზის თვალყური', periCard(b)));
    if (v.caps.ttc) left.push(section(null, modeNote('info','ციკლის პროგნოზები სავარაუდოა. LH ტესტი, ტემპერატურა და ლორწო შენი აღრიცხვაა. ნაყოფიერების ჩანაწერებს დღის აღრიცხვაში იპოვი.')));
    if (b.contraception?.presentation?.showContextCard) {
      left.push(section(null, modeNote('shield', 'კონტრაცეფციის მეთოდის გამო პროგნოზები შეზღუდულია — ყველაზე ზუსტი შენი აღრიცხვებია. Medicard არ არის კონტრაცეფციის მეთოდი.')));
    }

    left.push(section('დღეს', todayCard(b, v, () => openDayLog(v.today))));
    if (!v.caps.pregnancy && !v.caps.postpartum) left.push(section('ჩემი ციკლი', statsCard(b)));

    right.push(section('კალენდარი', calendarCard(b, v), {
      action: state.editing ? null : button('თარიღების შესწორება', { size: 'sm', variant: 'ghost', icon: 'edit', onClick: () => { state.editing = true; state.pending = { add: new Set(), remove: new Set() }; render(); } }),
    }));
    if (!v.caps.pregnancy) right.push(section('ციკლების ისტორია', historyCard(b)));
    right.push(section('დღის რჩევები', tipsBlock(b, v, render)));

    mount(root, head, h('div', { class: 'cy-layout' }, h('div', { class: 'cy-col' }, left), h('div', { class: 'cy-col' }, right)));
    state.firstPaint = false;
  }

  function heroCard(b, v) {
    const actions = [];
    const logBtn = (primary) => button(v.onPeriod ? 'დღევანდელი გამონადენი' : 'დღის აღრიცხვა', {
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
      title: sexLogged ? 'სექსი დღეს აღრიცხულია — დეტალების გახსნა' : 'სექსის აღრიცხვა დღეს — ერთი შეხებით',
      'aria-label': sexLogged ? 'სექსი დღეს აღრიცხულია — დეტალების გახსნა' : 'სექსის აღრიცხვა დღეს — ერთი შეხებით',
    }, icon(sexLogged ? 'check' : 'heart', { size: 16 }), 'სექსი');
    sexBtn.addEventListener('click', () => logSexNow(sexBtn));

    const canStart = v.caps.forecast || v.caps.fertile; // not in pregnancy / postpartum
    if (v.onPeriod) {
      actions.push(logBtn(true), h('div', { class: 'cy-actions-row' }, button('მენსტრუაციის დასრულება', { variant: 'ghost', class: 'cy-soft-btn', onClick: endPeriod }), sexBtn));
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
        title: 'სავარაუდო ნაყოფიერი დღეები',
        size: 'sm',
        body: h('div', { class: 'stack' },
          h('strong', null, `${fmtDate(from)} – ${fmtDate(to)}`),
          h('p', { class: 'muted' }, cautious
            ? 'ეს დღე შეიძლება ნაყოფიერ ფანჯარაში იყოს. პროგნოზის სანდოობა დაბალია. Medicard არ არის კონტრაცეფციის მეთოდი.'
            : v.caps.ttc ? 'სავარაუდო ნაყოფიერი ფანჯარა — TTC რეჟიმში ეს დღეები ხშირად უფრო ყურადღებადია. ეს არ ადასტურებს ოვულაციას.'
              : 'ამ დღეებში სავარაუდო ნაყოფიერი ფანჯარაა — კალენდარული შეფასებაა, არა დადგენილი ნაყოფიერება. Medicard არ არის კონტრაცეფციის მეთოდი.')),
      });
    } : null;

    const explainPhase = () => openModal({
      title: 'როგორ ითვლება?',
      size: 'sm',
      body: h('p', { class: 'muted' }, 'შენ აღრიცხავ მენსტრუაციის დაწყებას. Medicard ბოლო ციკლების საშუალო ხანგრძლივობით აფასებს შემდეგ თარიღებს. რაც მეტ ციკლს აღრიცხავ, მით უფრო ზუსტდება შეფასება. ეს ყოველთვის შეფასებაა და შეიძლება გადაიწიოს.'),
    });

    const glowDot = v.onPeriod || v.phase === 'period' ? 'var(--cy-period)' : v.phase === 'fertile' || v.phase === 'ovulation' ? 'var(--cy-fertile-fill)'
      : v.phase === 'luteal' ? 'var(--cy-luteal)' : v.phase === 'follicular' ? 'var(--cy-follicular)' : 'var(--cy-muted-soft)';

    const cycleLenRound = Math.round(v.cycleLen) || 28;
    const underLine = v.center && v.day != null
      ? h('div', { class: 'cy-status' }, v.day > cycleLenRound ? `ჩვეულებრივ ციკლი ${cycleLenRound} დღეა` : `ციკლის ${v.day}-ე დღე · ${cycleLenRound}-დან`)
      : h('div', { class: `cy-status${v.statusLine ? ' strong' : ''}` }, v.statusLine || (v.hideLengthChrome ? 'ციკლის პროგნოზისთვის ჯერ საკმარისი ახალი ისტორია არ არის.' : 'ვსწავლობთ შენს რიტმს — აღრიცხე შემდეგი მენსტრუაცია'));

    return card({ class: 'cy-hero' },
      dialFor(b, v, { animate: state.firstPaint, onFertile: explainFertile }),
      h('button', { type: 'button', class: `cy-phase-pill${v.onPeriod ? ' period' : ''}`, onClick: v.hideLengthChrome ? null : explainPhase, title: 'როგორ ითვლება?' },
        h('i', { style: { background: glowDot } }), v.phaseHint, v.hideLengthChrome ? null : icon('info', { size: 14 })),
      underLine,
      v.forecastOn || (v.caps.forecast && !v.hidePredicted)
        ? h('div', { class: 'cy-badges' }, v.next && v.forecastOn && !v.onPeriod ? predBadge(v.next) : null, h('span', { class: 'cy-conf' }, v.confidence))
        : null,
      !v.hideLengthChrome && (v.fertileDays || v.cycleStart)
        ? h('div', { class: 'cy-dial-legend', 'aria-hidden': 'true' },
          h('span', null, h('i', { class: 'cy-dot period' }), 'მენსტრუაცია'),
          h('span', null, h('i', { class: 'cy-dot follicular' }), 'ფოლიკულური'),
          v.fertileDays ? h('span', null, h('i', { class: 'cy-dot fertile' }), 'ნაყოფიერი') : null,
          v.fertileDays ? h('span', null, h('i', { class: 'cy-dot luteal' }), 'ლუთეალური') : null)
        : null,
      !v.hideLengthChrome ? h('div', { class: 'cy-hint' }, 'მიიტანე კურსორი რგოლზე — ნახე ნებისმიერი დღე') : null,
      v.pcos && v.fertilityVisible ? h('div', { class: 'cy-caution' }, 'შენ მიუთითე PCOS — სავარაუდო ოვულაცია ნაკლებად საიმედოა. ეს არ არის კონტრაცეფციის რჩევა.') : null,
      h('div', { class: 'cy-actions' }, actions));
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
        key === v.today ? 'დღეს' : null,
        L.loggedPeriod ? (v.caps.postpartum ? 'სისხლდენა' : 'მენსტრუაცია') : null,
        L.spotting ? 'ლაქები' : null,
        L.predictedPeriod ? 'სავარაუდო მენსტრუაცია' : null,
        L.ovulation ? 'სავარაუდო ოვულაცია' : L.fertile ? 'სავარაუდო ნაყოფიერი' : null,
        L.symptomDot ? 'აღრიცხული' : null,
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
    const t = v.today.split('-').map(Number);
    const onTodayMonth = t[0] === y && t[1] - 1 === m;

    const changes = add.size + remove.size;
    const saveBtn = button(changes ? `შენახვა · ${changes} ცვლილება` : 'ცვლილება არ არის', { size: 'sm', variant: 'rose', disabled: !changes });
    saveBtn.addEventListener('click', () => busy(saveBtn, async () => {
      try {
        const nb = await put('/api/cycle/period/days', { add: [...add], remove: [...remove] });
        state.editing = false;
        state.pending = { add: new Set(), remove: new Set() };
        setBundle(nb);
        toast('მენსტრუაციის თარიღები განახლდა');
      } catch (e) { toast(e.message, 'error'); }
    }));

    return card(
      h('div', { class: 'cy-cal-head' },
        iconButton('chevronLeft', { title: 'წინა თვე', onClick: () => shift(-1) }),
        h('h3', null, `${KA_MONTHS[m]} ${y}`),
        onTodayMonth ? null : button('დღეს', { size: 'sm', variant: 'ghost', onClick: () => { state.cursor = { y: t[0], m: t[1] - 1 }; render(); } }),
        iconButton('chevronRight', { title: 'შემდეგი თვე', onClick: () => shift(1) })),
      h('div', { class: `cy-cal${editing ? ' editing' : ''}` }, cells),
      editing
        ? h('div', { class: 'cy-edit-bar' },
          h('span', { style: { flex: '1 1 240px' } }, 'მონიშნე დღეები, როცა მენსტრუაცია გქონდა, ან მოხსენი მონიშვნა. წყვეტილი წრე სავარაუდო დღეებს აჩვენებს.'),
          h('div', { class: 'hstack' },
            button('გაუქმება', { size: 'sm', variant: 'ghost', onClick: () => { state.editing = false; state.pending = { add: new Set(), remove: new Set() }; render(); } }),
            saveBtn))
        : null,
      h('div', { class: 'cy-legend' },
        h('span', null, h('i', { class: 'cy-lg logged' }), v.caps.postpartum ? 'სისხლდენა' : 'მენსტრუაცია'),
        v.showPredicted ? h('span', null, h('i', { class: 'cy-lg expected' }), 'სავარაუდო მენსტრუაცია') : null,
        v.showPredicted && v.fertilityVisible ? h('span', null, h('i', { class: 'cy-lg fertile' }), 'სავარაუდო ნაყოფიერი') : null,
        v.showPredicted && v.fertilityVisible ? h('span', null, h('i', { class: 'cy-lg ovulation' }), 'სავარაუდო ოვულაცია') : null,
        h('span', null, h('i', { class: 'cy-lg sym' }), 'აღრიცხული')),
      v.showPredicted ? h('p', { class: 'disclaimer' }, icon('info', { size: 14 }), 'შეფასება ბოლო ციკლების მიხედვით — თარიღები შეიძლება შეიცვალოს.') : null);
  }

  await load();
  return () => { state.alive = false; root.classList.remove('cy'); };
}

function headerSubtitle(b, v) {
  if (v.caps.pregnancy) {
    const age = b.pregnancy?.age;
    return age ? `${age.week} კვირა + ${age.day} დღე` : 'ორსულობის რეჟიმი';
  }
  if (v.caps.peri) return 'პერიმენოპაუზის რეჟიმი';
  if (v.caps.postpartum) {
    const e = b.postpartum?.elapsed;
    return e ? `${e.week} კვირა + ${e.day} დღე` : 'მშობიარობის შემდგომი თვალყური';
  }
  if (v.hideLengthChrome) return 'ციკლის ახალი ისტორია გროვდება';
  if (v.day != null) return `ციკლის დღე ${v.day} · ${v.phaseHint}`;
  return 'ვსწავლობთ შენს რიტმს — აღრიცხე შემდეგი მენსტრუაცია';
}

function modeNote(ic, text) {
  return h('div', { class: 'cy-mode-note' }, icon(ic, { size: 18 }), h('div', null, text));
}

function appHint(text = 'ამ რეჟიმის დეტალური ინსტრუმენტები MEDICARD აპშია.') {
  return h('div', { class: 'cy-mode-note' }, icon('smartphone', { size: 18 }),
    h('div', null, text, ' ', h('a', { href: APP_STORE, target: '_blank', rel: 'noopener', class: 'link' }, 'ამისთვის გამოიყენე MEDICARD აპი')));
}

/* ── Onboarding (no last period yet) ─────────────────────────────────────── */
function onboardingCard(b, onBundle) {
  const today = cycleToday(b);
  const dateInput = input({ type: 'date', max: today, min: addKey(today, -180), value: '', required: true, name: 'date' });
  const err = h('div', { class: 'form-error', hidden: true });
  const save = button('შენახვა', { variant: 'rose' });
  save.addEventListener('click', () => busy(save, async () => {
    err.hidden = true;
    const date = dateInput.value;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { err.textContent = 'აირჩიე თარიღი'; err.hidden = false; return; }
    try {
      const nb = await post('/api/cycle/last-period', { date });
      if (nb?.profile && nb.predictions) onBundle(nb);
      else onBundle(await get('/api/cycle'));
    } catch (e) { err.textContent = e.message; err.hidden = false; }
  }));
  return card({ class: 'pad-lg', style: { maxWidth: '560px' } },
    h('div', { class: 'stack', style: { gap: '16px' } },
      h('span', { class: 'tile ink-rose', style: { width: '52px', height: '52px' } }, icon('flower', { size: 26 })),
      h('h2', { style: { fontSize: '22px' } }, 'როდის დაიწყო ბოლო მენსტრუაცია?'),
      h('p', { class: 'muted' }, 'პირველი დღე საკმარისია. შემდეგ თარიღებს შენი ჩანაწერებით დავაზუსტებთ — ეს ყოველთვის შეფასებაა და შეიძლება გადაიწიოს.'),
      field('ბოლო მენსტრუაციის დასაწყისი', dateInput),
      err,
      h('div', { class: 'hstack' }, save),
      appHint('ორსულობის, მშობიარობის შემდგომი და პერიმენოპაუზის რეჟიმების ჩართვა აპის ციკლის პარამეტრებშია.')));
}

/* ── Mode cards ──────────────────────────────────────────────────────────── */
function pregnancyCard(b, v, onLog) {
  const p = b.pregnancy || {};
  const age = p.reviewRequired ? null : p.age;
  return card({ class: 'cy-hero' },
    age ? ring({ value: age.dayOfPregnancy, max: 280, size: 200, stroke: 16, color: 'var(--cy-luteal)', label: `${age.week}`, sub: 'კვირა · სავარაუდოდ' })
      : h('span', { class: 'tile ink-violet', style: { width: '64px', height: '64px' } }, icon('heart', { size: 30 })),
    h('div', { class: 'cy-status strong' }, age ? `${age.week} კვირა + ${age.day} დღე` : p.reviewRequired ? 'საცნობი თარიღი გადასახედია — კვირის შეფასება არ გამოჩნდება.' : 'ორსულობის რეჟიმი'),
    age?.trimester ? h('div', { class: 'cy-status' }, `${age.trimester} ტრიმესტრი`) : null,
    p.dueDate ? h('div', { class: 'cy-badges' }, h('span', { class: 'cy-pred' }, `სავარაუდო მშობიარობის თარიღი · ${fmtDate(p.dueDate, { year: true })}`)) : null,
    h('div', { class: 'cy-caution' }, 'კვირა და სავარაუდო თარიღი LMP-ზე / არჩეულ თარიღზეა დაფუძნებული. ეს არ არის ულტრაბგერის დათარიღება და არ არის დიაგნოზი.'),
    h('div', { class: 'cy-actions' }, button('დღის აღრიცხვა', { icon: 'plus', variant: 'rose', onClick: onLog }), appHint('კვირის ვიზუალი, მოვლის გეგმა და ორსულობის ჩანაწერები MEDICARD აპშია.')));
}

function postpartumCard(b, v, onLog) {
  const e = b.postpartum?.elapsed;
  return card({ class: 'cy-hero' },
    h('span', { class: 'tile ink-violet', style: { width: '64px', height: '64px' } }, icon('heart', { size: 30 })),
    h('div', { class: 'cy-status strong' }, e ? `${e.week} კვირა + ${e.day} დღე` : 'საწყისი თარიღი არ არის მითითებული.'),
    e ? h('div', { class: 'cy-status' }, 'შენს მითითებულ თარიღიდან. არ არის გამოჯანმრთელების პროგრესი.') : null,
    h('div', { class: 'cy-caution' }, 'ეს თვალყურის რეჟიმია, რომელსაც შენ ირჩევ. არ არის გამოჯანმრთელების დიაგნოზი.'),
    h('div', { class: 'cy-actions' }, button('დღის აღრიცხვა', { icon: 'plus', variant: 'rose', onClick: onLog }), appHint('სისხლდენის კლასიფიკაცია და საწყისი თარიღის შეცვლა MEDICARD აპშია.')));
}

function periCard(b) {
  const p = b.perimenopause;
  if (!p) return card(h('p', { class: 'muted' }, 'ეს თვალყურის რეჟიმია, რომელსაც შენ ირჩევ. ეს არ არის პერიმენოპაუზის ან მენოპაუზის დიაგნოზი.'));
  const vs = p.variabilitySummary || {};
  const st = (label, val) => h('div', { class: 'cy-stat' }, h('div', { class: 'cy-stat-label' }, label),
    h('div', { class: 'cy-stat-value' }, h('b', null, val != null ? String(val) : '—'), val != null ? h('small', null, 'დღე') : null));
  return card(
    h('div', { class: 'cy-stats' }, st('უმოკლესი ინტერვალი', vs.shortestDays), st('უგრძესი ინტერვალი', vs.longestDays), st('ბოლო ინტერვალი', vs.recentIntervalDays)),
    vs.intervalCount != null ? h('p', { class: 'faint', style: { fontSize: '12px', marginTop: '10px' } }, `${vs.intervalCount} აღრიცხული ინტერვალის მიხედვით`) : null,
    p.lastRecordedBleeding ? h('p', { class: 'muted', style: { fontSize: '13.5px', marginTop: '10px' } }, `ბოლო აღრიცხული სისხლდენა: ${fmtDate(p.lastRecordedBleeding.date)}`) : null,
    (p.recentBleedingEpisodes || []).length ? h('div', { class: 'list', style: { marginTop: '8px' } },
      p.recentBleedingEpisodes.slice(-4).reverse().map((ep) => row({ icon: 'droplet', ink: 'rose', title: `${fmtDate(ep.start)} – ${fmtDate(ep.end)}`, sub: ep.durationDays ? `${ep.durationDays} დღე` : null }))) : null,
    h('p', { class: 'disclaimer' }, icon('info', { size: 14 }), 'ეს თვალყურის რეჟიმია, რომელსაც შენ ირჩევ. ეს არ არის პერიმენოპაუზის ან მენოპაუზის დიაგნოზი.'));
}

/* ── Today / stats / history ─────────────────────────────────────────────── */
function logFacts(l, { uncertain } = {}) {
  const out = [];
  if (!l) return out;
  if (isBleed(l.flow)) out.push(h('span', { class: 'cy-fact period' }, icon('droplet', { size: 13 }), `${uncertain ? 'სისხლდენა' : 'გამონადენი'}: ${LABEL[l.flow]}`));
  else if (l.flow === 'spotting') out.push(h('span', { class: 'cy-fact period' }, 'ლაქები'));
  const sym = (l.symptoms || []).filter((id) => !SEX_IDS.has(id) && LABEL[id]);
  sym.slice(0, 6).forEach((id) => out.push(h('span', { class: 'cy-fact' }, LABEL[id])));
  if (sym.length > 6) out.push(h('span', { class: 'cy-fact' }, `+${sym.length - 6}`));
  (l.painEntries || []).forEach((p) => out.push(h('span', { class: 'cy-fact' }, `${PAIN_TYPES.find((x) => x.id === p.type)?.label || 'ტკივილი'} · ${PAIN_SEVERITY.find((x) => x.id === p.severity)?.label || ''}`)));
  (l.moods || []).slice(0, 4).forEach((id) => out.push(h('span', { class: 'cy-fact' }, LABEL[id] || id)));
  const energy = l.energy || l.observations?.energy;
  if (energy) out.push(h('span', { class: 'cy-fact' }, `ენერგია: ${ENERGY.find((e) => e.id === energy)?.label || energy}`));
  if (l.sexualActivity === true || (l.symptoms || []).some((id) => SEX_ACTIVITY_IDS.has(id))) out.push(h('span', { class: 'cy-fact private' }, icon('lock', { size: 12 }), 'სექსი'));
  if (l.bbt != null) out.push(h('span', { class: 'cy-fact' }, `BBT ${String(l.bbt).replace('.', ',')} °C`));
  if (l.cervicalMucus) out.push(h('span', { class: 'cy-fact' }, `ლორწო: ${LABEL[l.cervicalMucus] || ''}`));
  if (l.ovulationTest) out.push(h('span', { class: 'cy-fact' }, `ოვულაციის ტესტი: ${TESTS.find((t) => t.id === l.ovulationTest)?.label}`));
  if (l.pregnancyTest) out.push(h('span', { class: 'cy-fact' }, `ორსულობის ტესტი: ${TESTS.find((t) => t.id === l.pregnancyTest)?.label}`));
  if (l.notes) out.push(h('span', { class: 'cy-fact' }, icon('edit', { size: 12 }), 'ჩანაწერი'));
  return out;
}

function todayCard(b, v, onLog) {
  const facts = logFacts(v.todayLog, { uncertain: v.uncertain });
  return card(
    facts.length ? h('div', { class: 'cy-facts' }, facts) : h('p', { class: 'muted' }, 'დღეს ჯერ არაფერი არ არის აღრიცხული — დაამატე გამონადენი, სიმპტომები ან განწყობა.'),
    h('div', { class: 'hstack', style: { marginTop: '14px' } },
      button(facts.length ? 'რედაქტირება' : 'დღის აღრიცხვა', { size: 'sm', variant: 'ghost', icon: facts.length ? 'edit' : 'plus', onClick: onLog })));
}

/** CycleStatsCard: typical adult ranges shown as reference, never as a diagnosis (cycle 21–35, bleeding 2–7). */
function statsCard(b) {
  const avg = b.averages || {};
  const cycle = avg.usedCycleLength ?? null;
  const period = avg.usedPeriodLength ?? null;
  const lengths = (b.trends?.cycleLengths || []).map((x) => x.length).filter((n) => Number.isFinite(n)).slice(-6);
  const variation = lengths.length >= 2 ? Math.max(...lengths) - Math.min(...lengths) : null;
  const inferred = avg.source === 'inferred' && (avg.cycleCount ?? 0) >= 2;
  const rangeTone = (val, lo, hi) => (val == null ? 'unknown' : val < lo ? 'shorter' : val > hi ? 'longer' : 'typical');
  const tone = (t) => {
    if (t === 'unknown') return h('div', { class: 'cy-tone none' }, 'საჭიროა 2+ ციკლი');
    const label = { typical: 'ტიპური', longer: 'ტიპურზე გრძელი', shorter: 'ტიპურზე მოკლე', variable: 'ცვალებადი' }[t];
    return h('div', { class: `cy-tone ${t === 'typical' ? 'ok' : 'off'}` }, h('i'), label);
  };
  const tiles = [
    { label: 'ციკლი', value: cycle, tone: rangeTone(cycle, 21, 35), hint: 'ტიპური: 21–35 დღე' },
    { label: 'პერიოდი', value: period, tone: rangeTone(period, 2, 7), hint: 'ტიპური: 2–7 დღე' },
    { label: 'რყევა', value: variation, tone: variation == null ? 'unknown' : variation <= 7 ? 'typical' : 'variable', hint: 'ყველაზე გრძელ და მოკლე ციკლს შორის' },
  ];
  return card(
    h('div', { class: 'cy-stats' }, tiles.map((t) => h('div', { class: 'cy-stat' },
      h('div', { class: 'cy-stat-label' }, t.label),
      h('div', { class: 'cy-stat-value' }, h('b', null, t.value != null ? String(t.value) : '—'), t.value != null ? h('small', null, 'დღე') : null),
      tone(t.tone),
      h('div', { class: 'cy-stat-hint' }, t.hint)))),
    h('p', { class: 'faint', style: { fontSize: '12px', marginTop: '12px' } },
      inferred ? `ბოლო ${avg.cycleCount} ციკლის მიხედვით` : 'შენი მითითებით — 2 ციკლის შემდეგ შენი მონაცემებით დავითვლით'),
    h('p', { class: 'disclaimer', style: { marginTop: '8px' } }, icon('info', { size: 14 }), 'ტიპური დიაპაზონი საორიენტაციოა და არა დიაგნოზი. თუ რამე გაწუხებს, მიმართე ექიმს.'));
}

function historyCard(b) {
  const lengths = (b.trends?.cycleLengths?.length ? b.trends.cycleLengths.map((x) => ({ start: x.start, length: x.length }))
    : (b.analytics?.cycleLengths || []).map((x) => ({ start: x.startDate, length: x.length })))
    .filter((x) => x.start && Number.isFinite(x.length)).slice(-12);
  const ranges = (b.periodRanges || []).slice(-6).reverse();
  const avgLen = b.averages?.usedCycleLength ?? null;
  return card(
    lengths.length
      ? h('div', null,
        h('div', { class: 'between', style: { marginBottom: '8px' } },
          h('div', { class: 'card-sub' }, 'ციკლის ხანგრძლივობა (დღე)'),
          h('div', { class: 'legend' }, h('span', null, h('i', { style: { background: 'var(--cy-luteal)' } }), 'ციკლი'))),
        barChart({
          labels: lengths.map((x) => shortDate(x.start)),
          tipLabels: lengths.map((x) => `${fmtDate(x.start)}-დან`),
          values: lengths.map((x) => x.length),
          color: 'var(--cy-luteal)',
          unit: 'დღე',
          goal: avgLen || undefined,
          goalLabel: avgLen ? `საშუალო ${avgLen}` : undefined,
          height: 200,
          fmt: (n) => String(Math.round(n)),
        }))
      : empty('ისტორია ჯერ მცირეა', 'ციკლების ხანგრძლივობა გამოჩნდება, როცა ორ მენსტრუაციას მაინც აღრიცხავ.'),
    h('div', { class: 'hub-section-head', style: { marginTop: '18px', marginBottom: '4px' } }, h('h2', { style: { fontSize: '15px' } }, 'მენსტრუაციის ისტორია')),
    ranges.length
      ? h('div', { class: 'list cy-period-list' }, ranges.map((r) => row({
        icon: 'droplet', ink: 'rose',
        title: r.start === r.end ? fmtDate(r.start) : `${fmtDate(r.start)} – ${fmtDate(r.end)}`,
        sub: `${r.lengthDays} აღრიცხული დღე`,
      })))
      : h('p', { class: 'muted', style: { fontSize: '13.5px' } }, 'ჯერ არ არის აღრიცხული მენსტრუაცია.'));
}

/* ── Tips (CycleInsightsPanel variant="tips") ────────────────────────────── */
function tipsBlock(b, v, rerender) {
  const ai = b.profile?.aiInsights;
  const aiCards = ai && ai.source === 'ai' && Array.isArray(ai.cards) ? ai.cards : null;
  const local = b.localInsights?.cards || [];
  const insightCards = (aiCards || local).slice(0, 3).map((c) => ({ ...c, src: aiCards ? 'Medi' : 'შენი ჩანაწერებით' }));
  const tips = v.caps.pregnancy || v.caps.postpartum || v.caps.peri ? [] : dailyTips(v.phase, v.day).map((t) => ({ ...t, src: 'დღის რჩევა' }));
  const all = [...insightCards, ...tips];
  const headline = (aiCards ? ai.headline : b.localInsights?.headline) || null;

  const aiAllowed = featureOn('medi') && v.mode !== 'POSTPARTUM';
  const refresh = aiAllowed ? button(aiCards ? 'Medi-ს რჩევების განახლება' : 'პერსონალური რჩევა Medi-სგან', { size: 'sm', variant: 'ghost', icon: 'sparkles' }) : null;
  refresh?.addEventListener('click', () => busy(refresh, async () => {
    try {
      // POST /api/cycle/insights only reads/computes (the app lists it in READ_ONLY_WRITES); it sends cycle
      // context to the AI provider, so it is wrapped in the voluntary AI consent.
      const res = await withAiConsent(() => post('/api/cycle/insights', { refresh: true }));
      if (!res || res.declined) return;
      if (res.insights) {
        b.profile.aiInsights = res.insights;
        b.profile.aiInsightsAt = new Date().toISOString();
        rerender();
      }
    } catch (e) { toast(e.message, 'error'); }
  }));

  return h('div', { class: 'stack', style: { gap: '12px' } },
    headline || refresh ? h('div', { class: 'between' }, headline ? h('div', { class: 'muted', style: { fontWeight: 600 } }, headline) : h('span'), refresh) : null,
    all.length
      ? h('div', { class: 'cy-tips' }, all.map((c) => h('article', { class: 'cy-tip' },
        h('div', { class: 'between' }, h('span', { class: `cy-tip-tile ${c.tone}` }, icon(TIP_ICON[c.tone] || 'sparkles', { size: 18 })), h('span', { class: 'cy-src' }, c.src)),
        h('h4', null, c.title),
        h('p', null, c.body),
        c.action ? h('div', { class: 'cy-tip-act' }, c.action) : null)))
      : card(h('p', { class: 'muted' }, 'რჩევები გამოჩნდება, როცა ციკლის რამდენიმე დღეს აღრიცხავ.')),
    h('p', { class: 'disclaimer', style: { marginTop: '4px' } }, icon('info', { size: 14 }), 'Medi-ს რჩევები ზოგადი ინფორმაციაა შენი ფაზისა და ჩანაწერების მიხედვით — არა დიაგნოზი.'));
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
  };
}

function payloadFromForm(f) {
  const raw = f.bbt.trim().replace(',', '.');
  const bbt = raw ? Number(raw) : null;
  if (raw && (!Number.isFinite(bbt) || bbt < 34 || bbt > 42)) throw new Error('BBT უნდა იყოს 34–42 °C შორის.');
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
    observations: { energy: f.energy },
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

  const title = only === 'sex' ? 'სექსი და ლიბიდო' : `${fmtDate(date)}${date === v.today ? ' · დღეს' : ''}`;
  const infoBits = [];
  if (mark.cycleDay) infoBits.push(`ციკლის ${mark.cycleDay}-ე დღე`);
  if (L.loggedPeriod) infoBits.push(v.uncertain || v.caps.postpartum ? 'სისხლდენა · აღრიცხული' : 'მენსტრუაცია · აღრიცხული');
  else if (L.predictedPeriod) infoBits.push('სავარაუდო მენსტრუაცია');
  else if (L.ovulation) infoBits.push('სავარაუდო ოვულაცია');
  else if (L.fertile) infoBits.push('სავარაუდო ნაყოფიერი');
  else if (v.showPredicted && mark.phaseKa && mark.phase && mark.phase !== 'unknown') infoBits.push(`სავარაუდოდ ${mark.phaseKa.toLowerCase()}`);

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
      only === 'sex' ? null : h('h4', null, icon('heart', { size: 15 }), 'სექსი და ლიბიდო'),
      h('div', { class: 'cy-private' }, icon('lock', { size: 12 }), 'მხოლოდ შენ ხედავ — პარტნიორსა და Medi-ს არ ეგზავნება'),
      h('div', { class: 'cy-sub-label' }, 'სექსი'),
      h('div', { class: 'chips' },
        chip('არ მქონია', f.sexual === false, () => {
          if (f.sexual === false) f.sexual = null; else { f.sexual = false; f.sexTags = driveTags; }
          paint();
        }),
        SEX_ACTIVITY.map((o) => chip(o.label, activity.includes(o.id), () => {
          const next = activity.includes(o.id) ? activity.filter((x) => x !== o.id) : [...activity, o.id];
          f.sexual = next.length ? true : null;
          f.sexTags = [...next, ...driveTags];
          paint();
        }))),
      h('div', { class: 'cy-sub-label' }, 'ლიბიდო'),
      h('div', { class: 'chips', role: 'radiogroup' }, SEX_DRIVE.map((o) => chip(o.label, drive === o.id, () => {
        f.sexTags = [...activity, ...(drive === o.id ? [] : [o.id])];
        paint();
      }))));
  };

  const painSection = () => {
    const has = (id) => f.painEntries.find((p) => p.type === id);
    return sec('ტკივილი', 'აღრიცხვაა, არა დიაგნოზი. თუ ტკივილი ძლიერი, უეცარი ან გაწუხებს — მიმართე ექიმს.',
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
    if (infoBits.length && only !== 'sex') parts.push(h('div', { class: 'cy-mode-note' }, icon('calendar', { size: 18 }), h('div', null, infoBits.join(' · '), L.predictedPeriod || L.fertile || L.ovulation ? h('div', { class: 'faint', style: { fontSize: '12px', marginTop: '2px' } }, 'შეფასება ბოლო ციკლების მიხედვით — არა დადგენილი თარიღი.') : null)));
    if (future) {
      parts.push(h('p', { class: 'muted' }, 'მომავალ დღეს ვერ აღრიცხავ. ამ დღის ინფორმაცია სავარაუდოა და შეიძლება შეიცვალოს.'));
      mount(bodyEl, parts);
      return;
    }
    if (only === 'sex') {
      parts.push(sexSection());
    } else {
      parts.push(sec(v.uncertain || v.caps.postpartum ? 'სისხლდენა' : 'გამონადენი', 'აირჩიე ერთი ვარიანტი', single(FLOWS, 'flow')));
      parts.push(sexSection());
      parts.push(sec('სიმპტომები', 'შეგიძლია რამდენიმე მონიშნო', multi(visibleSymptoms, 'symptoms'),
        h('button', { type: 'button', class: 'link', style: { marginTop: '10px', background: 'none', border: 0, padding: 0, cursor: 'pointer', font: 'inherit', fontSize: '13px' }, onClick: () => { showAllSymptoms = !showAllSymptoms; paint(); } },
          showAllSymptoms ? 'ნაკლების ჩვენება' : `ყველა სიმპტომი (${SYMPTOMS.length})`)));
      parts.push(sec('განწყობა', 'როგორ გრძნობ თავს დღეს?', multi(MOODS, 'moods')));
      parts.push(sec('ენერგია', 'დღის საერთო დონე. დაღლილობა ცალკე სიმპტომია.', single(ENERGY, 'energy')));
      parts.push(painSection());
      parts.push(sec('ცხოვრების წესი', 'სუბიექტური აღრიცხვა.', h('div', { class: 'cy-life' },
        LIFESTYLE.map((g) => [h('div', { class: 'cy-life-label' }, g.label), single(g.options, g.key)]))));
      if (fertilityShown) {
        const bbt = input({ type: 'text', inputmode: 'decimal', placeholder: 'მაგ. 36,6', value: f.bbt, style: { maxWidth: '160px' }, onInput: (e) => { f.bbt = e.target.value; } });
        parts.push(sec('ნაყოფიერების ჩანაწერები', 'ეს შენი დაკვირვებაა. Medicard ნაყოფიერებას ან ორსულობას არ ადასტურებს.',
          field('ბაზალური ტემპერატურა (°C)', bbt),
          h('div', { class: 'cy-sub-label' }, 'ცერვიკალური ლორწო'), single(MUCUS, 'mucus', { teal: true }),
          h('div', { class: 'cy-sub-label' }, 'ოვულაციის ტესტი'), single(TESTS, 'ovulationTest', { teal: true }),
          h('div', { class: 'cy-sub-label' }, 'ორსულობის ტესტი'), single(TESTS, 'pregnancyTest', { teal: true })));
      }
      const notes = h('textarea', { class: 'input textarea', maxlength: 2000, placeholder: 'როგორ გაიარა დღემ…', onInput: (e) => { f.notes = e.target.value; } });
      notes.value = f.notes;
      parts.push(sec('ჩანაწერი', 'არასავალდებულო. დღიური რჩება ამ ანგარიშზე და პარტნიორს არ ეგზავნება.', notes));
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
      if (future) return [button('დახურვა', { variant: 'ghost', onClick: () => close() })];
      const save = button('შენახვა', { variant: 'rose' });
      save.addEventListener('click', () => busy(save, async () => {
        err.hidden = true;
        try {
          const payload = payloadFromForm(f);
          if (JSON.stringify(payload) === initial) { close(); return; }
          const res = await put(`/api/cycle/logs/${date}`, only === 'sex' ? { sexualActivity: payload.sexualActivity, symptoms: payload.symptoms } : payload);
          onBundle(res.bundle);
          close();
          toast('შენახულია');
        } catch (e) { err.textContent = e.message || 'ვერ შეინახა.'; err.hidden = false; }
      }));
      const out = [];
      if (log && only !== 'sex') {
        const rm = button('დღის წაშლა', { variant: 'ghost', icon: 'trash' });
        rm.style.marginRight = 'auto';
        rm.addEventListener('click', async () => {
          const ok = await confirmDialog({ title: 'ჩანაწერის წაშლა', body: `${fmtDate(date)}-ის ყველა ჩანაწერი წაიშლება.`, confirm: 'წაშლა', danger: true });
          if (!ok) return;
          try { onBundle(await del(`/api/cycle/logs/${date}`)); close(); toast('ჩანაწერი წაიშალა'); } catch (e) { toast(e.message, 'error'); }
        });
        out.push(rm);
      }
      out.push(button('გაუქმება', { variant: 'ghost', onClick: () => close() }), save);
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
  const range = (a, z) => Array.from({ length: z - a + 1 }, (_, i) => ({ value: a + i, label: `${a + i} დღე` }));
  const conds = (p.conditions || []).map(String);
  const check = (name, label, checked) => h('label', { class: 'hstack', style: { gap: '10px', cursor: 'pointer', fontSize: '14px' } },
    h('input', { type: 'checkbox', name, checked }), label);
  const m = formModal({
    title: 'ციკლის პარამეტრები',
    size: 'md',
    fields: () => h('div', { class: 'stack', style: { gap: '16px' } },
      canSwitch ? field('რეჟიმი', select([
        { value: 'TRACK_PERIOD', label: MODE_LABEL.TRACK_PERIOD },
        { value: 'TRY_TO_CONCEIVE', label: MODE_LABEL.TRY_TO_CONCEIVE },
      ], mode, { name: 'mode' }), mode === 'TRY_TO_CONCEIVE' ? 'სავარაუდო ნაყოფიერი დღეები კალენდარული შეფასებაა. აპი ორსულობას არ ჰპირდება.' : null)
        : field('რეჟიმი', input({ value: MODE_LABEL[mode] || mode, disabled: true }), 'ამ რეჟიმის შეცვლა MEDICARD აპშია.'),
      h('div', { class: 'grid grid-2' },
        field('საშუალო ციკლი', select(range(21, 45), p.avgCycleLength || 28, { name: 'avgCycleLength' })),
        field('საშუალო მენსტრუაცია', select(range(2, 10), p.avgPeriodLength || 5, { name: 'avgPeriodLength' }))),
      h('p', { class: 'faint', style: { fontSize: '12.5px' } }, 'გამოიყენება მხოლოდ საწყისად — შემდეგ შენი ჩანაწერებით ზუსტდება.'),
      check('isIrregular', 'არარეგულარული ციკლი', Boolean(p.isIrregular)),
      h('div', { class: 'stack', style: { gap: '8px' } },
        h('div', { class: 'field-label' }, 'ჯანმრთელობა (სურვილისამებრ)'),
        check('cond_pcos', 'PCOS', conds.includes('pcos')),
        check('cond_endometriosis', 'ენდომეტრიოზი', conds.includes('endometriosis'))),
      appHint('შეხსენებები, პარტნიორის გაზიარება, კონტრაცეფცია და ორსულობის / მშობიარობის შემდგომი / პერიმენოპაუზის რეჟიმები MEDICARD აპის ციკლის პარამეტრებშია.')),
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
      const nb = await put('/api/cycle/profile', body);
      if (nb?.profile && nb.predictions) onBundle(nb);
      else onBundle(await get('/api/cycle'));
      close();
      toast('პარამეტრები შენახულია');
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
  const open = button('გახსნა', { href: '/cycle', size: 'sm', variant: 'ghost', icon: 'arrowRight' });
  if (v.needsOnboarding) {
    return h('div', { class: 'cy-home' },
      h('span', { class: 'tile ink-rose', style: { width: '52px', height: '52px' } }, icon('flower', { size: 24 })),
      h('div', { class: 'cy-home-main' },
        h('h3', null, 'მონიშნე ბოლო მენსტრუაცია'),
        h('p', null, 'პროგნოზები და ფაზები გამოჩნდება — ყოველთვის როგორც შეფასება.'),
        h('div', null, button('დაწყება', { href: '/cycle', size: 'sm', variant: 'rose' }))));
  }
  if (v.caps.pregnancy || v.caps.postpartum) {
    const age = v.caps.pregnancy && !b.pregnancy?.reviewRequired ? b.pregnancy?.age : null;
    const e = v.caps.postpartum ? b.postpartum?.elapsed : null;
    return h('div', { class: 'cy-home' },
      age ? ring({ value: age.dayOfPregnancy, max: 280, size: 96, stroke: 10, color: 'var(--cy-luteal)', label: `${age.week}`, sub: 'კვირა' })
        : h('span', { class: 'tile ink-violet', style: { width: '52px', height: '52px' } }, icon('heart', { size: 24 })),
      h('div', { class: 'cy-home-main' },
        h('h3', null, v.caps.pregnancy ? 'ორსულობის რეჟიმი' : 'მშობიარობის შემდგომი თვალყური'),
        h('p', null, age ? `${age.week} კვირა + ${age.day} დღე · სავარაუდოდ` : e ? `${e.week} კვირა + ${e.day} დღე` : 'დღის აღრიცხვა ერთ ადგილას.'),
        h('div', null, open)));
  }
  const cycleLenRound = Math.round(v.cycleLen) || 28;
  const line = v.statusLine || (v.day != null && !v.hideLengthChrome ? `ციკლის ${v.day}-ე დღე · ${cycleLenRound}-დან` : 'ვსწავლობთ შენს რიტმს — აღრიცხე შემდეგი მენსტრუაცია');
  return h('div', { class: 'cy-home' },
    dialFor(b, v, { compact: true, describeDay: null }),
    h('div', { class: 'cy-home-main' },
      h('h3', null, v.phaseHint),
      h('p', null, line),
      v.next && v.forecastOn && !v.onPeriod ? h('div', null, predBadge(v.next)) : null,
      h('div', { style: { marginTop: '4px' } }, open)));
}
