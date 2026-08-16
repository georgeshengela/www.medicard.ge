import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { publicPackage } from '../lib/packages.js';
import { getAppSettings } from '../lib/settings.js';
import { toDateOnly, calculateAge } from '../lib/patient.js';

export function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  });
}

export function enrichPublicUser(user) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    phone: user.phone ?? null,
    gender: user.gender ?? null,
    birthDate: toDateOnly(user.birthDate),
    age: calculateAge(user.birthDate),
    status: user.status ?? 'ACTIVE',
    package: publicPackage(user.package),
    packageExpiresAt: user.packageExpiresAt ?? null,
    createdAt: user.createdAt,
  };
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
    if (payload.role === 'admin') {
      return res.status(403).json({ error: 'ადმინისტრატორის ტოკენი ამ ენდპოინტზე არ მოქმედებს.' });
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: { package: true },
    });

    if (!user) {
      return res.status(401).json({ error: 'მომხმარებელი ვერ მოიძებნა. გთხოვთ, ხელახლა შეხვიდეთ.' });
    }

    if (user.status === 'BLOCKED') {
      return res.status(403).json({
        error: 'თქვენი ანგარიში დაბლოკილია. დაგვიკავშირდით მხარდაჭერას.',
        code: 'ACCOUNT_BLOCKED',
      });
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

/** Blocks normal API traffic while maintenance mode is on (admin routes exempt). */
export async function enforceAppAvailability(req, res, next) {
  try {
    if (req.path.startsWith('/api/admin') || req.path === '/health' || req.path.startsWith('/api/app')) {
      return next();
    }
    if (!req.path.startsWith('/api/')) return next();

    const settings = await getAppSettings();
    if (settings.maintenanceMode) {
      return res.status(503).json({
        error: settings.maintenanceMessage,
        code: 'MAINTENANCE',
        settings: {
          maintenanceMode: true,
          maintenanceMessage: settings.maintenanceMessage,
        },
      });
    }
    return next();
  } catch (error) {
    return next(error);
  }
}
