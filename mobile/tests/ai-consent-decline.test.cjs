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

test('a clinical answer: the calm state, not the red error box, and the question goes back to the composer', () => {
  const src = read('src', 'components', 'medi', 'MediChat.tsx');
  const start = src.indexOf('async function answer(');
  const catchBlock = src.slice(src.indexOf('} catch (err) {', start), src.indexOf('} finally {', src.indexOf('} catch (err) {', start)));
  assert.match(catchBlock, /setText\(current => \(current\.trim\(\) \? current : value\)\)/, 'the question goes back to the composer');
  const declined = catchBlock.indexOf('isAiConsentDeclined(err)');
  assert.ok(declined > 0 && declined < catchBlock.indexOf('setError('), 'the decline branch runs before any error');
  assert.doesNotMatch(catchBlock.slice(declined, catchBlock.indexOf('} else if', declined)), /setError|assistantHaptic/);
  assert.match(catchBlock.slice(declined, catchBlock.indexOf('} else if', declined)), /setNotice\(aiConsentDeclinedText\(\)\)/);
  // The retry under the calm line sends again, which opens the disclosure first; no error colour on a notice.
  assert.match(src, /error \? tx\('ხელახლა ცდა', 'Try again'\) : aiConsentRetryLabel\(\)/);
  assert.match(src, /color: error \? C\.danger : C\.text200/);
});

test('the planner and voice use the same calm line; no fake Medi turn', () => {
  const screen = read('src', 'components', 'medi', 'MediChat.tsx');
  const planner = screen.slice(screen.indexOf('async function plan('), screen.indexOf('async function send('));
  assert.match(planner, /if \(isAiConsentDeclined\(e\)\) setNotice\(aiConsentDeclinedText\(\)\)/);
  assert.match(planner, /dropTurns\(userTurn\.id\)/, 'no Medi turn is invented for a request that was not sent');
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
