import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { PrismaClient } from '@prisma/client';
const db=new PrismaClient();
try {
 const sql=await readFile(new URL('../prisma/community.sql',import.meta.url),'utf8');
 const statements=sql.replace(/--[^\n]*/g,'').split(';').map(s=>s.trim()).filter(Boolean);
 if(statements.some(s=>!/^CREATE (TABLE|INDEX|UNIQUE INDEX) IF NOT EXISTS "Community|^ALTER TABLE "Community(?:Notification|Post|Comment)" ADD COLUMN IF NOT EXISTS/.test(s)))throw Error('Unexpected non-additive statement');
 await db.$transaction(async tx=>{for(const statement of statements)await tx.$executeRawUnsafe(statement);},{timeout:30000});
 console.log('Community schema installed. Existing accounts and health records were not modified.');
}finally{await db.$disconnect();}
