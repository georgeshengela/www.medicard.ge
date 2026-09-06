import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { prisma } from './prisma.js';
import { tbilisiYmd } from './checkIn.js';
import { loadAppActivityRows } from './appActivity.js';
import { clearAdminAnalyticsCache } from './adminAnalytics.js';

const ROOM = 'ops';
const LIVE_MS = 90_000;
const DEBOUNCE_MS = 300;

let io = null;
let flushTimer = null;
const seen = new Map();

export function attachAdminRealtime(httpServer) {
  io = new Server(httpServer, {
    path: '/socket.io',
    cors: { origin: true, credentials: true },
    transports: ['websocket', 'polling'],
  });

  io.use((socket, next) => {
    const token = String(socket.handshake.auth?.token || '').trim();
    if (!token) return next(new Error('unauthorized'));
    try {
      const payload = jwt.verify(token, env.JWT_SECRET);
      if (payload.role !== 'admin' || !payload.sub) return next(new Error('forbidden'));
      socket.data.adminId = payload.sub;
      return next();
    } catch {
      return next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(ROOM);
    getOpsLiveSnapshot()
      .then((snap) => socket.emit('ops:live', snap))
      .catch(() => undefined);
  });

  return io;
}

export function notifyOpsActivity(row) {
  if (row?.userId) seen.set(row.userId, Date.now());
  if (!io) return;
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    clearAdminAnalyticsCache();
    getOpsLiveSnapshot()
      .then((snap) => io.to(ROOM).emit('ops:live', snap))
      .catch(() => undefined);
  }, DEBOUNCE_MS);
}

export async function getOpsLiveSnapshot() {
  const now = Date.now();
  const today = tbilisiYmd(new Date());
  const rows = await loadAppActivityRows(today, today);
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
