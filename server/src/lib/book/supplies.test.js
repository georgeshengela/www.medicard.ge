import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { daysLeft, suggestOrder, normalizeNorms } from './supplies.js';

describe('MEDIBOOK stock room', () => {
  it('days left follow the last 30 days\' pace', () => {
    assert.equal(daysLeft({ stock: 20, use30: 30 }), 20);
    assert.equal(daysLeft({ stock: 5, use30: 60 }), 2);
    assert.equal(daysLeft({ stock: -3, use30: 10 }), 0);
    assert.equal(daysLeft({ stock: 20, use30: 0 }), null);
    assert.equal(daysLeft({ stock: null, use30: 10 }), null);
  });

  it('the order suggestion covers two weeks at pace and never less than three low marks', () => {
    assert.equal(suggestOrder({ stock: 2, lowStock: 5, use30: 0 }), 13);
    assert.equal(suggestOrder({ stock: 2, lowStock: 5, use30: 60 }), 26);
    assert.equal(suggestOrder({ stock: 40, lowStock: 5, use30: 60 }), 0);
    assert.equal(suggestOrder({ stock: null, lowStock: 0, use30: 0 }), 0);
  });

  it('norms keep positive quantities only and merge duplicates', () => {
    assert.deepEqual(normalizeNorms([{ productId: 'a', qty: '1.5' }, { productId: 'a', qty: 0.5 }, { productId: 'b', qty: 0 }, { productId: '', qty: 3 }, { productId: 'c', qty: 'x' }]), [{ productId: 'a', qty: 2 }]);
    assert.deepEqual(normalizeNorms(undefined), []);
  });
});
