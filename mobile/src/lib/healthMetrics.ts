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

): Promise<HealthMetricsBundle> {

  const platform = getHealthPlatform();

  const deviceConnected = (await isHealthSyncEnabled()) && isHealthPlatformSupported() && !isExpoGo();



  let nativeRaw: Partial<Record<HealthMetricKey, HealthMetricPoint[]>> = {};

  let stepSamples: StepSample[] = [];



  if (deviceConnected) {

    const impl = await metricsNativeImpl();

    if (impl?.fetchHealthMetricsNative) {

      nativeRaw = await impl.fetchHealthMetricsNative();

    }

    if (impl?.fetchStepsNative) {

      stepSamples = await impl.fetchStepsNative(new Date(`${daysAgo(90)}T00:00:00`));

    }

    void syncNativeHealthToServer(nativeRaw, stepSamples);

  }



  const stored = await pullStoredHealth();

  const mergedRaw = mergeMetricPoints(nativeRaw, storedDailyToRaw(stored.daily));

  const hasStored = stored.daily.length > 0;



  return buildMetricsBundle(

    mergedRaw,

    profile,

    deviceConnected || hasStored,

    platform,

  );

}



export { getHealthPlatform, isHealthPlatformSupported, isHealthSyncEnabled };


