export const SOURCES = {
  PHARMADEPOT: {
    id: 'PHARMADEPOT',
    nameKa: 'ფარმადეპო',
    baseUrl: 'https://pharmadepot.ge',
    logoUrl: 'https://pharmadepot.ge/icons/favicon.ico',
  },
  AVERSI: {
    id: 'AVERSI',
    nameKa: 'ავერსი',
    baseUrl: 'https://www.aversi.ge',
    logoUrl: 'https://www.aversi.ge/favicon.ico',
  },
  PSP: {
    id: 'PSP',
    nameKa: 'PSP',
    baseUrl: 'https://psp.ge',
    logoUrl: 'https://psp.ge/favicon.ico',
  },
  GPC: {
    id: 'GPC',
    nameKa: 'ჯიპისი',
    baseUrl: 'https://gpc.ge',
    logoUrl: 'https://gpc.ge/favicon.ico',
  },
};

/** Display/compare order everywhere (API sourcePrices, admin). */
export const SOURCE_ORDER = ['PSP', 'PHARMADEPOT', 'GPC', 'AVERSI'];

/**
 * An offer not re-confirmed by a sync for this long is shown as unconfirmed
 * („დაუდასტურებელი“) and never counts as the best price.
 */
export const OFFER_STALE_MS = 3 * 24 * 60 * 60 * 1000;

export function isOfferStale(syncedAt, now = Date.now()) {
  if (!syncedAt) return true;
  const t = new Date(syncedAt).getTime();
  return !Number.isFinite(t) || now - t > OFFER_STALE_MS;
}

export const PHARMADEPOT_MEDICATION_CATEGORY = '111843';

export const FETCH_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'ka-GE,ka;q=0.9,en;q=0.8',
};

export const MATCH_THRESHOLD = 0.55;
