import { prisma } from '../prisma.js';
import { randomUUID } from 'node:crypto';
import {
  buildGeoLatinMapSliced,
  buildLooseMatchSignature,
  buildNormalizedKey,
  signaturesCompatible,
  extractPackSize,
  extractStrengthTokens,
  extractForm,
  similarityScore,
  slugify,
} from './normalize.js';
import { MATCH_THRESHOLD, OFFER_STALE_MS } from './constants.js';
import { inferCategorySlug } from './categoryKeywords.js';
import { getCategoryIdBySlug } from './categories.js';
import { cpuSlicer } from '../cpuSlice.js';

let geoLatinCache = null;
let geoLatinBuiltAt = 0;
const GEO_CACHE_MS = 10 * 60 * 1000;

async function getGeoLatinMap() {
  if (geoLatinCache && Date.now() - geoLatinBuiltAt < GEO_CACHE_MS) return geoLatinCache;

  const rows = await prisma.catalogProduct.findMany({
    select: { name: true, offers: { select: { rawName: true }, take: 3 } },
    take: 30_000,
  });

  const corpus = [];
  for (const row of rows) {
    corpus.push(row.name);
    for (const offer of row.offers) {
      if (offer.rawName) corpus.push(offer.rawName);
    }
  }

  geoLatinCache = await buildGeoLatinMapSliced(corpus);
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

/**
 * The catalog, held in memory for the length of a sync. Matching used to fetch up to 3 000
 * candidate rows from Postgres for every listing (~1.7 s per listing from outside the DB region,
 * ~1.5 h for one 3 300-product pharmacy); the rows are the same for every listing of a run.
 */
let candidateCache = null;
let candidateBuiltAt = 0;

async function getCandidateIndex() {
  if (candidateCache && Date.now() - candidateBuiltAt < GEO_CACHE_MS) return candidateCache;
  const rows = await prisma.catalogProduct.findMany({
    select: { id: true, normalizedKey: true, name: true, strength: true, offerCount: true },
    orderBy: { offerCount: 'desc' },
    take: 60_000,
  });
  const byKey = new Map();
  for (const row of rows) if (!byKey.has(row.normalizedKey)) byKey.set(row.normalizedKey, row);
  candidateCache = { rows, byKey, looseByGeo: new WeakMap() };
  candidateBuiltAt = Date.now();
  return candidateCache;
}

/** Keep the in-memory catalog in step with what this sync just wrote. */
function rememberCandidate({ id, normalizedKey, strength, name }) {
  if (!candidateCache || !id) return;
  const { rows, byKey } = candidateCache;
  let row = rows.find((r) => r.id === id);
  if (row) {
    // Existing products keep their key (see upsertOfferFromListing).
    if (strength && !row.strength) row.strength = strength;
    return;
  } else {
    row = { id, normalizedKey, name, strength: strength ?? null, offerCount: 0 };
    rows.push(row);
  }
  if (normalizedKey && !byKey.has(normalizedKey)) byKey.set(normalizedKey, row);
}

function candidateLooseSig(index, c, geoLatinMap) {
  let perGeo = index.looseByGeo.get(geoLatinMap);
  if (!perGeo) {
    perGeo = new Map();
    index.looseByGeo.set(geoLatinMap, perGeo);
  }
  const cacheKey = `${c.id}|${c.name}`;
  if (!perGeo.has(cacheKey)) perGeo.set(cacheKey, buildLooseMatchSignature(c.name, geoLatinMap) || c.normalizedKey);
  return perGeo.get(cacheKey);
}

async function findMatchCandidate(rawName, meta, geoLatinMap) {
  const looseSig = buildLooseMatchSignature(rawName, geoLatinMap);
  const normalizedKey = looseSig || buildNormalizedKey(rawName, geoLatinMap);
  const index = await getCandidateIndex();

  if (looseSig) {
    const exactLoose = index.byKey.get(looseSig);
    if (exactLoose) return { id: exactLoose.id };
  }

  const legacy = index.byKey.get(normalizedKey);
  if (legacy) return { id: legacy.id };

  // Only pre-filter by strength, not packSize: sources format pack counts very
  // inconsistently (one writes "#1", another omits it entirely), so requiring an
  // exact packSize match here can exclude the true candidate before the fuzzy
  // (Jaccard) scoring below ever gets a chance to see it.
  const candidates = [];
  for (const c of index.rows) {
    if (meta.strength ? c.strength === meta.strength : c.offerCount > 0) candidates.push(c);
    if (candidates.length >= 3000) break;
  }

  // Up to 3 000 candidates per listing, ~10 000 listings a night: the nightly sync runs inside the web
  // server, so the scoring gives the CPU back every few ms (it froze requests for up to 0.7 s on 2026-10-13).
  const slicer = cpuSlicer();
  let best = null;
  let bestScore = 0;
  for (const c of candidates) {
    if (slicer.due()) await slicer.pause();
    const candidateLoose = candidateLooseSig(index, c, geoLatinMap);
    if (looseSig && candidateLoose === looseSig) return { id: c.id };
    // Never fuzzy-merge across a different strength, modifier or pack count.
    if (looseSig && candidateLoose && !signaturesCompatible(looseSig, candidateLoose)) continue;

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

  // normalizedKey stays what the product was created with: rewriting it from every listing
  // let one mismatched offer ("Zetor Plus") re-key the product ("Zetor") for later matches.
  const updateData = {
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
  rememberCandidate({ id: product.id, normalizedKey: looseSig || normalizedKey, strength: meta.strength, name: rawName.trim() });

  await replacePharmacyOffer(product.id, listing);

  return product.id;
}

export async function recomputeProductPricing(productId) {
  const inStock = await prisma.pharmacyOffer.findMany({
    where: { catalogProductId: productId, inStock: true },
    orderBy: { priceGel: 'asc' },
  });
  // The stored best price prefers offers a sync confirmed recently; a product whose every
  // offer is old keeps its last known price (the API labels those as unconfirmed).
  const freshSince = Date.now() - OFFER_STALE_MS;
  const fresh = inStock.filter((o) => new Date(o.syncedAt).getTime() >= freshSince);
  const offers = fresh.length ? fresh : inStock;

  const count = offers.length;
  if (!count) {
    await prisma.catalogProduct.update({
      where: { id: productId },
      data: { offerCount: 0, bestPriceGel: null, bestSourceId: null, lastSyncedAt: new Date() },
    });
    return;
  }

  const best = offers[0];
  const before = await prisma.catalogProduct.findUnique({ where: { id: productId }, select: { bestPriceGel: true } });
  await prisma.catalogProduct.update({
    where: { id: productId },
    data: {
      offerCount: count,
      bestPriceGel: best.priceGel,
      bestSourceId: best.sourceId,
      lastSyncedAt: new Date(),
    },
  });
  // Price history + price-drop alerts. Never let alerting break a pharmacy sync.
  try {
    const { recordPriceChange } = await import('../priceDrop.js');
    await recordPriceChange(productId, before?.bestPriceGel ?? null, { bestPriceGel: best.priceGel, bestSourceId: best.sourceId });
  } catch (error) {
    console.warn('[price-drop] record failed', error?.code || error?.message);
  }
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
  candidateCache = null;
  candidateBuiltAt = 0;
}
