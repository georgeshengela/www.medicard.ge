import { prisma } from '../prisma.js';
import { buildGeoLatinMap, buildLooseMatchSignature } from './normalize.js';
import { SOURCES } from './constants.js';

const SOURCE_ORDER = ['PHARMADEPOT', 'AVERSI', 'PSP'];
const CACHE_MS = 5 * 60 * 1000;

let cache = { expires: 0, geoMap: null, index: null };

/** Gamige-style index: loose drug key → cheapest in-stock offer per pharmacy. */
export async function getCrossSourceIndex() {
  if (cache.index && Date.now() < cache.expires) return cache;

  const rows = await prisma.catalogProduct.findMany({
    where: { offerCount: { gt: 0 } },
    select: {
      name: true,
      offers: {
        where: { inStock: true },
        select: {
          sourceId: true,
          priceGel: true,
          oldPriceGel: true,
          discountPercent: true,
          inStock: true,
          sourceUrl: true,
          imageUrl: true,
          rawName: true,
        },
      },
    },
  });

  const nameCorpus = [];
  for (const row of rows) {
    nameCorpus.push(row.name);
    for (const offer of row.offers) {
      if (offer.rawName) nameCorpus.push(offer.rawName);
    }
  }
  const geoMap = buildGeoLatinMap(nameCorpus);
  const index = new Map();

  for (const row of rows) {
    const key = buildLooseMatchSignature(row.name, geoMap);
    if (!key) continue;

    if (!index.has(key)) index.set(key, {});
    const bucket = index.get(key);

    for (const offer of row.offers) {
      const cur = bucket[offer.sourceId];
      if (!cur || offer.priceGel < cur.priceGel) bucket[offer.sourceId] = offer;
    }
  }

  cache = { expires: Date.now() + CACHE_MS, geoMap, index };
  return cache;
}

export function invalidateCrossSourceIndex() {
  cache = { expires: 0, geoMap: null, index: null };
}

/** Merge direct offers on this row with cross-matched offers from sibling listings. */
export function resolveOffersForCompare(row, crossIndex, geoMap) {
  const key = buildLooseMatchSignature(row.name, geoMap);
  const cross = key ? crossIndex.get(key) || {} : {};
  const direct = Object.fromEntries((row.offers || []).map((o) => [o.sourceId, o]));

  const merged = {};
  for (const sourceId of SOURCE_ORDER) {
    const d = direct[sourceId];
    const c = cross[sourceId];
    if (d && c) merged[sourceId] = d.priceGel <= c.priceGel ? d : c;
    else merged[sourceId] = d || c || null;
  }

  return SOURCE_ORDER.map((id) => merged[id]).filter(Boolean);
}

export function buildSourcePricesFromOffers(offers, bestSourceId = null) {
  const byId = Object.fromEntries(offers.map((o) => [o.sourceId, o]));
  const priced = offers.map((o) => o.priceGel).filter((p) => p > 0);
  const minPrice = priced.length ? Math.min(...priced) : null;
  let bestId = bestSourceId;

  if (!bestId && minPrice != null) {
    bestId = SOURCE_ORDER.find((sid) => byId[sid]?.priceGel === minPrice) ?? null;
  }

  return SOURCE_ORDER.map((sourceId) => {
    const offer = byId[sourceId];
    const meta = SOURCES[sourceId];
    const priceGel = offer?.priceGel ?? null;
    const isBest = bestId === sourceId && offer != null;

    return {
      sourceId,
      nameKa: meta?.nameKa ?? sourceId,
      logoUrl: meta?.logoUrl ?? null,
      priceGel,
      oldPriceGel: offer?.oldPriceGel ?? null,
      inStock: offer?.inStock ?? false,
      isBest,
      sourceUrl: offer?.sourceUrl ?? null,
      priceDiffGel:
        priceGel != null && minPrice != null && !isBest && priceGel > minPrice
          ? Math.round((priceGel - minPrice) * 100) / 100
          : null,
    };
  });
}

export function pricingFromOffers(offers) {
  const priced = offers.filter((o) => o.priceGel > 0).sort((a, b) => a.priceGel - b.priceGel);
  if (!priced.length) {
    return { bestPriceGel: null, bestSourceId: null, offerCount: 0, savingsPercent: null };
  }

  const min = priced[0].priceGel;
  const max = priced[priced.length - 1].priceGel;
  const uniqueSources = new Set(priced.map((o) => o.sourceId));

  return {
    bestPriceGel: min,
    bestSourceId: priced[0].sourceId,
    offerCount: uniqueSources.size,
    savingsPercent: priced.length > 1 && max > min ? Math.round(((max - min) / max) * 100) : null,
  };
}
