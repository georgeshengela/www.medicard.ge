import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';

export function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  });
}

/** Rejects the request unless it carries a valid `Authorization: Bearer <jwt>` header. */
export async function requireAuth(req, res, next) {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;

  if (!token) {
    return res.status(401).json({ error: 'ავტორიზაცია საჭიროა. გთხოვთ, შეხვიდეთ სისტემაში.' });
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        gender: true,
        birthDate: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(401).json({ error: 'მომხმარებელი ვერ მოიძებნა. გთხოვთ, ხელახლა შეხვიდეთ.' });
    }

    req.user = user;
    return next();
  } catch (error) {
    const expired = error?.name === 'TokenExpiredError';
    return res.status(401).json({
      error: expired
        ? 'სესიის ვადა ამოიწურა. გთხოვთ, ხელახლა შეხვიდეთ სისტემაში.'
        : 'ავტორიზაციის ტოკენი არასწორია.',
      code: expired ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID',
    });
  }
}
