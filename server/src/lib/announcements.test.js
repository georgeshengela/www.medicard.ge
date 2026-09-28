import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  decodeImageDataUrl,
  isAllowedRoute,
  isAllowedUrl,
  matchesAudience,
  normalizeAnnouncement,
  phaseOf,
  publicCard,
} from './announcements.js';
import { announcementStatements, ANNOUNCEMENTS_SQL_URL } from '../../scripts/install-announcements.mjs';

const base = { title: 'მოიარე ლისი და მოიგე PS5', body: 'MEDIRUN-ის ახალი ღონისძიება' };

describe('announcements', () => {
  it('install SQL is additive only', () => {
    const statements = announcementStatements(readFileSync(ANNOUNCEMENTS_SQL_URL, 'utf8'));
    assert.ok(statements.length >= 4);
    assert.throws(() => announcementStatements('DROP TABLE "Announcement";'), /non-additive/);
  });

  it('accepts only known in-app routes and https links', () => {
    assert.equal(isAllowedRoute('/medipulsi'), true);
    assert.equal(isAllowedRoute('/nutrition/diary'), true);
    assert.equal(isAllowedRoute('/assistant?mode=deep'), true);
    assert.equal(isAllowedRoute('/(tabs)/medications'), true);
    assert.equal(isAllowedRoute('/admin'), false);
    assert.equal(isAllowedRoute('//evil.com'), false);
    assert.equal(isAllowedRoute('https://medicard.ge'), false);
    assert.equal(isAllowedUrl('https://medicard.ge/lisi'), true);
    assert.equal(isAllowedUrl('http://medicard.ge'), false);
    assert.equal(isAllowedUrl('javascript:alert(1)'), false);
    assert.equal(isAllowedUrl('https://user:pw@medicard.ge'), false);
  });

  it('normalizes a card and enforces button, link and date rules', () => {
    const card = normalizeAnnouncement({ ...base, ctaKind: 'route', ctaLabel: 'დაიწყე', ctaTarget: '/medipulsi', status: 'PUBLISHED' });
    assert.equal(card.ctaTarget, '/medipulsi');
    assert.ok(card.publishedAt instanceof Date);
    assert.deepEqual(card.audience, { gender: 'ALL', platforms: [] });
    assert.throws(() => normalizeAnnouncement({ ...base, ctaKind: 'route', ctaLabel: 'x', ctaTarget: '/nowhere' }), /აპის გვერდი/);
    assert.throws(() => normalizeAnnouncement({ ...base, ctaKind: 'url', ctaLabel: 'x', ctaTarget: 'http://a.ge' }), /https/);
    assert.throws(() => normalizeAnnouncement({ ...base, ctaKind: 'url', ctaTarget: 'https://a.ge' }), /სახელი/);
    assert.throws(
      () => normalizeAnnouncement({ ...base, startsAt: '2026-10-02T10:00:00.000Z', endsAt: '2026-10-01T10:00:00.000Z' }),
      /დასრულება/,
    );
    assert.throws(() => normalizeAnnouncement({ title: 'x' }));
    assert.throws(() => normalizeAnnouncement({ ...base, unknown: 1 }));
    const none = normalizeAnnouncement({ ...base, ctaKind: 'none', ctaLabel: 'left over', ctaTarget: '/cycle' });
    assert.equal(none.ctaLabel, '');
    assert.equal(none.ctaTarget, '');
  });

  it('keeps the first publish time when a live card is edited', () => {
    const first = new Date('2026-09-01T00:00:00Z');
    const edited = normalizeAnnouncement({ ...base, status: 'PUBLISHED' }, { publishedAt: first });
    assert.equal(edited.publishedAt, first);
  });

  it('derives the phase from status and schedule', () => {
    const now = new Date('2026-10-01T12:00:00Z');
    assert.equal(phaseOf({ status: 'DRAFT' }, now), 'DRAFT');
    assert.equal(phaseOf({ status: 'ARCHIVED' }, now), 'ARCHIVED');
    assert.equal(phaseOf({ status: 'PUBLISHED' }, now), 'LIVE');
    assert.equal(phaseOf({ status: 'PUBLISHED', startsAt: '2026-10-02T00:00:00Z' }, now), 'SCHEDULED');
    assert.equal(phaseOf({ status: 'PUBLISHED', endsAt: '2026-10-01T11:59:00Z' }, now), 'ENDED');
  });

  it('matches gender and platform audiences', () => {
    assert.equal(matchesAudience({}, { gender: 'MALE', platform: 'ios' }), true);
    assert.equal(matchesAudience({ gender: 'FEMALE' }, { gender: 'MALE', platform: 'ios' }), false);
    assert.equal(matchesAudience({ gender: 'FEMALE' }, { gender: 'FEMALE', platform: null }), true);
    assert.equal(matchesAudience({ platforms: ['android'] }, { gender: 'MALE', platform: 'ios' }), false);
    assert.equal(matchesAudience({ platforms: ['android'] }, { gender: 'MALE', platform: 'android' }), true);
  });

  it('public card carries no audience or author data', () => {
    const card = publicCard({
      id: 'a', placement: 'home', title: 't', body: 'b', details: '', badge: '', tone: 'weird', imageId: 'img',
      ctaKind: 'route', ctaLabel: 'გახსნა', ctaTarget: '/cycle', dismissible: true, audience: { gender: 'FEMALE' },
      createdBy: 'owner@x', publishedAt: new Date('2026-09-28T00:00:00Z'),
    });
    assert.equal(card.tone, 'teal');
    assert.equal(card.image, '/api/announcements/image/img');
    assert.deepEqual(card.cta, { label: 'გახსნა', kind: 'route', target: '/cycle' });
    assert.equal('audience' in card, false);
    assert.equal('createdBy' in card, false);
  });

  it('decodes only real images within the size limit', () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
    const ok = decodeImageDataUrl(`data:image/jpeg;base64,${jpeg.toString('base64')}`);
    assert.equal(ok.mime, 'image/jpeg');
    assert.throws(() => decodeImageDataUrl(`data:image/png;base64,${jpeg.toString('base64')}`), /ემთხვევა/);
    assert.throws(() => decodeImageDataUrl('data:text/html;base64,PGI+'), /JPEG/);
    const big = Buffer.alloc(1_300_000, 1);
    big[0] = 0xff;
    big[1] = 0xd8;
    assert.throws(() => decodeImageDataUrl(`data:image/jpeg;base64,${big.toString('base64')}`), /დიდია/);
  });
});
