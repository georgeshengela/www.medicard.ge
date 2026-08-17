import { prisma } from '../prisma.js';
import { randomUUID } from 'node:crypto';
import {
  buildGeoLatinMap,
  buildLooseMatchSignature,
  buildNormalizedKey,
  extractPackSize,
  extractStrengthTokens,
  extractForm,
  similarityScore,
  slugify,
} from './normalize.js';
import { MATCH_THRESHOLD } from './constants.js';
import { inferCategorySlug } from './categoryKeywords.js';
import { getCategoryIdBySlug } from './categories.js';

let geoLatinCache = null;
let geoLatinBuiltAt = 0;
const GEO_CACHE_MS = 10 * 60 * 1000;

async function getGeoLatinMap() {
  if (geoLatinCache && Date.now() - geoLatinBuiltAt < GEO_CACHE_MS) return geoLatinCache;

  const rows = await prisma.catalogProduct.findMany({
    select: { name: true, offers: { select: { rawName: true }, take: 3 } },
    take: 8000,
  });

  const corpus = [];
  for (const row of rows) {
    corpus.push(row.name);
    for (const offer of row.offers) {
      if (offer.rawName) corpus.push(offer.rawName);
    }
  }

  geoLatinCache = buildGeoLatinMap(corpus);
  geoLatinBuiltAt = Date.now();
  return geoLatinCache;
}

function parseMeta(rawName) {
  const packSize = extractPackSize(rawName);
  const strength = extractStrengthTokens(rawName);
  const form = extractForm(rawName);
  return { packSize, strength: strength || null, form };
}

function keysAlign(a, b) {
  if (!a || !b) return false;
  return a === b;
}

function isUniqueViolation(err) {
  return err?.code === 'P2002' || /Unique constraint failed/i.test(String(err?.message || err));
}

function slugCandidates(rawName, sourceProductId) {
  const baseSlug = slugify(rawName) || `item-${sourceProductId}`;
  const spid = String(sourceProductId || randomUUID().slice(0, 8));
  return [
    baseSlug,
    `${baseSlug.slice(0, 80)}-${spid}`,
    ...Array.from({ length: 12 }, (_, i) => `${baseSlug.slice(0, 90)}-${i + 1}`),
    `${baseSlug.slice(0, 60)}-${randomUUID().slice(0, 8)}`,
  ];
}

async function validateCategoryId(categoryId) {
  if (!categoryId) return null;
  const row = await prisma.drugCategory.findUnique({
    where: { id: categoryId },
    select: { id: true },
  });
  return row?.id ?? null;
}

async function resolveCategoryId(listing, rawName, meta) {
  let resolved = listing.categoryId ?? null;
  if (resolved) return validateCategoryId(resolved);

  const slug = inferCategorySlug(rawName, `${meta.form || ''} ${meta.strength || ''}`);
  if (!slug) return null;
  return getCategoryIdBySlug(slug);
}

async function findMatchCandidate(rawName, meta, geoLatinMap) {
  const looseSig = buildLooseMatchSignature(rawName, geoLatinMap);
  const normalizedKey = looseSig || buildNormalizedKey(rawName, geoLatinMap);

  if (looseSig) {
    const exactLoose = await prisma.catalogProduct.findFirst({
      where: { normalizedKey: looseSig },
      select: { id: true },
    });
    if (exactLoose) return exactLoose;
  }

  const legacy = await prisma.catalogProduct.findFirst({
    where: { normalizedKey },
    select: { id: true },
  });
  if (legacy) return legacy;

  const where = {};
  if (meta.strength) where.strength = meta.strength;
  if (meta.packSize) where.packSize = meta.packSize;

  const candidates = await prisma.catalogProduct.findMany({
    where: Object.keys(where).length ? where : { offerCount: { gt: 0 } },
    select: { id: true, normalizedKey: true, name: true },
    take: 3000,
    orderBy: { offerCount: 'desc' },
  });

  let best = null;
  let bestScore = 0;
  for (const c of candidates) {
    const candidateLoose = buildLooseMatchSignature(c.name, geoLatinMap) || c.normalizedKey;
    if (looseSig && candidateLoose === looseSig) return { id: c.id };

    const score = Math.max(
      similarityScore(looseSig, candidateLoose),
      similarityScore(normalizedKey, c.normalizedKey),
    );
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }

  if (best && bestScore >= MATCH_THRESHOLD) return { id: best.id };
  return null;
}

async function createCatalogProduct({
  rawName,
  normalizedKey,
  looseSig,
  meta,
  categoryId,
  imageUrl,
  manufacturer,
  country,
  sourceProductId,
}) {
  const key = looseSig || normalizedKey;
  const safeCategoryId = await validateCategoryId(categoryId);

  for (const slug of slugCandidates(rawName, sourceProductId)) {
    const existing = await prisma.catalogProduct.findUnique({
      where: { slug },
      select: { id: true, normalizedKey: true },
    });
    if (existing) {
      if (keysAlign(existing.normalizedKey, key)) return existing;
      continue;
    }

    try {
      return await prisma.catalogProduct.create({
        data: {
          slug,
          name: rawName.trim(),
          normalizedKey: key,
          imageUrl: imageUrl ?? null,
          manufacturer: manufacturer ?? null,
          country: country ?? null,
          form: meta.form,
          strength: meta.strength,
          packSize: meta.packSize,
          categoryId: safeCategoryId,
          offerCount: 0,
        },
        select: { id: true },
      });
    } catch (err) {
      if (isUniqueViolation(err)) continue;
      throw err;
    }
  }

  throw new Error(`Unable to create catalog product slug for ${rawName.slice(0, 48)}`);
}

async function ensureCatalogProduct({
  rawName,
  normalizedKey,
  looseSig,
  meta,
  categoryId,
  imageUrl,
  manufacturer,
  country,
  sourceProductId,
  geoLatinMap,
}) {
  const matched = await findMatchCandidate(rawName, meta, geoLatinMap);
  if (matched) return matched;

  const baseSlug = slugify(rawName) || `item-${sourceProductId}`;
  const key = looseSig || normalizedKey;
  const existingSlug = await prisma.catalogProduct.findUnique({
    where: { slug: baseSlug },
    select: { id: true, normalizedKey: true },
  });

  if (existingSlug && keysAlign(existingSlug.normalizedKey, key)) {
    return existingSlug;
  }

  return createCatalogProduct({
    rawName,
    normalizedKey,
    looseSig,
    meta,
    categoryId,
    imageUrl,
    manufacturer,
    country,
    sourceProductId,
  });
}

async function replacePharmacyOffer(productId, listing) {
  const {
    sourceId,
    sourceProductId,
    rawName,
    priceGel,
    oldPriceGel,
    discountPercent,
    inStock = true,
    imageUrl,
    sourceUrl,
  } = listing;

  const spid = String(sourceProductId);
  const offerData = {
    catalogProductId: productId,
    sourceId,
    sourceProductId: spid,
    sourceUrl,
    rawName: rawName.trim(),
    priceGel,
    oldPriceGel: oldPriceGel ?? null,
    discountPercent: discountPercent ?? null,
    inStock,
    imageUrl: imageUrl ?? null,
  };

  const previousOffer = await prisma.$transaction(async (tx) => {
    const prev = await tx.pharmacyOffer.findUnique({
      where: { sourceId_sourceProductId: { sourceId, sourceProductId: spid } },
      select: { catalogProductId: true },
    });

    await tx.pharmacyOffer.deleteMany({
      where: {
        OR: [{ sourceId, sourceProductId: spid }, { catalogProductId: productId, sourceId }],
      },
    });

    await tx.pharmacyOffer.create({ data: offerData });
    return prev;
  });

  if (previousOffer && previousOffer.catalogProductId !== productId) {
    await recomputeProductPricing(previousOffer.catalogProductId);
  }
}

export async function upsertOfferFromListing(listing) {
  const {
    sourceId,
    sourceProductId,
    rawName,
    imageUrl,
    manufacturer,
    country,
  } = listing;

  const geoLatinMap = await getGeoLatinMap();
  const meta = parseMeta(rawName);
  const looseSig = buildLooseMatchSignature(rawName, geoLatinMap);
  const normalizedKey = looseSig || buildNormalizedKey(rawName, geoLatinMap);
  const categoryId = await resolveCategoryId(listing, rawName, meta);
  const safeCategoryId = await validateCategoryId(categoryId);

  const product = await ensureCatalogProduct({
    rawName,
    normalizedKey,
    looseSig,
    meta,
    categoryId: safeCategoryId,
    imageUrl,
    manufacturer,
    country,
    sourceProductId,
    geoLatinMap,
  });

  const updateData = {
    normalizedKey: looseSig || normalizedKey,
    imageUrl: imageUrl ?? undefined,
    manufacturer: manufacturer ?? undefined,
    country: country ?? undefined,
    form: meta.form ?? undefined,
    strength: meta.strength ?? undefined,
    packSize: meta.packSize ?? undefined,
  };
  if (safeCategoryId) updateData.categoryId = safeCategoryId;

  await prisma.catalogProduct.update({
    where: { id: product.id },
    data: updateData,
  });

  await replacePharmacyOffer(product.id, listing);

  return product.id;
}

export async function recomputeProductPricing(productId) {
  const offers = await prisma.pharmacyOffer.findMany({
    where: { catalogProductId: productId, inStock: true },
    orderBy: { priceGel: 'asc' },
  });

  const count = offers.length;
  if (!count) {
    await prisma.catalogProduct.update({
      where: { id: productId },
      data: { offerCount: 0, bestPriceGel: null, bestSourceId: null, lastSyncedAt: new Date() },
    });
    return;
  }

  const best = offers[0];
  await prisma.catalogProduct.update({
    where: { id: productId },
    data: {
      offerCount: count,
      bestPriceGel: best.priceGel,
      bestSourceId: best.sourceId,
      lastSyncedAt: new Date(),
    },
  });
}

export async function recomputeAllPricing() {
  const ids = await prisma.catalogProduct.findMany({ select: { id: true } });
  for (const { id } of ids) {
    await recomputeProductPricing(id);
  }
}

export function invalidateMatchGeoCache() {
  geoLatinCache = null;
  geoLatinBuiltAt = 0;
}
