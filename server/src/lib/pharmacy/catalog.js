import { randomUUID } from 'node:crypto';
import { prisma } from '../prisma.js';
import { cpuSlicer } from '../cpuSlice.js';
import { FORM_LABELS, countryNameKa, identityOf, phon, splitBilingualName, transliterateKa, hasGeorgian } from './facts.js';
import { chainOf, clusterOffers } from './cluster.js';
import { categorySlugFor, ensureDrugCategories } from './categories.js';
import { isOfferStale } from './constants.js';
import { pricingFromOffers } from './pricing.js';
import { provisionalSlug, recordPrice } from './match.js';

/**
 * The catalogue rebuild that follows every sync: every offer of every pharmacy is grouped by what the
 * box is (cluster.js), and each group becomes one product row holding one offer per pharmacy.
 *
 * Product ids are kept: a group keeps the product most of its offers were on, preferring one a
 * medicine in someone's MEDIPILL points at. A product left without offers points to the product its
 * offers went to (`mergedIntoId`), so old links, MEDIPILL medicines and price alerts keep working.
 * A pharmacy listing the same box twice keeps its better listing on the product; the other one sits
 * on a hidden twin product pointing at it.
 */

const OFFER_FIELDS = {
  id: true,
  catalogProductId: true,
  sourceId: true,
  sourceProductId: true,
  sourceUrl: true,
  rawName: true,
  priceGel: true,
  oldPriceGel: true,
  discountPercent: true,
  inStock: true,
  imageUrl: true,
  syncedAt: true,
  facts: true,
};

/** Fresh and in stock first, then in stock, then cheaper — the listing a person should be sent to. */
function offerRank(o) {
  return (o.inStock ? 2 : 0) + (isOfferStale(o.syncedAt) ? 0 : 1);
}
function betterOffer(a, b) {
  const ra = offerRank(a);
  const rb = offerRank(b);
  if (ra !== rb) return ra > rb ? a : b;
  if (a.priceGel !== b.priceGel) return a.priceGel < b.priceGel ? a : b;
  return a.id < b.id ? a : b;
}

const mostCommon = (values) => {
  const counts = new Map();
  for (const v of values) if (v != null && v !== '') counts.set(v, (counts.get(v) || 0) + 1);
  let best = null;
  let n = 0;
  for (const [v, c] of counts) if (c > n) [best, n] = [v, c];
  return best;
};

/** A few row writes at a time (one small query each). */
const WRITE_CONCURRENCY = Number(process.env.PHARMACY_INGEST_CONCURRENCY) || 4;
async function inBatches(items, fn) {
  for (let i = 0; i < items.length; i += WRITE_CONCURRENCY) await Promise.all(items.slice(i, i + WRITE_CONCURRENCY).map(fn));
}

const titleCase = (s) => (s ? s.replace(/(^|[\s+(-])([a-z])/g, (_, a, b) => a + b.toUpperCase()) : s);

/** The words someone may type: every pharmacy's name, the substance in both alphabets, Latin spellings. */
export function buildSearchText({ names, innLatin, innKa, manufacturer, manufacturerLatin, latinName }) {
  const parts = new Set();
  for (const n of names) {
    const lower = String(n || '').toLowerCase();
    if (!lower) continue;
    parts.add(lower);
    // „nurofen“ finds „ნუროფენი“: Georgian names also in Latin letters, and every word's spelling key.
    if (hasGeorgian(lower)) parts.add(transliterateKa(lower));
    for (const w of lower.split(/[\s\-–,()/.]+/)) {
      const p = phon(w);
      if (p.length >= 3) parts.add(p);
    }
  }
  for (const v of [innLatin, innKa, manufacturer, manufacturerLatin, latinName]) {
    if (!v) continue;
    const lower = String(v).toLowerCase();
    parts.add(lower);
    for (const w of lower.split(/[\s\-–,()/.+]+/)) {
      const p = phon(w);
      if (p.length >= 3) parts.add(p);
    }
  }
  return [...parts].join(' | ').slice(0, 4000);
}

/** The product row's fields from its offers (Pharmadepot/GPC first: their data is generated, PSP's typed). */
export function deriveProduct(offers, identities, { categoryIdBySlug } = {}) {
  const gepha = offers.filter((o) => chainOf(o.sourceId) === 'GEPHA');
  const psp = offers.filter((o) => o.sourceId === 'PSP');
  const idOf = (o) => identities.get(o.id);
  const first = gepha[0] || offers[0];
  const firstId = idOf(first);

  // Name: Pharmadepot/GPC write one tidy form („ნუროფენი ტაბლეტი 200მგ #10“); PSP adds the Latin brand.
  const name = (gepha[0]?.rawName || psp[0]?.rawName || first.rawName).replace(/\s+/g, ' ').trim();
  // The Latin brand only („Nurofen Express Forte“), not the dose and Georgian words PSP writes after it.
  const latinBrand = (text) => {
    const words = [];
    for (const w of String(text || '').trim().split(/\s+/)) {
      if (!w || hasGeorgian(w) || /\d/.test(w)) break;
      words.push(w);
    }
    return words.join(' ').replace(/[\s.,-]+$/, '');
  };
  const latinName = psp.map((o) => latinBrand(splitBilingualName(o.rawName).latin)).find((l) => /[a-z]{2}/i.test(l)) || null;

  const facts = offers.map((o) => o.facts || {});
  const innLatinList = offers.map((o) => idOf(o)?.innLatin).find((l) => l?.length) || null;
  const innKaList = offers.map((o) => idOf(o)?.innKa).find((l) => l?.length) || null;
  const innKey = mostCommon(offers.map((o) => idOf(o)?.inn));
  const formGroup = firstId?.formGroup || mostCommon(offers.map((o) => idOf(o)?.formGroup));
  const doseKey = firstId?.doses?.[0] || mostCommon(offers.map((o) => idOf(o)?.doses?.[0]));
  const doseText = (gepha.map((o) => o.facts?.dose).find(Boolean) || offers.map((o) => idOf(o)?.doseText).find(Boolean) || null)?.trim() || null;
  const unitCount = firstId?.count || mostCommon(offers.map((o) => idOf(o)?.count)) || null;
  const volumeKey = firstId?.volume || mostCommon(offers.map((o) => idOf(o)?.volume));
  const countryIso = mostCommon(gepha.map((o) => o.facts?.country)) || mostCommon(facts.map((f) => f.country));
  const manufacturer = gepha.map((o) => o.facts?.manufacturer).find(Boolean) || null;
  const manufacturerLatin = psp.map((o) => o.facts?.manufacturer).find(Boolean) || null;
  const rxKnown = facts.map((f) => f.rx).filter((v) => typeof v === 'boolean');
  const rx = rxKnown.length ? rxKnown.includes(true) : null;
  const kind = offers.every((o) => idOf(o)?.kind === 'other') ? 'other' : 'medicine';
  const imageUrl = gepha.map((o) => o.imageUrl).find(Boolean) || offers.map((o) => o.imageUrl).find(Boolean) || null;
  const brandKey = firstId?.brands?.[0] || null;
  const categorySlug = categorySlugFor({ facts, formGroup, kind });

  const innLatin = innLatinList ? innLatinList.map((s) => s.trim()).join(' + ') : null;
  const innKa = innKaList ? innKaList.map((s) => s.trim()).join(' + ') : null;
  return {
    name,
    latinName,
    imageUrl,
    manufacturer: manufacturer || manufacturerLatin,
    manufacturerLatin,
    country: countryNameKa(countryIso),
    countryIso,
    form: formGroup ? FORM_LABELS[formGroup]?.[0] ?? null : null,
    formGroup,
    strength: doseText,
    doseKey,
    packSize: unitCount ? String(unitCount) : null,
    unitCount,
    volumeKey,
    inn: innLatin ? titleCase(innLatin.toLowerCase()) : null,
    innKa,
    innKey,
    rx,
    kind,
    brandKey,
    categorySlug,
    categoryId: categorySlug ? categoryIdBySlug?.get(categorySlug) ?? null : null,
    searchText: buildSearchText({ names: offers.map((o) => o.rawName), innLatin, innKa, manufacturer, manufacturerLatin, latinName }),
  };
}

/** Rebuild the product rows from the current offers. Returns counts for the sync log; `dryRun` only plans. */
export async function rebuildCatalog({ log = console.log, dryRun = false } = {}) {
  const startedAt = Date.now();
  const slicer = cpuSlicer();
  // A dry run writes nothing, not even the category list.
  const categoryIdBySlug = dryRun
    ? new Map((await prisma.drugCategory.findMany({ select: { id: true, slug: true } })).map((c) => [c.slug, c.id]))
    : await ensureDrugCategories();

  const offers = await prisma.pharmacyOffer.findMany({ select: OFFER_FIELDS });
  const identities = new Map();
  for (const o of offers) {
    if (slicer.due()) await slicer.pause();
    identities.set(o.id, identityOf(o.rawName, o.facts || {}, o.sourceId));
  }
  const clusters = clusterOffers(offers.map((o) => ({ key: o.id, sourceId: o.sourceId, identity: identities.get(o.id) })));
  if (slicer.due()) await slicer.pause();

  const offerById = new Map(offers.map((o) => [o.id, o]));
  const products = await prisma.catalogProduct.findMany({
    select: { id: true, mergedIntoId: true, bestPriceGel: true, offerCount: true, createdAt: true, normalizedKey: true },
  });
  const productById = new Map(products.map((p) => [p.id, p]));
  const referenced = new Set(
    (
      await prisma.$queryRaw`SELECT DISTINCT config->>'catalogProductId' AS id FROM "MedicationSchedule" WHERE config->>'catalogProductId' IS NOT NULL`
    ).map((r) => r.id),
  );

  // 1. Each group picks its product: referenced by a medicine first, then the one most of its offers
  //    were on, then the oldest. Bigger groups choose first; a product serves one group only.
  const taken = new Set();
  const plan = [];
  for (const keys of [...clusters].sort((a, b) => b.length - a.length)) {
    const groupOffers = keys.map((k) => offerById.get(k));
    const votes = new Map();
    for (const o of groupOffers) votes.set(o.catalogProductId, (votes.get(o.catalogProductId) || 0) + 1);
    const candidates = [...votes.keys()]
      .filter((id) => productById.has(id) && !taken.has(id))
      .sort((a, b) => {
        const ra = referenced.has(a) ? 1 : 0;
        const rb = referenced.has(b) ? 1 : 0;
        if (ra !== rb) return rb - ra;
        if (votes.get(a) !== votes.get(b)) return votes.get(b) - votes.get(a);
        return productById.get(a).createdAt - productById.get(b).createdAt;
      });
    const productId = candidates[0] ?? null;
    if (productId) taken.add(productId);
    const primary = new Map();
    for (const o of groupOffers) primary.set(o.sourceId, primary.has(o.sourceId) ? betterOffer(primary.get(o.sourceId), o) : o);
    plan.push({ productId, primary: [...primary.values()], extras: groupOffers.filter((o) => primary.get(o.sourceId) !== o), twins: [] });
  }

  // 2. New products for groups that found none, hidden twins for second listings of the same box.
  const creates = [];
  const newProduct = (offer, mergedIntoId = null) => {
    const id = randomUUID();
    creates.push({
      id,
      slug: `${provisionalSlug(offer.rawName, offer.sourceId, offer.sourceProductId)}-${id.slice(0, 6)}`,
      name: offer.rawName,
      normalizedKey: `offer:${offer.sourceId}:${offer.sourceProductId}`,
      mergedIntoId,
      offerCount: 0,
    });
    return id;
  };
  const target = new Map();
  for (const p of plan) {
    if (!p.productId) p.productId = newProduct(p.primary[0]);
    for (const o of p.primary) target.set(o.id, p.productId);
  }
  for (const p of plan) {
    for (const o of p.extras) {
      const own = o.catalogProductId;
      const twin = own && productById.has(own) && !taken.has(own) ? own : newProduct(o, p.productId);
      taken.add(twin);
      p.twins.push(twin);
      target.set(o.id, twin);
    }
  }

  // 3. What changes: offers whose product changed, and every product row's new fields and prices.
  const moves = offers.filter((o) => target.get(o.id) !== o.catalogProductId);
  const touched = new Set();
  for (const o of moves) {
    touched.add(o.catalogProductId);
    touched.add(target.get(o.id));
  }

  // A substance's usual category covers products no pharmacy categorised.
  const derivedByProduct = new Map();
  const innVotes = new Map();
  for (const p of plan) {
    if (slicer.due()) await slicer.pause();
    const ordered = [...p.primary].sort((a, b) => (chainOf(b.sourceId) === 'GEPHA') - (chainOf(a.sourceId) === 'GEPHA'));
    const derived = deriveProduct(ordered, identities, { categoryIdBySlug });
    derivedByProduct.set(p.productId, { derived, offers: p.primary });
    if (derived.innKey && derived.categorySlug) {
      const votes = innVotes.get(derived.innKey) || new Map();
      votes.set(derived.categorySlug, (votes.get(derived.categorySlug) || 0) + 1);
      innVotes.set(derived.innKey, votes);
    }
  }
  const innCategory = new Map([...innVotes].map(([k, votes]) => [k, [...votes].sort((a, b) => b[1] - a[1])[0][0]]));
  for (const entry of derivedByProduct.values()) {
    const { derived } = entry;
    if (!derived.categorySlug && derived.innKey && innCategory.has(derived.innKey)) {
      derived.categorySlug = innCategory.get(derived.innKey);
      derived.categoryId = categoryIdBySlug.get(derived.categorySlug) ?? null;
    }
  }

  // Twins point to their product; products nobody's offers are on any more point to where those went.
  const pointer = new Map();
  for (const p of plan) for (const twin of p.twins) pointer.set(twin, p.productId);
  for (const o of offers) {
    const now = target.get(o.id);
    if (o.catalogProductId === now || pointer.has(o.catalogProductId)) continue;
    pointer.set(o.catalogProductId, pointer.get(now) || now);
  }
  const live = (id) => {
    let cur = id;
    for (let hop = 0; cur && hop < 6; hop += 1) {
      if (derivedByProduct.has(cur)) return cur;
      cur = pointer.get(cur) || productById.get(cur)?.mergedIntoId || null;
    }
    return null;
  };
  const retire = [];
  for (const product of products) {
    if (derivedByProduct.has(product.id)) continue;
    const mergedIntoId = live(pointer.get(product.id) || product.mergedIntoId) ?? null;
    if (product.mergedIntoId === mergedIntoId && product.offerCount === 0 && product.bestPriceGel == null) continue;
    retire.push({ id: product.id, mergedIntoId });
  }

  const summary = {
    offers: offers.length,
    products: derivedByProduct.size,
    compared: [...derivedByProduct.values()].filter((d) => new Set(d.offers.map((o) => chainOf(o.sourceId))).size > 1).length,
    moved: moves.length,
    created: creates.length,
    retired: retire.length,
  };
  if (dryRun) return { ...summary, dryRun: true, derivedByProduct, plan, retire, ms: Date.now() - startedAt };

  // 4. Write. One offer per pharmacy per product is a unique index, so offers cannot move one at a
  //    time: every moving offer is deleted and re-inserted (same id) in one transaction.
  if (creates.length) await prisma.catalogProduct.createMany({ data: creates });
  if (moves.length) {
    await prisma.$transaction(
      async (tx) => {
        for (let i = 0; i < moves.length; i += 1000) {
          await tx.pharmacyOffer.deleteMany({ where: { id: { in: moves.slice(i, i + 1000).map((o) => o.id) } } });
        }
        for (let i = 0; i < moves.length; i += 1000) {
          await tx.pharmacyOffer.createMany({
            data: moves.slice(i, i + 1000).map((o) => ({ ...o, facts: o.facts ?? undefined, catalogProductId: target.get(o.id) })),
          });
        }
      },
      { timeout: 300000, maxWait: 30000 },
    );
  }

  await inBatches([...derivedByProduct], async ([productId, { derived, offers: own }]) => {
    const inStock = own.filter((o) => o.inStock);
    const pricing = pricingFromOffers(inStock);
    // Every offer unconfirmed for days: keep the last known price (shown as unconfirmed).
    const allStale = inStock.length > 0 && inStock.every((o) => isOfferStale(o.syncedAt));
    const priceData = { offerCount: pricing.offerCount, chainCount: pricing.chainCount, savingsPercent: pricing.savingsPercent };
    if (!allStale) Object.assign(priceData, { bestPriceGel: pricing.bestPriceGel, bestSourceId: pricing.bestSourceId });
    const { categorySlug: _slug, ...fields } = derived;
    void _slug;
    await prisma.catalogProduct.update({
      where: { id: productId },
      data: {
        ...fields,
        normalizedKey: [derived.brandKey || 'x', derived.doseKey || '', derived.unitCount || '', derived.volumeKey || ''].join('|'),
        mergedIntoId: null,
        lastSyncedAt: new Date(),
        ...priceData,
      },
    });
    // Price history and drop alerts only for a real price change: a group that just gained another
    // pharmacy's cheaper offer is not „cheaper than yesterday“.
    const before = productById.get(productId);
    if (!allStale && !touched.has(productId) && before && before.bestPriceGel !== pricing.bestPriceGel) {
      await recordPrice(productId, before.bestPriceGel ?? null, pricing);
    }
  });

  await inBatches(retire, (r) =>
    prisma.catalogProduct.update({
      where: { id: r.id },
      data: { mergedIntoId: r.mergedIntoId, offerCount: 0, chainCount: 0, savingsPercent: null, bestPriceGel: null, bestSourceId: null },
    }),
  );
  // Provisional products of brand-new listings that joined an existing product are not needed.
  const dropped = await prisma.catalogProduct.deleteMany({
    where: { normalizedKey: { startsWith: 'new:' }, offers: { none: {} }, id: { notIn: [...referenced].filter(Boolean) } },
  });

  const done = { ...summary, dropped: dropped.count, ms: Date.now() - startedAt };
  log(`[pharmacy-catalog] ${JSON.stringify(done)}`);
  return done;
}
