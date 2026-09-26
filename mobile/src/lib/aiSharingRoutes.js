/** Routes that can transmit personal data to a third-party AI provider. */
export function isAiSharingRequest(path, method = 'POST') {
  return method === 'POST' && (path.split('?')[0] === '/api/nutrition/estimate' || /^\/api\/ai\/(?!feedback(?:\?|$))/.test(path)
    || /^\/api\/assistant\/(plan|transcribe|speak)(?:\?|$)/.test(path)
    || path.split('?')[0] === '/api/health-profile/onboarding-analysis'
    || path.split('?')[0] === '/api/cycle/insights'
    || /^\/api\/pets\/[^/]+\/chat\/query(?:\?|$)/.test(path));
}

/** One prompt when consent is missing. An accepted current version never prompts again. */
export function needsAiConsentPrompt(status, settings = false) {
  if (settings) return true;
  return status?.accepted !== true;
}

/**
 * Session memory of an accepted decision, so the app does not ask the server
 * "may I?" before every single AI request. The server still checks consent on
 * every provider call; a 403 AI_CONSENT_REQUIRED clears this memory.
 */
const FRESH_MS = 15 * 60 * 1000;
let remembered = null;
export function rememberAiConsent(owner, status, now = Date.now()) {
  remembered = owner && status?.accepted === true ? { owner, version: status.version, at: now } : null;
}
export function hasFreshAiConsent(owner, now = Date.now()) {
  return Boolean(remembered && owner && remembered.owner === owner && now - remembered.at < FRESH_MS);
}
export function forgetAiConsent() {
  remembered = null;
}
