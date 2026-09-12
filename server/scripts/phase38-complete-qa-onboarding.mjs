import { PrismaClient } from '@prisma/client';

const url = process.env.PHASE38_TEST_DATABASE_URL;
if (!url) process.exit(2);
const prisma = new PrismaClient({ datasources: { db: { url } }, log: ['error'] });
try {
  const user = await prisma.user.findUnique({ where: { email: 'world.qa@medicard.test' } });
  if (!user) throw new Error('qa user missing');
  await prisma.healthProfile.upsert({
    where: { userId: user.id },
    update: { completedAt: new Date(), extraAnswers: { assessmentPhaseComplete: true } },
    create: {
      userId: user.id,
      completedAt: new Date(),
      extraAnswers: { assessmentPhaseComplete: true },
      chronicConditions: [],
      allergies: [],
      medications: [],
      familyHistory: [],
      healthGoals: [],
    },
  });
  console.log(JSON.stringify({ ok: true }));
} finally {
  await prisma.$disconnect();
}
