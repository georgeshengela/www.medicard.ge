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

const MONTHS_KA = ['იანვარი', 'თებერვალი', 'მარტი', 'აპრილი', 'მაისი', 'ივნისი', 'ივლისი', 'აგვისტო', 'სექტემბერი', 'ოქტომბერი', 'ნოემბერი', 'დეკემბერი'];
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const isEn = (lang) => lang === 'en';

/** '2026-10-10' → '10 ოქტომბერი 2026' (user-facing copy never shows ISO keys). */
export function formatDateKa(key) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key ?? ''));
  if (!m) return key ?? '—';
  return `${Number(m[3])} ${MONTHS_KA[Number(m[2]) - 1]} ${m[1]}`;
}

/** '2026-10-10' → '10 October 2026' (English counterpart of formatDateKa). */
export function formatDateEn(key) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key ?? ''));
  if (!m) return key ?? '—';
  return `${Number(m[3])} ${MONTHS_EN[Number(m[2]) - 1]} ${m[1]}`;
}

/** Date key → user-facing date in the person's language ('ka' default). */
export function formatCycleDate(key, lang = 'ka') {
  return isEn(lang) ? formatDateEn(key) : formatDateKa(key);
}

export function nextPeriodEstimateBody(date, flags, lang = 'ka') {
  const en = isEn(lang);
  if (!date) {
    return en ? 'There is no estimated next period date yet.' : 'სავარაუდო შემდეგი მენსტრუაციის თარიღი ჯერ არ არის.';
  }
  date = formatCycleDate(date, lang);
  if (flags.cautious) {
    return en
      ? `Estimated date: around ${date}. Your recent cycles vary or the estimate is less reliable, so the date may change.`
      : `სავარაუდო თარიღი დაახლოებით ${date}. ბოლო ციკლები იცვლება ან შეფასება ნაკლებად საიმედოა — თარიღი შეიძლება შეიცვალოს.`;
  }
  if (flags.confidence === 'medium') {
    return en
      ? `Estimated date: around ${date}. The timing may shift a little.`
      : `სავარაუდო თარიღი დაახლოებით ${date}. დრო შეიძლება ოდნავ გადაიწიოს.`;
  }
  return en
    ? `Estimated date: around ${date}, based on your recent cycles.`
    : `სავარაუდო თარიღი დაახლოებით ${date} — ბოლო ციკლების მიხედვით.`;
}

export function ttcWindowBody(predictions, flags, lang = 'ka') {
  const en = isEn(lang);
  const start = predictions?.fertileWindow?.start ? formatCycleDate(predictions.fertileWindow.start, lang) : '—';
  const end = predictions?.fertileWindow?.end ? formatCycleDate(predictions.fertileWindow.end, lang) : '—';
  // Ovulation is a 3-day band (brief §8.2 item 5), never one date.
  const band = predictions?.ovulationRange;
  const ovulation = band?.start && band?.end
    ? `${formatCycleDate(band.start, lang)} – ${formatCycleDate(band.end, lang)}`
    : predictions?.ovulationDate
      ? formatCycleDate(predictions.ovulationDate, lang)
      : '—';
  const source = predictions?.fertility?.ovulationSource;
  const sourceNote = source === 'manual'
    ? (en ? ' (from your own mark)' : ' (შენი აღნიშვნით)')
    : source === 'opk'
      ? (en ? ' (based on your OPK)' : ' (OPK-ის მიხედვით)')
      : source === 'temperature'
        ? (en ? ' (from your temperature · in hindsight)' : ' (ტემპერატურის მიხედვით · რეტროსპექტულად)')
        : '';
  if (predictions?.fertility?.window === 'wide') {
    // Trying to conceive before 3 completed cycles: one wide window, no ovulation day (brief §9 item 13).
    return en
      ? `Estimated fertile days: around ${start} – ${end}. A wide range until we have counted 3 cycles — it narrows as you log. This is a calendar estimate, not confirmed fertility.`
      : `სავარაუდო ნაყოფიერი დღეები დაახლოებით ${start} – ${end}. ფართო დიაპაზონი, სანამ 3 ციკლს დავითვლით — აღრიცხვასთან ერთად დავიწროვდება. ეს კალენდარული შეფასებაა, არა დადგენილი ნაყოფიერება.`;
  }
  if (flags.pcos || flags.cautious) {
    return en
      ? `Estimated fertile window: around ${start} – ${end}. The ovulation estimate (${ovulation}${sourceNote}) is less reliable. This does not confirm ovulation and is not contraception.`
      : `სავარაუდო ნაყოფიერი ფანჯარა დაახლოებით ${start} – ${end}. ოვულაციის შეფასება (${ovulation}${sourceNote}) ნაკლებად საიმედოა. ეს არ ადასტურებს ოვულაციას და არ არის კონტრაცეფცია.`;
  }
  return en
    ? `Estimated fertile window: around ${start} – ${end}. Likely ovulation: ${ovulation}${sourceNote}. This is a calendar estimate, not confirmed fertility.`
    : `სავარაუდო ნაყოფიერი ფანჯარა დაახლოებით ${start} – ${end}. სავარაუდო ოვულაცია: ${ovulation}${sourceNote}. ეს კალენდარული შეფასებაა, არა დადგენილი ნაყოფიერება.`;
}

export function latePeriodAlertKa(lang = 'ka') {
  return isEn(lang)
    ? 'Your period is late compared with your recent pattern. This is an estimate, not a diagnosis. If you are worried, see a doctor.'
    : 'მენსტრუაცია ბოლო პატერნზე გვიანია. ეს შეფასებაა, არა დიაგნოზი. თუ გაწუხებს, მიმართე ექიმს.';
}

export function irregularLengthAlertKa(lastGap, lang = 'ka') {
  return isEn(lang)
    ? `Your last logged cycle was ${lastGap} ${lastGap === 1 ? 'day' : 'days'}. A common range is 21–35 days. This is not a diagnosis.`
    : `ბოლო აღრიცხული ციკლი ${lastGap} დღეა. ხშირი დიაპაზონი 21–35 დღეა — ეს არ არის დიაგნოზი.`;
}

export function pcosCautionKa(lang = 'ka') {
  return isEn(lang)
    ? 'You told us you have PCOS, so estimated ovulation and the fertile window are less reliable. Medicard is not a method of contraception.'
    : 'შენ მიუთითე PCOS — სავარაუდო ოვულაცია და ნაყოფიერი ფანჯარა ნაკლებად საიმედოა. Medicard არ არის კონტრაცეფციის მეთოდი.';
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

export const CYCLE_CONTRACEPTION_AI_RULES = [
  'კონტრაცეფცია არის SELF_REPORTED პროფილი, არა გაზომილი ბიოლოგია.',
  'ნუ თქვი, რომ მომხმარებელი დაცულია ორსულობისგან.',
  'ნუ დაითვლი კონტრაცეფციის ეფექტურობას და ნუ დაასახელებ პროცენტებს.',
  'ნუ უწოდებ კალენდარულ დღეებს უსაფრთხოს ან დაბალ რისკად.',
  'ნუ დაადასტურებ ოვულაციის ჩახშობას.',
  'ნუ ურჩევ კონტრაცეფციის შეწყვეტას.',
  'ნუ მისცემ გამოტოვებული დოზის ინსტრუქციას — მიმართე ფურცელს, ფარმაცევტს ან ექიმს.',
  'Medicard არ არის სერტიფიცირებული fertility-awareness სისტემა.',
];

export const CYCLE_OBSERVATION_AI_RULES = [
  'ტკივილი არის მომხმარებლის აღრიცხვა, არა დიაგნოზი.',
  'სიმძიმე სუბიექტურია.',
  'ნუ დაისვამ ენდომეტრიოზს, PCOS-ს ან სხვა მიზეზს ტკივილიდან.',
  'კორელაცია არ არის მიზეზი.',
  'ნუ გამოიყენებ დღიურის თავისუფალ ტექსტს — ის პრომპტში არ არის.',
  'ნუ გამოიყენებ მომხმარებლის ნიშნებს — ისინი პრომპტში არ არის.',
];

export const CYCLE_HISTORY_AI_RULES = [
  'HISTORICAL_LOG_PATTERN არის აღრიცხული ისტორია, არა დიაგნოზი და არა მიზეზი.',
  'ყოველთვის დაიტოვე ნიმუშის ზომა (N ციკლიდან M).',
  'ნუ უწოდებ PMS-ს კლინიკურ დიაგნოზს.',
  'ნუ იტყვი, რომ სხეული ყოველთვის ასე იქცევა.',
  'ნუ გამოიყენებ დღიურს ან მომხმარებლის ნიშნებს.',
];
