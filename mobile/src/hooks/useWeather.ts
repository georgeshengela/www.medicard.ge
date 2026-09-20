import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/store/AuthContext';
import { locationFromProfile } from '@/lib/userLocation';
import { locationChangedMeaningfully } from '@/lib/weather/cache';
import {
  getWeatherWellnessRecommendation,
  loadWeatherSnapshot,
  loadWeatherWellnessContext,
  readWeatherCache,
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

function applySnapshot(
  snapshot: WeatherSnapshot,
  extra: Partial<WeatherState> & Pick<WeatherState, 'fromCache' | 'stale'>,
  ctx?: Parameters<typeof getWeatherWellnessRecommendation>[1],
): WeatherState {
  return {
    snapshot,
    recommendation: getWeatherWellnessRecommendation(snapshot, ctx ?? { locale: 'ka' }),
    loading: extra.loading ?? false,
    unavailable: false,
    fromCache: extra.fromCache,
    stale: extra.stale,
  };
}

export function useWeather() {
  const { user, healthProfile, ready } = useAuth();
  const profileRef = useRef(healthProfile);
  profileRef.current = healthProfile;
  const coords = weatherCoordsFromProfile(healthProfile);
  const lat = coords?.lat ?? null;
  const lng = coords?.lng ?? null;
  const city = weatherCityFromProfile(healthProfile);
  const loc = locationFromProfile(healthProfile);
  const awaitingFix = Boolean(loc?.enabled && (lat == null || lng == null));
  const [state, setState] = useState<WeatherState>({ ...EMPTY, loading: !ready || Boolean(coords) || awaitingFix });
  const seq = useRef(0);

  useEffect(() => {
    let alive = true;
    void readWeatherCache().then((cached) => {
      if (!alive || !cached?.snapshot || !city || lat == null || lng == null || locationChangedMeaningfully({ lat: cached.latitude, lng: cached.longitude }, { lat, lng })) return;
      setState((prev) => {
        if (prev.snapshot) return prev;
        const snapshot = {
          ...cached.snapshot,
          location: { ...cached.snapshot.location, city },
        };
        return applySnapshot(snapshot, { loading: true, fromCache: true, stale: true }, { locale: 'ka', userKey: user?.id ?? null });
      });
    });
    return () => {
      alive = false;
    };
  }, [city, lat, lng, user?.id]);

  const refresh = useCallback(
    async (force = false) => {
      const ticket = ++seq.current;
      if (!ready || lat == null || lng == null) {
        setState({
          ...EMPTY,
          loading: !ready,
          unavailable: ready && awaitingFix,
        });
        return;
      }
      setState((prev) => ({ ...prev, loading: !prev.snapshot, unavailable: false }));

      const loadOnce = async () => {
        const [loaded, ctx] = await Promise.all([
          loadWeatherSnapshot({ latitude: lat, longitude: lng, city, force }),
          loadWeatherWellnessContext({
            profile: profileRef.current,
            userKey: user?.id ?? null,
            locale: 'ka',
          }),
        ]);
        if (ticket !== seq.current) return false;
        const snapshot = { ...loaded.snapshot, location: { ...loaded.snapshot.location, city } };
        setState(applySnapshot(snapshot, { fromCache: loaded.fromCache, stale: loaded.stale }, ctx));
        if (!loaded.stale) {
          void import('@/lib/mediNotificationBrain').then(({ requestEngageRefresh }) => requestEngageRefresh());
        }
        return true;
      };

      try {
        await loadOnce();
      } catch {
        if (ticket !== seq.current) return;
        try {
          await new Promise((resolve) => setTimeout(resolve, 700));
          if (ticket !== seq.current) return;
          await loadOnce();
        } catch {
          if (ticket !== seq.current) return;
          setState((prev) => ({
            ...prev,
            loading: false,
            unavailable: !prev.snapshot,
          }));
        }
      }
    },
    [awaitingFix, city, lat, lng, ready, user?.id],
  );

  useEffect(() => {
    setState({ ...EMPTY, loading: !ready || (lat != null && lng != null) });
    void refresh(false);
    return () => { seq.current += 1; };
  }, [refresh]);

  return { ...state, refresh };
}
