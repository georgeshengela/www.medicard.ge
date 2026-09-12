import type { CyclePregnancyDayObservations } from '@/lib/api';
import { cycleChipLabel } from '@/lib/cycleLabels';
import {
  energyLabel,
  formatPainEntry,
  sleepLabel,
  stressLabel,
} from '@/lib/cycleObservations';
import { ka } from '@/i18n/ka';

export const PREGNANCY_QUICK_DIGESTION = [
  'nausea',
  'vomiting',
  'bloating',
  'constipation',
  'diarrhea',
  'heartburn',
] as const;

export const PREGNANCY_QUICK_BODY = [
  'dizziness',
  'swelling',
  'short_breath',
  'frequent_urination',
  'leg_cramps',
] as const;

export const PREGNANCY_QUICK_ENERGY_CHIPS = ['fatigue'] as const;

export const PREGNANCY_PAIN_TYPES = [
  'cramps',
  'pelvic',
  'lower_back',
  'headache',
  'breast',
  'other',
] as const;

export const PREGNANCY_FLOW_OPTIONS = [
  { id: 'none', label: 'არა' },
  { id: 'spotting', label: 'ლაქები' },
  { id: 'light', label: 'მსუბუქი' },
  { id: 'medium', label: 'ზომიერი' },
  { id: 'heavy', label: 'ძლიერი' },
] as const;

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
