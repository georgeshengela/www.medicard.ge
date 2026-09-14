import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { pedestrianAllowed, pedestrianDirections, wayUsable } from './access.js';
import { DEFAULT_HUNT_CONFIG, normalizeHuntConfig } from './config.js';
import { createHuntFakeDb } from './fakeDb.js';
import { fixtureHasDisconnectedBridge, fixtureHuntGraph } from './fixtureGraph.js';
import { classifySample, captureEligible, stoppedDwell } from './gps.js';
import { playerComponent } from './graph.js';
import { clampAward, qualifiedSession } from './missions.js';
import {
  completeHuntEncounter,
  getHuntSession,
  publicHuntForApp,
  startHuntEncounter,
  startHuntSession,
} from './session.js';
import { creditHuntCoins } from './rewards.js';

const ORIGIN = { lat: 41.7151, lng: 44.8271 };

describe('Medi Hunt graph', () => {
  it('connects shared OSM nodes and leaves a visual-only bridge disconnected', () => {
    const graph = fixtureHuntGraph(ORIGIN, 1000);
    assert.ok(fixtureHasDisconnectedBridge(graph));
    const component = playerComponent(graph, ORIGIN, 80);
    assert.equal(Boolean(component.graph.nodes['bridge:a']), false);
    assert.ok(Object.keys(component.graph.nodes).length >= 20);
  });

  it('rejects motorways and private foot, keeps designated sidewalks', () => {
    assert.equal(pedestrianAllowed({ highway: 'motorway' }), false);
    assert.equal(pedestrianAllowed({ highway: 'residential', access: 'private' }), false);
    assert.equal(pedestrianAllowed({ highway: 'footway', foot: 'yes' }), true);
    assert.equal(wayUsable({ highway: 'steps' }, { gentle: true }), false);
    assert.equal(wayUsable({ highway: 'steps' }, { gentle: false }), true);
    assert.deepEqual(pedestrianDirections({ highway: 'footway', 'oneway:foot': 'yes' }), { forward: true, backward: false });
  });
});

describe('Medi Hunt GPS and capture gates', () => {
  it('rejects stale, inaccurate, and jumping samples', () => {
    const now = 1_000_000;
    const cfg = DEFAULT_HUNT_CONFIG;
    assert.equal(classifySample(null, { lat: 41.7, lng: 44.8, accuracy: 4, at: now - 20_000 }, cfg, 'default', now).ok, false);
    assert.equal(classifySample(null, { lat: 41.7, lng: 44.8, accuracy: 40, at: now }, cfg, 'default', now).ok, false);
    const prev = { point: ORIGIN, at: now - 1000, seq: 1 };
    const jump = classifySample(prev, { lat: ORIGIN.lat + 0.02, lng: ORIGIN.lng, accuracy: 5, at: now, seq: 2 }, cfg, 'default', now);
    assert.equal(jump.ok, false);
  });

  it('requires hunting, dwell, and ~10 m radius', () => {
    const cfg = DEFAULT_HUNT_CONFIG;
    const now = Date.now();
    const enemy = ORIGIN;
    const player = { lat: ORIGIN.lat + 0.00004, lng: ORIGIN.lng };
    const far = captureEligible({
      config: cfg,
      hunting: true,
      enemyPoint: enemy,
      playerPoint: { lat: ORIGIN.lat + 0.01, lng: ORIGIN.lng },
      graphHitM: 3,
      stopped: true,
      now,
      huntUntil: now + 10_000,
    });
    assert.equal(far.ok, false);
    const near = captureEligible({
      config: cfg,
      hunting: true,
      enemyPoint: enemy,
      playerPoint: player,
      graphHitM: 3,
      stopped: true,
      now,
      huntUntil: now + 10_000,
    });
    assert.equal(near.ok, true);
    assert.equal(
      stoppedDwell(
        [
          { point: ORIGIN, at: now - 400 },
          { point: ORIGIN, at: now - 200 },
          { point: ORIGIN, at: now },
        ],
        cfg,
        now,
      ),
      true,
    );
  });
});

describe('Medi Hunt economy', () => {
  it('clamps session and daily caps', () => {
    const cfg = DEFAULT_HUNT_CONFIG;
    assert.equal(clampAward(5, { daily: 18, session: 8, config: cfg }), 2);
    assert.equal(clampAward(5, { daily: 20, session: 0, config: cfg }), 0);
  });

  it('does not qualify idle sessions', () => {
    const cfg = DEFAULT_HUNT_CONFIG;
    assert.equal(qualifiedSession({ mode: 'default', distanceM: 20, activeMs: 60_000 }, cfg), false);
    assert.equal(qualifiedSession({ mode: 'default', distanceM: 250, activeMs: 5 * 60_000 }, cfg), true);
    assert.equal(qualifiedSession({ mode: 'gentle', distanceM: 150, activeMs: 6 * 60_000 }, cfg), true);
  });

  it('rejects configs that drop caps or overspeed enemies', () => {
    assert.throws(() => normalizeHuntConfig({ coins: { sessionCap: 1, capture: 5, dailyCap: 20 } }));
    assert.throws(() => normalizeHuntConfig({ chaserSpeedMps: 9, maxSpeedMps: 3.5 }));
  });
});

describe('Medi Hunt session authority', () => {
  it('starts a simulation session, never writes coins, and captures once', async () => {
    const db = createHuntFakeDb();
    await db.huntQaGrant.create({ data: { userId: 'user-1', grantedBy: 'admin' } });
    const snap = await startHuntSession(
      'user-1',
      { lat: ORIGIN.lat, lng: ORIGIN.lng, accuracy: 5, simulation: true },
      { db },
    );
    assert.equal(snap.simulation, true);
    assert.ok(snap.streets.length > 4);
    assert.equal(snap.coins.rewardsEnabled, false);

    const row = await db.huntSession.findFirst({ where: { userId: 'user-1' } });
    const enemy = row.entities.find((e) => e.type === 'enemy');
    const now = Date.now();
    await db.huntSession.update({
      where: { id: row.id },
      data: {
        lastFix: { point: enemy.point, at: now, accuracy: 5, seq: 2 },
        recentFixes: [
          { point: enemy.point, at: now - 400 },
          { point: enemy.point, at: now - 200 },
          { point: enemy.point, at: now },
        ],
        huntUntil: new Date(now + 60_000),
      },
    });
    const enc = await startHuntEncounter('user-1', row.id, enemy.id, { db, now: new Date(now) });
    assert.ok(enc.encounter?.token);
    const done = await completeHuntEncounter('user-1', row.id, { token: enc.encounter.token }, { db, now: new Date(now + 1000) });
    assert.equal(done.captures, 1);
    const ledger = await db.rewardLedger.findMany({ where: { userId: 'user-1' } });
    assert.equal(ledger.length, 0);

    await assert.rejects(() => completeHuntEncounter('user-1', row.id, { token: enc.encounter.token }, { db, now: new Date(now + 2000) }));
  });

  it('credits HUNT ledger only for non-simulation and refuses a second identical sourceId', async () => {
    const db = createHuntFakeDb();
    const now = new Date();
    const cfg = DEFAULT_HUNT_CONFIG;
    const first = await creditHuntCoins(db, {
      userId: 'u2',
      amount: 1,
      sourceId: 'hunt:capture:aaa',
      now,
      simulation: false,
      rewardsEnabled: true,
      liveRewardsEnabled: true,
      config: cfg,
      timezone: 'Asia/Tbilisi',
      sessionId: 's1',
    });
    assert.equal(first.created, true);
    assert.equal(first.amount, 1);
    const second = await creditHuntCoins(db, {
      userId: 'u2',
      amount: 1,
      sourceId: 'hunt:capture:aaa',
      now,
      simulation: false,
      rewardsEnabled: true,
      liveRewardsEnabled: true,
      config: cfg,
      timezone: 'Asia/Tbilisi',
      sessionId: 's1',
    });
    assert.equal(second.created, false);
    const sim = await creditHuntCoins(db, {
      userId: 'u2',
      amount: 5,
      sourceId: 'hunt:session:s1:complete',
      now,
      simulation: true,
      rewardsEnabled: true,
      liveRewardsEnabled: true,
      config: cfg,
      timezone: 'Asia/Tbilisi',
      sessionId: 's1',
    });
    assert.equal(sim.amount, 0);
    const rows = await db.rewardLedger.findMany({ where: { userId: 'u2' } });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].sourceType, 'HUNT');
  });

  it('rejects another user touching a session', async () => {
    const db = createHuntFakeDb();
    await db.huntQaGrant.create({ data: { userId: 'owner', grantedBy: 'admin' } });
    const snap = await startHuntSession('owner', { lat: ORIGIN.lat, lng: ORIGIN.lng, accuracy: 5, simulation: true }, { db });
    await assert.rejects(() => startHuntEncounter('intruder', snap.id, 'e-1', { db }));
  });

  it('expires an encounter token and does not capture', async () => {
    const db = createHuntFakeDb();
    await db.huntQaGrant.create({ data: { userId: 'user-3', grantedBy: 'admin' } });
    const snap = await startHuntSession(
      'user-3',
      { lat: ORIGIN.lat, lng: ORIGIN.lng, accuracy: 5, simulation: true },
      { db },
    );
    const row = await db.huntSession.findFirst({ where: { userId: 'user-3' } });
    const enemy = row.entities.find((e) => e.type === 'enemy');
    const now = Date.now();
    await db.huntSession.update({
      where: { id: row.id },
      data: {
        lastFix: { point: enemy.point, at: now, accuracy: 5, seq: 2 },
        recentFixes: [
          { point: enemy.point, at: now - 400 },
          { point: enemy.point, at: now - 200 },
          { point: enemy.point, at: now },
        ],
        huntUntil: new Date(now + 60_000),
      },
    });
    const enc = await startHuntEncounter('user-3', row.id, enemy.id, { db, now: new Date(now) });
    await assert.rejects(() =>
      completeHuntEncounter('user-3', row.id, { token: enc.encounter.token }, { db, now: new Date(now + 60_000) }),
    );
    const after = await getHuntSession('user-3', row.id, { db, now: new Date(now + 61_000) });
    assert.notEqual(after.status, 'encounter');
    assert.equal(after.captures, 0);
    const progress = await db.huntProgress.findUnique({ where: { userId: 'user-3' } });
    assert.ok(!progress);
  });

  it('public Hunt status never throws when Prisma Hunt models are missing', async () => {
    const status = await publicHuntForApp({});
    assert.equal(status.schemaReady, false);
    assert.equal(status.enabled, false);
  });
});
