'use strict';

/**
 * Classify the Home / personal-steps number. Not a competition observation.
 * Never treat HealthMetricDaily or StepLog as HealthKit / Health Connect.
 */
export function describePersonalStepsOrigin(input = {}) {
  const expoGo = Boolean(input.expoGo);
  const healthSyncEnabled = Boolean(input.healthSyncEnabled);
  const nativeSampleCount = Number(input.nativeSampleCount) || 0;
  const nativeUsed = nativeSampleCount > 0 && !expoGo && healthSyncEnabled;
  const dailySteps =
    input.dailyRow && input.dailyRow.steps != null && Number.isFinite(Number(input.dailyRow.steps))
      ? Number(input.dailyRow.steps)
      : null;
  const todayStepLogCount = Number(input.todayStepLogCount) || 0;
  const todayStepLogSum = Number(input.todayStepLogSum) || 0;
  const displayTotal = Number(input.displayTotal) || 0;

  let displaySource = 'empty';
  if (nativeUsed) displaySource = 'native_device';
  else if (dailySteps != null && dailySteps > 0) displaySource = 'health_metric_daily';
  else if (todayStepLogCount > 0) displaySource = 'step_log';

  let nativeSkipped = 'none';
  if (expoGo) nativeSkipped = 'expo_go';
  else if (!healthSyncEnabled) nativeSkipped = 'not_connected';

  return {
    displaySource,
    expoGo,
    nativeUsed,
    nativeSampleCount,
    nativeSkipped,
    deviceLocalYmd: input.deviceLocalYmd || null,
    tbilisiYmd: input.tbilisiYmd || null,
    tbilisiMatchesDeviceDay: Boolean(input.deviceLocalYmd) && input.deviceLocalYmd === input.tbilisiYmd,
    dailySource: input.dailyRow?.source ?? null,
    dailySteps,
    dailySyncedAt: input.dailyRow?.syncedAt ?? null,
    todayStepLogCount,
    todayStepLogSum,
    displayTotal,
    pullKind: input.pullKind || 'unknown',
    competitionEligible: false,
    competitionSkipReason:
      'Personal HealthMetricDaily/StepLog is device-local, source=merged, and cannot distinguish HealthKit, Health Connect, typed steps, or overlapping origins.',
  };
}
