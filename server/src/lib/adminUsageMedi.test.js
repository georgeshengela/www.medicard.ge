import test from 'node:test';
import assert from 'node:assert/strict';
import { actionGroup, answerSafety, buildMediUsage, mediTopics } from './adminUsageMedi.js';
import { CURRENT_AI_CONSENT_VERSION } from './aiConsent.js';

const NOW = new Date('2026-10-11T09:00:00Z'); // 13:00 in Tbilisi
const at = (s) => new Date(s);
const V = CURRENT_AI_CONSENT_VERSION;

function fixture() {
  return {
    teamUserIds: ['team'],
    accountsTotal: 6,
    sessions: [
      { id: 'st', userId: 'team', mode: 'ASSISTANT', createdAt: at('2026-10-05T08:00:00Z') },
      // u1: one Medi thread with two health questions (answered in the linked DOCTOR session) and one request.
      { id: 's1', userId: 'u1', mode: 'ASSISTANT', createdAt: at('2026-10-01T08:00:00Z') },
      { id: 'd1', userId: 'u1', mode: 'DOCTOR', createdAt: at('2026-10-01T08:00:30Z') },
      // u1: an old consultation no thread links to (counts on its own).
      { id: 'd0', userId: 'u1', mode: 'DOCTOR', createdAt: at('2026-09-20T08:00:00Z') },
      // u2: a thread that only asked the planner something.
      { id: 's2', userId: 'u2', mode: 'ASSISTANT', createdAt: at('2026-10-10T08:00:00Z') },
      // u3: opened a thread, never wrote.
      { id: 's3', userId: 'u3', mode: 'ASSISTANT', createdAt: at('2026-10-10T08:00:00Z') },
    ],
    turns: [
      { sessionId: 'st', userId: 'team', ord: 1, role: 'user', at: '2026-10-05T08:00:00.000Z' },
      { sessionId: 'st', userId: 'team', ord: 2, role: 'assistant', kind: 'answer', linked: 'dt', at: '2026-10-05T08:00:20.000Z' },
      { sessionId: 's1', userId: 'u1', ord: 1, role: 'user', at: '2026-10-01T08:00:00.000Z' },
      { sessionId: 's1', userId: 'u1', ord: 2, role: 'assistant', kind: 'answer', linked: 'd1', at: '2026-10-01T08:00:30.000Z' },
      { sessionId: 's1', userId: 'u1', ord: 3, role: 'user', at: '2026-10-08T21:30:00.000Z' }, // 9 Oct in Tbilisi
      { sessionId: 's1', userId: 'u1', ord: 4, role: 'assistant', kind: 'deep', linked: 'd1', at: '2026-10-08T21:31:00.000Z' },
      { sessionId: 's1', userId: 'u1', ord: 5, role: 'user', at: '2026-10-08T21:32:00.000Z' },
      { sessionId: 's1', userId: 'u1', ord: 6, role: 'assistant', at: '2026-10-08T21:32:05.000Z' },
      { sessionId: 'd1', userId: 'u1', ord: 1, role: 'user', at: '2026-10-01T08:00:00.000Z' },
      { sessionId: 'd1', userId: 'u1', ord: 2, role: 'assistant', at: '2026-10-01T08:00:30.000Z' },
      { sessionId: 'd0', userId: 'u1', ord: 1, role: 'user', at: 'not a date' },
      { sessionId: 'd0', userId: 'u1', ord: 2, role: 'assistant', at: null },
      { sessionId: 's2', userId: 'u2', ord: 1, role: 'user', at: '2026-10-10T08:00:00.000Z' },
      { sessionId: 's2', userId: 'u2', ord: 2, role: 'assistant', at: '2026-10-10T08:00:03.000Z' },
      { sessionId: 's3', userId: 'u3', ord: 1, role: 'assistant', at: '2026-10-10T08:00:00.000Z' },
    ],
    questionTexts: [
      { userId: 'team', content: 'თავი მტკივა' },
      { userId: 'u1', content: 'მუცელი მტკივა და გული მერევა' },
      { userId: 'u1', content: 'ციკლი დამიგვიანდა' },
      { userId: 'u1', content: 'რა ვქნა?' },
    ],
    ai: [
      { userId: 'team', mode: 'DOCTOR', status: 'OK', createdAt: at('2026-10-05T08:00:20Z') },
      { userId: 'u1', mode: 'DOCTOR', status: 'OK', createdAt: at('2026-09-20T08:00:30Z') },
      { userId: 'u1', mode: 'DOCTOR', status: 'OK', createdAt: at('2026-10-01T08:00:30Z') },
      { userId: 'u1', mode: 'CONSILIUM', status: 'OK', createdAt: at('2026-10-08T21:31:00Z') },
      { userId: 'u4', mode: 'SYMPTOM_CHECKER', status: 'OK', createdAt: at('2026-10-10T10:00:00Z') },
      { userId: 'u4', mode: 'SYMPTOM_CHECKER', status: 'ERROR', createdAt: at('2026-10-10T10:05:00Z') },
    ],
    safety: [
      { userId: 'team', mode: 'DOCTOR', ...answerSafety('DOCTOR', '⚠️ სასწრაფოდ დაუკავშირდით 112-ს.') },
      { userId: 'u1', mode: 'DOCTOR', ...answerSafety('DOCTOR', '⚠️ სასწრაფოდ დაუკავშირდით 112-ს. …') },
      { userId: 'u1', mode: 'DOCTOR', ...answerSafety('DOCTOR', 'დალიე წყალი. თუ გაუარესდა — 112.') },
      { userId: 'u1', mode: 'CONSILIUM', ...answerSafety('CONSILIUM', 'მშვიდად.') },
      { userId: 'u4', mode: 'SYMPTOM_CHECKER', ...answerSafety('SYMPTOM_CHECKER', JSON.stringify({ result: { urgency: 'urgent' } })) },
    ],
    operations: [
      { userId: 'team', tool: 'hydration_add', status: 'DONE', createdAt: at('2026-10-05T08:01:00Z') },
      { userId: 'u2', tool: 'hydration_add', status: 'DONE', createdAt: at('2026-10-10T08:00:10Z') },
      { userId: 'u2', tool: 'period_record', status: 'REJECTED', createdAt: at('2026-10-10T08:00:20Z') },
    ],
    feedback: [
      { userId: 'team', rating: 1, mode: 'DOCTOR', hasComment: false },
      { userId: 'u1', rating: -1, mode: 'DOCTOR', hasComment: true },
    ],
    consents: [
      { userId: 'team', version: V, decision: 'accepted' },
      { userId: 'u1', version: V, decision: 'accepted' },
      { userId: 'u2', version: V, decision: 'accepted' },
      { userId: 'u3', version: V, decision: 'declined' },
      { userId: 'u4', version: 'old-hash', decision: 'accepted' },
    ],
    consentEvents: [
      { userId: 'u1', decision: 'declined', createdAt: at('2026-09-19T08:00:00Z') },
      { userId: 'u1', decision: 'accepted', createdAt: at('2026-09-20T07:59:00Z') },
      { userId: 'u3', decision: 'declined', createdAt: at('2026-10-10T07:00:00Z') },
      { userId: 'u3', decision: 'declined', createdAt: at('2026-10-10T07:30:00Z') },
    ],
    otherAi: [
      { userId: 'u1', mode: 'CYCLE_WELLNESS', count: 3 },
      { userId: 'team', mode: 'CYCLE_WELLNESS', count: 5 },
      { userId: 'u2', mode: 'LAB', count: 1 },
      { userId: 'u2', mode: 'SKIN', count: 1 },
    ],
    signups: [
      { id: 'u2', createdAt: at('2026-10-10T07:00:00Z') },
      { id: 'u3', createdAt: at('2026-10-10T07:00:00Z') },
      { id: 'u9', createdAt: at('2026-07-01T07:00:00Z') },
    ],
    people: [
      { id: 'team', fullName: 'Demo', email: 'demo@medicard.ge', phone: null, createdAt: at('2026-03-24T08:00:00Z'), lastSeenAt: at('2026-10-11T08:00:00Z') },
      { id: 'u1', fullName: 'Nino', email: '995599123456@phone.medicard.ge', phone: null, createdAt: at('2026-09-20T07:00:00Z'), lastSeenAt: at('2026-10-09T08:00:00Z') },
      { id: 'u2', fullName: 'Giorgi', email: 'x@apple.medicard.ge', phone: null, createdAt: at('2026-10-10T07:00:00Z'), lastSeenAt: null },
      { id: 'u4', fullName: '', email: 'u4@gmail.com', phone: null, createdAt: at('2026-10-01T07:00:00Z'), lastSeenAt: null },
    ],
    flags: [{ key: 'medi', enabled: true, effective: true }, { key: 'voice', enabled: false, effective: false }],
  };
}

test('topic buckets read Georgian and English, unknown is „other“', () => {
  assert.deepEqual(mediTopics('მუცელი მტკივა და გული მერევა'), ['pain', 'digestion']);
  assert.deepEqual(mediTopics('ციკლი დამიგვიანდა'), ['women']);
  assert.deepEqual(mediTopics('My blood pressure is high'), ['heart']);
  assert.deepEqual(mediTopics('ჩამიწერე ერთი ჭიქა წყალი'), ['app']);
  assert.deepEqual(mediTopics('რა ვქნა?'), ['other']);
  assert.deepEqual(mediTopics(''), ['other']);
});

test('safety flags come from the answer opener and the symptom level only', () => {
  assert.deepEqual(answerSafety('DOCTOR', '⚠️ სასწრაფოდ დაუკავშირდით 112-ს. შემდეგ…'), { emergency: true, mentions112: true, urgency: null });
  assert.deepEqual(answerSafety('DOCTOR', 'დალიე წყალი. თუ გაუარესდა — 112.'), { emergency: false, mentions112: true, urgency: null });
  assert.deepEqual(answerSafety('DOCTOR', 'ფასი 1120 ლარი'), { emergency: false, mentions112: false, urgency: null });
  assert.equal(answerSafety('SYMPTOM_CHECKER', JSON.stringify({ result: { urgency: 'emergency' } })).emergency, true);
  assert.equal(answerSafety('SYMPTOM_CHECKER', '{broken').urgency, null);
  assert.equal(actionGroup('dose_record'), 'medication');
  assert.equal(actionGroup('cycle_settings'), 'cycle');
  assert.equal(actionGroup('something_new'), 'other');
});

test('team accounts are left out unless includeTeam', () => {
  const d = buildMediUsage(fixture(), { now: NOW });
  assert.equal(d.team.accounts, 1);
  assert.equal(d.team.users, 1);
  assert.equal(d.totals.accounts, 5);
  assert.equal(d.totals.users, 3); // u1, u2, u4 — u3 never wrote
  assert.ok(!d.items.some((i) => i.id === 'team'));
  assert.equal(d.feedback.up, 0);
  assert.equal(d.otherModules.cycle.count, 3);
  assert.equal(d.otherModules.lab.count, 2);
  assert.equal(d.otherModules.lab.users, 1);
  const all = buildMediUsage(fixture(), { now: NOW, includeTeam: true });
  assert.equal(all.totals.accounts, 6);
  assert.equal(all.totals.users, 4);
  assert.equal(all.items.find((i) => i.id === 'team').person.team, true);
  assert.equal(all.feedback.up, 1);
  assert.equal(all.safety.emergency, 2);
});

test('ladder: consent, used, clinical answer, deeper, saved, came back', () => {
  const d = buildMediUsage(fixture(), { now: NOW });
  const L = Object.fromEntries(d.ladder.map((s) => [s.key, s]));
  assert.equal(L.consent.count, 2); // u1, u2 (u4's consent is an old version, u3 declined)
  assert.equal(L.consent.rate, 100);
  assert.equal(L.used.count, 3);
  assert.equal(L.used.rate, 150);
  assert.equal(L.answered.count, 1);
  assert.equal(L.deep.count, 2); // u1 consilium, u4 symptom check
  assert.equal(L.saved.count, 1); // u2 (the rejected one does not count)
  assert.equal(L.returned.count, 1); // u1 on 20 Sep, 1 Oct, 9 Oct
  assert.equal(d.consent.accepted, 2);
  assert.equal(d.consent.declined, 1);
  assert.equal(d.consent.old, 1);
  assert.equal(d.consent.none, 1); // 5 accounts, 4 rows
  assert.equal(d.consent.declinedThenAccepted, 1);
  assert.equal(d.consent.declinedTwice, 1);
  assert.equal(d.consent.acceptedNotUsed, 0);
  assert.equal(d.consent.usersWithoutConsent, 1); // u4
});

test('one person: thread + standalone consultation, linked consultation not counted twice', () => {
  const d = buildMediUsage(fixture(), { now: NOW });
  const u1 = d.items.find((i) => i.id === 'u1');
  assert.deepEqual(u1.usage, {
    conversations: 2, messages: 4, health: 3, requests: 1, clinical: 2, consilium: 1, symptoms: 0, medication: 0,
    actions: 0, feedback: 1, failed: 0,
  });
  assert.equal(u1.days, 3);
  assert.equal(u1.consent, 'accepted');
  assert.equal(u1.person.name, 'Nino');
  assert.equal(u1.person.contact, '+995 599 12 34 56');
  assert.equal(u1.lastMessageAt, '2026-10-08T21:32:00.000Z');
  const u4 = d.items.find((i) => i.id === 'u4');
  assert.equal(u4.usage.symptoms, 1);
  assert.equal(u4.usage.failed, 1);
  assert.equal(u4.usage.messages, 0);
  assert.equal(u4.consent, 'old');
  // Newest activity first.
  assert.deepEqual(d.items.map((i) => i.id), ['u4', 'u2', 'u1']);
  assert.equal(d.totals.conversations, 3);
  assert.equal(d.usage.conversations.threads, 2);
  assert.equal(d.usage.conversations.threadsDeep, 1);
  assert.equal(d.usage.conversations.consultations, 1);
  assert.equal(d.usage.conversations.empty, 1);
  assert.equal(d.totals.healthQuestions, 3);
  assert.equal(d.totals.requests, 2);
  assert.deepEqual(d.usage.perPerson, { none: 1, one: 1, few: 0, some: 1, many: 0 });
  assert.equal(d.usage.actions.groups.hydration, 1);
  assert.equal(d.usage.actions.status.REJECTED, 1);
});

test('period counts and the day series', () => {
  const d = buildMediUsage(fixture(), { days: 7, now: NOW });
  const p = d.period;
  assert.equal(p.from, '2026-10-05');
  assert.equal(p.to, '2026-10-11');
  assert.equal(p.activeUsers, 3); // u1 on 9 Oct, u2 + u4 on 10 Oct
  assert.equal(p.newUsers, 2); // u2, u4 started this week
  assert.equal(p.messages, 3);
  assert.equal(p.messageUsers, 2);
  assert.equal(p.clinical, 1); // u1's consilium on 9 Oct
  assert.equal(p.consilium, 1);
  assert.equal(p.symptomChecks, 1);
  assert.equal(p.actions, 1);
  assert.equal(p.signups, 2);
  assert.equal(p.signupsUsed, 1);
  assert.equal(p.signupRate, 50);
  assert.equal(p.trend.messages.length, 7);
  assert.deepEqual(p.trend.messages.find((x) => x.day === '2026-10-09'), { day: '2026-10-09', count: 2 });
  assert.deepEqual(p.trend.active.find((x) => x.day === '2026-10-10'), { day: '2026-10-10', count: 2 });
  assert.deepEqual(p.trend.answers.find((x) => x.day === '2026-10-09'), { day: '2026-10-09', count: 1 });
});

test('topics and safety are counts; no text leaves the builder', () => {
  const d = buildMediUsage(fixture(), { now: NOW });
  assert.equal(d.topicSample, 3);
  const topics = Object.fromEntries(d.topics.map((t) => [t.key, t.count]));
  assert.deepEqual(topics, { pain: 1, digestion: 1, women: 1, other: 1 });
  assert.equal(d.safety.emergency, 1);
  assert.equal(d.safety.mentions112, 2);
  assert.equal(d.safety.urgency.urgent, 1);
  const json = JSON.stringify(d);
  for (const q of fixture().questionTexts) assert.ok(!json.includes(q.content));
  assert.ok(!json.includes('სასწრაფოდ'));
  assert.equal(d.voice.traceable, false);
  assert.equal(d.flags.voice.effective, false);
  assert.equal(d.flags.mediDeep.effective, true);
});

test('empty data: no crash, sensible zeros', () => {
  const d = buildMediUsage({}, { now: NOW });
  assert.equal(d.installed, true);
  assert.equal(d.totals.users, 0);
  assert.equal(d.totals.userRate, null);
  assert.equal(d.totals.lastAt, null);
  assert.equal(d.ladder[0].count, 0);
  assert.equal(d.ladder[1].rate, null);
  assert.deepEqual(d.items, []);
  assert.equal(d.itemsTotal, 0);
  assert.equal(d.usage.medianMessages, null);
  assert.equal(d.usage.maxDays, 0);
  assert.equal(d.period.trend.active.length, 30);
  assert.equal(d.consent.none, 0);
  assert.deepEqual(d.topics, []);
});
