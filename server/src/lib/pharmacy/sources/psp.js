import * as cheerio from 'cheerio';
import { FETCH_HEADERS, SOURCES } from '../constants.js';

const BASE = SOURCES.PSP.baseUrl;
const MED_URL =
  'https://psp.ge/%E1%83%9B%E1%83%94%E1%83%93%E1%83%98%E1%83%99%E1%83%90%E1%83%9B%E1%83%94%E1%83%9C%E1%83%A2%E1%83%94%E1%83%91%E1%83%98.html';

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

export async function closePspBrowser() {
  if (browserPromise) {
    const b = await browserPromise;
    await b.close();
    browserPromise = null;
  }
}

async function fetchHtml(url, useBrowser = false) {
  if (!useBrowser) {
    const res = await fetch(url, { headers: FETCH_HEADERS, redirect: 'follow' });
    const html = await res.text();
    if (res.ok && parsePspListingHtml(html).length > 0) return html;
    throw new Error(`PSP fetch blocked or empty (${res.status})`);
  }

  const browser = await getBrowser();
  const context = await browser.newContext({ userAgent: FETCH_HEADERS['User-Agent'], locale: 'ka-GE' });
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForTimeout(2500);
    return await page.content();
  } finally {
    await context.close();
  }
}

export function parsePspListingHtml(html, categoryId = null) {
  const $ = cheerio.load(html);
  const products = [];
  const seen = new Set();

  $('.product-item, .products li, .item.product, [class*="product-item"]').each((_, el) => {
    const link = $(el).find('a[href*=".html"]').first();
    const href = link.attr('href') || '';
    if (!href || !href.includes('.html')) return;

    const name =
      $(el).find('.product-name, .name, h2, h3, .title').first().text().trim() ||
      link.attr('title')?.trim() ||
      link.find('img').attr('alt')?.trim() ||
      '';
    const cleanedName = name.replace(/\s+/g, ' ').trim();
    if (!cleanedName || cleanedName.length < 4) return;

    const priceText = $(el).find('.price, .special-price, .regular-price').first().text() || $(el).text();
    const priceMatch = priceText.match(/([\d.,]+)\s*(?:₾|GEL)?/i);
    if (!priceMatch) return;

    const priceGel = parseFloat(priceMatch[1].replace(',', '.'));
    if (Number.isNaN(priceGel) || priceGel <= 0) return;

    const sourceProductId = href.match(/([\w-]+\.html)/i)?.[1] || href;
    if (seen.has(sourceProductId)) return;
    seen.add(sourceProductId);

    const img = $(el).find('img').first().attr('src') || link.find('img').attr('src') || null;
    const imageUrl = img?.startsWith('http') ? img : img ? `https://assets.psp.ge${img.startsWith('/') ? '' : '/'}${img}` : null;
    const sourceUrl = href.startsWith('http') ? href : `${BASE}${href.startsWith('/') ? '' : '/'}${href}`;

    products.push({
      sourceId: 'PSP',
      sourceProductId: String(sourceProductId),
      rawName: cleanedName.slice(0, 240),
      priceGel,
      oldPriceGel: null,
      discountPercent: null,
      inStock: true,
      imageUrl,
      sourceUrl,
      categoryId,
    });
  });

  if (!products.length) {
    $('a[href*=".html"]').each((_, el) => {
      const href = $(el).attr('href') || '';
      if (!/medicament|medikament|\/[\w-]+\.html/i.test(href)) return;
      const block = $(el).closest('li, .product, div').first();
      const imgAlt = $(el).find('img').attr('alt')?.trim();
      const text = block.text().replace(/\s+/g, ' ');
      const priceMatch = text.match(/([\d.,]+)\s*₾/);
      const name = imgAlt || $(el).attr('title')?.trim() || $(el).text().trim();
      if (!priceMatch || !name || name.length < 4) return;
      const sourceProductId = href.split('/').pop() || href;
      if (seen.has(sourceProductId)) return;
      seen.add(sourceProductId);
      products.push({
        sourceId: 'PSP',
        sourceProductId: String(sourceProductId),
        rawName: name.replace(/\s+/g, ' ').slice(0, 240),
        priceGel: parseFloat(priceMatch[1].replace(',', '.')),
        oldPriceGel: null,
        discountPercent: null,
        inStock: true,
        imageUrl: null,
        sourceUrl: href.startsWith('http') ? href : `${BASE}${href.startsWith('/') ? '' : '/'}${href}`,
        categoryId,
      });
    });
  }

  return products;
}

/**
 * Fetch PSP medication catalog pages.
 */
export async function fetchPspProducts(opts = {}) {
  const { maxPages = 10, categoryId = null, onProgress } = opts;
  const all = [];
  const seen = new Set();

  const urls = [BASE, MED_URL];

  for (const url of urls) {
    try {
      let html;
      try {
        html = await fetchHtml(url, false);
      } catch {
        html = await fetchHtml(url, true);
      }

      const batch = parsePspListingHtml(html, categoryId);
      for (const p of batch) {
        if (seen.has(p.sourceProductId)) continue;
        seen.add(p.sourceProductId);
        all.push(p);
      }
      onProgress?.(all.length);
    } catch (err) {
      console.warn('[psp] fetch failed for', url, err.message);
    }
    await sleep(400);
  }

  for (let page = 2; page <= maxPages && all.length; page += 1) {
    try {
      const url = `${MED_URL}?page=${page}`;
      const html = await fetchHtml(url, true);
      const batch = parsePspListingHtml(html, categoryId);
      if (!batch.length) break;
      for (const p of batch) {
        if (seen.has(p.sourceProductId)) continue;
        seen.add(p.sourceProductId);
        all.push(p);
      }
      onProgress?.(all.length);
      await sleep(500);
    } catch {
      break;
    }
  }

  return all;
}
