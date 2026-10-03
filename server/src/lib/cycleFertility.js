import { formatDateEn } from './cycleHonesty.js';

/**
 * TTC fertility observations. Does not change period / ovulation / fertile-window math.
 * Test results stay user-logged; they never become confirmed ovulation or pregnancy.
 */

export const CYCLE_TEST_RESULTS = ['negative', 'positive', 'unclear'];

export const CYCLE_TEST_RESULT_KA = {
  negative: 'უარყოფითი',
  positive: 'დადებითი',
  unclear: 'გაურკვეველი',
};

export const CYCLE_TEST_RESULT_EN = {
  negative: 'negative',
  positive: 'positive',
  unclear: 'unclear',
};

/**
 * Fertility rules for the cycle AI prompt. Logged tests, temperature, mucus and intimate fields are
 * never in the prompt (W3-5, registry rule `observationAiContextAllowed`), so the rules only keep the
 * model from inventing them or over-reading the calendar forecast (no fertile-window wording here:
 * a gated or hidden forecast must not be brought up by a rule).
 */
export const CYCLE_FERTILITY_AI_RULES = [
  'ნაყოფიერების პირადი დაკვირვებები და ინტიმური აღრიცხვები ამ პრომპტში არ არის — ნუ ივარაუდებ მათ და ნუ ჰკითხავ მათზე.',
  'ნუ დაისვამ ორსულობის დიაგნოზს და ნუ იტყვი „ორსულად ხარ“.',
  'ნუ გამოიანგარიშებ ჩასახვის ალბათობას, ნაყოფიერების პროცენტს ან „დადასტურებულ ოვულაციას“.',
];

export const CYCLE_FERTILITY_PARTNER_LEAK_KEYS = [
  'ovulationTest',
  'pregnancyTest',
  'bbt',
  'cervicalMucus',
  'sexualActivity',
  'libido',
  'intercourse',
];

export function isCycleTestResult(value) {
  return CYCLE_TEST_RESULTS.includes(value);
}

export function normalizeCycleTestResult(value) {
  if (value == null || value === '') return null;
  if (!isCycleTestResult(value)) {
    const err = new Error('invalid_cycle_test_result');
    err.status = 400;
    throw err;
  }
  return value;
}

export function formatCycleTestKa(value) {
  if (!isCycleTestResult(value)) return null;
  return CYCLE_TEST_RESULT_KA[value];
}

/** Test result label in the person's language ('ka' default). */
export function formatCycleTest(value, lang = 'ka') {
  if (!isCycleTestResult(value)) return null;
  return lang === 'en' ? CYCLE_TEST_RESULT_EN[value] : CYCLE_TEST_RESULT_KA[value];
}

export function fertilityObservationBits(log) {
  if (!log) return [];
  const bits = [];
  if (isCycleTestResult(log.ovulationTest)) {
    bits.push(`ოვულაციის ტესტი=${CYCLE_TEST_RESULT_KA[log.ovulationTest]}`);
  }
  if (isCycleTestResult(log.pregnancyTest)) {
    bits.push(`ორსულობის ტესტი=${CYCLE_TEST_RESULT_KA[log.pregnancyTest]}`);
  }
  if (log.bbt != null && Number.isFinite(Number(log.bbt))) {
    bits.push(`BBT=${Number(log.bbt)}`);
  }
  if (log.cervicalMucus) {
    bits.push(`ლორწო=${log.cervicalMucus}`);
  }
  return bits;
}

export function collectFertilityTests(logs = []) {
  const ovulationTests = [];
  const pregnancyTests = [];
  for (const log of logs) {
    if (isCycleTestResult(log.ovulationTest)) {
      ovulationTests.push({ date: log.date, result: log.ovulationTest, source: 'user_logged' });
    }
    if (isCycleTestResult(log.pregnancyTest)) {
      pregnancyTests.push({ date: log.date, result: log.pregnancyTest, source: 'user_logged' });
    }
  }
  ovulationTests.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  pregnancyTests.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  return { ovulationTests, pregnancyTests };
}

export function countBbtThisCycle(logs = [], lastPeriodStart) {
  if (!lastPeriodStart) {
    return logs.filter((l) => l.bbt != null && Number.isFinite(Number(l.bbt))).length;
  }
  return logs.filter(
    (l) => l.date >= lastPeriodStart && l.bbt != null && Number.isFinite(Number(l.bbt)),
  ).length;
}

export function buildTtcObservationCards({ logs = [], today, lastPeriodStart, lang = 'ka' } = {}) {
  const en = lang === 'en';
  const cards = [];
  const todayLog = logs.find((l) => l.date === today);
  if (isCycleTestResult(todayLog?.ovulationTest)) {
    cards.push({
      id: 'ttc_opk_logged',
      tone: 'fertile',
      title: en ? 'Ovulation test logged' : 'აღრიცხული ოვულაციის ტესტი',
      body: en
        ? `Today you logged a ${CYCLE_TEST_RESULT_EN[todayLog.ovulationTest]} ovulation test. This is a test result, not confirmed ovulation.`
        : `დღეს აღრიცხე ${CYCLE_TEST_RESULT_KA[todayLog.ovulationTest]} ოვულაციის ტესტი. ეს ტესტის შედეგია, არა დადგენილი ოვულაცია.`,
      action: null,
    });
  }
  const recentPositive = [...logs]
    .filter((l) => l.ovulationTest === 'positive' && l.date !== today)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
  if (!todayLog?.ovulationTest && recentPositive) {
    cards.push({
      id: 'ttc_opk_recent',
      tone: 'fertile',
      title: en ? 'Positive OPK logged' : 'აღრიცხული დადებითი OPK',
      body: en
        ? `You logged a positive ovulation test on ${formatDateEn(recentPositive.date)}. This does not confirm that ovulation happened.`
        : `დადებითი ოვულაციის ტესტი აღრიცხე ${recentPositive.date}-ზე. ეს არ ადასტურებს, რომ ოვულაცია მოხდა.`,
      action: null,
    });
  }
  const bbtDays = countBbtThisCycle(logs, lastPeriodStart);
  if (bbtDays > 0) {
    cards.push({
      id: 'ttc_bbt_count',
      tone: 'calm',
      title: en ? 'BBT logged' : 'აღრიცხული BBT',
      body: en
        ? `You have logged BBT on ${bbtDays} ${bbtDays === 1 ? 'day' : 'days'} this cycle. Temperature is an observation, not confirmation of ovulation.`
        : `ამ ციკლში BBT აღრიცხულია ${bbtDays} დღეს. ტემპერატურა დაკვირვებაა, არა ოვულაციის დადასტურება.`,
      action: null,
    });
  }
  const yesterday = today
    ? logs.find((l) => l.date < today && l.cervicalMucus)
      ? [...logs].filter((l) => l.date < today && l.cervicalMucus).sort((a, b) => String(b.date).localeCompare(String(a.date)))[0]
      : null
    : null;
  if (yesterday?.cervicalMucus === 'eggwhite') {
    cards.push({
      id: 'ttc_mucus_logged',
      tone: 'calm',
      title: en ? 'Cervical mucus logged' : 'აღრიცხული ლორწო',
      body: en
        ? 'Yesterday you logged egg-white cervical mucus. This is your observation, not confirmed fertility.'
        : `გუშინ აღრიცხე კვერცხის ცილისებრი ცერვიკალური ლორწო. ეს შენი დაკვირვებაა, არა დადგენილი ნაყოფიერება.`,
      action: null,
    });
  }
  if (isCycleTestResult(todayLog?.pregnancyTest)) {
    cards.push({
      id: 'ttc_preg_logged',
      tone: 'pregnancy',
      title: en ? 'Pregnancy test logged' : 'აღრიცხული ორსულობის ტესტი',
      body: en
        ? todayLog.pregnancyTest === 'positive'
          ? 'You logged a positive pregnancy test. Medicard does not confirm a pregnancy from this.'
          : todayLog.pregnancyTest === 'negative'
            ? 'You logged a negative pregnancy test. This is one result, not a final answer.'
            : 'You logged an unclear pregnancy test. It is neither positive nor negative.'
        : todayLog.pregnancyTest === 'positive'
          ? 'აღრიცხე დადებითი ორსულობის ტესტი. Medicard ამით ორსულობას არ ადასტურებს.'
          : todayLog.pregnancyTest === 'negative'
            ? 'აღრიცხე უარყოფითი ორსულობის ტესტი. ეს ერთი შედეგია, არა საბოლოო დასკვნა.'
            : 'აღრიცხე გაურკვეველი ორსულობის ტესტი. ეს არც დადებითია და არც უარყოფითი.',
      action: todayLog.pregnancyTest === 'positive' ? (en ? 'Consider pregnancy mode' : 'ორსულობის რეჟიმის განხილვა') : null,
    });
  }
  return cards.slice(0, 3);
}

export function fertilityHasExtras(log) {
  if (!log) return false;
  return (
    isCycleTestResult(log.ovulationTest) ||
    isCycleTestResult(log.pregnancyTest) ||
    log.bbt != null ||
    Boolean(log.cervicalMucus) ||
    log.sexualActivity != null ||
    log.libido != null
  );
}
