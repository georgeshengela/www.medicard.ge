import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { decideOwnedChild } from './petsHealth.js';
import {
  mergeProductUpdate,
  normalizeEventInput,
  normalizeProductInput,
  normalizeScheduleInput,
  publicEvent,
  publicProduct,
} from './petsCare.js';

const TODAY = '2026-09-14';

describe('pet care validation', () => {
  it('requires an explicit dose unit with a dose', () => {
    assert.throws(() =>
      normalizeScheduleInput({
        kind: 'MEDICATION',
        title: 'ტაბლეტი',
        startOn: '2026-09-14',
        recurrenceKind: 'ONCE',
        dose: '1',
        source: 'USER_ENTERED',
      }),
    );
    const ok = normalizeScheduleInput({
      kind: 'MEDICATION',
      title: 'ტაბლეტი',
      startOn: '2026-09-14',
      recurrenceKind: 'ONCE',
      dose: '1',
      doseUnit: 'ტაბლეტი',
      route: 'oral',
      source: 'VETERINARIAN',
    });
    assert.equal(ok.doseUnit, 'ტაბლეტი');
    assert.equal(ok.reminderEnabled, false);
  });

  it('keeps product expiry off the event snapshot contract', () => {
    const product = normalizeProductInput(
      { kind: 'FLEA_TICK', name: 'ბრუვექტო', expiresOn: '2027-01-01' },
      { todayYmd: TODAY },
    );
    assert.equal(product.expiresOn, '2027-01-01');
    const event = publicEvent({
      id: 'e1',
      petId: 'p',
      kind: 'FLEA_TICK',
      productId: 'prod',
      titleSnapshot: 'ბრუვექტო',
      productNameSnapshot: 'ბრუვექტო',
      administeredOn: '2026-08-01',
      status: 'RECORDED',
      source: 'app',
      createdAt: new Date('2026-09-01T00:00:00.000Z'),
      updatedAt: new Date('2026-09-01T00:00:00.000Z'),
    });
    assert.equal(event.titleSnapshot, 'ბრუვექტო');
    assert.equal('expiresOn' in event, false);
  });

  it('preserves event snapshots when the product name later changes', () => {
    const product = publicProduct({
      id: 'prod',
      petId: 'p',
      kind: 'FLEA_TICK',
      name: 'ახალი სახელი',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const renamed = mergeProductUpdate(
      { kind: 'FLEA_TICK', name: 'ბრუვექტო', formulation: null, batchId: null, notes: null, expiresOn: null },
      { name: 'ახალი სახელი' },
      TODAY,
    );
    assert.equal(renamed.name, 'ახალი სახელი');
    const event = publicEvent({
      id: 'e1',
      petId: 'p',
      kind: 'FLEA_TICK',
      productId: product.id,
      titleSnapshot: 'ბრუვექტო',
      productNameSnapshot: 'ბრუვექტო',
      administeredOn: '2026-08-01',
      status: 'RECORDED',
      source: 'app',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    assert.equal(event.productNameSnapshot, 'ბრუვექტო');
    assert.notEqual(event.productNameSnapshot, renamed.name);
  });

  it('rejects a future administration date', () => {
    assert.throws(() =>
      normalizeEventInput(
        { kind: 'VACCINATION', title: 'აცრა', administeredOn: '2026-09-20' },
        { todayYmd: TODAY },
      ),
    );
  });
});

describe('pet care ownership', () => {
  it('404s a child id on a different pet URL, including same owner', () => {
    const child = { id: 's1', userId: 'owner', petId: 'pet-a' };
    assert.equal(decideOwnedChild(child, 'pet-b', 'owner').status, 404);
    assert.equal(decideOwnedChild(child, 'pet-a', 'other').status, 404);
    assert.equal(decideOwnedChild(child, 'pet-a', 'owner').status, 200);
  });
});
