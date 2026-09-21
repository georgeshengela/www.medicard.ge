export function assistantDialogIntent(text: string): 'confirm' | 'cancel' | 'message' {
  const value = text.trim().replace(/[.!?։,;]+$/g, '').trim().replace(/\s+/g, ' ').toLowerCase();
  if (['კი', 'დიახ', 'შეინახე', 'დაადასტურე', 'კი შეინახე', 'დიახ შეინახე', 'კი დაადასტურე', 'გააგრძელე', 'ვეთანხმები'].includes(value)) return 'confirm';
  if (['არა', 'გააუქმე', 'გაუქმება', 'არა გააუქმე', 'არ შეინახო', 'შეჩერდი'].includes(value)) return 'cancel';
  return 'message'; // “Yes, but 200 instead of 250” is a correction, never a confirmation.
}
export function spokenAssistantReview(label: string, details: { label: string; value: string }[], opensPage: boolean) {
  const fields = details.filter(row => row.value).map(row => `${row.label}: ${row.value}.`).join(' ');
  const question = opensPage ? 'გავხსნა?' : 'შევინახო?';
  const content = `${label}. ${fields}`;
  // Never cut a dose, amount, or negation mid-sentence to fit the voice limit.
  return content.length < 1600 ? `${content} ${question}` : `გავიგე. ${label}. დეტალები ეკრანზეა. გთხოვ, სრულად გადაამოწმე. ${question}`;
}

/** Provider/schema internals must never become the user's form instructions. */
export function assistantFieldError(key: string, message: string, label: string): string {
  if (/[ა-ჰ]/u.test(message)) return label + ': ' + message;
  const hints: Record<string, string> = {
    dosage: 'ჩაწერე შენთვის დანიშნული დოზა.', medName: 'მიუთითე წამლის სახელი.',
    frequency: 'აირჩიე მიღების დროები 24-საათიანი ფორმატით.',
    startDate: 'აირჩიე კურსის დაწყების დღე.', endDate: 'გადაამოწმე დასრულების დღე.',
    courseDays: 'მიუთითე კურსის ხანგრძლივობა — 1-დან 365 დღემდე.',
  };
  return label + ': ' + (hints[key] || (/date|On|Ymd/i.test(key) ? 'მიუთითე სწორი თარიღი: წელი-თვე-დღე.' : 'შეავსე ან გადაამოწმე ეს ველი.'));
}
