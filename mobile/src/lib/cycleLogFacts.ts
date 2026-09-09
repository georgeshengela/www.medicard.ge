import type { CycleLog } from '@/lib/api';
import { cycleChipLabel } from '@/lib/cycleLabels';
import {
  alcoholLabel,
  caffeineLabel,
  exerciseLabel,
  formatPainEntry,
  sleepLabel,
  stressLabel,
} from '@/lib/cycleObservations';
import { ka } from '@/i18n/ka';

function isTestResult(value: unknown): value is 'negative' | 'positive' | 'unclear' {
  return value === 'negative' || value === 'positive' || value === 'unclear';
}

export function cycleLogHasFacts(log?: CycleLog | null): boolean {
  if (!log) return false;
  return (
    Boolean(log.flow) ||
    (log.symptoms?.length ?? 0) > 0 ||
    (log.moods?.length ?? 0) > 0 ||
    Boolean(log.sexualActivity) ||
    log.libido != null ||
    log.bbt != null ||
    Boolean(log.cervicalMucus) ||
    isTestResult(log.ovulationTest) ||
    isTestResult(log.pregnancyTest) ||
    Boolean(log.notes?.trim()) ||
    (log.painEntries?.length ?? 0) > 0 ||
    Boolean(log.sleepQuality) ||
    Boolean(log.stressLevel) ||
    Boolean(log.exerciseLevel) ||
    Boolean(log.caffeine) ||
    Boolean(log.alcohol) ||
    (log.customTagIds?.length ?? 0) > 0
  );
}

/** Compact labels for the Today row and the calendar day sheet. */
export function cycleLogFactBits(log?: CycleLog | null): string[] {
  if (!log) return [];
  const bits: string[] = [];
  if (log.flow) bits.push(cycleChipLabel(log.flow));
  for (const entry of log.painEntries ?? []) bits.push(formatPainEntry(entry));
  for (const mood of log.moods ?? []) bits.push(cycleChipLabel(mood));
  const symptoms = log.symptoms ?? [];
  if (symptoms.length === 1) bits.push(cycleChipLabel(symptoms[0]));
  else if (symptoms.length > 1) {
    bits.push(`${cycleChipLabel(symptoms[0])} +${symptoms.length - 1}`);
  }
  if (isTestResult(log.ovulationTest)) {
    bits.push(ka.cycle.a11yOpk(ka.cycle.testResult[log.ovulationTest]));
  }
  if (isTestResult(log.pregnancyTest)) {
    bits.push(ka.cycle.a11yPreg(ka.cycle.testResult[log.pregnancyTest]));
  }
  if (log.bbt != null) bits.push(`BBT ${log.bbt} °C`);
  if (log.cervicalMucus) bits.push(cycleChipLabel(log.cervicalMucus));
  if (log.sexualActivity) bits.push(ka.cycle.loggedSex);
  if (log.libido != null) bits.push(`${ka.cycle.libido} ${log.libido}`);
  if (log.sleepQuality) bits.push(`${ka.cycle.sleep}: ${sleepLabel(log.sleepQuality)}`);
  if (log.stressLevel) bits.push(`${ka.cycle.stress}: ${stressLabel(log.stressLevel)}`);
  if (log.exerciseLevel) bits.push(`${ka.cycle.exercise}: ${exerciseLabel(log.exerciseLevel)}`);
  if (log.caffeine) bits.push(caffeineLabel(log.caffeine));
  if (log.alcohol) bits.push(alcoholLabel(log.alcohol));
  if (log.customTagIds?.length) bits.push(ka.cycle.loggedTagsBit(log.customTagIds.length));
  if (log.notes?.trim()) bits.push(ka.cycle.journalTitle);
  return bits;
}
