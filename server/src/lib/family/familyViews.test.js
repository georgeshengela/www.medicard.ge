import test from 'node:test';
import assert from 'node:assert/strict';
import { buildChildRecord } from './aiContext.js';
import { buildFamilyOverview } from './adminFamily.js';
import { buildReminderFeed, upcomingMonthBirthdays } from './reminders.js';
import { heroAnswer, monthBirthday, overviewView, sickDayView } from './view.js';

const TODAY = '2026-10-12';
const NOW = Date.parse('2026-10-12T09:00:00Z');
const baby = { id: '11111111-1111-4111-8111-111111111111', ownerId: 'u1', name: 'ნინო', birthDate: new Date('2026-08-12T00:00:00Z'), sex: 'FEMALE', gestationWeeks: null, feedingMode: 'BREAST', role: 'OWNER', createdAt: new Date('2026-08-20T10:00:00Z') };

test('month-birthdays: same day of the month, clamped, 1–24 months', () => {
  assert.equal(monthBirthday('2026-08-12', '2026-10-12'), 2);
  assert.equal(monthBirthday('2026-01-31', '2026-02-28'), 1);
  assert.equal(monthBirthday('2026-08-12', '2026-10-13'), null);
  assert.deepEqual(upcomingMonthBirthdays('2026-08-12', TODAY), [{ month: 2, on: '2026-10-12' }, { month: 3, on: '2026-11-12' }]);
});

test('the child page: two months old today → 2-month vaccines are due now', () => {
  const view = overviewView({ member: baby, doses: [], measurements: [], logs: [], health: [], foods: [], milestones: {}, todayYmd: TODAY, todayStartMs: NOW - 5 * 3600000, nowMs: NOW });
  assert.equal(view.age.label, '2 თვის');
  assert.equal(view.vaccines.summary.next.status, 'overdue', 'birth doses not marked yet');
  assert.equal(view.hero.kind, 'vaccineOverdue');
  assert.ok(view.feeding, 'feeding block for babies');
  assert.equal(view.foods, null, 'no food list before 4 months');
});

test('fever beats everything on the hero; under 3 months it is an alert', () => {
  const logs = [{ id: 'l1', kind: 'TEMP', at: new Date(NOW - 3600000), data: { c: 38.3 }, createdAt: new Date(NOW) }];
  const sick = sickDayView(logs, NOW);
  assert.equal(sick.lastTemp.c, 38.3);
  assert.equal(sick.feverDays, 1);
  const hero = heroAnswer({ member: baby, age: { days: 61, isBirthdayMonth: null, stage: 'infant_0_6' }, vaccines: null, growth: null, sick, lang: 'ka' });
  assert.equal(hero.kind, 'fever');
  assert.equal(hero.tone, 'alert');
});

test('Medi reads a record with facts, and says „not recorded“ instead of „none“', () => {
  const text = buildChildRecord({
    member: baby,
    doses: [{ code: 'hepb', dose: 1, status: 'GIVEN', givenOn: new Date('2026-08-12T00:00:00Z') }],
    measurements: [{ id: 'm1', measuredOn: new Date('2026-10-10T00:00:00Z'), weightKg: 5.1, heightCm: 57.5, headCm: null, position: 'LYING' }],
    logs: [], health: [], foods: [], milestones: {}, todayYmd: TODAY, nowMs: NOW,
  });
  assert.match(text, /Child: ნინო, girl/);
  assert.match(text, /Age: 2 months \(61 days\)/);
  assert.match(text, /weight 5\.1 kg \(WHO z/);
  assert.match(text, /Allergies: none recorded \(not the same as none\)/);
  assert.match(text, /Overdue: BCG dose 1/);
});

test('reminder feed: 14 days before, the day, +7, +30 — only future points', () => {
  const feed = buildReminderFeed([{ member: baby, doses: [{ code: 'hepb', dose: 1, status: 'GIVEN', givenOn: '2026-08-12' }, { code: 'bcg', dose: 1, status: 'GIVEN', givenOn: '2026-08-13' }] }], TODAY, 'ka');
  const vac = feed.filter((p) => p.kind === 'vaccine' && p.id.includes(':2026-10-12:'));
  assert.deepEqual(vac.map((p) => p.fireOn), ['2026-10-12', '2026-10-19', '2026-11-11']);
  assert.match(vac[0].title, /ნინო: დღეს აცრის დღეა/);
  assert.match(vac[0].body, /ჰექსა · პნევმო · როტა/);
  assert.ok(feed.some((p) => p.kind === 'month' && p.fireOn === '2026-11-12'));
  assert.ok(feed.every((p) => p.route.startsWith(`/family/${baby.id}`)));
});

test('admin overview: counts and timeliness only, team accounts out by default', () => {
  const raw = {
    teamUserIds: ['team'],
    members: [baby, { ...baby, id: '22222222-2222-4222-8222-222222222222', ownerId: 'team' }],
    doses: [{ memberId: baby.id, code: 'hepb', dose: 1, status: 'GIVEN', givenOn: '2026-08-12', createdAt: new Date(NOW) }],
    measurements: [], logs: [], health: [], foods: [], milestones: [], sessions: [], questions: [], answers: [{ memberId: baby.id, status: 'COMPLETE', triage: 'HOME_CARE', createdAt: new Date(NOW) }],
    ai: [], flags: [],
  };
  const out = buildFamilyOverview(raw, { days: 30, now: new Date(NOW) });
  assert.equal(out.totals.children, 1);
  assert.equal(out.totals.parents, 1);
  assert.equal(out.vaccines.tracked, 1);
  assert.equal(out.vaccines.upToDate, 0, 'BCG at birth is overdue');
  assert.equal(out.medi.levels.HOME_CARE, 1);
  assert.equal(JSON.stringify(out).includes('ნინო'), false, 'never a child name on the admin page');
});
