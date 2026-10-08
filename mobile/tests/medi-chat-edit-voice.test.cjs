const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const src = readFileSync(join(__dirname, '..', 'src', 'components', 'medi', 'MediChat.tsx'), 'utf8');
const between = (from, to) => {
  const start = src.indexOf(from);
  assert.ok(start >= 0, `found ${from}`);
  const end = src.indexOf(to, start + from.length);
  assert.ok(end > start, `found ${to}`);
  return src.slice(start, end);
};

// Medi chat F7 (2026-10-08): when the capability catalog failed to load, „შესწორება“ on an action card
// dropped the card and set manual mode, but the form needs the tool from the catalog and the footer hid the
// composer whenever manual was on: the chat had no card, no form and no input box.
test('Edit opens the form only when the catalog knows the tool, and loads the catalog again otherwise', () => {
  const edit = between('async function editAction(', 'async function prepare(');
  const check = edit.indexOf('if (!tools.some(t => t.name === review.tool))');
  assert.ok(check > 0, 'Edit checks the catalog first');
  assert.ok(edit.indexOf('loadCatalog(') > check, 'a missing tool loads the catalog again');
  assert.ok(edit.indexOf('dropTurns(cardId)') > edit.indexOf('loadCatalog('), 'the card is dropped only once the form can open');
  assert.match(edit, /if \(!loaded\?\.some\(t => t\.name === review\.tool\)\) \{[\s\S]*?setError\([\s\S]*?return;\s*\}/, 'otherwise the card stays with a message');
  assert.match(edit, /tx\('ფორმა ვერ ჩაიტვირთა\.[^']*', "The form couldn't load\.[^"]*"\)/, 'the message is in Georgian and English');
  assert.match(src, /onEdit=\{\(\) => void editAction\(item\.id, item\.review\)\}/);
});

test('the composer hides only while a form or the directory is really on screen', () => {
  assert.match(src, /footer=\{picker \|\| \(manual && draft && activeTool\) \? undefined : \(/);
  assert.doesNotMatch(src, /footer=\{picker \|\| manual \?/);
  assert.match(src, /\) : manual && draft && activeTool \? \(/, 'the form needs the same three');
});

// Medi chat F10 (2026-10-08): a health question asked by voice went to the clinical answer and got no voice.
test('a voice question hears the start of the clinical answer; typed questions stay silent', () => {
  const answer = between('async function answer(', 'async function plan(');
  assert.match(answer, /if \(fromVoice\) void speech\.say\(spokenAnswer\(response\.answer\)\);/);
  const success = answer.slice(0, answer.indexOf('} catch (err) {'));
  assert.ok(success.indexOf('speech.say(') > success.indexOf('if (!live(n)) return;'), 'spoken only for an answer that settled');
  // The speech hook is created with the admin voice switch and checks focus and mute itself.
  assert.match(src, /const voiceIn = voiceAvail && voiceOn, voiceOut = voiceOutAvail && voiceOn;/);
  assert.match(src, /const speech = useAssistantSpeech\(owner, voiceOut, setNotice\);/);
  const hook = readFileSync(join(__dirname, '..', 'src', 'components', 'assistant', 'useAssistantSpeech.ts'), 'utf8');
  assert.match(hook, /if \(!active\(\) \|\| !latest\.current\.available \|\| latest\.current\.muted \|\| !text\.trim\(\)\) return false;/);
  // A new message stops a reply that is still speaking.
  assert.match(between('async function send(', 'async function afterSaved('), /speech\.stop\(\);/);
});
