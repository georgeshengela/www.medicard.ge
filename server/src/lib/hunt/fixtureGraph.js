import { destinationPoint, haversineM } from './geo.js';
import { buildGraphFromOverpass } from './graph.js';

/** Small connected grid used only for explicit simulation sessions. */
export function fixtureHuntGraph(origin, sizeM = 1000) {
  const half = sizeM / 2;
  const step = sizeM / 8;
  const nodes = {};
  const ways = [];
  let wayId = 1;
  const col = [];
  for (let i = 0; i <= 8; i += 1) {
    const row = [];
    for (let j = 0; j <= 8; j += 1) {
      const id = `n:${i}:${j}`;
      const north = destinationPoint(origin, 0, half - i * step);
      const point = destinationPoint(north, 90, j * step - half);
      nodes[id] = { id, lat: point.lat, lng: point.lng };
      row.push(id);
    }
    col.push(row);
    ways.push({
      id: wayId++,
      type: 'way',
      nodes: row,
      tags: { highway: 'residential', foot: 'yes' },
    });
  }
  for (let j = 0; j <= 8; j += 1) {
    ways.push({
      id: wayId++,
      type: 'way',
      nodes: col.map((row) => row[j]),
      tags: { highway: 'footway' },
    });
  }
  // Grade-separated decoy: visual cross without shared node ids.
  const fly = destinationPoint(origin, 45, 80);
  ways.push({
    id: 9001,
    type: 'way',
    nodes: ['bridge:a', 'bridge:b'],
    tags: { highway: 'footway', layer: '1' },
  });
  nodes['bridge:a'] = { id: 'bridge:a', lat: fly.lat, lng: fly.lng };
  nodes['bridge:b'] = {
    id: 'bridge:b',
    lat: destinationPoint(fly, 90, 40).lat,
    lng: destinationPoint(fly, 90, 40).lng,
  };

  const elements = [
    ...Object.values(nodes).map((n) => ({ type: 'node', id: n.id, lat: n.lat, lon: n.lng })),
    ...ways.map((w) => ({
      type: 'way',
      id: w.id,
      nodes: w.nodes,
      tags: w.tags,
      geometry: w.nodes.map((id) => ({ lat: nodes[id].lat, lon: nodes[id].lng })),
    })),
  ];
  return buildGraphFromOverpass(elements, {
    bounds: {
      south: origin.lat - 0.02,
      north: origin.lat + 0.02,
      west: origin.lng - 0.02,
      east: origin.lng + 0.02,
    },
  });
}

export function fixtureHasDisconnectedBridge(graph) {
  const a = graph.nodes['bridge:a'];
  const b = graph.nodes['bridge:b'];
  if (!a || !b) return true;
  const shared = (graph.edges || []).some((edge) => {
    const ids = [edge.a, edge.b];
    return ids.includes('bridge:a') && (ids.includes('n:4:4') || ids.includes('n:4:5'));
  });
  return !shared && haversineM(a, Object.values(graph.nodes)[0]) < 5000;
}
