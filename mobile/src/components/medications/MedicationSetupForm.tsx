import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  Bell,
  Calendar,
  Clock,
  Pencil,
  Pill,
  Plus,
  RefreshCw,
} from 'lucide-react-native';
import { MedicationDateField } from '@/components/medications/MedicationDateField';
import { MedicationDosageSheet } from '@/components/medications/MedicationDosageSheet';
import { MedicationFrequencySheet } from '@/components/medications/MedicationFrequencySheet';
import { MedicationPillIcon } from '@/components/medications/MedicationPillIcon';
import { MedicationShapePickerSheet } from '@/components/medications/MedicationShapePickerSheet';
import { MedicationTimePickerSheet } from '@/components/medications/MedicationTimePickerSheet';
import { ProfileMenuRow } from '@/components/profile/ProfileMenuRow';
import { HomeSectionHeading } from '@/components/home/HomeSectionHeading';
import { FIGMA_MEDS } from '@/constants/figmaMedicationsLayout';
import { ka } from '@/i18n/ka';
import { ApiError, api } from '@/lib/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TAB_BAR_HEIGHT } from '@/components/navigation/FloatingTabBar';
import {
  DAY_LETTERS,
  addYearsToIso,
  daysSummaryKa,
  defaultTimesForCount,
  formatFrequencyTimes,
  formatTime24h,
  todayYmd,
} from '@/lib/medications.shared';
import type { MedicationForm, PillShape } from '@/types/medications';
import { useIsDark, useThemeColors } from '@/theme/colors';
import { HUB, hubInk, hubText, hubTint } from '@/theme/hub';

type Props = {
  initialName?: string;
  initialGeneric?: string;
  initialImageUrl?: string;
  catalogProductId?: string;
  manufacturer?: string;
  strength?: string;
  formLabel?: string;
  onSaved: () => void;
};

export function MedicationSetupForm({
  initialName = '',
  initialGeneric,
  initialImageUrl,
  catalogProductId,
  manufacturer,
  strength,
  formLabel,
  onSaved,
}: Props) {
  const c = useThemeColors();
  const dark = useIsDark();
  const insets = useSafeAreaInsets();
  const tabClearance = TAB_BAR_HEIGHT + Math.max(insets.bottom, 8);
  const ctaHeight = 80;
  const [medName] = useState(initialName);
  const [form, setForm] = useState<MedicationForm>('pills');
  const [amount, setAmount] = useState(1);
  const [timesPerDay, setTimesPerDay] = useState(1);
  const [times, setTimes] = useState<string[]>(['10:30']);
  const [days, setDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [startDate, setStartDate] = useState(todayYmd());
  const [endDate, setEndDate] = useState(addYearsToIso(todayYmd(), 1));
  const [refillReminder, setRefillReminder] = useState(true);
  const [refillThreshold, setRefillThreshold] = useState('12');
  const [pillColor, setPillColor] = useState<string>(FIGMA_MEDS.pillColors[0]);
  const [pillShape, setPillShape] = useState<PillShape>('diamond');
  const [busy, setBusy] = useState(false);

  const [dosageSheet, setDosageSheet] = useState(false);
  const [freqSheet, setFreqSheet] = useState(false);
  const [timeSheet, setTimeSheet] = useState(false);
  const [timeEditIndex, setTimeEditIndex] = useState(0);
  const [shapeSheet, setShapeSheet] = useState(false);

  useEffect(() => {
    if (medName.trim().length < 2) return;
    void import('@/lib/mediEngagePrefs').then(({ saveUnfinishedDraft }) =>
      saveUnfinishedDraft({
        kind: 'medication_add',
        route: `/medications/add/setup?name=${encodeURIComponent(medName.trim())}`,
        name: medName.trim(),
        updatedAt: Date.now(),
      }),
    );
  }, [medName]);

  const dosageLabel = useMemo(() => `${amount} ${ka.meds.formLabels[form]}`, [amount, form]);
  const genericLine =
    [manufacturer || initialGeneric, strength, formLabel].filter(Boolean).join(' · ') ||
    (initialGeneric ? ka.meds.knownAs(initialGeneric, medName) : ka.meds.knownAsFallback(medName));

  const minEndDate = startDate;
  const maxStartDate = endDate;
  const teal = hubInk('teal', dark);

  const toggleDay = (d: number) => {
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));
  };

  const stepThreshold = (delta: number) => {
    setRefillThreshold(String(Math.max(1, (Number(refillThreshold) || 1) + delta)));
  };

  const applyTimesPerDay = (count: number) => {
    setTimesPerDay(count);
    setTimes((prev) => {
      const defaults = defaultTimesForCount(count);
      return defaults.map((t, i) => prev[i] ?? t);
    });
  };

  const openTimePicker = (index: number) => {
    setTimeEditIndex(index);
    setTimeSheet(true);
  };

  const save = async () => {
    if (medName.trim().length < 2) {
      Alert.alert(ka.common.error, ka.meds.nameLabel);
      return;
    }
    if (endDate < startDate) {
      Alert.alert(ka.common.error, ka.meds.endBeforeStartError);
      return;
    }
    setBusy(true);
    try {
      await api.medications.create({
        medName: medName.trim(),
        dosage: dosageLabel,
        frequency: formatFrequencyTimes(times.slice(0, timesPerDay)),
        config: {
          genericName: initialGeneric || manufacturer,
          form,
          amount,
          timesPerDay,
          frequencyKind: 'daily',
          daysOfWeek: days,
          pillColor,
          pillShape,
          refillReminder,
          refillThreshold: Number(refillThreshold) || 12,
          startDate,
          endDate,
          imageUrl: initialImageUrl,
          catalogProductId,
          manufacturer,
          strength,
        },
      });
      await import('@/lib/mediEngagePrefs').then(({ clearUnfinishedDraft }) => clearUnfinishedDraft('medication_add'));
      onSaved();
    } catch (err) {
      Alert.alert(ka.common.error, err instanceof ApiError ? err.message : ka.common.error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg100 }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: tabClearance + ctaHeight + 24 }}
      >
        <View style={{ alignItems: 'center', paddingHorizontal: HUB.gutter, paddingTop: 24, paddingBottom: 8, gap: 20 }}>
          <View
            style={{
              width: 76,
              height: 76,
              borderRadius: 22,
              backgroundColor: hubTint(teal, dark),
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {initialImageUrl ? (
              <MedicationPillIcon shape={pillShape} size={68} imageUrl={initialImageUrl} />
            ) : (
              <Pressable onPress={() => setShapeSheet(true)}>
                <MedicationPillIcon shape={pillShape} size={68} />
                <View style={[styles.editBadge, { backgroundColor: c.text100 }]}>
                  <Pencil size={12} color={c.bg100} strokeWidth={2.2} />
                </View>
              </Pressable>
            )}
          </View>
          <View style={{ alignItems: 'center', gap: 6 }}>
            <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 20, lineHeight: 26, color: c.text100 }}>
              {medName || ka.meds.namePlaceholder}
            </Text>
            <Text style={[hubText.body, { fontSize: 15, lineHeight: 21, color: c.text200, textAlign: 'center' }]}>
              {genericLine}
            </Text>
          </View>
        </View>

        <View style={{ paddingHorizontal: HUB.gutter, marginTop: HUB.sectionGap - 12 }}>
          <HomeSectionHeading title={ka.meds.sectionGeneral} />
          <View style={[styles.card, { backgroundColor: c.surface }]}>
            <ProfileMenuRow icon={Pill} label={ka.meds.doseAmountLabel} value={dosageLabel} onPress={() => setDosageSheet(true)} ink="teal" />
            <Divider color={c.bg300} />
            <ProfileMenuRow icon={RefreshCw} label={ka.meds.frequencyLabel} value={ka.meds.timesPerDayLabel(timesPerDay)} onPress={() => setFreqSheet(true)} ink="sky" />
            {times.slice(0, timesPerDay).map((time, index) => (
              <React.Fragment key={`time-${index}`}>
                <Divider color={c.bg300} />
                <ProfileMenuRow
                  icon={Clock}
                  label={timesPerDay > 1 ? `${ka.meds.timesLabel} ${index + 1}` : ka.meds.timesLabel}
                  value={formatTime24h(time)}
                  onPress={() => openTimePicker(index)}
                  ink="amber"
                />
              </React.Fragment>
            ))}
            <Divider color={c.bg300} />
            <MedicationDateField label={ka.meds.startDateLabel} value={startDate} onChange={(iso) => {
              setStartDate(iso);
              if (endDate < iso) setEndDate(addYearsToIso(iso, 1));
            }} maxIso={maxStartDate} embedded />
            <Divider color={c.bg300} />
            <MedicationDateField label={ka.meds.endDateLabel} value={endDate} onChange={setEndDate} minIso={minEndDate} embedded isLast />
          </View>
        </View>

        <View style={{ paddingHorizontal: HUB.gutter, marginTop: HUB.sectionGap }}>
          <HomeSectionHeading title={ka.meds.sectionTakeEvery} />
          <View style={[styles.card, { backgroundColor: c.surface, gap: 14 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              {DAY_LETTERS.map((letter, idx) => {
                const active = days.includes(idx);
                return (
                  <Pressable
                    key={`${letter}-${idx}`}
                    onPress={() => toggleDay(idx)}
                    style={{
                      width: FIGMA_MEDS.daySize,
                      height: FIGMA_MEDS.daySize,
                      borderRadius: 999,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: active ? hubTint(teal, dark) : c.bg100,
                    }}
                  >
                    <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', color: active ? teal : c.text100 }}>{letter}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Divider color={c.bg300} />
            <Text style={[hubText.body, { color: c.text200 }]}>{daysSummaryKa(days) || ka.meds.noDaysSelected}</Text>
          </View>
        </View>

        <View style={{ paddingHorizontal: HUB.gutter, marginTop: HUB.sectionGap }}>
          <HomeSectionHeading title={ka.meds.sectionReminder} />
          <View style={[styles.card, { backgroundColor: c.surface, padding: 0 }]}>
            <ProfileMenuRowSwitch icon={Bell} label={ka.meds.refillLabel} value={refillReminder} onChange={setRefillReminder} ink="rose" isLast={!refillReminder} />
            {refillReminder ? (
              <>
                <Divider color={c.bg300} />
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[hubText.cardTitle, { color: c.text100 }]}>{ka.meds.refillThresholdLabel}</Text>
                    <Text style={[hubText.caption, { color: c.text200, marginTop: 4 }]}>{ka.meds.refillThresholdHint}</Text>
                  </View>
                  <View style={[styles.stepper, { backgroundColor: c.bg100 }]}>
                    <TextInput
                      value={refillThreshold}
                      onChangeText={setRefillThreshold}
                      keyboardType="numeric"
                      style={[hubText.value, { flex: 1, fontSize: 15, color: c.text100, padding: 0, textAlign: 'center' }]}
                    />
                    <View style={{ gap: 2 }}>
                      <Pressable onPress={() => stepThreshold(1)} hitSlop={6}>
                        <Text style={[hubText.caption, { color: c.text300 }]}>+</Text>
                      </Pressable>
                      <Pressable onPress={() => stepThreshold(-1)} hitSlop={6}>
                        <Text style={[hubText.caption, { color: c.text300 }]}>−</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              </>
            ) : null}
          </View>
        </View>

        <View style={{ paddingHorizontal: HUB.gutter, marginTop: HUB.sectionGap, paddingBottom: 4 }}>
          <HomeSectionHeading title={ka.meds.pillColorLabel} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 4 }}>
            {FIGMA_MEDS.pillColors.map((color) => (
              <Pressable
                key={color}
                onPress={() => setPillColor(color)}
                style={{ padding: 2, borderRadius: 999, borderWidth: pillColor === color ? 2 : 0, borderColor: c.primary200 }}
              >
                <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: color, borderWidth: color === '#E5E7EB' ? 1 : 0, borderColor: c.bg300 }} />
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </ScrollView>

      <View style={[styles.footer, { bottom: tabClearance, backgroundColor: c.bg100, borderColor: c.bg300 }]}>
        <Pressable
          disabled={busy}
          onPress={save}
          style={{
            backgroundColor: c.primary200,
            borderRadius: HUB.tileRadius,
            minHeight: 52,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: 8,
            opacity: busy ? 0.65 : 1,
          }}
        >
          <Text style={{ color: c.onPrimary, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 16 }}>
            {busy ? ka.common.loading : ka.meds.addMedicationCta}
          </Text>
          <Plus size={20} color={c.onPrimary} strokeWidth={2.5} />
        </Pressable>
      </View>

      <MedicationDosageSheet
        visible={dosageSheet}
        amount={amount}
        form={form}
        onClose={() => setDosageSheet(false)}
        onApply={(nextAmount, nextForm) => {
          setAmount(nextAmount);
          setForm(nextForm);
        }}
      />

      <MedicationFrequencySheet
        visible={freqSheet}
        value={timesPerDay}
        onClose={() => setFreqSheet(false)}
        onApply={applyTimesPerDay}
      />

      <MedicationTimePickerSheet
        visible={timeSheet}
        value={times[timeEditIndex] ?? '08:00'}
        onClose={() => setTimeSheet(false)}
        onApply={(time24) => {
          setTimes((prev) => prev.map((t, i) => (i === timeEditIndex ? time24 : t)));
        }}
      />

      <MedicationShapePickerSheet
        visible={shapeSheet}
        value={pillShape}
        onClose={() => setShapeSheet(false)}
        onApply={setPillShape}
      />
    </View>
  );
}

function Divider({ color }: { color: string }) {
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: color, marginLeft: 16 }} />;
}

function ProfileMenuRowSwitch({
  icon: Icon,
  label,
  value,
  onChange,
  ink,
  isLast,
}: {
  icon: typeof Bell;
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  ink: 'teal' | 'rose' | 'amber' | 'sky';
  isLast?: boolean;
}) {
  const c = useThemeColors();
  const dark = useIsDark();
  const tint = hubInk(ink, dark);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 58, paddingHorizontal: 16, paddingVertical: 10, gap: 12 }}>
      <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: hubTint(tint, dark), alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={19} color={tint} strokeWidth={1.9} />
      </View>
      <Text style={[hubText.cardTitle, { flex: 1, color: c.text100 }]}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: c.primary200, false: c.bg300 }} thumbColor="#fff" />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: HUB.cardRadius, overflow: 'hidden' },
  editBadge: {
    position: 'absolute',
    bottom: -4,
    right: -2,
    borderRadius: 999,
    padding: 4,
  },
  stepper: {
    width: 76,
    height: 40,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    gap: 6,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
