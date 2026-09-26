/**
 * `expo.version` in app.json (five-part `G.0.0.B.R`) is the single source of
 * truth. Everything else is derived here so it can never drift:
 *  - `extra.medicardInternalVersion` — in-app display (Profile) and /api/app/status
 *  - `ios.version` — Apple's three-part marketing version `G.B.R`
 */
const FIVE = /^(\d+)\.(\d+)\.(\d+)\.(\d+)\.(\d+)$/;

module.exports = ({ config }) => {
  const version = String(config.version || '').trim();
  const five = version.match(FIVE);
  if (!five) throw new Error(`expo.version must be five-part G.0.0.B.R, got "${version}"`);
  return {
    ...config,
    ios: { ...config.ios, version: `${five[1]}.${five[4]}.${five[5]}` },
    extra: { ...config.extra, medicardInternalVersion: version },
  };
};
