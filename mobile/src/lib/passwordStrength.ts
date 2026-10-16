export type PasswordStrengthLevel = 'empty' | 'weak' | 'fair' | 'strong';

export type PasswordStrength = {
  level: PasswordStrengthLevel;
  score: number;
  labelKey: PasswordStrengthLevel;
};

/** Real-time password strength for sign-up / reset (Figma weak vs amazing). */
export function scorePassword(password: string): PasswordStrength {
  if (!password) return { level: 'empty', score: 0, labelKey: 'empty' };

  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^a-zA-Z0-9]/.test(password)) score += 1;

  if (score <= 2) return { level: 'weak', score, labelKey: 'weak' };
  if (score <= 3) return { level: 'fair', score, labelKey: 'fair' };
  return { level: 'strong', score, labelKey: 'strong' };
}

/** The server's own rule (`auth.routes.js`: 8–128 characters). */
export const PASSWORD_MIN_LENGTH = 8;

/**
 * The gate for sign-up and reset is length only, like the server: „nino1990“ is accepted.
 * The meter above is advice — it never blocks a password the server would take.
 */
export function isPasswordStrongEnough(password: string): boolean {
  return password.length >= PASSWORD_MIN_LENGTH;
}
