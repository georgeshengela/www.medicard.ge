import type { CyclePregnancyDayObservations } from '@/lib/api';
import { cycleChipLabel } from '@/lib/cycleLabels';
import {
  energyLabel,
  formatPainEntry,
  sleepLabel,
  stressLabel,
} from '@/lib/cycleObservations';
import { ka } from '@/i18n/ka';

// The pregnancy quick-log option lists live in the node-testable `cycleModeQuickLogOptions.ts`.
export {
  PREGNANCY_FLOW_OPTIONS,
  PREGNANCY_PAIN_TYPES,
  PREGNANCY_QUICK_BODY,
  PREGNANCY_QUICK_DIGESTION,
  PREGNANCY_QUICK_ENERGY_CHIPS,
} from '@/lib/cycleModeQuickLogOptions';

function bleedingBit(row: CyclePregnancyDayObservations): string | null {
  if (!row.bleeding) return null;
  if (row.bleeding === 'spotting') return ka.cycle.pregnancySpottingRecorded;
  return `${ka.cycle.pregnancyBleeding} — ${cycleChipLabel(row.bleeding)}`;
}

export function pregnancyObservationLines(
  row: CyclePregnancyDayObservations,
  { includeIntimate = true }: { includeIntimate?: boolean } = {},
): string[] {
  const bits: string[] = [];
  const bleed = bleedingBit(row);
  if (bleed) bits.push(bleed);
  for (const entry of row.pain || []) bits.push(formatPainEntry(entry));
  for (const key of row.symptoms || []) {
    if (!includeIntimate && key === 'discharge') continue;
    bits.push(cycleChipLabel(key));
  }
  if (row.wellness?.energy) bits.push(`${ka.cycle.energy}: ${energyLabel(row.wellness.energy)}`);
  if (row.wellness?.sleepQuality) {
    bits.push(`${ka.cycle.sleep}: ${sleepLabel(row.wellness.sleepQuality)}`);
  }
  if (row.wellness?.stressLevel) {
    bits.push(`${ka.cycle.stress}: ${stressLabel(row.wellness.stressLevel)}`);
  }
  return bits;
}

export function pregnancyTodayHasDisplay(row: CyclePregnancyDayObservations | null | undefined): boolean {
  if (!row) return false;
  return pregnancyObservationLines(row, { includeIntimate: false }).length > 0;
}
