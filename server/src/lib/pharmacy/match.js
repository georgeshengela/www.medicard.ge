import { prisma } from '../prisma.js';
import {
  buildNormalizedKey,
  extractPackSize,
  extractStrengthTokens,
  similarityScore,
  slugify,
} from './normalize.js';
import { MATCH_THRESHOLD } from './constants.js';

function parseMeta(rawName) {
  const packSize = extractPackSize(rawName);
  const strength = extractStrengthTokens(rawName);
  const formMatch = rawName.match(/(ტაბლეტი|კაფსულა|წვეთები|tablets?|capsules?|drops)/i);
  return {
    packSize,
    strength: strength || null,
    form: formMatch ? formMatch[1] : null,
  };
}

async function findMatchCandidate(normalizedKey, categoryId) {
  const exact = await prisma.catalogProduct.findFirst({
    where: { normalizedKey },
    select: { id: true },
  });
  if (exact) return exact;

  const where = categoryId ? { categoryId } : {};
  const candidates = await prisma.catalogProduct.findMany({
    where,
    select: { id: true, normalizedKey: true },
    take: 500,
    orderBy: { updatedAt: 'desc' },
  });

  let best = null;
  let bestScore = 0;
  for (const c of candidates) {
    const score = similarityScore(normalizedKey, c.normalizedKey);
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  if (best && bestScore >= MATCH_THRESHOLD) return { id: best.id };
  return null;
}

export async function upsertOfferFromListing(listing) {
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
    categoryId,
    manufacturer,
    country,
  } = listing;

  const normalizedKey = buildNormalizedKey(rawName);
  const meta = parseMeta(rawName);

  let product = await findMatchCandidate(normalizedKey, categoryId);
  if (!product) {
    let slug = slugify(rawName);
    const existingSlug = await prisma.catalogProduct.findUnique({ where: { slug } });
    if (existingSlug) slug = `${slug}-${sourceProductId}`;

    product = await prisma.catalogProduct.create({
      data: {
        slug,
        name: rawName.trim(),
        normalizedKey,
        imageUrl: imageUrl ?? null,
        manufacturer: manufacturer ?? null,
        country: country ?? null,
        form: meta.form,
        strength: meta.strength,
        packSize: meta.packSize,
        categoryId: categoryId ?? null,
        offerCount: 0,
      },
      select: { id: true },
    });
  } else {
    await prisma.catalogProduct.update({
      where: { id: product.id },
      data: {
        name: rawName.trim(),
        imageUrl: imageUrl ?? undefined,
        manufacturer: manufacturer ?? undefined,
        country: country ?? undefined,
        form: meta.form ?? undefined,
        strength: meta.strength ?? undefined,
        packSize: meta.packSize ?? undefined,
        categoryId: categoryId ?? undefined,
      },
    });
  }

  const spid = String(sourceProductId);

  const existing = await prisma.pharmacyOffer.findUnique({
    where: { sourceId_sourceProductId: { sourceId, sourceProductId: spid } },
    select: { catalogProductId: true },
  });

  // Keep at most one offer per pharmacy per canonical product.
  await prisma.pharmacyOffer.deleteMany({
    where: {
      catalogProductId: product.id,
      sourceId,
      sourceProductId: { not: spid },
    },
  });

  await prisma.pharmacyOffer.upsert({
    where: {
      sourceId_sourceProductId: { sourceId, sourceProductId: spid },
    },
    create: {
      catalogProductId: product.id,
      sourceId,
      sourceProductId: spid,
      sourceUrl,
      rawName: rawName.trim(),
      priceGel,
      oldPriceGel: oldPriceGel ?? null,
      discountPercent: discountPercent ?? null,
      inStock,
      imageUrl: imageUrl ?? null,
    },
    update: {
      catalogProductId: product.id,
      sourceUrl,
      rawName: rawName.trim(),
      priceGel,
      oldPriceGel: oldPriceGel ?? null,
      discountPercent: discountPercent ?? null,
      inStock,
      imageUrl: imageUrl ?? null,
      syncedAt: new Date(),
    },
  });

  if (existing && existing.catalogProductId !== product.id) {
    await recomputeProductPricing(existing.catalogProductId);
  }

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
