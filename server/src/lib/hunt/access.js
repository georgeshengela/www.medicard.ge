/**
 * OSM pedestrian access. Specific `foot=*` overrides generic `access=*`.
 * This does not certify real-world safety or complete accessibility.
 *
 * @see https://wiki.openstreetmap.org/wiki/Key:access
 * @see https://wiki.openstreetmap.org/wiki/Key:foot
 */

const BLOCKED = new Set(['no', 'private', 'military', 'destination', 'customers', 'agricultural', 'forestry']);
const FOOT_OK = new Set(['yes', 'designated', 'permissive', 'yes;designated']);
const FOOT_NO = new Set(['no', 'private', 'use_sidepath', 'discouraged']);
const HIGHWAY_EXCLUDE = new Set([
  'motorway',
  'motorway_link',
  'trunk',
  'trunk_link',
  'proposed',
  'construction',
  'raceway',
  'bus_guideway',
  'busway',
  'escape',
  'corridor',
  'elevator',
]);
const ROADISH = new Set([
  'residential',
  'living_street',
  'unclassified',
  'service',
  'tertiary',
  'secondary',
  'primary',
  'primary_link',
  'secondary_link',
  'tertiary_link',
  'track',
  'road',
]);
const FOOTWAYISH = new Set(['footway', 'path', 'pedestrian', 'steps', 'bridleway', 'cycleway']);

function tag(tags, key) {
  const value = tags?.[key];
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function isStepsWay(tags) {
  return tag(tags, 'highway') === 'steps';
}

export function pedestrianAllowed(tags = {}) {
  const highway = tag(tags, 'highway');
  if (!highway) return false;
  if (HIGHWAY_EXCLUDE.has(highway) && !FOOT_OK.has(tag(tags, 'foot'))) return false;
  if (tag(tags, 'indoor') === 'yes' && highway !== 'footway' && highway !== 'steps') return false;
  if (tag(tags, 'access') === 'no' && !FOOT_OK.has(tag(tags, 'foot'))) return false;

  const foot = tag(tags, 'foot');
  if (FOOT_NO.has(foot)) return false;
  if (FOOT_OK.has(foot)) return true;

  const access = tag(tags, 'access');
  if (BLOCKED.has(access)) return false;
  if (tag(tags, 'footway') === 'sidewalk' || tag(tags, 'footway') === 'crossing') return true;
  if (FOOTWAYISH.has(highway)) return true;
  if (ROADISH.has(highway)) return true;
  return false;
}

/**
 * Returns { forward, backward } walkability along the OSM way.
 * Grade-separated crossings are not invented here — callers only join shared node ids.
 */
export function pedestrianDirections(tags = {}) {
  if (!pedestrianAllowed(tags)) return { forward: false, backward: false };
  const onewayFoot = tag(tags, 'oneway:foot');
  const footForward = tag(tags, 'foot:forward');
  const footBackward = tag(tags, 'foot:backward');
  if (onewayFoot === 'yes' || onewayFoot === '1') return { forward: true, backward: false };
  if (onewayFoot === '-1') return { forward: false, backward: true };
  if (onewayFoot === 'no') return { forward: true, backward: true };
  if (FOOT_NO.has(footForward) && FOOT_OK.has(footBackward)) return { forward: false, backward: true };
  if (FOOT_NO.has(footBackward) && FOOT_OK.has(footForward)) return { forward: true, backward: false };

  const highway = tag(tags, 'highway');
  const oneway = tag(tags, 'oneway');
  if (FOOTWAYISH.has(highway) && (oneway === 'yes' || oneway === '1')) {
    return { forward: true, backward: false };
  }
  if (FOOTWAYISH.has(highway) && oneway === '-1') return { forward: false, backward: true };
  return { forward: true, backward: true };
}

export function wayUsable(tags, { gentle = false } = {}) {
  if (!pedestrianAllowed(tags)) return false;
  if (gentle && isStepsWay(tags)) return false;
  return true;
}
