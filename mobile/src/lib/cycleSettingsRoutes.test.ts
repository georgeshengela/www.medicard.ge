import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  CYCLE_HISTORY_ACCOUNT_LINE,
  CYCLE_SETTINGS_HUB,
  CYCLE_SETTINGS_SECTIONS,
  cycleSettingsRoute,
  cycleSettingsSection,
} from './cycleSettingsRoutes.ts';

const mobileRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

describe('cycle settings split — routes (W2-9)', () => {
  it('four screens under the hub', () => {
    assert.deepEqual([...CYCLE_SETTINGS_SECTIONS], ['profile', 'reminders', 'privacy', 'data']);
    assert.equal(cycleSettingsRoute('profile'), '/cycle/settings/profile');
    assert.equal(cycleSettingsRoute('reminders'), '/cycle/settings/reminders');
    assert.equal(cycleSettingsRoute('privacy'), '/cycle/settings/privacy');
    assert.equal(cycleSettingsRoute('data'), '/cycle/settings/data');
  });

  it('old section names of the one-page settings land on the right screen', () => {
    const cases: [string, string][] = [
      ['mode', 'profile'],
      ['my-cycle', 'profile'],
      ['myCycle', 'profile'],
      ['last_period', 'profile'],
      ['tracking', 'profile'],
      ['contraception', 'profile'],
      ['conditions', 'profile'],
      ['pregnancy', 'profile'],
      ['postpartum', 'profile'],
      ['notifications', 'reminders'],
      ['mask', 'reminders'],
      ['lock', 'privacy'],
      ['partner', 'privacy'],
      ['share', 'privacy'],
      ['export', 'data'],
      ['calendar', 'data'],
      ['delete', 'data'],
      ['pdf', 'data'],
      ['  Reminders ', 'reminders'],
    ];
    for (const [raw, want] of cases) {
      assert.equal(cycleSettingsSection(raw), want, raw);
      assert.equal(cycleSettingsRoute(raw), `${CYCLE_SETTINGS_HUB}/${want}`, raw);
    }
  });

  it('a missing or unknown section stays on the hub (old `/cycle/settings` links still work)', () => {
    for (const raw of [undefined, null, '', 'nope', 42, ['data', 'x']]) {
      const route = cycleSettingsRoute(raw);
      if (Array.isArray(raw)) assert.equal(route, '/cycle/settings/data');
      else assert.equal(route, CYCLE_SETTINGS_HUB, String(raw));
    }
  });

  it('every route has its screen file and the old single file is gone', () => {
    assert.ok(existsSync(join(mobileRoot, 'app', 'cycle', 'settings', 'index.tsx')));
    for (const section of CYCLE_SETTINGS_SECTIONS) {
      assert.ok(existsSync(join(mobileRoot, 'app', 'cycle', 'settings', `${section}.tsx`)), section);
    }
    assert.ok(!existsSync(join(mobileRoot, 'app', 'cycle', 'settings.tsx')), 'settings.tsx would shadow the folder');
  });

  it('the hub opens a `?section=` link and every row goes through cycleSettingsRoute', () => {
    const hub = readFileSync(join(mobileRoot, 'src', 'components', 'cycle', 'settings', 'CycleSettingsHub.tsx'), 'utf8');
    assert.match(hub, /cycleSettingsSection\(section\)/);
    assert.match(hub, /router\.push\(cycleSettingsRoute\(row\.id\)/);
    for (const section of CYCLE_SETTINGS_SECTIONS) assert.match(hub, new RegExp(`id: '${section}'`));
  });

  it('each screen saves on its own: profile has one pinned save, the switch screens write at once', () => {
    const dir = join(mobileRoot, 'src', 'components', 'cycle', 'settings');
    const profile = readFileSync(join(dir, 'CycleProfileSettings.tsx'), 'utf8');
    assert.match(profile, /KeyboardFormShell/);
    assert.match(profile, /api\.cycle\.updateProfile\(/);
    assert.match(profile, /api\.cycle\.setLastPeriod\(/);
    const reminders = readFileSync(join(dir, 'CycleReminderSettings.tsx'), 'utf8');
    assert.match(reminders, /setCycleReminderPrefs\(patch\)/);
    assert.match(reminders, /syncCycleReminders\(/);
    const privacy = readFileSync(join(dir, 'CyclePrivacySettings.tsx'), 'utf8');
    assert.match(privacy, /updateProfile\(\{ privacyEnabled: on \}\)/);
    assert.match(privacy, /setCyclePrivacyLockEnabled\(on\)/);
    const data = readFileSync(join(dir, 'CycleDataSettings.tsx'), 'utf8');
    for (const call of [/api\.cycle\.exportData\(\)/, /buildCycleIcs\(/, /api\.cycle\.wipeData\(\)/, /'\/cycle\/summary'/]) {
      assert.match(data, call);
    }
  });

  it('the partner card shows no ISO date and has a „გაზიარება“ button', () => {
    const privacy = readFileSync(
      join(mobileRoot, 'src', 'components', 'cycle', 'settings', 'CyclePrivacySettings.tsx'),
      'utf8',
    );
    assert.match(privacy, /formatCycleDateKa\(share\.expiresAt\.slice\(0, 10\)\)/);
    assert.ok(!/\{[^}]*expiresAt\.slice\(0, 10\)\}/.test(privacy), 'the raw ISO date is never rendered');
    assert.match(privacy, /tx\('გაზიარება', 'Share link'\)/);
  });

  it('the data screen says where the history lives; no unreviewed „we never sell“ claim', () => {
    assert.equal(CYCLE_HISTORY_ACCOUNT_LINE.ka, 'ისტორია შენს ანგარიშშია — ახალ ტელეფონზე შესვლისას ყველაფერი ბრუნდება.');
    assert.match(CYCLE_HISTORY_ACCOUNT_LINE.en, /^Your history lives in your account/);
    const data = readFileSync(join(mobileRoot, 'src', 'components', 'cycle', 'settings', 'CycleDataSettings.tsx'), 'utf8');
    assert.match(data, /tx\(CYCLE_HISTORY_ACCOUNT_LINE\.ka, CYCLE_HISTORY_ACCOUNT_LINE\.en\)/);
    const dir = join(mobileRoot, 'src', 'components', 'cycle', 'settings');
    for (const file of ['CycleDataSettings.tsx', 'CyclePrivacySettings.tsx', 'CycleSettingsHub.tsx']) {
      const src = readFileSync(join(dir, file), 'utf8');
      assert.ok(!/არავის ვყიდით|never sell/i.test(src), `${file}: needs legal review first`);
    }
  });
});
