import { prisma } from '../prisma.js';
import { listAdminAudit, writeAdminAudit } from '../adminAudit.js';
import { HUNT_MODEL_CATALOG, httpError, isPrismaMissing, normalizeHuntConfig } from './config.js';
import { loadLiveConfig, saveLiveConfig, withHuntSchema } from './session.js';
import { OPEN_HUNT_STATUSES } from './config.js';

function dbOf(options) {
  return options?.db || prisma;
}

function publicSessionRow(row) {
  return {
    id: row.id,
    userId: row.userId,
    status: row.status,
    mode: row.mode,
    simulation: row.simulation,
    shields: row.shields,
    captures: row.captures,
    distanceM: Math.round(row.distanceM || 0),
    coinsAwarded: row.coinsAwarded,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    endReason: row.endReason || null,
  };
}

export async function huntOverview(options = {}) {
  return withHuntSchema(async (db) => {
    const config = await loadLiveConfig(db);
    const [sessions, captures, suspicious, active, sim] = await Promise.all([
      db.huntSession.count(),
      db.huntCapture.count(),
      db.huntSuspicious.count(),
      db.huntSession.count({ where: { status: { in: [...OPEN_HUNT_STATUSES] } } }),
      db.huntSession.count({ where: { simulation: true } }),
    ]);
    return {
      config,
      models: HUNT_MODEL_CATALOG,
      metrics: {
        sessions,
        captures,
        suspicious,
        active,
        simulationSessions: sim,
      },
    };
  }, options);
}

export async function updateHuntConfig(rules, { admin } = {}, options = {}) {
  return withHuntSchema(async (db) => {
    const previous = await loadLiveConfig(db);
    const next = await saveLiveConfig(db, { ...previous, ...rules, coins: { ...previous.coins, ...(rules.coins || {}) }, qualify: { ...previous.qualify, ...(rules.qualify || {}) } });
    if (admin) {
      await writeAdminAudit({
        admin,
        action: 'HUNT_CONFIG_UPDATE',
        targetType: 'HuntConfig',
        targetId: 'default',
        previousValue: previous,
        newValue: next,
      });
    }
    return next;
  }, options);
}

export async function listHuntSessions(query = {}, options = {}) {
  return withHuntSchema(async (db) => {
    const take = Math.min(50, Math.max(1, Number(query.take) || 20));
    const skip = Math.max(0, Number(query.skip) || 0);
    const where = {};
    if (query.status) where.status = String(query.status);
    if (query.userId) where.userId = String(query.userId);
    if (query.simulation === 'true') where.simulation = true;
    if (query.simulation === 'false') where.simulation = false;
    const [items, total] = await Promise.all([
      db.huntSession.findMany({ where, orderBy: { createdAt: 'desc' }, take, skip }),
      db.huntSession.count({ where }),
    ]);
    return { items: items.map(publicSessionRow), total, take, skip };
  }, options);
}

export async function listHuntCaptures(query = {}, options = {}) {
  return withHuntSchema(async (db) => {
    const take = Math.min(50, Math.max(1, Number(query.take) || 20));
    const skip = Math.max(0, Number(query.skip) || 0);
    const where = {};
    if (query.userId) where.userId = String(query.userId);
    const [items, total] = await Promise.all([
      db.huntCapture.findMany({ where, orderBy: { createdAt: 'desc' }, take, skip }),
      db.huntCapture.count({ where }),
    ]);
    return { items, total, take, skip };
  }, options);
}

export async function listHuntSuspicious(query = {}, options = {}) {
  return withHuntSchema(async (db) => {
    const take = Math.min(50, Math.max(1, Number(query.take) || 20));
    const skip = Math.max(0, Number(query.skip) || 0);
    const [items, total] = await Promise.all([
      db.huntSuspicious.findMany({ orderBy: { createdAt: 'desc' }, take, skip }),
      db.huntSuspicious.count(),
    ]);
    return { items, total, take, skip };
  }, options);
}

export async function terminateHuntSession(sessionId, { admin } = {}, options = {}) {
  return withHuntSchema(async (db) => {
    const row = await db.huntSession.findUnique({ where: { id: sessionId } });
    if (!row) throw httpError('სესია ვერ მოიძებნა.', 404, 'HUNT_NOT_FOUND');
    const next = await db.huntSession.update({
      where: { id: sessionId },
      data: { status: 'ended', endedAt: new Date(), endReason: 'ADMIN' },
    });
    if (admin) {
      await writeAdminAudit({
        admin,
        action: 'HUNT_SESSION_TERMINATE',
        targetType: 'HuntSession',
        targetId: sessionId,
        previousValue: { status: row.status },
        newValue: { status: 'ended' },
      });
    }
    return publicSessionRow(next);
  }, options);
}

export async function grantHuntQa(userId, { admin } = {}, options = {}) {
  return withHuntSchema(async (db) => {
    if (!userId) throw httpError('მომხმარებელი აუცილებელია.', 400, 'HUNT_QA_USER');
    const row = await db.huntQaGrant.upsert({
      where: { userId },
      create: { userId, grantedBy: admin?.id || admin?.email || 'admin' },
      update: { grantedBy: admin?.id || admin?.email || 'admin' },
    });
    if (admin) {
      await writeAdminAudit({
        admin,
        action: 'HUNT_QA_GRANT',
        targetType: 'HuntQaGrant',
        targetId: userId,
        previousValue: null,
        newValue: { userId },
      });
    }
    return row;
  }, options);
}

export async function revokeHuntQa(userId, { admin } = {}, options = {}) {
  return withHuntSchema(async (db) => {
    await db.huntQaGrant.deleteMany({ where: { userId } });
    if (admin) {
      await writeAdminAudit({
        admin,
        action: 'HUNT_QA_REVOKE',
        targetType: 'HuntQaGrant',
        targetId: userId,
        previousValue: { userId },
        newValue: null,
      });
    }
    return { ok: true };
  }, options);
}

export async function listHuntQa(options = {}) {
  return withHuntSchema(async (db) => {
    const items = await db.huntQaGrant.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
    return { items };
  }, options);
}

export async function listHuntAudit(query = {}) {
  const take = Math.min(50, Math.max(1, Number(query.take) || 20));
  const skip = Math.max(0, Number(query.skip) || 0);
  return listAdminAudit({ q: 'HUNT_', limit: take, offset: skip });
}

export { isPrismaMissing };
export { dbOf };
