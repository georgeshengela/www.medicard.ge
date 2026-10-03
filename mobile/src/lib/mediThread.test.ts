import test from 'node:test';
import assert from 'node:assert/strict';
import { clinicalSessions, consultFromReview, humanCardValue, plannerHistory, storedTurns, turnsFromSession, type MediTurn } from './mediThread.ts';

const at = '2026-10-03T10:00:00.000Z';
const DOC = '0b5d6f3e-3c1a-4c8e-9a51-2f1d1f0c7a11';

test('the planner sees words only: answers shortened, cards and unfinished answers left out', () => {
  const long = 'ა'.repeat(3000);
  const turns: MediTurn[] = [
    { id: '1', kind: 'user', text: 'თავი მტკივა', at },
    { id: '2', kind: 'answer', deep: false, text: long, at, sessionId: DOC },
    { id: '3', kind: 'action', review: { id: 'r', tool: 'hydration_add', args: {}, label: 'წყალი', token: 'x' }, state: 'pending', at },
    { id: '4', kind: 'medi', text: 'კარგი', at },
    { id: '5', kind: 'answer', deep: true, text: 'ნაწილი', at, streaming: true },
  ];
  const history = plannerHistory(turns);
  assert.deepEqual(history.map(h => h.role), ['user', 'assistant', 'assistant']);
  assert.equal(history[1].content.length, 1501);
  assert.equal(history[2].content, 'კარგი');
});

test('a reopened Medi thread keeps its answers and the consultations they came from', () => {
  const turns = turnsFromSession({ id: 'a', mode: 'ASSISTANT', messages: [
    { role: 'user', content: 'თავი მტკივა', timestamp: at },
    { role: 'assistant', content: 'პასუხი', timestamp: at, kind: 'answer', linkedSessionId: DOC },
    { role: 'assistant', content: 'შენახულია.', timestamp: at },
    { role: 'assistant', content: 'ღრმა', timestamp: at, kind: 'deep', linkedSessionId: 'deep-id' },
  ] });
  assert.deepEqual(turns.map(t => t.kind), ['user', 'answer', 'medi', 'answer']);
  assert.deepEqual(clinicalSessions(turns), { DOCTOR: DOC, CONSILIUM: 'deep-id' });
  assert.deepEqual(storedTurns(turns).map(t => t.kind ?? '-'), ['-', 'answer', '-', 'deep']);
});

test('an old consultation opens as answers that continue the same session', () => {
  const turns = turnsFromSession({ id: DOC, mode: 'CONSILIUM', messages: [
    { role: 'user', content: 'კითხვა', timestamp: at },
    { role: 'assistant', content: 'პასუხი', timestamp: at, interactionId: 'i1' },
  ] });
  assert.equal(turns[1].kind === 'answer' && turns[1].deep, true);
  assert.deepEqual(clinicalSessions(turns), { CONSILIUM: DOC });
  assert.equal(storedTurns(turns)[1].linkedSessionId, DOC);
});

test('consult: the planner question wins, the typed text is the fallback', () => {
  const review = { id: 'r', tool: 'consult', label: 'x', token: 't', args: { mode: 'DOCTOR', message: 'თავი 3 დღეა მტკივა' } };
  assert.deepEqual(consultFromReview(review, 'x'), { message: 'თავი 3 დღეა მტკივა', mode: 'DOCTOR' });
  assert.deepEqual(consultFromReview({ ...review, args: { mode: 'CONSILIUM' } }, ' ჩემი კითხვა '), { message: 'ჩემი კითხვა', mode: 'CONSILIUM' });
  assert.equal(consultFromReview({ ...review, tool: 'open' }, 'x'), null);
  assert.equal(consultFromReview(null, 'x'), null);
});

test('card values never show an ISO date', () => {
  const today = new Date('2026-10-04T12:00:00Z');
  assert.equal(humanCardValue('2026-10-04', today, false), '4 ოქტომბერი');
  assert.equal(humanCardValue('2027-01-15', today, false), '15 იანვარი 2027');
  assert.equal(humanCardValue('2026-10-05', today, true), '5 October');
  assert.equal(humanCardValue('500', today, false), '500');
});
