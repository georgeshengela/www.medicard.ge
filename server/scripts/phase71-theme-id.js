import { prisma } from '../src/lib/prisma.js';
const r = await prisma.rewardDefinition.findUnique({ where: { key: 'MEDI_THEME_7D' } });
console.log(r.id);
await prisma.$disconnect();
