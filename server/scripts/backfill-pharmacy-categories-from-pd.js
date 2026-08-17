#!/usr/bin/env node
import 'dotenv/config';
import { prisma } from '../src/lib/prisma.js';
import { getCategoryIdBySlug } from '../src/lib/pharmacy/categories.js';
import { mapPharmadepotSubcategoryName } from '../src/lib/pharmacy/sources/pharmadepotCategories.js';
import { FETCH_HEADERS } from '../src/lib/pharmacy/constants.js';

const LIMIT = Number(process.env.PHARMACY_CATEGORY_BACKFILL_LIMIT || 0);
const DELAY_MS = Number(process.env.PHARMACY_CATEGORY_BACKFILL_DELAY_MS || 250);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseSubcategoryName(html) {
  const chunk = html.replace(/\\"/g, '"');
  const match =
    chunk.match(/medicament_sub_category_name":"([^"]+)"/) ||
    chunk.match(/subCategory=\d+">([^<]+)</);
  return match?.[1]?.trim() ?? null;
}

async function main() {
  const slugCache = new Map();
  const offers = await prisma.pharmacyOffer.findMany({
    where: {
      sourceId: 'PHARMADEPOT',
      catalogProduct: { categoryId: null },
    },
    select: {
      id: true,
      sourceUrl: true,
      catalogProductId: true,
    },
    orderBy: { syncedAt: 'desc' },
    take: LIMIT > 0 ? LIMIT : undefined,
  });

  console.log(`Backfilling categories from ${offers.length} Pharmadepot product pages…`);

  let updated = 0;
  let failed = 0;

  for (let i = 0; i < offers.length; i += 1) {
    const offer = offers[i];
    try {
      const res = await fetch(offer.sourceUrl, { headers: FETCH_HEADERS, redirect: 'follow' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      const subName = parseSubcategoryName(html);
      if (!subName) {
        failed += 1;
        continue;
      }

      const slug = mapPharmadepotSubcategoryName(subName);
      if (!slug) {
        failed += 1;
        continue;
      }

      let categoryId = slugCache.get(slug);
      if (categoryId === undefined) {
        categoryId = (await getCategoryIdBySlug(slug)) ?? null;
        slugCache.set(slug, categoryId);
      }
      if (!categoryId) {
        failed += 1;
        continue;
      }

      await prisma.catalogProduct.update({
        where: { id: offer.catalogProductId },
        data: { categoryId },
      });
      updated += 1;

      if ((i + 1) % 50 === 0) {
        console.log(`… ${i + 1}/${offers.length} processed, ${updated} categorized`);
      }
    } catch (err) {
      failed += 1;
      if (failed <= 5) console.warn(`Offer ${offer.id}: ${err.message}`);
    }

    if (i + 1 < offers.length) await sleep(DELAY_MS);
  }

  console.log(`Done. Updated ${updated}, failed/skipped ${failed}, total ${offers.length}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
