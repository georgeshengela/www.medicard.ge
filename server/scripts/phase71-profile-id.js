import { prisma } from '../src/lib/prisma.js';
const r = await prisma.rewardDefinition.findUnique({ where: { key: 'MEDI_PROFILE_STYLE_30D' } });
console.log(r.id);
await prisma.$disconnect();
