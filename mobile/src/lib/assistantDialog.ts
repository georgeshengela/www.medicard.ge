import { tx } from '../i18n/locale.js';

export function assistantDialogIntent(text: string): 'confirm' | 'cancel' | 'message' {
  const value = text.trim().replace(/[.!?։,;]+$/g, '').trim().replace(/\s+/g, ' ').toLowerCase();
  if (['კი', 'დიახ', 'შეინახე', 'დაადასტურე', 'კი შეინახე', 'დიახ შეინახე', 'კი დაადასტურე', 'გააგრძელე', 'ვეთანხმები', 'yes', 'yeah', 'yep', 'save', 'confirm', 'yes save', 'yes confirm', 'continue', 'i agree', 'save it'].includes(value)) return 'confirm';
  if (['არა', 'გააუქმე', 'გაუქმება', 'არა გააუქმე', 'არ შეინახო', 'შეჩერდი', 'no', 'nope', 'cancel', 'no cancel', "don't save", 'stop'].includes(value)) return 'cancel';
  return 'message'; // “Yes, but 200 instead of 250” is a correction, never a confirmation.
}
export function spokenAssistantReview(label: string, details: { label: string; value: string }[], opensPage: boolean) {
  const fields = details.filter(row => row.value).map(row => `${row.label}: ${row.value}.`).join(' ');
  const question = opensPage ? tx('გავხსნა?', 'Shall I open it?') : tx('შევინახო?', 'Shall I save it?');
  const content = `${label}. ${fields}`;
  // Never cut a dose, amount, or negation mid-sentence to fit the voice limit.
  return content.length < 1600 ? `${content} ${question}` : tx(`გავიგე. ${label}. დეტალები ეკრანზეა. გთხოვ, სრულად გადაამოწმე. ${question}`, `Got it. ${label}. The details are on the screen. Please check them fully. ${question}`);
}

/** Provider/schema internals must never become the user's form instructions. */
export function assistantFieldError(key: string, message: string, label: string): string {
  if (/[ა-ჰ]/u.test(message)) return label + ': ' + message;
  const hints: Record<string, string> = {
    dosage: tx('ჩაწერე შენთვის დანიშნული დოზა.', 'Enter the dose you were prescribed.'), medName: tx('მიუთითე წამლის სახელი.', 'Enter the medication name.'),
    frequency: tx('აირჩიე მიღების დროები 24-საათიანი ფორმატით.', 'Choose dose times in 24-hour format.'),
    startDate: tx('აირჩიე კურსის დაწყების დღე.', 'Choose the day the course starts.'), endDate: tx('გადაამოწმე დასრულების დღე.', 'Check the end date.'),
    courseDays: tx('მიუთითე კურსის ხანგრძლივობა — 1-დან 365 დღემდე.', 'Enter the course length — from 1 to 365 days.'),
  };
  return label + ': ' + (hints[key] || (/date|On|Ymd/i.test(key) ? tx('მიუთითე სწორი თარიღი: წელი-თვე-დღე.', 'Enter a valid date: year-month-day.') : tx('შეავსე ან გადაამოწმე ეს ველი.', 'Fill in or check this field.')));
}
