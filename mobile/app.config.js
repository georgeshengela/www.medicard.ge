/**
 * `expo.version` in app.json (five-part `G.0.0.B.R`) is the single source of
 * truth. Everything else is derived here so it can never drift:
 *  - `extra.medicardInternalVersion` — in-app display (Profile) and /api/app/status
 *  - `ios.version` — Apple's three-part marketing version `G.B.R`
 *  - `runtimeVersion` — the store train `G.0.0.B`. Over-the-air updates (EAS Update,
 *    `npm run ota`) reach only binaries of the same train, so a revision bump (`.R`)
 *    can ship without App Review and a train bump (`.B`) always needs a store build.
 *    `scripts/ota.mjs` refuses an update whose native fingerprint differs from the
 *    train's store build (`ota-baselines.json`).
 */
const FIVE = /^(\d+)\.(\d+)\.(\d+)\.(\d+)\.(\d+)$/;

/**
 * Google Sign-In on iOS returns to the app through the reversed iOS client id as a URL scheme.
 * The plugin refuses to run without it, so it is added only once `google-oauth.json` has the id
 * (until then the Google button stays hidden — src/lib/socialSignIn.ts).
 */
function withGoogleSignIn(plugins = []) {
  let iosClientId = '';
  try {
    iosClientId = String(require('./google-oauth.json').iosClientId || '').trim();
  } catch {
    iosClientId = '';
  }
  const match = iosClientId.match(/^(.+)\.apps\.googleusercontent\.com$/);
  if (!match) return plugins;
  return [...plugins, ['@react-native-google-signin/google-signin', { iosUrlScheme: `com.googleusercontent.apps.${match[1]}` }]];
}

module.exports = ({ config }) => {
  const version = String(config.version || '').trim();
  const five = version.match(FIVE);
  if (!five) throw new Error(`expo.version must be five-part G.0.0.B.R, got "${version}"`);
  const projectId = config.extra?.eas?.projectId;
  return {
    ...config,
    runtimeVersion: `${five[1]}.${five[2]}.${five[3]}.${five[4]}`,
    plugins: withGoogleSignIn(config.plugins),
    updates: {
      ...config.updates,
      url: `https://u.expo.dev/${projectId}`,
      enabled: true,
      // Never hold the splash for a download: the app opens on the bundle it has and
      // the new one (fetched in the background) takes over on the next cold start.
      checkAutomatically: 'ON_LOAD',
      fallbackToCacheTimeout: 0,
    },
    // scripts/ota.mjs compares native fingerprints; the marketing version is not native code.
    ios: process.env.MEDICARD_FINGERPRINT === '1' ? config.ios : { ...config.ios, version: `${five[1]}.${five[4]}.${five[5]}` },
    extra: { ...config.extra, medicardInternalVersion: version },
  };
};
