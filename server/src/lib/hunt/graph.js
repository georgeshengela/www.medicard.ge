import { haversineM, inBounds, pointToSegmentM } from './geo.js';
import { pedestrianDirections, wayUsable } from './access.js';

function nodeKey(id) {
  return String(id);
}

export function emptyGraph() {
  return { nodes: {}, edges: [], bounds: null, reason: null };
}

export function buildGraphFromOverpass(elements, { bounds, gentle = false, exclusions = [] } = {}) {
  const nodes = {};
  const ways = [];
  for (const el of elements || []) {
    if (el.type === 'node' && el.id != null && Number.isFinite(el.lat) && Number.isFinite(el.lon)) {
      nodes[nodeKey(el.id)] = { id: nodeKey(el.id), lat: el.lat, lng: el.lon };
    }
    if (el.type === 'way') ways.push(el);
  }

  for (const way of ways) {
    const geom = way.geometry || [];
    let ids = Array.isArray(way.nodes) ? way.nodes.map(nodeKey) : [];
    if (!ids.length && geom.length) {
      ids = geom.map((_, i) => `w${way.id}:${i}`);
      way.nodes = ids;
    }
    for (let i = 0; i < ids.length; i += 1) {
      const g = geom[i];
      if (g && Number.isFinite(g.lat) && Number.isFinite(g.lon ?? g.lng)) {
        nodes[ids[i]] = { id: ids[i], lat: g.lat, lng: g.lon ?? g.lng };
      }
    }
  }

  const edges = [];
  for (const way of ways) {
    const tags = way.tags || {};
    if (!wayUsable(tags, { gentle })) continue;
    const dirs = pedestrianDirections(tags);
    const ids = (way.nodes || []).map(nodeKey);
    for (let i = 0; i < ids.length - 1; i += 1) {
      const a = nodes[ids[i]];
      const b = nodes[ids[i + 1]];
      if (!a || !b) continue;
      if (bounds && (!inBounds(a, bounds, 8) || !inBounds(b, bounds, 8))) continue;
      if (exclusions.some((box) => inBounds(a, box) && inBounds(b, box))) continue;
      const lengthM = haversineM(a, b);
      if (lengthM < 1 || lengthM > 250) continue;
      const meta = { highway: tags.highway || '', steps: tags.highway === 'steps', wayId: String(way.id) };
      if (dirs.forward) edges.push({ a: a.id, b: b.id, lengthM, ...meta });
      if (dirs.backward) edges.push({ a: b.id, b: a.id, lengthM, ...meta });
    }
  }

  return { nodes, edges, bounds: bounds || null, reason: null };
}

export function adjacency(graph) {
  const map = new Map();
  for (const id of Object.keys(graph.nodes || {})) map.set(id, []);
  for (const edge of graph.edges || []) {
    if (!map.has(edge.a)) map.set(edge.a, []);
    map.get(edge.a).push(edge);
  }
  return map;
}

export function nearestNode(graph, point, maxM = 40) {
  let best = null;
  let bestM = Infinity;
  for (const node of Object.values(graph.nodes || {})) {
    const d = haversineM(point, node);
    if (d < bestM) {
      best = node;
      bestM = d;
    }
  }
  if (!best || bestM > maxM) return null;
  return { node: best, distanceM: bestM };
}

export function nearestEdge(graph, point, maxM = 28) {
  let best = null;
  for (const edge of graph.edges || []) {
    const a = graph.nodes[edge.a];
    const b = graph.nodes[edge.b];
    if (!a || !b) continue;
    const hit = pointToSegmentM(point, a, b);
    if (hit.distanceM <= maxM && (!best || hit.distanceM < best.distanceM)) {
      best = { edge, ...hit };
    }
  }
  return best;
}

export function reachableFrom(graph, startId) {
  const adj = adjacency(graph);
  if (!adj.has(startId)) return new Set();
  const seen = new Set([startId]);
  const q = [startId];
  while (q.length) {
    const id = q.shift();
    for (const edge of adj.get(id) || []) {
      if (seen.has(edge.b)) continue;
      seen.add(edge.b);
      q.push(edge.b);
    }
  }
  return seen;
}

export function clipGraph(graph, keepIds) {
  const keep = keepIds instanceof Set ? keepIds : new Set(keepIds || []);
  const nodes = {};
  for (const id of keep) {
    if (graph.nodes[id]) nodes[id] = graph.nodes[id];
  }
  const edges = (graph.edges || []).filter((edge) => keep.has(edge.a) && keep.has(edge.b));
  return { nodes, edges, bounds: graph.bounds, reason: graph.reason };
}

export function playerComponent(graph, origin, snapM) {
  const snap = nearestNode(graph, origin, snapM);
  if (!snap) return { graph: emptyGraph(), snap: null, reason: 'NO_NEAR_NODE' };
  const keep = reachableFrom(graph, snap.node.id);
  if (keep.size < 8) return { graph: emptyGraph(), snap, reason: 'TOO_SMALL' };
  return { graph: clipGraph(graph, keep), snap, reason: null };
}

export function astar(graph, startId, goalId) {
  if (!startId || !goalId || startId === goalId) return startId ? [startId] : [];
  const adj = adjacency(graph);
  const start = graph.nodes[startId];
  const goal = graph.nodes[goalId];
  if (!start || !goal) return [];
  const open = new Map([[startId, 0]]);
  const came = new Map();
  const gScore = new Map([[startId, 0]]);
  const fScore = new Map([[startId, haversineM(start, goal)]]);
  const closed = new Set();

  function popMin() {
    let bestId = null;
    let bestF = Infinity;
    for (const [id] of open) {
      const f = fScore.get(id) ?? Infinity;
      if (f < bestF) {
        bestF = f;
        bestId = id;
      }
    }
    if (bestId != null) open.delete(bestId);
    return bestId;
  }

  while (open.size) {
    const current = popMin();
    if (current === goalId) {
      const path = [current];
      let step = current;
      while (came.has(step)) {
        step = came.get(step);
        path.push(step);
      }
      return path.reverse();
    }
    closed.add(current);
    for (const edge of adj.get(current) || []) {
      if (closed.has(edge.b)) continue;
      const tentative = (gScore.get(current) || 0) + edge.lengthM;
      if (tentative >= (gScore.get(edge.b) ?? Infinity)) continue;
      came.set(edge.b, current);
      gScore.set(edge.b, tentative);
      fScore.set(edge.b, tentative + haversineM(graph.nodes[edge.b], goal));
      open.set(edge.b, 1);
    }
  }
  return [];
}

export function pathLengthM(graph, path) {
  let total = 0;
  for (let i = 1; i < (path || []).length; i += 1) {
    const a = graph.nodes[path[i - 1]];
    const b = graph.nodes[path[i]];
    if (a && b) total += haversineM(a, b);
  }
  return total;
}

export function moveAlongPath(graph, path, fromIndex, alongM, distanceM) {
  let i = fromIndex;
  let along = alongM;
  let remaining = distanceM;
  if (!path || path.length < 2) {
    const node = graph.nodes[path?.[0]];
    return { nodeId: path?.[0] || null, index: 0, along: 0, point: node || null };
  }
  while (remaining > 0 && i < path.length - 1) {
    const a = graph.nodes[path[i]];
    const b = graph.nodes[path[i + 1]];
    const seg = haversineM(a, b);
    const left = Math.max(0, seg - along);
    if (remaining >= left) {
      remaining -= left;
      i += 1;
      along = 0;
    } else {
      along += remaining;
      remaining = 0;
    }
  }
  const a = graph.nodes[path[Math.min(i, path.length - 1)]];
  const b = graph.nodes[path[Math.min(i + 1, path.length - 1)]];
  const seg = a && b ? haversineM(a, b) : 1;
  const t = seg ? along / seg : 0;
  const point = a && b ? { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t } : a;
  return { nodeId: path[Math.min(i, path.length - 1)], index: i, along, point };
}

export function farthestNode(graph, fromId) {
  const origin = graph.nodes[fromId];
  if (!origin) return null;
  let best = null;
  let bestM = -1;
  for (const node of Object.values(graph.nodes)) {
    const d = haversineM(origin, node);
    if (d > bestM) {
      best = node;
      bestM = d;
    }
  }
  return best;
}

export function pickSeparatedNodes(graph, count, origin, minSepM, rng) {
  const ids = Object.keys(graph.nodes);
  if (!ids.length) return [];
  const picked = [];
  const shuffled = [...ids].sort(() => rng() - 0.5);
  for (const id of shuffled) {
    const node = graph.nodes[id];
    if (origin && haversineM(origin, node) < minSepM) continue;
    if (picked.some((p) => haversineM(node, graph.nodes[p]) < minSepM)) continue;
    picked.push(id);
    if (picked.length >= count) break;
  }
  return picked;
}

export function graphPolylines(graph) {
  const seen = new Set();
  const lines = [];
  for (const edge of graph.edges || []) {
    const key = edge.a < edge.b ? `${edge.a}|${edge.b}` : `${edge.b}|${edge.a}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const a = graph.nodes[edge.a];
    const b = graph.nodes[edge.b];
    if (!a || !b) continue;
    lines.push([
      [a.lng, a.lat],
      [b.lng, b.lat],
    ]);
  }
  return lines;
}

export function serializeGraph(graph) {
  return {
    nodes: Object.values(graph.nodes || {}).map((n) => [n.id, n.lat, n.lng]),
    edges: (graph.edges || []).map((e) => [e.a, e.b, Math.round(e.lengthM * 10) / 10, e.highway || '', e.steps ? 1 : 0]),
    bounds: graph.bounds || null,
  };
}

export function deserializeGraph(raw) {
  if (!raw) return emptyGraph();
  if (raw.nodes && !Array.isArray(raw.nodes)) return raw;
  const nodes = {};
  for (const row of raw.nodes || []) {
    nodes[row[0]] = { id: row[0], lat: row[1], lng: row[2] };
  }
  const edges = (raw.edges || []).map((e) => ({
    a: e[0],
    b: e[1],
    lengthM: e[2],
    highway: e[3] || '',
    steps: Boolean(e[4]),
  }));
  return { nodes, edges, bounds: raw.bounds || null, reason: null };
}

export function mulberry32(seed) {
  let t = seed >>> 0;
  return function rng() {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
