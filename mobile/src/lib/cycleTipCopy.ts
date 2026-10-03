/**
 * „დღის რჩევები“ prose never repeats the cycle day: the strip, the ring and the tips' own context line
 * already show it. Server phase cards and Medi's AI cards often open with „დღეს ციკლის 14-ე დღეა.“ /
 * "Today is day 14 of your cycle." — this drops that opener and keeps the advice.
 *
 * Only a leading clause is removed (a day inside a sentence stays); if nothing would be left, the text
 * is returned unchanged. Pure: node tests load it.
 */

const KA_OPENER = /^\s*(?:დღეს\s+)?(?:შენი\s+)?ციკლის\s+(?:მე-)?\d{1,3}(?:-ე|-ლი)?\s+დღე(?:ა|ს)?\s*(?:[.,·:;—–-]\s*|$)/u;
const EN_OPENER =
  /^\s*(?:today\s+is\s+|it'?s\s+)?(?:day\s+\d{1,3}\s+of\s+(?:your|the)\s+cycle|cycle\s+day\s+\d{1,3}|day\s+\d{1,3})\s*(?:[.,·:;—–-]\s*|$)/i;

export function withoutCycleDayOpener(text: string): string {
  if (typeof text !== 'string' || !text) return text;
  for (const re of [KA_OPENER, EN_OPENER]) {
    const m = text.match(re);
    if (!m) continue;
    const rest = text.slice(m[0].length).trim();
    if (!rest) return text;
    return /^[a-z]/.test(rest) ? rest[0].toUpperCase() + rest.slice(1) : rest;
  }
  return text;
}
