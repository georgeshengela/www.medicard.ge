import test from 'node:test';
import assert from 'node:assert/strict';
import { canJoinCommunity, launchReadiness, readCommunityLaunch, COMMUNITY_LAUNCH_TARGET } from './communityLaunch.js';

test('closed space keeps existing members and refuses new ones', () => {
  assert.equal(canJoinCommunity({ open: false, member: { alias: 'a' } }), true);
  assert.equal(canJoinCommunity({ open: false, member: null }), false);
  assert.equal(canJoinCommunity({ open: false, member: undefined }), false);
  assert.equal(canJoinCommunity({ open: true, member: null }), true);
  assert.equal(canJoinCommunity({ open: 'true', member: null }), false);
});

test('missing row or missing table reads as closed', async () => {
  assert.equal((await readCommunityLaunch({ $queryRaw: async () => [] })).open, false);
  const missing = Object.assign(new Error('relation "CommunityConfig" does not exist'), { code: 'P2010' });
  assert.equal((await readCommunityLaunch({ $queryRaw: async () => { throw missing; } })).open, false);
  assert.equal((await readCommunityLaunch({ $queryRaw: async () => [{ open: true, updatedAt: null, updatedBy: 'x' }] })).open, true);
  await assert.rejects(readCommunityLaunch({ $queryRaw: async () => { throw new Error('connection reset'); } }));
});

test('launch readiness needs the target and at least one moderator', () => {
  assert.equal(COMMUNITY_LAUNCH_TARGET, 300);
  assert.equal(launchReadiness({ activeWomen: 299, moderators: 2 }).ready, false);
  assert.equal(launchReadiness({ activeWomen: 300, moderators: 0 }).ready, false);
  const ok = launchReadiness({ activeWomen: 450, moderators: 1 });
  assert.equal(ok.ready, true);
  assert.equal(ok.progress, 1);
  assert.equal(launchReadiness({ activeWomen: 150, moderators: 1 }).progress, 0.5);
});
