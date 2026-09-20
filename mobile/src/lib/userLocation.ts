import * as Location from 'expo-location';
import { api, type HealthProfile, type UserLocationSnapshot } from '@/lib/api';
import { formatPlaceLine, resolvePlace } from '@/lib/geoPlace';
import { isFreshLocationTimestamp, type LocationFixSample } from '@/lib/locationFix';
import { localAccountId } from '@/lib/localAccount';
import { getPreference, getToken, setPreference } from '@/lib/storage';
import { hasResolvedLocation } from '@/lib/locationCompletion';

const PROMPTED_PREF = 'medicard.location.prompted';
const POSTPONED_PREF = 'medicard.location.complete.v2';
export type LocationPermissionState = 'granted' | 'denied' | 'undetermined';
const promptedAccounts = new Set<string>();
let profileListener: { owner: string | null; fn: (profile: HealthProfile) => void } | null = null;

export function emptyLocationSnapshot(): UserLocationSnapshot {
  return { prompted: false, enabled: false, countryCode: null, countryKa: null, cityKa: null, lat: null, lng: null, accuracy: null, updatedAt: null };
}
export function locationFromProfile(profile: HealthProfile | null | undefined): UserLocationSnapshot | null {
  const extra = (profile?.extraAnswers ?? {}) as Record<string, unknown>;
  const loc = extra.location as Record<string, unknown> | undefined;
  if (!loc || typeof loc !== 'object') return extra.locationPrompted === true ? { ...emptyLocationSnapshot(), prompted: true } : null;
  return { prompted: extra.locationPrompted === true || loc.prompted === true, enabled: loc.enabled === true,
    countryCode: typeof loc.countryCode === 'string' ? loc.countryCode : null,
    countryKa: typeof loc.countryKa === 'string' ? loc.countryKa : null,
    cityKa: typeof loc.cityKa === 'string' ? loc.cityKa : null,
    lat: typeof loc.lat === 'number' && Number.isFinite(loc.lat) ? loc.lat : null,
    lng: typeof loc.lng === 'number' && Number.isFinite(loc.lng) ? loc.lng : null,
    accuracy: typeof loc.accuracy === 'number' ? loc.accuracy : null,
    updatedAt: typeof loc.updatedAt === 'string' ? loc.updatedAt : null };
}
export function isLocationPrompted(profile: HealthProfile | null | undefined): boolean {
  return promptedAccounts.has(localAccountId() || '') || locationFromProfile(profile)?.prompted === true;
}
export function markLocationPromptedLocal(owner = localAccountId()) {
  if (!owner) return;
  promptedAccounts.add(owner);
  void setPreference(`${PROMPTED_PREF}.${owner}`, '1');
}
export async function hydrateLocationPromptedPref() {
  const owner = localAccountId();
  if (owner && await getPreference(`${PROMPTED_PREF}.${owner}`) === '1') promptedAccounts.add(owner);
  return !!owner && promptedAccounts.has(owner);
}
export async function locationPostponedAt(owner: string) {
  const value = Number(await getPreference(`${POSTPONED_PREF}.${owner}`));
  return Number.isFinite(value) && value > 0 ? value : null;
}
export async function postponeLocation(owner = localAccountId()) {
  if (owner) await setPreference(`${POSTPONED_PREF}.${owner}`, String(Date.now()));
}
export function livingPlaceLine(profile: HealthProfile | null | undefined): string {
  const loc = locationFromProfile(profile);
  return loc?.enabled ? formatPlaceLine(loc) : '';
}
export function applyLocationToProfile(profile: HealthProfile, snapshot: UserLocationSnapshot): HealthProfile {
  return { ...profile, extraAnswers: { ...profile.extraAnswers, locationPrompted: snapshot.prompted, location: snapshot } };
}
export function setLocationProfileListener(fn: ((profile: HealthProfile) => void) | null) {
  profileListener = fn ? { owner: localAccountId(), fn } : null;
}
export function hydrateLocationFromProfile(profile: HealthProfile | null | undefined) {
  if (locationFromProfile(profile)?.prompted) markLocationPromptedLocal();
}
function mapPermission(status: Location.PermissionStatus): LocationPermissionState {
  return status === Location.PermissionStatus.GRANTED ? 'granted' : status === Location.PermissionStatus.DENIED ? 'denied' : 'undetermined';
}
export async function getLocationPermissionState(): Promise<LocationPermissionState> {
  return mapPermission((await Location.getForegroundPermissionsAsync()).status);
}
export async function requestLocationPermission(): Promise<LocationPermissionState> {
  return mapPermission((await Location.requestForegroundPermissionsAsync()).status);
}
function assertOwner(owner: string | null) {
  if (!owner || owner !== localAccountId()) throw new Error('ანგარიში შეიცვალა. თავიდან სცადე.');
}
async function bounded<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  try { return await Promise.race([work, new Promise<T>((_, reject) => { timer = setTimeout(() => reject(new Error('მდებარეობის განსაზღვრას მეტი დრო დასჭირდა. ხელახლა სცადე.')), ms); })]); }
  finally { clearTimeout(timer!); }
}
async function waitForLiveCoords(): Promise<LocationFixSample> {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    let subscription: Location.LocationSubscription | null = null, settled = false;
    const finish = (fix?: Location.LocationObject) => {
      if (settled) return;
      const c = fix?.coords;
      if (fix && (!c || !Number.isFinite(c.latitude) || !Number.isFinite(c.longitude) || Math.abs(c.latitude) > 90 || Math.abs(c.longitude) > 180 || !isFreshLocationTimestamp(fix.timestamp) || fix.timestamp < started - 5000)) return;
      settled = true; clearTimeout(timer); subscription?.remove();
      if (fix && c) resolve({ lat: c.latitude, lng: c.longitude, accuracy: c.accuracy, fixAt: fix.timestamp });
      else reject(new Error('მდებარეობა ვერ განვსაზღვრეთ. შეამოწმე GPS და ხელახლა სცადე.'));
    };
    const timer = setTimeout(() => finish(), 15000);
    Location.watchPositionAsync({ accuracy: Location.Accuracy.Balanced, distanceInterval: 0, timeInterval: 1000, mayShowUserSettingsDialog: true }, finish)
      .then(next => { subscription = next; if (settled) next.remove(); })
      .catch(() => finish());
  });
}
async function saveLocation(owner: string | null, token: string | null, body: Parameters<typeof api.location.ping>[0]) {
  assertOwner(owner);
  const result = await api.location.ping(body, token);
  assertOwner(owner);
  markLocationPromptedLocal(owner);
  if (result.profile && profileListener?.owner === owner) profileListener.fn(result.profile);
  const { clearWeatherCache } = await import('@/lib/weather/cache');
  if (owner === localAccountId()) await clearWeatherCache(owner).catch(() => undefined);
  return result;
}
export async function grantUserLocation(): Promise<{ granted: boolean; hasFix: boolean; snapshot: UserLocationSnapshot; profile: HealthProfile | null }> {
  const owner = localAccountId();
  // Start the OS request directly from the button gesture, before storage/network awaits.
  const permissionRequest = requestLocationPermission();
  const [permission, token] = await Promise.all([permissionRequest, getToken()]);
  assertOwner(owner);
  if (permission !== 'granted') return { granted: false, hasFix: false, snapshot: emptyLocationSnapshot(), profile: null };
  const coords = await waitForLiveCoords();
  assertOwner(owner);
  let place = { countryCode: null, countryKa: null, cityKa: null } as ReturnType<typeof resolvePlace>;
  try {
    const rows = await bounded(Location.reverseGeocodeAsync({ latitude: coords.lat, longitude: coords.lng }), 5000);
    const row = rows[0];
    if (row) place = resolvePlace({ countryCode: row.isoCountryCode, countryName: row.country, city: row.city || row.subregion || row.district || row.region, region: row.region });
  } catch { /* The server can resolve the same fresh coordinates. */ }
  const result = await saveLocation(owner, token, { ...coords, place, enabled: true, prompted: true, source: 'grant' });
  if (!hasResolvedLocation(result.location)) throw new Error('ქალაქი ვერ მოიძებნა. შეამოწმე ინტერნეტი და ხელახლა სცადე.');
  return { granted: true, hasFix: true, snapshot: result.location, profile: result.profile };
}
export async function persistLocationConsent(input: { enabled: boolean; prompted?: boolean; source: 'grant' | 'skip' | 'revoke' }): Promise<UserLocationSnapshot> {
  const owner = localAccountId(), token = await getToken();
  const result = await saveLocation(owner, token, { ...input, prompted: input.prompted ?? true });
  return result.location;
}
export async function skipUserLocation(): Promise<UserLocationSnapshot> {
  const owner = localAccountId(), token = await getToken();
  assertOwner(owner);
  await postponeLocation(owner);
  return (await saveLocation(owner, token, { enabled: false, prompted: true, source: 'skip' })).location;
}
export async function revokeUserLocation(): Promise<UserLocationSnapshot> {
  return persistLocationConsent({ enabled: false, prompted: true, source: 'revoke' });
}
// Home place is explicit; MEDIRUN has its own session-scoped location watch.
export function stopLiveLocationWatch() {}
export async function startLiveLocationIfEnabled(profile?: HealthProfile | null) {
  if (profile) hydrateLocationFromProfile(profile);
}
