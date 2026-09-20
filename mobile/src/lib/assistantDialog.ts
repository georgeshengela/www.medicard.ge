export function assistantDialogIntent(text: string): 'confirm' | 'cancel' | 'message' {
  const value = text.trim().replace(/[.!?։,;]+$/g, '').trim().replace(/\s+/g, ' ').toLowerCase();
  if (['კი', 'დიახ', 'შეინახე', 'დაადასტურე', 'კი შეინახე', 'დიახ შეინახე', 'კი დაადასტურე', 'გააგრძელე', 'ვეთანხმები'].includes(value)) return 'confirm';
  if (['არა', 'გააუქმე', 'გაუქმება', 'არა გააუქმე', 'არ შეინახო', 'შეჩერდი'].includes(value)) return 'cancel';
  return 'message'; // “Yes, but 200 instead of 250” is a correction, never a confirmation.
}
export function spokenAssistantReview(label: string, details: { label: string; value: string }[], opensPage: boolean) {
  const fields = details.filter(row => row.value).map(row => `${row.label}: ${row.value}.`).join(' ');
  const question = opensPage ? 'გავხსნა?' : 'დავადასტურო და შევინახო?';
  const content = `გავიგე. ${label}. ${fields}`;
  // Never cut a dose, amount, or negation mid-sentence to fit the voice limit.
  return content.length < 1600 ? `${content} ${question}` : `გავიგე. ${label}. დეტალები ეკრანზეა. გთხოვ, სრულად გადაამოწმე. ${question}`;
}
