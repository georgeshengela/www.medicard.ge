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

export const CYCLE_FERTILITY_AI_RULES = [
  'დადებითი ოვულაციის ტესტი (OPK) არ ადასტურებს, რომ ოვულაცია მოხდა — ეს მომხმარებლის აღრიცხული ტესტის შედეგია.',
  'BBT-ის ერთი ან რამდენიმე გაზომვა არ ადასტურებს ოვულაციას.',
  'ცერვიკალური ლორწო დაკვირვებაა, არა ნაყოფიერების დიაგნოზი.',
  'ორსულობის ტესტის შედეგი მომხმარებლის აღრიცხვაა — ნუ დაისვამ ორსულობის დიაგნოზს და ნუ იტყვი „ორსულად ხარ“.',
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

export function buildTtcObservationCards({ logs = [], today, lastPeriodStart } = {}) {
  const cards = [];
  const todayLog = logs.find((l) => l.date === today);
  if (isCycleTestResult(todayLog?.ovulationTest)) {
    cards.push({
      id: 'ttc_opk_logged',
      tone: 'fertile',
      title: 'აღრიცხული ოვულაციის ტესტი',
      body: `დღეს აღრიცხეთ ${CYCLE_TEST_RESULT_KA[todayLog.ovulationTest]} ოვულაციის ტესტი. ეს ტესტის შედეგია, არა დადგენილი ოვულაცია.`,
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
      title: 'აღრიცხული დადებითი OPK',
      body: `დადებითი ოვულაციის ტესტი აღრიცხეთ ${recentPositive.date}-ზე. ეს არ ადასტურებს, რომ ოვულაცია მოხდა.`,
      action: null,
    });
  }
  const bbtDays = countBbtThisCycle(logs, lastPeriodStart);
  if (bbtDays > 0) {
    cards.push({
      id: 'ttc_bbt_count',
      tone: 'calm',
      title: 'აღრიცხული BBT',
      body: `ამ ციკლში BBT აღრიცხულია ${bbtDays} დღეს. ტემპერატურა დაკვირვებაა, არა ოვულაციის დადასტურება.`,
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
      title: 'აღრიცხული ლორწო',
      body: `გუშინ აღრიცხეთ კვერცხის ცილისებრი ცერვიკალური ლორწო. ეს თქვენი დაკვირვებაა, არა დადგენილი ნაყოფიერება.`,
      action: null,
    });
  }
  if (isCycleTestResult(todayLog?.pregnancyTest)) {
    cards.push({
      id: 'ttc_preg_logged',
      tone: 'pregnancy',
      title: 'აღრიცხული ორსულობის ტესტი',
      body:
        todayLog.pregnancyTest === 'positive'
          ? 'აღრიცხეთ დადებითი ორსულობის ტესტი. Medicard ამით ორსულობას არ ადასტურებს.'
          : todayLog.pregnancyTest === 'negative'
            ? 'აღრიცხეთ უარყოფითი ორსულობის ტესტი. ეს ერთი შედეგია, არა საბოლოო დასკვნა.'
            : 'აღრიცხეთ გაურკვეველი ორსულობის ტესტი. ეს არც დადებითია და არც უარყოფითი.',
      action: todayLog.pregnancyTest === 'positive' ? 'ორსულობის რეჟიმის განხილვა' : null,
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
