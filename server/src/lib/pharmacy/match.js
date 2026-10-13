import { randomUUID } from 'node:crypto';
import { prisma } from '../prisma.js';
import { OFFER_STALE_MS } from './constants.js';
import { transliterateKa } from './facts.js';
import { pricingFromOffers } from './pricing.js';

/**
 * Writing what a pharmacy lists. An offer keeps its product from night to night; a listing seen for the
 * first time gets a provisional product of its own, and the catalogue rebuild that follows every sync
 * (catalog.js) puts it together with the same box at the other pharmacies. No name guessing here.
 */

/** PSP's slow attributes are read once per product; a nightly listing without them keeps the stored ones. */
export function mergeFacts(previous, next) {
  if (!next) return previous ?? null;
  if (!previous?.enriched) return next;
  return {
    ...next,
    innPairs: next.innPairs ?? previous.innPairs ?? null,
    count: next.count ?? previous.count ?? null,
    manufacturer: next.manufacturer ?? previous.manufacturer ?? null,
    dose: next.dose ?? previous.dose ?? null,
    form: next.form ?? previous.form ?? null,
    country: next.country ?? previous.country ?? null,
    rx: next.rx ?? previous.rx ?? null,
    enriched: true,
    leaflet: previous.leaflet ?? undefined,
  };
}

export function provisionalSlug(rawName, sourceId, sourceProductId) {
  const base = transliterateKa(String(rawName || '').toLowerCase())
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return `${base || 'item'}-${String(sourceId).toLowerCase()}${sourceProductId}`;
}

/** Returns { productId, created }. */
export async function upsertOfferFromListing(listing) {
  const { sourceId, sourceProductId, rawName, priceGel, oldPriceGel, discountPercent, inStock = true, imageUrl, sourceUrl, facts } = listing;
  const spid = String(sourceProductId);
  const existing = await prisma.pharmacyOffer.findUnique({
    where: { sourceId_sourceProductId: { sourceId, sourceProductId: spid } },
    select: { id: true, catalogProductId: true, facts: true },
  });
  const data = {
    sourceUrl,
    rawName: String(rawName).trim(),
    priceGel,
    oldPriceGel: oldPriceGel ?? null,
    discountPercent: discountPercent ?? null,
    inStock,
    imageUrl: imageUrl ?? null,
    syncedAt: new Date(),
    facts: mergeFacts(existing?.facts, facts) ?? undefined,
  };
  if (existing) {
    await prisma.pharmacyOffer.update({ where: { id: existing.id }, data });
    return { productId: existing.catalogProductId, created: false };
  }

  const product = await prisma.catalogProduct.create({
    data: {
      slug: `${provisionalSlug(rawName, sourceId, spid)}-${randomUUID().slice(0, 6)}`,
      name: data.rawName,
      normalizedKey: `new:${sourceId}:${spid}`,
      imageUrl: imageUrl ?? null,
      offerCount: 0,
    },
    select: { id: true },
  });
  await prisma.pharmacyOffer.create({ data: { ...data, catalogProductId: product.id, sourceId, sourceProductId: spid } });
  return { productId: product.id, created: true };
}

/**
 * Best price of one product from its own offers. A product whose every offer is old keeps its last
 * known price (the API labels those as unconfirmed).
 */
export async function recomputeProductPricing(productId) {
  const offers = await prisma.pharmacyOffer.findMany({
    where: { catalogProductId: productId, inStock: true },
    select: { sourceId: true, priceGel: true, inStock: true, syncedAt: true },
  });
  const before = await prisma.catalogProduct.findUnique({ where: { id: productId }, select: { bestPriceGel: true } });
  const pricing = pricingFromOffers(offers);
  const freshSince = Date.now() - OFFER_STALE_MS;
  const hasFresh = offers.some((o) => new Date(o.syncedAt).getTime() >= freshSince);
  if (!pricing.bestPriceGel && offers.length && !hasFresh) return;
  await prisma.catalogProduct.update({
    where: { id: productId },
    data: {
      offerCount: pricing.offerCount,
      chainCount: pricing.chainCount,
      savingsPercent: pricing.savingsPercent,
      bestPriceGel: pricing.bestPriceGel,
      bestSourceId: pricing.bestSourceId,
      lastSyncedAt: new Date(),
    },
  });
  await recordPrice(productId, before?.bestPriceGel ?? null, pricing);
}

/** Price history + price-drop alerts. Never lets alerting break a pharmacy sync. */
export async function recordPrice(productId, previousBest, pricing) {
  try {
    const { recordPriceChange } = await import('../priceDrop.js');
    await recordPriceChange(productId, previousBest, { bestPriceGel: pricing.bestPriceGel, bestSourceId: pricing.bestSourceId });
  } catch (error) {
    console.warn('[price-drop] record failed', error?.code || error?.message);
  }
}

export async function recomputeAllPricing() {
  const ids = await prisma.catalogProduct.findMany({ where: { mergedIntoId: null }, select: { id: true } });
  for (const { id } of ids) await recomputeProductPricing(id);
}
