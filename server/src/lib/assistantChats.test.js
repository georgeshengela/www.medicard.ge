import test from 'node:test';
import assert from 'node:assert/strict';
import { appendAssistantTurns, assistantTitle, ASSISTANT_MAX_MESSAGES, linkedConsultationIds } from '../routes/chats.routes.js';

test('assistant turns are appended with timestamps and capped', () => {
  const now = new Date('2026-09-27T10:00:00Z');
  const first = appendAssistantTurns(null, [{ role: 'user', content: 'წყალი ჩამიწერე' }, { role: 'assistant', content: 'ჩავწერე.' }], now);
  assert.equal(first.length, 2);
  assert.equal(first[0].timestamp, now.toISOString());
  const long = Array.from({ length: ASSISTANT_MAX_MESSAGES }, (_, i) => ({ role: 'user', content: 'm' + i, timestamp: 'x' }));
  const capped = appendAssistantTurns(long, [{ role: 'assistant', content: 'last' }], now);
  assert.equal(capped.length, ASSISTANT_MAX_MESSAGES);
  assert.equal(capped.at(-1).content, 'last');
  assert.equal(capped[0].content, 'm1');
});

test('title comes from the first question, trimmed', () => {
  assert.equal(assistantTitle([{ role: 'assistant', content: 'hi' }, { role: 'user', content: '  თავი  მტკივა ' }]), 'თავი მტკივა');
  assert.equal(assistantTitle([{ role: 'assistant', content: 'x' }]), 'საუბარი Medi-სთან');
  assert.equal(assistantTitle([{ role: 'user', content: 'ა'.repeat(80) }]).length, 58);
});

test('a clinical answer inside a Medi thread keeps its kind and link; the linked consultation is listed once', () => {
  const now = new Date('2026-10-03T10:00:00Z');
  const doctorId = '0b5d6f3e-3c1a-4c8e-9a51-2f1d1f0c7a11';
  const thread = appendAssistantTurns(null, [
    { role: 'user', content: 'თავი მტკივა' },
    { role: 'assistant', content: 'ეს შეიძლება იყოს…', kind: 'answer', linkedSessionId: doctorId },
  ], now);
  assert.deepEqual(Object.keys(thread[0]).sort(), ['content', 'role', 'timestamp']);
  assert.equal(thread[1].kind, 'answer');
  assert.equal(thread[1].linkedSessionId, doctorId);
  const ids = linkedConsultationIds([
    { id: 'a', mode: 'ASSISTANT', messages: thread },
    { id: doctorId, mode: 'DOCTOR', messages: [] },
    { id: 'b', mode: 'DOCTOR', messages: [{ role: 'assistant', content: 'x', linkedSessionId: 'zzz' }] },
  ]);
  assert.deepEqual([...ids], [doctorId]);
});
