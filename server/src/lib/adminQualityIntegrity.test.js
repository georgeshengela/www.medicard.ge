import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

/**
 * Pure helper mirroring getDataQuality version-coverage semantics
 * (distinct users · latest activity row · not raw row counts).
 */
function versionCoverageFromActivity(activityRows) {
  const latestByUser = new Map();
  for (const row of activityRows) {
    const prev = latestByUser.get(row.userId);
    if (!prev || new Date(row.lastAt) > new Date(prev.lastAt)) latestByUser.set(row.userId, row);
  }
  let missing = 0;
  for (const row of latestByUser.values()) {
    if (!row.appVersion) missing += 1;
  }
  const sampled = latestByUser.size;
  return {
    usersMissingAppVersion: missing,
    activeUsersSampled: sampled,
    versionCoverageRate: sampled > 0 ? Math.round((100 * (sampled - missing)) / sampled) : null,
  };
}

describe('quality version coverage (ADM-006)', () => {
  it('counts distinct users from latest activity, not raw rows', () => {
    const rows = [
      { userId: 'a', appVersion: null, lastAt: '2026-09-01T10:00:00.000Z' },
      { userId: 'a', appVersion: null, lastAt: '2026-09-02T10:00:00.000Z' },
      { userId: 'a', appVersion: null, lastAt: '2026-09-03T10:00:00.000Z' },
      { userId: 'b', appVersion: '36.2.0', lastAt: '2026-09-03T10:00:00.000Z' },
    ];
    const legacyRowCountMissing = rows.filter((r) => !r.appVersion).length;
    assert.equal(legacyRowCountMissing, 3);
    const cov = versionCoverageFromActivity(rows);
    assert.equal(cov.usersMissingAppVersion, 1);
    assert.equal(cov.activeUsersSampled, 2);
    assert.equal(cov.versionCoverageRate, 50);
  });

  it('uses latest row so a later versioned activity clears missing', () => {
    const rows = [
      { userId: 'a', appVersion: null, lastAt: '2026-09-01T10:00:00.000Z' },
      { userId: 'a', appVersion: '36.2.0', lastAt: '2026-09-07T10:00:00.000Z' },
    ];
    const cov = versionCoverageFromActivity(rows);
    assert.equal(cov.usersMissingAppVersion, 0);
    assert.equal(cov.versionCoverageRate, 100);
  });
});
