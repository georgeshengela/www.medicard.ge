/** Parse versions: historic `24.0.0`, public five-part `1.0.0.7.66`, or brief three-part `1.0.66`. */

export function parseAppVersion(raw) {
  if (raw == null) return null;
  const text = String(raw).trim();
  const match = text.match(/^(\d+)\.(\d+)\.(\d+)(?:\.(\d+)(?:\.(\d+))?)?$/);
  if (!match) return null;
  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);
  const hasBuild = match[4] != null;
  const build = hasBuild ? Number(match[4]) : 0;
  const revision = match[5] != null ? Number(match[5]) : 0;
  const rawOut = hasBuild
    ? match[5] != null
      ? `${major}.${minor}.${patch}.${build}.${revision}`
      : `${major}.${minor}.${patch}.${build}`
    : `${major}.${minor}.${patch}`;
  // Public generation 1: store `1.x.y` (except placeholder `1.0.0`) or historic `1.0.0.B.R`.
  const publicGeneration = major === 1 && (hasBuild || minor > 0 || patch > 0);
  return {
    raw: rawOut,
    major,
    minor,
    patch,
    build,
    revision,
    /** 0 = historic 3-part (15.x–65.x and placeholder 1.0.0). 1 = public store generation. */
    epoch: publicGeneration || hasBuild ? 1 : 0,
  };
}

export function compareAppVersions(a, b) {
  const left = parseAppVersion(a);
  const right = parseAppVersion(b);
  if (!left || !right) return null;
  if (left.epoch !== right.epoch) return left.epoch - right.epoch;
  if (left.major !== right.major) return left.major - right.major;
  if (left.minor !== right.minor) return left.minor - right.minor;
  if (left.patch !== right.patch) return left.patch - right.patch;
  if (left.build !== right.build) return left.build - right.build;
  return left.revision - right.revision;
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
    appVersion: parsed?.raw || clipClientField(body.appVersion, 32),
  };
}
