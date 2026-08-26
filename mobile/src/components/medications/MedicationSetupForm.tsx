import React, { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  Bell,
  Calendar,
  ChevronDown,
  ChevronUp,
  Clock,
  Pencil,
  Pill,
  Plus,
} from 'lucide-react-native';
import { MedicationDateField } from '@/components/medications/MedicationDateField';
import { MedicationDosageSheet } from '@/components/medications/MedicationDosageSheet';
import { MedicationFrequencySheet } from '@/components/medications/MedicationFrequencySheet';
import { MedicationPillIcon } from '@/components/medications/MedicationPillIcon';
import { MedicationShapePickerSheet } from '@/components/medications/MedicationShapePickerSheet';
import { MedicationTimePickerSheet } from '@/components/medications/MedicationTimePickerSheet';
import {
  MedDivider,
  MedFieldLabel,
  MedFormSectionHeader,
  MedInputShell,
} from '@/components/medications/MedicationUI';
import { FIGMA_MEDS } from '@/constants/figmaMedicationsLayout';
import { ka } from '@/i18n/ka';
import { ApiError, api } from '@/lib/api';
import {
  DAY_LETTERS,
  addYearsToIso,
  daysSummaryKa,
  defaultTimesForCount,
  formatFrequencyTimes,
  formatTime12h,
  todayYmd,
} from '@/lib/medications.shared';
import type { MedicationForm, PillShape } from '@/types/medications';

const fieldShellStyle = { height: FIGMA_MEDS.inputHeight, paddingVertical: 0 } as const;

type Props = {
  initialName?: string;
  initialGeneric?: string;
  onSaved: () => void;
};

export function MedicationSetupForm({ initialName = '', initialGeneric, onSaved }: Props) {
  const [medName] = useState(initialName);
  const [form, setForm] = useState<MedicationForm>('pills');
  const [amount, setAmount] = useState(3);
  const [timesPerDay, setTimesPerDay] = useState(1);
  const [times, setTimes] = useState<string[]>(['10:30']);
  const [days, setDays] = useState<number[]>([0, 5, 6]);
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

  const dosageLabel = useMemo(() => `${amount} ${ka.meds.formLabels[form]}`, [amount, form]);
  const genericLine = initialGeneric
    ? ka.meds.knownAs(initialGeneric, medName)
    : ka.meds.knownAsFallback(medName);

  const minEndDate = startDate;
  const maxStartDate = endDate;

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
          genericName: initialGeneric,
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
        },
      });
      onSaved();
    } catch (err) {
      Alert.alert(ka.common.error, err instanceof ApiError ? err.message : ka.common.error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={{ alignItems: 'center', paddingHorizontal: 16, paddingTop: 24, paddingBottom: 8, gap: 24 }}>
          <Pressable
            onPress={() => setShapeSheet(true)}
            style={{
              width: 64,
              height: 64,
              borderRadius: 999,
              backgroundColor: FIGMA_MEDS.cardBgTertiary,
              borderWidth: 1,
              borderColor: FIGMA_MEDS.border,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <MedicationPillIcon shape={pillShape} size={48} />
            <View
              style={{
                position: 'absolute',
                bottom: -6,
                right: -2,
                backgroundColor: FIGMA_MEDS.textPrimary,
                borderRadius: 999,
                padding: 4,
              }}
            >
              <Pencil size={12} color="#fff" strokeWidth={2.2} />
            </View>
          </Pressable>
          <View style={{ alignItems: 'center', gap: 8 }}>
            <Text style={{ fontSize: 20, fontWeight: '700', color: FIGMA_MEDS.textPrimary }}>
              {medName || ka.meds.namePlaceholder}
            </Text>
            <Text style={{ fontSize: 16, lineHeight: 22, color: FIGMA_MEDS.textSecondary, textAlign: 'center' }}>
              {genericLine}
            </Text>
          </View>
        </View>

        <MedFormSectionHeader title={ka.meds.sectionGeneral} icon={<Pill size={22} color={FIGMA_MEDS.brand} strokeWidth={2} />} />

        <View style={{ paddingHorizontal: 16, paddingVertical: 4, gap: 12 }}>
          <View>
            <MedFieldLabel>{ka.meds.doseAmountLabel}</MedFieldLabel>
            <MedInputShell onPress={() => setDosageSheet(true)} style={fieldShellStyle}>
              <Pill size={18} color={FIGMA_MEDS.textMuted} strokeWidth={2} />
              <Text style={{ flex: 1, fontSize: 16, color: FIGMA_MEDS.textSecondary }}>{dosageLabel}</Text>
              <ChevronDown size={18} color={FIGMA_MEDS.textMuted} />
            </MedInputShell>
            <Text style={{ fontSize: 12, color: FIGMA_MEDS.textMuted, marginTop: 6, lineHeight: 16 }}>
              {ka.meds.doseAmountHint}
            </Text>
          </View>

          <View>
            <MedFieldLabel>{ka.meds.frequencyLabel}</MedFieldLabel>
            <MedInputShell onPress={() => setFreqSheet(true)} style={fieldShellStyle}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: FIGMA_MEDS.textMuted }}>Rx</Text>
              <Text style={{ flex: 1, fontSize: 16, color: FIGMA_MEDS.textSecondary }}>
                {ka.meds.timesPerDayLabel(timesPerDay)}
              </Text>
              <ChevronDown size={18} color={FIGMA_MEDS.textMuted} />
            </MedInputShell>
          </View>

          {times.slice(0, timesPerDay).map((time, index) => (
            <View key={`time-${index}`}>
              <MedFieldLabel>{timesPerDay > 1 ? `${ka.meds.timesLabel} ${index + 1}` : ka.meds.timesLabel}</MedFieldLabel>
              <MedInputShell onPress={() => openTimePicker(index)} style={fieldShellStyle}>
                <Clock size={18} color={FIGMA_MEDS.textMuted} strokeWidth={2} />
                <Text style={{ flex: 1, fontSize: 16, color: FIGMA_MEDS.textSecondary }}>{formatTime12h(time)}</Text>
                <ChevronDown size={18} color={FIGMA_MEDS.textMuted} />
              </MedInputShell>
            </View>
          ))}

          <MedicationDateField
            label={ka.meds.startDateLabel}
            value={startDate}
            onChange={(iso) => {
              setStartDate(iso);
              if (endDate < iso) setEndDate(addYearsToIso(iso, 1));
            }}
            maxIso={maxStartDate}
          />
          <MedicationDateField
            label={ka.meds.endDateLabel}
            value={endDate}
            onChange={setEndDate}
            minIso={minEndDate}
          />
        </View>

        <MedFormSectionHeader title={ka.meds.sectionTakeEvery} icon={<Calendar size={22} color={FIGMA_MEDS.brand} strokeWidth={2} />} />

        <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
          <View
            style={{
              backgroundColor: FIGMA_MEDS.cardBg,
              borderRadius: FIGMA_MEDS.cardRadiusSm,
              borderWidth: 1,
              borderColor: FIGMA_MEDS.border,
              padding: 16,
              gap: 12,
              ...FIGMA_MEDS.shadowInput,
            }}
          >
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
                      backgroundColor: active ? FIGMA_MEDS.brandQuaternary : FIGMA_MEDS.cardBg,
                      borderWidth: 1,
                      borderColor: active ? FIGMA_MEDS.brand : FIGMA_MEDS.borderTertiary,
                      ...FIGMA_MEDS.shadowInput,
                    }}
                  >
                    <Text style={{ fontWeight: '700', color: active ? FIGMA_MEDS.brand : FIGMA_MEDS.textPrimary }}>{letter}</Text>
                  </Pressable>
                );
              })}
            </View>
            <MedDivider />
            <Text style={{ fontSize: 14, color: FIGMA_MEDS.textSecondary }}>{daysSummaryKa(days) || ka.meds.noDaysSelected}</Text>
          </View>
        </View>

        <MedFormSectionHeader title={ka.meds.sectionReminder} icon={<Bell size={22} color={FIGMA_MEDS.brand} strokeWidth={2} />} />

        <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
          <View
            style={{
              backgroundColor: FIGMA_MEDS.cardBg,
              borderRadius: FIGMA_MEDS.cardRadius,
              borderWidth: 1,
              borderColor: FIGMA_MEDS.border,
              padding: 16,
              gap: 16,
              ...FIGMA_MEDS.shadowInput,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: FIGMA_MEDS.textPrimary }}>{ka.meds.refillLabel}</Text>
              <Switch
                value={refillReminder}
                onValueChange={setRefillReminder}
                trackColor={{ true: FIGMA_MEDS.brand, false: FIGMA_MEDS.border }}
                thumbColor="#fff"
              />
            </View>
            {refillReminder ? (
              <>
                <MedDivider />
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: FIGMA_MEDS.textPrimary }}>{ka.meds.refillThresholdLabel}</Text>
                    <Text style={{ fontSize: 14, color: FIGMA_MEDS.textSecondary, marginTop: 4 }}>{ka.meds.refillThresholdHint}</Text>
                  </View>
                  <View style={{ width: 72 }}>
                    <MedInputShell style={{ height: 40, paddingVertical: 0 }}>
                      <TextInput
                        value={refillThreshold}
                        onChangeText={setRefillThreshold}
                        keyboardType="numeric"
                        style={{ flex: 1, fontSize: 14, color: FIGMA_MEDS.textSecondary, padding: 0, textAlign: 'center' }}
                      />
                      <View style={{ width: 18, alignItems: 'center' }}>
                        <Pressable onPress={() => stepThreshold(1)}>
                          <ChevronUp size={14} color={FIGMA_MEDS.textMuted} />
                        </Pressable>
                        <Pressable onPress={() => stepThreshold(-1)}>
                          <ChevronDown size={14} color={FIGMA_MEDS.textMuted} />
                        </Pressable>
                      </View>
                    </MedInputShell>
                  </View>
                </View>
              </>
            ) : null}
          </View>
        </View>

        <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 }}>
          <MedFieldLabel>{ka.meds.pillColorLabel}</MedFieldLabel>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
            {FIGMA_MEDS.pillColors.map((c) => (
              <Pressable
                key={c}
                onPress={() => setPillColor(c)}
                style={{
                  padding: 2,
                  borderRadius: 999,
                  borderWidth: pillColor === c ? 2 : 0,
                  borderColor: FIGMA_MEDS.brand,
                }}
              >
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: c,
                    borderWidth: c === '#E5E7EB' ? 1 : 0,
                    borderColor: FIGMA_MEDS.borderTertiary,
                  }}
                />
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </ScrollView>

      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          padding: 16,
          backgroundColor: FIGMA_MEDS.white,
          borderTopWidth: 1,
          borderColor: FIGMA_MEDS.border,
        }}
      >
        <Pressable
          disabled={busy}
          onPress={save}
          style={{
            backgroundColor: FIGMA_MEDS.brand,
            borderRadius: 16,
            minHeight: FIGMA_MEDS.inputHeight,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: 8,
            opacity: busy ? 0.65 : 1,
            ...FIGMA_MEDS.shadowInput,
          }}
        >
          <Text style={{ color: FIGMA_MEDS.white, fontWeight: '700', fontSize: 16 }}>
            {busy ? ka.common.loading : ka.meds.addMedicationCta}
          </Text>
          <Plus size={20} color="#fff" strokeWidth={2.5} />
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
    </>
  );
}
