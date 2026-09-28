import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertTrainerMayInvite, reportSchema } from './coachSafety.js';

// Minimal fake: first query answers the CREATE TABLEs, then block lookup, then last-link lookup.
function fakeDb({ blocked = false, lastLink = null } = {}) {
  return {
    $executeRawUnsafe: async () => 0,
    $queryRaw: async (strings) => {
      const sql = strings.join('?');
      if (sql.includes('"CoachBlock"')) return blocked ? [{ ok: 1 }] : [];
      if (sql.includes('"TrainerLink"')) return lastLink ? [lastLink] : [];
      return [];
    },
  };
}

test('a blocked trainer cannot invite again', async () => {
  await assert.rejects(assertTrainerMayInvite('t1', 'c1', fakeDb({ blocked: true })), (e) => e.code === 'BLOCKED');
});

test('a client who ended the link is not re-invited by that trainer', async () => {
  await assert.rejects(assertTrainerMayInvite('t1', 'c1', fakeDb({ lastLink: { status: 'ENDED', endedBy: 'CLIENT' } })), (e) => e.code === 'CLIENT_ENDED');
});

test('a trainer may invite again after ending it themselves, or when there was no link', async () => {
  await assertTrainerMayInvite('t1', 'c1', fakeDb({ lastLink: { status: 'ENDED', endedBy: 'TRAINER' } }));
  await assertTrainerMayInvite('t1', 'c1', fakeDb());
});

test('reports need a known reason; details are bounded', () => {
  assert.equal(reportSchema.safeParse({ subjectId: 'u1', reason: 'harassment' }).success, true);
  assert.equal(reportSchema.safeParse({ subjectId: 'u1', reason: 'nope' }).success, false);
  assert.equal(reportSchema.safeParse({ subjectId: 'u1', reason: 'other', details: 'x'.repeat(1001) }).success, false);
});
