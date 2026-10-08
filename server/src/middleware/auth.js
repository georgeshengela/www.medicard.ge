import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { publicConsumerPackage } from '../lib/packages.js';
import { FREE_CONSUMER_RELEASE } from '../lib/consumerAccess.js';
import { getAppSettings, maintenanceMessageFor } from '../lib/settings.js';
import { toDateOnly, calculateAge } from '../lib/patient.js';
import { serverAiEngine } from '../lib/aiEngine.js';
import { withAiAccount } from '../lib/aiConsent.js';
import { rememberUserLanguage, t } from '../lib/i18n.js';

export function signToken(user) {
  const id = typeof user?.id === 'string' ? user.id.trim() : '';
  if (!id) {
    throw new Error('signToken: user id missing');
  }
  return jwt.sign({ sub: id, email: user.email }, env.JWT_SECRET, {
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
    package: publicConsumerPackage(user.package),
    packageExpiresAt: FREE_CONSUMER_RELEASE ? null : user.packageExpiresAt ?? null,
    createdAt: user.createdAt,
    points: user.points ?? 0,
    currentStreak: user.currentStreak ?? 0,
    longestStreak: user.longestStreak ?? 0,
    lastCheckInDate: toDateOnly(user.lastCheckInDate),
    aiEngine: serverAiEngine(),
  };
}

/** Rejects the request unless it carries a valid `Authorization: Bearer <jwt>` header. */
export async function requireAuth(req, res, next) {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;

  if (!token) {
    return res.status(401).json({ error: t(req, 'ავტორიზაცია საჭიროა. შედი ანგარიშში.', 'Please sign in to continue.') });
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    if (payload.role === 'admin') {
      return res.status(403).json({ error: t(req, 'ადმინისტრატორის ტოკენი ამ ენდპოინტზე არ მოქმედებს.', 'An admin token does not work on this endpoint.') });
    }

    const userId = typeof payload.sub === 'string' ? payload.sub : String(payload.sub ?? '');
    if (!userId || userId === 'undefined' || userId === 'null') {
      return res.status(401).json({ error: t(req, 'მომხმარებელი ვერ მოიძებნა. ხელახლა შედი ანგარიშში.', 'Account not found. Please sign in again.') });
    }

    let user = await prisma.user.findUnique({
      where: { id: userId },
      include: { package: true },
    });
    // Neon + PgBouncer can miss a just-committed row on the first pooled read.
    if (!user) {
      await new Promise((resolve) => setTimeout(resolve, 80));
      user = await prisma.user.findUnique({
        where: { id: userId },
        include: { package: true },
      });
    }

    if (!user) {
      return res.status(401).json({ error: t(req, 'მომხმარებელი ვერ მოიძებნა. ხელახლა შედი ანგარიშში.', 'Account not found. Please sign in again.') });
    }

    if (req.langExplicit) rememberUserLanguage(user.id, req.lang);

    if (user.status === 'BLOCKED') {
      return res.status(403).json({
        error: t(req, 'შენი ანგარიში დაბლოკილია. დაგვიკავშირდი მხარდაჭერას.', 'Your account is blocked. Please contact support.'),
        code: 'ACCOUNT_BLOCKED',
      });
    }

    req.user = user;
    // iat / exp of the presented token: GET /api/auth/me renews it past half its lifetime.
    // `aud` marks a narrow token (e.g. a Medi action seal), which is never renewed.
    req.authClaims = { iat: payload.iat, exp: payload.exp, aud: payload.aud };
    // Bind the reading language (ka | en) for AI code deep in the stack.
    return withAiAccount(user.id, () => next(), req.lang);
  } catch (error) {
    if (!['TokenExpiredError', 'JsonWebTokenError', 'NotBeforeError'].includes(error?.name)) return next(error);
    const expired = error?.name === 'TokenExpiredError';
    return res.status(401).json({
      error: expired
        ? t(req, 'სესიის ვადა ამოიწურა. ხელახლა შედი ანგარიშში.', 'Your session has expired. Please sign in again.')
        : t(req, 'ავტორიზაციის ტოკენი არასწორია.', 'The sign-in token is not valid.'),
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
      const maintenanceMessage = maintenanceMessageFor(settings, req.lang);
      return res.status(503).json({
        error: maintenanceMessage,
        code: 'MAINTENANCE',
        settings: {
          maintenanceMode: true,
          maintenanceMessage,
        },
      });
    }
    return next();
  } catch (error) {
    console.error('[availability] settings check failed, allowing traffic', error?.message);
    return next();
  }
}
