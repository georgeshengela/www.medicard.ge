const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

// W2-8b — App Review correction 2026-09-22: „Decline/close/revoke must block transmission without
// presenting the choice as a network error.“ Medi (doctor / deep / planner / voice) on the app and the
// web portal show one calm line and a neutral „ხელახლა ცდა“ that opens the disclosure again.

const mobile = join(__dirname, '..');
const read = (...p) => readFileSync(join(mobile, ...p), 'utf8');
const CALM_KA = 'AI-ს არაფერი გაეგზავნა. როცა გინდა, შეგიძლია ხელახლა სცადო.';

test('the consultation shows the calm state, not the red error box, and keeps the question', () => {
  const src = read('src', 'components', 'chat', 'MediConsultation.tsx');
  const catchBlock = src.slice(src.indexOf('} catch (err) {'), src.indexOf('} finally {', src.indexOf('} catch (err) {')));
  assert.match(catchBlock, /setDraft\(current => current\.trim\(\) \? current : message\)/, 'the question goes back to the composer');
  const declined = catchBlock.indexOf('isAiConsentDeclined(err)');
  assert.ok(declined > 0 && declined < catchBlock.indexOf('setError('), 'the decline branch runs before any error');
  assert.doesNotMatch(catchBlock.slice(declined, catchBlock.indexOf('} else if', declined)), /setError|setFailedMessage/);
  const box = src.slice(src.indexOf('{declinedMessage && !error ?'), src.indexOf('{error ? ('));
  assert.match(box, /aiConsentDeclinedText\(\)/);
  assert.match(box, /aiConsentRetryLabel\(\)/);
  assert.match(box, /send\(/, 'retry sends again, which opens the disclosure first');
  assert.doesNotMatch(box, /danger/i, 'no error colours');
});

test('the planner and voice use the same calm line; no fake Medi turn', () => {
  const screen = read('app', 'assistant.tsx');
  assert.match(screen, /isAiConsentDeclined\(e\)\) \{[\s\S]{0,400}setNotice\(aiConsentDeclinedText\(\)\)/);
  assert.match(screen, /notice === aiConsentDeclinedText\(\) && retryPlan\.current/);
  assert.doesNotMatch(screen, /Your request was not sent to AI/);
  assert.match(read('src', 'lib', 'assistantVoiceSession.ts'), /isAiConsentDeclined\(error\)\) \{\s*d\.onNotice\(aiConsentDeclinedText\(\)\)/);
  assert.match(read('src', 'components', 'assistant', 'useAssistantSpeech.ts'), /isAiConsentDeclined\(error\) \? aiConsentDeclinedText\(\)/);
});

test('the web portal Medi and pet-assistant chats show a calm note with „ხელახლა ცდა“ (ka + en)', () => {
  const portal = join(mobile, '..', 'server', 'public', 'app', 'js', 'pages');
  for (const file of ['medi.js', 'pets.js']) {
    const src = readFileSync(join(portal, file), 'utf8');
    assert.ok(src.includes(`t('${CALM_KA}', 'Nothing was sent to the AI. You can try again whenever you like.')`), file);
    assert.ok(src.includes("t('ხელახლა ცდა', 'Try again')"), file);
  }
  const pets = readFileSync(join(portal, 'pets.js'), 'utf8');
  assert.doesNotMatch(pets, /needs your consent to share data with AI/, 'decline is no longer written into the error element');
});
