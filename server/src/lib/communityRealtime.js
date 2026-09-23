import { prisma } from './prisma.js';
import { verifySocketToken, ADMIN_SOCKET_ROOM } from './socketAuth.js';

let namespace;
let realtime;
let timer;
let flushing = false;
let pending = false;

export function attachCommunityRealtime(io) {
  realtime = io;
  namespace = io.of('/community');
  namespace.use(async (socket, next) => {
    try {
      const payload = verifySocketToken(socket.handshake.auth?.token);
      if (payload.role === 'admin' || typeof payload.sub !== 'string') throw new Error();
      const [member] = await prisma.$queryRaw`SELECT m."userId" FROM "CommunityMember" m JOIN "User" u ON u.id=m."userId" WHERE m."userId"=${payload.sub} AND NOT m.banned AND u.gender='FEMALE' AND u.status='ACTIVE'`;
      if (!member) throw new Error();
      socket.data.userId = member.userId;
      socket.data.expiresAt = payload.exp * 1000;
      next();
    } catch { next(new Error('unauthorized')); }
  });
  namespace.on('connection', socket => {
    // Expiry also closes idle connections; no client-controlled room joins.
    const expiry = setTimeout(() => socket.disconnect(true), Math.max(0, Math.min(socket.data.expiresAt - Date.now(), 2147483647)));
    expiry.unref();
    socket.on('disconnect', () => clearTimeout(expiry));
  });
}

async function flush() {
  timer = null;
  if (!namespace || flushing) { pending = true; return; }
  flushing = true;
  try {
    realtime.of('/').to(ADMIN_SOCKET_ROOM).emit('community:changed', {});
    const sockets = [...namespace.sockets.values()];
    if (!sockets.length) return;
    const ids = [...new Set(sockets.map(s => s.data.userId))];
    const members = await prisma.$queryRaw`SELECT m."userId" FROM "CommunityMember" m JOIN "User" u ON u.id=m."userId" WHERE m."userId"=ANY(${ids}::text[]) AND NOT m.banned AND u.gender='FEMALE' AND u.status='ACTIVE'`;
    const allowed = new Set(members.map(m => m.userId));
    for (const socket of sockets) {
      if (!allowed.has(socket.data.userId) || socket.data.expiresAt <= Date.now()) socket.disconnect(true);
      // Never broadcast author IDs, content, post IDs or private health information.
      // Clients re-fetch through the authenticated, block-aware HTTP endpoints.
      else socket.emit('community:changed', {});
    }
  } catch { /* HTTP reconciliation on reconnect/foreground is the fallback. */ }
  finally {
    flushing = false;
    if (pending) { pending = false; communityChanged(); }
  }
}

export function communityChanged() {
  if (!namespace || timer) return;
  timer = setTimeout(() => void flush(), 180);
  timer.unref();
}
