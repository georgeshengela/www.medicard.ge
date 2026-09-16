/**
 * Chat markdown may emit hrefs. Only http(s) may leave the app.
 * javascript:/data:/file: and scheme-relative junk stay closed.
 */
export function isSafeExternalHref(href) {
  const raw = String(href || '').trim();
  if (!raw) return false;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}
