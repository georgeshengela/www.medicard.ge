import 'dotenv/config';
import { prisma } from '../src/lib/prisma.js';
import { getCrossSourceIndex, resolveOffersForCompare, pricingFromOffers } from '../src/lib/pharmacy/crossMatch.js';

const crossCtx = await getCrossSourceIndex();
const rows = await prisma.catalogProduct.findMany({
  where: { offerCount: { gt: 0 } },
  include: { offers: true },
});

let two = 0;
let three = 0;
for (const row of rows) {
  const merged = resolveOffersForCompare(row, crossCtx.index, crossCtx.geoMap);
  const p = pricingFromOffers(merged);
  if (p.offerCount >= 2) two += 1;
  if (p.offerCount >= 3) three += 1;
}

console.log(`full catalog ${rows.length}:`);
console.log('2+ pharmacy prices:', two);
console.log('3 pharmacy prices:', three);

await prisma.$disconnect();
