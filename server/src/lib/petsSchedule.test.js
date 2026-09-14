import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  carePayloadHash,
  completePayloadHash,
  enumerateSeries,
  generateOccurrences,
  idempotencyDecision,
  isGeneratedOccurrence,
  nextAfterCompletion,
  nextAfterVoidingAdministration,
  occurrenceKey,
  parseOccurrenceKey,
  phase5ReminderIdentity,
} from './petsSchedule.js';
import { normalizeScheduleInput } from './petsCare.js';
import { isPetsCareSchemaMissing, isPetsHealthSchemaMissing, isPetsSchemaMissing } from './petsOwnership.js';

function schedule(overrides = {}) {
  return {
    id: 'sched-1',
    userId: 'user-1',
    petId: 'pet-1',
    revision: 1,
    status: 'ACTIVE',
    startOn: '2026-01-31',
    dueTime: '09:00',
    times: null,
    recurrenceKind: 'EVERY_N_MONTHS',
    intervalCount: 1,
    recurrenceBasis: 'FIXED_CALENDAR',
    anchorDay: 31,
    courseEndsOn: null,
    occurrenceLimit: null,
    nextDueOn: '2026-01-31',
    nextDueTime: '09:00',
    nextSequence: 0,
    ...overrides,
  };
}

describe('occurrence identity', () => {
  it('distinguishes schedule revision, civil date, time, and sequence', () => {
    const morning = occurrenceKey({ revision: 1, plannedOn: '2026-09-14', plannedTime: '08:00', sequence: 0 });
    const evening = occurrenceKey({ revision: 1, plannedOn: '2026-09-14', plannedTime: '20:00', sequence: 1 });
    const nextRev = occurrenceKey({ revision: 2, plannedOn: '2026-09-14', plannedTime: '08:00', sequence: 0 });
    assert.notEqual(morning, evening);
    assert.notEqual(morning, nextRev);
    assert.deepEqual(parseOccurrenceKey(morning), {
      revision: 1,
      plannedOn: '2026-09-14',
      plannedTime: '08:00',
      sequence: 0,
    });
    assert.equal(
      phase5ReminderIdentity({
        userId: 'u',
        petId: 'p',
        scheduleId: 's',
        occurrenceKey: morning,
      }),
      `pets:u:p:s:${morning}:due`,
    );
  });
});

describe('recurrence combinations', () => {
  it('rejects year intervals and administration-based daily courses', () => {
    assert.throws(() =>
      normalizeScheduleInput({
        kind: 'VACCINATION',
        title: 'ცოფი',
        startOn: '2026-09-01',
        recurrenceKind: 'EVERY_N_DAYS',
        intervalCount: 1,
        recurrenceBasis: 'FIXED_CALENDAR',
        intervalUnit: 'YEAR',
        source: 'USER_ENTERED',
      }),
    );
    assert.throws(() =>
      normalizeScheduleInput({
        kind: 'MEDICATION',
        title: 'კურსი',
        startOn: '2026-09-01',
        recurrenceKind: 'DAILY_COURSE',
        times: ['08:00', '20:00'],
        recurrenceBasis: 'FROM_ADMINISTRATION',
        courseEndsOn: '2026-09-05',
        source: 'USER_ENTERED',
      }),
    );
  });

  it('requires an explicit bound on a daily course', () => {
    assert.throws(() =>
      normalizeScheduleInput({
        kind: 'MEDICATION',
        title: 'კურსი',
        startOn: '2026-09-01',
        recurrenceKind: 'DAILY_COURSE',
        times: ['08:00'],
        source: 'USER_ENTERED',
      }),
    );
  });
});

describe('fixed calendar vs administration basis', () => {
  it('does not reset a late fixed-calendar completion onto the administration date', () => {
    const monthly = schedule();
    const planned = enumerateSeries(monthly, { to: '2026-04-01' })[0];
    const next = nextAfterCompletion(monthly, { planned, administeredOn: '2026-02-05' });
    assert.equal(next.plannedOn, '2026-02-28');
    assert.notEqual(next.plannedOn, '2026-03-05');
  });

  it('advances administration-based recurrence from the confirmed date', () => {
    const monthly = schedule({ recurrenceBasis: 'FROM_ADMINISTRATION' });
    const planned = enumerateSeries(monthly, { to: '2026-02-01' })[0];
    const next = nextAfterCompletion(monthly, { planned, administeredOn: '2026-02-05' });
    assert.equal(next.plannedOn, '2026-03-05');
  });

  it('does not let a standalone past date advance a plan', () => {
    const monthly = schedule({
      recurrenceBasis: 'FROM_ADMINISTRATION',
      nextDueOn: '2026-09-20',
      nextSequence: 0,
    });
    const generated = generateOccurrences(monthly, { today: '2026-09-14', resolvedKeys: new Set() });
    assert.equal(generated.upcoming[0]?.plannedOn, '2026-09-20');
    assert.equal(generated.overdue.length, 0);
  });
});

describe('bounded generation', () => {
  it('does not emit an unlimited missed backlog', () => {
    const daily = schedule({
      recurrenceKind: 'EVERY_N_DAYS',
      intervalCount: 1,
      startOn: '2026-01-01',
      nextDueOn: '2026-01-01',
      dueTime: null,
      anchorDay: null,
    });
    const generated = generateOccurrences(daily, { today: '2026-09-14' });
    assert.ok(generated.overdue.length <= 3);
    assert.ok(generated.overdue.every((row) => row.plannedOn >= '2026-08-31'));
  });

  it('stops a bounded daily course', () => {
    const course = schedule({
      recurrenceKind: 'DAILY_COURSE',
      recurrenceBasis: 'FIXED_CALENDAR',
      startOn: '2026-09-01',
      times: ['08:00', '20:00'],
      dueTime: '08:00',
      occurrenceLimit: 4,
      intervalCount: 1,
      anchorDay: null,
    });
    const rows = enumerateSeries(course, { to: '2026-10-01' });
    assert.equal(rows.length, 4);
    assert.equal(rows[0].plannedTime, '08:00');
    assert.equal(rows[1].plannedTime, '20:00');
    assert.equal(rows[1].plannedOn, '2026-09-01');
    assert.equal(rows[2].plannedOn, '2026-09-02');
  });

  it('never treats product expiry as the next administration date', () => {
    const monthly = schedule({ nextDueOn: '2026-10-01' });
    const product = { expiresOn: '2026-08-01' };
    const next = nextAfterCompletion(monthly, {
      planned: { sequence: 0, plannedOn: '2026-01-31', plannedTime: '09:00' },
      administeredOn: '2026-01-31',
    });
    assert.notEqual(next.plannedOn, product.expiresOn);
  });
});

describe('completion helpers', () => {
  it('replays matching idempotency hashes and conflicts on a different payload', () => {
    const hashA = completePayloadHash({
      occurrenceKey: 'r1|2026-09-14|date|0',
      revision: 1,
      administeredOn: '2026-09-14',
    });
    const hashB = completePayloadHash({
      occurrenceKey: 'r1|2026-09-14|date|0',
      revision: 1,
      administeredOn: '2026-09-13',
    });
    assert.equal(idempotencyDecision(hashA, hashA), 'replay');
    assert.equal(idempotencyDecision(hashA, hashB), 'conflict');
    assert.notEqual(carePayloadHash({ a: 1 }), carePayloadHash({ a: 2 }));
  });

  it('rejects a stale revision as a non-generated occurrence', () => {
    const monthly = schedule({ revision: 2, nextDueOn: '2026-03-31' });
    const parsed = parseOccurrenceKey(occurrenceKey({ revision: 1, plannedOn: '2026-01-31', plannedTime: '09:00', sequence: 0 }));
    assert.equal(isGeneratedOccurrence(monthly, parsed, { today: '2026-09-14' }), false);
  });

  it('does not invent a next date from a voided administration-based series without remaining events', () => {
    const monthly = schedule({ recurrenceBasis: 'FROM_ADMINISTRATION', startOn: '2026-01-31' });
    const next = nextAfterVoidingAdministration(monthly, []);
    assert.equal(next.plannedOn, '2026-01-31');
    const afterOne = nextAfterVoidingAdministration(monthly, [
      { status: 'RECORDED', administeredOn: '2026-02-05', administeredTime: '09:00' },
    ]);
    assert.equal(afterOne.plannedOn, '2026-03-05');
  });
});

describe('pets care schema missing', () => {
  it('treats Phase 4 tables as care-unavailable, not health or identity', () => {
    const care = { code: 'P2021', meta: { modelName: 'PetCareEvent' }, message: 'The table `public.PetCareEvent` does not exist' };
    const health = { code: 'P2021', meta: { modelName: 'PetWeightLog' }, message: 'The table `public.PetWeightLog` does not exist' };
    const identity = { code: 'P2021', meta: { modelName: 'Pet' }, message: 'The table `public.Pet` does not exist' };
    assert.equal(isPetsCareSchemaMissing(care), true);
    assert.equal(isPetsHealthSchemaMissing(care), false);
    assert.equal(isPetsHealthSchemaMissing(health), true);
    assert.equal(isPetsCareSchemaMissing(health), false);
    assert.equal(isPetsCareSchemaMissing(identity), false);
    assert.equal(isPetsSchemaMissing(identity), true);
  });
});
