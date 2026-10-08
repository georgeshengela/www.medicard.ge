import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { legacyOnboardingAnalysisResponse } from './onboardingAnalysis.js';

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');

describe('onboarding analysis (removed 2026-10-08)', () => {
  it('answers older builds with the profile only — no analysis, no score', () => {
    const profile = { id: 'p1', extraAnswers: { aiPrivacyDecision: 'accepted' } };
    const body = legacyOnboardingAnalysisResponse(profile);
    assert.deepEqual(body, { analysis: null, profile, cached: false });
    assert.equal(JSON.stringify(body).includes('score'), false);
  });

  it('the module and the route never reach an AI model', () => {
    const lib = read('./onboardingAnalysis.js');
    assert.doesNotMatch(lib, /\bimport\b[^;]*from '(?:openai|\.\/consentedAiFetch\.js|\.\/aiEngine\.js)'/);
    const routes = read('../routes/health-profile.routes.js');
    const start = routes.indexOf("'/onboarding-analysis'");
    assert.ok(start > 0, 'the route still answers older builds');
    const handler = routes.slice(start, routes.indexOf('healthProfileRouter.', start));
    assert.doesNotMatch(handler, /openrouter|OpenRouter|chat\.completions|generateOnboardingAnalysis|requireAiConsent|executeRaw/);
    assert.match(handler, /legacyOnboardingAnalysisResponse\(publicHealthProfile\(profile\)\)/);
  });
});
