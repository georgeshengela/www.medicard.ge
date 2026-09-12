import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { prisma } from '../src/lib/prisma.js';

const passwordHash = await bcrypt.hash('CycleQaPhase6a', 12);
await prisma.user.update({
  where: { email: 'cycle.qa.phase6@medicard.ge' },
  data: { passwordHash },
});
console.log('password reset');
await prisma.$disconnect();
