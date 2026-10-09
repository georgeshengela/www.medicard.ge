import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { contactOf, onlineSignature, screenOf, shapeOnlineUsers, summarizeOnline } from './onlineUsers.js';

describe('admin online users', () => {
  const now = Date.parse('2026-10-06T12:00:00Z');
  const row = (id, secondsAgo, extra = {}) => ({ userId: id, lastAt: new Date(now - secondsAgo * 1000), firstAt: new Date(now - 3600_000), fullName: id, email: `${id}@example.com`, phone: null, platform: 'IOS', appVersion: '1.0.0.21.13', activityType: '(tabs)/home', createdAt: new Date('2026-09-01'), ...extra });

  it('lists only people with a heartbeat in the last 90 s, newest first', () => {
    const users = shapeOnlineUsers([row('a', 80), row('b', 5), row('gone', 91)], now);
    assert.deepEqual(users.map((u) => u.id), ['b', 'a']);
    assert.equal(users[0].platform, 'ios');
    assert.equal(users[0].screen, 'home');
  });

  it('shows phone and Apple sign-ups as a number / Apple, never the synthetic login', () => {
    assert.equal(contactOf('995555123456@phone.medicard.ge', null), '+995 555 12 34 56');
    assert.equal(contactOf('apple.abc@apple.medicard.ge', null), 'Apple');
    assert.equal(contactOf('x@apple.medicard.ge', '+995599001122'), '+995 599 00 11 22');
    assert.equal(contactOf('ana@example.com', null), 'ana@example.com');
  });

  it('reads the screen from the route and ignores heartbeats', () => {
    assert.equal(screenOf('(tabs)/home'), 'home');
    assert.equal(screenOf('cycle/settings'), 'cycle/settings');
    assert.equal(screenOf('heartbeat'), null);
    assert.equal(screenOf('open'), null);
  });

  it('the signature changes when someone comes, leaves or changes screen — not on a heartbeat', () => {
    const a = { users: shapeOnlineUsers([row('a', 5)], now) };
    const later = { users: shapeOnlineUsers([row('a', 1)], now) };
    const moved = { users: shapeOnlineUsers([row('a', 1, { activityType: 'cycle' })], now) };
    assert.equal(onlineSignature(a), onlineSignature(later));
    assert.notEqual(onlineSignature(a), onlineSignature(moved));
  });

  it('summarizes where everyone is and on what device', () => {
    const users = shapeOnlineUsers([
      row('a', 5),
      row('b', 6, { activityType: 'run/active', platform: 'ANDROID' }),
      row('c', 7, { activityType: 'run', createdAt: new Date(now - 3600_000) }),
      row('d', 8, { activityType: 'heartbeat', platform: null }),
    ], now);
    assert.deepEqual(summarizeOnline(users, now), {
      screens: { home: 1, run: 2, '': 1 },
      platforms: { ios: 2, android: 1, unknown: 1 },
      newcomers: 1,
    });
  });
});
