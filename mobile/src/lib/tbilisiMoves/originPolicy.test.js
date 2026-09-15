import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  hasCompetitionStepsGrant,
  healthConnectOriginId,
  originTotalsFromHealthConnectRecords,
  originTotalsFromHealthKitSources,
  pickHighestOrigin,
  recordOverlapsInterval,
} from './originPolicy.js';

describe('tbilisi moves origin policy', () => {
  it('excludes Health Connect manual records and does not sum overlapping origins', () => {
    const start = '2026-09-14T00:00:00.000+04:00';
    const mid = '2026-09-14T12:00:00.000+04:00';
    const end = '2026-09-14T18:00:00.000+04:00';
    const { totals, manualCount } = originTotalsFromHealthConnectRecords([
      {
        startTime: start,
        endTime: end,
        count: 4000,
        metadata: { dataOrigin: 'phone', recordingMethod: 2 },
      },
      {
        startTime: start,
        endTime: mid,
        count: 3500,
        metadata: { dataOrigin: 'watch', recordingMethod: 2 },
      },
      {
        startTime: start,
        endTime: end,
        count: 9999,
        metadata: { dataOrigin: 'typed', recordingMethod: 3 },
      },
    ]);
    assert.equal(manualCount, 1);
    assert.equal(pickHighestOrigin(totals).origin, 'phone');
    assert.equal(pickHighestOrigin(totals).steps, 4000);
    const naive = 4000 + 3500 + 9999;
    assert.ok(pickHighestOrigin(totals).steps < naive);
  });

  it('takes max count inside an overlapping cluster instead of summing it', () => {
    const { totals } = originTotalsFromHealthConnectRecords([
      {
        startTime: '2026-09-14T00:00:00.000+04:00',
        endTime: '2026-09-14T10:00:00.000+04:00',
        count: 2000,
        metadata: { dataOrigin: 'phone', recordingMethod: 2 },
      },
      {
        startTime: '2026-09-14T08:00:00.000+04:00',
        endTime: '2026-09-14T12:00:00.000+04:00',
        count: 1500,
        metadata: { dataOrigin: 'phone', recordingMethod: 2 },
      },
    ]);
    assert.equal(totals[0].steps, 2000);
  });

  it('picks the highest HealthKit source without summing sources', () => {
    const totals = originTotalsFromHealthKitSources([
      { source: { bundleIdentifier: 'watch' }, sumQuantity: { quantity: 6200 } },
      { source: { bundleIdentifier: 'phone' }, sumQuantity: { quantity: 4100 } },
    ]);
    assert.equal(pickHighestOrigin(totals).origin, 'watch');
    assert.equal(pickHighestOrigin(totals).steps, 6200);
  });

  it('accepts Health Connect grant shapes Home already treats as connected', () => {
    assert.equal(hasCompetitionStepsGrant([{ recordType: 'Steps', accessType: 'read' }]), true);
    assert.equal(hasCompetitionStepsGrant([{ recordType: 'STEPS', accessType: 'READ' }]), true);
    assert.equal(hasCompetitionStepsGrant([{ recordType: 'Weight', accessType: 'read' }]), false);
    assert.equal(healthConnectOriginId({ packageName: 'com.google.android.apps.fitness' }), 'com.google.android.apps.fitness');
    assert.equal(healthConnectOriginId({}), '_unknown');
  });

  it('keeps a full-day Health Connect bucket that ends after now', () => {
    const start = Date.parse('2026-09-15T00:00:00.000+04:00');
    const now = Date.parse('2026-09-15T15:00:00.000+04:00');
    assert.equal(
      recordOverlapsInterval(
        {
          startTime: '2026-09-15T00:00:00.000+04:00',
          endTime: '2026-09-15T23:59:59.000+04:00',
          count: 583,
        },
        start,
        now,
      ),
      true,
    );
  });
});
