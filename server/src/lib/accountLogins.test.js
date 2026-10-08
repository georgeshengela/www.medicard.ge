import { test } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import * as accountLogins from './accountLogins.js';
import {
  CONTENT_TABLES,
  absorbLogins,
  accountHasContent,
  conflictOptions,
  planAbsorb,
  readConflictToken,
  realEmail,
  signConflictToken,
} from './accountLogins.js';
import { isAuthWriteRequest } from './rateLimitKey.js';
import { DEFAULT_TEMPLATES, DEFAULT_TEMPLATES_EN } from './email/templates.js';

const KEY = 'test-secret-at-least-16-chars';

test('real email: synthetic phone / Apple / merged addresses are not sign-in emails', () => {
  assert.equal(realEmail('Nino@Gmail.com '), 'nino@gmail.com');
  assert.equal(realEmail('995555123456@phone.medicard.ge'), null);
  assert.equal(realEmail('apple.abc@apple.medicard.ge'), null);
  assert.equal(realEmail('merged.x@deleted.medicard.ge'), null);
  assert.equal(realEmail(''), null);
});

test('plan: a phone account folds into an email account (the 2026-10-05 case)', () => {
  const web = { email: '995555123456@phone.medicard.ge', phone: '+995555123456', identities: [] };
  const app = { email: 'nino@gmail.com', phone: null, identities: [] };
  assert.deepEqual(planAbsorb(web, app), { ok: true, phone: '+995555123456', email: null, identities: 0, conflicts: [] });
  // The other way round the email moves to the phone account.
  assert.deepEqual(planAbsorb(app, web), { ok: true, phone: null, email: 'nino@gmail.com', identities: 0, conflicts: [] });
});

test('plan: never overwrite a different phone or a different real email', () => {
  const a = { email: 'a@x.ge', phone: '+995555000001', identities: [{ provider: 'google', subject: '1' }] };
  const b = { email: 'b@x.ge', phone: '+995555000002', identities: [] };
  const plan = planAbsorb(a, b);
  assert.equal(plan.ok, false);
  assert.deepEqual(plan.conflicts, ['phone', 'email']);
  // The same phone / email on both is not a conflict and moves nothing.
  assert.deepEqual(planAbsorb({ ...a, identities: [] }, { ...a, identities: [] }), { ok: true, phone: null, email: null, identities: 0, conflicts: [] });
  // Social identities always fit.
  assert.equal(planAbsorb({ email: 'apple.x@apple.medicard.ge', phone: null, identities: [{ provider: 'apple', subject: 's' }] }, b).identities, 1);
});

test('conflict token: bound to both accounts, 15 minutes, nothing else verifies as one', () => {
  const token = signConflictToken({ kind: 'phone', from: 'u1', to: 'u2' }, KEY);
  assert.deepEqual(readConflictToken(token, KEY), { kind: 'phone', from: 'u1', to: 'u2' });
  assert.equal(readConflictToken(token, 'another-secret-value-123'), null);
  assert.equal(readConflictToken(jwt.sign({ typ: 'social-link', kind: 'phone', from: 'u1', to: 'u2' }, KEY), KEY), null);
  assert.equal(readConflictToken(jwt.sign({ typ: 'account-conflict', kind: 'sms', from: 'u1', to: 'u2' }, KEY), KEY), null);
  assert.equal(readConflictToken(jwt.sign({ typ: 'account-conflict', kind: 'phone', from: 'u1', to: 'u1' }, KEY), KEY), null);
  const expired = jwt.sign({ typ: 'account-conflict', kind: 'email', from: 'u1', to: 'u2', exp: Math.floor(Date.now() / 1000) - 5 }, KEY);
  assert.equal(readConflictToken(expired, KEY), null);
});

test('content tables are the person’s own records, never automatic rows', () => {
  for (const auto of ['HealthProfile', 'CycleProfile', 'StepLog', 'HealthMetricDaily', 'NutritionProgram', 'NutritionPlannedMeal',
    'AppActivity', 'UserQuestProfile', 'QuestCompletion', 'PushToken', 'MedipulsiPlayer', 'CyclePredictionSnapshot', 'ReferralCode', 'UserQr']) {
    assert.equal(CONTENT_TABLES.includes(auto), false, auto);
  }
  for (const own of ['MedicationSchedule', 'CycleLog', 'NutritionMeal', 'MedicalRecord', 'Pet',
    'CycleCustomTag', 'RewardLedger', 'MedipulsiSession', 'MedipulsiClaim', 'MedirunCrewMember']) {
    assert.equal(CONTENT_TABLES.includes(own), true, own);
  }
  // Tables with automatic rows are only counted through a predicate, every one bound to the user id.
  const { CONTENT_PREDICATES } = accountLogins;
  for (const table of ['CycleProfile', 'HealthProfile', 'CyclePartnerShare', 'Referral', 'TrainerLink']) {
    assert.ok(CONTENT_PREDICATES.some((check) => check.table === table), table);
  }
  for (const check of CONTENT_PREDICATES) {
    assert.match(check.where, /\$1/, check.table);
    assert.doesNotMatch(check.where, /\$2|;/, check.table);
  }
});

test('new auth writes are IP-limited and the email code has both languages', () => {
  for (const path of ['/api/auth/email/add/start', '/api/auth/email/add/verify', '/api/auth/apple/link', '/api/auth/google/link', '/api/auth/account-conflict/resolve']) {
    assert.equal(isAuthWriteRequest({ method: 'POST', originalUrl: path }), true, path);
  }
  assert.equal(isAuthWriteRequest({ method: 'GET', originalUrl: '/api/auth/methods' }), false);
  assert.ok(DEFAULT_TEMPLATES.email_verify.required.includes('code'));
  assert.match(DEFAULT_TEMPLATES_EN.email_verify.body, /\{\{code\}\}/);
});

/* ───────── The emptiness check against a fake database ───────── */

// Columns of the tables the check may read. A table missing here does not exist in the fake
// database (raw-SQL tables are created lazily), and reading it throws like Postgres does.
const FAKE_SCHEMA = {
  MedicalRecord: ['userId'], ChatSession: ['userId'], MedicationSchedule: ['userId'], CycleLog: ['userId'],
  NutritionMeal: ['userId'], Pet: ['userId'], RewardLedger: ['userId'], MedipulsiSession: ['userId'],
  MedipulsiClaim: ['userId'], CycleCustomTag: ['userId'],
  CycleProfile: ['userId', 'lastPeriodStart', 'dueDate', 'mode', 'contraceptionMethod', 'isIrregular', 'privacyEnabled',
    'avgCycleLength', 'avgPeriodLength', 'conditions', 'partnerShareCode'],
  HealthProfile: ['userId', 'chronicConditions', 'allergies', 'medications', 'familyHistory', 'extraAnswers'],
};

/**
 * `hits[userId]` = tables in which that person has a row the check should count. The fake cannot run
 * SQL, so it answers by table: the predicates themselves are checked against Postgres separately.
 */
function fakeDb({ hits = {}, schema = FAKE_SCHEMA, users = {} } = {}) {
  const reads = [];
  return {
    reads,
    user: {
      findUnique: async ({ where }) => users[where.id] ?? null,
    },
    async $queryRaw(strings, ...values) {
      const sql = strings.join('?');
      if (sql.includes('information_schema')) {
        const wanted = values.find(Array.isArray) ?? Object.keys(schema);
        return Object.entries(schema)
          .filter(([table]) => wanted.includes(table))
          .flatMap(([table, columns]) => columns
            .filter((column) => !/column_name = 'userId'/.test(sql) || column === 'userId')
            .map((column) => ({ table_name: table, column_name: column })));
      }
      if (sql.includes('AuthIdentity')) return [];
      throw new Error(`unexpected query: ${sql}`);
    },
    async $queryRawUnsafe(sql, userId) {
      const table = /FROM "([A-Za-z]+)"/.exec(sql)?.[1];
      if (!schema[table]) throw new Error(`relation "${table}" does not exist`);
      reads.push(table);
      return (hits[userId] ?? []).includes(table) ? [{ hit: 1 }] : [];
    },
  };
}

const userRow = (id, extra = {}) => ({
  id, email: `${id}@phone.medicard.ge`, phone: null, passwordHash: null, status: 'ACTIVE', createdAt: new Date(), ...extra,
});

test('content: a cycle profile with her last period (onboarding answer) is real data', async () => {
  const db = fakeDb({ hits: { u1: ['CycleProfile'] } });
  assert.equal(await accountHasContent('u1', db), true);
  assert.ok(db.reads.includes('CycleProfile'));
  // The same database, another person with nothing: empty.
  assert.equal(await accountHasContent('u2', fakeDb()), false);
});

test('content: Medi Coins, MEDIRUN walks and box openings, cycle tags and hand-entered profile data count', async () => {
  for (const table of ['RewardLedger', 'MedipulsiSession', 'MedipulsiClaim', 'CycleCustomTag', 'HealthProfile']) {
    assert.equal(await accountHasContent('u1', fakeDb({ hits: { u1: [table] } })), true, table);
  }
});

test('content: a check whose table or column is not installed is skipped, never an error', async () => {
  const db = fakeDb();
  // FAKE_SCHEMA has no MedirunCrewMember / Referral / TrainerLink / CyclePartnerShare, and CycleProfile
  // has no raw-SQL expectsBleeding column: those checks are skipped and the account is still empty.
  assert.equal(await accountHasContent('u1', db), false);
  for (const missing of ['MedirunCrewMember', 'Referral', 'TrainerLink', 'CyclePartnerShare']) {
    assert.equal(db.reads.includes(missing), false, missing);
  }
  // A database error still fails closed.
  const broken = fakeDb();
  broken.$queryRawUnsafe = async () => { throw new Error('connection reset'); };
  assert.equal(await accountHasContent('u1', broken), true);
});

test('conflict: an account holding only cycle data is never offered for deletion or merged away', async () => {
  const users = { here: userRow('here', { email: 'nino@gmail.com' }), other: userRow('other', { phone: '+995555123456' }) };
  const db = fakeDb({ hits: { other: ['CycleProfile'] }, users });
  const options = await conflictOptions('here', 'other', db);
  assert.equal(options.otherHasData, true);
  assert.equal(options.canMoveHere, false);
  await assert.rejects(absorbLogins('other', 'here', db), { code: 'MERGE_HAS_DATA' });

  // Seen from the account with her cycle data: switching away must not delete it.
  const mine = fakeDb({ hits: { here: ['CycleProfile'] }, users });
  assert.equal((await conflictOptions('here', 'other', mine)).switchDeletesCurrent, false);
  await assert.rejects(absorbLogins('here', 'other', mine), { code: 'MERGE_HAS_DATA' });
});

test('discard-new: refused once onboarding started in the app or on the web', () => {
  const { onboardingStarted } = accountLogins;
  assert.equal(typeof onboardingStarted, 'function');
  assert.equal(onboardingStarted(null), false);
  assert.equal(onboardingStarted({ extraAnswers: {} }), false);
  // Written by other screens before onboarding (Home layout, price alerts): not onboarding.
  assert.equal(onboardingStarted({ extraAnswers: { homeLayout: 'standard', priceDropAlerts: false } }), false);
  // App: every answered step stores the next step key.
  assert.equal(onboardingStarted({ extraAnswers: { onboardingVersion: 2, onboardingStepKey: 'goal' } }), true);
  // App (finished) and web (finished): the phase flag, then the completed profile.
  assert.equal(onboardingStarted({ extraAnswers: { onboardingVersion: 2, onboardingStepKey: null, assessmentPhaseComplete: true } }), true);
  assert.equal(onboardingStarted({ extraAnswers: { assessmentPhaseComplete: true, onboardingSource: 'web' } }), true);
  assert.equal(onboardingStarted({ extraAnswers: {}, completedAt: new Date() }), true);
});
