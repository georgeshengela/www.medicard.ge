#!/usr/bin/env node
/**
 * One-off catalog repair (2026-09-30). Dry run by default; `--apply` writes.
 *  1. Removes Aversi offers (source retired: Cloudflare-blocked, prices weeks old).
 *  2. Re-keys every product from its own name with the current normalizer.
 *  3. Moves offers whose name is incompatible with their product (different strength,
 *     modifier such as "Plus"/"MR", or pack count) to the right product.
 *  4. Recomputes pricing for everything touched.
 *  5. Clears FAILED sync runs from the admin history.
 */
import 'dotenv/config';
import { prisma } from '../src/lib/prisma.js';
import { buildGeoLatinMap, buildLooseMatchSignature, signaturesCompatible } from '../src/lib/pharmacy/normalize.js';
import { recomputeProductPricing, upsertOfferFromListing, invalidateMatchGeoCache } from '../src/lib/pharmacy/match.js';
import { invalidateCrossSourceIndex } from '../src/lib/pharmacy/crossMatch.js';

const apply = process.argv.includes('--apply');
const touched = new Set();

const aversi = await prisma.pharmacyOffer.findMany({ where: { sourceId: 'AVERSI' }, select: { catalogProductId: true } });
console.log(`1. Aversi offers: ${aversi.length}`);
if (apply && aversi.length) {
  await prisma.pharmacyOffer.deleteMany({ where: { sourceId: 'AVERSI' } });
  aversi.forEach((o) => touched.add(o.catalogProductId));
}

const products = await prisma.catalogProduct.findMany({
  select: {
    id: true,
    name: true,
    normalizedKey: true,
    offers: {
      select: {
        sourceId: true, sourceProductId: true, rawName: true, priceGel: true, oldPriceGel: true,
        discountPercent: true, inStock: true, imageUrl: true, sourceUrl: true, syncedAt: true,
      },
    },
  },
});
const geo = buildGeoLatinMap(products.flatMap((p) => [p.name, ...p.offers.map((o) => o.rawName)]));

const rekey = [];
const mismatched = [];
for (const p of products) {
  const own = buildLooseMatchSignature(p.name, geo);
  if (own && own !== p.normalizedKey) rekey.push({ id: p.id, key: own });
  if (!own) continue;
  for (const o of p.offers) {
    if (o.sourceId === 'AVERSI') continue;
    const sig = buildLooseMatchSignature(o.rawName, geo);
    if (sig && !signaturesCompatible(sig, own)) mismatched.push({ productId: p.id, productName: p.name, offer: o, sig, own });
  }
}
console.log(`2. Products to re-key: ${rekey.length}`);
console.log(`3. Offers attached to the wrong product: ${mismatched.length}`);
for (const m of mismatched.slice(0, 15)) console.log(`   ${m.offer.sourceId} "${m.offer.rawName}" (${m.sig}) ≠ "${m.productName}" (${m.own})`);

const failedRuns = await prisma.syncRun.count({ where: { status: 'FAILED' } });
console.log(`5. FAILED sync runs: ${failedRuns}`);

if (!apply) {
  console.log('\nDry run — nothing written. Re-run with --apply.');
  await prisma.$disconnect();
  process.exit(0);
}

for (const r of rekey) {
  await prisma.catalogProduct.update({ where: { id: r.id }, data: { normalizedKey: r.key } });
}
invalidateMatchGeoCache();

let moved = 0;
for (const m of mismatched) {
  const { offer } = m;
  const newProductId = await upsertOfferFromListing({ ...offer });
  // Keep the original confirmation time: moving an offer is not a fresh price check.
  await prisma.pharmacyOffer.update({
    where: { sourceId_sourceProductId: { sourceId: offer.sourceId, sourceProductId: offer.sourceProductId } },
    data: { syncedAt: offer.syncedAt },
  });
  touched.add(m.productId);
  touched.add(newProductId);
  if (newProductId !== m.productId) moved += 1;
}
console.log(`   moved ${moved} of ${mismatched.length}`);

console.log(`4. Recomputing ${touched.size} products…`);
for (const id of touched) await recomputeProductPricing(id);
invalidateCrossSourceIndex();

const deleted = await prisma.syncRun.deleteMany({ where: { status: 'FAILED' } });
console.log(`5. Deleted ${deleted.count} FAILED sync runs`);

await prisma.$disconnect();
