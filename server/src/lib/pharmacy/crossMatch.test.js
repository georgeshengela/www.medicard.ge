import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSourcePricesFromOffers, pricingFromOffers } from './crossMatch.js';

const now = new Date();
const old = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

const offers = [
  { sourceId: 'PSP', priceGel: 26.33, inStock: true, syncedAt: now },
  { sourceId: 'PHARMADEPOT', priceGel: 41.22, inStock: true, syncedAt: now },
  { sourceId: 'GPC', priceGel: 41.22, inStock: true, syncedAt: now },
  // Aversi has not been re-confirmed for a month and was cheaper back then.
  { sourceId: 'AVERSI', priceGel: 20.0, inStock: true, syncedAt: old },
];

test('a stale offer is never the best price and never counts towards savings', () => {
  const pricing = pricingFromOffers(offers);
  assert.equal(pricing.bestPriceGel, 26.33);
  assert.equal(pricing.bestSourceId, 'PSP');
  assert.equal(pricing.offerCount, 3);

  const rows = buildSourcePricesFromOffers(offers, pricing.bestSourceId);
  const aversi = rows.find((r) => r.sourceId === 'AVERSI');
  assert.equal(aversi.stale, true);
  assert.equal(aversi.isBest, false);
  assert.equal(aversi.priceDiffGel, null);
  assert.equal(rows.find((r) => r.sourceId === 'PSP').isBest, true);
  assert.equal(rows.find((r) => r.sourceId === 'GPC').priceDiffGel, 14.89);
});

test('an out-of-stock offer is shown but not compared', () => {
  const pricing = pricingFromOffers([
    { sourceId: 'PSP', priceGel: 10, inStock: false, syncedAt: now },
    { sourceId: 'GPC', priceGel: 12, inStock: true, syncedAt: now },
  ]);
  assert.equal(pricing.bestSourceId, 'GPC');
  assert.equal(pricing.savingsPercent, null);
});

test('source rows follow the display order and include every pharmacy', () => {
  const rows = buildSourcePricesFromOffers(offers, 'PSP');
  assert.deepEqual(
    rows.map((r) => r.sourceId),
    ['PSP', 'PHARMADEPOT', 'GPC', 'AVERSI'],
  );
  assert.ok(rows.every((r) => 'syncedAt' in r));
});
