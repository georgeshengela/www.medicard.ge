/**
 * Pure helpers for the support inbox: addresses, subjects, Message-ID chains, auto-reply
 * detection and reply headers. No I/O here — everything is unit-tested.
 */
import { normalizeEmail, SYNTHETIC_EMAIL_DOMAIN } from '../email/address.js';

export const OWN_DOMAIN = 'medicard.ge';

/** Our own mail domain (and its subdomains, except the synthetic phone-login one). */
export function isOwnDomain(email) {
  const e = normalizeEmail(email);
  const domain = e.slice(e.lastIndexOf('@') + 1);
  if (!domain || !e.includes('@')) return false;
  if (domain === SYNTHETIC_EMAIL_DOMAIN) return false;
  return domain === OWN_DOMAIN || domain.endsWith(`.${OWN_DOMAIN}`);
}

const oneLine = (v) => String(v ?? '').replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim();

/** `"Nino B." <Nino@Example.com>` | `Nino <n@x>` | `n@x` → { email (lowercase), name }. */
export function parseAddress(raw) {
  const s = oneLine(Array.isArray(raw) ? raw[0] : raw);
  if (!s) return { email: '', name: '' };
  const angle = s.match(/^(.*)<\s*([^<>\s]+@[^<>\s]+)\s*>\s*$/);
  if (angle) {
    const name = angle[1].trim().replace(/^"(.*)"$/, '$1').replace(/\\"/g, '"').trim();
    return { email: normalizeEmail(angle[2]).slice(0, 254), name: name.slice(0, 120) };
  }
  const bare = s.match(/[^\s<>"',;]+@[^\s<>"',;]+/);
  return { email: bare ? normalizeEmail(bare[0]).slice(0, 254) : '', name: '' };
}

/** Array or comma-separated header value → addresses (commas inside quotes are respected). */
export function parseAddressList(value) {
  const parts = [];
  const push = (p) => { const a = parseAddress(p); if (a.email) parts.push(a); };
  if (Array.isArray(value)) value.slice(0, 50).forEach(push);
  else if (value) {
    let cur = '';
    let quoted = false;
    let angled = false;
    for (const ch of String(value)) {
      if (ch === '"') quoted = !quoted;
      if (ch === '<') angled = true;
      if (ch === '>') angled = false;
      if (ch === ',' && !quoted && !angled) { push(cur); cur = ''; } else cur += ch;
    }
    push(cur);
  }
  return parts.slice(0, 50);
}

// Re: / Fwd: / AW: / WG: / SV: / VS: / TR: / RIF: / ODP: / ANTW: / YNT:, also "Re[2]:" and full-width colon.
const PREFIX_RE = /^\s*(?:(?:re|fw|fwd|aw|wg|sv|vs|tr|rif|odp|antw|ynt)\s*(?:\[\d+\])?\s*[:：]\s*)+/i;

export function normalizeSubject(subject) {
  let s = oneLine(subject);
  for (let i = 0; i < 10 && PREFIX_RE.test(s); i += 1) s = s.replace(PREFIX_RE, '').trim();
  return s;
}

export function subjectKey(subject) {
  return normalizeSubject(subject).toLowerCase().slice(0, 200);
}

export function replySubject(subject) {
  const s = oneLine(subject);
  if (/^re\s*:/i.test(s)) return s.slice(0, 200);
  return `Re: ${normalizeSubject(s) || 'შენი წერილი'}`.slice(0, 200);
}

/** `<a@b> <c@d>` (any separators) → ['<a@b>', '<c@d>'] — at most 50. */
export function parseMessageIds(value) {
  const src = Array.isArray(value) ? value.join(' ') : String(value ?? '');
  return [...new Set(src.match(/<[^<>\s]{3,250}>/g) || [])].slice(0, 50);
}

/** Case-insensitive header lookup over Resend's headers object (values may be arrays). */
export function headerValue(headers, name) {
  if (!headers || typeof headers !== 'object') return '';
  const want = name.toLowerCase();
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === want) return Array.isArray(v) ? v.map(String).join(' ') : String(v ?? '');
  }
  return '';
}

/**
 * Mail that must never trigger an owner notice (and never an answer): RFC 3834 Auto-Submitted,
 * Precedence bulk/junk/list/auto_reply, X-Autoreply/X-Autorespond, mailing lists, daemons,
 * no-reply senders and anything sent from our own domain (loop protection).
 */
export function isAutoMessage({ headers, fromEmail } = {}) {
  const auto = headerValue(headers, 'auto-submitted').trim().toLowerCase();
  if (auto && auto !== 'no') return true;
  if (/\b(bulk|junk|list|auto_reply)\b/i.test(headerValue(headers, 'precedence'))) return true;
  if (headerValue(headers, 'x-autoreply') || headerValue(headers, 'x-autorespond')) return true;
  if (headerValue(headers, 'list-id') || headerValue(headers, 'list-unsubscribe')) return true;
  const from = normalizeEmail(fromEmail);
  if (/^(mailer-daemon|postmaster|no-?reply|do-?not-?reply|bounces?)([+.@-])/i.test(from)) return true;
  return isOwnDomain(from);
}

const HEADER_SAFE = (v) => String(v ?? '').replace(/[\r\n]+/g, ' ').trim();

/**
 * Threading headers for a reply to the latest inbound message (RFC 5322 §3.6.4): In-Reply-To is
 * its Message-ID; References is its References (or In-Reply-To) plus its Message-ID. Long chains
 * keep the root and the 19 most recent ids.
 */
export function buildReplyHeaders(lastInbound) {
  if (!lastInbound?.messageId) return {};
  const own = parseMessageIds(lastInbound.messageId)[0];
  if (!own) return {};
  let refs = parseMessageIds(lastInbound.references);
  if (!refs.length) refs = parseMessageIds(lastInbound.inReplyTo);
  refs = [...refs.filter((id) => id !== own), own];
  if (refs.length > 20) refs = [refs[0], ...refs.slice(-19)];
  return { 'In-Reply-To': HEADER_SAFE(own), References: HEADER_SAFE(refs.join(' ')) };
}

/** Our mailbox that received the mail (first @medicard.ge in To, Cc, received_for). */
export function pickMailbox(...lists) {
  for (const list of lists) for (const a of list || []) if (isOwnDomain(a.email)) return a.email;
  return null;
}
