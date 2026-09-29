/** Georgian mobile numbers: 9 local digits starting with 5, shown as `555 12 34 56`. */

/** Local digits from anything typed or pasted: "+995 555-12-34-56", "995555123456", "555 12 34 56". */
export function georgianLocalDigits(text: string): string {
  let digits = String(text || '').replace(/\D/g, '');
  // Local numbers start with 5, so a leading 9955… is always the country code (typed or pasted).
  if (digits.startsWith('9955') || (digits.length > 9 && digits.startsWith('995'))) digits = digits.slice(3);
  return digits.slice(0, 9);
}

/** `555123456` → `555 12 34 56` (partial input formats as it grows). */
export function formatGeorgianMobile(localDigits: string): string {
  const d = georgianLocalDigits(localDigits);
  const parts = [d.slice(0, 3), d.slice(3, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean);
  return parts.join(' ');
}

export function isGeorgianMobile(localDigits: string): boolean {
  return /^5\d{8}$/.test(georgianLocalDigits(localDigits));
}

/** `+995555123456` for the API. */
export function toE164Georgian(localDigits: string): string {
  return `+995${georgianLocalDigits(localDigits)}`;
}

/** `+995 555 12 34 56` for display. */
export function displayGeorgianMobile(localDigits: string): string {
  return `+995 ${formatGeorgianMobile(localDigits)}`;
}
