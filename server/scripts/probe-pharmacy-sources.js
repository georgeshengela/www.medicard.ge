import 'dotenv/config';
import { prisma } from '../src/lib/prisma.js';

const counts = await prisma.pharmacyOffer.groupBy({ by: ['sourceId'], _count: { _all: true } });
const compared = await prisma.catalogProduct.count({ where: { offerCount: { gte: 2 } } });
const total = await prisma.catalogProduct.count({ where: { offerCount: { gt: 0 } } });
const runs = await prisma.syncRun.findMany({
  orderBy: { startedAt: 'desc' },
  take: 8,
  select: { source: true, status: true, itemsFetched: true, error: true, startedAt: true },
});

const pspOnly = await prisma.catalogProduct.count({
  where: { offerCount: 1, offers: { some: { sourceId: 'PSP' } } },
});
const pdOnly = await prisma.catalogProduct.count({
  where: { offerCount: 1, offers: { some: { sourceId: 'PHARMADEPOT' } } },
});
const sample = await prisma.pharmacyOffer.findMany({
  where: { sourceId: 'PSP' },
  take: 3,
  include: { catalogProduct: { select: { name: true, offerCount: true } } },
});

console.log('offers by source:', counts);
console.log(`products with 2+ sources: ${compared} / ${total}`);
console.log({ pspOnlyProducts: pspOnly, pdOnlyProducts: pdOnly });
console.log(
  'psp sample:',
  sample.map((o) => ({ pspName: o.rawName, catalogName: o.catalogProduct.name, offerCount: o.catalogProduct.offerCount })),
);
console.log('recent sync runs:', runs);
await prisma.$disconnect();
