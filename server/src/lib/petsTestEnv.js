export function isIsolatedPetsTestDatabase(url = process.env.DATABASE_URL || '') {
  try {
    const parsed = new URL(url);
    const db = parsed.pathname.replace(/^\//, '').split('?')[0];
    const host = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
    if (process.env.PETS_HTTP_TEST === '1' && host) return true;
    return host && parsed.port === '55432' && db === 'medicard_pets_phase7';
  } catch {
    return false;
  }
}

export function skipUnlessIsolatedPetsDb(t) {
  const url = process.env.DATABASE_URL || '';
  if (isIsolatedPetsTestDatabase(url)) return false;
  t.skip(
    'DATABASE_URL is not the isolated Pets test database (127.0.0.1:55432/medicard_pets_phase7); hosted Neon is not used for integration tests',
  );
  return true;
}
