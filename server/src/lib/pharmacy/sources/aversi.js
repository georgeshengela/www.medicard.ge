import * as cheerio from 'cheerio';
import { FETCH_HEADERS, SOURCES } from '../constants.js';

const BASE = SOURCES.AVERSI.baseUrl;
const MEDICATIONS_URL = `${BASE}/ka/medikamentebi`;

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
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForSelector('.product, .product-title', { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const html = await page.content();
    if (/cf-chl|cf-error|just a moment/i.test(html) && html.length < 15000) {
      throw new Error('Cloudflare blocked automated access');
    }
    return html;
  } finally {
    await context.close();
  }
}

function absoluteUrl(href) {
  if (!href) return null;
  if (href.startsWith('http')) return href;
  return `${BASE}${href.startsWith('/') ? '' : '/'}${href}`;
}

function parsePriceGel(text) {
  const match = String(text || '').match(/([\d.,]+)\s*(?:₾|ლარი|GEL)?/i);
  if (!match) return null;
  const value = parseFloat(match[1].replace(',', '.'));
  return Number.isNaN(value) || value <= 0 ? null : value;
}

export function parseAversiListingHtml(html, categoryId = null) {
  const $ = cheerio.load(html);
  const products = [];
  const seen = new Set();

  $('.product').each((_, el) => {
    const card = $(el);
    const link = card.find('a[href*="MatID="]').first();
    const href = link.attr('href') || '';
    const matId = href.match(/MatID=(\d+)/i)?.[1];
    if (!matId) return;

    const key = `AVERSI:${matId}`;
    if (seen.has(key)) return;
    seen.add(key);

    const name =
      card.find('.product-title').first().text().trim() ||
      card.find('img[alt]').first().attr('alt')?.trim() ||
      link.attr('title')?.trim() ||
      '';
    if (!name || name.length < 3 || name === 'ანოტაცია') return;

    const priceText =
      card.find('.price .amount, .price ins, .price').first().text() ||
      card.find('.product-details').text();
    const priceGel = parsePriceGel(priceText);
    if (priceGel == null) return;

    const img = card.find('.product-thumb img, img[src]').first().attr('src') || null;
    const imageUrl = absoluteUrl(img);

    products.push({
      sourceId: 'AVERSI',
      sourceProductId: matId,
      rawName: name.replace(/\s+/g, ' ').trim(),
      priceGel,
      oldPriceGel: null,
      discountPercent: null,
      inStock: true,
      imageUrl,
      sourceUrl: absoluteUrl(href),
      categoryId,
    });
  });

  return products;
}

export function parseAversiCategoryLinks(html) {
  const $ = cheerio.load(html);
  const links = new Map();

  $('a[href*="/ka/medikamentebi/"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const match = href.match(/\/ka\/medikamentebi\/(\d+)/);
    if (!match) return;
    const id = match[1];
    if (!links.has(id)) links.set(id, absoluteUrl(href.split('?')[0]));
  });

  return [...links.entries()].map(([id, url]) => ({ id, url }));
}

function totalPagesFromHtml(html, categoryPath) {
  const $ = cheerio.load(html);
  let maxPage = 1;

  $(`a[href*="${categoryPath}"]`).each((_, el) => {
    const href = $(el).attr('href') || '';
    const pageMatch = href.match(/[?&]page=(\d+)/);
    if (pageMatch) maxPage = Math.max(maxPage, parseInt(pageMatch[1], 10));
  });

  return maxPage;
}

async function fetchCategoryPages(categoryUrl, { maxPages, categoryId, onProgress, seen }) {
  const categoryPath = categoryUrl.replace(BASE, '');
  const firstHtml = await fetchHtmlWithBrowser(categoryUrl);
  const pages = Math.min(totalPagesFromHtml(firstHtml, categoryPath), maxPages);
  const batch = [];

  for (let page = 1; page <= pages; page += 1) {
    const url = page === 1 ? categoryUrl : `${categoryUrl}?&page=${page}`;
    const html = page === 1 ? firstHtml : await fetchHtmlWithBrowser(url);
    const items = parseAversiListingHtml(html, categoryId);

    for (const item of items) {
      if (seen.has(item.sourceProductId)) continue;
      seen.add(item.sourceProductId);
      batch.push(item);
    }

    onProgress?.(seen.size);
    if (page < pages) await sleep(350);
  }

  return batch;
}

/**
 * Crawl www.aversi.ge medication categories (Playwright — Cloudflare protected).
 */
export async function fetchAversiProducts(opts = {}) {
  const { maxPages = 50, categoryId = null, onProgress } = opts;
  const all = [];
  const seen = new Set();

  const indexHtml = await fetchHtmlWithBrowser(MEDICATIONS_URL);
  const categories = parseAversiCategoryLinks(indexHtml);
  if (!categories.length) {
    console.warn('[aversi] no categories found on', MEDICATIONS_URL);
    return all;
  }

  console.log(`[aversi] crawling ${categories.length} categories…`);

  for (const cat of categories) {
    try {
      const batch = await fetchCategoryPages(cat.url, { maxPages, categoryId, onProgress, seen });
      all.push(...batch);
      if (batch.length) console.log(`[aversi] category ${cat.id}: +${batch.length} (total ${all.length})`);
    } catch (err) {
      console.warn('[aversi] category failed', cat.url, err.message);
    }
    await sleep(400);
  }

  return all;
}
