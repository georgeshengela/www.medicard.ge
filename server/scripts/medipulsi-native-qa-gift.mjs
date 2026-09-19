// Disposable local fixture. Refuses hosted databases and never uses DATABASE_URL from .env.
import {randomUUID} from 'node:crypto';
const url=process.env.MEDIPULSI_TEST_DATABASE_URL;
if(!url||new URL(url).hostname!=='127.0.0.1'||!new URL(url).pathname.endsWith('_test'))throw new Error('A local disposable *_test database is required.');
process.env.DATABASE_URL=url;
const {prisma}=await import('../src/lib/prisma.js');
const existing=await prisma.medipulsiGift.findFirst({where:{title:'ადგილობრივი QA · ვირტუალური საჩუქარი'}});
const data={title:'ადგილობრივი QA · ვირტუალური საჩუქარი',description:'მხოლოდ საცდელი ჩანაწერია. რეალური პრიზი არ გაიცემა.',longitude:5.5819,latitude:50.63414,pulseRadius:120,revealRadius:50,rewardKind:'DIGITAL',stock:10,published:true,archived:false,startsAt:new Date(Date.now()-60000),endsAt:new Date(Date.now()+3600000)};
if(existing)await prisma.medipulsiGift.update({where:{id:existing.id},data});else await prisma.medipulsiGift.create({data:{id:randomUUID(),...data}});
await prisma.$disconnect();console.log('Local-only QA gift ready.');
