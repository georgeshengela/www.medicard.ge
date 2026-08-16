import { PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';

// Neon runs behind PgBouncer in transaction mode, so a single long-lived
// client per process is what we want — the pooler multiplexes underneath.
const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma.__medicardPrisma ??
  new PrismaClient({
    log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (env.NODE_ENV !== 'production') {
  globalForPrisma.__medicardPrisma = prisma;
}
