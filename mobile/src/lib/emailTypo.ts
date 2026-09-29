/**
 * "Did you mean …@icloud.com?" — catches common domain typos before an account is created with an
 * address that can never receive mail (2026-09-29: an account was registered as …@icoud.com and
 * its password reset silently went nowhere). Suggestion only; the person decides.
 */
const KNOWN = ['gmail.com', 'icloud.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'mail.ru', 'live.com', 'me.com', 'yandex.ru', 'mail.ge'];

const EXPLICIT: Record<string, string> = {
  'icoud.com': 'icloud.com',
  'iclod.com': 'icloud.com',
  'icloud.co': 'icloud.com',
  'icloud.con': 'icloud.com',
  'iclould.com': 'icloud.com',
  'gmial.com': 'gmail.com',
  'gmai.com': 'gmail.com',
  'gmal.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gmail.co': 'gmail.com',
  'gmail.con': 'gmail.com',
  'gmail.cm': 'gmail.com',
  'gmaill.com': 'gmail.com',
  'yahooo.com': 'yahoo.com',
  'yaho.com': 'yahoo.com',
  'hotmial.com': 'hotmail.com',
  'hotmal.com': 'hotmail.com',
  'outlok.com': 'outlook.com',
};

function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const next = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = next;
    }
  }
  return row[b.length];
}

/** Returns the corrected full address, or null when the domain looks fine / unknown. */
export function suggestEmailFix(raw: string): string | null {
  const email = String(raw || '').trim().toLowerCase();
  const at = email.lastIndexOf('@');
  if (at < 1 || at === email.length - 1) return null;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (KNOWN.includes(domain)) return null;
  const explicit = EXPLICIT[domain];
  if (explicit) return `${local}@${explicit}`;
  // One edit away from a big provider (icloud.cmo, gmail.vom …).
  let best: string | null = null;
  for (const known of KNOWN) {
    if (distance(domain, known) === 1) {
      if (best) return null; // ambiguous
      best = known;
    }
  }
  return best ? `${local}@${best}` : null;
}
