// iOS permission sheets speak the app's language (App Review 4.0, 1.24.0 on 2026-10-14: an English app asked
// for the camera and photos in Georgian). Every usage text lives in mobile/locales/en.json + ka.json, which Expo
// writes to en.lproj / ka.lproj InfoPlist.strings; the base Info.plist (app.json) is the English fallback, and
// src/i18n/locale.js keeps the iOS bundle language equal to the app language (AppleLanguages).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const appJson = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));
const expo = appJson.expo;
const readLocale = (lang) => JSON.parse(fs.readFileSync(path.join(root, expo.locales[lang]), 'utf8')).ios;
const GEORGIAN = /[ა-ჿ]/;

// Plugin options that become Info.plist usage texts.
const PLUGIN_KEYS = {
  'expo-camera': { cameraPermission: 'NSCameraUsageDescription' },
  'expo-image-picker': { photosPermission: 'NSPhotoLibraryUsageDescription', cameraPermission: 'NSCameraUsageDescription' },
  'expo-calendar': { calendarPermission: 'NSCalendarsUsageDescription' },
  '@kingstinct/react-native-healthkit': {
    NSHealthShareUsageDescription: 'NSHealthShareUsageDescription',
    NSHealthUpdateUsageDescription: 'NSHealthUpdateUsageDescription',
  },
  'expo-location': {
    locationWhenInUsePermission: 'NSLocationWhenInUseUsageDescription',
    locationAlwaysAndWhenInUsePermission: 'NSLocationAlwaysAndWhenInUseUsageDescription',
    locationAlwaysPermission: 'NSLocationAlwaysUsageDescription',
    motionUsagePermission: 'NSMotionUsageDescription',
  },
  'expo-local-authentication': { faceIDPermission: 'NSFaceIDUsageDescription' },
  'expo-audio': { microphonePermission: 'NSMicrophoneUsageDescription' },
};

function baseUsageTexts() {
  const texts = {};
  for (const [key, value] of Object.entries(expo.ios.infoPlist)) {
    if (/UsageDescription$/.test(key)) texts[key] = [...(texts[key] || []), value];
  }
  for (const entry of expo.plugins) {
    if (!Array.isArray(entry) || !PLUGIN_KEYS[entry[0]]) continue;
    for (const [option, plistKey] of Object.entries(PLUGIN_KEYS[entry[0]])) {
      if (typeof entry[1][option] === 'string') texts[plistKey] = [...(texts[plistKey] || []), entry[1][option]];
    }
  }
  return texts;
}

test('app.json declares English and Georgian locale files', () => {
  assert.deepEqual(Object.keys(expo.locales).sort(), ['en', 'ka']);
  for (const lang of ['en', 'ka']) assert.ok(fs.existsSync(path.join(root, expo.locales[lang])), lang);
});

test('every usage text has an English and a Georgian version, and nothing extra', () => {
  const base = Object.keys(baseUsageTexts()).sort();
  assert.ok(base.length >= 13, 'camera, photos, mic, Face ID, location ×3, motion, calendar ×2, Health ×2, alarms');
  assert.deepEqual(Object.keys(readLocale('en')).sort(), base);
  assert.deepEqual(Object.keys(readLocale('ka')).sort(), base);
});

test('the base Info.plist is the English text (fallback for every other phone language)', () => {
  const en = readLocale('en');
  for (const [key, values] of Object.entries(baseUsageTexts())) {
    for (const value of values) assert.equal(value, en[key], key);
  }
});

test('English texts have no Georgian, Georgian texts are Georgian', () => {
  for (const [key, value] of Object.entries(readLocale('en'))) assert.doesNotMatch(value, GEORGIAN, key);
  for (const [key, value] of Object.entries(readLocale('ka'))) assert.match(value, GEORGIAN, key);
});

test('texts survive the InfoPlist.strings writer (Expo does not escape quotes or backslashes)', () => {
  for (const lang of ['en', 'ka']) {
    for (const [key, value] of Object.entries(readLocale(lang))) {
      assert.ok(value.trim().length > 20, `${lang} ${key}`);
      assert.doesNotMatch(value, /["\\\n]/, `${lang} ${key}`);
      assert.doesNotMatch(value, /MEDI (COACH|RUN|CYCLE|SLEEP)/, `${lang} ${key}: module names are one word`);
    }
  }
});

test('the app keeps the iOS bundle language equal to the app language', () => {
  const src = fs.readFileSync(path.join(root, 'src/i18n/locale.js'), 'utf8');
  assert.match(src, /AppleLanguages/);
  assert.match(src, /function resolve\(\)[\s\S]*?syncIosBundleLanguage\(current\)/);
  assert.match(src, /export function saveLanguage[\s\S]*?syncIosBundleLanguage\(lang\)/);
});
