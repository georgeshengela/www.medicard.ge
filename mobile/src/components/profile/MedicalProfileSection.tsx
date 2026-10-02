import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronRight, Plus, X } from 'lucide-react-native';
import { Button } from '@/components/ui/Button';
import { Modal, APP_MODAL_OVERLAY, APP_MODAL_PROPS } from '@/components/ui/appModal';
import { useKeyboardPad } from '@/components/ui/KeyboardFormShell';
import { GenderSelector } from '@/components/assessment/GenderSelector';
import { DateWheelPicker } from '@/components/assessment/DateWheelPicker';
import { UnitSegment } from '@/components/assessment/UnitSegment';
import {
  HEIGHT_CM_VALUES,
  HEIGHT_IN_VALUES,
  HeightWheelPicker,
  cmToInches,
  formatHeightInches,
  inchesToCm,
} from '@/components/assessment/HeightWheelPicker';
import { WeightRulerPicker } from '@/components/assessment/WeightRulerPicker';
import { BloodTypeSelector } from '@/components/assessment/BloodTypeSelector';
import { SmokingChoiceList } from '@/components/assessment/SmokingChoiceList';
import { AllergyPicker } from '@/components/assessment/AllergyPicker';
import { ConditionPicker } from '@/components/assessment/ConditionPicker';
import { MedicalSourcesLink } from '@/components/health/MedicalSourcesLink';
import { allergyDisplayLabel } from '@/constants/allergyCatalog';
import { resolveConditionLabel } from '@/constants/conditionCatalog';
import { ka } from '@/i18n/ka';
import { tx } from '@/i18n/locale';
import { api, ApiError, type Gender } from '@/lib/api';
import { LBS_PER_KG, displayWeightForUnit } from '@/lib/assessmentForm';
import { MIN_USER_AGE, ageFromBirthDate, isoToDisplay, normalizeIsoDate, parseBirthDate } from '@/lib/birthdate';
import { BMI_ZONE_COLORS, bmiCategory, bmiFromWeight } from '@/lib/bmi';
import { useAuth } from '@/store/AuthContext';
import { useIsDark, useThemeColors } from '@/theme/colors';
import { HUB, hubText } from '@/theme/hub';

type Field = 'gender' | 'birthDate' | 'height' | 'weight' | 'bloodType' | 'smoking' | 'allergies' | 'conditions';

const GENDER_LABELS: Record<Gender, string> = {
  MALE: ka.auth.genderMale,
  FEMALE: ka.auth.genderFemale,
  OTHER: ka.auth.genderOther,
};

const WEIGHT_KG = Array.from({ length: 166 }, (_, i) => 35 + i);
const WEIGHT_LBS = Array.from({ length: 321 }, (_, i) => 80 + i);

const SHEET_TITLES: Record<Field, string> = {
  gender: ka.auth.gender,
  birthDate: ka.auth.birthDate,
  height: ka.profile.height,
  weight: ka.profile.weight,
  bloodType: ka.profile.bloodType,
  smoking: ka.profile.smoking,
  allergies: ka.profile.allergies,
  conditions: ka.profile.conditions,
};

const SHEET_HINTS: Partial<Record<Field, string>> = {
  birthDate: tx('ასაკი ამ თარიღიდან ითვლება.', 'Your age is counted from this date.'),
  allergies: tx('დაამატე ან წაშალე — შეეხე ალერგიას მოსაშორებლად.', 'Add or remove — tap one to take it off.'),
  conditions: tx('Medi ამას ითვალისწინებს რჩევებში.', 'Medi takes these into account.'),
};

function smokingLabel(key: string): string {
  const map = ka.assessment.options.smokingStatus as Record<string, string>;
  return map[key] ?? key;
}

function cleanList(list: string[] | null | undefined): string[] {
  return (list ?? []).filter((item) => item && item !== 'none');
}

/** Profile → „სამედიცინო პროფილი“: compact summary where every value opens its own editor sheet. */
export function MedicalProfileSection() {
  const { user, healthProfile } = useAuth();
  const colors = useThemeColors();
  const dark = useIsDark();
  const [field, setField] = useState<Field | null>(null);

  const extra = (healthProfile?.extraAnswers ?? {}) as Record<string, unknown>;
  const heightCm = healthProfile?.heightCm ?? null;
  const weightKg = healthProfile?.weightKg ?? null;
  const bmi = healthProfile?.bmi ?? bmiFromWeight(weightKg, heightCm);
  const allergies = cleanList(healthProfile?.allergies);
  const conditions = cleanList(healthProfile?.chronicConditions);

  const weightShown = weightKg != null ? displayWeightForUnit(weightKg, extra.weightUnit === 'lbs' ? 'lbs' : 'kg') : null;
  const heightFt = extra.heightUnit === 'ft';

  const tiles: { key: Field; label: string; value: string | null; unit?: string }[] = [
    { key: 'birthDate', label: ka.profile.age, value: user?.age != null ? String(user.age) : null, unit: tx('წ', 'y') },
    {
      key: 'height',
      label: ka.profile.height,
      value: heightCm != null ? (heightFt ? formatHeightInches(cmToInches(heightCm)) : String(Math.round(heightCm))) : null,
      unit: heightCm != null && !heightFt ? ka.profile.cm : undefined,
    },
    {
      key: 'weight',
      label: ka.profile.weight,
      value: weightShown ? String(weightShown.value) : null,
      unit: weightShown ? (weightShown.unitLabel === 'lbs' ? ka.assessment.lbs : ka.profile.kg) : undefined,
    },
    {
      key: 'bloodType',
      label: tx('სისხლი', 'Blood'),
      value: healthProfile?.bloodType && healthProfile.bloodType !== 'UNKNOWN' ? healthProfile.bloodType : null,
    },
  ];

  const rows: { key: Field; label: string; value: string | null }[] = [
    { key: 'gender', label: ka.auth.gender, value: user?.gender ? GENDER_LABELS[user.gender] : null },
    { key: 'smoking', label: ka.profile.smoking, value: healthProfile?.smokingStatus ? smokingLabel(healthProfile.smokingStatus) : null },
    {
      key: 'allergies',
      label: ka.profile.allergies,
      value: allergies.length ? allergies.map((item) => allergyDisplayLabel(item)).join(', ') : null,
    },
    {
      key: 'conditions',
      label: ka.profile.conditions,
      value: conditions.length ? conditions.map((item) => resolveConditionLabel(item)).join(', ') : null,
    },
  ];

  const zone = bmi != null ? bmiCategory(bmi) : null;

  return (
    <View style={{ borderRadius: HUB.cardRadius, backgroundColor: colors.surface, padding: 12 }}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {tiles.map((tile) => (
          <Pressable
            key={tile.key}
            accessibilityRole="button"
            accessibilityLabel={`${tile.label}: ${tile.value ?? tx('დამატება', 'Add')}`}
            onPress={() => setField(tile.key)}
            style={[s.tile, { backgroundColor: dark ? colors.bg200 : colors.bg100 }]}
          >
            {tile.value ? (
              <Text numberOfLines={1} adjustsFontSizeToFit style={[hubText.value, { fontSize: 18, lineHeight: 24, color: colors.text100 }]}>
                {tile.value}
                {tile.unit ? <Text style={[hubText.small, { color: colors.text300 }]}> {tile.unit}</Text> : null}
              </Text>
            ) : (
              <View style={{ height: 24, justifyContent: 'center' }}>
                <Plus size={18} color={colors.primary200} strokeWidth={2.4} />
              </View>
            )}
            <Text numberOfLines={1} style={[hubText.small, { color: colors.text300 }]}>
              {tile.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {bmi != null && zone ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 6, paddingTop: 12, paddingBottom: 4 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: BMI_ZONE_COLORS[zone] }} />
          <Text style={[hubText.link, { color: colors.text100 }]}>
            {ka.profile.bmi} {bmi.toFixed(1)}
          </Text>
          <Text style={[hubText.caption, { color: colors.text200, flex: 1 }]} numberOfLines={1}>
            · {ka.home.bmi.categories[zone]}
          </Text>
          <MedicalSourcesLink sourceIds={['bmi']} />
        </View>
      ) : null}

      <View style={{ marginTop: 8 }}>
        {rows.map((row, index) => (
          <Pressable
            key={row.key}
            accessibilityRole="button"
            accessibilityLabel={`${row.label}: ${row.value ?? tx('დამატება', 'Add')}`}
            onPress={() => setField(row.key)}
            style={[s.row, index ? { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.bg300 } : null]}
          >
            <Text style={[hubText.body, { color: colors.text200 }]}>{row.label}</Text>
            <Text
              numberOfLines={1}
              style={[
                row.value ? hubText.link : hubText.caption,
                { flex: 1, textAlign: 'right', color: row.value ? colors.text100 : colors.primary200 },
              ]}
            >
              {row.value ?? tx('დამატება', 'Add')}
            </Text>
            <ChevronRight size={16} color={colors.text300} strokeWidth={2} />
          </Pressable>
        ))}
      </View>

      <MedicalEditSheet field={field} onClose={() => setField(null)} />
    </View>
  );
}

type Draft = {
  gender: Gender | null;
  genderOther: string;
  birthDay: number;
  birthMonth: number;
  birthYear: number;
  heightUnit: 'cm' | 'ft';
  heightCm: number;
  weightUnit: 'kg' | 'lbs';
  weightKg: number;
  bloodType: string | null;
  smoking: string | null;
  allergies: string[];
  conditions: string[];
};

function MedicalEditSheet({ field, onClose }: { field: Field | null; onClose: () => void }) {
  const { user, healthProfile, setHealthProfile, setUser } = useAuth();
  const colors = useThemeColors();
  const safe = useSafeAreaInsets();
  const { height: windowH, width: windowW } = useWindowDimensions();
  const keyboard = useKeyboardPad(Math.max(safe.bottom, 16));
  const keyboardPad = keyboard.pad;
  const footerStyle = useAnimatedStyle(() => ({ paddingBottom: keyboardPad.value }));

  // Keep the last field on screen while the sheet fades out.
  const [shown, setShown] = useState<Field | null>(field);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!field) return;
    const extra = (healthProfile?.extraAnswers ?? {}) as Record<string, unknown>;
    const iso = normalizeIsoDate(user?.birthDate);
    const [y, m, d] = iso ? iso.split('-').map(Number) : [1990, 1, 1];
    setShown(field);
    setError(null);
    setDraft({
      gender: user?.gender ?? null,
      genderOther: typeof extra.genderOther === 'string' ? extra.genderOther : '',
      birthYear: y,
      birthMonth: m,
      birthDay: d,
      heightUnit: extra.heightUnit === 'ft' ? 'ft' : 'cm',
      heightCm: healthProfile?.heightCm ?? 170,
      weightUnit: extra.weightUnit === 'lbs' ? 'lbs' : 'kg',
      weightKg: healthProfile?.weightKg ?? 70,
      bloodType: healthProfile?.bloodType ?? null,
      smoking: healthProfile?.smokingStatus ?? null,
      allergies: cleanList(healthProfile?.allergies),
      conditions: cleanList(healthProfile?.chronicConditions),
    });
  }, [field, user, healthProfile]);

  const patch = (next: Partial<Draft>) => setDraft((current) => (current ? { ...current, ...next } : current));

  const birthIso = draft
    ? `${draft.birthYear}-${String(draft.birthMonth).padStart(2, '0')}-${String(draft.birthDay).padStart(2, '0')}`
    : '';
  const draftAge = draft ? ageFromBirthDate(new Date(draft.birthYear, draft.birthMonth - 1, draft.birthDay)) : 0;

  const save = async () => {
    if (!draft || !shown || busy) return;
    let body: Record<string, unknown>;
    switch (shown) {
      case 'gender':
        if (!draft.gender) return setError(ka.auth.selectGender);
        body = { gender: draft.gender, extraAnswers: { genderOther: draft.gender === 'OTHER' ? draft.genderOther.trim() : '' } };
        break;
      case 'birthDate': {
        const parsed = parseBirthDate(isoToDisplay(birthIso) ?? '');
        if (!parsed.ok) return setError(parsed.error);
        body = { birthDate: parsed.iso };
        break;
      }
      case 'height':
        body = { heightCm: Math.round(draft.heightCm * 10) / 10, extraAnswers: { heightUnit: draft.heightUnit } };
        break;
      case 'weight':
        body = { weightKg: Math.round(draft.weightKg * 10) / 10, extraAnswers: { weightUnit: draft.weightUnit } };
        break;
      case 'bloodType':
        if (!draft.bloodType) return setError(tx('აირჩიე სისხლის ჯგუფი', 'Choose a blood type'));
        body = { bloodType: draft.bloodType };
        break;
      case 'smoking':
        if (!draft.smoking) return setError(tx('აირჩიე ერთ-ერთი', 'Choose one'));
        body = { smokingStatus: draft.smoking };
        break;
      case 'allergies':
        body = { allergies: draft.allergies };
        break;
      case 'conditions':
        body = { chronicConditions: draft.conditions };
        break;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await api.healthProfile.update(body);
      setHealthProfile(result.profile);
      if (result.user) setUser(result.user);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : ka.common.error);
    } finally {
      setBusy(false);
    }
  };

  const renderEditor = () => {
    if (!draft || !shown) return null;
    switch (shown) {
      case 'gender':
        return <GenderSelector gender={draft.gender} genderOther={draft.genderOther} onChange={(next) => patch(next)} />;
      case 'birthDate':
        return (
          <View style={{ alignItems: 'center', gap: 12 }}>
            <DateWheelPicker
              month={draft.birthMonth}
              day={draft.birthDay}
              year={draft.birthYear}
              maxYear={new Date().getFullYear() - MIN_USER_AGE}
              onChange={(next) =>
                patch({
                  ...(next.month !== undefined ? { birthMonth: next.month } : {}),
                  ...(next.day !== undefined ? { birthDay: next.day } : {}),
                  ...(next.year !== undefined ? { birthYear: next.year } : {}),
                })
              }
            />
            <Text style={[hubText.link, { color: colors.primary200 }]}>{ka.assessment.yearsOld(draftAge)}</Text>
          </View>
        );
      case 'height': {
        const isCm = draft.heightUnit === 'cm';
        return (
          <View style={{ gap: 16 }}>
            <UnitSegment
              value={draft.heightUnit}
              options={[
                { value: 'cm', label: ka.assessment.cm },
                { value: 'ft', label: ka.assessment.ft },
              ]}
              onChange={(unit) => patch({ heightUnit: unit as 'cm' | 'ft' })}
            />
            <HeightWheelPicker
              values={isCm ? HEIGHT_CM_VALUES : HEIGHT_IN_VALUES}
              selected={isCm ? Math.round(draft.heightCm) : cmToInches(draft.heightCm)}
              formatLabel={(v) => (isCm ? String(v) : formatHeightInches(v))}
              onSelect={(n) => patch({ heightCm: isCm ? n : inchesToCm(n) })}
            />
          </View>
        );
      }
      case 'weight': {
        const isKg = draft.weightUnit === 'kg';
        const shownValue = displayWeightForUnit(draft.weightKg, draft.weightUnit);
        return (
          <View style={{ gap: 16 }}>
            <UnitSegment
              value={draft.weightUnit}
              options={[
                { value: 'kg', label: ka.assessment.kg },
                { value: 'lbs', label: ka.assessment.lbs },
              ]}
              onChange={(unit) => patch({ weightUnit: unit as 'kg' | 'lbs' })}
            />
            <Text style={{ textAlign: 'center', fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 44, lineHeight: 54, color: colors.text100 }}>
              {shownValue.value}
              <Text style={[hubText.cardTitle, { color: colors.text300 }]}> {isKg ? ka.assessment.kg : ka.assessment.lbs}</Text>
            </Text>
            <View style={{ width: windowW, marginHorizontal: -20 }}>
              <WeightRulerPicker
                values={isKg ? WEIGHT_KG : WEIGHT_LBS}
                selected={Math.round(Number(shownValue.value))}
                labelEvery={5}
                labelOrigin={isKg ? 35 : 80}
                onSelect={(n) => patch({ weightKg: isKg ? n : Math.round((n / LBS_PER_KG) * 10) / 10 })}
              />
            </View>
          </View>
        );
      }
      case 'bloodType':
        return <BloodTypeSelector value={draft.bloodType} onChange={(bloodType) => patch({ bloodType })} />;
      case 'smoking':
        return <SmokingChoiceList value={draft.smoking} onChange={(smoking) => patch({ smoking })} titleFor={smokingLabel} />;
      case 'allergies':
        return <AllergyPicker value={draft.allergies} onChange={(allergies) => patch({ allergies })} />;
      case 'conditions':
        return <ConditionPicker value={draft.conditions} onChange={(conditions) => patch({ conditions })} />;
    }
  };

  const hint = shown ? SHEET_HINTS[shown] : undefined;

  return (
    <Modal visible={field != null} {...APP_MODAL_PROPS} onRequestClose={onClose}>
      <View ref={keyboard.frameRef} onLayout={keyboard.onLayout} style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={ka.common.cancel}
          onPress={onClose}
          style={[StyleSheet.absoluteFill, { backgroundColor: APP_MODAL_OVERLAY }]}
        />
        <View style={[s.sheet, { backgroundColor: colors.surface, maxHeight: windowH * 0.9, width: '100%', maxWidth: 760, alignSelf: 'center' }]}>
          <View style={[s.grabber, { backgroundColor: colors.bg300 }]} />
          <View style={s.header}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[hubText.sectionTitle, { color: colors.text100 }]}>{shown ? SHEET_TITLES[shown] : ''}</Text>
              {hint ? <Text style={[hubText.caption, { color: colors.text300 }]}>{hint}</Text> : null}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={tx('დახურვა', 'Close')}
              onPress={onClose}
              hitSlop={8}
              style={[s.close, { backgroundColor: colors.bg200 }]}
            >
              <X size={18} color={colors.text200} strokeWidth={2.2} />
            </Pressable>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 }}
          >
            {renderEditor()}
          </ScrollView>
          <Animated.View style={[{ paddingHorizontal: 20, paddingTop: 10, gap: 8 }, footerStyle]}>
            {error ? <Text style={[hubText.caption, { color: colors.danger, textAlign: 'center' }]}>{error}</Text> : null}
            <Button label={ka.profile.save} loading={busy} onPress={() => void save()} />
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  tile: {
    flex: 1,
    minWidth: 0,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: 'center',
    gap: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 46,
    paddingHorizontal: 6,
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    marginTop: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 10,
  },
  close: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
