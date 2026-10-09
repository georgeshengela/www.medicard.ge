import { ka } from '@/i18n/ka';
import { ApiError } from '@/lib/api';

/**
 * The server's answer to a wrong email or password on POST /api/auth/login (server auth.routes.js),
 * in both languages. Matched exactly: the word „არასწორი“ alone is also in every wrong or expired
 * SMS / email code error, which must reach the person as the server wrote it.
 */
const LOGIN_FAILURE_MESSAGES = new Set(['ელ-ფოსტა ან პაროლი არასწორია.', 'The email or password is incorrect.']);

/**
 * Authentication is formal. Shared `ka.common.networkError` stays direct for Cycle.
 * Shared `ka.common.requestTimeout` is voice-neutral. Map auth-surface failures
 * onto `ka.auth.networkError` / `ka.auth.requestTimeout`.
 */
export function authErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 408 || error.message === ka.common.requestTimeout) {
      return ka.auth.requestTimeout;
    }
    if (error.status === 0 || error.message === ka.common.networkError) {
      return ka.auth.networkError;
    }
    if (LOGIN_FAILURE_MESSAGES.has(error.message.trim())) {
      return ka.auth.loginError;
    }
    return error.message || ka.common.error;
  }
  return ka.common.error;
}
