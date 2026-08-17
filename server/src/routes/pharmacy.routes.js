import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../middleware/error.js';
import { getCatalogStats, getSyncMeta } from '../lib/pharmacy/sync.js';

export const pharmacyRouter = Router();

function publicSource(src) {
  if (!src) return null;
  return {
    id: src.id,
    nameKa: src.nameKa,
    logoUrl: src.logoUrl,
    baseUrl: src.baseUrl,
  };
}

function savingsPercent(product) {
  const offers = product.offers || [];
  if (offers.length < 2) return null;
  const prices = offers.map((o) => o.priceGel).filter((p) => p > 0);
  if (!prices.length) return null;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  if (max <= min) return null;
  return Math.round(((max - min) / max) * 100);
}

function mapProduct(row, { includeOffers = false } = {}) {
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
    imageUrl: row.imageUrl,
    manufacturer: row.manufacturer,
    country: row.country,
    form: row.form,
    strength: row.strength,
    packSize: row.packSize,
    description: row.description,
    category: row.category
      ? { id: row.category.id, slug: row.category.slug, nameKa: row.category.nameKa }
      : null,
    bestPriceGel: row.bestPriceGel,
    bestSource: publicSource(row.bestSource),
    offerCount: row.offerCount,
    savingsPercent: savingsPercent(row),
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

    const categories = rows.map((c) => ({
      id: c.id,
      slug: c.slug,
      nameKa: c.nameKa,
      iconUrl: c.iconUrl,
      children: c.children.map((ch) => ({
        id: ch.id,
        slug: ch.slug,
        nameKa: ch.nameKa,
        iconUrl: ch.iconUrl,
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
      if (cat) where.categoryId = cat.id;
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

    return res.json({
      products: rows.map((r) => mapProduct(r)),
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

    return res.json({ product: mapProduct(row, { includeOffers: true }) });
  }),
);

pharmacyRouter.get(
  '/meta/sync',
  asyncHandler(async (_req, res) => {
    const [sources, catalog] = await Promise.all([getSyncMeta(), getCatalogStats()]);
    return res.json({ sources, catalog });
  }),
);
