const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

// Medi chat F3 (2026-10-08): opening another screen over Medi while an answer streamed (⋯ → AI და
// კონფიდენციალურობა, a notification) bumped the generation on blur without aborting. Every later chunk,
// the final answer and the error path were ignored: back on Medi the bubble stayed „streaming“ forever with
// half the text, the thread never saved the question and answer, and the next question opened a new
// consultation. A blur during planning left the question with no reply and no error.
//
// Rule: work already on its way settles regardless of focus (finishes and is saved, or fails with the
// question back in the composer and „ხელახლა ცდა“). Only a reset, a new message, closing Medi (which aborts
// the request — the server then stores nothing) or another account cancels it. Focus gates new actions and
// side effects only.

const src = readFileSync(join(__dirname, '..', 'src', 'components', 'medi', 'MediChat.tsx'), 'utf8');
const between = (from, to) => {
  const start = src.indexOf(from);
  assert.ok(start >= 0, `found ${from}`);
  const end = src.indexOf(to, start + from.length);
  assert.ok(end > start, `found ${to}`);
  return src.slice(start, end);
};

test('leaving Medi for another screen does not cancel the answer or plan on its way', () => {
  const blur = src.match(/return \(\) => \{([^}]*focused\.current = false[^}]*)\}/);
  assert.ok(blur, 'the focus effect cleanup that marks the blur');
  assert.doesNotMatch(blur[1], /generation/, 'a blur never invalidates work in flight');
  const live = src.match(/const live = \(n: number\) => ([^;]+);/);
  assert.ok(live, 'live(n) exists');
  assert.doesNotMatch(live[1], /focused/);
  assert.match(live[1], /alive\.current/);
  assert.match(live[1], /owner === localAccountId\(\)/, 'late results stay scoped to the account that asked');
  assert.match(live[1], /n === generation\.current/);
});

test('a streamed answer settles whether or not Medi is on screen, and never stays „streaming“', () => {
  const answer = between('async function answer(', 'async function plan(');
  assert.doesNotMatch(answer, /\bvalid\(/, 'answer() never checks focus for its result');
  assert.ok((answer.match(/if \(!live\(n\)\) return;/g) || []).length >= 2, 'success and error paths use live(n)');
  assert.match(answer, /persist\(storedTurns\(\[userTurn, done\]\)\)/, 'the finished answer is saved in the thread');
  const failure = answer.slice(answer.indexOf('} catch (err) {'));
  assert.match(failure, /if \(!live\(n\)\) return;\s*dropTurns\(slot\.id, userTurn\.id\);\s*setText\(/, 'a failed answer leaves no bubble and puts the question back');
  assert.doesNotMatch(answer, /(?<!focused\.current\) )assistantHaptic\(/, 'haptics only while Medi is on screen');
  assert.match(failure, /isQuotaExceeded && focused\.current\)/, 'the limit sheet never opens over another screen');
});

test('a plan settles whether or not Medi is on screen', () => {
  const plan = between('async function plan(', 'async function send(');
  assert.doesNotMatch(plan, /\bvalid\(/);
  assert.ok((plan.match(/if \(!live\(n\)\) return;/g) || []).length >= 2);
  assert.doesNotMatch(plan, /(?<!focused\.current\) )assistantHaptic\(/);
});

test('closing Medi still aborts the request (the server then stores nothing)', () => {
  assert.match(src, /return \(\) => \{[^}]*alive\.current = false;[^}]*abort\.current\?\.abort\(\);[^}]*\}/);
});
