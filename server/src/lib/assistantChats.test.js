import test from 'node:test';
import assert from 'node:assert/strict';
import { appendAssistantTurns, assistantTitle, ASSISTANT_MAX_MESSAGES, consultationsToDelete, deleteChatSession, linkedConsultationIds } from '../routes/chats.routes.js';

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

// 2026-10-13: deleting a Medi thread left its linked consultations behind — they came back in
// „ყველა საუბარი“ (only links from surviving threads hide them) and kept feeding Medi's context.
test('deleting a Medi thread deletes its linked consultations in the same transaction', async () => {
  const userId = 'u1';
  const doctorId = '0b5d6f3e-3c1a-4c8e-9a51-2f1d1f0c7a11', deepId = '1c6e7a4f-4d2b-4d9f-8b62-3a2e2a1d8b22', sharedId = '2d7f8b5a-5e3c-4ea0-9c73-4b3f3b2e9c33';
  const rows = [
    { id: 'thread', userId, mode: 'ASSISTANT', messages: [
      { role: 'user', content: 'q' },
      { role: 'assistant', content: 'a', kind: 'answer', linkedSessionId: doctorId },
      { role: 'assistant', content: 'b', kind: 'deep', linkedSessionId: deepId },
      { role: 'assistant', content: 'c', kind: 'answer', linkedSessionId: sharedId },
    ] },
    { id: 'other', userId, mode: 'ASSISTANT', messages: [{ role: 'assistant', content: 'c', kind: 'answer', linkedSessionId: sharedId }] },
    { id: doctorId, userId, mode: 'DOCTOR', messages: [] },
    { id: deepId, userId, mode: 'CONSILIUM', messages: [] },
    { id: sharedId, userId, mode: 'DOCTOR', messages: [] },
    { id: 'old', userId, mode: 'DOCTOR', messages: [] },
    // Another account's session with a colliding id never matches the owner filter.
    { id: deepId, userId: 'u2', mode: 'CONSILIUM', messages: [] },
  ];
  const matches = (row, where) => Object.entries(where).every(([key, cond]) => {
    if (cond && typeof cond === 'object' && 'in' in cond) return cond.in.includes(row[key]);
    if (cond && typeof cond === 'object' && 'not' in cond) return row[key] !== cond.not;
    return row[key] === cond;
  });
  let inTransaction = false;
  const table = {
    findFirst: async ({ where }) => { assert.ok(inTransaction); return rows.find((row) => matches(row, where)) ?? null; },
    findMany: async ({ where }) => { assert.ok(inTransaction); return rows.filter((row) => matches(row, where)); },
    deleteMany: async ({ where }) => {
      assert.ok(inTransaction, 'every delete runs inside the transaction');
      const gone = rows.filter((row) => matches(row, where));
      for (const row of gone) rows.splice(rows.indexOf(row), 1);
      return { count: gone.length };
    },
  };
  const db = { $transaction: async (fn) => { inTransaction = true; try { return await fn({ chatSession: table }); } finally { inTransaction = false; } } };

  assert.equal(await deleteChatSession(db, userId, 'thread'), 1);
  assert.deepEqual(rows.filter((row) => row.userId === userId).map((row) => row.id).sort(), ['old', 'other', sharedId].sort(),
    'the thread and the consultations only it showed are gone; one still shown by another thread stays');
  assert.ok(rows.some((row) => row.userId === 'u2' && row.id === deepId), 'another account is never touched');
  assert.equal(await deleteChatSession(db, userId, 'thread'), 0, 'a second delete finds nothing (404)');
  // Deleting a plain consultation deletes only that one.
  assert.equal(await deleteChatSession(db, userId, 'old'), 1);
  assert.deepEqual(rows.filter((row) => row.userId === userId).map((row) => row.id).sort(), ['other', sharedId].sort());
  assert.deepEqual(consultationsToDelete({ mode: 'ASSISTANT', messages: [{ linkedSessionId: 'x' }] }, [{ mode: 'DOCTOR', messages: [{ linkedSessionId: 'x' }] }]), ['x'],
    'only a Medi thread counts as still showing a consultation');
});
