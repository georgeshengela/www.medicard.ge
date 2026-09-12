import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const mobileRoot = join(here, '..', '..');

/**
 * Cycle screens/helpers that must ask capabilities, not scatter mode enums.
 * Domain / transition / notification / settings files are intentionally absent.
 */
const PRESENTATION_FILES = [
  'src/lib/cycleHistoryCopy.js',
  'src/components/cycle/CyclePeriodHistory.tsx',
  'app/cycle/summary.tsx',
  'src/components/cycle/CycleJournalPane.tsx',
  'src/components/cycle/CycleLogTabs.tsx',
  'src/components/cycle/CycleHero.tsx',
  'src/components/cycle/CycleDayDetailsSheet.tsx',
  'src/components/cycle/CycleMoreTracking.tsx',
  'src/components/cycle/CycleQuickLogSheet.tsx',
  'src/components/cycle/CycleObservationAssessment.tsx',
  'src/components/cycle/CycleExposureRateDetail.tsx',
  'src/components/cycle/CycleExposureComparisonDetail.tsx',
  'src/components/cycle/CycleObservationExplainSheet.tsx',
  'src/components/cycle/CycleObservationExplainLinks.tsx',
  'src/components/cycle/CyclePregnancyObservationTrends.tsx',
  'src/components/cycle/CyclePerimenopauseObservationSummaries.tsx',
  'src/components/cycle/CyclePregnancyQuickLog.tsx',
  'src/components/cycle/CyclePerimenopauseQuickLog.tsx',
  'src/components/cycle/CyclePostpartumCard.tsx',
  'src/components/cycle/CyclePostpartumQuickLog.tsx',
  'src/components/cycle/CyclePostpartumJournalSection.tsx',
  'src/components/cycle/CyclePostpartumBleedClassifySheet.tsx',
  'src/components/cycle/CycleCalendar.tsx',
  'src/components/cycle/CycleCalendarLegend.tsx',
  'src/components/cycle/CycleDayStrip.tsx',
  'src/components/home/HomeCyclePreviewCard.tsx',
  'src/lib/cycleAdvice.ts',
  'src/lib/cycleContraception.ts',
  'src/lib/cyclePhase.ts',
  'src/lib/cycleHonesty.ts',
  'app/cycle/index.tsx',
  'src/lib/cycleTtcQuery.js',
  'src/lib/cyclePregnancyQuery.js',
  'src/lib/cyclePostpartumQuery.js',
  'app/cycle/pregnancy/timeline.tsx',
  'app/cycle/pregnancy/care-plan.tsx',
  'src/components/cycle/CyclePregnancyCarePlannerCard.tsx',
  'app/cycle/week/[week].tsx',
];

const SCATTERED =
  /(?:isTtcMode|isPregnancyMode|isPerimenopauseMode|isPostpartumMode)\s*\(|(?:profile\.)?mode\s*(?:===|!==)\s*['"](?:PREGNANCY|TRY_TO_CONCEIVE|PERIMENOPAUSE|TRACK_PERIOD|POSTPARTUM)['"]/;

describe('Cycle presentation files do not scatter mode enums', () => {
  for (const rel of PRESENTATION_FILES) {
    it(rel, () => {
      const src = readFileSync(join(mobileRoot, rel), 'utf8');
      const hit = src.match(SCATTERED);
      assert.equal(hit, null, `${rel} contains ${hit?.[0]}`);
    });
  }

  it('FLOW_OPTIONS spotting chip is Georgian product copy, enum unchanged', () => {
    const src = readFileSync(join(mobileRoot, 'src/constants/cycle.ts'), 'utf8');
    assert.match(src, /id: 'spotting', label: 'ლაქები'/);
    assert.equal(src.includes('მსუბუქი (spotting)'), false);
  });
});
