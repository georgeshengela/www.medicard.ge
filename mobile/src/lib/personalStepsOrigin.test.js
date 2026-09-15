import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { describePersonalStepsOrigin } from './personalStepsOrigin.js';

describe('personal steps origin', () => {
  it('labels Expo Go Home totals as stored daily, never HealthKit', () => {
    const origin = describePersonalStepsOrigin({
      expoGo: true,
      healthSyncEnabled: true,
      nativeSampleCount: 0,
      deviceLocalYmd: '2026-09-15',
      tbilisiYmd: '2026-09-15',
      dailyRow: { date: '2026-09-15', steps: 1240, source: 'merged', syncedAt: '2026-09-15T08:00:00.000Z' },
      todayStepLogCount: 1,
      todayStepLogSum: 1240,
      displayTotal: 1240,
      pullKind: 'api',
    });
    assert.equal(origin.displaySource, 'health_metric_daily');
    assert.equal(origin.nativeUsed, false);
    assert.equal(origin.nativeSkipped, 'expo_go');
    assert.equal(origin.dailySource, 'merged');
    assert.equal(origin.displayTotal, 1240);
    assert.equal(origin.competitionEligible, false);
    assert.equal(origin.tbilisiMatchesDeviceDay, true);
  });

  it('does not treat empty native samples as a live sensor total', () => {
    const origin = describePersonalStepsOrigin({
      expoGo: false,
      healthSyncEnabled: false,
      nativeSampleCount: 0,
      deviceLocalYmd: '2026-09-15',
      tbilisiYmd: '2026-09-14',
      dailyRow: { steps: 800, source: 'merged', syncedAt: '2026-09-14T22:00:00.000Z' },
      displayTotal: 800,
      pullKind: 'cache',
    });
    assert.equal(origin.displaySource, 'health_metric_daily');
    assert.equal(origin.nativeSkipped, 'not_connected');
    assert.equal(origin.tbilisiMatchesDeviceDay, false);
    assert.equal(origin.competitionEligible, false);
  });
});
