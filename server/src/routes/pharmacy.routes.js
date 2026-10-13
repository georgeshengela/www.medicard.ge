import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../middleware/error.js';
import { CATEGORY_SLUGS, categoryName } from '../lib/pharmacy/categories.js';
import { FORM_LABELS, UNIT_LABELS, countryNameKa, phon } from '../lib/pharmacy/facts.js';
import { buildSourcePricesFromOffers } from '../lib/pharmacy/pricing.js';
import { getCatalogStats, getSyncMeta } from '../lib/pharmacy/sync.js';
import { langOf, t } from '../lib/i18n.js';

export const pharmacyRouter = Router();

/** Products a person can buy: not folded into another product, sold by at least one pharmacy now. */
const LIVE = { mergedIntoId: null, offerCount: { gt: 0 } };

const SOURCE_NAMES_EN = { PSP: 'PSP', PHARMADEPOT: 'Pharmadepot', GPC: 'GPC' };
const sourceName = (id, nameKa, lang) => (lang === 'en' ? SOURCE_NAMES_EN[id] ?? nameKa : nameKa);

let regionNames = null;
function countryLabel(iso, lang) {
  if (!iso) return null;
  if (lang !== 'en') return countryNameKa(iso) ?? iso;
  try {
    regionNames ??= new Intl.DisplayNames(['en'], { type: 'region' });
    return regionNames.of(iso) ?? iso;
  } catch {
    return iso;
  }
}

/** „7.5მგ/5მლ“ → „7.5 mg/5 ml“ for English readers. */
function doseLabel(text, lang) {
  if (!text || lang !== 'en') return text;
  return text
    .replace(/მკგ/g, ' mcg')
    .replace(/მგ/g, ' mg')
    .replace(/მლ/g, ' ml')
    .replace(/გრ|(?<=\d)გ/g, ' g')
    .replace(/სე/g, ' IU')
    .replace(/დოზა/g, ' dose')
    .replace(/\s+/g, ' ')
    .trim();
}

function publicSource(src, lang) {
  if (!src) return null;
  return { id: src.id, nameKa: sourceName(src.id, src.nameKa, lang), logoUrl: src.logoUrl, baseUrl: src.baseUrl };
}

/** Price of one tablet / capsule / sachet / ampoule, when the box holds several of them. */
function unitPrice(row) {
  const label = UNIT_LABELS[row.formGroup];
  if (!label || !row.unitCount || row.unitCount < 2 || row.bestPriceGel == null) return null;
  return Math.round((row.bestPriceGel / row.unitCount) * 100) / 100;
}

/** „30 ტაბლეტი“ / „30 tablets“ — the box's count with its unit. */
function packLabel(unitCount, formGroup, lang) {
  const unit = UNIT_LABELS[formGroup];
  if (!unit || !unitCount) return null;
  return `${unitCount} ${lang === 'en' ? unit[unitCount === 1 ? 1 : 2] : unit[0]}`;
}

function mapProduct(row, lang, { includeOffers = false } = {}) {
  const offers = row.offers || [];
  const sourcePrices = buildSourcePricesFromOffers(offers, row.bestSourceId, { countryName: (iso) => countryLabel(iso, lang) }).map((p) => ({
    ...p,
    nameKa: sourceName(p.sourceId, p.nameKa, lang),
  }));
  const form = row.formGroup ? FORM_LABELS[row.formGroup]?.[lang === 'en' ? 1 : 0] ?? row.form : row.form;
  const unit = UNIT_LABELS[row.formGroup];
  const payload = {
    id: row.id,
    slug: row.slug,
    name: row.name,
    latinName: row.latinName ?? null,
    imageUrl: row.imageUrl || offers.find((o) => o.imageUrl)?.imageUrl || null,
    manufacturer: lang === 'en' ? row.manufacturerLatin || row.manufacturer : row.manufacturer,
    country: countryLabel(row.countryIso, lang) ?? row.country,
    form,
    formGroup: row.formGroup ?? null,
    strength: doseLabel(row.strength, lang),
    packSize: row.packSize,
    unitCount: row.unitCount ?? null,
    unitLabel: unit ? unit[lang === 'en' ? 1 : 0] : null,
    packLabel: packLabel(row.unitCount, row.formGroup, lang),
    unitPriceGel: unitPrice(row),
    // The active substance: Georgian for Georgian readers when a pharmacy gave it, otherwise Latin.
    inn: lang === 'en' ? row.inn || row.innKa : row.innKa || row.inn,
    innLatin: row.inn ?? null,
    prescription: row.rx ?? null,
    description: row.description,
    category: row.category
      ? { id: row.category.id, slug: row.category.slug, nameKa: categoryName(row.category.slug, row.category.nameKa, lang) }
      : null,
    bestPriceGel: row.bestPriceGel,
    bestSource: publicSource(row.bestSource, lang),
    offerCount: row.offerCount,
    chainCount: row.chainCount ?? 0,
    savingsPercent: row.savingsPercent ?? null,
    sourcePrices,
    lastSyncedAt: row.lastSyncedAt,
  };
  if (includeOffers) {
    payload.offers = [...offers]
      .sort((a, b) => a.priceGel - b.priceGel)
      .map((o) => ({
        id: o.id,
        source: publicSource(o.source, lang),
        priceGel: o.priceGel,
        oldPriceGel: o.oldPriceGel,
        discountPercent: o.discountPercent,
        inStock: o.inStock,
        sourceUrl: o.sourceUrl,
        rawName: o.rawName,
        imageUrl: o.imageUrl,
        syncedAt: o.syncedAt,
      }));
  }
  return payload;
}

const PRODUCT_INCLUDE = {
  category: true,
  bestSource: true,
  offers: {
    select: {
      id: true,
      sourceId: true,
      priceGel: true,
      oldPriceGel: true,
      discountPercent: true,
      inStock: true,
      sourceUrl: true,
      rawName: true,
      imageUrl: true,
      syncedAt: true,
      facts: true,
      source: true,
    },
  },
};

pharmacyRouter.get(
  '/categories',
  asyncHandler(async (req, res) => {
    const lang = langOf(req);
    const rows = await prisma.drugCategory.findMany({
      orderBy: [{ sortOrder: 'asc' }, { nameKa: 'asc' }],
      include: { children: { orderBy: { sortOrder: 'asc' } } },
      where: { parentId: null },
    });

    const counts = await prisma.catalogProduct.groupBy({
      by: ['categoryId'],
      where: { ...LIVE, categoryId: { not: null } },
      _count: { _all: true },
    });
    const countById = Object.fromEntries(counts.map((c) => [c.categoryId, c._count._all]));

    const categories = rows.map((c) => ({
      id: c.id,
      slug: c.slug,
      nameKa: categoryName(c.slug, c.nameKa, lang),
      iconUrl: c.iconUrl,
      productCount: countById[c.id] ?? 0,
      // Only today's categories that hold something („სხვა“ last, retired ones never).
      children: c.children
        .filter((ch) => CATEGORY_SLUGS.has(ch.slug) && (countById[ch.id] ?? 0) > 0)
        .map((ch) => ({
          id: ch.id,
          slug: ch.slug,
          nameKa: categoryName(ch.slug, ch.nameKa, lang),
          iconUrl: ch.iconUrl,
          productCount: countById[ch.id] ?? 0,
        })),
    }));

    return res.json({ categories });
  }),
);

const listQuery = z.object({
  category: z.string().optional(),
  q: z.string().trim().max(80).optional(),
  // best_price (older builds' price list) and popular show what is worth comparing first;
  // price_asc is the cheapest first; savings the biggest difference between pharmacies first.
  sort: z.enum(['best_price', 'name', 'savings', 'popular', 'price_asc']).optional().default('popular'),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(24),
});

/** Query words as they may appear in a product's search text (as typed, and as their spelling key). */
function searchClauses(q) {
  const words = q.toLowerCase().split(/[\s,]+/).filter(Boolean).slice(0, 5);
  return words.map((w) => {
    // A product the nightly rebuild has not reached yet has no search text: its name still counts.
    const ors = [{ searchText: { contains: w, mode: 'insensitive' } }, { searchText: null, name: { contains: w, mode: 'insensitive' } }];
    const p = phon(w);
    if (p.length >= 3 && p !== w) ors.push({ searchText: { contains: p, mode: 'insensitive' } });
    return { OR: ors };
  });
}

/** Best matches first: the name starting with what was typed, then the brand, then the substance. */
function relevance(row, q) {
  const query = q.toLowerCase().trim();
  const pq = phon(query.split(/\s+/)[0]);
  const name = row.name.toLowerCase();
  const latin = (row.latinName || '').toLowerCase();
  let score = 0;
  if (name.startsWith(query) || latin.startsWith(query)) score += 100;
  else if (pq && phon(name.split(/\s+/)[0]) === pq) score += 90;
  else if (pq && (phon(name.split(/\s+/)[0]).startsWith(pq) || phon(latin.split(/\s+/)[0]).startsWith(pq))) score += 70;
  else if (name.includes(query) || latin.includes(query)) score += 50;
  else if ((row.inn || '').toLowerCase().includes(query) || (row.innKa || '').toLowerCase().includes(query)) score += 30;
  if (row.kind !== 'other') score += 10;
  if ((row.chainCount ?? 0) > 1) score += 4;
  return score;
}

pharmacyRouter.get(
  '/products',
  asyncHandler(async (req, res) => {
    const lang = langOf(req);
    const { category, q, sort, page, limit } = listQuery.parse(req.query);

    const where = { ...LIVE };
    if (category) {
      const cat = await prisma.drugCategory.findFirst({ where: { OR: [{ slug: category }, { id: category }] } });
      where.categoryId = cat?.id ?? '__none__';
    }

    if (q && q.length >= 2) {
      where.AND = searchClauses(q);
      const rows = await prisma.catalogProduct.findMany({ where, include: PRODUCT_INCLUDE, take: 400 });
      rows.sort((a, b) => relevance(b, q) - relevance(a, q) || a.name.length - b.name.length || (a.bestPriceGel ?? 1e9) - (b.bestPriceGel ?? 1e9));
      const slice = rows.slice((page - 1) * limit, page * limit);
      return res.json({
        products: slice.map((r) => mapProduct(r, lang)),
        pagination: { page, limit, total: rows.length, pages: Math.ceil(rows.length / limit) },
      });
    }

    // Browsing: medicines (no syringes or condoms) unless a category asks for them. (A NULL kind — not
    // regrouped yet — is a medicine: SQL's `kind <> 'other'` alone would drop it.)
    if (!category) where.AND = [{ OR: [{ kind: null }, { kind: { not: 'other' } }] }];
    const total = await prisma.catalogProduct.count({ where });
    let rows;
    if (sort === 'name' || sort === 'price_asc') {
      const orderBy = sort === 'name' ? [{ name: 'asc' }] : [{ bestPriceGel: 'asc' }, { name: 'asc' }];
      rows = await prisma.catalogProduct.findMany({ where, orderBy, skip: (page - 1) * limit, take: limit, include: PRODUCT_INCLUDE });
    } else {
      // What comparing saves, in lari: boxes sold by both chains first, then the biggest difference between
      // pharmacies (best price × percent ÷ the rest) — 63 ₾ on Fraxiparine before 3.70 ₾ on an ampoule.
      const categoryId = where.categoryId ?? null;
      const ids = await prisma.$queryRaw`
        SELECT id FROM "CatalogProduct"
        WHERE "mergedIntoId" IS NULL AND "offerCount" > 0
          AND (${categoryId}::text IS NULL OR "categoryId" = ${categoryId})
          AND (${Boolean(category)} OR kind IS NULL OR kind <> 'other')
        ORDER BY "chainCount" DESC,
          COALESCE("bestPriceGel" * "savingsPercent" / NULLIF(100 - "savingsPercent", 0), 0) DESC,
          name ASC
        LIMIT ${limit} OFFSET ${(page - 1) * limit}`;
      const order = new Map(ids.map((r, i) => [r.id, i]));
      rows = (await prisma.catalogProduct.findMany({ where: { id: { in: [...order.keys()] } }, include: PRODUCT_INCLUDE })).sort(
        (a, b) => order.get(a.id) - order.get(b.id),
      );
    }

    return res.json({
      products: rows.map((r) => mapProduct(r, lang)),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  }),
);

/** A product folded into another one (its offers moved there) answers with that product. */
async function findLiveProduct(idOrSlug) {
  let row = await prisma.catalogProduct.findFirst({ where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] }, include: PRODUCT_INCLUDE });
  for (let hop = 0; row?.mergedIntoId && hop < 5; hop += 1) {
    row = await prisma.catalogProduct.findUnique({ where: { id: row.mergedIntoId }, include: PRODUCT_INCLUDE });
  }
  return row;
}

const ALTERNATIVE_SELECT = {
  id: true,
  name: true,
  latinName: true,
  imageUrl: true,
  bestPriceGel: true,
  unitCount: true,
  formGroup: true,
  strength: true,
  manufacturer: true,
  manufacturerLatin: true,
  countryIso: true,
  chainCount: true,
  rx: true,
  brandKey: true,
};

function mapAlternative(row, lang) {
  const unit = UNIT_LABELS[row.formGroup];
  return {
    id: row.id,
    name: row.name,
    latinName: row.latinName ?? null,
    imageUrl: row.imageUrl,
    bestPriceGel: row.bestPriceGel,
    unitCount: row.unitCount ?? null,
    unitLabel: unit ? unit[lang === 'en' ? 1 : 0] : null,
    packLabel: packLabel(row.unitCount, row.formGroup, lang),
    unitPriceGel: unitPrice(row),
    strength: doseLabel(row.strength, lang),
    manufacturer: lang === 'en' ? row.manufacturerLatin || row.manufacturer : row.manufacturer,
    country: countryLabel(row.countryIso, lang),
    chainCount: row.chainCount ?? 0,
    prescription: row.rx ?? null,
  };
}

pharmacyRouter.get(
  '/products/:id',
  asyncHandler(async (req, res) => {
    const lang = langOf(req);
    const row = await findLiveProduct(req.params.id);
    if (!row) return res.status(404).json({ error: t(req, 'პროდუქტი ვერ მოიძებნა.', 'Product not found.') });

    // Same box, other pack sizes — and the same substance, dose and form from other makers. Both
    // sorted by the price of one unit, which is what makes a 10-pack and a 30-pack comparable.
    const [otherPacks, analogues, aliases] = await Promise.all([
      row.brandKey && row.doseKey
        ? prisma.catalogProduct.findMany({
            where: { ...LIVE, id: { not: row.id }, brandKey: row.brandKey, doseKey: row.doseKey, formGroup: row.formGroup },
            select: ALTERNATIVE_SELECT,
            take: 8,
          })
        : [],
      row.innKey && row.doseKey && row.formGroup
        ? prisma.catalogProduct.findMany({
            where: { ...LIVE, id: { not: row.id }, innKey: row.innKey, doseKey: row.doseKey, formGroup: row.formGroup, NOT: { brandKey: row.brandKey ?? '' } },
            select: ALTERNATIVE_SELECT,
            take: 30,
          })
        : [],
      prisma.catalogProduct.findMany({ where: { mergedIntoId: row.id }, select: { id: true } }),
    ]);
    // One line per maker's box: a pharmacy listing the same box twice (two countries) shows once.
    const onePerBrand = (rows) => {
      const seen = new Set();
      return rows.filter((r) => {
        const key = `${r.brandKey}|${r.unitCount}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    };
    const byUnit = (a, b) => (unitPrice(a) ?? a.bestPriceGel ?? 1e9) - (unitPrice(b) ?? b.bestPriceGel ?? 1e9);

    return res.json({
      product: {
        ...mapProduct(row, lang, { includeOffers: true }),
        otherPacks: otherPacks.sort((a, b) => (a.unitCount ?? 0) - (b.unitCount ?? 0)).map((r) => mapAlternative(r, lang)),
        analogues: onePerBrand(analogues.sort(byUnit)).slice(0, 12).map((r) => mapAlternative(r, lang)),
        aliases: aliases.map((a) => a.id),
      },
    });
  }),
);

pharmacyRouter.get(
  '/meta/sync',
  asyncHandler(async (_req, res) => {
    const [sources, catalog] = await Promise.all([getSyncMeta(), getCatalogStats()]);
    return res.json({ sources, catalog });
  }),
);

