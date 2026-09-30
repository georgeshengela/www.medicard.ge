import 'dotenv/config';
import { recomputeAllPricing } from '../src/lib/pharmacy/match.js';
import { prisma } from '../src/lib/prisma.js';

console.log('Recomputing pricing…');
await recomputeAllPricing();

const counts = await prisma.pharmacyOffer.groupBy({ by: ['sourceId'], _count: { _all: true } });
const multi = await prisma.catalogProduct.count({ where: { offerCount: { gte: 2 } } });
const total = await prisma.catalogProduct.count({ where: { offerCount: { gt: 0 } } });
console.log('offers by source:', counts);
console.log(`multi-source products: ${multi} / ${total}`);

await prisma.$disconnect();
