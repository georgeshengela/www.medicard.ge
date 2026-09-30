export const SOURCES = {
  PHARMADEPOT: {
    id: 'PHARMADEPOT',
    nameKa: 'ფარმადეპო',
    baseUrl: 'https://pharmadepot.ge',
    logoUrl: 'https://pharmadepot.ge/icons/favicon.ico',
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

/**
 * Display/compare order everywhere (API sourcePrices, admin). Aversi was removed on
 * 2026-09-30 (owner decision): every aversi.ge host sits behind a Cloudflare challenge and
 * the Playwright crawl never ran on Render, so its prices were weeks old. No source is
 * better than a wrong one.
 */
export const SOURCE_ORDER = ['PSP', 'PHARMADEPOT', 'GPC'];

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
