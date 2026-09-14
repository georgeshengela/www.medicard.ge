import { playBounds } from './geo.js';
import { inflateCacheBbox, fetchOverpassElements } from './overpass.js';
import { buildGraphFromOverpass, playerComponent } from './graph.js';
import { fixtureHuntGraph } from './fixtureGraph.js';
import { httpError } from './config.js';

function tooSmall(component) {
  const nodes = Object.keys(component.graph?.nodes || {}).length;
  return !nodes || nodes < 8 || component.reason;
}

/**
 * Load a walkable graph for one session. Simulation uses a fixture grid only.
 * Production uses Overpass, caches the cell, then clips to this session's 1 km square
 * and the connected component from the player's nearest walking node.
 */
export async function resolveHuntGraph({ db, origin, config, simulation, gentle, fetchImpl }) {
  const bounds = playBounds(origin, config.playAreaM);
  if (simulation) {
    const raw = fixtureHuntGraph(origin, config.playAreaM);
    const component = playerComponent(raw, origin, config.graphSnapM);
    if (tooSmall(component)) {
      throw httpError('ამ ადგილას სავალი ქუჩები ვერ მოიძებნა.', 422, 'HUNT_GRAPH_UNAVAILABLE');
    }
    return { ...component, bounds, source: 'fixture' };
  }

  const cacheKey = `${bounds.south.toFixed(3)}:${bounds.west.toFixed(3)}`;
  let elements = null;
  const cached = await db.huntGraphCache.findUnique({ where: { cellKey: cacheKey } }).catch(() => null);
  if (cached?.payload && Date.now() - new Date(cached.fetchedAt).getTime() < config.graphCacheTtlMs) {
    elements = cached.payload;
  } else {
    const inflated = inflateCacheBbox(bounds);
    elements = await fetchOverpassElements(inflated, config, { fetchImpl });
    await db.huntGraphCache.upsert({
      where: { cellKey: cacheKey },
      create: { cellKey: cacheKey, payload: elements, fetchedAt: new Date() },
      update: { payload: elements, fetchedAt: new Date() },
    });
  }

  const built = buildGraphFromOverpass(elements, {
    bounds,
    gentle,
    exclusions: config.exclusions,
  });
  const component = playerComponent(built, origin, config.graphSnapM);
  if (tooSmall(component)) {
    throw httpError('ამ ადგილას საკმარისი სავალი ქუჩები არ არის. სცადე სხვა წერტილი ან Classic Run.', 422, 'HUNT_GRAPH_UNAVAILABLE');
  }
  return { ...component, bounds, source: 'overpass' };
}
