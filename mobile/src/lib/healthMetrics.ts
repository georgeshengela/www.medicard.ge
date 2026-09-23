import Constants from 'expo-constants';

import { Platform } from 'react-native';

import { pullStoredHealth, syncNativeHealthToServer } from '@/lib/healthDataSync';

import { buildMetricsBundle } from '@/lib/healthMetrics.shared';
import { daysAgo, mergeMetricPoints, storedDailyToRaw } from '@/lib/healthMetricsStorage';
import {
  connectHealthApp,
  getHealthPlatform,
  isHealthPlatformSupported,
  isHealthSyncEnabled,
  type HealthConnectResult,
} from '@/lib/healthSync';
import type { HealthProfile } from '@/lib/api';
import type { HealthMetricKey, HealthMetricPoint, HealthMetricsBundle } from '@/types/healthMetrics';

import type { StepSample } from '@/types/stepsMetrics';



function isExpoGo(): boolean {

  return Constants.appOwnership === 'expo';

}



async function metricsNativeImpl() {

  if (Platform.OS === 'ios') return import('@/lib/healthSyncPlatform.ios');

  if (Platform.OS === 'android') return import('@/lib/healthSyncPlatform.android');

  return null;

}



export async function connectDeviceHealth(): Promise<HealthConnectResult> {

  return connectHealthApp();

}



export async function fetchHealthMetrics(

  profile: HealthProfile | null | undefined,
  opts?: { force?: boolean },

): Promise<HealthMetricsBundle> {

  const platform = getHealthPlatform();

  const nativeRuntime = isHealthPlatformSupported() && !isExpoGo();
  const deviceConnected = nativeRuntime && (await isHealthSyncEnabled());
  const storedPromise = pullStoredHealth(undefined, undefined, opts);
  const nativePromise = nativeRuntime
    ? (async () => {
        const impl = await metricsNativeImpl();
        const [metrics, steps] = await Promise.all([
          impl?.fetchHealthMetricsNative ? impl.fetchHealthMetricsNative() : Promise.resolve({} as Partial<Record<HealthMetricKey, HealthMetricPoint[]>>),
          impl?.fetchStepsNative ? impl.fetchStepsNative(new Date(`${daysAgo(90)}T00:00:00`)) : Promise.resolve([] as StepSample[]),
        ]);
        void syncNativeHealthToServer(metrics, steps);
        return { metrics, steps };
      })()
    : Promise.resolve({ metrics: {} as Partial<Record<HealthMetricKey, HealthMetricPoint[]>>, steps: [] as StepSample[] });

  const stored = await storedPromise;
  const native = nativeRuntime
    ? await Promise.race([
        nativePromise,
        new Promise<{ metrics: Partial<Record<HealthMetricKey, HealthMetricPoint[]>>; steps: StepSample[] }>((resolve) =>
          setTimeout(() => resolve({ metrics: {}, steps: [] }), 2000),
        ),
      ])
    : { metrics: {}, steps: [] };

  const nativeRaw = native.metrics;
  const stepSamples = native.steps;

  const mergedRaw = mergeMetricPoints(nativeRaw, storedDailyToRaw(stored.daily));

  const hasStored = stored.daily.length > 0;



  return buildMetricsBundle(

    mergedRaw,

    profile,

    deviceConnected || hasStored || stepSamples.length > 0,

    platform,

  );

}



export { getHealthPlatform, isHealthPlatformSupported, isHealthSyncEnabled };


