import * as cheerio from 'cheerio';
import { FETCH_HEADERS, SOURCES } from '../constants.js';

/**
 * Pharmadepot and GPC run the same storefront (same markup, `?product=ID` links). One crawler
 * serves both. The whole medication category is walked page by page: the site ignores `page`
 * once a `subCategory` filter is present, so the old per-subcategory crawl only ever saw the
 * first 24 products of each subcategory (~540 of ~3 300). The default order is not stable
 * between pages (a 2026-09-30 crawl saw 2 408 of 3 296); `sort=price_asc` is (3 294 of 3 296).
 */
export const PHARMADEPOT_PLATFORM = {
  PHARMADEPOT: { sourceId: 'PHARMADEPOT', base: SOURCES.PHARMADEPOT.baseUrl, medicationCategory: '111843' },
  GPC: { sourceId: 'GPC', base: SOURCES.GPC.baseUrl, medicationCategory: '26' },
};

const PER_PAGE = 100;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchHtml(url, attempt = 1) {
  try {
    const res = await fetch(url, { headers: FETCH_HEADERS, redirect: 'follow', signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return res.text();
  } catch (err) {
    if (attempt >= 3) throw err;
    await sleep(500 * attempt);
    return fetchHtml(url, attempt + 1);
  }
}

/** Parse product cards from a Pharmadepot/GPC category or search page. */
export function parsePharmadepotListingHtml(html, categoryId = null, platform = PHARMADEPOT_PLATFORM.PHARMADEPOT) {
  const { sourceId, base } = platform;
  const $ = cheerio.load(html);
  const products = [];
  const seen = new Set();

  $('a[href*="product="]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const idMatch = href.match(/product=(\d+)/);
    if (!idMatch) return;
    const sourceProductId = idMatch[1];
    if (seen.has(sourceProductId)) return;
    seen.add(sourceProductId);

    // The whole card (image, name, prices) sits inside the product link.
    const card = $(el);

    const rawName =
      card.find('img[alt]').first().attr('alt') ||
      card.find('.line-clamp-2').first().text().trim() ||
      card.find('.text-16').first().text().trim();

    if (!rawName || rawName.length < 3) return;

    // A card can carry several money values: a green „კალათის ფასდაკლება -7.28₾“ badge, the
    // shelf price and a struck-through old price. The shelf price is the bold one; never take
    // the first `[content]` blindly (that read Trimecor at GPC as 7.28 instead of 41.22).
    const numericContent = (n) => /^\d/.test($(n).attr('content') || '');
    const priceNode =
      card.find('.font-semibold [content]').filter((__, n) => numericContent(n)).first().get(0) ||
      card
        .find('[content]')
        .filter((__, n) => numericContent(n) && !/ფასდაკლება/.test($(n).closest('.min-h-30').text()))
        .last()
        .get(0);
    const priceText = priceNode ? $(priceNode).attr('content') : null;

    const priceGel = priceText ? parseFloat(String(priceText).replace(',', '.')) : null;
    if (!priceGel || Number.isNaN(priceGel)) return;

    const oldText = card.find('.line-through, .text-oldprice').first().text();
    const oldValue = parseFloat((oldText.match(/[\d.]+/) || [])[0]);
    const oldPriceGel = Number.isFinite(oldValue) && oldValue > priceGel ? oldValue : null;

    const img =
      card.find('img[src*="cdn.pharmadepot"]').attr('src') ||
      card.find('img[src^="http"]').attr('src') ||
      null;

    const country = card.find('.text-black70').first().text().trim() || null;
    const sourceUrl = href.startsWith('http') ? href : `${base}${href.startsWith('/') ? '' : '/'}${href}`;

    let discountPercent = null;
    if (oldPriceGel && oldPriceGel > priceGel) {
      discountPercent = Math.round(((oldPriceGel - priceGel) / oldPriceGel) * 100);
    }

    products.push({
      sourceId,
      sourceProductId,
      rawName: rawName.replace(/\s+/g, ' ').trim(),
      priceGel,
      oldPriceGel,
      discountPercent,
      // The storefront lists only products that can be ordered; anything missing from a full
      // crawl is marked out of stock by the sync.
      inStock: true,
      imageUrl: img,
      sourceUrl,
      country,
      categoryId,
    });
  });

  return products;
}

export function totalFromListingHtml(html) {
  const m = html.match(/მოძებნილია\s+(\d+)\s+პროდუქტ/i) || html.match(/\((\d+)\s*შედეგი\)/);
  return m ? parseInt(m[1], 10) : null;
}

async function fetchPlatformProducts(platform, opts = {}) {
  const { maxPages = 999, onProgress } = opts;
  const listUrl = (page) =>
    `${platform.base}/ka/category/medication?category=${platform.medicationCategory}&pageLimit=${PER_PAGE}&sort=price_asc${page > 1 ? `&page=${page}` : ''}`;

  const firstHtml = await fetchHtml(listUrl(1));
  const total = totalFromListingHtml(firstHtml);
  if (!total) throw new Error(`${platform.sourceId}: product count not found on the medication page`);
  const pages = Math.min(Math.ceil(total / PER_PAGE), maxPages);

  const all = [];
  const seen = new Set();
  let emptyPages = 0;
  for (let page = 1; page <= pages; page += 1) {
    const html = page === 1 ? firstHtml : await fetchHtml(listUrl(page));
    const batch = parsePharmadepotListingHtml(html, null, platform);
    let added = 0;
    for (const p of batch) {
      if (seen.has(p.sourceProductId)) continue;
      seen.add(p.sourceProductId);
      all.push(p);
      added += 1;
    }
    emptyPages = added ? 0 : emptyPages + 1;
    if (emptyPages >= 3) break;
    onProgress?.(all.length);
    if (page < pages) await sleep(300);
  }

  console.log(`[${platform.sourceId.toLowerCase()}] ${all.length} of ${total} listed products`);
  return all;
}

export function fetchPharmadepotProducts(opts = {}) {
  return fetchPlatformProducts(PHARMADEPOT_PLATFORM.PHARMADEPOT, opts);
}

export function fetchGpcProducts(opts = {}) {
  return fetchPlatformProducts(PHARMADEPOT_PLATFORM.GPC, opts);
}

export async function searchPharmadepot(query, categoryId = null) {
  const platform = PHARMADEPOT_PLATFORM.PHARMADEPOT;
  const html = await fetchHtml(`${platform.base}/ka/search?q=${encodeURIComponent(query)}`);
  return parsePharmadepotListingHtml(html, categoryId, platform);
}
