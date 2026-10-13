import { SOURCES, SOURCE_ORDER, isOfferStale } from './constants.js';
import { chainOf } from './cluster.js';

/**
 * Prices of one product. Every product row already holds the same box from every pharmacy (the
 * nightly clustering in catalog.js puts them together), so nothing is matched at request time.
 */

function isComparable(offer) {
  return offer.priceGel > 0 && offer.inStock !== false && !isOfferStale(offer.syncedAt);
}

export function pricingFromOffers(offers) {
  const priced = offers.filter(isComparable).sort((a, b) => a.priceGel - b.priceGel);
  if (!priced.length) {
    return { bestPriceGel: null, bestSourceId: null, offerCount: 0, chainCount: 0, savingsPercent: null };
  }

  const min = priced[0].priceGel;
  const max = priced[priced.length - 1].priceGel;
  const uniqueSources = new Set(priced.map((o) => o.sourceId));

  return {
    bestPriceGel: min,
    bestSourceId: priced[0].sourceId,
    offerCount: uniqueSources.size,
    chainCount: new Set(priced.map((o) => chainOf(o.sourceId))).size,
    savingsPercent: priced.length > 1 && max > min ? Math.round(((max - min) / max) * 100) : null,
  };
}

/**
 * One row per pharmacy in display order (PSP, Pharmadepot, GPC) — the shape every app build reads.
 * `chain` says which company a pharmacy belongs to (Pharmadepot and GPC are both GEPHA, one price
 * list) so newer builds can show them as one row when their prices agree.
 */
export function buildSourcePricesFromOffers(offers, bestSourceId = null, { countryName = null } = {}) {
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
    const country = offer?.facts?.country ?? null;

    return {
      sourceId,
      chain: chainOf(sourceId),
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
      // The maker's country as this pharmacy states it — shown when pharmacies disagree.
      country: country && countryName ? countryName(country) : country,
      prescription: typeof offer?.facts?.rx === 'boolean' ? offer.facts.rx : null,
      priceDiffGel:
        priceGel != null && minPrice != null && !isBest && !stale && priceGel > minPrice
          ? Math.round((priceGel - minPrice) * 100) / 100
          : null,
    };
  });
}
