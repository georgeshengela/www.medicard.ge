import { PrismaClient } from '@prisma/client';
const url = process.env.DATABASE_URL;
const db = new PrismaClient({ datasources: { db: { url } }, log: ['error'] });
const userId = '34dfd803-541f-49b2-9b23-b1be8997ffb5';
const session = await db.worldMovementSession.findUnique({ where: { id: '355683fd-446d-4e30-ba5e-85a6beda393a' } });
const ledgers = await db.mediWorldLedger.findMany({
  where: { userId, OR: [{ idempotencyKey: { contains: 'movement-session' } }, { sourceType: 'MOVEMENT_SESSION' }] },
  orderBy: { createdAt: 'desc' },
  take: 10,
});
console.log(JSON.stringify({
  status: session?.status,
  completion: session?.completionRatioBps,
  rewardLedgerId: session?.rewardLedgerId,
  verification: session?.verificationStatus,
  distanceBand: session?.distanceBand,
  accepted: session?.acceptedDurationSec,
  ledgers: ledgers.map((row) => ({
    id: row.id,
    sourceType: row.sourceType,
    adapterId: row.adapterId,
    energyType: row.energyType,
    energyAmount: row.energyAmount,
    foundationXp: row.foundationXp,
    progressState: row.progressState,
    completionRatioBps: row.completionRatioBps,
    idempotencyKey: row.idempotencyKey,
    metadata: row.metadata,
  })),
}, null, 2));
await db.$disconnect();
