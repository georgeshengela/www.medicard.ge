/**
 * Postgres TEXT and JSONB cannot hold a NUL character. One in a lab PDF's text layer made
 * `POST /api/ai/extract-lab` fail with 22021 „invalid byte sequence for encoding UTF8: 0x00“
 * (2026-10-13), so text read from files or written by AI models drops it before it is saved.
 */
export function stripNul(text) {
  return typeof text === 'string' && text.includes('\u0000') ? text.replaceAll('\u0000', '') : text;
}
