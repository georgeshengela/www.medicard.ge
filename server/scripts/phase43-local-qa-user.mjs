import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const url = process.env.DATABASE_URL;
const db = new PrismaClient({ datasources: { db: { url } }, log: ['error'] });
const user = await db.user.findUnique({ where: { id: '34dfd803-541f-49b2-9b23-b1be8997ffb5' } });
console.log(JSON.stringify({ id: user?.id, email: user?.email, fullName: user?.fullName }, null, 2));
if (user) {
  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash('Phase43WorldQa!', 12) },
  });
  console.log('password-reset-local-only');
}
await db.$disconnect();
