/**
 * Declining / closing / revoking the AI disclosure is a valid choice, not a failure (AGENTS: App Review
 * correction 2026-09-22 — „Decline/close/revoke must block transmission without presenting the choice
 * as a network error“). Screens that call the AI show this calm line and a neutral „ხელახლა ცდა“ that
 * opens the disclosure again; the question stays where it was.
 *
 * `AI_CONSENT_DECLINED` comes from the app's own consent flow (decline or close — nothing was sent);
 * `AI_CONSENT_REQUIRED` is the server refusing because consent is missing (nothing reached the AI
 * either, and the next try asks again). Pure: node tests load it.
 */
import { tx } from '../i18n/locale.js';

export function isAiConsentDeclined(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('code' in error)) return false;
  const code = (error as { code?: unknown }).code;
  return code === 'AI_CONSENT_DECLINED' || code === 'AI_CONSENT_REQUIRED';
}

export function aiConsentDeclinedText(): string {
  return tx('AI-ს არაფერი გაეგზავნა. როცა გინდა, შეგიძლია ხელახლა სცადო.', 'Nothing was sent to the AI. You can try again whenever you like.');
}

export function aiConsentRetryLabel(): string {
  return tx('ხელახლა ცდა', 'Try again');
}
