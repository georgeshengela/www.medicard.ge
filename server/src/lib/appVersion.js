/** Parse and compare Expo-style versions like 23.0.3. */

export function parseAppVersion(raw) {
  if (raw == null) return null;
  const text = String(raw).trim();
  const match = text.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return {
    raw: `${match[1]}.${match[2]}.${match[3]}`,
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

export function compareAppVersions(a, b) {
  const left = parseAppVersion(a);
  const right = parseAppVersion(b);
  if (!left || !right) return null;
  if (left.major !== right.major) return left.major - right.major;
  if (left.minor !== right.minor) return left.minor - right.minor;
  return left.patch - right.patch;
}

export function isAppVersionBelow(version, minimum) {
  const cmp = compareAppVersions(version, minimum);
  return cmp == null ? null : cmp < 0;
}

export function clipClientField(value, max) {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text) return null;
  return text.slice(0, max);
}

export function clientMetaFromRequest(req, body = {}) {
  const platformRaw = clipClientField(
    req?.get?.('x-medicard-platform') || body.platform,
    16,
  )?.toLowerCase();
  const platform = ['ios', 'android', 'web'].includes(platformRaw) ? platformRaw : null;
  const parsed = parseAppVersion(req?.get?.('x-medicard-app-version') || body.appVersion);
  return {
    platform,
    appVersion: parsed?.raw || clipClientField(body.appVersion, 24),
  };
}
