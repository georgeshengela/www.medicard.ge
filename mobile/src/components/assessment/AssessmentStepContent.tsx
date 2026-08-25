import React from 'react';
import { Dimensions, Image, ImageSourcePropType, Pressable, Text, TextInput, View } from 'react-native';
import {
  Activity,
  Bot,
  HeartPulse,
  Plus,
  Smartphone,
  Stethoscope,
} from 'lucide-react-native';
import { HealthGoalOption, HEALTH_GOAL_KEYS } from '@/components/assessment/HealthGoalOption';
import { BloodTypeSelector } from '@/components/assessment/BloodTypeSelector';
import { BodyTypeCarousel } from '@/components/assessment/BodyTypeCarousel';
import { FitnessLevelSlider } from '@/components/assessment/FitnessLevelSlider';
import { GenderSelector } from '@/components/assessment/GenderSelector';
import { LabelWheelPicker } from '@/components/assessment/LabelWheelPicker';
import { MoodCarousel } from '@/components/assessment/MoodCarousel';
import { DietChoiceGrid } from '@/components/assessment/DietChoiceGrid';
import { SegmentScale } from '@/components/assessment/SegmentScale';
import { SmokingChoiceList } from '@/components/assessment/SmokingChoiceList';
import { UnitSegment } from '@/components/assessment/UnitSegment';
import { isLatinUnitLabel, unitLabelFontFamily } from '@/components/assessment/unitLabelFont';
import { WeightRulerPicker } from '@/components/assessment/WeightRulerPicker';
import {
  cmToInches,
  formatHeightInches,
  HEIGHT_CM_VALUES,
  HEIGHT_IN_VALUES,
  HeightWheelPicker,
  inchesToCm,
} from '@/components/assessment/HeightWheelPicker';
import { DateWheelPicker } from '@/components/assessment/DateWheelPicker';
import { AllergyPicker } from '@/components/assessment/AllergyPicker';
import { MedicationPicker } from '@/components/assessment/MedicationPicker';
import { ASSESSMENT } from '@/constants/assessmentLayout';
import type { AssessmentStep } from '@/constants/assessmentSteps';
import {
  ILLUSTRATION_SOURCES,
  MOOD_KEYS,
  moodImage,
} from '@/constants/illustrationAssets';
import { ka } from '@/i18n/ka';
import { ageFromForm, type AssessmentFormState } from '@/lib/assessmentForm';
import { lightColors } from '@/theme/colors';

type Props = {
  step: AssessmentStep;
  form: AssessmentFormState;
  onChange: (patch: Partial<AssessmentFormState>) => void;
  onAutoAdvance?: (patch: Partial<AssessmentFormState>) => void;
};

const WEIGHT_KG = Array.from({ length: 166 }, (_, i) => 35 + i);
const WEIGHT_LBS = Array.from({ length: 321 }, (_, i) => 80 + i); // 80–400 lbs (Figma ruler)
const LBS_PER_KG = 2.2046226218;
const SCREEN_W = Dimensions.get('window').width;

function weightDisplayLbs(weightKg: number) {
  return Math.round(weightKg * LBS_PER_KG);
}

function weightKgFromLbs(lbs: number) {
  return lbs / LBS_PER_KG;
}

const GOAL_ICONS: Record<string, React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>> = {
  overall: Plus,
  metrics: HeartPulse,
  ai: Bot,
  sports: Activity,
  try: Smartphone,
};

function optionLabel(group: string, value: string): string {
  const g = (ka.assessment.options as Record<string, Record<string, string>>)[group];
  return g?.[value] ?? value;
}

function CardOption({
  active,
  title,
  subtitle,
  onPress,
  icon: Icon,
  image,
}: {
  active: boolean;
  title: string;
  subtitle?: string;
  onPress: () => void;
  icon?: React.ComponentType<{ size?: number; color?: string }>;
  image?: ImageSourcePropType;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        borderRadius: ASSESSMENT.cardRadius,
        borderWidth: active ? 2 : 1,
        borderColor: active ? lightColors.primary200 : ASSESSMENT.border,
        backgroundColor: ASSESSMENT.surface,
        paddingHorizontal: 16,
        paddingVertical: 16,
        minHeight: 72,
      }}
    >
      {image ? (
        <Image source={image} resizeMode="contain" style={{ width: 36, height: 36 }} />
      ) : Icon ? (
        <Icon size={22} color={active ? lightColors.primary100 : '#94A3B8'} />
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 16, color: ASSESSMENT.text }}>{title}</Text>
        {subtitle ? (
          <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13, color: ASSESSMENT.muted, marginTop: 4 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 6,
          borderWidth: active ? 0 : 1.5,
          borderColor: '#D1D5DB',
          backgroundColor: active ? lightColors.primary200 : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {active ? <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>✓</Text> : null}
      </View>
    </Pressable>
  );
}

function GateActions({
  yesLabel,
  noLabel,
  onYes,
  onNo,
}: {
  yesLabel: string;
  noLabel: string;
  onYes: () => void;
  onNo: () => void;
}) {
  return (
    <View style={{ flex: 1, justifyContent: 'flex-end', gap: 16, paddingBottom: 4 }}>
      <Pressable
        onPress={onYes}
        style={{
          height: 52,
          borderRadius: ASSESSMENT.cardRadius,
          backgroundColor: lightColors.primary200,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 17, color: '#FFFFFF' }}>{yesLabel}</Text>
      </Pressable>
      <Pressable onPress={onNo} style={{ alignItems: 'center', paddingVertical: 12 }}>
        <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 16, color: lightColors.primary200 }}>
          {noLabel}
        </Text>
      </Pressable>
    </View>
  );
}

export function AssessmentStepContent({ step, form, onChange, onAutoAdvance }: Props) {
  switch (step.type) {
    case 'intro':
      return null;

    case 'legal-name':
      return (
        <View style={{ gap: 16 }}>
          <TextInput
            value={form.legalName}
            onChangeText={(legalName) => onChange({ legalName })}
            placeholder={ka.assessment.namePlaceholder}
            placeholderTextColor={ASSESSMENT.faint}
            autoCapitalize="words"
            textAlign="center"
            style={{
              borderWidth: 1,
              borderColor: ASSESSMENT.border,
              borderRadius: ASSESSMENT.inputRadius,
              paddingHorizontal: 18,
              paddingVertical: 18,
              fontFamily: 'NotoSansGeorgian_400Regular',
              fontSize: 17,
              color: ASSESSMENT.text,
            }}
          />
          <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13, color: ASSESSMENT.faint, textAlign: 'center', lineHeight: 20 }}>
            {ka.assessment.nameHint}
          </Text>
        </View>
      );

    case 'health-goals':
      return (
        <View style={{ gap: 8 }}>
          {HEALTH_GOAL_KEYS.map((key) => {
            const active = form.healthGoals.includes(key);
            const Icon = GOAL_ICONS[key] ?? Stethoscope;
            return (
              <HealthGoalOption
                key={key}
                title={optionLabel('healthGoals', key)}
                selected={active}
                icon={Icon}
                onPress={() => {
                  const next = active ? form.healthGoals.filter((g) => g !== key) : [...form.healthGoals, key];
                  onChange({ healthGoals: next });
                }}
              />
            );
          })}
        </View>
      );

    case 'birthdate': {
      const age = ageFromForm(form);
      return (
        <View style={{ width: '100%', alignItems: 'center' }}>
          <DateWheelPicker
            month={form.birthMonth}
            day={form.birthDay}
            year={form.birthYear}
            onChange={(patch) =>
              onChange({
                ...(patch.month !== undefined ? { birthMonth: patch.month } : {}),
                ...(patch.day !== undefined ? { birthDay: patch.day } : {}),
                ...(patch.year !== undefined ? { birthYear: patch.year } : {}),
              })
            }
          />
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              paddingHorizontal: 16,
              paddingVertical: 8,
            }}
          >
            <Text style={{ fontSize: 18, lineHeight: 22 }}>🎂</Text>
            <Text
              style={{
                fontFamily: 'NotoSansGeorgian_400Regular',
                fontSize: 16,
                lineHeight: 22,
                color: '#4B5563',
                textAlign: 'center',
              }}
            >
              {ka.assessment.ageBadge(age)}
            </Text>
          </View>
        </View>
      );
    }

    case 'gender':
      return (
        <GenderSelector
          gender={form.gender}
          genderOther={form.genderOther}
          onChange={(patch) => onChange(patch)}
        />
      );

    case 'body-type':
      return (
        <BodyTypeCarousel
          gender={form.gender}
          value={form.bodyType}
          labelFor={(type) => optionLabel('bodyType', type)}
          onChange={(bodyType) => onChange({ bodyType })}
        />
      );

    case 'weight': {
      const values = form.weightUnit === 'kg' ? WEIGHT_KG : WEIGHT_LBS;
      const display =
        form.weightUnit === 'kg'
          ? Math.round(form.weightKg)
          : weightDisplayLbs(form.weightKg);
      const unitLabel = form.weightUnit === 'kg' ? ka.assessment.kg : ka.assessment.lbs;
      const labelOrigin = form.weightUnit === 'kg' ? 35 : 80;

      return (
        <View style={{ width: '100%' }}>
          <View style={{ paddingVertical: 32 }}>
            <UnitSegment
              value={form.weightUnit}
              options={[
                { value: 'lbs', label: ka.assessment.lbs },
                { value: 'kg', label: ka.assessment.kg },
              ]}
              onChange={(weightUnit) => onChange({ weightUnit: weightUnit as 'kg' | 'lbs' })}
            />
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 4 }}>
            <Text
              style={{
                fontFamily: 'NotoSansGeorgian_700Bold',
                fontSize: ASSESSMENT.displayNumber,
                lineHeight: ASSESSMENT.displayNumberLineHeight,
                letterSpacing: -2,
                color: ASSESSMENT.textPrimary,
                textAlign: 'center',
              }}
            >
              {display}
            </Text>
            <View style={{ paddingBottom: 7, justifyContent: 'center' }}>
              <Text
                style={{
                  fontFamily: isLatinUnitLabel(unitLabel)
                    ? unitLabelFontFamily(unitLabel, false)
                    : 'NotoSansGeorgian_400Regular',
                  fontSize: 30,
                  lineHeight: 38,
                  letterSpacing: -0.25,
                  color: ASSESSMENT.textSecondary,
                  textAlign: 'center',
                }}
              >
                {unitLabel}
              </Text>
            </View>
          </View>

          <View style={{ width: SCREEN_W, marginHorizontal: -24, alignSelf: 'center' }}>
            <WeightRulerPicker
              values={values}
              selected={display}
              labelEvery={5}
              labelOrigin={labelOrigin}
              onSelect={(n) => {
                onChange({
                  weightKg: form.weightUnit === 'kg' ? n : weightKgFromLbs(n),
                });
              }}
            />
          </View>
        </View>
      );
    }

    case 'height': {
      const isCm = form.heightUnit === 'cm';
      const values = isCm ? HEIGHT_CM_VALUES : HEIGHT_IN_VALUES;
      const selected = isCm ? Math.round(form.heightCm) : cmToInches(form.heightCm);

      return (
        <View style={{ width: '100%' }}>
          <View style={{ paddingVertical: 16 }}>
            <UnitSegment
              value={form.heightUnit}
              options={[
                { value: 'cm', label: ka.assessment.cm },
                { value: 'ft', label: ka.assessment.ft },
              ]}
              onChange={(heightUnit) => onChange({ heightUnit: heightUnit as 'cm' | 'ft' })}
            />
          </View>

          <View style={{ paddingHorizontal: 0, paddingVertical: 24 }}>
            <HeightWheelPicker
              values={values}
              selected={selected}
              formatLabel={(v) => (isCm ? String(v) : formatHeightInches(v))}
              onSelect={(n) => {
                onChange({ heightCm: isCm ? n : inchesToCm(n) });
              }}
            />
          </View>
        </View>
      );
    }

    case 'blood-type':
      return (
        <BloodTypeSelector
          value={form.bloodType}
          onChange={(bloodType) => onChange({ bloodType })}
        />
      );

    case 'fitness-level':
      return (
        <FitnessLevelSlider
          value={form.fitnessLevel}
          onChange={(fitnessLevel) => onChange({ fitnessLevel })}
          labelForValue={(v) => optionLabel('fitnessLevel', String(v))}
          hint={ka.assessment.fitnessHints[form.fitnessLevel - 1]}
        />
      );

    case 'sleep-level':
      return (
        <SegmentScale
          value={form.sleepLevel}
          onChange={(sleepLevel) => onChange({ sleepLevel })}
          labelForValue={(v) => optionLabel('sleepLevel', String(v))}
          hint={ka.assessment.sleepHints[form.sleepLevel - 1]}
        />
      );

    case 'smoking':
      return (
        <SmokingChoiceList
          value={form.smokingStatus}
          onChange={(smokingStatus) => onChange({ smokingStatus })}
          titleFor={(key) => optionLabel('smokingStatus', key)}
        />
      );

    case 'mood': {
      const moods = [...MOOD_KEYS];
      const items = moods
        .map((key) => {
          const image = moodImage(key);
          if (!image) return null;
          return {
            key,
            image,
            label: ka.assessment.moodLabel(key),
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);
      return (
        <MoodCarousel
          items={items}
          value={form.mood}
          onChange={(mood) => onChange({ mood })}
        />
      );
    }

    case 'diet-habits':
      return (
        <DietChoiceGrid
          value={form.dietType}
          onChange={(dietType) => onChange({ dietType })}
          titleFor={(key) => optionLabel('dietType', key)}
        />
      );

    case 'medications-gate':
      return (
        <GateActions
          yesLabel={ka.assessment.medsYes}
          noLabel={ka.assessment.medsNo}
          onYes={() => onAutoAdvance?.({ takesMedications: true })}
          onNo={() => onAutoAdvance?.({ takesMedications: false, medications: [] })}
        />
      );

    case 'medications-list':
      return (
        <MedicationPicker
          value={form.medications}
          onChange={(medications) => onChange({ medications })}
        />
      );

    case 'allergies':
      return (
        <AllergyPicker
          value={form.allergies}
          onChange={(allergies) => onChange({ allergies })}
        />
      );

    case 'conditions-gate':
      return (
        <GateActions
          yesLabel={ka.assessment.conditionsYes}
          noLabel={ka.assessment.conditionsNo}
          onYes={() => onAutoAdvance?.({ hasConditions: true })}
          onNo={() => onAutoAdvance?.({ hasConditions: false, chronicConditions: [] })}
        />
      );

    case 'conditions-list':
      return (
        <ChipCloud
          options={Object.keys(ka.assessment.options.chronicConditions)}
          selected={form.chronicConditions}
          optionsKey="chronicConditions"
          onChange={(chronicConditions) => onChange({ chronicConditions })}
        />
      );

    case 'checkup-frequency': {
      const values = Object.keys(ka.assessment.options.checkupFrequency);
      return (
        <LabelWheelPicker
          values={values}
          selected={form.checkupFrequency ?? values[2] ?? 'MONTHLY'}
          onSelect={(checkupFrequency) => onChange({ checkupFrequency })}
          formatLabel={(v) => optionLabel('checkupFrequency', v)}
        />
      );
    }

    case 'complete':
      return null;

    default:
      return null;
  }
}

function ChipCloud({
  options,
  selected,
  optionsKey,
  onChange,
}: {
  options: string[];
  selected: string[];
  optionsKey: string;
  onChange: (next: string[]) => void;
}) {
  const toggle = (value: string) => {
    if (value === 'none') {
      onChange([]);
      return;
    }
    const next = selected.includes(value) ? selected.filter((v) => v !== value) : [...selected.filter((v) => v !== 'none'), value];
    onChange(next);
  };

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
      {options.filter((o) => o !== 'none').map((value) => {
        const active = selected.includes(value);
        return (
          <Pressable
            key={value}
            onPress={() => toggle(value)}
            style={{
              borderRadius: 99,
              borderWidth: active ? 2 : 1,
              borderColor: active ? lightColors.primary200 : '#E5E7EB',
              backgroundColor: active ? '#F0FDFA' : '#FFFFFF',
              paddingHorizontal: 14,
              paddingVertical: 10,
            }}
          >
            <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 14, color: active ? lightColors.primary100 : '#475569' }}>
              {optionLabel(optionsKey, value)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function stepCanContinue(step: AssessmentStep, form: AssessmentFormState): boolean {
  switch (step.type) {
    case 'intro':
      return true;
    case 'legal-name':
      return form.legalName.trim().length >= 2;
    case 'health-goals':
      return form.healthGoals.length > 0;
    case 'birthdate':
      return true;
    case 'gender':
      return form.gender !== null && (form.gender !== 'OTHER' || form.genderOther.trim().length > 0);
    case 'body-type':
      return form.bodyType !== null;
    case 'weight':
    case 'height':
      return true;
    case 'blood-type':
      return form.bloodType !== null;
    case 'fitness-level':
    case 'sleep-level':
      return true;
    case 'smoking':
      return form.smokingStatus !== null;
    case 'mood':
      return form.mood !== null;
    case 'diet-habits':
      return form.dietType !== null;
    case 'medications-gate':
      return form.takesMedications !== null;
    case 'medications-list':
      return form.medications.length > 0;
    case 'allergies':
      return true;
    case 'conditions-gate':
      return form.hasConditions !== null;
    case 'conditions-list':
      return form.chronicConditions.length > 0;
    case 'checkup-frequency':
      return form.checkupFrequency !== null;
    case 'complete':
      return true;
    default:
      return true;
  }
}

export function stepUsesHero(_step: AssessmentStep): boolean {
  return false;
}

export function AssessmentHeroContent() {
  return null;
}
