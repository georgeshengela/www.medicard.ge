import { prisma } from '../prisma.js';
import { cpuSlicer } from '../cpuSlice.js';
import { buildGeoLatinMapSliced, buildLooseMatchSignature } from './normalize.js';
import { SOURCES, SOURCE_ORDER, isOfferStale } from './constants.js';
/** Offers change only in a sync (which marks the index out of date); the hourly refresh only re-ranks old offers. */
const CACHE_MS = 60 * 60 * 1000;

let cache = { builtAt: 0, geoMap: null, index: null };
/** Bumped when a sync or a repair changed offers; an index built before that is out of date. */
let generation = 0;
let cacheGeneration = -1;
let building = null;

/**
 * Gamige-style index: loose drug key → cheapest in-stock offer per pharmacy.
 *
 * It covers the whole catalog (6 700 products, 10 800 offers on 2026-10-13). Rebuilding it inside a
 * request every 5 minutes froze the single web CPU for ~1 s each time, so once an index exists a
 * request never waits: an index older than an hour, or one a sync made out of date, is served while
 * the next one builds in the background in slices of a few ms. Only the first request after a start
 * waits for the (sliced) build. One unordered query on purpose: the row order decides which spelling
 * wins in the Georgian→Latin map, and paging (ORDER BY) changed ~400 compare keys.
 */
export async function getCrossSourceIndex() {
  if (cache.index && cacheGeneration === generation && Date.now() - cache.builtAt < CACHE_MS) return cache;
  if (!building) {
    const startedFor = generation;
    building = buildCrossSourceIndex()
      .then((next) => {
        cache = next;
        cacheGeneration = startedFor;
        return next;
      })
      .finally(() => {
        building = null;
      });
    building.catch((error) => console.warn('[pharmacy] compare index build failed:', error?.message || error));
  }
  return cache.index ? cache : building;
}

async function buildCrossSourceIndex() {
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
          syncedAt: true,
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
  const geoMap = await buildGeoLatinMapSliced(nameCorpus);
  const index = new Map();
  const slicer = cpuSlicer();

  for (const row of rows) {
    if (slicer.due()) await slicer.pause();
    const key = buildLooseMatchSignature(row.name, geoMap);
    if (!key) continue;

    if (!index.has(key)) index.set(key, {});
    const bucket = index.get(key);

    for (const offer of row.offers) {
      const cur = bucket[offer.sourceId];
      if (!cur || preferOffer(offer, cur)) bucket[offer.sourceId] = offer;
    }
  }

  return { builtAt: Date.now(), geoMap, index };
}

/**
 * Recently confirmed beats stale, then in stock beats out of stock, then the cheaper wins.
 * (A fresh "out of stock" is the truth; an old "in stock" is only a guess.)
 */
function preferOffer(a, b) {
  const rank = (o) => (isOfferStale(o.syncedAt) ? 0 : 2) + (o.inStock === false ? 0 : 1);
  const ra = rank(a);
  const rb = rank(b);
  if (ra !== rb) return ra > rb;
  return a.priceGel < b.priceGel;
}

/** Offers changed: the next request starts a rebuild (and is still answered from the current index). */
export function invalidateCrossSourceIndex() {
  generation += 1;
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
    if (d && c) merged[sourceId] = preferOffer(c, d) ? c : d;
    else merged[sourceId] = d || c || null;
  }

  return SOURCE_ORDER.map((id) => merged[id]).filter(Boolean);
}

export function buildSourcePricesFromOffers(offers, bestSourceId = null) {
  const byId = Object.fromEntries(offers.map((o) => [o.sourceId, o]));
  const priced = offers.filter(isComparable).map((o) => o.priceGel);
  const minPrice = priced.length ? Math.min(...priced) : null;
  let bestId = bestSourceId;

  if (!bestId && minPrice != null) {
    bestId = SOURCE_ORDER.find((sid) => byId[sid]?.priceGel === minPrice) ?? null;
  }

  return SOURCE_ORDER.map((sourceId) => {
    const offer = byId[sourceId];
    const meta = SOURCES[sourceId];
    const priceGel = offer?.priceGel ?? null;
    const stale = offer ? isOfferStale(offer.syncedAt) : false;
    const isBest = bestId === sourceId && offer != null && !stale;

    return {
      sourceId,
      nameKa: meta?.nameKa ?? sourceId,
      logoUrl: meta?.logoUrl ?? null,
      priceGel,
      oldPriceGel: offer?.oldPriceGel ?? null,
      inStock: offer?.inStock ?? false,
      // Not re-confirmed by the pharmacy's site recently: shown, but never "cheapest".
      stale,
      syncedAt: offer?.syncedAt ?? null,
      isBest,
      sourceUrl: offer?.sourceUrl ?? null,
      priceDiffGel:
        priceGel != null && minPrice != null && !isBest && !stale && priceGel > minPrice
          ? Math.round((priceGel - minPrice) * 100) / 100
          : null,
    };
  });
}

function isComparable(offer) {
  return offer.priceGel > 0 && offer.inStock !== false && !isOfferStale(offer.syncedAt);
}

export function pricingFromOffers(offers) {
  const priced = offers.filter(isComparable).sort((a, b) => a.priceGel - b.priceGel);
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
