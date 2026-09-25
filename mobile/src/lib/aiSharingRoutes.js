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
