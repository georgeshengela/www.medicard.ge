#!/usr/bin/env node
import 'dotenv/config';
import { prisma } from '../src/lib/prisma.js';
import { inferCategorySlug } from '../src/lib/pharmacy/categoryKeywords.js';
import { getCategoryIdBySlug } from '../src/lib/pharmacy/categories.js';

async function main() {
  const slugCache = new Map();
  const products = await prisma.catalogProduct.findMany({
    select: { id: true, name: true, form: true, strength: true, categoryId: true },
  });

  let updated = 0;
  for (const p of products) {
    const slug = inferCategorySlug(p.name, `${p.form || ''} ${p.strength || ''}`);
    if (!slug) continue;

    let categoryId = slugCache.get(slug);
    if (categoryId === undefined) {
      categoryId = (await getCategoryIdBySlug(slug)) ?? null;
      slugCache.set(slug, categoryId);
    }
    if (!categoryId || p.categoryId === categoryId) continue;

    await prisma.catalogProduct.update({
      where: { id: p.id },
      data: { categoryId },
    });
    updated += 1;
  }

  console.log(`Assigned categories for ${updated} / ${products.length} products`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
