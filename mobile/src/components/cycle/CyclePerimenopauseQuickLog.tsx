import React from 'react';
import { View } from 'react-native';
import {
  CycleChipTiles,
  CycleFlowTiles,
  CycleLevelTiles,
  CycleModeNote,
  CycleModeSection,
  moodChips,
  ONE_CHOICE_HINT,
  PAIN_TAP_HINT,
  symptomChips,
} from '@/components/cycle/CycleModeTiles';
import { CycleIconTile } from '@/components/cycle/CycleIconTile';
import { CyclePainEditor } from '@/components/cycle/CycleObservationFields';
import { CycleObservationAssessment } from '@/components/cycle/CycleObservationAssessment';
import type { CycleLogForm } from '@/components/cycle/CycleLogTabs';
import { ka } from '@/i18n/ka';
import { cycleGlyphFor } from '@/lib/cycleIconMap';
import { ENERGY_LEVELS, energyLabel, SLEEP_QUALITIES, sleepLabel } from '@/lib/cycleObservations';
import { applySymptomChipToggle, PERIMENOPAUSE_DAILY_ASSESSMENT_KEYS } from '@/lib/cycleObservationAssessment';
import { PERI_BODY_MORE, PERI_HEADACHE_SYMPTOMS, PERI_MOODS, PERI_PAIN } from '@/lib/cycleModeQuickLogOptions';

function toggle(list: string[], id: string) {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

/**
 * Perimenopause quick log on tiles (2026-10-03): bleeding drops → the daily yes/no observations →
 * sleep → moods → energy → pain places (with migraine beside them) → body changes. The mode's own
 * lists (`cycleModeQuickLogOptions`) and copy, including „არა დიაგნოზი“ at the end; only the look changed.
 */
export function CyclePerimenopauseQuickLog({
  form,
  onChange,
  assessmentReady = true,
  disabled = false,
}: {
  form: CycleLogForm;
  onChange: (patch: Partial<CycleLogForm>) => void;
  assessmentReady?: boolean;
  disabled?: boolean;
}) {
  return (
    <View>
      <CycleModeSection title={ka.cycle.periBleeding} hint={ONE_CHOICE_HINT()}>
        <CycleFlowTiles value={form.flow} onChange={(flow) => onChange({ flow })} disabled={disabled} />
      </CycleModeSection>

      <View style={{ marginTop: 18 }}>
        <CycleObservationAssessment keys={PERIMENOPAUSE_DAILY_ASSESSMENT_KEYS} form={form} onChange={onChange} ready={assessmentReady} />
      </View>

      <CycleModeSection title={ka.cycle.sleep} hint={ONE_CHOICE_HINT()}>
        <CycleLevelTiles field="sleepQuality" options={SLEEP_QUALITIES} value={form.sleepQuality} onChange={(sleepQuality) => onChange({ sleepQuality })} labelFor={sleepLabel} disabled={disabled} />
      </CycleModeSection>

      <CycleModeSection title={ka.cycle.moods}>
        <CycleChipTiles kind="mood" options={moodChips(PERI_MOODS)} selectedIds={form.moods} onToggle={(id) => onChange({ moods: toggle(form.moods, id) })} disabled={disabled} />
      </CycleModeSection>

      <CycleModeSection title={ka.cycle.energy} hint={ONE_CHOICE_HINT()}>
        <CycleLevelTiles field="energy" options={ENERGY_LEVELS} value={form.energy} onChange={(energy) => onChange({ energy })} labelFor={energyLabel} disabled={disabled} />
      </CycleModeSection>

      <CycleModeSection title={ka.cycle.periPainHeadache} hint={PAIN_TAP_HINT()}>
        <CyclePainEditor
          compact
          typesFirst
          types={PERI_PAIN}
          entries={form.painEntries}
          onChange={(painEntries) => onChange({ painEntries })}
          disabled={disabled}
          trailing={symptomChips(PERI_HEADACHE_SYMPTOMS).map((opt) => (
            <CycleIconTile
              key={opt.id}
              glyph={cycleGlyphFor('symptom', opt.id)}
              label={opt.label}
              selected={form.symptoms.includes(opt.id)}
              disabled={disabled}
              onPress={() => onChange(applySymptomChipToggle(form, opt.id))}
            />
          ))}
        />
      </CycleModeSection>

      <CycleModeSection title={ka.cycle.periBodyChanges}>
        <CycleChipTiles kind="symptom" options={symptomChips(PERI_BODY_MORE)} selectedIds={form.symptoms} onToggle={(id) => onChange(applySymptomChipToggle(form, id))} disabled={disabled} />
        <CycleModeNote>{ka.cycle.periNotDiagnosis}</CycleModeNote>
      </CycleModeSection>
    </View>
  );
}
