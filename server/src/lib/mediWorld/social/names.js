const DISPLAY_MAX = 24;
const BIO_MAX = 80;
const DENY = /^(null|undefined|admin|system|nightingale|nigger|faggot|fuck|shit)$/i;
const LINK = /(https?:\/\/|www\.|[\w.-]+\.(com|ge|org|net|io)\b)/i;

function stripControls(text) {
  return String(text || '')
    .normalize('NFC')
    .replace(/[\p{Cc}\p{Cf}\p{Cs}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function rejectMedicalCue(text) {
  return /(diagnos|symptom|lab result|pregnant|cycle day|blood pressure|weight kg|medication)/i.test(text);
}

export function sanitizeSocialDisplayName(raw) {
  const cleaned = stripControls(raw);
  if (!cleaned) {
    const error = new Error('Choose a game name.');
    error.status = 400;
    error.code = 'SOCIAL_NAME_REQUIRED';
    throw error;
  }
  const clipped = [...cleaned].slice(0, DISPLAY_MAX).join('');
  if (DENY.test(clipped) || LINK.test(clipped) || rejectMedicalCue(clipped)) {
    const error = new Error('That name cannot be used.');
    error.status = 400;
    error.code = 'SOCIAL_NAME_INVALID';
    throw error;
  }
  return clipped;
}

export function sanitizeSocialBio(raw) {
  const cleaned = stripControls(raw);
  if (!cleaned) return '';
  const clipped = [...cleaned].slice(0, BIO_MAX).join('');
  if (LINK.test(clipped) || rejectMedicalCue(clipped) || /<[^>]+>/.test(clipped)) {
    const error = new Error('That bio cannot be used.');
    error.status = 400;
    error.code = 'SOCIAL_BIO_INVALID';
    throw error;
  }
  return clipped;
}

export function sanitizeReportDescription(raw) {
  const cleaned = stripControls(raw);
  return [...cleaned].slice(0, 280).join('');
}
