import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { consumerPurchasesEnabledFromStatus } from './consumerPurchases.js';

describe('consumerPurchasesEnabledFromStatus', () => {
  it('treats a missing production field as off', () => {
    assert.equal(consumerPurchasesEnabledFromStatus(undefined), false);
    assert.equal(consumerPurchasesEnabledFromStatus({ settings: {} }), false);
    assert.equal(consumerPurchasesEnabledFromStatus({ settings: { consumerPurchasesEnabled: false } }), false);
  });

  it('enables purchase CTAs only when the server says so', () => {
    assert.equal(
      consumerPurchasesEnabledFromStatus({ settings: { consumerPurchasesEnabled: true } }),
      true,
    );
  });
});
