import * as cheerio from 'cheerio';
import { FETCH_HEADERS, PHARMADEPOT_MEDICATION_CATEGORY, SOURCES } from '../constants.js';
import {
  fetchPharmadepotSubcategoryList,
  mapPharmadepotSubcategoryName,
} from './pharmadepotCategories.js';
import { getCategoryIdBySlug } from '../categories.js';

const BASE = SOURCES.PHARMADEPOT.baseUrl;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchHtml(url) {
  const res = await fetch(url, { headers: FETCH_HEADERS, redirect: 'follow' });
  if (!res.ok) throw new Error(`Pharmadepot HTTP ${res.status} for ${url}`);
  return res.text();
}

/** Parse product cards from a Pharmadepot category/listing page. */
export function parsePharmadepotListingHtml(html, categoryId = null) {
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

    const card = $(el).closest('.flex.flex-col').length
      ? $(el).closest('.flex.flex-col')
      : $(el).parent().parent();

    const rawName =
      $(el).find('img[alt]').first().attr('alt') ||
      card.find('.line-clamp-2').first().text().trim() ||
      card.find('.text-16').first().text().trim();

    if (!rawName || rawName.length < 3) return;

    const priceText =
      card.find('[itemprop][content]').attr('content') ||
      card.find('[content]').filter((__, n) => /^\d/.test($(n).attr('content') || '')).first().attr('content') ||
      card.text().match(/([\d.]+)\s*₾/)?.[1];

    const priceGel = priceText ? parseFloat(String(priceText).replace(',', '.')) : null;
    if (!priceGel || Number.isNaN(priceGel)) return;

    const oldPriceMatch = card.text().match(/([\d.]+)\s*₾/g);
    let oldPriceGel = null;
    if (oldPriceMatch && oldPriceMatch.length > 1) {
      const nums = oldPriceMatch.map((s) => parseFloat(s.replace('₾', '').trim()));
      const max = Math.max(...nums);
      if (max > priceGel) oldPriceGel = max;
    }

    const img =
      card.find('img[src*="cdn.pharmadepot"]').attr('src') ||
      card.find('img[src^="http"]').attr('src') ||
      null;

    const country = card.find('.text-black70').first().text().trim() || null;
    const sourceUrl = href.startsWith('http') ? href : `${BASE}${href.startsWith('/') ? '' : '/'}${href}`;

    let discountPercent = null;
    if (oldPriceGel && oldPriceGel > priceGel) {
      discountPercent = Math.round(((oldPriceGel - priceGel) / oldPriceGel) * 100);
    }

    products.push({
      sourceId: 'PHARMADEPOT',
      sourceProductId,
      rawName,
      priceGel,
      oldPriceGel,
      discountPercent,
      inStock: true,
      imageUrl: img,
      sourceUrl,
      country,
      categoryId,
    });
  });

  return products;
}

function totalPagesFromHtml(html) {
  const productLinks = (html.match(/product=\d+/g) || []).length;
  const perPage = productLinks > 0 ? productLinks : 24;

  const totalMatch =
    html.match(/მოძებნილია\s+(\d+)\s+პროდუქტ/i) ||
    html.match(/\((\d+)\s*შედეგი\)/);
  if (!totalMatch) return 1;

  const total = parseInt(totalMatch[1], 10);
  return Math.max(1, Math.ceil(total / perPage));
}

/**
 * Fetch medications from Pharmadepot (all subcategories when categoryId not passed).
 * @param {{ maxPages?: number, categoryId?: string, subCategoryId?: number, onProgress?: (n:number)=>void }} opts
 */
export async function fetchPharmadepotProducts(opts = {}) {
  const { maxPages = 999, categoryId = null, subCategoryId = null, onProgress } = opts;

  if (subCategoryId || categoryId) {
    return fetchPharmadepotCategoryPages({ maxPages, categoryId, subCategoryId, onProgress });
  }

  const subs = await fetchPharmadepotSubcategoryList();
  const slugCache = new Map();
  const all = [];
  const seen = new Set();

  for (const sub of subs) {
    let resolvedCategoryId = null;
    const slug = mapPharmadepotSubcategoryName(sub.name);
    if (slug) {
      if (slugCache.has(slug)) resolvedCategoryId = slugCache.get(slug);
      else {
        resolvedCategoryId = await getCategoryIdBySlug(slug);
        slugCache.set(slug, resolvedCategoryId);
      }
    }

    const batch = await fetchPharmadepotCategoryPages({
      maxPages,
      categoryId: resolvedCategoryId,
      subCategoryId: sub.id,
    });

    for (const p of batch) {
      if (seen.has(p.sourceProductId)) continue;
      seen.add(p.sourceProductId);
      all.push(p);
      onProgress?.(all.length);
    }
  }

  return all;
}

async function fetchPharmadepotCategoryPages({ maxPages, categoryId, subCategoryId, onProgress }) {
  const all = [];
  const seen = new Set();

  const subParam = subCategoryId ? `&subCategory=${subCategoryId}` : '';
  const firstUrl = `${BASE}/ka/category/medication?category=${PHARMADEPOT_MEDICATION_CATEGORY}${subParam}`;
  const firstHtml = await fetchHtml(firstUrl);
  const pages = Math.min(totalPagesFromHtml(firstHtml), maxPages);

  for (let page = 1; page <= pages; page += 1) {
    const url =
      page === 1
        ? firstUrl
        : `${BASE}/ka/category/medication?category=${PHARMADEPOT_MEDICATION_CATEGORY}${subParam}&page=${page}`;
    const html = page === 1 ? firstHtml : await fetchHtml(url);
    const batch = parsePharmadepotListingHtml(html, categoryId);
    for (const p of batch) {
      if (seen.has(p.sourceProductId)) continue;
      seen.add(p.sourceProductId);
      all.push(p);
    }
    onProgress?.(all.length);
    if (page < pages) await sleep(400);
  }

  return all;
}

export async function searchPharmadepot(query, categoryId = null) {
  const url = `${BASE}/ka/search?q=${encodeURIComponent(query)}`;
  const html = await fetchHtml(url);
  return parsePharmadepotListingHtml(html, categoryId);
}
