import { prisma } from '../src/lib/prisma.js';
import { buildGeoLatinMap, buildLooseMatchSignature } from '../src/lib/pharmacy/normalize.js';
import { recomputeProductPricing } from '../src/lib/pharmacy/match.js';
import { invalidateCrossSourceIndex } from '../src/lib/pharmacy/crossMatch.js';

const SOURCE_PRIORITY = ['PHARMADEPOT', 'AVERSI', 'PSP'];

function pickCanonical(products) {
  return [...products].sort((a, b) => {
    const ao = a._count?.offers ?? a.offerCount ?? 0;
    const bo = b._count?.offers ?? b.offerCount ?? 0;
    if (bo !== ao) return bo - ao;
    const ap = SOURCE_PRIORITY.indexOf(a.bestSourceId || '');
    const bp = SOURCE_PRIORITY.indexOf(b.bestSourceId || '');
    return (ap === -1 ? 99 : ap) - (bp === -1 ? 99 : bp);
  })[0];
}

async function main() {
  const rows = await prisma.catalogProduct.findMany({
    select: {
      id: true,
      name: true,
      normalizedKey: true,
      offerCount: true,
      bestSourceId: true,
      offers: { select: { rawName: true } },
      _count: { select: { offers: true } },
    },
  });

  const nameCorpus = [];
  for (const row of rows) {
    nameCorpus.push(row.name);
    for (const offer of row.offers) {
      if (offer.rawName) nameCorpus.push(offer.rawName);
    }
  }
  const geoLatinMap = buildGeoLatinMap(nameCorpus);
  console.log(`Scanning ${rows.length} products, ${geoLatinMap.size} geo→latin aliases…`);

  const groups = new Map();
  for (const row of rows) {
    const signature = buildLooseMatchSignature(row.name, geoLatinMap);
    if (!signature) continue;
    const list = groups.get(signature) || [];
    list.push(row);
    groups.set(signature, list);
  }

  let mergedGroups = 0;
  let movedOffers = 0;
  let deletedProducts = 0;
  const deletedIds = new Set();

  for (const [signature, group] of groups) {
    if (group.length < 2) continue;

    const active = group.filter((p) => !deletedIds.has(p.id));
    if (active.length < 2) continue;

    const canonical = pickCanonical(active);
    if (deletedIds.has(canonical.id)) continue;

    const duplicates = active.filter((p) => p.id !== canonical.id);
    if (!duplicates.length) continue;

    mergedGroups += 1;

    for (const dup of duplicates) {
      if (deletedIds.has(dup.id)) continue;

      const offers = await prisma.pharmacyOffer.findMany({ where: { catalogProductId: dup.id } });
      for (const offer of offers) {
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
          movedOffers += 1;
        }
      }

      const removed = await prisma.catalogProduct.deleteMany({ where: { id: dup.id } });
      if (removed.count) {
        deletedProducts += removed.count;
        deletedIds.add(dup.id);
      }
    }

    await prisma.catalogProduct.update({
      where: { id: canonical.id },
      data: { normalizedKey: signature },
    });
    await recomputeProductPricing(canonical.id);
  }

  invalidateCrossSourceIndex();

  const multi = await prisma.catalogProduct.count({ where: { offerCount: { gte: 2 } } });
  const triple = await prisma.catalogProduct.count({ where: { offerCount: { gte: 3 } } });
  const total = await prisma.catalogProduct.count({ where: { offerCount: { gt: 0 } } });

  console.log(`Merged ${mergedGroups} groups`);
  console.log(`Moved ${movedOffers} offers, removed ${deletedProducts} duplicates`);
  console.log(`2+ pharmacy prices: ${multi} / ${total}`);
  console.log(`3 pharmacy prices: ${triple} / ${total}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
