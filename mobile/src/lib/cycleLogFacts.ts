import type { CycleLog } from '@/lib/api';
import { cycleChipLabel } from '@/lib/cycleLabels';
import {
  alcoholLabel,
  caffeineLabel,
  energyLabel,
  exerciseLabel,
  formatPainEntry,
  sleepLabel,
  stressLabel,
} from '@/lib/cycleObservations';
import { chipGroup, stripPainManagedSymptoms } from '@/lib/cycleObservationRegistry';
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
    (log.customTagIds?.length ?? 0) > 0 ||
    Boolean(log.energy) ||
    Boolean(log.observations?.energy) ||
    Object.keys(log.observationAssessments || {}).length > 0
  );
}

/** Compact labels for the Today row and the calendar day sheet. */
export function cycleLogFactBits(log?: CycleLog | null): string[] {
  if (!log) return [];
  const bits: string[] = [];
  if (log.flow) bits.push(cycleChipLabel(log.flow));
  for (const entry of log.painEntries ?? []) bits.push(formatPainEntry(entry));
  for (const mood of log.moods ?? []) bits.push(cycleChipLabel(mood));
  const symptoms = stripPainManagedSymptoms(log.symptoms ?? [], log.painEntries);
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
  const energy = log.energy ?? log.observations?.energy;
  if (energy) bits.push(`${ka.cycle.energy}: ${energyLabel(energy)}`);
  if (log.customTagIds?.length) bits.push(ka.cycle.loggedTagsBit(log.customTagIds.length));
  if (log.notes?.trim()) bits.push(ka.cycle.journalTitle);
  return bits;
}

export type CycleFactGroup = { id: string; title: string; bits: string[] };

export function cycleLogFactGroups(
  log?: CycleLog | null,
  { pregnancy = false, perimenopause = false, postpartum = false }: { pregnancy?: boolean; perimenopause?: boolean; postpartum?: boolean } = {},
): CycleFactGroup[] {
  if (!log) return [];
  const buckets: Record<string, string[]> = {
    menstrual: [],
    pain: [],
    physical: [],
    mood: [],
    energy: [],
    digestion: [],
    skin: [],
    fertility: [],
    private: [],
  };
  if (log.flow) {
    if (pregnancy && log.flow === 'spotting') buckets.menstrual.push(ka.cycle.pregnancySpottingRecorded);
    else buckets.menstrual.push(cycleChipLabel(log.flow));
  }
  for (const entry of log.painEntries ?? []) buckets.pain.push(formatPainEntry(entry));
  for (const mood of log.moods ?? []) buckets.mood.push(cycleChipLabel(mood));
  for (const key of stripPainManagedSymptoms(log.symptoms ?? [], log.painEntries)) {
    const group = chipGroup(key);
    if (group === 'private') buckets.private.push(cycleChipLabel(key));
    else if (group === 'digestion') buckets.digestion.push(cycleChipLabel(key));
    else if (group === 'skin') buckets.skin.push(cycleChipLabel(key));
    else if (group === 'energy') buckets.energy.push(cycleChipLabel(key));
    else buckets.physical.push(cycleChipLabel(key));
  }
  const energy = log.energy ?? log.observations?.energy;
  if (energy) buckets.energy.push(`${ka.cycle.energy}: ${energyLabel(energy)}`);
  if (log.sleepQuality) buckets.energy.push(`${ka.cycle.sleep}: ${sleepLabel(log.sleepQuality)}`);
  if (log.stressLevel) buckets.mood.push(`${ka.cycle.stress}: ${stressLabel(log.stressLevel)}`);
  if (isTestResult(log.ovulationTest)) {
    buckets.fertility.push(ka.cycle.loggedOpk(ka.cycle.testResult[log.ovulationTest]));
  }
  if (isTestResult(log.pregnancyTest)) {
    buckets.fertility.push(ka.cycle.loggedPreg(ka.cycle.testResult[log.pregnancyTest]));
  }
  if (log.bbt != null) buckets.fertility.push(`BBT ${log.bbt} °C`);
  if (log.cervicalMucus) buckets.fertility.push(cycleChipLabel(log.cervicalMucus));
  if (log.sexualActivity) buckets.private.push(ka.cycle.loggedSex);
  if (log.libido != null) buckets.private.push(`${ka.cycle.libido} ${log.libido}`);
  if (log.notes?.trim()) buckets.private.push(ka.cycle.journalTitle);
  if (log.customTagIds?.length) buckets.private.push(ka.cycle.loggedTagsBit(log.customTagIds.length));
  if (log.exerciseLevel) buckets.physical.push(`${ka.cycle.exercise}: ${exerciseLabel(log.exerciseLevel)}`);
  if (log.caffeine) buckets.physical.push(caffeineLabel(log.caffeine));
  if (log.alcohol) buckets.physical.push(alcoholLabel(log.alcohol));

  const titles: Record<string, string> = pregnancy
    ? {
        menstrual: ka.cycle.pregnancyBleeding,
        pain: ka.cycle.pain,
        physical: ka.cycle.pregnancyBodyChanges,
        mood: ka.cycle.trackGroup.mood,
        energy: ka.cycle.pregnancyWellness,
        digestion: ka.cycle.pregnancyDigestion,
        skin: ka.cycle.trackGroup.skin,
        fertility: ka.cycle.trackGroup.fertility,
        private: ka.cycle.trackGroup.private,
      }
    : postpartum
      ? {
          menstrual: ka.cycle.postpartumBleeding,
          pain: ka.cycle.pain,
          physical: ka.cycle.trackGroup.physical,
          mood: ka.cycle.trackGroup.mood,
          energy: ka.cycle.trackGroup.energy,
          digestion: ka.cycle.trackGroup.digestion,
          skin: ka.cycle.trackGroup.skin,
          fertility: ka.cycle.trackGroup.fertility,
          private: ka.cycle.trackGroup.private,
        }
    : perimenopause
      ? {
          menstrual: ka.cycle.periBleeding,
          pain: ka.cycle.pain,
          physical: ka.cycle.periBodyChanges,
          mood: ka.cycle.trackGroup.mood,
          energy: ka.cycle.periWellness,
          digestion: ka.cycle.trackGroup.digestion,
          skin: ka.cycle.trackGroup.skin,
          fertility: ka.cycle.trackGroup.fertility,
          private: ka.cycle.trackGroup.private,
        }
    : {
        menstrual: ka.cycle.flow,
        pain: ka.cycle.pain,
        physical: ka.cycle.trackGroup.physical,
        mood: ka.cycle.trackGroup.mood,
        energy: ka.cycle.trackGroup.energy,
        digestion: ka.cycle.trackGroup.digestion,
        skin: ka.cycle.trackGroup.skin,
        fertility: ka.cycle.trackGroup.fertility,
        private: ka.cycle.trackGroup.private,
      };

  const order = pregnancy
    ? ['menstrual', 'pain', 'digestion', 'physical', 'skin', 'energy', 'mood', 'fertility', 'private']
    : postpartum
      ? ['menstrual', 'pain', 'energy', 'mood', 'physical', 'digestion', 'private']
      : perimenopause
        ? ['menstrual', 'physical', 'energy', 'pain', 'private']
        : ['menstrual', 'pain', 'physical', 'mood', 'energy', 'digestion', 'skin', 'fertility', 'private'];

  if (pregnancy) {
    buckets.physical.push(...buckets.digestion.splice(0, buckets.digestion.length));
    buckets.physical.push(...buckets.skin.splice(0, buckets.skin.length));
    if (log.stressLevel) {
      buckets.mood = buckets.mood.filter((bit) => bit !== `${ka.cycle.stress}: ${stressLabel(log.stressLevel)}`);
      buckets.energy.push(`${ka.cycle.stress}: ${stressLabel(log.stressLevel)}`);
    }
  }

  if (perimenopause) {
    buckets.physical.push(...buckets.digestion.splice(0, buckets.digestion.length));
    buckets.physical.push(...buckets.skin.splice(0, buckets.skin.length));
    buckets.energy.push(...buckets.mood.splice(0, buckets.mood.length));
  }

  return order
    .filter((id) => buckets[id]?.length)
    .map((id) => ({ id, title: titles[id], bits: buckets[id] }));
}
