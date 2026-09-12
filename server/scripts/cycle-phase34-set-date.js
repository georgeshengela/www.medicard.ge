import 'dotenv/config';
import { prisma } from '../src/lib/prisma.js';

const date = process.argv[2] || '2026-09-22';
const user = await prisma.user.findUnique({ where: { email: 'cycle.qa.phase6@medicard.ge' } });
const r = await prisma.pregnancyCarePlanItemState.updateMany({
  where: { userId: user.id, careItemId: 'anatomy_ultrasound' },
  data: { plannedDate: date },
});
console.log({ updated: r.count, date });
await prisma.$disconnect();
