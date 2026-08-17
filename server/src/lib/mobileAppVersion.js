import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let cachedVersion = null;
let cachedAt = 0;
const CACHE_MS = 30_000;

function resolveMobileAppJson() {
  const candidates = [
    path.resolve(__dirname, '../../../mobile/app.json'),
    path.resolve(__dirname, '../../mobile/app.json'),
    path.resolve(process.cwd(), 'mobile/app.json'),
    path.resolve(process.cwd(), '../mobile/app.json'),
  ];
  for (const file of candidates) {
    if (existsSync(file)) return file;
  }
  return null;
}

/** Current Expo app version from mobile/app.json (e.g. 4.1.2). */
export function getMobileAppVersion() {
  if (cachedVersion && Date.now() - cachedAt < CACHE_MS) return cachedVersion;

  const file = resolveMobileAppJson();
  if (!file) {
    cachedVersion = null;
    cachedAt = Date.now();
    return null;
  }

  try {
    const json = JSON.parse(readFileSync(file, 'utf8'));
    cachedVersion = json?.expo?.version ?? null;
  } catch {
    cachedVersion = null;
  }
  cachedAt = Date.now();
  return cachedVersion;
}

export function invalidateMobileAppVersionCache() {
  cachedVersion = null;
  cachedAt = 0;
}
