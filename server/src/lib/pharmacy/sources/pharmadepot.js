import { Worker } from 'node:worker_threads';
import * as cheerio from 'cheerio';
import { FETCH_HEADERS, SOURCES } from '../constants.js';
import { factsFromPharmadepot } from '../facts.js';

/**
 * The page's Next.js flight data (`self.__next_f.push([1,"…"])` chunks) — it carries every listed
 * product as JSON: shelf and old price, brand, and `medicament_characteristic` (substance, dose, form,
 * count, volume, maker, country, whether a prescription is needed, sub-category, med_code shared with GPC).
 */
export function flightProductsFromHtml(html) {
  const re = /self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g;
  let m;
  let flight = '';
  while ((m = re.exec(html))) {
    try {
      flight += JSON.parse(m[1]);
    } catch {
      /* a chunk that is not a JSON string */
    }
  }
  const products = new Map();
  const start = /\{"id":\d+,"price":/g;
  let s;
  while ((s = start.exec(flight))) {
    const raw = balancedObject(flight, s.index);
    if (!raw) continue;
    start.lastIndex = s.index + raw.length;
    try {
      const obj = JSON.parse(raw);
      if (obj.medicament_characteristic || obj.full_name) products.set(String(obj.id), obj);
    } catch {
      /* not a product object */
    }
  }
  return products;
}

function balancedObject(text, from) {
  let depth = 0;
  let inString = false;
  for (let i = from; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      if (ch === '\\') i += 1;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{' || ch === '[') depth += 1;
    else if (ch === '}' || ch === ']') {
      depth -= 1;
      if (depth === 0) return text.slice(from, i + 1);
    }
  }
  return null;
}

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

/**
 * Parse product cards from a Pharmadepot/GPC category or search page. The link and picture come from
 * the card markup; name, prices and the structured facts from the page's flight data when it has them
 * (the markup prices stay as the fallback).
 */
export function parsePharmadepotListingHtml(html, categoryId = null, platform = PHARMADEPOT_PLATFORM.PHARMADEPOT) {
  const { sourceId, base } = platform;
  const $ = cheerio.load(html);
  const flight = flightProductsFromHtml(html);
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
    const json = flight.get(sourceProductId);
    const sourceUrl = href.startsWith('http') ? href : `${base}${href.startsWith('/') ? '' : '/'}${href}`;

    if (json && Number(json.price) > 0 && json.full_name) {
      const priceGel = Number(json.price);
      const initial = Number(json.initial_price);
      const oldPriceGel = Number.isFinite(initial) && initial > priceGel ? initial : null;
      products.push({
        sourceId,
        sourceProductId,
        rawName: String(json.full_name).replace(/\s+/g, ' ').trim(),
        priceGel,
        oldPriceGel,
        discountPercent: oldPriceGel ? Math.round(((oldPriceGel - priceGel) / oldPriceGel) * 100) : null,
        inStock: json.medicament_is_active !== false,
        imageUrl: json.image_url || card.find('img[src^="http"]').attr('src') || null,
        sourceUrl,
        country: json.medicament_characteristic?.manufacturer_country_name || null,
        categoryId,
        facts: factsFromPharmadepot(json),
      });
      return;
    }

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

/**
 * A listing page is ~1 MB of HTML: cheerio.load plus 100 cards took 15–80 ms locally (2026-10-13), a
 * few times that on Render, and the nightly crawl runs inside the web server. Pages are parsed on a
 * worker thread with the same parser; if the worker is unavailable, the page is parsed here as before.
 */
function createListingParser() {
  const pending = new Map();
  let nextId = 0;
  let worker = null;
  const failAll = (error) => {
    for (const p of pending.values()) p.reject(error);
    pending.clear();
    worker = null;
  };
  try {
    worker = new Worker(new URL('./pharmadepotParseWorker.js', import.meta.url));
    worker.on('message', ({ id, products, error }) => {
      const p = pending.get(id);
      if (!p) return;
      pending.delete(id);
      if (error) p.reject(new Error(error));
      else p.resolve(products);
    });
    worker.on('error', failAll);
    worker.on('exit', () => failAll(new Error('listing parse worker exited')));
  } catch {
    worker = null;
  }
  return {
    parse(html, platform) {
      const here = () => parsePharmadepotListingHtml(html, null, platform);
      if (!worker) return Promise.resolve().then(here);
      const id = (nextId += 1);
      const parsed = new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
      worker.postMessage({ id, html, sourceId: platform.sourceId });
      return parsed.catch(here);
    },
    close() {
      const w = worker;
      worker = null;
      w?.terminate().catch(() => {});
    },
  };
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
  const parser = createListingParser();
  try {
    for (let page = 1; page <= pages; page += 1) {
      const html = page === 1 ? firstHtml : await fetchHtml(listUrl(page));
      const batch = await parser.parse(html, platform);
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
  } finally {
    parser.close();
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
