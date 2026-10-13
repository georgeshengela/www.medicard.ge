import dns from 'node:dns';
import { prisma } from '../prisma.js';
import { ensureDrugCategories, ensurePharmacySources } from './categories.js';
import { upsertOfferFromListing } from './match.js';
import { rebuildCatalog } from './catalog.js';
import { enrichPspFacts } from './facts.js';
import { SOURCES, isOfferStale } from './constants.js';
import { fetchPharmadepotProducts, fetchGpcProducts } from './sources/pharmadepot.js';
import { fetchPspProducts, fetchPspAttributes, closePspBrowser } from './sources/psp.js';

// Render's outbound network occasionally fails to route IPv6 (AAAA) addresses,
// which Node/undici surfaces only as a generic "fetch failed" with no further
// detail. Preferring IPv4 avoids that class of failure for the pharmacy sources.
dns.setDefaultResultOrder('ipv4first');

const FETCHERS = {
  PHARMADEPOT: fetchPharmadepotProducts,
  PSP: fetchPspProducts,
  GPC: fetchGpcProducts,
};

const ALL_SOURCES = ['PSP', 'PHARMADEPOT', 'GPC'];

/**
 * A full crawl lists every product the pharmacy sells right now, so an offer it did not
 * re-confirm is no longer orderable there. Only trusted when the crawl looks complete
 * (≥ 60 % of what the source had in stock before), so a half-broken crawl never wipes stock.
 */
async function markUnlistedOutOfStock(source, runStartedAt, fetchedCount) {
  const inStockBefore = await prisma.pharmacyOffer.count({ where: { sourceId: source, inStock: true } });
  if (fetchedCount < 50 || fetchedCount < inStockBefore * 0.6) {
    if (inStockBefore) {
      console.warn(`[pharmacy-sync] ${source}: crawl looks partial (${fetchedCount} vs ${inStockBefore} in stock) — stock left unchanged`);
    }
    return 0;
  }
  const { count } = await prisma.pharmacyOffer.updateMany({
    where: { sourceId: source, inStock: true, syncedAt: { lt: runStartedAt } },
    data: { inStock: false },
  });
  return count;
}

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

/** A few listings at a time: each is one or two small queries, independent of the others. */
const INGEST_CONCURRENCY = Number(process.env.PHARMACY_INGEST_CONCURRENCY) || 4;

async function ingestListings(listings) {
  let skipped = 0;
  let created = 0;
  const skipSamples = [];

  const one = async (listing) => {
    try {
      const result = await upsertOfferFromListing(listing);
      if (result.created) created += 1;
    } catch (err) {
      skipped += 1;
      const msg = `${listing.sourceId}/${listing.sourceProductId}: ${err?.message || err}`;
      if (skipSamples.length < 5) skipSamples.push(msg);
      console.warn(`[pharmacy-sync] skip ${msg}`);
    }
  };
  for (let i = 0; i < listings.length; i += INGEST_CONCURRENCY) {
    await Promise.all(listings.slice(i, i + INGEST_CONCURRENCY).map(one));
  }
  return { count: listings.length - skipped, created, skipped, skipSamples };
}

/**
 * PSP's substance pairs, units and maker come from a slow query (~8 s per 100 products); they are read
 * once per product and kept in its facts. The first run reads the whole catalogue, later runs only
 * what is new.
 */
export async function enrichPspOffers() {
  const missing = await prisma.$queryRaw`
    SELECT id, "sourceProductId", facts FROM "PharmacyOffer"
    WHERE "sourceId" = 'PSP' AND facts IS NOT NULL AND facts->>'sku' IS NOT NULL
      AND (COALESCE(facts->>'enriched', 'false') <> 'true' OR COALESCE(facts->>'leaflet', '') <> '2')`;
  if (!missing.length) return 0;
  console.log(`[pharmacy-sync] PSP attributes for ${missing.length} products…`);
  // Saved a chunk at a time, so an interrupted first run continues where it stopped.
  let enriched = 0;
  for (let from = 0; from < missing.length; from += 360) {
    const chunk = missing.slice(from, from + 360);
    const attrs = await fetchPspAttributes(chunk.map((m) => m.facts.sku));
    const ready = chunk.filter((m) => attrs.has(String(m.sourceProductId)));
    for (let i = 0; i < ready.length; i += INGEST_CONCURRENCY) {
      await Promise.all(
        ready
          .slice(i, i + INGEST_CONCURRENCY)
          .map((m) => prisma.pharmacyOffer.update({ where: { id: m.id }, data: { facts: enrichPspFacts(m.facts, attrs.get(String(m.sourceProductId))) } })),
      );
    }
    enriched += ready.length;
    console.log(`[pharmacy-sync] PSP attributes ${Math.min(from + 360, missing.length)}/${missing.length}`);
  }
  return enriched;
}

export async function cleanupStaleRuns() {
  const cutoff = new Date(Date.now() - 3 * 60 * 60 * 1000);
  await prisma.syncRun.updateMany({
    where: { status: 'RUNNING', startedAt: { lt: cutoff } },
    data: { status: 'FAILED', error: 'Timed out (stale run)', finishedAt: new Date() },
  });
}

/** One pharmacy: fetch, store offers. `rebuild` (default) regroups the catalogue right after. */
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
        if (n % 500 === 0) console.log(`[pharmacy-sync] ${source} fetched ${n}…`);
      },
    });
    const result = await ingestListings(listings);
    result.markedOutOfStock = await markUnlistedOutOfStock(source, run.startedAt, result.count);
    if (source === 'PSP') result.enriched = await enrichPspOffers();
    if (opts.rebuild !== false) result.catalog = await rebuildCatalog();
    const status = result.skipped > 0 && result.count === 0 ? 'FAILED' : 'DONE';
    const error =
      result.skipped > 0
        ? result.count === 0
          ? result.skipSamples.join(' · ') || `${result.skipped} offer(s) skipped`
          : `${result.skipped} გამოტოვებული · ${result.skipSamples.slice(0, 2).join(' · ')}`
        : null;
    await finishSyncRun(run.id, { status, itemsFetched: result.count, error });
    console.log(
      `[pharmacy-sync] ${source} done — ${result.count} offers (${result.created} new)${result.skipped ? `, ${result.skipped} skipped` : ''}${result.markedOutOfStock ? `, ${result.markedOutOfStock} no longer listed` : ''}${result.enriched ? `, ${result.enriched} enriched` : ''}`,
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
    if (source === 'PSP') await closePspBrowser();
  }
}

export async function syncAllPharmacySources(opts = {}) {
  await cleanupStaleRuns();
  const run = await startSyncRun('ALL');
  const sources = opts.sources || ALL_SOURCES;
  let total = 0;
  const errors = [];

  await ensurePharmacySources();
  await ensureDrugCategories();

  for (const source of sources) {
    try {
      const r = await syncPharmacySource(source, { ...opts, rebuild: false });
      total += r.count;
    } catch (err) {
      errors.push(`${source}: ${err.message}`);
    }
  }

  // One regrouping after every pharmacy is in: the same box at PSP, Pharmadepot and GPC becomes one product.
  try {
    await rebuildCatalog();
  } catch (err) {
    errors.push(`catalog: ${err.message}`);
  }

  await finishSyncRun(run.id, {
    status: errors.length ? 'FAILED' : 'DONE',
    itemsFetched: total,
    error: errors.length ? errors.join('; ') : null,
  });

  return { total, errors };
}

export async function getSyncMeta() {
  const sources = [...ALL_SOURCES, 'ALL'];
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
  const live = { mergedIntoId: null, offerCount: { gt: 0 } };
  const [products, offers, comparedProducts, bothChains] = await Promise.all([
    prisma.catalogProduct.count({ where: live }),
    prisma.pharmacyOffer.count(),
    prisma.catalogProduct.count({ where: { ...live, offerCount: { gte: 2 } } }),
    prisma.catalogProduct.count({ where: { ...live, chainCount: { gte: 2 } } }),
  ]);

  const offersBySourceRows = await prisma.pharmacyOffer.groupBy({
    by: ['sourceId'],
    _count: { _all: true },
  });

  const offersBySource = Object.fromEntries(
    offersBySourceRows.map((row) => [row.sourceId, row._count._all]),
  );

  return { products, offers, comparedProducts, bothChains, offersBySource };
}

async function getPharmacyInsights() {
  const [tripleCompare, inStockOffers, dealCandidates] = await Promise.all([
    prisma.catalogProduct.count({ where: { mergedIntoId: null, offerCount: { gte: 3 } } }),
    prisma.pharmacyOffer.count({ where: { inStock: true } }),
    prisma.catalogProduct.findMany({
      where: { mergedIntoId: null, chainCount: { gte: 2 } },
      select: {
        id: true,
        name: true,
        bestPriceGel: true,
        bestSourceId: true,
        offerCount: true,
        offers: { select: { priceGel: true, sourceId: true, inStock: true, syncedAt: true } },
        bestSource: { select: { nameKa: true } },
      },
      take: 400,
      orderBy: { updatedAt: 'desc' },
    }),
  ]);

  const topDeals = dealCandidates
    .map((product) => {
      // Same rule as the app: only confirmed, in-stock offers of active pharmacies compare.
      const live = product.offers.filter(
        (o) => o.priceGel > 0 && o.inStock && SOURCES[o.sourceId] && !isOfferStale(o.syncedAt),
      );
      if (new Set(live.map((o) => o.sourceId)).size < 2) return null;
      const cheapest = live.reduce((a, b) => (b.priceGel < a.priceGel ? b : a));
      const min = cheapest.priceGel;
      const max = Math.max(...live.map((o) => o.priceGel));
      if (max <= min) return null;
      return {
        id: product.id,
        name: product.name,
        bestPriceGel: min,
        bestSource: SOURCES[cheapest.sourceId]?.nameKa ?? cheapest.sourceId,
        offerCount: new Set(live.map((o) => o.sourceId)).size,
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
  for (const source of ALL_SOURCES) {
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
