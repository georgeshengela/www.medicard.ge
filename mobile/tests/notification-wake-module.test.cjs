const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// iOS: expo-notifications calls a button response's completion handler before JS sees it, so iOS may
// suspend the app while „მივიღე ✓“ is still being saved. The local module mobile/modules/notification-wake
// takes background time at the tap and ends it when JS calls release() (src/lib/notificationWake.ts).
// Native code ships only with a store build (train 22); nothing here can be checked on Windows, so these
// guards pin the contract between the files.
const ROOT = path.resolve(__dirname, '..');
const MODULE = path.join(ROOT, 'modules/notification-wake');
const read = (file) => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

test('autolinking finds an iOS-only module with its JS name and an app delegate subscriber', () => {
  const config = JSON.parse(read(path.join(MODULE, 'expo-module.config.json')));
  assert.deepEqual(config.platforms, ['apple']);
  assert.deepEqual(config.apple.modules, ['NotificationWakeModule']);
  assert.deepEqual(config.apple.appDelegateSubscribers, ['NotificationWakeAppDelegateSubscriber']);
  const swiftModule = read(path.join(MODULE, 'ios/NotificationWakeModule.swift'));
  assert.match(swiftModule, /Name\("MedicardNotificationWake"\)/);
  assert.match(swiftModule, /Function\("release"\)/);
  const js = read(path.join(ROOT, 'src/lib/notificationWake.ts'));
  assert.match(js, /requireOptionalNativeModule<NotificationWakeModule>\('MedicardNotificationWake'\)\?\.release\(\)/);
});

test('the wake never takes the response from expo and ends by itself before iOS ends it', () => {
  const wake = read(path.join(MODULE, 'ios/NotificationButtonWake.swift'));
  const didReceive = wake.slice(wake.indexOf('func didReceive('));
  const body = didReceive.slice(0, didReceive.indexOf('\n  }\n'));
  // Returning true would drop the response expo keeps for JS until its emitter exists.
  assert.match(body, /return false/);
  assert.doesNotMatch(body, /return true/);
  assert.doesNotMatch(body, /completionHandler\(/);
  assert.match(body, /UNNotificationDefaultActionIdentifier/);
  assert.match(body, /UNNotificationDismissActionIdentifier/);
  const seconds = Number(/asyncAfter\(deadline: \.now\(\) \+ (\d+)\)/.exec(wake)?.[1]);
  assert.ok(seconds > 0 && seconds < 30, `timeout ${seconds}s`);
  assert.match(wake, /beginBackgroundTask\(withName: "medicard\.notification-action"\)/);
  assert.match(wake, /endBackgroundTask\(task\)/);
  const subscriber = read(path.join(MODULE, 'ios/NotificationWakeAppDelegateSubscriber.swift'));
  assert.match(subscriber, /didFinishLaunchingWithOptions[\s\S]*NotificationCenterManager\.shared\.addDelegate\(NotificationButtonWake\.shared\)/);
});

test('the pod builds against ExpoNotifications and its sources reach git and the EAS archive', () => {
  const podspec = read(path.join(MODULE, 'ios/NotificationWake.podspec'));
  assert.match(podspec, /s\.dependency 'ExpoNotifications'/);
  const expoPodspec = read(path.join(ROOT, 'node_modules/expo-notifications/ios/ExpoNotifications.podspec'));
  const min = (spec) => /:ios => '([\d.]+)'/.exec(spec)?.[1];
  assert.equal(min(podspec), min(expoPodspec));
  // Both ignore `ios/` for the generated native projects; EAS uploads by .easignore (it replaces .gitignore).
  for (const file of ['.gitignore', '.easignore']) {
    const ignore = read(path.resolve(ROOT, '..', file));
    assert.ok(ignore.indexOf('!mobile/modules/*/ios/') > ignore.indexOf('\nios/'), file);
  }
});
