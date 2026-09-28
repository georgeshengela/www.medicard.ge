/**
 * Split a plain-text mail into the new part and the quoted history that mail clients append
 * ("On Mon, … wrote:" / "… დაწერა:" / "> …" lines). The admin inbox shows only the new part and
 * folds the rest; the thread list preview uses the new part. Mirrors splitQuoted() in
 * server/admin/v4/modules/support.js — keep both in sync.
 */
const WROTE = /(wrote|писал\(?а?\)?|დაწერა|schrieb|a écrit|escribió)\s*:\s*$/i;
const HEADER_START = /^(on|am|le|el|\d{1,2}[./]|[\p{L}]{2,4},)\s/iu;

export function splitQuoted(text) {
  const lines = String(text ?? '').replace(/\r\n?/g, '\n').split('\n');
  let cut = -1;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (WROTE.test(line)) {
      // "On Mon, Sep 28 … <x@y>\nwrote:" is often wrapped over two lines.
      cut = i > 0 && !WROTE.test(lines[i - 1].trim()) && HEADER_START.test(lines[i - 1].trim()) && !HEADER_START.test(line) ? i - 1 : i;
      break;
    }
    if (/^-{2,}\s*(original message|forwarded message|пересылаемое|გადაგზავნილი)/i.test(line)) { cut = i; break; }
    if (line.startsWith('>') && lines.slice(i).every((l) => !l.trim() || l.trim().startsWith('>'))) { cut = i; break; }
  }
  if (cut <= 0) return { main: String(text ?? '').trim(), quoted: '' };
  return { main: lines.slice(0, cut).join('\n').trim(), quoted: lines.slice(cut).join('\n').trim() };
}

/** One-line preview of a mail: the new part only, whitespace collapsed. */
export function previewText(text, max = 160) {
  const { main } = splitQuoted(text);
  return main.replace(/\s+/g, ' ').trim().slice(0, max);
}
