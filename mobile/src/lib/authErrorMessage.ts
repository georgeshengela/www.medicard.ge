import { ka } from '@/i18n/ka';
import { ApiError } from '@/lib/api';

const CREDENTIAL_ERROR =
  /არასწორი|invalid email or password|invalid credentials|incorrect (email|password)/i;

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
    if (CREDENTIAL_ERROR.test(error.message)) {
      return ka.auth.loginError;
    }
    return error.message || ka.common.error;
  }
  return ka.common.error;
}
