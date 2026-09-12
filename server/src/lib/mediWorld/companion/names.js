const DEFAULT_NAME = 'Medi';
const MAX_CHARS = 32;
const DENY = /^(null|undefined|admin|system|nightingale|nigger|faggot|fuck|shit)$/i;

function stripControls(text) {
  return String(text || '')
    .normalize('NFC')
    .replace(/[\p{Cc}\p{Cf}\p{Cs}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function sanitizeCompanionDisplayName(raw) {
  const cleaned = stripControls(raw);
  if (!cleaned) return { name: DEFAULT_NAME, defaulted: true };
  const chars = [...cleaned];
  const clipped = chars.slice(0, MAX_CHARS).join('');
  if (DENY.test(clipped)) {
    const error = new Error('That name cannot be used.');
    error.status = 400;
    error.code = 'COMPANION_NAME_INVALID';
    throw error;
  }
  return { name: clipped, defaulted: false };
}

export function publicCompanionName(displayName) {
  const cleaned = stripControls(displayName);
  return cleaned || DEFAULT_NAME;
}

export { DEFAULT_NAME as DEFAULT_COMPANION_NAME, MAX_CHARS as COMPANION_NAME_MAX };
