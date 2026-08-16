import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';

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

    return prisma.admin
      .findUnique({
        where: { id: payload.sub },
        select: { id: true, email: true, fullName: true },
      })
      .then((admin) => {
        if (!admin) {
          return res.status(401).json({ error: 'ადმინისტრატორი ვერ მოიძებნა.' });
        }
        req.admin = admin;
        return next();
      })
      .catch(next);
  } catch {
    return res.status(401).json({ error: 'ადმინისტრატორის ტოკენი არასწორია ან ვადაგასულია.' });
  }
}
