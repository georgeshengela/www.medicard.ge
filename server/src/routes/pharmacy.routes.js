import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../middleware/error.js';
import { SOURCES } from '../lib/pharmacy/constants.js';
import { CATEGORY_KEYWORDS } from '../lib/pharmacy/categoryKeywords.js';
import { getCatalogStats, getSyncMeta } from '../lib/pharmacy/sync.js';
import {
  buildSourcePricesFromOffers,
  getCrossSourceIndex,
  pricingFromOffers,
  resolveOffersForCompare,
} from '../lib/pharmacy/crossMatch.js';

export const pharmacyRouter = Router();

const SOURCE_ORDER = ['PHARMADEPOT', 'AVERSI', 'PSP'];

function publicSource(src) {
  if (!src) return null;
  return {
    id: src.id,
    nameKa: src.nameKa,
    logoUrl: src.logoUrl,
    baseUrl: src.baseUrl,
  };
}

function resolveImageUrl(row) {
  if (row.imageUrl) return row.imageUrl;
  for (const offer of row.offers || []) {
    if (offer.imageUrl) return offer.imageUrl;
  }
  return null;
}

function mapProduct(row, crossCtx, { includeOffers = false } = {}) {
  const mergedOffers = crossCtx
    ? resolveOffersForCompare(row, crossCtx.index, crossCtx.geoMap)
    : row.offers || [];
  const pricing = pricingFromOffers(mergedOffers);
  const sourcePrices = buildSourcePricesFromOffers(mergedOffers, pricing.bestSourceId);

  const offers = (row.offers || []).map((o) => ({
    id: o.id,
    source: publicSource(o.source),
    priceGel: o.priceGel,
    oldPriceGel: o.oldPriceGel,
    discountPercent: o.discountPercent,
    inStock: o.inStock,
    sourceUrl: o.sourceUrl,
    rawName: o.rawName,
    imageUrl: o.imageUrl,
    syncedAt: o.syncedAt,
  }));

  const payload = {
    id: row.id,
    slug: row.slug,
    name: row.name,
    imageUrl: resolveImageUrl(row),
    manufacturer: row.manufacturer,
    country: row.country,
    form: row.form,
    strength: row.strength,
    packSize: row.packSize,
    description: row.description,
    category: row.category
      ? { id: row.category.id, slug: row.category.slug, nameKa: row.category.nameKa }
      : null,
    bestPriceGel: pricing.bestPriceGel ?? row.bestPriceGel,
    bestSource: publicSource(
      row.bestSource && pricing.bestSourceId === row.bestSourceId
        ? row.bestSource
        : pricing.bestSourceId
          ? { id: pricing.bestSourceId, ...SOURCES[pricing.bestSourceId] }
          : row.bestSource,
    ),
    offerCount: pricing.offerCount || row.offerCount,
    savingsPercent: pricing.savingsPercent,
    sourcePrices,
    lastSyncedAt: row.lastSyncedAt,
  };

  if (includeOffers) payload.offers = offers.sort((a, b) => a.priceGel - b.priceGel);
  return payload;
}

pharmacyRouter.get(
  '/categories',
  asyncHandler(async (_req, res) => {
    const rows = await prisma.drugCategory.findMany({
      orderBy: [{ sortOrder: 'asc' }, { nameKa: 'asc' }],
      include: { children: { orderBy: { sortOrder: 'asc' } } },
      where: { parentId: null },
    });

    const counts = await prisma.catalogProduct.groupBy({
      by: ['categoryId'],
      where: { offerCount: { gt: 0 }, categoryId: { not: null } },
      _count: { _all: true },
    });
    const countById = Object.fromEntries(counts.map((c) => [c.categoryId, c._count._all]));

    const categories = rows.map((c) => ({
      id: c.id,
      slug: c.slug,
      nameKa: c.nameKa,
      iconUrl: c.iconUrl,
      productCount: countById[c.id] ?? 0,
      children: c.children.map((ch) => ({
        id: ch.id,
        slug: ch.slug,
        nameKa: ch.nameKa,
        iconUrl: ch.iconUrl,
        productCount: countById[ch.id] ?? 0,
      })),
    }));

    return res.json({ categories });
  }),
);

const listQuery = z.object({
  category: z.string().optional(),
  q: z.string().trim().optional(),
  sort: z.enum(['best_price', 'name', 'savings']).optional().default('best_price'),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(24),
});

pharmacyRouter.get(
  '/products',
  asyncHandler(async (req, res) => {
    const { category, q, sort, page, limit } = listQuery.parse(req.query);

    const where = {};
    if (category) {
      const cat = await prisma.drugCategory.findFirst({
        where: { OR: [{ slug: category }, { id: category }] },
      });
      if (cat) {
        const words = cat.nameKa
          .split(/[\s,]+/)
          .map((w) => w.trim())
          .filter((w) => w.length > 4);
        const keywords = CATEGORY_KEYWORDS[cat.slug] || [];
        where.OR = [
          { categoryId: cat.id },
          ...words.slice(0, 3).map((word) => ({ name: { contains: word, mode: 'insensitive' } })),
          ...keywords.slice(0, 10).map((kw) => ({ name: { contains: kw, mode: 'insensitive' } })),
        ];
      }
    }
    if (q) {
      where.name = { contains: q, mode: 'insensitive' };
    }
    where.offerCount = { gt: 0 };

    const orderBy =
      sort === 'name'
        ? [{ name: 'asc' }]
        : sort === 'savings'
          ? [{ bestPriceGel: 'asc' }]
          : [{ bestPriceGel: 'asc' }];

    const [total, rows] = await Promise.all([
      prisma.catalogProduct.count({ where }),
      prisma.catalogProduct.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          category: true,
          bestSource: true,
          offers: { include: { source: true } },
        },
      }),
    ]);

    const crossCtx = await getCrossSourceIndex();

    return res.json({
      products: rows.map((r) => mapProduct(r, crossCtx)),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  }),
);

pharmacyRouter.get(
  '/products/:id',
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const row = await prisma.catalogProduct.findFirst({
      where: { OR: [{ id }, { slug: id }] },
      include: {
        category: true,
        bestSource: true,
        offers: { include: { source: true }, orderBy: { priceGel: 'asc' } },
      },
    });
    if (!row) return res.status(404).json({ error: 'პროდუქტი ვერ მოიძებნა.' });

    const crossCtx = await getCrossSourceIndex();
    return res.json({ product: mapProduct(row, crossCtx, { includeOffers: true }) });
  }),
);

pharmacyRouter.get(
  '/meta/sync',
  asyncHandler(async (_req, res) => {
    const [sources, catalog] = await Promise.all([getSyncMeta(), getCatalogStats()]);
    return res.json({ sources, catalog });
  }),
);
