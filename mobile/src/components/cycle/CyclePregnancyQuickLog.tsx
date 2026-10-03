import React from 'react';
import { View } from 'react-native';
import {
  CycleChipTiles,
  CycleFlowTiles,
  CycleLevelTiles,
  CycleModeNote,
  CycleModeSection,
  CycleModeSubtitle,
  CyclePregnancyChecklistTiles,
  ONE_CHOICE_HINT,
  PAIN_TAP_HINT,
  symptomChips,
} from '@/components/cycle/CycleModeTiles';
import { CyclePainEditor } from '@/components/cycle/CycleObservationFields';
import { CycleObservationAssessment } from '@/components/cycle/CycleObservationAssessment';
import type { CycleLogForm } from '@/components/cycle/CycleLogTabs';
import { ka } from '@/i18n/ka';
import { tx } from '@/i18n/locale';
import { ENERGY_LEVELS, energyLabel, SLEEP_QUALITIES, sleepLabel, STRESS_LEVELS, stressLabel } from '@/lib/cycleObservations';
import { applySymptomChipToggle, PREGNANCY_DAILY_ASSESSMENT_KEYS } from '@/lib/cycleObservationAssessment';
import { togglePregnancyChecklist } from '@/lib/cycleObservationRegistry';
import {
  PREGNANCY_FLOW_OPTIONS,
  PREGNANCY_PAIN_TYPES,
  PREGNANCY_QUICK_BODY,
  PREGNANCY_QUICK_DIGESTION,
} from '@/lib/pregnancyObservationPresent';

/**
 * Pregnancy quick log on tiles (2026-10-03): bleeding drops → the three daily yes/no observations →
 * pain places with strength by re-tap → digestion → energy / sleep / stress as level tiles → common
 * body changes → the day's checklist (vitamins, water, walk, visits — W2-12b, stored on the server as
 * `observations.pregnancyChecklist`). The option lists and copy are the pregnancy mode's own.
 */
export function CyclePregnancyQuickLog({
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
  const digestion = PREGNANCY_QUICK_DIGESTION.filter((id) => !(PREGNANCY_DAILY_ASSESSMENT_KEYS as readonly string[]).includes(id));

  return (
    <View>
      <CycleModeSection title={ka.cycle.pregnancyBleeding} hint={ONE_CHOICE_HINT()}>
        <CycleFlowTiles value={form.flow} onChange={(flow) => onChange({ flow })} options={PREGNANCY_FLOW_OPTIONS} hint={ka.cycle.pregnancyFlowHint} disabled={disabled} />
      </CycleModeSection>

      <View style={{ marginTop: 18 }}>
        <CycleObservationAssessment keys={PREGNANCY_DAILY_ASSESSMENT_KEYS} form={form} onChange={onChange} ready={assessmentReady} />
      </View>

      <CycleModeSection title={ka.cycle.pain} hint={PAIN_TAP_HINT()}>
        <CyclePainEditor compact typesFirst types={PREGNANCY_PAIN_TYPES} entries={form.painEntries} onChange={(painEntries) => onChange({ painEntries })} disabled={disabled} />
      </CycleModeSection>

      <CycleModeSection title={ka.cycle.pregnancyDigestion}>
        <CycleChipTiles kind="symptom" options={symptomChips(digestion)} selectedIds={form.symptoms} onToggle={(id) => onChange(applySymptomChipToggle(form, id))} disabled={disabled} />
      </CycleModeSection>

      <CycleModeSection title={ka.cycle.pregnancyEnergyFatigue}>
        <CycleModeNote>{ka.cycle.energyVsFatigueHint}</CycleModeNote>
        <CycleModeSubtitle>{ka.cycle.energy}</CycleModeSubtitle>
        <CycleLevelTiles field="energy" options={ENERGY_LEVELS} value={form.energy} onChange={(energy) => onChange({ energy })} labelFor={energyLabel} disabled={disabled} />
        <CycleModeSubtitle>{ka.cycle.sleep}</CycleModeSubtitle>
        <CycleLevelTiles field="sleepQuality" options={SLEEP_QUALITIES} value={form.sleepQuality} onChange={(sleepQuality) => onChange({ sleepQuality })} labelFor={sleepLabel} disabled={disabled} />
        <CycleModeSubtitle>{ka.cycle.stress}</CycleModeSubtitle>
        <CycleLevelTiles field="stressLevel" options={STRESS_LEVELS} value={form.stressLevel} onChange={(stressLevel) => onChange({ stressLevel })} labelFor={stressLabel} disabled={disabled} />
      </CycleModeSection>

      <CycleModeSection title={ka.cycle.pregnancyCommonBody}>
        <CycleChipTiles kind="symptom" options={symptomChips(PREGNANCY_QUICK_BODY)} selectedIds={form.symptoms} onToggle={(id) => onChange(applySymptomChipToggle(form, id))} disabled={disabled} />
      </CycleModeSection>

      <CycleModeSection title={tx('დღის ჩეკლისტი', 'Checklist for the day')} hint={tx('რამდენიც გინდა', 'tick any')}>
        <CyclePregnancyChecklistTiles
          selectedIds={form.pregnancyChecklist ?? []}
          onToggle={(id) => onChange({ pregnancyChecklist: togglePregnancyChecklist(form.pregnancyChecklist, id) })}
          disabled={disabled}
        />
      </CycleModeSection>
    </View>
  );
}
