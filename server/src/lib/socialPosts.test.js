import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildSocialSummary, campaignDay, diffPost, normalizePostInput, setSocialPostStatus, statusEventType, tbilisiStamp,
  upsertSocialPost,
} from './socialPosts.js';
import { socialStatements } from '../../scripts/install-social.mjs';
import { parseSocialLogFile } from '../../scripts/social-log.mjs';

function memoryStore() {
  const posts = new Map();
  const events = [];
  return {
    posts,
    events,
    async findBySlot(slot) { return posts.has(slot) ? { ...posts.get(slot) } : null; },
    async insert(p) { posts.set(p.slot, { ...p, lastSyncedAt: null }); },
    async update(p) { posts.set(p.slot, { ...p }); },
    async addEvent(postId, type, detail) { events.push({ postId, type, detail }); },
  };
}

const BASE = {
  campaign: 'launch-2026-10',
  slot: 'd01-feed',
  networks: ['facebook', 'Instagram'],
  kind: 'post',
  pillar: 'MEDIRUN',
  title: 'გაშვების დღე',
  text: 'MEDICARD უკვე App Store-შია.',
  mediaUrls: ['https://medicard.ge/press/campaign/d01-feed.jpg'],
  scheduledAt: '2026-10-02T13:00:00+04:00',
};

test('install SQL is additive and only touches SocialPost tables', () => {
  const sql = readFileSync(new URL('../../prisma/20261001-social.sql', import.meta.url), 'utf8');
  assert.equal(socialStatements(sql).length, 6);
  assert.throws(() => socialStatements('DROP TABLE "SocialPost";'));
  assert.throws(() => socialStatements('CREATE TABLE IF NOT EXISTS "User" (id TEXT);'));
  assert.throws(() => socialStatements('ALTER TABLE "SocialPost" ADD COLUMN x TEXT;'));
});

test('normalizePostInput validates networks, kinds, https media and offsets', () => {
  const p = normalizePostInput(BASE, { create: true });
  assert.deepEqual(p.networks, ['facebook', 'instagram']);
  assert.equal(p.kind, 'POST');
  assert.equal(p.scheduledAt.toISOString(), '2026-10-02T09:00:00.000Z');
  assert.throws(() => normalizePostInput({ ...BASE, networks: ['tiktok'] }, { create: true }), /networks/);
  assert.throws(() => normalizePostInput({ ...BASE, kind: 'VIDEO' }, { create: true }), /kind/);
  assert.throws(() => normalizePostInput({ ...BASE, mediaUrls: ['http://x.ge/a.jpg'] }, { create: true }), /https/);
  assert.throws(() => normalizePostInput({ ...BASE, scheduledAt: '2026-10-02T13:00' }, { create: true }), /offset/);
  assert.throws(() => normalizePostInput({ ...BASE, slot: 'bad slot' }, { create: true }), /slot/);
  assert.throws(() => normalizePostInput({ slot: 'x1' }, { create: true }), /required/);
  // Partial record for an existing post is fine.
  assert.equal(normalizePostInput({ slot: 'd01-feed', title: 'ახალი' }).text, undefined);
});

test('upsert creates once, records a diff on change and nothing when unchanged', async () => {
  const store = memoryStore();
  const created = await upsertSocialPost(BASE, { store });
  assert.equal(created.action, 'created');
  assert.equal(store.posts.get('d01-feed').status, 'PLANNED');
  assert.equal(store.events.length, 1);
  assert.equal(store.events[0].type, 'CREATED');
  assert.match(store.events[0].detail, /facebook\+instagram · POST · 2026-10-02 13:00 · PLANNED/);

  const same = await upsertSocialPost(BASE, { store });
  assert.equal(same.action, 'unchanged');
  assert.equal(store.events.length, 1);

  const moved = await upsertSocialPost({ slot: 'd01-feed', scheduledAt: '2026-10-02T18:30:00+04:00', text: 'ახალი ტექსტი' }, { store });
  assert.equal(moved.action, 'updated');
  assert.deepEqual(moved.changes, ['text', 'scheduledAt']);
  assert.equal(store.events.at(-1).type, 'UPDATED');
  assert.equal(store.events.at(-1).detail, 'text შეიცვალა; scheduledAt: 2026-10-02 13:00 → 2026-10-02 18:30');
  assert.equal(store.posts.get('d01-feed').title, BASE.title, 'omitted fields are kept');

  const scheduled = await upsertSocialPost({ slot: 'd01-feed', status: 'SCHEDULED', metricoolId: 12345 }, { store });
  assert.deepEqual(scheduled.changes, ['metricoolId', 'status']);
  assert.deepEqual(store.events.slice(-2).map((e) => e.type), ['UPDATED', 'SCHEDULED']);
  assert.equal(store.posts.get('d01-feed').metricoolId, '12345');
});

test('setSocialPostStatus appends status events, stamps sync and publish time', async () => {
  const store = memoryStore();
  await upsertSocialPost({ ...BASE, status: 'SCHEDULED' }, { store });
  const now = Date.parse('2026-10-02T09:00:30Z');
  const res = await setSocialPostStatus('d01-feed', 'PUBLISHED', { externalUrl: 'https://www.instagram.com/p/abc/' }, { store, now });
  assert.equal(res.type, 'PUBLISHED');
  const row = store.posts.get('d01-feed');
  assert.equal(row.status, 'PUBLISHED');
  assert.equal(row.publishedAt.toISOString(), '2026-10-02T09:00:30.000Z');
  assert.equal(row.lastSyncedAt.toISOString(), '2026-10-02T09:00:30.000Z');
  assert.match(store.events.at(-1).detail, /SCHEDULED → PUBLISHED; ბმული დაემატა; გამოქვეყნდა 2026-10-02 13:00/);

  const again = await setSocialPostStatus('d01-feed', 'PUBLISHED', { detail: 'Metricool sync' }, { store, now });
  assert.equal(again.type, 'SYNCED');
  assert.equal(store.events.at(-1).detail, 'Metricool sync');

  await assert.rejects(() => setSocialPostStatus('nope', 'PUBLISHED', {}, { store }), /unknown slot/);
  await assert.rejects(() => setSocialPostStatus('d01-feed', 'DONE', {}, { store }), /status/);
});

test('statusEventType, diffPost and tbilisiStamp', () => {
  assert.equal(statusEventType('PLANNED', 'SCHEDULED'), 'SCHEDULED');
  assert.equal(statusEventType('SCHEDULED', 'PLANNED'), 'UPDATED');
  assert.equal(statusEventType('FAILED', 'FAILED'), 'SYNCED');
  assert.deepEqual(diffPost({ networks: ['facebook'], scheduledAt: new Date('2026-10-02T09:00:00Z') }, { networks: ['facebook'], scheduledAt: new Date('2026-10-02T09:00:00Z') }), []);
  assert.equal(tbilisiStamp('2026-10-01T20:30:00Z'), '2026-10-02 00:30');
});

test('campaignDay counts Tbilisi calendar days and caps at 28', () => {
  const first = '2026-10-01T06:00:00Z';
  assert.equal(campaignDay(first, Date.parse('2026-09-30T19:00:00Z')), 0);
  assert.equal(campaignDay(first, Date.parse('2026-09-30T21:00:00Z')), 1, '01:00 Tbilisi on Oct 1');
  assert.equal(campaignDay(first, Date.parse('2026-10-10T12:00:00Z')), 10);
  assert.equal(campaignDay(first, Date.parse('2026-12-01T12:00:00Z')), 28);
  assert.equal(campaignDay(null), 0);
});

test('buildSocialSummary fills every status/network and picks the latest campaign', () => {
  const s = buildSocialSummary({
    byStatus: [{ status: 'SCHEDULED', n: 5 }, { status: 'PUBLISHED', n: 2 }, { status: 'PLANNED', n: 1 }],
    byNetwork: [{ network: 'instagram', n: 7 }],
    campaigns: [{ campaign: 'launch-2026-10', n: 8, firstAt: new Date('2026-10-01T06:00:00Z'), lastAt: new Date('2026-10-28T15:00:00Z') }],
    now: Date.parse('2026-10-03T08:00:00Z'),
  });
  assert.equal(s.total, 8);
  assert.equal(s.planned, 6);
  assert.equal(s.published, 2);
  assert.deepEqual(s.network, { facebook: 0, instagram: 7, linkedin: 0 });
  assert.equal(s.campaign.day, 3);
  assert.equal(s.campaign.length, 28);
  assert.equal(s.next, null);
});

test('social-log file parser accepts an array or one object', () => {
  assert.equal(parseSocialLogFile('[{"slot":"a"},{"slot":"b"}]').length, 2);
  assert.equal(parseSocialLogFile('{"slot":"a"}').length, 1);
  assert.equal(parseSocialLogFile('{"posts":[{"slot":"a"}]}').length, 1);
  assert.throws(() => parseSocialLogFile('[]'), /empty/);
  assert.throws(() => parseSocialLogFile('nope'), /JSON/);
});
