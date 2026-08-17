import { prisma } from '../prisma.js';
import { ensureDrugCategories, ensurePharmacySources } from './categories.js';
import { upsertOfferFromListing, recomputeAllPricing, recomputeProductPricing, invalidateMatchGeoCache } from './match.js';
import { invalidateCrossSourceIndex } from './crossMatch.js';
import { fetchPharmadepotProducts } from './sources/pharmadepot.js';
import { fetchAversiProducts, closeAversiBrowser } from './sources/aversi.js';
import { fetchPspProducts, closePspBrowser } from './sources/psp.js';

const FETCHERS = {
  PHARMADEPOT: fetchPharmadepotProducts,
  AVERSI: fetchAversiProducts,
  PSP: fetchPspProducts,
};

async function startSyncRun(source) {
  return prisma.syncRun.create({
    data: { source, status: 'RUNNING' },
  });
}

async function finishSyncRun(id, { status, itemsFetched, error }) {
  await prisma.syncRun.update({
    where: { id },
    data: {
      status,
      itemsFetched,
      error: error ?? null,
      finishedAt: new Date(),
    },
  });
}

async function ingestListings(listings) {
  const touched = new Set();
  let skipped = 0;
  const skipSamples = [];

  for (const listing of listings) {
    try {
      const productId = await upsertOfferFromListing(listing);
      touched.add(productId);
    } catch (err) {
      skipped += 1;
      const msg = `${listing.sourceId}/${listing.sourceProductId}: ${err?.message || err}`;
      if (skipSamples.length < 5) skipSamples.push(msg);
      console.warn(`[pharmacy-sync] skip ${msg}`);
    }
  }
  for (const id of touched) {
    await recomputeProductPricing(id);
  }
  return { count: listings.length - skipped, products: touched.size, skipped, skipSamples };
}

async function cleanupStaleRuns() {
  const cutoff = new Date(Date.now() - 3 * 60 * 60 * 1000);
  await prisma.syncRun.updateMany({
    where: { status: 'RUNNING', startedAt: { lt: cutoff } },
    data: { status: 'FAILED', error: 'Timed out (stale run)', finishedAt: new Date() },
  });
}

export async function syncPharmacySource(source, opts = {}) {
  const fetcher = FETCHERS[source];
  if (!fetcher) throw new Error(`Unknown source: ${source}`);

  await cleanupStaleRuns();

  await ensurePharmacySources();
  await ensureDrugCategories();

  const run = await startSyncRun(source);
  try {
    console.log(`[pharmacy-sync] ${source} started…`);
    const listings = await fetcher({
      maxPages: opts.maxPages,
      categoryId: opts.categoryId ?? null,
      onProgress: (n) => {
        if (n % 50 === 0) console.log(`[pharmacy-sync] ${source} fetched ${n}…`);
      },
    });
    const result = await ingestListings(listings);
    invalidateCrossSourceIndex();
    invalidateMatchGeoCache();
    const status = result.skipped > 0 && result.count === 0 ? 'FAILED' : 'DONE';
    const error =
      result.skipped > 0
        ? result.count === 0
          ? result.skipSamples.join(' · ') || `${result.skipped} offer(s) skipped`
          : `${result.skipped} გამოტოვებული · ${result.skipSamples.slice(0, 2).join(' · ')}`
        : null;
    await finishSyncRun(run.id, { status, itemsFetched: result.count, error });
    console.log(
      `[pharmacy-sync] ${source} done — ${result.count} offers, ${result.products} products${result.skipped ? `, ${result.skipped} skipped` : ''}`,
    );
    return result;
  } catch (err) {
    await finishSyncRun(run.id, {
      status: 'FAILED',
      itemsFetched: 0,
      error: err?.message || String(err),
    });
    throw err;
  } finally {
    if (source === 'AVERSI') await closeAversiBrowser();
    if (source === 'PSP') await closePspBrowser();
  }
}

export async function syncAllPharmacySources(opts = {}) {
  await cleanupStaleRuns();
  const run = await startSyncRun('ALL');
  const sources = opts.sources || ['PHARMADEPOT', 'AVERSI', 'PSP'];
  let total = 0;
  const errors = [];

  await ensurePharmacySources();
  await ensureDrugCategories();

  for (const source of sources) {
    try {
      const r = await syncPharmacySource(source, opts);
      total += r.count;
    } catch (err) {
      errors.push(`${source}: ${err.message}`);
    }
  }

  await recomputeAllPricing();
  invalidateCrossSourceIndex();

  await finishSyncRun(run.id, {
    status: errors.length ? 'FAILED' : 'DONE',
    itemsFetched: total,
    error: errors.length ? errors.join('; ') : null,
  });

  return { total, errors };
}

export async function getSyncMeta() {
  const sources = ['PHARMADEPOT', 'AVERSI', 'PSP', 'ALL'];
  const meta = {};
  for (const source of sources) {
    const last = await prisma.syncRun.findFirst({
      where: { source, status: 'DONE' },
      orderBy: { finishedAt: 'desc' },
    });
    meta[source] = last
      ? { finishedAt: last.finishedAt, itemsFetched: last.itemsFetched }
      : null;
  }
  return meta;
}

export async function getCatalogStats() {
  const [products, offers, comparedProducts] = await Promise.all([
    prisma.catalogProduct.count(),
    prisma.pharmacyOffer.count(),
    prisma.catalogProduct.count({ where: { offerCount: { gte: 2 } } }),
  ]);

  const offersBySourceRows = await prisma.pharmacyOffer.groupBy({
    by: ['sourceId'],
    _count: { _all: true },
  });

  const offersBySource = Object.fromEntries(
    offersBySourceRows.map((row) => [row.sourceId, row._count._all]),
  );

  return { products, offers, comparedProducts, offersBySource };
}

async function getPharmacyInsights() {
  const [tripleCompare, inStockOffers, dealCandidates] = await Promise.all([
    prisma.catalogProduct.count({ where: { offerCount: { gte: 3 } } }),
    prisma.pharmacyOffer.count({ where: { inStock: true } }),
    prisma.catalogProduct.findMany({
      where: { offerCount: { gte: 2 } },
      select: {
        id: true,
        name: true,
        bestPriceGel: true,
        bestSourceId: true,
        offerCount: true,
        offers: { select: { priceGel: true, sourceId: true } },
        bestSource: { select: { nameKa: true } },
      },
      take: 180,
      orderBy: { updatedAt: 'desc' },
    }),
  ]);

  const topDeals = dealCandidates
    .map((product) => {
      const prices = product.offers.map((o) => o.priceGel).filter((p) => p > 0);
      if (prices.length < 2) return null;
      const min = Math.min(...prices);
      const max = Math.max(...prices);
      if (max <= min) return null;
      return {
        id: product.id,
        name: product.name,
        bestPriceGel: product.bestPriceGel ?? min,
        bestSource: product.bestSource?.nameKa ?? product.bestSourceId ?? '—',
        offerCount: product.offerCount,
        maxPriceGel: max,
        saveGel: Math.round((max - min) * 100) / 100,
        savePct: Math.round(((max - min) / max) * 100),
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.savePct - a.savePct || b.saveGel - a.saveGel)
    .slice(0, 6);

  return { tripleCompare, inStockOffers, topDeals };
}

export async function getPharmacyAdminStats() {
  const [catalog, syncMeta, running, recentFailures, insights] = await Promise.all([
    getCatalogStats(),
    getSyncMeta(),
    prisma.syncRun.findFirst({
      where: { status: 'RUNNING' },
      orderBy: { startedAt: 'desc' },
    }),
    prisma.syncRun.findMany({
      where: { status: 'FAILED' },
      orderBy: { startedAt: 'desc' },
      take: 5,
    }),
    getPharmacyInsights(),
  ]);

  const sourceStatus = {};
  for (const source of ['PHARMADEPOT', 'AVERSI', 'PSP']) {
    const last = await prisma.syncRun.findFirst({
      where: { source },
      orderBy: { startedAt: 'desc' },
    });
    sourceStatus[source] = last
      ? {
          status: last.status,
          itemsFetched: last.itemsFetched,
          error: last.error,
          startedAt: last.startedAt,
          finishedAt: last.finishedAt,
        }
      : null;
  }

  return { catalog, syncMeta, running, sourceStatus, recentFailures, insights };
}

export async function listSyncRuns({ limit = 50, offset = 0 } = {}) {
  const [runs, total] = await Promise.all([
    prisma.syncRun.findMany({
      orderBy: { startedAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.syncRun.count(),
  ]);
  return { runs, total };
}

export async function isSyncRunning() {
  const running = await prisma.syncRun.findFirst({ where: { status: 'RUNNING' } });
  return Boolean(running);
}
