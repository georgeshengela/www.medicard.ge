import { PrismaClient } from '@prisma/client';
const url = process.env.DATABASE_URL;
const db = new PrismaClient({ datasources: { db: { url } }, log: ['error'] });
const rows = await db.worldMovementSession.findMany({
  where: { userId: '34dfd803-541f-49b2-9b23-b1be8997ffb5' },
  orderBy: { createdAt: 'desc' },
  take: 5,
});
console.log(JSON.stringify(rows.map((row) => ({
  id: row.id,
  status: row.status,
  mode: row.movementMode,
  target: row.targetDurationSec,
  accepted: row.acceptedDurationSec,
  segments: row.acceptedSegmentCount,
  lastReason: row.lastSegmentReason,
  createdAt: row.createdAt,
})), null, 2));
await db.$disconnect();
