import type { HealthProfile } from '@/lib/api';
import { getCachedTodaySteps } from '@/lib/healthDataSync';
import { dayTotalMl, loadHydrationGoalMl, loadHydrationLogs, todayYmd } from '@/lib/hydration';
import { daysBetween, loadStepsGoal } from '@/lib/stepsGoal';
import { cityNameKa } from '@/lib/geoPlace';
import { locationFromProfile } from '@/lib/userLocation';
import type { WeatherLang, WeatherWellnessContext } from './types.ts';

export function weatherCityFromProfile(profile: HealthProfile | null | undefined): string | null {
  const loc = locationFromProfile(profile);
  return cityNameKa(loc?.cityKa) || loc?.cityKa || null;
}

export function weatherCoordsFromProfile(
  profile: HealthProfile | null | undefined,
): { lat: number; lng: number } | null {
  const loc = locationFromProfile(profile);
  if (typeof loc?.lat === 'number' && typeof loc?.lng === 'number') {
    return { lat: loc.lat, lng: loc.lng };
  }
  return null;
}

export async function loadWeatherWellnessContext(input: {
  profile?: HealthProfile | null;
  userKey?: string | null;
  locale?: WeatherLang;
  now?: Date;
  loggedPain?: boolean;
}): Promise<WeatherWellnessContext> {
  const [todaySteps, goal, logs, hydrationGoal] = await Promise.all([
    getCachedTodaySteps().catch(() => null),
    loadStepsGoal().catch(() => null),
    loadHydrationLogs().catch(() => []),
    loadHydrationGoalMl().catch(() => 2000),
  ]);
  let stepsDailyTarget: number | null = null;
  if (goal) {
    const span = Math.max(1, daysBetween(goal.startedYmd, goal.deadlineYmd) + 1);
    stepsDailyTarget = Math.max(1500, Math.round(goal.targetSteps / span));
  }
  return {
    now: input.now ?? new Date(),
    todaySteps: todaySteps != null && todaySteps >= 0 ? todaySteps : null,
    stepsDailyTarget,
    hydrationMl: dayTotalMl(logs, todayYmd()),
    hydrationGoalMl: hydrationGoal,
    loggedPain: Boolean(input.loggedPain),
    locale: input.locale ?? 'ka',
    userKey: input.userKey ?? null,
  };
}
