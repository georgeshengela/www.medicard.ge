// Explicit additive migration only. Safe to rerun; never updates accounts/passwords.
import 'dotenv/config';
import {PrismaClient} from '@prisma/client';
import {readFileSync} from 'node:fs';
import {MISSIONS} from '../src/lib/medipulsi/core/missions.js';
const prisma=new PrismaClient();
try{
 const sql=readFileSync(new URL('../prisma/medipulsi.sql',import.meta.url),'utf8');
 const statements=sql.split(/;\s*(?=\r?\n|$)/).map(s=>s.replace(/^--[^\n]*\n/gm,'').trim()).filter(s=>s&&s!=='BEGIN'&&s!=='COMMIT');
 await prisma.$transaction(async tx=>{for(const statement of statements)await tx.$executeRawUnsafe(statement);for(const mission of MISSIONS)await tx.medipulsiMission.upsert({where:{id:mission.id},create:{id:mission.id,data:mission,published:true},update:{}});},{timeout:60000});
 console.log('MEDIPULSI additive schema and mission catalog ready. Existing missions preserved.');
}finally{await prisma.$disconnect();}
