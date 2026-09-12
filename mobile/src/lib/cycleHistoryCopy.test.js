import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assertPostpartumEmptyCopySafe,
  copyContainsForbiddenPostpartumBleedClass,
  copyContainsMenstrualAssumption,
  cycleHistoryPresentation,
  cycleJournalEmptyStrings,
  cycleLoggedBleedLabel,
  cyclePresentationModeKnown,
  cycleSummaryEmptyStrings,
} from './cycleHistoryCopy.js';
import { calendarDayA11y, classifyCycleDay } from './cyclePresentation.js';
import { POSTPARTUM_FETCH_IDLE, POSTPARTUM_FETCH_LOADING, postpartumEmptyCopyAllowed } from './cyclePostpartumQuery.js';
import { buildCyclePostpartumData, POSTPARTUM_TRACKING_CONTEXT } from '../../../server/src/lib/cyclePostpartum.js';
import { filterLogsForEngine } from '../../../server/src/lib/cycleHistoryQuery.js';
import { profileModeForAiPrompt } from '../../../server/src/lib/cycleModes.js';
import { DOCTOR_SUMMARY_COPY } from '../i18n/cycle/doctorSummary.js';

const here = dirname(fileURLToPath(import.meta.url));
const mobileRoot = join(here, '..', '..');

const COPY = {
  journalEmptyTitle: 'დღიური ჯერ ცარიელია',
  journalEmptyBody:
    'აღრიცხე მენსტრუაცია და სიმპტომები — აქ გამოჩნდება შენი ციკლების ისტორია, საშუალო მაჩვენებლები და განმეორებადი ნიშნები.',
  periodHistoryEmpty: 'ჯერ არ არის აღრიცხული მენსტრუაცია.',
  periodHistoryEmptyHint: 'დაიწყე მენსტრუაცია დღეს ან დაამატე წარსული დღე.',
  addMissedPeriod: 'გამოტოვებული მენსტრუაცია',
  postpartumJournalTitle: 'მშობიარობის შემდგომი ჩანაწერები',
  postpartumJournalEmpty: 'ამ თვალთვალის ინტერვალში ჩანაწერი ჯერ არ არის.',
  postpartumAddLog: 'ჩანაწერის დამატება',
  postpartumBleeding: 'სისხლდენა',
  legendPeriod: 'მენსტრუაცია',
  logged: 'აღრიცხული',
};

describe('Phase 40 postpartum copy isolation', () => {
  it('A: POSTPARTUM empty journal is neutral', () => {
    const rendered = cycleJournalEmptyStrings('POSTPARTUM', COPY);
    assert.equal(rendered.pending, false);
    assert.equal(copyContainsMenstrualAssumption(rendered.strings.join('\n')), false);
    assert.ok(rendered.strings.includes(COPY.postpartumJournalEmpty));
    assert.ok(rendered.strings.includes(COPY.postpartumAddLog));
    assertPostpartumEmptyCopySafe(rendered.strings);
  });

  it('B: TRACK empty journal keeps menstruation copy', () => {
    const rendered = cycleJournalEmptyStrings('TRACK_PERIOD', COPY);
    assert.ok(rendered.strings.includes(COPY.journalEmptyBody));
    assert.equal(copyContainsMenstrualAssumption(COPY.journalEmptyBody), true);
    const summary = cycleSummaryEmptyStrings('TRACK_PERIOD', COPY);
    assert.ok(summary.strings.includes(COPY.periodHistoryEmpty));
    assert.equal(cycleHistoryPresentation('TRACK_PERIOD').showPeriodHistory, true);
  });

  it('C: TTC period-history semantics stay on', () => {
    const ttc = cycleHistoryPresentation('TRY_TO_CONCEIVE');
    assert.equal(ttc.showPeriodHistory, true);
    assert.equal(ttc.showClassicJournalEmpty, true);
    assert.equal(ttc.usePostpartumBleedLabel, false);
    assert.equal(cycleLoggedBleedLabel('TRY_TO_CONCEIVE', COPY), COPY.legendPeriod);
  });

  it('D: PREGNANCY does not receive postpartum empty copy', () => {
    const rendered = cycleJournalEmptyStrings('PREGNANCY', COPY);
    assert.equal(rendered.strings.includes(COPY.postpartumJournalEmpty), false);
    assert.equal(cycleHistoryPresentation('PREGNANCY').showPostpartumJournal, false);
  });

  it('E: PERIMENOPAUSE does not receive postpartum empty copy', () => {
    const rendered = cycleJournalEmptyStrings('PERIMENOPAUSE', COPY);
    assert.equal(rendered.strings.includes(COPY.postpartumJournalEmpty), false);
    assert.equal(cycleHistoryPresentation('PERIMENOPAUSE').showPostpartumJournal, false);
  });

  it('F: postpartum bleed label is სისხლდენა, not menstruation/lochia/hemorrhage', () => {
    assert.equal(cycleLoggedBleedLabel('POSTPARTUM', COPY), 'სისხლდენა');
    assert.equal(copyContainsMenstrualAssumption(COPY.postpartumBleeding), false);
    assert.equal(copyContainsForbiddenPostpartumBleedClass(COPY.postpartumBleeding), false);
    const a11y = calendarDayA11y({
      dayLabel: '11 სექტემბერი',
      isToday: true,
      isSelected: false,
      layers: classifyCycleDay({ flow: 'heavy' }, { showPredicted: false, showFertility: false }),
      copy: {
        today: 'დღეს',
        selected: 'არჩეული',
        loggedPeriod: COPY.postpartumBleeding,
        spotting: 'ლაქები',
        predictedPeriod: 'სავარაუდო მენსტრუაცია',
        fertile: 'სავარაუდო ნაყოფიერი',
        ovulation: 'სავარაუდო ოვულაცია',
        symptoms: 'აღრიცხული',
      },
    });
    assert.match(a11y, /სისხლდენა/);
    assert.doesNotMatch(a11y, /მენსტრუაცია/);
  });

  it('K: POSTPARTUM summary empty does not use period-history empty card', () => {
    const rendered = cycleSummaryEmptyStrings('POSTPARTUM', COPY);
    assert.deepEqual(rendered.strings, []);
    assert.equal(cycleHistoryPresentation('POSTPARTUM').showPeriodHistory, false);
    assert.equal(cycleHistoryPresentation('POSTPARTUM').showPmsPattern, false);
  });

  it('H/I: current postpartum journal uses episode-stamped logs only', () => {
    const data = buildCyclePostpartumData({
      today: '2026-09-11',
      profile: { mode: 'POSTPARTUM' },
      episode: { id: 'pp-new', status: 'ACTIVE', referenceDate: '2026-08-19' },
      logs: [
        { date: '2026-07-01', flow: 'heavy' },
        { date: '2026-09-10', flow: 'medium', postpartumEpisodeId: 'pp-old' },
        {
          date: '2026-09-11',
          flow: 'light',
          trackingContext: POSTPARTUM_TRACKING_CONTEXT,
          postpartumEpisodeId: 'pp-new',
          symptoms: ['fatigue'],
        },
      ],
    });
    assert.equal(data.recentLogs.length, 1);
    assert.equal(data.recentLogs[0].date, '2026-09-11');
    assert.equal(data.recentLogs[0].flow, 'light');
    assert.equal(
      data.recentLogs.some((row) => row.date === '2026-07-01'),
      false,
    );
  });

  it('J: ended episode logs are not current postpartum history', () => {
    const data = buildCyclePostpartumData({
      today: '2026-09-11',
      profile: { mode: 'POSTPARTUM' },
      episode: { id: 'pp-2', status: 'ACTIVE', referenceDate: '2026-09-01' },
      logs: [
        {
          date: '2026-08-20',
          flow: 'heavy',
          trackingContext: POSTPARTUM_TRACKING_CONTEXT,
          postpartumEpisodeId: 'pp-1',
        },
        {
          date: '2026-09-05',
          flow: 'medium',
          trackingContext: POSTPARTUM_TRACKING_CONTEXT,
          postpartumEpisodeId: 'pp-2',
          energy: 'low',
        },
      ],
    });
    assert.deepEqual(
      data.recentLogs.map((row) => row.date),
      ['2026-09-05'],
    );
  });

  it('Z: unknown/pending mode does not flash TRACK menstrual empty copy', () => {
    assert.equal(cyclePresentationModeKnown(null), false);
    assert.equal(cyclePresentationModeKnown(undefined), false);
    assert.equal(cyclePresentationModeKnown('TRACK_PERIOD'), true);
    const pending = cycleJournalEmptyStrings(null, COPY);
    assert.equal(pending.pending, true);
    assert.deepEqual(pending.strings, []);
    assert.equal(cycleHistoryPresentation(null).showClassicJournalEmpty, false);
    assert.equal(cycleLoggedBleedLabel(null, COPY), COPY.logged);
    assert.equal(postpartumEmptyCopyAllowed(POSTPARTUM_FETCH_IDLE), false);
    assert.equal(postpartumEmptyCopyAllowed(POSTPARTUM_FETCH_LOADING), false);
  });

  it('Q: Phase 38 AI fail-closed is unchanged', () => {
    assert.equal(profileModeForAiPrompt('POSTPARTUM'), null);
    assert.equal(profileModeForAiPrompt('TRACK_PERIOD'), 'TRACK_PERIOD');
    assert.equal(profileModeForAiPrompt('PERIMENOPAUSE'), 'TRACK_PERIOD');
  });

  it('R: forecast input isolation is unchanged', () => {
    const logs = [
      { date: '2026-09-11', flow: 'heavy', trackingContext: POSTPARTUM_TRACKING_CONTEXT },
      { date: '2026-07-01', flow: 'medium' },
    ];
    const engine = filterLogsForEngine(logs, '2026-09-11');
    assert.equal(engine.length, 1);
    assert.equal(engine[0].date, '2026-07-01');
  });

  it('P: Phase 39 doctor-summary locale headings are unchanged', () => {
    assert.equal(DOCTOR_SUMMARY_COPY.ka.menstrualOn, 'მენსტრუაციის ისტორია');
    assert.equal(DOCTOR_SUMMARY_COPY.en.menstrualOn, 'Menstrual history');
    assert.equal(DOCTOR_SUMMARY_COPY.fr.menstrualOn, 'Historique menstruel');
    assert.equal(DOCTOR_SUMMARY_COPY.ru.menstrualOn, 'Менструальный анамнез');
  });

  it('75: TRACK period empty strings still exist in Georgian locale (no mass replace)', () => {
    const kaSrc = readFileSync(join(mobileRoot, 'src/i18n/ka.ts'), 'utf8');
    assert.match(kaSrc, /periodHistoryEmpty: 'ჯერ არ არის აღრიცხული მენსტრუაცია\.'/);
    assert.match(kaSrc, /journalEmptyBody:\s*\n\s*'აღრიცხე მენსტრუაცია/);
    assert.match(kaSrc, /postpartumBleeding: 'სისხლდენა'/);
    assert.equal(kaSrc.includes("postpartumBleeding: 'მენსტრუაცია'"), false);
    assert.equal(kaSrc.includes('ლოხია'), false);
  });

  it('Phase 41 owner-classification copy is user-entered, not a diagnosis', () => {
    const kaSrc = readFileSync(join(mobileRoot, 'src/i18n/ka.ts'), 'utf8');
    assert.match(kaSrc, /postpartumClassifyPeriod: 'ეს ჩემი მენსტრუაცია იყო'/);
    assert.match(kaSrc, /postpartumClassifiedBadge: 'შენ მონიშნე როგორც მენსტრუაცია'/);
    assert.match(kaSrc, /postpartumUnclassify: 'მონიშვნის გაუქმება'/);
    assert.equal(kaSrc.includes('Medicard detected'), false);
    assert.equal(kaSrc.includes('ნაყოფიერება დაბრუნ'), false);
    assert.equal(kaSrc.includes('ოვულაცია დაბრუნ'), false);
    assert.equal(copyContainsForbiddenPostpartumBleedClass('ეს ჩემი მენსტრუაცია იყო'), false);
    assert.equal(copyContainsForbiddenPostpartumBleedClass('შენ მონიშნე როგორც მენსტრუაცია'), false);
    assert.equal(copyContainsForbiddenPostpartumBleedClass('მენსტრუაცია დაბრუნდა'), true);
  });

  it('shared Journal/summary screens use the copy presenter', () => {
    const journal = readFileSync(join(mobileRoot, 'src/components/cycle/CycleJournalPane.tsx'), 'utf8');
    const summary = readFileSync(join(mobileRoot, 'app/cycle/summary.tsx'), 'utf8');
    const history = readFileSync(join(mobileRoot, 'src/components/cycle/CyclePeriodHistory.tsx'), 'utf8');
    assert.match(journal, /cycleHistoryPresentation/);
    assert.match(journal, /showClassicJournalEmpty/);
    assert.match(summary, /showPeriodHistory/);
    assert.match(history, /showPeriodHistory/);
    assert.equal(journal.includes("mode === 'POSTPARTUM'"), false);
    assert.equal(summary.includes("mode === 'POSTPARTUM'"), false);
  });

  it('copy-audit artifact lists postpartum-reachable strings', () => {
    const audit = JSON.parse(
      readFileSync(join(mobileRoot, '..', 'qa', 'cycle-phase40-postpartum-copy', 'copy-audit.json'), 'utf8'),
    );
    assert.equal(audit.phase, 40);
    assert.ok(Array.isArray(audit.strings));
    assert.ok(audit.strings.length >= 12);
    assert.ok(audit.strings.some((row) => row.key === 'ka.cycle.periodHistoryEmpty'));
    assert.ok(audit.strings.some((row) => row.action.includes('Hide')));
  });
});
