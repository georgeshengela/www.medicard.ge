import * as cheerio from 'cheerio';
import { FETCH_HEADERS, SOURCES } from '../constants.js';

const BASE = SOURCES.AVERSI.baseUrl;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

let browserPromise = null;

async function getBrowser() {
  if (!browserPromise) {
    const { chromium } = await import('playwright');
    browserPromise = chromium.launch({ headless: true });
  }
  return browserPromise;
}

export async function closeAversiBrowser() {
  if (browserPromise) {
    const b = await browserPromise;
    await b.close();
    browserPromise = null;
  }
}

async function fetchHtmlWithBrowser(url) {
  const browser = await getBrowser();
  const context = await browser.newContext({
    userAgent: FETCH_HEADERS['User-Agent'],
    locale: 'ka-GE',
  });
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(4000);
    const html = await page.content();
    if (/cloudflare|cf-error|blocked/i.test(html) && html.length < 20000) {
      throw new Error('Cloudflare blocked automated access');
    }
    return html;
  } finally {
    await context.close();
  }
}

export function parseAversiListingHtml(html, categoryId = null) {
  const $ = cheerio.load(html);
  const products = [];
  const seen = new Set();

  $('.product-miniature, .product, [class*="product"]').each((_, el) => {
    const link = $(el).find('a[href]').first();
    const href = link.attr('href') || '';
    if (!href || href === '#') return;

    const name =
      $(el).find('.product-title, .product-name, h2, h3').first().text().trim() ||
      link.attr('title') ||
      link.text().trim();
    if (!name || name.length < 3) return;

    const priceRaw =
      $(el).find('.price, .current-price, [class*="price"]').first().text() ||
      $(el).text();
    const priceMatch = priceRaw.match(/([\d.,]+)/);
    if (!priceMatch) return;

    const priceGel = parseFloat(priceMatch[1].replace(',', '.'));
    if (Number.isNaN(priceGel)) return;

    const sourceProductId = href.match(/(\d+)/)?.[0] || href;
    const key = `AVERSI:${sourceProductId}`;
    if (seen.has(key)) return;
    seen.add(key);

    const img = $(el).find('img').first().attr('src') || null;
    const imageUrl = img?.startsWith('http') ? img : img ? `${BASE}${img}` : null;
    const sourceUrl = href.startsWith('http') ? href : `${BASE}${href.startsWith('/') ? '' : '/'}${href}`;

    products.push({
      sourceId: 'AVERSI',
      sourceProductId: String(sourceProductId),
      rawName: name,
      priceGel,
      oldPriceGel: null,
      discountPercent: null,
      inStock: true,
      imageUrl,
      sourceUrl,
      categoryId,
    });
  });

  // Fallback: generic links with prices
  if (!products.length) {
    $('a[href*="/ka/"]').each((_, el) => {
      const href = $(el).attr('href') || '';
      if (!/product|medikament|p\//i.test(href)) return;
      const block = $(el).closest('article, li, div').first();
      const text = block.text();
      const priceMatch = text.match(/([\d.,]+)\s*₾/);
      const name = $(el).attr('title') || $(el).text().trim();
      if (!priceMatch || !name || name.length < 4) return;
      const sourceProductId = href.match(/(\d{3,})/)?.[1] || href;
      const key = `AVERSI:${sourceProductId}`;
      if (seen.has(key)) return;
      seen.add(key);
      products.push({
        sourceId: 'AVERSI',
        sourceProductId: String(sourceProductId),
        rawName: name.slice(0, 200),
        priceGel: parseFloat(priceMatch[1].replace(',', '.')),
        oldPriceGel: null,
        discountPercent: null,
        inStock: true,
        imageUrl: null,
        sourceUrl: href.startsWith('http') ? href : `${BASE}${href}`,
        categoryId,
      });
    });
  }

  return products;
}

const AVERSI_MEDICATION_URLS = [
  `${BASE}/ka/`,
  `${BASE}/ka/3-medikamentebi`,
  `${BASE}/ka/`,
];

/**
 * Crawl Aversi shop medication listings via Playwright (Cloudflare).
 */
export async function fetchAversiProducts(opts = {}) {
  const { maxPages = 5, categoryId = null, onProgress } = opts;
  const all = [];
  const seen = new Set();

  for (const startUrl of AVERSI_MEDICATION_URLS) {
    try {
      const html = await fetchHtmlWithBrowser(startUrl);
      const batch = parseAversiListingHtml(html, categoryId);
      for (const p of batch) {
        const key = p.sourceProductId;
        if (seen.has(key)) continue;
        seen.add(key);
        all.push(p);
      }
      onProgress?.(all.length);
      if (all.length > 0) break;
    } catch (err) {
      console.warn('[aversi] fetch failed for', startUrl, err.message);
    }
    await sleep(500);
  }

  // Paginate if pagination links found (limited for v1)
  if (all.length && maxPages > 1) {
    for (let page = 2; page <= maxPages; page += 1) {
      try {
        const url = `${BASE}/ka/?page=${page}`;
        const html = await fetchHtmlWithBrowser(url);
        const batch = parseAversiListingHtml(html, categoryId);
        if (!batch.length) break;
        for (const p of batch) {
          if (seen.has(p.sourceProductId)) continue;
          seen.add(p.sourceProductId);
          all.push(p);
        }
        onProgress?.(all.length);
        await sleep(600);
      } catch {
        break;
      }
    }
  }

  return all;
}
