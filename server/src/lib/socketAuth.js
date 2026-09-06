import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { prisma } from './prisma.js';

export const ADMIN_SOCKET_ROOM = 'ops';

export function userSocketRoom(userId) {
  return `user:${userId}`;
}

export function verifySocketToken(token) {
  const raw = String(token || '').trim();
  if (!raw) {
    const error = new Error('unauthorized');
    error.code = 'SOCKET_UNAUTHORIZED';
    throw error;
  }
  try {
    return jwt.verify(raw, env.JWT_SECRET);
  } catch (error) {
    const next = new Error(error?.name === 'TokenExpiredError' ? 'unauthorized' : 'unauthorized');
    next.code = error?.name === 'TokenExpiredError' ? 'SOCKET_EXPIRED' : 'SOCKET_UNAUTHORIZED';
    throw next;
  }
}

export async function resolveSocketIdentity(payload, { loadUser } = {}) {
  if (!payload?.sub) {
    const error = new Error('unauthorized');
    error.code = 'SOCKET_UNAUTHORIZED';
    throw error;
  }
  if (payload.role === 'admin') {
    return { kind: 'admin', adminId: payload.sub, userId: null };
  }

  const lookup = typeof loadUser === 'function'
    ? loadUser
    : async (id) => prisma.user.findUnique({ where: { id }, select: { id: true, status: true } });

  const user = await lookup(payload.sub);
  if (!user) {
    const error = new Error('unauthorized');
    error.code = 'SOCKET_UNAUTHORIZED';
    throw error;
  }
  if (user.status === 'BLOCKED') {
    const error = new Error('forbidden');
    error.code = 'SOCKET_BLOCKED';
    throw error;
  }
  return { kind: 'user', userId: user.id, adminId: null };
}

export async function authorizeSocketHandshake(token, options = {}) {
  const payload = verifySocketToken(token);
  return resolveSocketIdentity(payload, options);
}
