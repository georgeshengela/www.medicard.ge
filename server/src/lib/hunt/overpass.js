/**
 * Overpass provider. Replaceable: inject `fetchImpl` / `now`.
 * Public Overpass is not an unlimited production SLA — cache + timeouts required.
 * @see https://wiki.openstreetmap.org/wiki/Overpass_API
 * @see https://dev.overpass-api.de/overpass-doc/en/full_data/bbox.html
 */

const pending = new Map();

function bboxClause(bounds) {
  return `${bounds.south.toFixed(6)},${bounds.west.toFixed(6)},${bounds.north.toFixed(6)},${bounds.east.toFixed(6)}`;
}

export function overpassQuery(bounds) {
  const b = bboxClause(bounds);
  return `[out:json][timeout:20];(way["highway"](${b}););out geom;`;
}

export function inflateCacheBbox(bounds, pad = 0.002) {
  return {
    south: bounds.south - pad,
    west: bounds.west - pad,
    north: bounds.north + pad,
    east: bounds.east + pad,
  };
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchOverpassElements(bounds, config, options = {}) {
  const url = config.overpassUrl;
  const query = overpassQuery(bounds);
  const key = `${url}|${bboxClause(bounds)}`;
  if (pending.has(key)) return pending.get(key);

  const job = (async () => {
    let lastError = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), config.overpassTimeoutMs);
      try {
        const fetchImpl = options.fetchImpl || fetch;
        const res = await fetchImpl(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            Accept: 'application/json',
            'User-Agent': 'MedicardHunt/1.0 (medicard.ge; pedestrian-graph)',
          },
          body: `data=${encodeURIComponent(query)}`,
          signal: controller.signal,
        });
        if (res.status === 429 || res.status === 504 || res.status === 502) {
          lastError = new Error(`overpass ${res.status}`);
          await sleep(400 * (attempt + 1));
          continue;
        }
        if (!res.ok) {
          const error = new Error(`overpass ${res.status}`);
          error.status = 503;
          error.code = 'HUNT_GRAPH_UNAVAILABLE';
          throw error;
        }
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length > config.overpassMaxBytes) {
          const error = new Error('overpass too large');
          error.status = 503;
          error.code = 'HUNT_GRAPH_UNAVAILABLE';
          throw error;
        }
        const json = JSON.parse(buf.toString('utf8'));
        return Array.isArray(json.elements) ? json.elements : [];
      } catch (error) {
        lastError = error;
        if (error.code === 'HUNT_GRAPH_UNAVAILABLE') throw error;
        await sleep(350 * (attempt + 1));
      } finally {
        clearTimeout(timer);
      }
    }
    const fail = lastError || new Error('overpass failed');
    fail.status = 503;
    fail.code = 'HUNT_GRAPH_UNAVAILABLE';
    throw fail;
  })();

  pending.set(key, job);
  try {
    return await job;
  } finally {
    pending.delete(key);
  }
}
