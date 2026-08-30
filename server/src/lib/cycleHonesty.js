/**
 * Cycle medical-copy helpers. Does not change prediction math.
 * Observed logs stay facts. Derived timing must stay estimated.
 */

export function cycleHonestyFlags({
  confidence = 'low',
  isIrregular = false,
  conditions = [],
} = {}) {
  const list = Array.isArray(conditions) ? conditions.map(String) : [];
  const pcos = list.includes('pcos');
  const irregular = Boolean(isIrregular);
  const level = confidence === 'high' || confidence === 'medium' ? confidence : 'low';
  const cautious = level === 'low' || irregular || pcos;
  return {
    confidence: level,
    irregular,
    pcos,
    cautious,
    conditions: list,
  };
}

export function nextPeriodEstimateBody(date, flags) {
  if (!date) return 'სავარაუდო შემდეგი მენსტრუაციის თარიღი ჯერ არ არის.';
  if (flags.cautious) {
    return `სავარაუდო თარიღი დაახლოებით ${date}. ბოლო ციკლები იცვლება ან შეფასება ნაკლებად საიმედოა — თარიღი შეიძლება შეიცვალოს.`;
  }
  if (flags.confidence === 'medium') {
    return `სავარაუდო თარიღი დაახლოებით ${date}. დრო შეიძლება ოდნავ გადაიწიოს.`;
  }
  return `სავარაუდო თარიღი დაახლოებით ${date} — ბოლო ციკლების მიხედვით.`;
}

export function ttcWindowBody(predictions, flags) {
  const start = predictions?.fertileWindow?.start ?? '—';
  const end = predictions?.fertileWindow?.end ?? '—';
  const ovulation = predictions?.ovulationDate ?? '—';
  if (flags.pcos || flags.cautious) {
    return `სავარაუდო ნაყოფიერი ფანჯარა დაახლოებით ${start} – ${end}. ოვულაციის შეფასება (${ovulation}) ნაკლებად საიმედოა. ეს არ ადასტურებს ოვულაციას და არ არის კონტრაცეფცია.`;
  }
  return `სავარაუდო ნაყოფიერი ფანჯარა დაახლოებით ${start} – ${end}. სავარაუდო ოვულაცია: ${ovulation}. ეს კალენდარული შეფასებაა, არა დადგენილი ნაყოფიერება.`;
}

export function latePeriodAlertKa() {
  return 'მენსტრუაცია მიმდინარე შეფასებაზე გვიანია. თუ გაწუხებთ, მიმართეთ ექიმს.';
}

export function irregularLengthAlertKa(lastGap) {
  return `ბოლო აღრიცხული ციკლი ${lastGap} დღეა. ხშირი დიაპაზონი 21–35 დღეა — ეს არ არის დიაგნოზი.`;
}

export function pcosCautionKa() {
  return 'თქვენ მიუთითეთ PCOS — სავარაუდო ოვულაცია და ნაყოფიერი ფანჯარა ნაკლებად საიმედოა. Medicard არ არის კონტრაცეფციის მეთოდი.';
}

export function ttcReminderTone(flags) {
  return flags.cautious ? 'cautious' : 'estimated';
}

export function emptyCycleAiCache() {
  return { aiInsights: null, aiInsightsAt: null };
}

export const CYCLE_AI_HONESTY_RULES = [
  'შეფასება არ წარმოადგინო როგორც დადგენილი ბიოლოგიური ფაქტი.',
  'ნუ დაისვამ დიაგნოზს და ნუ გამოიცნობ ორსულობას ან ახალ მდგომარეობას.',
  'ნუ თქვი, რომ ოვულაცია მოხდა.',
  'კორელაცია არ არის მიზეზი.',
  'მწირი მონაცემისას თქვი ეს; ნუ გამოიგონებ პერსონალურ პატერნს.',
  'Medicard არ არის კონტრაცეფციის მეთოდი.',
  'შემაშფოთებელ სიმპტომებზე ურჩიე ექიმი, არა დიაგნოზი.',
];
