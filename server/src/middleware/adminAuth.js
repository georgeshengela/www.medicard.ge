import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';

const ADMIN_AUTH_CACHE_MS = 15_000;
const adminAuthCache = new Map();

function readCachedAdmin(id) {
  const hit = adminAuthCache.get(id);
  if (!hit) return null;
  if (Date.now() - hit.at > ADMIN_AUTH_CACHE_MS) {
    adminAuthCache.delete(id);
    return null;
  }
  return hit.admin;
}

function writeCachedAdmin(id, admin) {
  adminAuthCache.set(id, { at: Date.now(), admin });
  if (adminAuthCache.size > 40) {
    const first = adminAuthCache.keys().next().value;
    adminAuthCache.delete(first);
  }
}

export function requireAdmin(req, res, next) {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;

  if (!token) {
    return res.status(401).json({ error: 'ადმინისტრატორის ავტორიზაცია საჭიროა.' });
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    if (payload.role !== 'admin') {
      return res.status(403).json({ error: 'წვდომა აკრძალულია.' });
    }

    const cached = readCachedAdmin(payload.sub);
    if (cached) {
      req.admin = cached;
      return next();
    }

    return prisma.admin
      .findUnique({
        where: { id: payload.sub },
        select: { id: true, email: true, fullName: true, capabilities: true },
      })
      .then((admin) => {
        if (!admin) {
          return res.status(401).json({ error: 'ადმინისტრატორი ვერ მოიძებნა.' });
        }
        writeCachedAdmin(payload.sub, admin);
        req.admin = admin;
        return next();
      })
      .catch((err) => {
        // Prisma client/schema lag: capabilities column may be missing from the generated client.
        const msg = String(err?.message || '');
        if (msg.includes('capabilities') || err?.name === 'PrismaClientValidationError') {
          return prisma.admin
            .findUnique({
              where: { id: payload.sub },
              select: { id: true, email: true, fullName: true },
            })
            .then((admin) => {
              if (!admin) {
                return res.status(401).json({ error: 'ადმინისტრატორი ვერ მოიძებნა.' });
              }
              const next = { ...admin, capabilities: null };
              writeCachedAdmin(payload.sub, next);
              req.admin = next;
              return next();
            })
            .catch(next);
        }
        return next(err);
      });
  } catch {
    return res.status(401).json({ error: 'ადმინისტრატორის ტოკენი არასწორია ან ვადაგასულია.' });
  }
}
