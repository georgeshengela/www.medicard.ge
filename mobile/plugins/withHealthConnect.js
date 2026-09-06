const { withAndroidManifest } = require('@expo/config-plugins');

/** Must match record types requested in healthSyncPlatform.android.ts */
const HEALTH_PERMISSIONS = [
  'android.permission.health.READ_STEPS',
  'android.permission.health.READ_WEIGHT',
  'android.permission.health.READ_BLOOD_PRESSURE',
  'android.permission.health.READ_HEART_RATE',
  'android.permission.health.READ_RESTING_HEART_RATE',
  'android.permission.health.READ_SLEEP',
  'android.permission.health.READ_NUTRITION',
  'android.permission.health.READ_HYDRATION',
  'android.permission.health.READ_MENSTRUATION',
  'android.permission.health.WRITE_MENSTRUATION',
  'android.permission.health.READ_INTERMENSTRUAL_BLEEDING',
  'android.permission.health.WRITE_INTERMENSTRUAL_BLEEDING',
  'android.permission.health.READ_BASAL_BODY_TEMPERATURE',
  'android.permission.health.WRITE_BASAL_BODY_TEMPERATURE',
  'android.permission.health.READ_CERVICAL_MUCUS',
  'android.permission.health.WRITE_CERVICAL_MUCUS',
  'android.permission.health.READ_HEALTH_DATA_HISTORY',
  'android.permission.ACTIVITY_RECOGNITION',
];

const HEALTH_CONNECT_PACKAGE = 'com.google.android.apps.healthdata';

function ensureUsesPermissions(manifest) {
  const uses = manifest.manifest['uses-permission'] || [];
  const names = new Set(uses.map((entry) => entry.$?.['android:name']).filter(Boolean));
  for (const name of HEALTH_PERMISSIONS) {
    if (!names.has(name)) {
      uses.push({ $: { 'android:name': name } });
      names.add(name);
    }
  }
  manifest.manifest['uses-permission'] = uses;
}

function ensureHealthConnectQuery(manifest) {
  if (!manifest.manifest.queries) {
    manifest.manifest.queries = [{}];
  }
  const queries = manifest.manifest.queries[0] || {};
  if (!queries.package) queries.package = [];
  const has = queries.package.some((entry) => entry.$?.['android:name'] === HEALTH_CONNECT_PACKAGE);
  if (!has) {
    queries.package.push({ $: { 'android:name': HEALTH_CONNECT_PACKAGE } });
  }
  manifest.manifest.queries[0] = queries;
}

/**
 * The official react-native-health-connect plugin only adds the rationale activity.
 * Health Connect still refuses the app unless each requested type is in the manifest
 * and the Health Connect package is visible via <queries>.
 */
function withHealthConnect(config) {
  return withAndroidManifest(config, (config) => {
    ensureUsesPermissions(config.modResults);
    ensureHealthConnectQuery(config.modResults);
    return config;
  });
}

module.exports = withHealthConnect;
