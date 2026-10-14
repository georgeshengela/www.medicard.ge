import test from 'node:test';
import assert from 'node:assert/strict';
import {isTransportError,pulseErrorText} from './errorText.ts';

const CONNECTION='MEDIRUN-თან კავშირი ვერ დამყარდა. შეამოწმე ინტერნეტი და სცადე ხელახლა.';

test('raw transport errors never reach the screen in English', () => {
  for (const raw of [new TypeError('Network request failed'), new Error('Aborted'), Object.assign(new Error('The operation was aborted.'), {name: 'AbortError'}), new SyntaxError('JSON Parse error: Unexpected character: <'), new Error('The request timed out.'), new Error(''), null, undefined]) {
    assert.equal(pulseErrorText(raw), CONNECTION, String(raw));
  }
  assert.equal(isTransportError(new TypeError('Network request failed')), true);
});

test('the server’s own messages pass through unchanged', () => {
  assert.equal(pulseErrorText(new Error('გააგრძელე ან დაასრულე არსებული სესია.')), 'გააგრძელე ან დაასრულე არსებული სესია.');
  assert.equal(pulseErrorText(new Error('საჭიროა ახალი და ზუსტი GPS სიგნალი.')), 'საჭიროა ახალი და ზუსტი GPS სიგნალი.');
  assert.equal(isTransportError(new Error('თამაში დროებით შეჩერებულია.')), false);
});
