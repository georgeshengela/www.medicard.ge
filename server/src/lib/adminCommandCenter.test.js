import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  featureShareOfActive,
  resolveCommandCenterStatus,
} from './adminCommandCenter.js';

describe('featureShareOfActive', () => {
  it('uses the same user grain: intersection / AppActivity uniques', () => {
    const share = featureShareOfActive(
      ['u1', 'u2', 'u3', 'u3'],
      ['u1', 'u9'],
    );
    assert.equal(share.featureUsers, 3);
    assert.equal(share.amongActive, 1);
    assert.equal(share.activeUsers, 2);
    assert.equal(share.pctOfActive, 50);
  });

  it('never exceeds 100% when labeled as share of active users', () => {
    const share = featureShareOfActive(
      ['a', 'b', 'c', 'd', 'e', 'f'],
      ['a'],
    );
    assert.ok(share.pctOfActive <= 100);
    assert.equal(share.pctOfActive, 100);
    assert.equal(share.amongActive, 1);
  });

  it('returns null percent when there are no active users (no fake 0/Infinity)', () => {
    const share = featureShareOfActive(['a', 'b'], []);
    assert.equal(share.pctOfActive, null);
    assert.equal(share.amongActive, 0);
    assert.equal(share.featureUsers, 2);
  });

  it('deduplicates both sides', () => {
    const share = featureShareOfActive(['a', 'a', 'b'], ['a', 'a', 'b', 'b']);
    assert.equal(share.activeUsers, 2);
    assert.equal(share.featureUsers, 2);
    assert.equal(share.pctOfActive, 100);
  });
});

describe('resolveCommandCenterStatus', () => {
  it('is healthy when no critical/warning signals exist', () => {
    const out = resolveCommandCenterStatus({ aiErrors24h: 0, attention: [] });
    assert.equal(out.level, 'healthy');
    assert.equal(out.items.length, 0);
  });

  it('treats any AI error in 24h as attention — not healthy', () => {
    const out = resolveCommandCenterStatus({ aiErrors24h: 3, aiLast24h: 9 });
    assert.equal(out.level, 'attention');
    assert.equal(out.items[0].key, 'ai-errors');
    assert.equal(out.items[0].href, '#/ai');
  });

  it('does not call 3 errors healthy even if API attention list is empty', () => {
    const out = resolveCommandCenterStatus({
      aiErrors24h: 3,
      attention: [],
    });
    assert.notEqual(out.level, 'healthy');
    assert.ok(out.items.some((i) => i.key === 'ai-errors'));
  });

  it('marks maintenance and DB failure as degraded', () => {
    const out = resolveCommandCenterStatus({
      dbOk: false,
      maintenanceMode: true,
      aiErrors24h: 1,
    });
    assert.equal(out.level, 'degraded');
    assert.ok(out.items.some((i) => i.severity === 'critical'));
  });

  it('dedupes API AI-rate items when the 24h error item already exists', () => {
    const out = resolveCommandCenterStatus({
      aiErrors24h: 4,
      attention: [{
        severity: 'warning',
        title: 'AI შეცდომის წილი მომატებულია',
        detail: '4 შეცდომა',
        href: '#/ai',
      }],
    });
    assert.equal(out.items.filter((i) => /AI/.test(i.title)).length, 1);
  });

  it('drops low-value info items from the operator list', () => {
    const out = resolveCommandCenterStatus({
      attention: [{
        severity: 'info',
        title: 'რეგისტრაცია დახურულია',
        href: '#/settings',
      }],
    });
    assert.equal(out.level, 'healthy');
    assert.equal(out.items.length, 0);
  });
});
