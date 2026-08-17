import 'dotenv/config';
import { prisma } from '../src/lib/prisma.js';
import { CATEGORY_KEYWORDS } from '../src/lib/pharmacy/categoryKeywords.js';

const slug = process.argv[2] || 'painkillers';
const cat = await prisma.drugCategory.findFirst({ where: { slug } });
const keywords = CATEGORY_KEYWORDS[slug] || [];
const filtered = await prisma.catalogProduct.count({
  where: {
    offerCount: { gt: 0 },
    OR: [
      { categoryId: cat.id },
      ...keywords.slice(0, 10).map((kw) => ({ name: { contains: kw, mode: 'insensitive' } })),
    ],
  },
});
const assigned = await prisma.catalogProduct.count({ where: { categoryId: cat.id } });
const unc = await prisma.catalogProduct.count({ where: { categoryId: null, offerCount: { gt: 0 } } });
console.log({ slug, assigned, filtered, uncategorized: unc });
await prisma.$disconnect();
