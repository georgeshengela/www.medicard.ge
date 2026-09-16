import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { consumerPurchasesEnabled } from './consumerPurchases.js';

describe('consumerPurchasesEnabled', () => {
  it('is off unless explicitly enabled', () => {
    assert.equal(consumerPurchasesEnabled({}), false);
    assert.equal(consumerPurchasesEnabled({ CONSUMER_PURCHASES_ENABLED: '' }), false);
    assert.equal(consumerPurchasesEnabled({ CONSUMER_PURCHASES_ENABLED: 'false' }), false);
  });

  it('turns on only for an explicit truthy flag', () => {
    assert.equal(consumerPurchasesEnabled({ CONSUMER_PURCHASES_ENABLED: 'true' }), true);
    assert.equal(consumerPurchasesEnabled({ CONSUMER_PURCHASES_ENABLED: '1' }), true);
  });
});
