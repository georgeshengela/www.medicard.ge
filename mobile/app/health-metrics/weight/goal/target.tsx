import React, { useEffect, useState } from 'react';
import { Dimensions, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { UnitSegment } from '@/components/assessment/UnitSegment';
import { isLatinUnitLabel, unitLabelFontFamily } from '@/components/assessment/unitLabelFont';
import { WeightRulerPicker } from '@/components/assessment/WeightRulerPicker';
import { WeightPrimaryButton, WeightWizardBar } from '@/components/weight/WeightChrome';
import { ASSESSMENT, useAssessment } from '@/constants/assessmentLayout';
import { useFigmaWeight } from '@/constants/figmaWeightLayout';
import { ka } from '@/i18n/ka';
import { useAuth } from '@/store/AuthContext';
import {
  clampKg,
  createWeightDraft,
  deadlineFromPace,
  loadWeightDraft,
  loadWeightGoal,
  saveWeightDraft,
} from '@/lib/weightGoal';

const WEIGHT_KG = Array.from({ length: 166 }, (_, i) => 35 + i);
const WEIGHT_LBS = Array.from({ length: 321 }, (_, i) => 80 + i);
const LBS_PER_KG = 2.2046226218;
const SCREEN_W = Dimensions.get('window').width;

function weightDisplayLbs(weightKg: number) {
  return Math.round(weightKg * LBS_PER_KG);
}

function weightKgFromLbs(lbs: number) {
  return lbs / LBS_PER_KG;
}

export default function WeightTargetScreen() {
  const T = useFigmaWeight();
  const theme = useAssessment();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { healthProfile } = useAuth();
  const startKg = healthProfile?.weightKg ?? 70;
  const [unit, setUnit] = useState<'kg' | 'lbs'>('kg');
  const [targetKg, setTargetKg] = useState(clampKg(startKg - 3));

  useEffect(() => {
    void Promise.all([loadWeightDraft(), loadWeightGoal()]).then(([draft, goal]) => {
      if (draft?.targetKg) setTargetKg(clampKg(draft.targetKg));
      else if (goal?.targetKg) setTargetKg(clampKg(goal.targetKg));
    });
  }, []);

  const values = unit === 'kg' ? WEIGHT_KG : WEIGHT_LBS;
  const display = unit === 'kg' ? Math.round(targetKg) : weightDisplayLbs(targetKg);
  const unitLabel = unit === 'kg' ? ka.assessment.kg : ka.assessment.lbs;
  const labelOrigin = unit === 'kg' ? 35 : 80;

  const next = async () => {
    const existing = (await loadWeightDraft()) ?? createWeightDraft(startKg);
    const pace = existing.pace ?? 'moderate';
    const kg = clampKg(unit === 'kg' ? display : weightKgFromLbs(display));
    await saveWeightDraft({
      ...existing,
      startKg,
      targetKg: kg,
      pace,
      deadlineYmd: existing.deadlineYmd ?? deadlineFromPace(startKg, kg, pace),
    });
    router.push('/health-metrics/weight/goal/pace' as never);
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.pageBg, paddingTop: insets.top }}>
      <WeightWizardBar progress={0.25} onBack={() => router.back()} />
      <View style={{ flex: 1 }}>
        <View style={{ paddingHorizontal: 16, paddingVertical: 32, gap: 12 }}>
          <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 30, lineHeight: 38, letterSpacing: -0.25, textAlign: 'center', color: T.textPrimary }}>
            {ka.weightGoal.targetTitle}
          </Text>
          <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 16, lineHeight: 26, textAlign: 'center', color: T.textSecondary }}>
            {ka.weightGoal.targetSubtitle}
          </Text>
        </View>

        <View style={{ paddingHorizontal: 16, paddingBottom: 32 }}>
          <UnitSegment
            value={unit}
            options={[
              { value: 'lbs', label: ka.assessment.lbs },
              { value: 'kg', label: ka.assessment.kg },
            ]}
            onChange={(nextUnit) => setUnit(nextUnit as 'kg' | 'lbs')}
          />
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 4 }}>
          <Text
            style={{
              fontFamily: 'NotoSansGeorgian_700Bold',
              fontSize: ASSESSMENT.displayNumber,
              lineHeight: ASSESSMENT.displayNumberLineHeight,
              letterSpacing: -2,
              color: theme.textPrimary,
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
                color: theme.textSecondary,
                textAlign: 'center',
              }}
            >
              {unitLabel}
            </Text>
          </View>
        </View>

        <View style={{ width: SCREEN_W, alignSelf: 'center' }}>
          <WeightRulerPicker
            values={values}
            selected={display}
            labelEvery={5}
            labelOrigin={labelOrigin}
            onSelect={(n) => {
              setTargetKg(clampKg(unit === 'kg' ? n : weightKgFromLbs(n)));
            }}
          />
        </View>
      </View>
      <View style={{ padding: 16, paddingBottom: Math.max(insets.bottom, 16) }}>
        <WeightPrimaryButton label={ka.weightGoal.continue} onPress={() => void next()} />
      </View>
    </View>
  );
}
