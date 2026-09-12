const { withInfoPlist } = require('@expo/config-plugins');

const THREE_PART = /^\d+\.\d+\.\d+$/;

/** Keep in sync with `src/lib/medicardVersion.js` `iosMarketingVersion`. */
function iosMarketingVersion(version) {
  const text = String(version || '').trim();
  const five = text.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (five) return `${five[1]}.${five[4]}.${five[5]}`;
  const three = text.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (three) return `${three[1]}.${three[2]}.${three[3]}`;
  return '1.7.66';
}

/**
 * Apple rejects five-part `CFBundleShortVersionString`.
 * Official override is `expo.ios.version` (G.B.R). This plugin is the last-write
 * guard so a five-part `expo.version` cannot leak into the IPA.
 */
function withIosMarketingVersion(config) {
  const marketing = config.ios?.version || iosMarketingVersion(config.version);
  if (!THREE_PART.test(marketing)) {
    throw new Error(
      `iOS marketing version must be three-part CFBundleShortVersionString, got "${marketing}"`,
    );
  }
  config.ios = { ...config.ios, version: marketing };
  return withInfoPlist(config, (mod) => {
    mod.modResults.CFBundleShortVersionString = marketing;
    return mod;
  });
}

module.exports = withIosMarketingVersion;
