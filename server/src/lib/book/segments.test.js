import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { profileFor, normalizeModules, effectiveModules, kitFor, kitProblems, MODULE_KEYS } from './segments.js';
import { mergeSettings, normalizeSettings } from './catalog.js';

describe('MEDIBOOK segment profiles', () => {
  it('every kit is consistent: norms and needs point at names the kit defines, every module has a default', () => {
    assert.deepEqual(kitProblems(), []);
  });

  it('the profile follows the category and falls back to OTHER', () => {
    assert.equal(profileFor('DENTAL').vocab.client[0], 'პაციენტი');
    assert.equal(profileFor('FITNESS').vocab.clients[1], 'Members');
    assert.equal(profileFor('HAIR').modules.resources, false);
    assert.equal(profileFor('nonsense').category, 'OTHER');
    assert.ok(kitFor('TATTOO').services.length >= 8);
    assert.ok(kitFor('DENTAL').supplies.some((s) => s.name === 'ხელთათმანი'));
  });

  it('module overrides are sparse booleans laid over the category defaults', () => {
    assert.deepEqual(normalizeModules({ products: true, payroll: 'yes', foo: true }), { products: true });
    const m = effectiveModules({ modules: { resources: true, loyalty: false } }, 'HAIR');
    assert.equal(m.resources, true);
    assert.equal(m.loyalty, false);
    assert.equal(m.products, true);
    assert.deepEqual(Object.keys(m), [...MODULE_KEYS]);
  });

  it('a partial settings patch keeps the other settings (the cashback save no longer resets the booking rules)', () => {
    const before = normalizeSettings({ slotMinutes: 15, leadMinutes: 120, autoConfirm: false, notify: { sms: { enabled: true, monthlyCap: 500 } }, modules: { products: false } });
    const after = mergeSettings(before, { loyalty: { cashbackPercent: 5 } });
    assert.equal(after.slotMinutes, 15);
    assert.equal(after.leadMinutes, 120);
    assert.equal(after.autoConfirm, false);
    assert.equal(after.notify.sms.enabled, true);
    assert.equal(after.notify.sms.monthlyCap, 500);
    assert.equal(after.loyalty.cashbackPercent, 5);
    assert.deepEqual(after.modules, { products: false });
    const flipped = mergeSettings(after, { modules: { products: true } });
    assert.deepEqual(flipped.modules, { products: true });
    assert.equal(flipped.loyalty.cashbackPercent, 5);
  });
});
