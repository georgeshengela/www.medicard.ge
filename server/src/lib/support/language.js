/**
 * Is a support mail written in Georgian? Decides the language of the Director's acknowledgement
 * and replies and the email chrome (footer, links) of every support answer. Pure, unit-tested.
 */
import { splitQuoted } from './quote.js';
import { normalizeSubject } from './threading.js';

const GEORGIAN = /[\u10A0-\u10FF\u1C90-\u1CBF\u2D00-\u2D2F]/u;
const WORD = /\p{L}+/gu;
// Where the sender's own words end: a "-- " signature or Outlook-style history ("____" / "From: x@y").
const OWN_END = /^(?:--|_{8,}|from\s*:.*@.*)$/i;
const CLIENT_FOOTER = /^(?:sent from|sent via|get outlook for|отправлено (?:с|из))\b/i;
/** Share of Georgian words from which a mail counts as Georgian: a Georgian name in an English letter does not. */
export const GEORGIAN_SHARE = 0.25;

/**
 * Judged from the writer's own words in the body (quoted history, signature and "Sent from my
 * iPhone" aside), or from the subject when the body has none. Nothing to judge → Georgian.
 */
export function writesGeorgian({ subject = '', text = '' } = {}) {
  const lines = splitQuoted(text).main.split('\n').map((l) => l.trim());
  const end = lines.findIndex((l) => OWN_END.test(l));
  const own = (end >= 0 ? lines.slice(0, end) : lines).filter((l) => !l.startsWith('>') && !CLIENT_FOOTER.test(l)).join('\n');
  for (const s of [own, normalizeSubject(subject)]) {
    const words = s.match(WORD) || [];
    if (words.length) return words.filter((w) => GEORGIAN.test(w)).length / words.length >= GEORGIAN_SHARE;
  }
  return true;
}

/** Email chrome language for a mail with this body: 'ka', or 'en' for anything else. */
export const mailLang = (text) => (writesGeorgian({ text }) ? 'ka' : 'en');
