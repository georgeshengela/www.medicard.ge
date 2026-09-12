/** Map stored `/uploads/<uuid>.ext` keys to the authenticated file route. */

const FILENAME_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp|gif|pdf|bin)$/i;

export function privateFileFilename(storedPath) {
  if (!storedPath || typeof storedPath !== 'string') return null;
  if (storedPath.startsWith('http://') || storedPath.startsWith('https://')) {
    try {
      const host = new URL(storedPath).pathname;
      const name = host.split('/').pop() || '';
      return FILENAME_RE.test(name) ? name : null;
    } catch {
      return null;
    }
  }
  const name = storedPath.split('?')[0].replace(/\\/g, '/').split('/').pop() || '';
  return FILENAME_RE.test(name) ? name : null;
}

export function privateFileRequestPath(storedPath) {
  const name = privateFileFilename(storedPath);
  return name ? `/api/files/${name}` : null;
}

export function privateFileImageSource(storedPath, token, origin) {
  const requestPath = privateFileRequestPath(storedPath);
  if (!requestPath || !token) return null;
  if (String(storedPath).toLowerCase().endsWith('.pdf')) return null;
  const base = String(origin || '').replace(/\/$/, '');
  return {
    uri: `${base}${requestPath}`,
    headers: { Authorization: `Bearer ${token}` },
  };
}
