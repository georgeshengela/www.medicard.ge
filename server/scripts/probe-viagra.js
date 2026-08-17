import 'dotenv/config';
import { prisma } from '../src/lib/prisma.js';
import {
  buildMatchSignature,
  buildLooseMatchSignature,
} from '../src/lib/pharmacy/normalize.js';
import {
  getCrossSourceIndex,
  resolveOffersForCompare,
  buildSourcePricesFromOffers,
} from '../src/lib/pharmacy/crossMatch.js';

const needles = ['viagra', 'ვიაგრ', 'Viagra'];

for (const needle of needles) {
  const rows = await prisma.catalogProduct.findMany({
    where: {
      OR: [
        { name: { contains: needle, mode: 'insensitive' } },
        { offers: { some: { rawName: { contains: needle, mode: 'insensitive' } } } },
      ],
    },
    take: 20,
    include: {
      offers: {
        where: { inStock: true },
        select: { sourceId: true, priceGel: true, rawName: true, sourceUrl: true },
      },
    },
  });
  if (!rows.length) {
    console.log('none for', needle);
    continue;
  }

  console.log('\n===', needle, rows.length, 'products ===');
  const cross = await getCrossSourceIndex();

  for (const r of rows) {
    const merged = resolveOffersForCompare(r, cross.index, cross.geoMap);
    const prices = buildSourcePricesFromOffers(merged, r.bestSourceId);
    const has100 = /100/.test(r.name);
    const has1tab = /1\s*ტ|#1|1\s*tablet/i.test(r.name);
    if (!has100 && !has1tab && rows.length > 5) continue;

    console.log({
      id: r.id,
      name: r.name.slice(0, 100),
      loose: buildLooseMatchSignature(r.name, cross.geoMap),
      strict: buildMatchSignature(r.name, cross.geoMap),
      direct: r.offers.map((o) => `${o.sourceId}:${o.priceGel} (${o.rawName?.slice(0, 50)})`),
      merged: prices.filter((p) => p.priceGel).map((p) => `${p.sourceId}:${p.priceGel}`),
    });
  }
}

// Also search offers directly per source
for (const sourceId of ['PHARMADEPOT', 'AVERSI', 'PSP']) {
  const offers = await prisma.pharmacyOffer.findMany({
    where: {
      sourceId,
      inStock: true,
      OR: [
        { rawName: { contains: 'viagra', mode: 'insensitive' } },
        { rawName: { contains: 'ვიაგრ', mode: 'insensitive' } },
      ],
    },
    take: 10,
    select: { rawName: true, priceGel: true, sourceUrl: true, catalogProductId: true },
  });
  console.log(`\n--- ${sourceId} offers (${offers.length}) ---`);
  for (const o of offers) {
    console.log({
      price: o.priceGel,
      loose: buildLooseMatchSignature(o.rawName),
      name: o.rawName?.slice(0, 90),
      url: o.sourceUrl?.slice(0, 80),
    });
  }
}

await prisma.$disconnect();
