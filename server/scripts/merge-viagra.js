import 'dotenv/config';
import { prisma } from '../src/lib/prisma.js';
import { buildLooseMatchSignature, buildGeoLatinMap } from '../src/lib/pharmacy/normalize.js';
import { recomputeProductPricing } from '../src/lib/pharmacy/match.js';
import { invalidateCrossSourceIndex } from '../src/lib/pharmacy/crossMatch.js';

const rows = await prisma.catalogProduct.findMany({
  where: { name: { contains: 'ვიაგრ' } },
  include: { offers: { select: { id: true, sourceId: true, priceGel: true, rawName: true } } },
});

const geo = buildGeoLatinMap(rows.flatMap((r) => [r.name, ...r.offers.map((o) => o.rawName)]));
const groups = new Map();
for (const row of rows) {
  const key = buildLooseMatchSignature(row.name, geo);
  const list = groups.get(key) || [];
  list.push(row);
  groups.set(key, list);
}

for (const [key, group] of groups) {
  console.log('\nKey', key, 'products', group.length);
  group.forEach((g) =>
    console.log(
      ' ',
      g.id.slice(0, 8),
      g.name,
      g.offers.map((o) => `${o.sourceId}:${o.priceGel}`).join(', '),
    ),
  );

  if (group.length < 2) continue;

  const canonical = group.sort((a, b) => b.offers.length - a.offers.length)[0];
  for (const dup of group.filter((p) => p.id !== canonical.id)) {
    for (const offer of dup.offers) {
      const conflict = await prisma.pharmacyOffer.findFirst({
        where: { catalogProductId: canonical.id, sourceId: offer.sourceId },
      });
      if (conflict) {
        await prisma.pharmacyOffer.delete({ where: { id: offer.id } });
      } else {
        await prisma.pharmacyOffer.update({
          where: { id: offer.id },
          data: { catalogProductId: canonical.id },
        });
      }
    }
    await prisma.catalogProduct.delete({ where: { id: dup.id } });
    console.log('  merged into', canonical.id.slice(0, 8));
  }

  await prisma.catalogProduct.update({
    where: { id: canonical.id },
    data: { normalizedKey: key },
  });
  await recomputeProductPricing(canonical.id);
}

invalidateCrossSourceIndex();
console.log('\nDone');
await prisma.$disconnect();
