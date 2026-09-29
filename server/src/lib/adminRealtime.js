import { attachCommunityRealtime } from './communityRealtime.js';
import { Server } from 'socket.io';
import { prisma } from './prisma.js';
import { tbilisiYmd } from './checkIn.js';
import { loadAppActivityRows } from './appActivity.js';
import { invalidateAdminAnalyticsPrefix } from './adminAnalytics.js';
import { ADMIN_SOCKET_ROOM, authorizeSocketHandshake, userSocketRoom } from './socketAuth.js';
import { registerQuestRealtimeEmitter } from './questRealtime.js';

const ROOM = ADMIN_SOCKET_ROOM;
const LIVE_MS = 90_000;
const DEBOUNCE_MS = 300;

let io = null;
let flushTimer = null;
const seen = new Map();

export function getRealtimeIo() {
  return io;
}

export function attachAdminRealtime(httpServer) {
  io = new Server(httpServer, {
    path: '/socket.io',
    cors: { origin: true, credentials: true },
    transports: ['websocket', 'polling'],
  });

  attachCommunityRealtime(io);

  io.use(async (socket, next) => {
    try {
      const identity = await authorizeSocketHandshake(socket.handshake.auth?.token);
      socket.data.identity = identity;
      if (identity.kind === 'admin') socket.data.adminId = identity.adminId;
      if (identity.kind === 'user') socket.data.userId = identity.userId;
      return next();
    } catch (error) {
      return next(new Error(error?.message === 'forbidden' ? 'forbidden' : 'unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const identity = socket.data.identity;
    if (identity?.kind === 'admin') {
      socket.join(ROOM);
      getOpsLiveSnapshot()
        .then((snap) => socket.emit('ops:live', snap))
        .catch(() => undefined);
      return;
    }
    if (identity?.kind === 'user') {
      socket.join(userSocketRoom(identity.userId));
    }
  });

  registerQuestRealtimeEmitter((userId, payload) => {
    if (!io || !userId) return;
    const event = payload?.event || 'quest:update';
    const { event: _ignored, userId: _uid, ...rest } = payload || {};
    io.to(userSocketRoom(userId)).emit(event, rest);
  });

  return io;
}

export function notifyOpsActivity(row) {
  if (row?.userId) seen.set(row.userId, Date.now());
  if (!io) return;
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    getOpsLiveSnapshot()
      .then((snap) => io.to(ROOM).emit('ops:live', snap))
      .catch(() => undefined);
  }, DEBOUNCE_MS);
}

let brainFlushTimer = null;
let brainPending = { decisions: 0, outcomes: 0 };

/** Per-user coalescing: at most one `health:metrics` every 3 s (one trailing event carries the merged flags). */
const HEALTH_EMIT_GAP_MS = 3000;
const healthEmits = new Map();

export function emitUserHealthMetrics(userId, payload = {}) {
  if (!io || !userId) return false;
  const now = Date.now();
  const slot = healthEmits.get(userId) || { last: 0, timer: null, pending: null };
  const send = (flags) => {
    slot.last = Date.now();
    io?.to(userSocketRoom(userId)).emit('health:metrics', { at: new Date().toISOString(), ...flags });
  };
  if (now - slot.last >= HEALTH_EMIT_GAP_MS && !slot.timer) {
    send(payload);
  } else {
    slot.pending = { steps: Boolean(slot.pending?.steps || payload.steps), hydration: Boolean(slot.pending?.hydration || payload.hydration) };
    if (!slot.timer) {
      slot.timer = setTimeout(() => {
        slot.timer = null;
        const flags = slot.pending;
        slot.pending = null;
        if (flags) send(flags);
        if (!slot.timer && Date.now() - slot.last > 60_000) healthEmits.delete(userId);
      }, Math.max(0, HEALTH_EMIT_GAP_MS - (now - slot.last)));
      slot.timer.unref?.();
    }
  }
  healthEmits.set(userId, slot);
  return true;
}

export function notifyBrainSync(kind, count = 0) {
  if (kind === 'decisions') brainPending.decisions += count;
  if (kind === 'outcomes') brainPending.outcomes += count;
  if (!io || brainFlushTimer) return;
  brainFlushTimer = setTimeout(() => {
    brainFlushTimer = null;
    const payload = {
      refreshedAt: new Date().toISOString(),
      decisions: brainPending.decisions,
      outcomes: brainPending.outcomes,
    };
    brainPending = { decisions: 0, outcomes: 0 };
    invalidateAdminAnalyticsPrefix('notifications');
    invalidateAdminAnalyticsPrefix('dash:');
    invalidateAdminAnalyticsPrefix('quality-bundle:');
    io.to(ROOM).emit('brain:sync', payload);
  }, 1500);
}

export async function getOpsLiveSnapshot() {
  const now = Date.now();
  const today = tbilisiYmd(new Date());
  const rows = await loadAppActivityRows(today, today, { fresh: true });
  const active = new Set();
  const online = new Set();
  for (const row of rows) {
    if (row.userId) active.add(row.userId);
    const at = new Date(row.lastAt).getTime();
    if (row.userId && Number.isFinite(at) && now - at <= LIVE_MS) online.add(row.userId);
  }
  for (const [userId, at] of seen) {
    if (now - at > LIVE_MS) seen.delete(userId);
    else online.add(userId);
  }
  let newUsersToday = 0;
  try {
    const start = new Date(`${today}T00:00:00+04:00`);
    newUsersToday = await prisma.user.count({ where: { createdAt: { gte: start } } });
  } catch {
    newUsersToday = 0;
  }
  return {
    refreshedAt: new Date().toISOString(),
    activeToday: active.size,
    onlineNow: online.size,
    newUsersToday,
  };
}
