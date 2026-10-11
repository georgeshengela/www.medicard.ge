// Meta install measurement (train 1.0.0.22): the Facebook SDK may only count installs / app opens.
// Guards: no IDFA / ATT prompt, no auto-init before the privacy acceptance, no custom app events,
// no other part of the SDK (login, share, graph) used anywhere in the app.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const appJson = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));

test('fbsdk plugin is configured for install measurement only', () => {
  const entry = appJson.expo.plugins.find((p) => Array.isArray(p) && p[0] === 'react-native-fbsdk-next');
  assert.ok(entry, 'react-native-fbsdk-next plugin present');
  const cfg = entry[1];
  assert.equal(cfg.appID, '1618408603019139');
  assert.equal(cfg.isAutoInitEnabled, false, 'the SDK starts from JS after the privacy acceptance');
  assert.equal(cfg.advertiserIDCollectionEnabled, false, 'never collect the IDFA');
  assert.equal(cfg.iosUserTrackingPermission, false, 'no App Tracking Transparency prompt');
  assert.equal(cfg.autoLogAppEventsEnabled, true, 'install / app open come from Meta automatic events');
  assert.equal(appJson.expo.ios.infoPlist.NSUserTrackingUsageDescription, undefined);
});

test('fbsdk plugin runs before the MEDICARD plugins (withIosMarketingVersion stays last)', () => {
  const names = appJson.expo.plugins.map((p) => (Array.isArray(p) ? p[0] : p));
  assert.equal(names.at(-1), './plugins/withIosMarketingVersion');
  assert.ok(names.indexOf('react-native-fbsdk-next') < names.indexOf('./plugins/withMedirunBackground'));
});

test('the SDK starts only after privacyAccepted, on iOS', () => {
  const src = fs.readFileSync(path.join(root, 'src/lib/adMeasurement.ts'), 'utf8');
  assert.match(src, /privacyAccepted === true/);
  assert.match(src, /os !== 'ios'/);
  assert.match(src, /NativeModules\.FBSettings/);
});

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(tsx?|jsx?)$/.test(name)) out.push(p);
  }
  return out;
}

test('no app code imports the Facebook SDK or logs its own events', () => {
  const files = [...walk(path.join(root, 'src')), ...walk(path.join(root, 'app'))];
  const offenders = files.filter((f) => {
    if (path.basename(f) === 'adMeasurement.ts') return false; // the one place that starts it (NativeModules only)
    const s = fs.readFileSync(f, 'utf8');
    return /react-native-fbsdk-next|AppEventsLogger|FBAppEventsLogger|LoginManager/.test(s);
  });
  assert.deepEqual(offenders.map((f) => path.relative(root, f)), []);
});
