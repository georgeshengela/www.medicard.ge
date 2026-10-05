import { useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { useAuth } from '@/store/AuthContext';
import { metersBetween, placeCityDisplay, resolvePlace } from '@/lib/geoPlace';
import { localAccountId } from '@/lib/localAccount';
import { readWeatherCache } from '@/lib/weather/cache';
import { fetchOpenMeteoSnapshot } from '@/lib/weather/openMeteo';
import { weatherCityFromProfile, weatherCoordsFromProfile } from '@/lib/weather/context';
import type { WeatherSnapshot } from '@/lib/weather';
import { WEATHER_CACHE_TTL_MS } from '@/lib/weather/types';
import { RUN_WEATHER_MOVE_M, RUN_WEATHER_REFRESH_MS } from '@/lib/run/runWeather';
import type { LatLng } from '@/lib/run/geo';

export type RunWeather = { snapshot: WeatherSnapshot; city: string | null };

/**
 * Weather where the runner actually is (the session's GPS), not the saved home place, so the map's
 * rain is the rain on their head. Memory only: it never writes the shared weather cache, which the
 * notification brain reads as "the weather at home". Re-read every 15 min or after 2.5 km.
 */
let memory: { owner: string | null; at: LatLng; fetchedAt: number; value: RunWeather } | null = null;
const HOME_CITY_RADIUS_M = 25_000;

async function cityAt(at: LatLng, homeCity: string | null, home: LatLng | null): Promise<string | null> {
  if (homeCity && home && metersBetween(home, at) < HOME_CITY_RADIUS_M) return homeCity;
  try {
    const rows = await Promise.race([
      Location.reverseGeocodeAsync({ latitude: at.lat, longitude: at.lng }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('geocode_timeout')), 5000)),
    ]);
    const row = rows[0];
    if (!row) return homeCity;
    return placeCityDisplay(resolvePlace({ countryCode: row.isoCountryCode, countryName: row.country, city: row.city || row.subregion || row.district || row.region, region: row.region })) || null;
  } catch {
    return null;
  }
}

async function load(at: LatLng, homeCity: string | null, home: LatLng | null): Promise<RunWeather> {
  const owner = localAccountId();
  // The Home/weather screens may already hold a fresh reading for this very place.
  const cached = await readWeatherCache().catch(() => null);
  const cityPromise = cityAt(at, homeCity, home);
  let snapshot: WeatherSnapshot;
  if (cached && Date.now() - cached.fetchedAt < WEATHER_CACHE_TTL_MS && metersBetween({ lat: cached.latitude, lng: cached.longitude }, at) < RUN_WEATHER_MOVE_M) {
    snapshot = cached.snapshot;
  } else {
    snapshot = await fetchOpenMeteoSnapshot(at.lat, at.lng, null);
  }
  const value = { snapshot, city: await cityPromise };
  memory = { owner, at, fetchedAt: Date.now(), value };
  return value;
}

function fresh(at: LatLng | null): RunWeather | null {
  if (!memory || !at || memory.owner !== localAccountId()) return null;
  if (Date.now() - memory.fetchedAt > RUN_WEATHER_REFRESH_MS) return null;
  return metersBetween(memory.at, at) < RUN_WEATHER_MOVE_M ? memory.value : null;
}

export function useRunWeather(position: LatLng | null, enabled: boolean): RunWeather | null {
  const { healthProfile } = useAuth();
  const homeCity = weatherCityFromProfile(healthProfile);
  const home = weatherCoordsFromProfile(healthProfile);
  const [value, setValue] = useState<RunWeather | null>(() => (enabled ? fresh(position) ?? memory?.value ?? null : null));
  const posRef = useRef(position);
  posRef.current = position;
  const busy = useRef(false);
  const lat = position?.lat ?? null;
  const lng = position?.lng ?? null;

  useEffect(() => {
    if (!enabled) {
      setValue(null);
      return undefined;
    }
    let alive = true;
    const check = () => {
      const at = posRef.current;
      if (!at || busy.current) return;
      const hit = fresh(at);
      if (hit) {
        setValue(hit);
        return;
      }
      busy.current = true;
      load(at, homeCity, home)
        .then((next) => {
          if (alive) setValue(next);
        })
        .catch(() => undefined)
        .finally(() => {
          busy.current = false;
        });
    };
    check();
    const timer = setInterval(check, 60_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
    // Rounded position: a new fix a few metres on does not restart the effect; 2.5 km is checked inside.
  }, [enabled, lat == null ? null : Math.round(lat * 50), lng == null ? null : Math.round(lng * 50), homeCity]);

  return value;
}
