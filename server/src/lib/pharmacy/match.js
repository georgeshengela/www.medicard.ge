import { prisma } from '../prisma.js';
import {
  buildMatchSignature,
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

function parseMeta(rawName) {
  const packSize = extractPackSize(rawName);
  const strength = extractStrengthTokens(rawName);
  const form = extractForm(rawName);
  return { packSize, strength: strength || null, form };
}

async function findMatchCandidate(rawName, meta) {
  const normalizedKey = buildNormalizedKey(rawName);
  const signature = buildMatchSignature(rawName);

  const exact = await prisma.catalogProduct.findFirst({
    where: { OR: [{ normalizedKey }, ...(signature ? [{ normalizedKey: signature }] : [])] },
    select: { id: true },
  });
  if (exact) return exact;

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
    const candidateSig = buildMatchSignature(c.name) || c.normalizedKey;
    const score = Math.max(
      similarityScore(signature, candidateSig),
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

  const meta = parseMeta(rawName);
  const normalizedKey = buildNormalizedKey(rawName);

  let resolvedCategoryId = categoryId ?? null;
  if (!resolvedCategoryId) {
    const slug = inferCategorySlug(rawName, `${meta.form || ''} ${meta.strength || ''}`);
    if (slug) resolvedCategoryId = await getCategoryIdBySlug(slug);
  }

  let product = await findMatchCandidate(rawName, meta);
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
        categoryId: resolvedCategoryId ?? null,
        offerCount: 0,
      },
      select: { id: true },
    });
  } else {
    await prisma.catalogProduct.update({
      where: { id: product.id },
      data: {
        normalizedKey,
        imageUrl: imageUrl ?? undefined,
        manufacturer: manufacturer ?? undefined,
        country: country ?? undefined,
        form: meta.form ?? undefined,
        strength: meta.strength ?? undefined,
        packSize: meta.packSize ?? undefined,
        categoryId: resolvedCategoryId ?? undefined,
      },
    });
  }

  const spid = String(sourceProductId);

  const existing = await prisma.pharmacyOffer.findUnique({
    where: { sourceId_sourceProductId: { sourceId, sourceProductId: spid } },
    select: { catalogProductId: true },
  });

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
