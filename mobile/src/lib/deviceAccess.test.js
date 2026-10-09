import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

describe('device access bootstrap', () => {
  it('asks OS permissions only from a user gesture helper', () => {
    const text = readFileSync(join(here, 'deviceAccess.js'), 'utf8');
    assert.match(text, /askNotificationsFromUserGesture/);
    assert.match(text, /askHealthFromUserGesture/);
    assert.match(text, /askLocationFromUserGesture/);
    assert.match(text, /requestNotificationPermission/);
    assert.match(text, /connectHealthApp/);
    assert.match(text, /requestLocationPermission/);
    assert.doesNotMatch(text, /export async function bootstrapDeviceAccess/);
    assert.doesNotMatch(text, /InteractionManager/);
  });

  it('permission gate host requests from the enable button', () => {
    const host = readFileSync(join(here, '../components/permissions/PermissionGateHost.tsx'), 'utf8');
    assert.match(host, /requestNotificationPermission/);
    assert.match(host, /connectHealthApp/);
    assert.match(host, /copy\.cta/);
    assert.doesNotMatch(host, /from 'react-native'.*Modal/);
    assert.doesNotMatch(host, /<Modal/);
    assert.doesNotMatch(host, /Linking\.openSettings/);
    assert.doesNotMatch(host, /style=\{\(\{ pressed \}\)/);
  });

  it('notification request never bails on denied before asking the OS', () => {
    const text = readFileSync(join(here, 'notifications.ts'), 'utf8');
    const fn = text.slice(
      text.indexOf('export async function requestNotificationPermission'),
      text.indexOf('export async function notificationCanAskAgain'),
    );
    assert.match(fn, /requestPermissionsAsync/);
    assert.doesNotMatch(fn, /await Notifications\.getPermissionsAsync/);
    assert.doesNotMatch(fn, /canAskAgain === false\) return false/);
    assert.doesNotMatch(fn, /await ensureAndroidChannels/);
  });

  it('profile-setup continue requests the OS notification sheet', () => {
    const text = readFileSync(join(here, '../../app/(auth)/profile-setup/notifications.tsx'), 'utf8');
    assert.match(text, /requestNotificationPermission/);
    assert.match(text, /primerCopy\('notifications'\)/);
  });

  // App Review 5.1.1(iv), 2026-09-27: a message before an OS permission sheet has one
  // "Continue" button that always opens the sheet. No Allow wording, no Not now/Later/Skip.
  it('permission primers only continue to the OS sheet', () => {
    const primer = readFileSync(join(here, 'permissionPrimer.ts'), 'utf8');
    // notifications, health, location, temperature (cycle settings, train 1.0.0.20)
    assert.equal((primer.match(/cta: 'Continue'/g) || []).length, 4);
    assert.equal((primer.match(/cta: 'გაგრძელება'/g) || []).length, 4);
    assert.doesNotMatch(primer, /cta: '(Allow|ნებართვის მიცემა)/);
    const screens = [
      '../components/cycle/settings/CycleTemperatureRow.tsx',
      '../components/permissions/PermissionGateHost.tsx',
      '../../app/(auth)/profile-setup/notifications.tsx',
      '../../app/(auth)/profile-setup/location.tsx',
      // MEDIPILL's notifications-off note (primer state: one „გაგრძელება“ that opens the sheet).
      '../components/medications/MedicationRemindersNote.tsx',
    ];
    for (const file of screens) {
      const text = readFileSync(join(here, file), 'utf8');
      assert.match(text, /primerCopy\(/, file);
      assert.doesNotMatch(text, /ProfileSetupLinkButton|gateSkip|notificationsSkip|locationSkip|ახლა არა|მოგვიანებით/, file);
    }
    const modal = readFileSync(join(here, '../components/location/LocationAskModal.tsx'), 'utf8');
    assert.match(modal, /disabled=\{busy \|\| !answered\}/);
    assert.match(modal, /answered \? <>/);
    assert.doesNotMatch(modal, /მოგვიანებით/);
    const inspect = readFileSync(join(here, 'deviceAccess.js'), 'utf8');
    assert.match(inspect, /!notificationsAsked/);
    assert.match(inspect, /!healthAsked/);
  });

  it('reads iOS authorized/provisional as granted and does not re-ask when already allowed', () => {
    const helper = readFileSync(join(here, 'notificationPermission.js'), 'utf8');
    const notifications = readFileSync(join(here, 'notifications.ts'), 'utf8');
    const access = readFileSync(join(here, 'appPermissions.ts'), 'utf8');
    const page = readFileSync(join(here, '../../app/profile/permissions.tsx'), 'utf8');
    const host = readFileSync(join(here, '../components/permissions/PermissionGateHost.tsx'), 'utf8');
    const inspect = readFileSync(join(here, 'deviceAccess.js'), 'utf8');
    const granted = notifications.slice(
      notifications.indexOf('export async function getNotificationPermissionGranted'),
      notifications.indexOf('async function ensureAndroidChannels'),
    );
    const request = notifications.slice(
      notifications.indexOf('export async function requestNotificationPermission'),
      notifications.indexOf('export async function notificationCanAskAgain'),
    );
    const status = notifications.slice(
      notifications.indexOf('export async function getNotificationPermissionStatus'),
      notifications.indexOf('export type ScheduledReminderCounts'),
    );
    const load = access.slice(
      access.indexOf('export async function loadAppPermissions'),
      access.indexOf('export function countActivePermissions'),
    );
    const enable = access.slice(
      access.indexOf('export async function enablePushConnection'),
      access.indexOf('export async function disablePushConnection'),
    );
    assert.match(helper, /ios\?\.status/);
    assert.match(granted, /notificationResponseIsGranted/);
    assert.match(request, /notificationResponseIsGranted/);
    assert.match(request, /rememberOsNotificationGrant/);
    assert.doesNotMatch(request, /await Notifications\.getPermissionsAsync/);
    assert.match(status, /notificationResponseStatus/);
    assert.match(access, /alreadyGranted/);
    assert.match(enable, /skipPermissionProbe/);
    assert.match(enable, /rememberOsNotificationGrant/);
    assert.doesNotMatch(load, /getNotificationPermissionStatus/);
    assert.doesNotMatch(page, /requestNotificationAccess/);
    assert.match(page, /enablePushConnection/);
    assert.doesNotMatch(page, /openSettingsAlert\(ka\.meds\.notificationsDenied/);
    assert.doesNotMatch(host, /setPushOptedIn\(granted\)/);
    assert.match(inspect, /getPushOptedInStored/);
    assert.doesNotMatch(inspect, /getNotificationPermissionStatus/);
  });

  it('background schedulers do not request the OS notification prompt', () => {
    const brain = readFileSync(join(here, 'mediNotificationBrain.ts'), 'utf8');
    assert.match(brain, /getNotificationPermissionGranted/);
    assert.doesNotMatch(brain, /requestNotificationPermission/);
    const register = readFileSync(join(here, 'notifications.ts'), 'utf8');
    const granted = register.slice(
      register.indexOf('export async function getNotificationPermissionGranted'),
      register.indexOf('async function ensureAndroidChannels'),
    );
    assert.match(granted, /ensureAndroidChannels/);
    const fn = register.slice(
      register.indexOf('export async function registerPushTokenWithServer'),
      register.indexOf('function canScheduleNotifications'),
    );
    assert.match(fn, /getNotificationPermissionGranted/);
    assert.doesNotMatch(fn, /requestNotificationPermission/);
    const sync = register.slice(
      register.indexOf('export async function syncPushRegistration'),
      register.indexOf('async function saveLastPushToken'),
    );
    assert.match(sync, /skipPermissionProbe: true/);
    assert.match(fn, /Platform\.OS === 'android' && \/Expo Go\/i/);
    assert.match(fn, /skipPermissionProbe && !\(await isPushOptedIn\(\)\)/);
    assert.match(register, /addPushTokenListener/);
    assert.match(register, /FALLBACK_EAS_PROJECT_ID/);
    assert.match(register, /ensurePushTokenListener/);
    assert.doesNotMatch(register, /development: true/);
    assert.doesNotMatch(register, /getDevicePushTokenAsync/);
  });

  it('Expo Go can ask notifications without Health Connect', () => {
    const text = readFileSync(join(here, 'deviceAccess.js'), 'utf8');
    assert.match(text, /isNotificationsNativeAvailable/);
    assert.match(text, /appOwnership === 'expo'/);
    assert.doesNotMatch(text, /appOwnership !== 'expo'/);
    const expo = readFileSync(join(here, 'expoNotifications.ts'), 'utf8');
    assert.match(expo, /isNotificationsNativeAvailable/);
    assert.doesNotMatch(expo, /if \(skipNative\) return expoGoStub/);
    assert.doesNotMatch(expo, /loaded\.getExpoPushTokenAsync = async/);
  });

  it('HealthKit step reads do not silently re-request authorization', () => {
    const text = readFileSync(join(here, 'healthSyncPlatform.ios.ts'), 'utf8');
    const start = text.indexOf('export async function fetchStepsNative');
    const next = text.indexOf('\nexport ', start + 1);
    // Only the read path: nutrition write-back asks for access from its own switch press.
    const fn = text.slice(start, next === -1 ? text.length : next);
    assert.doesNotMatch(fn, /requestAuthorization/);
    assert.doesNotMatch(fn, /ensureHealthReadAccess/);
    assert.match(fn, /queryStatisticsCollectionForQuantity/);
    assert.match(fn, /\{ day: 1 \}/);
    assert.doesNotMatch(fn, /while \(cursor/);
    assert.doesNotMatch(fn, /queryDayStepTotal/);
  });

  it('steps fetch is not gated on the wiped health-sync pref', () => {
    const text = readFileSync(join(here, 'stepsMetrics.ts'), 'utf8');
    const fn = text.slice(text.indexOf('export async function fetchStepsSamples'), text.indexOf('export async function fetchStepsMetrics'));
    assert.doesNotMatch(fn, /if \(!connected \|\| isExpoGo\(\)\) return \[\]/);
    assert.match(fn, /isExpoGo\(\)/);
  });

  it('production boot guard does not expire', () => {
    const text = readFileSync(join(here, 'bootGuard.js'), 'utf8');
    assert.doesNotMatch(text, /BOOT_FATAL_GUARD_MS/);
    assert.match(text, /production fatal suppressed/);
  });
});
