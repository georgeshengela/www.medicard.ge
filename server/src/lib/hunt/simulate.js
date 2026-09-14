import { haversineM } from './geo.js';
import { astar, farthestNode, moveAlongPath, nearestNode } from './graph.js';

function enemySpeed(kind, hunting, config) {
  if (hunting) return config.fleeSpeedMps;
  if (kind === 'interceptor') return config.interceptorSpeedMps;
  if (kind === 'patroller') return config.patrollerSpeedMps;
  return config.chaserSpeedMps;
}

function goalFor(graph, enemy, playerNodeId, playerPoint, hunting, config) {
  if (hunting) {
    const far = farthestNode(graph, playerNodeId || enemy.nodeId);
    return far?.id || enemy.nodeId;
  }
  if (enemy.kind === 'patroller') {
    const d = playerPoint && graph.nodes[enemy.nodeId] ? haversineM(playerPoint, graph.nodes[enemy.nodeId]) : 999;
    if (d < 70 && playerNodeId) return playerNodeId;
    return enemy.patrolTarget || enemy.nodeId;
  }
  if (enemy.kind === 'interceptor' && playerNodeId) {
    const lead = farthestToward(graph, playerNodeId, playerPoint, config.interceptLeadM);
    return lead || playerNodeId;
  }
  return playerNodeId || enemy.nodeId;
}

function farthestToward(graph, nodeId, headingPoint, leadM) {
  const origin = graph.nodes[nodeId];
  if (!origin) return nodeId;
  let best = nodeId;
  let bestScore = -1;
  for (const node of Object.values(graph.nodes)) {
    const d = haversineM(origin, node);
    if (d < 20 || d > leadM + 40) continue;
    const score = d;
    if (score > bestScore) {
      best = node.id;
      bestScore = d;
    }
  }
  return best;
}

export function stepEnemies(graph, entities, player, { dtSec, hunting, config, rng }) {
  const playerSnap = player?.point ? nearestNode(graph, player.point, 80) : null;
  const playerNodeId = playerSnap?.node?.id || player?.nodeId;
  const next = [];
  for (const entity of entities || []) {
    if (entity.type !== 'enemy' || entity.state === 'captured') {
      next.push(entity);
      continue;
    }
    const speed = enemySpeed(entity.kind, hunting, config);
    let path = entity.path || [];
    let goal = goalFor(graph, entity, playerNodeId, player?.point, hunting, config);
    if (entity.kind === 'patroller' && !hunting && (!entity.patrolTarget || entity.patrolTarget === entity.nodeId)) {
      const ids = Object.keys(graph.nodes);
      entity.patrolTarget = ids[Math.floor(rng() * ids.length)] || entity.nodeId;
      goal = entity.patrolTarget;
    }
    if (!path.length || path[path.length - 1] !== goal) {
      path = astar(graph, entity.nodeId, goal);
    }
    const moved = moveAlongPath(graph, path, entity.pathIndex || 0, entity.alongM || 0, speed * dtSec);
    const arrived = path.length && moved.index >= path.length - 1 && hunting === false && entity.kind === 'patroller';
    next.push({
      ...entity,
      nodeId: moved.nodeId || entity.nodeId,
      path,
      pathIndex: moved.index,
      alongM: moved.along,
      point: moved.point || graph.nodes[moved.nodeId] || entity.point,
      patrolTarget: arrived ? null : entity.patrolTarget,
    });
  }
  return next;
}

export function applyContacts(entities, playerPoint, config, now, immuneUntil) {
  if (!playerPoint) return { entities, hit: false, immuneUntil };
  if (immuneUntil && now < immuneUntil) return { entities, hit: false, immuneUntil };
  let hit = false;
  for (const entity of entities) {
    if (entity.type !== 'enemy' || entity.state === 'captured' || !entity.point) continue;
    if (haversineM(playerPoint, entity.point) <= config.contactRadiusM) {
      hit = true;
      break;
    }
  }
  return {
    entities,
    hit,
    immuneUntil: hit ? now + config.contactImmunityMs : immuneUntil,
  };
}

export function collectCapsule(entities, capsuleId, playerPoint, radiusM) {
  const item = (entities || []).find((e) => e.id === capsuleId && e.type === 'capsule' && e.state !== 'taken');
  if (!item) return { ok: false, reason: 'GONE' };
  if (!playerPoint || haversineM(playerPoint, item.point) > radiusM + 4) {
    return { ok: false, reason: 'FAR' };
  }
  return {
    ok: true,
    entities: entities.map((e) => (e.id === capsuleId ? { ...e, state: 'taken', takenAt: Date.now() } : e)),
  };
}
