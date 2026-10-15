import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeParts, generateGiftCode, membershipCovers, normalizeGiftCode } from './loyalty.js';
import { normalizeLoyalty } from './catalog.js';

const loyalty = normalizeLoyalty({ cashbackPercent: 10, welcomeBonus: 5, maxRedeemPercent: 50 });

describe('MEDIBOOK loyalty', () => {
  it('gift codes are readable and normalise back to the same shape', () => {
    const code = generateGiftCode(() => 0.5);
    assert.match(code, /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
    assert.equal(normalizeGiftCode(' ab12-cd34 '), 'AB12-CD34');
    assert.equal(normalizeGiftCode('ab12cd34'), 'AB12-CD34');
  });

  it('a membership covers a visit only when every service is inside it (empty = everything)', () => {
    assert.equal(membershipCovers({ serviceIds: [] }, ['a']), true);
    assert.equal(membershipCovers({ serviceIds: ['a', 'b'] }, ['a']), true);
    assert.equal(membershipCovers({ serviceIds: ['a'] }, ['a', 'b']), false);
    assert.equal(membershipCovers({ serviceIds: ['a'] }, []), false);
  });

  it('splits a price: membership, gift card, bonus (capped), then money; cashback on the money part', () => {
    const plain = computeParts({ price: 100, loyalty });
    assert.deepEqual([plain.cashAmount, plain.bonusEarned, plain.welcomeBonus], [100, 10, 0]);
    const first = computeParts({ price: 100, loyalty, firstVisit: true });
    assert.equal(first.welcomeBonus, 5);
    const withGift = computeParts({ price: 100, loyalty, gift: { balance: 30 } });
    assert.deepEqual([withGift.giftAmount, withGift.cashAmount, withGift.bonusEarned], [30, 70, 7]);
    const withBonus = computeParts({ price: 100, loyalty, bonusBalance: 80, bonusRequested: 80 });
    assert.deepEqual([withBonus.bonusAmount, withBonus.cashAmount], [50, 50]);
    const smallBonus = computeParts({ price: 100, loyalty, bonusBalance: 12.5, bonusRequested: 100 });
    assert.deepEqual([smallBonus.bonusAmount, smallBonus.cashAmount], [12.5, 87.5]);
    const visits = computeParts({ price: 100, loyalty, membership: { kind: 'VISITS', visitsLeft: 3 }, gift: { balance: 30 }, bonusBalance: 20, bonusRequested: 20 });
    assert.deepEqual([visits.membershipAmount, visits.membershipVisits, visits.giftAmount, visits.bonusAmount, visits.cashAmount, visits.bonusEarned], [100, 1, 0, 0, 0, 0]);
    const amount = computeParts({ price: 100, loyalty, membership: { kind: 'AMOUNT', amountLeft: 40 }, gift: { balance: 30 }, bonusBalance: 20, bonusRequested: 20 });
    assert.deepEqual([amount.membershipAmount, amount.giftAmount, amount.bonusAmount, amount.cashAmount, amount.bonusEarned], [40, 30, 20, 10, 1]);
    const empty = computeParts({ price: 100, loyalty, membership: { kind: 'VISITS', visitsLeft: 0 } });
    assert.equal(empty.membershipAmount, 0);
  });

  it('loyalty settings default to off and clamp to the offered choices', () => {
    const d = normalizeLoyalty(undefined);
    assert.deepEqual(d, { cashbackPercent: 0, welcomeBonus: 0, maxRedeemPercent: 50 });
    assert.equal(normalizeLoyalty({ cashbackPercent: 7 }).cashbackPercent, 7);
    assert.equal(normalizeLoyalty({ cashbackPercent: 8 }).cashbackPercent, 0);
    assert.equal(normalizeLoyalty({ maxRedeemPercent: 100 }).maxRedeemPercent, 100);
  });
});
