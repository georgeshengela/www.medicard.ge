import * as Location from 'expo-location';
import { Platform } from 'react-native';
import { api, type HealthProfile, type UserLocationSnapshot } from '@/lib/api';
import { formatPlaceLine, resolvePlace } from '@/lib/geoPlace';
import {
  isFreshLocationTimestamp,
  isInGeorgiaBox,
  pickLiveLocationFix,
  type LocationFixSample,
} from '@/lib/locationFix';
import { getPreference, setPreference } from '@/lib/storage';

const LIVE_FIX_WAIT_MS = 12_000;

const PROMPTED_PREF = 'medicard.location.prompted';

export type LocationPermissionState = 'granted' | 'denied' | 'undetermined';

let watchSub: Location.LocationSubscription | null = null;
let optedIn = false;
let pinging = false;
let localPrompted = false;
let profileListener: ((profile: HealthProfile) => void) | null = null;

export function emptyLocationSnapshot(): UserLocationSnapshot {
  return {
    prompted: false,
    enabled: false,
    countryCode: null,
    countryKa: null,
    cityKa: null,
    lat: null,
    lng: null,
    accuracy: null,
    updatedAt: null,
  };
}

export function locationFromProfile(profile: HealthProfile | null | undefined): UserLocationSnapshot | null {
  const extra = (profile?.extraAnswers ?? {}) as Record<string, unknown>;
  const raw = extra.location;
  if (!raw || typeof raw !== 'object') {
    if (extra.locationPrompted === true) {
      return { ...emptyLocationSnapshot(), prompted: true };
    }
    return null;
  }
  const loc = raw as Record<string, unknown>;
  return {
    prompted: extra.locationPrompted === true || loc.prompted === true,
    enabled: loc.enabled === true,
    countryCode: typeof loc.countryCode === 'string' ? loc.countryCode : null,
    countryKa: typeof loc.countryKa === 'string' ? loc.countryKa : null,
    cityKa: typeof loc.cityKa === 'string' ? loc.cityKa : null,
    lat: typeof loc.lat === 'number' ? loc.lat : null,
    lng: typeof loc.lng === 'number' ? loc.lng : null,
    accuracy: typeof loc.accuracy === 'number' ? loc.accuracy : null,
    updatedAt: typeof loc.updatedAt === 'string' ? loc.updatedAt : null,
  };
}

export function isLocationPrompted(profile: HealthProfile | null | undefined): boolean {
  if (localPrompted) return true;
  const extra = (profile?.extraAnswers ?? {}) as Record<string, unknown>;
  if (extra.locationPrompted === true) return true;
  const loc = locationFromProfile(profile);
  return loc?.prompted === true;
}

export function markLocationPromptedLocal() {
  localPrompted = true;
  void setPreference(PROMPTED_PREF, '1');
}

export async function hydrateLocationPromptedPref(): Promise<boolean> {
  const value = await getPreference(PROMPTED_PREF);
  if (value === '1') localPrompted = true;
  return localPrompted;
}

export function livingPlaceLine(profile: HealthProfile | null | undefined): string {
  const loc = locationFromProfile(profile);
  if (!loc?.enabled) return '';
  return formatPlaceLine({
    countryCode: loc.countryCode,
    countryKa: loc.countryKa,
    cityKa: loc.cityKa,
  });
}

export function applyLocationToProfile(
  profile: HealthProfile,
  snapshot: UserLocationSnapshot,
): HealthProfile {
  return {
    ...profile,
    extraAnswers: {
      ...profile.extraAnswers,
      locationPrompted: snapshot.prompted,
      location: snapshot,
    },
  };
}

export function setLocationProfileListener(fn: ((profile: HealthProfile) => void) | null) {
  profileListener = fn;
}

export function hydrateLocationFromProfile(profile: HealthProfile | null | undefined) {
  const loc = locationFromProfile(profile);
  if (loc?.prompted || (profile?.extraAnswers as Record<string, unknown> | undefined)?.locationPrompted === true) {
    localPrompted = true;
  }
  optedIn = loc?.enabled === true;
}

function mapPermission(status: Location.PermissionStatus): LocationPermissionState {
  if (status === Location.PermissionStatus.GRANTED) return 'granted';
  if (status === Location.PermissionStatus.DENIED) return 'denied';
  return 'undetermined';
}

export async function getLocationPermissionState(): Promise<LocationPermissionState> {
  const current = await Location.getForegroundPermissionsAsync();
  return mapPermission(current.status);
}

export async function requestLocationPermission(): Promise<LocationPermissionState> {
  const next = await Location.requestForegroundPermissionsAsync();
  return mapPermission(next.status);
}

function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  } catch {
    return '';
  }
}

function sampleFromFix(fix: Location.LocationObject | null | undefined): LocationFixSample | null {
  if (!fix) return null;
  const lat = fix.coords.latitude;
  const lng = fix.coords.longitude;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const stamp = Number(fix.timestamp);
  if (!isFreshLocationTimestamp(stamp)) return null;
  return {
    lat,
    lng,
    accuracy: Number.isFinite(fix.coords.accuracy) ? fix.coords.accuracy : null,
    fixAt: stamp,
  };
}

async function waitForLiveCoords(): Promise<LocationFixSample | null> {
  const timeZone = deviceTimeZone();
  const samples: LocationFixSample[] = [];
  if (Platform.OS === 'android') {
    try {
      await Location.enableNetworkProviderAsync();
    } catch {
      /* user declined the accuracy dialog */
    }
  }

  await new Promise<void>((resolve) => {
    let sub: Location.LocationSubscription | null = null;
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      sub?.remove();
      resolve();
    };
    const timer = setTimeout(finish, LIVE_FIX_WAIT_MS);
    Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Highest,
        distanceInterval: 0,
        timeInterval: 800,
        mayShowUserSettingsDialog: true,
      },
      (fix) => {
        const sample = sampleFromFix(fix);
        if (!sample) return;
        samples.push(sample);
        if (!isInGeorgiaBox(sample.lat, sample.lng)) finish();
      },
    )
      .then((subscription) => {
        sub = subscription;
        if (settled) sub.remove();
      })
      .catch(() => finish());
  });

  const watched = pickLiveLocationFix(samples, timeZone);
  if (watched) return watched;

  try {
    const fallback = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
      mayShowUserSettingsDialog: true,
    });
    return pickLiveLocationFix([sampleFromFix(fallback)].filter(Boolean) as LocationFixSample[], timeZone);
  } catch {
    return null;
  }
}

async function reverseGeocodePlace(lat: number, lng: number) {
  try {
    const rows = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    const row = rows[0];
    if (!row) return { countryCode: null, countryKa: null, cityKa: null };
    return resolvePlace({
      countryCode: row.isoCountryCode,
      countryName: row.country,
      city: row.city || row.subregion,
      district: row.district,
      region: row.region,
    });
  } catch {
    return { countryCode: null, countryKa: null, cityKa: null };
  }
}

async function persistSnapshotOnProfile(snapshot: UserLocationSnapshot): Promise<HealthProfile | null> {
  try {
    const result = await api.healthProfile.update({
      extraAnswers: {
        locationPrompted: snapshot.prompted,
        location: snapshot,
      },
    });
    if (result.profile && profileListener) profileListener(result.profile);
    return result.profile;
  } catch {
    return null;
  }
}

async function pingServer(
  body: Parameters<typeof api.location.ping>[0],
): Promise<{ location: UserLocationSnapshot; profile: HealthProfile | null } | null> {
  if (pinging) return null;
  pinging = true;
  try {
    const result = await api.location.ping(body);
    if (result.location.enabled) optedIn = true;
    if (result.location.enabled === false) optedIn = false;
    if (result.profile && profileListener) profileListener(result.profile);
    return result;
  } catch {
    return null;
  } finally {
    pinging = false;
  }
}

async function forgetWeatherPlace() {
  try {
    const { clearWeatherCache } = await import('@/lib/weather/cache');
    await clearWeatherCache();
  } catch {
    /* weather cache is optional */
  }
}

async function persistSnapshot(
  snapshot: UserLocationSnapshot,
  pingBody?: Parameters<typeof api.location.ping>[0],
): Promise<{ snapshot: UserLocationSnapshot; profile: HealthProfile | null }> {
  markLocationPromptedLocal();
  optedIn = snapshot.enabled;
  const live = pingBody
    ? await pingServer({
        ...pingBody,
        timeZone: pingBody.timeZone || deviceTimeZone(),
      })
    : null;
  const next = preferLivePlace(live?.location, snapshot);
  const profile =
    next !== live?.location
      ? (await persistSnapshotOnProfile(next)) ?? live?.profile ?? null
      : live?.profile ?? (await persistSnapshotOnProfile(next));
  await forgetWeatherPlace();
  return { snapshot: next, profile };
}

function preferLivePlace(
  server: UserLocationSnapshot | null | undefined,
  client: UserLocationSnapshot,
): UserLocationSnapshot {
  if (!server) return client;
  const clientLive =
    typeof client.lat === 'number' &&
    typeof client.lng === 'number' &&
    !isInGeorgiaBox(client.lat, client.lng);
  const serverTbilisi =
    server.cityKa === 'თბილისი' ||
    (typeof server.lat === 'number' &&
      typeof server.lng === 'number' &&
      isInGeorgiaBox(server.lat, server.lng));
  if (clientLive && serverTbilisi) return client;
  return server;
}

export async function persistLocationConsent(input: {
  enabled: boolean;
  prompted?: boolean;
  source: 'grant' | 'skip' | 'revoke';
}): Promise<UserLocationSnapshot> {
  const snapshot: UserLocationSnapshot = {
    ...emptyLocationSnapshot(),
    prompted: input.prompted ?? true,
    enabled: input.enabled,
    updatedAt: new Date().toISOString(),
  };
  const saved = await persistSnapshot(snapshot, {
    enabled: input.enabled,
    prompted: snapshot.prompted,
    source: input.source,
  });
  return saved.snapshot;
}

export async function grantUserLocation(): Promise<{
  granted: boolean;
  hasFix: boolean;
  snapshot: UserLocationSnapshot;
  profile: HealthProfile | null;
}> {
  const permission = await requestLocationPermission();
  markLocationPromptedLocal();
  if (permission !== 'granted') {
    const saved = await persistSnapshot(
      {
        ...emptyLocationSnapshot(),
        prompted: true,
        enabled: false,
        updatedAt: new Date().toISOString(),
      },
      { enabled: false, prompted: true, source: 'skip' },
    );
    return { granted: false, hasFix: false, snapshot: saved.snapshot, profile: saved.profile };
  }

  const coords = await waitForLiveCoords();
  const place = coords ? await reverseGeocodePlace(coords.lat, coords.lng) : null;
  const snapshot: UserLocationSnapshot = {
    prompted: true,
    enabled: true,
    countryCode: place?.countryCode ?? null,
    countryKa: place?.countryKa ?? null,
    cityKa: place?.cityKa ?? null,
    lat: coords?.lat ?? null,
    lng: coords?.lng ?? null,
    accuracy: coords?.accuracy ?? null,
    updatedAt: new Date().toISOString(),
  };
  const saved = await persistSnapshot(snapshot, {
    ...(coords ?? {}),
    enabled: true,
    prompted: true,
    source: 'grant',
    timeZone: deviceTimeZone(),
  });
  return { granted: true, hasFix: Boolean(coords), snapshot: saved.snapshot, profile: saved.profile };
}

export async function skipUserLocation(): Promise<UserLocationSnapshot> {
  markLocationPromptedLocal();
  stopLiveLocationWatch();
  return persistLocationConsent({ enabled: false, prompted: true, source: 'skip' });
}

export async function revokeUserLocation(): Promise<UserLocationSnapshot> {
  stopLiveLocationWatch();
  return persistLocationConsent({ enabled: false, prompted: true, source: 'revoke' });
}

export function stopLiveLocationWatch() {
  watchSub?.remove();
  watchSub = null;
}

export async function startLiveLocationIfEnabled(profile?: HealthProfile | null) {
  if (profile) hydrateLocationFromProfile(profile);
  stopLiveLocationWatch();
}
