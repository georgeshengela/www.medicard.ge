import { randomUUID } from 'node:crypto';
import { prisma } from '../prisma.js';
import { getEffectiveQuestTimezone } from '../questTime.js';
import {
  DEFAULT_HUNT_CONFIG,
  HUNT_MODEL_CATALOG,
  OPEN_HUNT_STATUSES,
  httpError,
  isPrismaMissing,
  isSerializationConflict,
  isUniqueViolation,
  normalizeHuntConfig,
  publicHuntStatus,
  sessionMinutesForMode,
} from './config.js';
import { haversineM, inBounds, playBounds } from './geo.js';
import {
  deserializeGraph,
  graphPolylines,
  mulberry32,
  nearestEdge,
  nearestNode,
  pickSeparatedNodes,
  serializeGraph,
} from './graph.js';
import { captureEligible, classifySample, stoppedDwell } from './gps.js';
import { huntDayKey, missionForDay, missionSourceId, qualifiedSession, sessionCompleteSourceId } from './missions.js';
import { resolveHuntGraph } from './provider.js';
import { applyContacts, collectCapsule, stepEnemies } from './simulate.js';
import { creditHuntCoins, huntLedgerTotals } from './rewards.js';

const KINDS = ['chaser', 'interceptor', 'patroller', 'patroller'];

export function huntDb(options = {}) {
  return options.db || prisma;
}

export async function withHuntSchema(fn, options = {}) {
  const db = huntDb(options);
  try {
    return await fn(db);
  } catch (error) {
    if (isPrismaMissing(error)) {
      throw httpError('Medi Hunt ჯერ მზად არ არის ამ სერვერზე.', 503, 'HUNT_SCHEMA_UNAVAILABLE');
    }
    throw error;
  }
}

export async function loadLiveConfig(db) {
  const row = await db.huntConfig.findUnique({ where: { id: 'default' } });
  return normalizeHuntConfig(row?.rules || {});
}

export async function saveLiveConfig(db, rules) {
  const next = normalizeHuntConfig(rules);
  await db.huntConfig.upsert({
    where: { id: 'default' },
    create: { id: 'default', rules: next },
    update: { rules: next },
  });
  return next;
}

export async function publicHuntForApp(db = prisma) {
  try {
    if (typeof db?.huntConfig?.findUnique !== 'function') {
      return publicHuntStatus(DEFAULT_HUNT_CONFIG, { schemaReady: false });
    }
    const config = await loadLiveConfig(db);
    return publicHuntStatus(config, { schemaReady: true });
  } catch (error) {
    if (isPrismaMissing(error)) return publicHuntStatus(DEFAULT_HUNT_CONFIG, { schemaReady: false });
    console.warn('[hunt] public status unavailable', error?.message);
    return publicHuntStatus(DEFAULT_HUNT_CONFIG, { schemaReady: false });
  }
}

async function retryTx(db, fn) {
  let last = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await db.$transaction(fn);
    } catch (error) {
      last = error;
      if (isSerializationConflict(error) || isUniqueViolation(error)) continue;
      throw error;
    }
  }
  throw last;
}

function asDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isFinite(d.getTime()) ? d : null;
}

function seedFrom(id) {
  return [...String(id)].reduce((acc, ch) => (acc + ch.charCodeAt(0) * 17) >>> 0, 1);
}

function spawnEntities(graph, origin, config, sessionId) {
  const rng = mulberry32(seedFrom(sessionId));
  const enemyIds = pickSeparatedNodes(graph, config.enemyCount, origin, config.minSpawnSeparationM, rng);
  const capsuleIds = pickSeparatedNodes(graph, config.capsuleCount, origin, config.minSpawnSeparationM * 0.7, rng).filter(
    (id) => !enemyIds.includes(id),
  );
  const enemies = enemyIds.map((nodeId, i) => {
    const node = graph.nodes[nodeId];
    return {
      id: `e-${i + 1}`,
      type: 'enemy',
      kind: KINDS[i % KINDS.length],
      state: 'active',
      nodeId,
      point: { lat: node.lat, lng: node.lng },
      path: [],
      pathIndex: 0,
      alongM: 0,
    };
  });
  const capsules = capsuleIds.map((nodeId, i) => {
    const node = graph.nodes[nodeId];
    return {
      id: `c-${i + 1}`,
      type: 'capsule',
      state: 'idle',
      nodeId,
      point: { lat: node.lat, lng: node.lng },
    };
  });
  return [...enemies, ...capsules];
}

function liveOverrides(snapshotConfig, live) {
  return {
    ...snapshotConfig,
    enabled: live.enabled,
    rewardsEnabled: Boolean(live.enabled && live.rewardsEnabled && snapshotConfig.rewardsEnabled),
  };
}

function remainingSessionMs(row, now) {
  const started = asDate(row.startedAt)?.getTime() || now;
  const minutes = sessionMinutesForMode(row.config, row.mode);
  const pauseMs = row.status === 'paused' && row.pausedAt ? now - asDate(row.pausedAt).getTime() : 0;
  const budget = minutes * 60_000;
  const used = row.activeMs || 0;
  return Math.max(0, budget - used);
}

function huntingActive(row, now) {
  const until = asDate(row.huntUntil);
  return Boolean(until && now < until.getTime());
}

function expireIfNeeded(row, now) {
  if (!OPEN_HUNT_STATUSES.includes(row.status)) return row;
  if (asDate(row.expiresAt) && now >= asDate(row.expiresAt).getTime()) {
    return { ...row, status: 'expired', endedAt: new Date(now), encounter: null };
  }
  if (row.status === 'encounter' && row.encounter?.expiresAt && now >= new Date(row.encounter.expiresAt).getTime()) {
    const nextStatus = remainingSessionMs(row, now) > 0 ? 'active' : 'completed';
    return { ...row, status: nextStatus, encounter: null };
  }
  if (row.status === 'paused' && row.pausedAt) {
    const ttl = row.config.pauseTtlMs || DEFAULT_HUNT_CONFIG.pauseTtlMs;
    if (now - asDate(row.pausedAt).getTime() > ttl) {
      return { ...row, status: 'expired', endedAt: new Date(now) };
    }
  }
  if (remainingSessionMs(row, now) <= 0 && row.status !== 'encounter') {
    return { ...row, status: 'completed', endedAt: new Date(now) };
  }
  if (row.shields <= 0 && row.status === 'active') {
    return { ...row, status: 'ended', endedAt: new Date(now), endReason: 'NO_SHIELDS' };
  }
  return row;
}

function persistShape(row) {
  return {
    status: row.status,
    seq: row.seq,
    entities: row.entities,
    lastFix: row.lastFix,
    recentFixes: row.recentFixes,
    shields: row.shields,
    huntUntil: row.huntUntil,
    immuneUntil: row.immuneUntil,
    encounter: row.encounter,
    distanceM: row.distanceM,
    activeMs: row.activeMs,
    pausedAt: row.pausedAt,
    lastSimAt: row.lastSimAt,
    lastPingAt: row.lastPingAt,
    endedAt: row.endedAt,
    coinsAwarded: row.coinsAwarded,
    captures: row.captures,
    capsules: row.capsules,
    hunts: row.hunts,
    mission: row.mission,
    combo: row.combo,
    gpsHint: row.gpsHint || null,
    endReason: row.endReason || null,
  };
}

export function publicSnapshot(row, { live, totals, now, timezone } = {}) {
  const t = now || Date.now();
  const hunting = huntingActive(row, t);
  const graph = deserializeGraph(row.graph);
  const player = row.lastFix?.point || row.origin;
  const enemies = (row.entities || []).filter((e) => e.type === 'enemy');
  const capsules = (row.entities || []).filter((e) => e.type === 'capsule');
  const remainingHunt = hunting ? Math.max(0, asDate(row.huntUntil).getTime() - t) : 0;
  const sessionLeft = remainingSessionMs(row, t);
  const coins = row.config.coins;
  const dailyLeft = Math.max(0, coins.dailyCap - (totals?.daily || 0));
  const sessionLeftCoins = Math.max(0, coins.sessionCap - (totals?.session || 0));
  const rewardsOn = Boolean(live?.rewardsEnabled && row.config.rewardsEnabled) && !row.simulation;
  return {
    id: row.id,
    status: row.status,
    seq: row.seq,
    simulation: Boolean(row.simulation),
    mode: row.mode,
    attribution: '© OpenStreetMap contributors',
    modelKey: row.config.modelKey || HUNT_MODEL_CATALOG[0].key,
    bounds: row.bounds,
    streets: graphPolylines(graph),
    player,
    enemies: enemies.map((e) => ({
      id: e.id,
      kind: e.kind,
      state: e.state,
      lat: e.point?.lat,
      lng: e.point?.lng,
    })),
    capsules: capsules.map((c) => ({
      id: c.id,
      state: c.state,
      lat: c.point?.lat,
      lng: c.point?.lng,
    })),
    hunting,
    huntingMs: remainingHunt,
    remainingMs: sessionLeft,
    shields: row.shields,
    combo: row.combo || 0,
    distanceM: Math.round(row.distanceM || 0),
    activeMs: row.activeMs || 0,
    captures: row.captures || 0,
    mission: row.mission,
    gpsHint: row.gpsHint || null,
    encounter: row.encounter
      ? {
          enemyId: row.encounter.enemyId,
          expiresAt: row.encounter.expiresAt,
          preview: Boolean(row.simulation),
          token: row.encounter.id,
        }
      : null,
    coins: {
      rewardsEnabled: rewardsOn,
      confirmed: totals?.session || 0,
      dailyLeft,
      sessionLeft: sessionLeftCoins,
      capture: coins.capture,
      sessionComplete: coins.sessionComplete,
      dailyMission: coins.dailyMission,
      sessionCap: coins.sessionCap,
      dailyCap: coins.dailyCap,
      dailyUsed: totals?.daily || 0,
    },
    qualify: {
      meters: row.mode === 'gentle' ? row.config.qualify.gentleMeters : row.config.qualify.meters,
      activeMs: row.mode === 'gentle' ? row.config.qualify.gentleActiveMs : row.config.qualify.activeMs,
      qualified: qualifiedSession(row, row.config),
    },
    serverNow: new Date(t).toISOString(),
    timezone: timezone || null,
  };
}

async function loadOwned(db, { userId, sessionId }) {
  const row = await db.huntSession.findUnique({ where: { id: sessionId } });
  if (!row) throw httpError('სესია ვერ მოიძებნა.', 404, 'HUNT_NOT_FOUND');
  if (row.userId !== userId) throw httpError('ეს სესია შენი არ არის.', 403, 'HUNT_FORBIDDEN');
  row.config = normalizeHuntConfig(row.config);
  row.graph = row.graph;
  return row;
}

export async function startHuntSession(userId, body, options = {}) {
  return withHuntSchema(async (db) => {
    const live = await loadLiveConfig(db);
    const simulation = Boolean(body?.simulation);
    if (simulation) {
      const grant = await db.huntQaGrant.findUnique({ where: { userId } });
      if (!grant) throw httpError('სიმულაცია მხოლოდ დადასტურებული QA ანგარიშისთვისაა.', 403, 'HUNT_QA_REQUIRED');
    }
    if (!live.enabled && !simulation) {
      throw httpError('Medi Hunt ახლა გამორთულია.', 403, 'HUNT_DISABLED');
    }
    const lat = Number(body?.lat);
    const lng = Number(body?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      throw httpError('ადგილმდებარეობა არასწორია.', 400, 'HUNT_BAD_ORIGIN');
    }
    const accuracy = Number(body?.accuracy);
    if (!simulation && (!Number.isFinite(accuracy) || accuracy > live.accuracyMaxM * 2)) {
      throw httpError('ველოდებით უფრო ზუსტ ადგილმდებარეობას.', 422, 'HUNT_GPS_WEAK');
    }
    const mode = body?.mode === 'gentle' ? 'gentle' : 'default';
    const origin = { lat, lng };
    const open = await db.huntSession.count({
      where: { userId, status: { in: [...OPEN_HUNT_STATUSES] } },
    });
    if (open >= live.maxActiveSessions) {
      throw httpError('უკვე გაქვს აქტიური ნადირობა.', 409, 'HUNT_ACTIVE_EXISTS');
    }

    const graphResult = await resolveHuntGraph({
      db,
      origin,
      config: live,
      simulation,
      gentle: mode === 'gentle',
      fetchImpl: options.fetchImpl,
    });

    const now = options.now ? new Date(options.now) : new Date();
    const id = randomUUID();
    const entities = spawnEntities(graphResult.graph, origin, live, id);
    const timezone = getEffectiveQuestTimezone(options.user || {}, { timezone: options.timezone });
    const mission = missionForDay(huntDayKey(now, timezone));
    const minutes = sessionMinutesForMode(live, mode);
    const row = await db.huntSession.create({
      data: {
        id,
        userId,
        status: 'active',
        mode,
        simulation,
        seq: 1,
        config: live,
        bounds: graphResult.bounds || playBounds(origin, live.playAreaM),
        graph: serializeGraph(graphResult.graph),
        entities,
        origin,
        lastFix: simulation
          ? { point: origin, at: now.getTime(), accuracy: 5, seq: 1 }
          : null,
        recentFixes: [],
        shields: live.shields,
        huntUntil: null,
        immuneUntil: null,
        encounter: null,
        distanceM: 0,
        activeMs: 0,
        pausedAt: null,
        lastSimAt: now,
        lastPingAt: now,
        startedAt: now,
        expiresAt: new Date(now.getTime() + live.sessionTtlMs),
        endedAt: null,
        coinsAwarded: 0,
        captures: 0,
        capsules: 0,
        hunts: 0,
        combo: 0,
        mission: { key: mission.key, kind: mission.kind, target: mission.target, progress: 0 },
        gpsHint: simulation ? null : accuracy > live.accuracyMaxM ? 'WAITING_ACCURACY' : null,
      },
    });
    const totals = await huntLedgerTotals(db, userId, { sessionId: id, timezone, now });
    return publicSnapshot(row, { live, totals, now: now.getTime(), timezone });
  }, options);
}

function advance(row, live, now, acceptedPoint) {
  const graph = deserializeGraph(row.graph);
  const prevSim = asDate(row.lastSimAt)?.getTime() || now;
  const dtSec = Math.min(2.5, Math.max(0.2, (now - prevSim) / 1000));
  const hunting = huntingActive(row, now);
  const rng = mulberry32(seedFrom(row.id) + row.seq);
  const player = {
    point: acceptedPoint || row.lastFix?.point || row.origin,
    nodeId: nearestNode(graph, acceptedPoint || row.origin, 80)?.node?.id,
  };
  let entities = stepEnemies(graph, row.entities, player, { dtSec, hunting, config: live, rng });
  const contact = applyContacts(entities, player.point, live, now, asDate(row.immuneUntil)?.getTime());
  entities = contact.entities;
  let shields = row.shields;
  let combo = row.combo || 0;
  let immuneUntil = row.immuneUntil;
  if (contact.hit) {
    shields = Math.max(0, shields - 1);
    combo = 0;
    immuneUntil = new Date(contact.immuneUntil);
  }
  return { entities, shields, combo, immuneUntil, lastSimAt: new Date(now), playerPoint: player.point };
}

function bumpMission(row, kind, amount = 1) {
  const mission = { ...(row.mission || {}) };
  if (mission.kind === kind) {
    mission.progress = Math.min(mission.target, (mission.progress || 0) + amount);
  }
  return mission;
}

async function maybeAwardEnd(tx, row, live, now, timezone) {
  if (row.simulation || !live.rewardsEnabled) return { coins: 0 };
  let coins = 0;
  if (qualifiedSession(row, row.config)) {
    const credit = await creditHuntCoins(tx, {
      userId: row.userId,
      amount: row.config.coins.sessionComplete,
      sourceId: sessionCompleteSourceId(row.id),
      now,
      simulation: false,
      rewardsEnabled: true,
      liveRewardsEnabled: live.rewardsEnabled,
      config: row.config,
      timezone,
      sessionId: row.id,
      metadata: { kind: 'session' },
    });
    coins += credit.amount || 0;
  }
  const mission = row.mission;
  if (mission && mission.progress >= mission.target) {
    const dayKey = huntDayKey(now, timezone);
    const credit = await creditHuntCoins(tx, {
      userId: row.userId,
      amount: row.config.coins.dailyMission,
      sourceId: missionSourceId(row.userId, huntDayKey(now, timezone), mission.key),
      now,
      simulation: false,
      rewardsEnabled: true,
      liveRewardsEnabled: live.rewardsEnabled,
      config: row.config,
      timezone,
      sessionId: row.id,
      metadata: { kind: 'mission', dayKey },
    });
    coins += credit.amount || 0;
  }
  return { coins };
}

export async function pingHuntSession(userId, sessionId, body, options = {}) {
  return withHuntSchema(async (db) => {
    return retryTx(db, async (tx) => {
      const liveRow = await loadLiveConfig(tx);
      let row = await loadOwned(tx, { userId, sessionId });
      const nowDate = options.now ? new Date(options.now) : new Date();
      const now = nowDate.getTime();
      if (!liveRow.enabled && !row.simulation) {
        row = { ...row, status: 'ended', endedAt: nowDate, endReason: 'KILLED' };
        await tx.huntSession.update({ where: { id: row.id }, data: persistShape(row) });
        const totals = await huntLedgerTotals(tx, userId, { sessionId, timezone: options.timezone, now: nowDate });
        return publicSnapshot(row, { live: liveOverrides(row.config, liveRow), totals, now, timezone: options.timezone });
      }
      row = expireIfNeeded(row, now);
      if (!OPEN_HUNT_STATUSES.includes(row.status)) {
        await tx.huntSession.update({ where: { id: row.id }, data: persistShape(row) });
        const totals = await huntLedgerTotals(tx, userId, { sessionId, timezone: options.timezone, now: nowDate });
        return publicSnapshot(row, { live: liveOverrides(row.config, liveRow), totals, now, timezone: options.timezone });
      }
      if (row.status === 'paused' || row.status === 'encounter') {
        const totals = await huntLedgerTotals(tx, userId, { sessionId, timezone: options.timezone, now: nowDate });
        return publicSnapshot(row, { live: liveOverrides(row.config, liveRow), totals, now, timezone: options.timezone });
      }
      if (now - (asDate(row.lastPingAt)?.getTime() || 0) < row.config.pingMinIntervalMs) {
        throw httpError('ნელა, კიდევ ერთი წამი.', 429, 'HUNT_RATE');
      }
      const samples = Array.isArray(body?.samples) ? body.samples.slice(0, row.config.pingMaxBatch) : [];
      const live = liveOverrides(row.config, liveRow);
      let hint = null;
      let accepted = null;
      const recent = [...(row.recentFixes || [])];
      const prev = row.lastFix;
      for (const sample of samples) {
        const classified = classifySample(row.lastFix || prev, sample, live, row.mode, now);
        if (!classified.ok) {
          hint = classified.reason === 'ACCURACY' ? 'WAITING_ACCURACY' : classified.reason;
          if (['JUMP', 'SPEED', 'STALE', 'ORDER'].includes(classified.reason)) {
            await tx.huntSuspicious.create({
              data: {
                userId,
                sessionId: row.id,
                reason: classified.reason,
                payload: { sample, dist: classified.dist, mps: classified.mps },
              },
            });
          }
          continue;
        }
        const edge = nearestEdge(graphFrom(row), classified.point, live.graphSnapM);
        if (!edge) {
          hint = 'OFF_GRAPH';
          continue;
        }
        if (!inBounds(classified.point, row.bounds, 12)) {
          hint = 'OUT_OF_AREA';
          continue;
        }
        const lastPoint = row.lastFix?.point;
        const delta = lastPoint ? haversineM(lastPoint, classified.point) : 0;
        row.distanceM = (row.distanceM || 0) + delta;
        row.lastFix = classified;
        recent.push({ point: classified.point, at: classified.at, accuracy: classified.accuracy });
        accepted = classified.point;
      }
      while (recent.length > 12) recent.shift();
      row.recentFixes = recent;
      row.lastPingAt = nowDate;
      row.seq += 1;
      const prevSim = asDate(row.lastSimAt)?.getTime() || now;
      if (accepted || row.lastFix?.point) {
        const stepped = advance(row, live, now, accepted || row.lastFix.point);
        row.entities = stepped.entities;
        row.shields = stepped.shields;
        row.combo = stepped.combo;
        row.immuneUntil = stepped.immuneUntil;
        row.lastSimAt = stepped.lastSimAt;
        if (row.status === 'active') {
          row.activeMs = (row.activeMs || 0) + Math.min(2500, Math.max(0, now - prevSim));
        }
        if (row.mission?.kind === 'meters') {
          row.mission.progress = Math.min(row.mission.target, Math.round(row.distanceM));
        }
      }
      row.gpsHint = hint;
      row = expireIfNeeded(row, now);
      if (row.status === 'ended' || row.status === 'completed' || row.status === 'expired') {
        const awarded = await maybeAwardEnd(tx, row, live, nowDate, options.timezone);
        row.coinsAwarded = (row.coinsAwarded || 0) + awarded.coins;
      }
      await tx.huntSession.update({ where: { id: row.id }, data: persistShape(row) });
      const totals = await huntLedgerTotals(tx, userId, { sessionId, timezone: options.timezone, now: nowDate });
      return publicSnapshot(row, { live, totals, now, timezone: options.timezone });
    });
  }, options);
}

function graphFrom(row) {
  return deserializeGraph(row.graph);
}

export async function getHuntSession(userId, sessionId, options = {}) {
  return withHuntSchema(async (db) => {
    const live = await loadLiveConfig(db);
    let row = await loadOwned(db, { userId, sessionId });
    const nowDate = options.now ? new Date(options.now) : new Date();
    const expired = expireIfNeeded(row, nowDate.getTime());
    if (expired.status !== row.status) {
      row = expired;
      await db.huntSession.update({ where: { id: row.id }, data: persistShape(row) });
    }
    const timezone = options.timezone;
    const totals = await huntLedgerTotals(db, userId, { sessionId, timezone, now: nowDate });
    return publicSnapshot(row, { live: liveOverrides(row.config, live), totals, now: nowDate.getTime(), timezone });
  }, options);
}

export async function pauseHuntSession(userId, sessionId, options = {}) {
  return withHuntSchema(async (db) => {
    const live = await loadLiveConfig(db);
    const row = await loadOwned(db, { userId, sessionId });
    const now = options.now ? new Date(options.now) : new Date();
    if (row.status === 'encounter') {
      throw httpError('შეხვედრის დროს პაუზა არ იწყება.', 409, 'HUNT_IN_ENCOUNTER');
    }
    if (row.status !== 'active') {
      return getHuntSession(userId, sessionId, options);
    }
    const next = { ...row, status: 'paused', pausedAt: now, lastSimAt: now };
    await db.huntSession.update({ where: { id: row.id }, data: persistShape(next) });
    const totals = await huntLedgerTotals(db, userId, { sessionId, timezone: options.timezone, now });
    return publicSnapshot(next, { live: liveOverrides(row.config, live), totals, now: now.getTime(), timezone: options.timezone });
  }, options);
}

export async function resumeHuntSession(userId, sessionId, options = {}) {
  return withHuntSchema(async (db) => {
    const live = await loadLiveConfig(db);
    let row = await loadOwned(db, { userId, sessionId });
    const now = options.now ? new Date(options.now) : new Date();
    row = expireIfNeeded(row, now.getTime());
    if (row.status === 'paused') {
      row.status = 'active';
      row.pausedAt = null;
      row.lastSimAt = now;
    }
    await db.huntSession.update({ where: { id: row.id }, data: persistShape(row) });
    const totals = await huntLedgerTotals(db, userId, { sessionId, timezone: options.timezone, now });
    return publicSnapshot(row, { live: liveOverrides(row.config, live), totals, now: now.getTime(), timezone: options.timezone });
  }, options);
}

export async function endHuntSession(userId, sessionId, options = {}) {
  return withHuntSchema(async (db) => {
    return retryTx(db, async (tx) => {
      const liveRow = await loadLiveConfig(tx);
      let row = await loadOwned(tx, { userId, sessionId });
      const now = options.now ? new Date(options.now) : new Date();
      const live = liveOverrides(row.config, liveRow);
      if (OPEN_HUNT_STATUSES.includes(row.status)) {
        row.status = 'ended';
        row.endedAt = now;
        const awarded = await maybeAwardEnd(tx, row, live, now, options.timezone);
        row.coinsAwarded = (row.coinsAwarded || 0) + awarded.coins;
      }
      await tx.huntSession.update({ where: { id: row.id }, data: persistShape(row) });
      const totals = await huntLedgerTotals(tx, userId, { sessionId, timezone: options.timezone, now });
      return publicSnapshot(row, { live, totals, now: now.getTime(), timezone: options.timezone });
    });
  }, options);
}

export async function collectHuntCapsule(userId, sessionId, capsuleId, options = {}) {
  return withHuntSchema(async (db) => {
    return retryTx(db, async (tx) => {
      const liveRow = await loadLiveConfig(tx);
      let row = await loadOwned(tx, { userId, sessionId });
      const now = options.now ? new Date(options.now) : new Date();
      if (row.status !== 'active') throw httpError('ახლა კაფსულის აღება არ შეიძლება.', 409, 'HUNT_BUSY');
      const live = liveOverrides(row.config, liveRow);
      const player = row.lastFix?.point;
      const result = collectCapsule(row.entities, capsuleId, player, live.captureRadiusM + 6);
      if (!result.ok) throw httpError('კაფსულამდე ჯერ ვერ მიხვედი.', 422, 'HUNT_CAPSULE_FAR');
      row.entities = result.entities;
      row.capsules = (row.capsules || 0) + 1;
      const addMs = live.huntDurationSec * 1000;
      const current = huntingActive(row, now.getTime()) ? asDate(row.huntUntil).getTime() : now.getTime();
      const stacked = Math.min(now.getTime() + live.huntMaxStackedSec * 1000, current + addMs);
      row.huntUntil = new Date(stacked);
      row.hunts = (row.hunts || 0) + 1;
      row.mission = bumpMission(row, 'capsules');
      if (row.mission?.kind === 'hunts') row.mission = bumpMission(row, 'hunts');
      row.seq += 1;
      await tx.huntSession.update({ where: { id: row.id }, data: persistShape(row) });
      const totals = await huntLedgerTotals(tx, userId, { sessionId, timezone: options.timezone, now });
      return publicSnapshot(row, { live, totals, now: now.getTime(), timezone: options.timezone });
    });
  }, options);
}

export async function startHuntEncounter(userId, sessionId, enemyId, options = {}) {
  return withHuntSchema(async (db) => {
    return retryTx(db, async (tx) => {
      const liveRow = await loadLiveConfig(tx);
      let row = await loadOwned(tx, { userId, sessionId });
      const now = options.now ? new Date(options.now) : new Date();
      if (row.status !== 'active') throw httpError('შეხვედრა ახლა ვერ დაიწყება.', 409, 'HUNT_BUSY');
      const live = liveOverrides(row.config, liveRow);
      const enemy = (row.entities || []).find((e) => e.id === enemyId && e.type === 'enemy' && e.state !== 'captured');
      if (!enemy) throw httpError('ეს ვირუსი აღარ არის ხელმისაწვდომი.', 404, 'HUNT_ENEMY_GONE');
      const player = row.lastFix?.point;
      const graph = graphFrom(row);
      const edge = player ? nearestEdge(graph, player, live.graphSnapM) : null;
      const graphHitM = edge ? edge.distanceM : 999;
      const stopped = stoppedDwell(row.recentFixes, live, now.getTime());
      const gate = captureEligible({
        config: live,
        hunting: huntingActive(row, now.getTime()),
        enemyPoint: enemy.point,
        playerPoint: player,
        graphHitM,
        stopped: row.simulation ? true : stopped,
        now: now.getTime(),
        huntUntil: asDate(row.huntUntil)?.getTime(),
      });
      if (!gate.ok) {
        const hint =
          gate.reason === 'MOVING'
            ? 'WAITING_STOP'
            : gate.reason === 'FAR' || gate.reason === 'INACCESSIBLE'
              ? 'WAITING_ACCURACY'
              : gate.reason;
        throw httpError(
          gate.reason === 'MOVING'
            ? 'გაჩერდი — ვირუსის დასაჭერად მშვიდი ადგილი გვჭირდება.'
            : 'ველოდებით უფრო ზუსტ ადგილმდებარეობას.',
          422,
          'HUNT_CAPTURE_GATE',
        );
      }
      const token = randomUUID();
      row.status = 'encounter';
      row.encounter = {
        id: token,
        enemyId,
        issuedAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + live.encounterTokenTtlMs).toISOString(),
        used: false,
      };
      row.lastSimAt = now;
      row.seq += 1;
      await tx.huntSession.update({ where: { id: row.id }, data: persistShape(row) });
      const totals = await huntLedgerTotals(tx, userId, { sessionId, timezone: options.timezone, now });
      const snap = publicSnapshot(row, { live, totals, now: now.getTime(), timezone: options.timezone });
      snap.encounter = { ...snap.encounter, token };
      return snap;
    });
  }, options);
}

export async function completeHuntEncounter(userId, sessionId, body, options = {}) {
  return withHuntSchema(async (db) => {
    const result = await retryTx(db, async (tx) => {
      const liveRow = await loadLiveConfig(tx);
      let row = await loadOwned(tx, { userId, sessionId });
      const now = options.now ? new Date(options.now) : new Date();
      const live = liveOverrides(row.config, liveRow);
      const token = String(body?.token || '');
      if (!row.encounter || row.encounter.used) throw httpError('შეხვედრა უკვე დასრულდა.', 409, 'HUNT_ENCOUNTER_USED');
      if (row.encounter.id !== token) throw httpError('შეხვედრის კოდი არასწორია.', 403, 'HUNT_ENCOUNTER_TOKEN');
      if (now.getTime() > new Date(row.encounter.expiresAt).getTime()) {
        row.status = remainingSessionMs(row, now.getTime()) > 0 ? 'active' : 'completed';
        row.encounter = null;
        await tx.huntSession.update({ where: { id: row.id }, data: persistShape(row) });
        return { error: httpError('შეხვედრის დრო ამოიწურა.', 410, 'HUNT_ENCOUNTER_EXPIRED') };
      }
      const enemyId = row.encounter.enemyId;
      const existing = await tx.huntCapture.findUnique({
        where: { sessionId_enemyId: { sessionId: row.id, enemyId } },
      });
      if (existing) {
        row.encounter = null;
        row.status = 'active';
        await tx.huntSession.update({ where: { id: row.id }, data: persistShape(row) });
        const totals = await huntLedgerTotals(tx, userId, { sessionId, timezone: options.timezone, now });
        return publicSnapshot(row, { live, totals, now: now.getTime(), timezone: options.timezone });
      }
      const capture = await tx.huntCapture.create({
        data: { id: randomUUID(), sessionId: row.id, userId, enemyId },
      });
      row.entities = (row.entities || []).map((e) => (e.id === enemyId ? { ...e, state: 'captured' } : e));
      row.captures = (row.captures || 0) + 1;
      row.combo = (row.combo || 0) + 1;
      row.mission = bumpMission(row, 'captures');
      row.encounter = null;
      row.status = remainingSessionMs(row, now.getTime()) > 0 ? 'active' : 'completed';
      if (row.status === 'active') row.lastSimAt = now;

      let progress = { viruses: 0 };
      if (!row.simulation) {
        progress = await tx.huntProgress.upsert({
          where: { userId },
          create: { userId, viruses: 1, titles: [] },
          update: { viruses: { increment: 1 } },
        });
      }

      let coinResult = { amount: 0 };
      if (!row.simulation) {
        coinResult = await creditHuntCoins(tx, {
          userId,
          amount: row.config.coins.capture,
          sourceId: `hunt:capture:${capture.id}`,
          now,
          simulation: false,
          rewardsEnabled: true,
          liveRewardsEnabled: live.rewardsEnabled,
          config: row.config,
          timezone: options.timezone,
          sessionId: row.id,
          metadata: { kind: 'capture', enemyId },
        });
        row.coinsAwarded = (row.coinsAwarded || 0) + (coinResult.amount || 0);
      }
      if (row.status === 'completed' || row.status === 'ended') {
        const awarded = await maybeAwardEnd(tx, row, live, now, options.timezone);
        row.coinsAwarded = (row.coinsAwarded || 0) + awarded.coins;
      }
      await tx.huntSession.update({ where: { id: row.id }, data: persistShape(row) });
      const totals = await huntLedgerTotals(tx, userId, { sessionId, timezone: options.timezone, now });
      const snap = publicSnapshot(row, { live, totals, now: now.getTime(), timezone: options.timezone });
      snap.progress = { viruses: progress.viruses };
      snap.lastAward = { coins: coinResult.amount || 0, reason: coinResult.reason || null };
      return snap;
    });
    if (result?.error) throw result.error;
    return result;
  }, options);
}

export async function cancelHuntEncounter(userId, sessionId, options = {}) {
  return withHuntSchema(async (db) => {
    const live = await loadLiveConfig(db);
    let row = await loadOwned(db, { userId, sessionId });
    const now = options.now ? new Date(options.now) : new Date();
    if (row.status === 'encounter') {
      row.status = remainingSessionMs(row, now.getTime()) > 0 ? 'active' : 'completed';
      row.encounter = null;
      row.lastSimAt = now;
      await db.huntSession.update({ where: { id: row.id }, data: persistShape(row) });
    }
    const totals = await huntLedgerTotals(db, userId, { sessionId, timezone: options.timezone, now });
    return publicSnapshot(row, { live: liveOverrides(row.config, live), totals, now: now.getTime(), timezone: options.timezone });
  }, options);
}

export async function huntProgressForUser(userId, options = {}) {
  return withHuntSchema(async (db) => {
    const row = await db.huntProgress.findUnique({ where: { userId } });
    return { viruses: row?.viruses || 0, titles: row?.titles || [] };
  }, options);
}
