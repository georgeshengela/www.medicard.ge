import 'dotenv/config';
import { prisma } from '../src/lib/prisma.js';
import { buildMatchSignature } from '../src/lib/pharmacy/normalize.js';

const needles = ['ozempic', 'ოზემპ', 'betamox', 'ბეტამ', 'paracetamol', 'პარაცეტ', 'nurofen', 'ნუროფ'];

for (const needle of needles) {
  const rows = await prisma.catalogProduct.findMany({
    where: { name: { contains: needle, mode: 'insensitive' } },
    take: 5,
    include: { offers: { select: { sourceId: true, priceGel: true } } },
  });
  if (!rows.length) continue;
  console.log('\n===', needle, '===');
  for (const r of rows) {
    console.log({
      name: r.name.slice(0, 80),
      sig: buildMatchSignature(r.name),
      offers: r.offers.map((o) => `${o.sourceId}:${o.priceGel}`),
    });
  }
}

await prisma.$disconnect();
