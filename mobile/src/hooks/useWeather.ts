import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/store/AuthContext';
import {
  getWeatherWellnessRecommendation,
  loadWeatherSnapshot,
  loadWeatherWellnessContext,
  weatherCityFromProfile,
  weatherCoordsFromProfile,
  type WeatherRecommendation,
  type WeatherSnapshot,
} from '@/lib/weather';

export type WeatherState = {
  snapshot: WeatherSnapshot | null;
  recommendation: WeatherRecommendation | null;
  loading: boolean;
  unavailable: boolean;
  fromCache: boolean;
  stale: boolean;
};

const EMPTY: WeatherState = {
  snapshot: null,
  recommendation: null,
  loading: false,
  unavailable: false,
  fromCache: false,
  stale: false,
};

export function useWeather() {
  const { user, healthProfile } = useAuth();
  const [state, setState] = useState<WeatherState>({ ...EMPTY, loading: true });
  const seq = useRef(0);

  const refresh = useCallback(
    async (force = false) => {
      const coords = weatherCoordsFromProfile(healthProfile);
      if (!coords) {
        setState({ ...EMPTY, loading: false, unavailable: false });
        return;
      }
      const ticket = ++seq.current;
      setState((prev) => ({ ...prev, loading: !prev.snapshot }));
      try {
        const city = weatherCityFromProfile(healthProfile);
        const [loaded, ctx] = await Promise.all([
          loadWeatherSnapshot({ ...coords, city, force }),
          loadWeatherWellnessContext({
            profile: healthProfile,
            userKey: user?.id ?? null,
            locale: 'ka',
          }),
        ]);
        if (ticket !== seq.current) return;
        const snapshot = { ...loaded.snapshot, location: { ...loaded.snapshot.location, city } };
        setState({
          snapshot,
          recommendation: getWeatherWellnessRecommendation(snapshot, ctx),
          loading: false,
          unavailable: false,
          fromCache: loaded.fromCache,
          stale: loaded.stale,
        });
        if (!loaded.stale) {
          void import('@/lib/mediNotificationBrain').then(({ requestEngageRefresh }) => requestEngageRefresh());
        }
      } catch {
        if (ticket !== seq.current) return;
        setState((prev) => ({
          ...prev,
          loading: false,
          unavailable: !prev.snapshot,
        }));
      }
    },
    [healthProfile, user?.id],
  );

  useEffect(() => {
    void refresh(false);
  }, [refresh]);

  return { ...state, refresh };
}
