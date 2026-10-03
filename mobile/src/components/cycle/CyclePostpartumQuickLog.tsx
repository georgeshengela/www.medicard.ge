import React from 'react';
import { View } from 'react-native';
import {
  CycleChipTiles,
  CycleFlowTiles,
  CycleLevelTiles,
  CycleModeSection,
  moodChips,
  ONE_CHOICE_HINT,
  PAIN_TAP_HINT,
  symptomChips,
} from '@/components/cycle/CycleModeTiles';
import { CyclePainEditor } from '@/components/cycle/CycleObservationFields';
import type { CycleLogForm } from '@/components/cycle/CycleLogTabs';
import { ka } from '@/i18n/ka';
import { ENERGY_LEVELS, energyLabel, SLEEP_QUALITIES, sleepLabel } from '@/lib/cycleObservations';
import { POSTPARTUM_BODY_KEYS, POSTPARTUM_DIGEST_KEYS, POSTPARTUM_MOOD_KEYS, POSTPARTUM_PAIN_TYPES } from '@/lib/cycleModeQuickLogOptions';
import { PREGNANCY_FLOW_OPTIONS } from '@/lib/pregnancyObservationPresent';

function toggleList(list: string[], id: string) {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

/**
 * Postpartum quick log on tiles (2026-10-03): bleeding drops → sleep → moods → energy → pain places
 * with strength by re-tap → body → digestion. The postpartum mode's own short lists
 * (`cycleModeQuickLogOptions`) and copy; only the look changed.
 */
export function CyclePostpartumQuickLog({
  form,
  onChange,
  disabled = false,
}: {
  form: CycleLogForm;
  onChange: (patch: Partial<CycleLogForm>) => void;
  disabled?: boolean;
}) {
  return (
    <View>
      <CycleModeSection title={ka.cycle.postpartumBleeding} hint={ONE_CHOICE_HINT()}>
        <CycleFlowTiles value={form.flow} onChange={(flow) => onChange({ flow })} options={PREGNANCY_FLOW_OPTIONS} disabled={disabled} />
      </CycleModeSection>

      <CycleModeSection title={ka.cycle.sleep} hint={ONE_CHOICE_HINT()}>
        <CycleLevelTiles field="sleepQuality" options={SLEEP_QUALITIES} value={form.sleepQuality} onChange={(sleepQuality) => onChange({ sleepQuality })} labelFor={sleepLabel} disabled={disabled} />
      </CycleModeSection>

      <CycleModeSection title={ka.cycle.moods}>
        <CycleChipTiles kind="mood" options={moodChips(POSTPARTUM_MOOD_KEYS)} selectedIds={form.moods} onToggle={(id) => onChange({ moods: toggleList(form.moods, id) })} disabled={disabled} />
      </CycleModeSection>

      <CycleModeSection title={ka.cycle.energy} hint={ONE_CHOICE_HINT()}>
        <CycleLevelTiles field="energy" options={ENERGY_LEVELS} value={form.energy} onChange={(energy) => onChange({ energy })} labelFor={energyLabel} disabled={disabled} />
      </CycleModeSection>

      <CycleModeSection title={ka.cycle.pain} hint={PAIN_TAP_HINT()}>
        <CyclePainEditor compact typesFirst types={POSTPARTUM_PAIN_TYPES} entries={form.painEntries} onChange={(painEntries) => onChange({ painEntries })} disabled={disabled} />
      </CycleModeSection>

      <CycleModeSection title={ka.cycle.trackGroup.physical}>
        <CycleChipTiles kind="symptom" options={symptomChips(POSTPARTUM_BODY_KEYS)} selectedIds={form.symptoms} onToggle={(id) => onChange({ symptoms: toggleList(form.symptoms, id) })} disabled={disabled} />
      </CycleModeSection>

      <CycleModeSection title={ka.cycle.trackGroup.digestion}>
        <CycleChipTiles kind="symptom" options={symptomChips(POSTPARTUM_DIGEST_KEYS)} selectedIds={form.symptoms} onToggle={(id) => onChange({ symptoms: toggleList(form.symptoms, id) })} disabled={disabled} />
      </CycleModeSection>
    </View>
  );
}
