const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, readdirSync, statSync } = require('node:fs');
const { join, relative, sep } = require('node:path');

// W3-1 — App Review correction 2026-09-22: „Decline/close/revoke must block transmission without
// presenting the choice as a network error.“ Every screen that calls an AI-sharing endpoint (the ones
// `isAiSharingRequest` gates: /api/ai/*, /api/nutrition/estimate, /api/assistant/plan|transcribe|speak,
// /api/health-profile/onboarding-analysis, /api/cycle/insights, /api/pets/:id/chat/query) must handle a
// declined / closed disclosure through `isAiConsentDeclined` — or be on the silent allow-list below.
// The web portal pages that call `withAiConsent` must show the calm note on `.declined`.

const mobile = join(__dirname, '..');
const repo = join(mobile, '..');
const read = (file) => readFileSync(file, 'utf8');
const CALM_KA = 'AI-ს არაფერი გაეგზავნა. როცა გინდა, შეგიძლია ხელახლა სცადო.';

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(tsx?|jsx?)$/.test(name) && !/\.test\./.test(name)) out.push(full);
  }
  return out;
}

/** Calls that reach an AI-sharing endpoint (each runs the consent flow first and can throw AI_CONSENT_DECLINED). */
const AI_CALL = new RegExp([
  String.raw`api\.ai\.(?:query|symptomCheck|extractLab|alignLab|weightAdvice|explainLab|analyzeImage|skincare|medicationReview)\(`,
  String.raw`api\.nutrition\.estimate\(`,
  String.raw`api\.healthProfile\.onboardingAnalysis\(`,
  String.raw`api\.cycle\.insights\(`,
  String.raw`api\.pets\.chats?\.query\(`,
  String.raw`streamPetVetQuery\(`,
  String.raw`streamAiQuery\(`,
  String.raw`assistantRequest<[^>]*>\('(?:plan|transcribe|speak)'`,
].join('|'));

/** Callers that may stay silent: nothing the person started, or the failure is already swallowed by design. */
const SILENT = {
  // Onboarding's automatic first analysis: any failure (decline included) just skips the score page.
  'app/(auth)/profile-setup/analyzing.tsx': /onboardingAnalysis\(\{ force \}\);[\s\S]{0,200}\} catch \{\s*\/\/ score page is skipped/,
  // Voice capture: the decline is handled inside createVoiceCapture (assistantVoiceSession.ts, checked below).
  'src/components/assistant/useAssistantVoice.ts': /createVoiceCapture\(\{/,
};

const ALLOWED_AI_PATHS = new Set([
  '/api/ai/engines', '/api/ai/query', '/api/ai/feedback', '/api/ai/symptom-check', '/api/ai/extract-lab', '/api/ai/align-lab',
  '/api/ai/weight-advice', '/api/ai/explain-lab', '/api/ai/analyze-image', '/api/ai/skincare', '/api/ai/medication-review',
]);

test('api.ts has no AI-sharing endpoint this guard does not know about', () => {
  const api = read(join(mobile, 'src', 'lib', 'api.ts'));
  const paths = new Set([...api.matchAll(/['`](\/api\/ai\/[a-z-]+)/g)].map((m) => m[1]));
  for (const path of paths) assert.ok(ALLOWED_AI_PATHS.has(path) || path === '/api/ai/symptom-result', `new AI path ${path}: add its api method to AI_CALL and handle the decline in its screens`);
  const routes = read(join(mobile, 'src', 'lib', 'aiSharingRoutes.js'));
  for (const gated of ['/api/nutrition/estimate', '/api/health-profile/onboarding-analysis', '/api/cycle/insights', 'chat\\/query', 'plan|transcribe|speak']) {
    assert.ok(routes.includes(gated), `aiSharingRoutes still gates ${gated}`);
  }
});

test('every mobile AI caller handles a declined disclosure calmly (isAiConsentDeclined) or is allow-listed as silent', () => {
  const files = [...walk(join(mobile, 'app')), ...walk(join(mobile, 'src'))]
    .filter((file) => !file.endsWith(join('src', 'lib', 'api.ts')) && !/aiQueryStream|petVetQueryStream/.test(file));
  const callers = [];
  for (const file of files) {
    const src = read(file);
    if (!AI_CALL.test(src)) continue;
    const rel = relative(mobile, file).split(sep).join('/');
    callers.push(rel);
    if (SILENT[rel]) {
      assert.ok(SILENT[rel].test(src), `${rel}: the allow-listed silent path changed — re-check it`);
      continue;
    }
    assert.ok(/isAiConsentDeclined\(/.test(src), `${rel} calls an AI endpoint but never checks isAiConsentDeclined`);
  }
  // The known set; a new caller shows up here and must be handled (the assertion above already ran).
  for (const known of [
    'app/assistant.tsx', 'app/symptoms/analyzing.tsx', 'app/nutrition/diary.tsx', 'app/nutrition/recipe.tsx', 'app/module/skincare.tsx',
    'app/medications/interaction.tsx', 'app/health-metrics/weight/index.tsx', 'app/(auth)/profile-setup/results.tsx',
    'app/pets/[id]/chat.tsx', 'src/components/AnalysisModule.tsx', 'src/components/lab/LabAlignCard.tsx',
    'src/components/cycle/CycleInsights.tsx', 'src/components/chat/MediConsultation.tsx',
  ]) assert.ok(callers.includes(known), `${known} is still found as an AI caller (update the list if it moved)`);
  assert.ok(/isAiConsentDeclined\(error\)\) \{\s*d\.onNotice\(aiConsentDeclinedText\(\)\)/.test(read(join(mobile, 'src', 'lib', 'assistantVoiceSession.ts'))),
    'voice capture turns a decline into the calm notice');
});

test('the decline branch never shows an error, an error alert or an error haptic', () => {
  for (const rel of [
    'app/symptoms/analyzing.tsx', 'src/components/AnalysisModule.tsx', 'src/components/lab/LabAlignCard.tsx', 'app/nutrition/diary.tsx',
    'app/nutrition/recipe.tsx', 'app/module/skincare.tsx', 'app/medications/interaction.tsx', 'app/health-metrics/weight/index.tsx',
    'app/(auth)/profile-setup/results.tsx', 'src/components/cycle/CycleInsights.tsx', 'app/pets/[id]/chat.tsx',
  ]) {
    const src = read(join(mobile, rel));
    for (const m of src.matchAll(/(?<!!)isAiConsentDeclined\((?:e|err|error)\)\)?/g)) {
      // The statement the check guards: up to its closing `}` / the next `else` / `return;`.
      const tail = src.slice(m.index, m.index + 420);
      const end = Math.min(...['} else', 'else ', 'return;', '\n      }\n'].map((k) => { const i = tail.indexOf(k); return i < 0 ? tail.length : i; }));
      const branch = tail.slice(0, end);
      assert.ok(!/setError\(|setSheetError\(|Alert\.alert|NotificationFeedbackType\.Error|toast\(|ka\.common\.error|networkError/.test(branch), `${rel}: decline branch looks like an error:\n${branch}`);
    }
  }
});

test('the screens render the shared calm note (or its line) with a neutral „ხელახლა ცდა“', () => {
  const note = read(join(mobile, 'src', 'components', 'ui', 'AiConsentDeclinedNote.tsx'));
  assert.match(note, /aiConsentDeclinedText\(\)/);
  assert.match(note, /aiConsentRetryLabel\(\)/);
  assert.doesNotMatch(note, /danger|#DC2626|#F43F5E|Haptics/i, 'the note has no error colours and no haptics');
  for (const rel of [
    'app/symptoms/analyzing.tsx', 'src/components/AnalysisModule.tsx', 'src/components/lab/LabAlignCard.tsx', 'app/nutrition/diary.tsx',
    'app/module/skincare.tsx', 'app/medications/interaction.tsx', 'app/health-metrics/weight/index.tsx',
    'app/(auth)/profile-setup/results.tsx', 'app/pets/[id]/chat.tsx',
  ]) assert.match(read(join(mobile, rel)), /<AiConsentDeclinedNote[^>]*onRetry=/, `${rel} renders AiConsentDeclinedNote with a retry`);
  // The describe sheets keep the typed text; „დათვალე“ is the retry and the line is neutral.
  for (const rel of ['app/nutrition/diary.tsx', 'app/nutrition/recipe.tsx']) assert.match(read(join(mobile, rel)), /consentNotice=\{describeNotice\}/, rel);
  const sheet = read(join(mobile, 'src', 'components', 'nutrition', 'DescribeMealModal.tsx'));
  assert.match(sheet, /color: error \|\| voiceError \? c\.danger : c\.text200 \}\]\}>\{error \|\| voiceError \|\| consentNotice \|\| notice\}/, 'consentNotice renders in the neutral colour');
  // Cycle tips fall back to the local tips silently; only a tap on refresh shows the calm line.
  assert.match(read(join(mobile, 'src', 'components', 'cycle', 'CycleInsights.tsx')), /isAiConsentDeclined\(err\)\) \{\s*if \(refresh\) setDeclinedNote\(true\);/);
});

test('web portal: every withAiConsent caller shows the calm note on decline, never a bare silent return or an error', () => {
  const pagesDir = join(repo, 'server', 'public', 'app', 'js', 'pages');
  const consent = read(join(repo, 'server', 'public', 'app', 'js', 'aiConsent.js'));
  assert.ok(consent.includes(`t('${CALM_KA}', 'Nothing was sent to the AI. You can try again whenever you like.')`), 'aiConsent.js carries the calm copy');
  assert.match(consent, /export function aiDeclinedSlot\(\)/);
  assert.match(consent, /class: 'ai-declined'/);
  assert.match(consent, /again\.code === 'AI_CONSENT_REQUIRED'\) return \{ declined: true \}/, 'a second server refusal is a decline, not an error');
  assert.match(read(join(repo, 'server', 'public', 'app', 'app.css')), /\.ai-declined \{[^}]*background: var\(--bg\); color: var\(--text2\)/);
  for (const name of readdirSync(pagesDir)) {
    const src = read(join(pagesDir, name));
    if (!src.includes('withAiConsent(')) continue;
    assert.doesNotMatch(src, /declined\) return;/, `${name}: a decline must show the calm note, not return silently`);
    assert.doesNotMatch(src, /declined\) \{ clear\([a-z]+\); return; \}/, `${name}: a decline must show the calm note`);
    const handled = src.includes('aiDeclinedSlot()') || src.includes(`t('${CALM_KA}'`);
    assert.ok(handled, `${name} calls withAiConsent but never shows the calm declined note`);
  }
});
