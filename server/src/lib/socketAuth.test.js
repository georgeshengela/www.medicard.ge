import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { authorizeSocketHandshake, userSocketRoom, ADMIN_SOCKET_ROOM } from './socketAuth.js';
import { publicQuestCompletedPayload } from './questRealtime.js';

describe('socket authorization', () => {
  it('joins admins to ops and users to their own room only', async () => {
    const admin = jwt.sign({ sub: 'admin-1', role: 'admin' }, env.JWT_SECRET);
    const user = jwt.sign({ sub: 'user-1', email: 'a@b.c' }, env.JWT_SECRET);
    const adminId = await authorizeSocketHandshake(admin);
    const userId = await authorizeSocketHandshake(user, {
      loadUser: async () => ({ id: 'user-1', status: 'ACTIVE' }),
    });
    assert.equal(adminId.kind, 'admin');
    assert.equal(userId.kind, 'user');
    assert.equal(userId.userId, 'user-1');
    assert.equal(userSocketRoom('user-1'), 'user:user-1');
    assert.equal(ADMIN_SOCKET_ROOM, 'ops');
    assert.notEqual(userSocketRoom('user-1'), ADMIN_SOCKET_ROOM);
    assert.notEqual(userSocketRoom('user-1'), userSocketRoom('user-2'));
  });

  it('rejects missing, expired, blocked, and unknown users', async () => {
    await assert.rejects(() => authorizeSocketHandshake(''), { code: 'SOCKET_UNAUTHORIZED' });
    const expired = jwt.sign({ sub: 'user-1', exp: Math.floor(Date.now() / 1000) - 30 }, env.JWT_SECRET);
    await assert.rejects(() => authorizeSocketHandshake(expired), { code: 'SOCKET_EXPIRED' });
    const user = jwt.sign({ sub: 'user-1' }, env.JWT_SECRET);
    await assert.rejects(
      () => authorizeSocketHandshake(user, { loadUser: async () => ({ id: 'user-1', status: 'BLOCKED' }) }),
      { code: 'SOCKET_BLOCKED' },
    );
    await assert.rejects(
      () => authorizeSocketHandshake(user, { loadUser: async () => null }),
      { code: 'SOCKET_UNAUTHORIZED' },
    );
  });
});

describe('quest socket payloads', () => {
  it('keeps completion events free of health quantities', () => {
    const payload = publicQuestCompletedPayload({
      questId: 'q1',
      templateKey: 'daily_steps',
      category: 'movement',
      completedAt: '2026-09-06T12:00:00.000Z',
      periodKey: '2026-09-06',
      rewardCoins: 30,
      rewardXp: 50,
      progress: 5000,
      target: 5000,
      hydrationMl: 2000,
      prompt: 'secret',
    });
    assert.equal(payload.status, 'COMPLETED');
    assert.equal(payload.key, 'daily_steps');
    assert.equal(payload.questId, 'q1');
    assert.equal(payload.hydrationMl, undefined);
    assert.equal(payload.prompt, undefined);
    assert.equal(JSON.stringify(payload).includes('secret'), false);
  });
});
