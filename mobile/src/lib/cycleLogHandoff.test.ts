import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  CYCLE_LOG_HANDOFF_TTL_MS,
  CYCLE_LOG_NOTE_MAX,
  CYCLE_LOG_NOTE_PARAM,
  clearCycleLogHandoff,
  cycleLogNoteParams,
  hasCycleLogNoteMarker,
  stageCycleLogNote,
  takeCycleLogNote,
} from './cycleLogHandoff.ts';
import { resolveInsightAction } from './cycleInsightActions.ts';

const mobileRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const NOTE = 'სპაზმები დილით — თბილი პაკი დამეხმარა';

describe('cycle log hand-off — drafted note in memory (W2-9)', () => {
  it('is taken once by the account that staged it', () => {
    clearCycleLogHandoff();
    assert.equal(stageCycleLogNote('u1', NOTE, 1000), true);
    assert.equal(takeCycleLogNote('u1', 1500), NOTE);
    assert.equal(takeCycleLogNote('u1', 1600), null);
  });

  it('another account finds nothing and the note is gone for the owner too', () => {
    stageCycleLogNote('u1', NOTE, 0);
    assert.equal(takeCycleLogNote('u2', 10), null);
    assert.equal(takeCycleLogNote('u1', 20), null);
  });

  it('expires after one minute', () => {
    stageCycleLogNote('u1', NOTE, 0);
    assert.equal(takeCycleLogNote('u1', CYCLE_LOG_HANDOFF_TTL_MS + 1), null);
    stageCycleLogNote('u1', NOTE, 0);
    assert.equal(takeCycleLogNote('u1', CYCLE_LOG_HANDOFF_TTL_MS), NOTE);
  });

  it('no account or an empty note stages nothing (and clears an older one)', () => {
    stageCycleLogNote('u1', NOTE, 0);
    assert.equal(stageCycleLogNote(null, NOTE, 0), false);
    assert.equal(takeCycleLogNote('u1', 1), null);
    assert.equal(stageCycleLogNote('u1', '   ', 0), false);
    assert.equal(takeCycleLogNote('u1', 1), null);
  });

  it('a new stage replaces the old one; long notes are cut to the server bound', () => {
    stageCycleLogNote('u1', 'old', 0);
    stageCycleLogNote('u1', 'x'.repeat(CYCLE_LOG_NOTE_MAX + 50), 0);
    assert.equal(takeCycleLogNote('u1', 1)?.length, CYCLE_LOG_NOTE_MAX);
  });

  it('the route params are only the marker — never the text', () => {
    clearCycleLogHandoff();
    const params = cycleLogNoteParams('u1', NOTE, 0);
    assert.deepEqual(params, { [CYCLE_LOG_NOTE_PARAM]: '1' });
    assert.ok(!JSON.stringify(params).includes('სპაზმ'));
    assert.equal(takeCycleLogNote('u1', 5), NOTE);
    assert.deepEqual(cycleLogNoteParams(null, NOTE, 0), {});
    assert.deepEqual(cycleLogNoteParams('u1', '', 0), {});
  });

  it('reads the marker from a string or an array param', () => {
    assert.equal(hasCycleLogNoteMarker('1'), true);
    assert.equal(hasCycleLogNoteMarker(['1']), true);
    assert.equal(hasCycleLogNoteMarker(undefined), false);
    assert.equal(hasCycleLogNoteMarker('სპაზმები'), false);
  });
});

describe('cycle tips open the log without health text in the route', () => {
  const card = (over: Record<string, unknown>) =>
    ({ id: 'phase-tip', title: 'დღის აღრიცხვა', body: 'აღრიცხე დღე', tone: 'care', action: 'ჩაიწერე სპაზმები', ...over }) as never;

  it('open_log carries the tip as logNote, the route has no note text', () => {
    const plan = resolveInsightAction(card({}));
    assert.equal(plan.kind, 'open_log');
    assert.equal(plan.route?.pathname, '/cycle/log');
    assert.equal(plan.logNote, 'ჩაიწერე სპაზმები');
    assert.ok(!JSON.stringify(plan.route).includes('სპაზმ'), JSON.stringify(plan.route));
  });

  it('open_log_bbt keeps its tab, the note goes through memory', () => {
    const plan = resolveInsightAction(card({ id: 'x', title: 'BBT', body: 'ტემპერატურა', action: '' }));
    assert.equal(plan.kind, 'open_log_bbt');
    assert.deepEqual(plan.route?.params, { tab: 'more' });
    assert.ok(plan.logNote);
  });

  it('the last-period tip opens the profile screen of the split settings', () => {
    const plan = resolveInsightAction(card({ id: 'x', title: 'ბოლო მენსტრუაცია', body: 'განაახლე', action: '' }));
    assert.equal(plan.kind, 'open_settings');
    assert.equal(plan.route?.pathname, '/cycle/settings/profile');
  });
});

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(tsx?|jsx?)$/.test(name) && !/\.test\./.test(name) ? [path] : [];
  });
}

describe('source guard — cycle files never put a drafted note in a URL', () => {
  const files = [
    ...sources(join(mobileRoot, 'app', 'cycle')),
    ...sources(join(mobileRoot, 'src', 'components', 'cycle')),
    ...readdirSync(join(mobileRoot, 'src', 'lib'))
      .filter((name) => /^cycle.*\.(tsx?|jsx?)$/.test(name) && !/\.test\./.test(name))
      .map((name) => join(mobileRoot, 'src', 'lib', name)),
  ];

  it('scans the cycle screens, components and libs', () => {
    assert.ok(files.length > 50, String(files.length));
  });

  it('no prefillNote param — not as a query string, not as a route-param key', () => {
    const offenders = files.filter((file) => {
      const src = readFileSync(file, 'utf8');
      return /prefillNote\s*=\s*\$\{|prefillNote=['"`]?\s*\+|prefillNote\s*:\s*[^\s'"]/.test(src) || /[?&]prefillNote=/.test(src);
    });
    assert.deepEqual(offenders.map((file) => relative(mobileRoot, file)), []);
  });

  it('the insight sheet stages the note and the log screen takes it once', () => {
    const sheet = readFileSync(join(mobileRoot, 'src', 'components', 'cycle', 'CycleInsightDetailSheet.tsx'), 'utf8');
    assert.match(sheet, /cycleLogNoteParams\(user\?\.id, logNote\)/);
    const log = readFileSync(join(mobileRoot, 'app', 'cycle', 'log.tsx'), 'utf8');
    assert.match(log, /takeCycleLogNote\(user\.id\)/);
    assert.ok(!/prefillNote/.test(log), 'log.tsx no longer reads a note from the URL');
  });
});
