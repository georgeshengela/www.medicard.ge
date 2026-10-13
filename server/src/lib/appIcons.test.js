import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { APP_ICON_SQL, APP_ICONS, buildAppIconOverview, parseAppIcon } from './appIcons.js';

const mobileIcons = readFileSync(new URL('../../../mobile/src/lib/appIcon.ts', import.meta.url), 'utf8');

describe('app icon usage (#/app-icons)', () => {
  it('knows the same icons, groups and order as the app', () => {
    const fromApp = [...mobileIcons.matchAll(/\{ id: '(\w+)', group: '(\w+)'/g)].map((m) => `${m[1]}:${m[2]}`);
    assert.deepEqual(APP_ICONS.map((i) => `${i.id}:${i.group}`), fromApp);
  });

  it('takes only a known icon id', () => {
    assert.equal(parseAppIcon('chukurtma'), 'chukurtma');
    assert.equal(parseAppIcon(' rose '), 'rose');
    assert.equal(parseAppIcon('Rose'), null);
    assert.equal(parseAppIcon('../x'), null);
    assert.equal(parseAppIcon(42), null);
  });

  it('is additive and leaves with the account', () => {
    assert.match(APP_ICON_SQL.trim(), /^CREATE TABLE IF NOT EXISTS "AppIconChoice" \(/);
    assert.match(APP_ICON_SQL, /"userId" TEXT PRIMARY KEY REFERENCES "User"\("id"\) ON DELETE CASCADE/);
  });

  it('counts icons, who switched and leaves the team out', () => {
    const out = buildAppIconOverview({
      rows: [
        { userId: 'a', icon: 'classic', changedAt: '2026-10-13T10:00:00Z', seenAt: '2026-10-13T10:00:00Z' },
        { userId: 'b', icon: 'chukurtma', changedAt: '2026-10-13T11:00:00Z', seenAt: '2026-10-13T11:00:00Z' },
        { userId: 'c', icon: 'chukurtma', changedAt: '2026-10-13T12:00:00Z', seenAt: '2026-10-13T12:00:00Z' },
        { userId: 'd', icon: 'neon', changedAt: '2026-10-13T09:00:00Z', seenAt: '2026-10-13T09:00:00Z' },
        { userId: 't', icon: 'gold', changedAt: '2026-10-13T13:00:00Z', seenAt: '2026-10-13T13:00:00Z' },
        { userId: 'x', icon: 'removed-icon', changedAt: '2026-10-13T13:00:00Z', seenAt: '2026-10-13T13:00:00Z' },
      ],
      iphoneIds: ['a', 'b', 'c', 'd', 'e', 't'],
      // An array, as loadTeamUserIds returns it.
      teamIds: ['t'],
      people: new Map([['b', { id: 'b', fullName: 'ნინო' }]]),
    });
    assert.equal(out.kpis.reporting, 4);
    assert.equal(out.kpis.changed, 3);
    assert.equal(out.kpis.changedShare, 75);
    assert.equal(out.kpis.classic, 1);
    assert.equal(out.kpis.iphones, 5);
    assert.deepEqual(out.kpis.top, { id: 'chukurtma', name: 'ჩუქურთმა', count: 2 });
    assert.deepEqual(out.groups, { core: 0, women: 2, styles: 1 });
    assert.equal(out.icons.find((i) => i.id === 'gold').count, 0);
    assert.deepEqual(out.people.map((p) => p.person.id), ['c', 'b', 'd']);
    assert.equal(out.people[1].person.name, 'ნინო');

    const withTeam = buildAppIconOverview({ rows: [{ userId: 't', icon: 'gold', changedAt: '2026-10-13T13:00:00Z' }], teamIds: new Set(['t']), includeTeam: true });
    assert.equal(withTeam.kpis.changed, 1);
    assert.equal(withTeam.people[0].person.team, true);
  });

  it('answers with no reports yet', () => {
    const out = buildAppIconOverview({});
    assert.equal(out.kpis.reporting, 0);
    assert.equal(out.kpis.changedShare, null);
    assert.equal(out.kpis.top, null);
    assert.equal(out.icons.length, APP_ICONS.length);
  });
});
