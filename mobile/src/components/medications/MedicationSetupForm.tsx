import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { Platform } from 'react-native';
import { useKeyboardPad } from '@/components/ui/KeyboardFormShell';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
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
import { MedsButton, MedsCard, PILL_COLORS, medsInk, medsPrimaryFill } from '@/components/medications/MedsHubUI';
import { ProfileMenuRow } from '@/components/profile/ProfileMenuRow';
import { HomeSectionHeading } from '@/components/home/HomeSectionHeading';
import { ka } from '@/i18n/ka';
import { ApiError, api } from '@/lib/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  DAY_LABELS_FULL_KA,
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
import { HUB, hubText, hubTint } from '@/theme/hub';
import { tx } from '@/i18n/locale';

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
  const bottomClearance = Math.max(insets.bottom, 16);
  // Sign-in keyboard behaviour: the CTA rides just above the keyboard (measured overlap, both platforms).
  const keyboard = useKeyboardPad(bottomClearance);
  // Worklets may capture only the shared value — never `keyboard` (it holds a view ref).
  const keyboardPad = keyboard.pad;
  const footerPad = useAnimatedStyle(() => ({ paddingBottom: keyboardPad.value }));
  const isAndroid = Platform.OS === 'android';
  const androidSpacer = useAnimatedStyle(() => ({ height: isAndroid ? Math.max(0, keyboardPad.value - bottomClearance) : 0 }));
  const ctaHeight = 80;
  const [medName, setMedName] = useState(initialName);
  // Opened without a catalogue pick („ხელით დამატება“): she types the name herself.
  const [editableName] = useState(() => !initialName.trim());
  const [form, setForm] = useState<MedicationForm>('pills');
  const [amount, setAmount] = useState(1);
  const [timesPerDay, setTimesPerDay] = useState(1);
  const [times, setTimes] = useState<string[]>(['10:30']);
  const [days, setDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [startDate, setStartDate] = useState(todayYmd());
  const [endDate, setEndDate] = useState(addYearsToIso(todayYmd(), 1));
  // No refill reminder here: nothing counts the pills left or sends one yet, so the form does not
  // promise it (it used to default to on). Values stored by older builds stay as they are.
  const [pillColor, setPillColor] = useState<string>(PILL_COLORS[0]);
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
  const genericLine = editableName
    ? tx('ჩაწერე სახელი ისე, როგორც შეფუთვაზეა', 'Type the name as it reads on the box')
    : [manufacturer || initialGeneric, strength, formLabel].filter((v) => v && v !== medName).join(' · ');

  const minEndDate = startDate;
  const maxStartDate = endDate;
  const accent = medsInk(dark);

  const toggleDay = (d: number) => {
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));
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
      Alert.alert(ka.common.error, tx('ჩაწერე წამლის სახელი', 'Enter the medication name'));
      return;
    }
    if (endDate < startDate) {
      Alert.alert(ka.common.error, ka.meds.endBeforeStartError);
      return;
    }
    // No day chosen: every reader takes an empty list as „every day“, the opposite of what she picked.
    if (days.length === 0) {
      Alert.alert(ka.common.error, ka.meds.noDaysSelected);
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
          startDate,
          endDate,
          imageUrl: initialImageUrl,
          catalogProductId,
          manufacturer,
          strength,
        },
      });
      await import('@/lib/mediEngagePrefs').then(({ clearUnfinishedDraft }) => clearUnfinishedDraft('medication_add'));
      void import('@/lib/funnel').then(({ trackFirstHealthAction }) => trackFirstHealthAction('medication')).catch(() => undefined);
      onSaved();
    } catch (err) {
      Alert.alert(ka.common.error, saveErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View ref={keyboard.frameRef} onLayout={keyboard.onLayout} style={{ flex: 1, backgroundColor: c.bg100 }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={{ paddingBottom: bottomClearance + ctaHeight + 24 }}
      >
        <View style={{ alignItems: 'center', paddingHorizontal: HUB.gutter, paddingTop: 24, paddingBottom: 8, gap: 20 }}>
          <View
            style={{
              width: 76,
              height: 76,
              borderRadius: 22,
              backgroundColor: hubTint(accent, dark),
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
          <View style={{ alignItems: 'center', gap: 6, alignSelf: 'stretch' }}>
            {editableName ? (
              <TextInput
                value={medName}
                onChangeText={setMedName}
                placeholder={ka.meds.namePlaceholder}
                placeholderTextColor={c.text300}
                accessibilityLabel={ka.meds.nameLabel}
                autoFocus
                autoCapitalize="sentences"
                returnKeyType="done"
                style={[styles.nameInput, { backgroundColor: c.surface, color: c.text100 }]}
              />
            ) : (
              <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 20, lineHeight: 26, color: c.text100, textAlign: 'center' }}>
                {medName || ka.meds.namePlaceholder}
              </Text>
            )}
            {genericLine ? (
              <Text style={[hubText.body, { fontSize: 15, lineHeight: 21, color: c.text200, textAlign: 'center' }]}>
                {genericLine}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={{ paddingHorizontal: HUB.gutter, marginTop: HUB.sectionGap - 12 }}>
          <HomeSectionHeading title={ka.meds.sectionGeneral} />
          <View style={[styles.card, { backgroundColor: c.surface }]}>
            <ProfileMenuRow icon={Pill} label={tx('ერთ მიღებაზე', 'Per dose')} value={dosageLabel} onPress={() => setDosageSheet(true)} ink="blue" />
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
            }} maxIso={maxStartDate} />
            <Divider color={c.bg300} />
            <MedicationDateField label={ka.meds.endDateLabel} value={endDate} onChange={setEndDate} minIso={minEndDate} isLast />
          </View>
        </View>

        <View style={{ paddingHorizontal: HUB.gutter, marginTop: HUB.sectionGap }}>
          <HomeSectionHeading title={ka.meds.sectionTakeEvery} />
          {/* Padded like every other card: presets first (one tap for the usual weeks), then the days. */}
          <MedsCard style={{ gap: 16 }}>
            {/* One segmented row on every phone: three equal parts, short labels. */}
            <View style={[styles.presets, { backgroundColor: c.bg200 }]}>
              {DAY_PRESETS.map((preset) => {
                const selected = sameDays(days, preset.days);
                return (
                  <Pressable
                    key={preset.key}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={preset.summary}
                    onPress={() => setDays([...preset.days])}
                    style={[styles.preset, selected && { backgroundColor: c.surface }]}
                  >
                    <Text numberOfLines={1} style={[hubText.link, { color: selected ? accent : c.text200 }]}>{preset.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {DAY_LETTERS.map((letter, idx) => {
                const active = days.includes(idx);
                return (
                  <Pressable
                    key={`${letter}-${idx}`}
                    onPress={() => toggleDay(idx)}
                    style={[styles.day, { backgroundColor: active ? medsPrimaryFill(c, dark) : c.bg200 }]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={DAY_LABELS_FULL_KA[idx] ?? letter}
                  >
                    <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 15, color: active ? '#FFFFFF' : c.text100 }}>{letter}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={[hubText.caption, { color: days.length ? c.text200 : c.danger }]}>{daysLine(days)}</Text>
          </MedsCard>
        </View>

        <View style={{ paddingHorizontal: HUB.gutter, marginTop: HUB.sectionGap, paddingBottom: 4 }}>
          <HomeSectionHeading title={ka.meds.pillColorLabel} />
          <MedsCard>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              {PILL_COLORS.map((color) => {
                const active = pillColor === color;
                return (
                  <Pressable
                    key={color}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={color}
                    onPress={() => setPillColor(color)}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: active ? hubTint(accent, dark) : 'transparent',
                    }}
                  >
                    <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: color, borderWidth: color === '#E5E7EB' ? 1 : 0, borderColor: c.bg300 }} />
                  </Pressable>
                );
              })}
            </View>
          </MedsCard>
        </View>
        <Animated.View style={androidSpacer} />
      </ScrollView>

      <Animated.View style={[styles.footer, { bottom: 0, backgroundColor: c.bg100 }, footerPad]}>
        <MedsButton label={ka.meds.addMedicationCta} icon={Plus} loading={busy} onPress={save} />
      </Animated.View>

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

const DAY_PRESETS = [
  { key: 'all', label: tx('ყოველდღე', 'Every day'), summary: tx('ყოველდღე', 'Every day'), days: [0, 1, 2, 3, 4, 5, 6] },
  { key: 'weekdays', label: tx('ორშ–პარ', 'Mon–Fri'), summary: tx('სამუშაო დღეებში', 'On weekdays'), days: [0, 1, 2, 3, 4] },
  { key: 'weekend', label: tx('შაბ–კვ', 'Sat–Sun'), summary: tx('შაბათ-კვირას', 'At weekends'), days: [5, 6] },
] as const;

function sameDays(a: number[], b: readonly number[]) {
  return a.length === b.length && b.every((day) => a.includes(day));
}

/** The chosen days in words — „ყოველდღე“ / „სამუშაო დღეები“ instead of seven names. */
function daysLine(days: number[]): string {
  if (!days.length) return ka.meds.noDaysSelected;
  const preset = DAY_PRESETS.find((p) => sameDays(days, p.days));
  return preset ? preset.summary : daysSummaryKa(days);
}

/**
 * The server's own reason when it gives one: a 400 carries it in `fields` („დღეში დასაშვებია 1-დან 8
 * მიღებამდე“), while its top-line `error` is only the generic „შევსებული მონაცემები არასწორია.“
 */
function saveErrorMessage(err: unknown): string {
  if (!(err instanceof ApiError)) return ka.common.error;
  const field = err.fields?.find((f) => typeof f?.message === 'string' && f.message.trim());
  return field?.message || err.message || ka.common.error;
}

function Divider({ color }: { color: string }) {
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: color, marginLeft: 16 }} />;
}

const styles = StyleSheet.create({
  card: { borderRadius: HUB.cardRadius, overflow: 'hidden' },
  day: { flex: 1, maxWidth: 46, aspectRatio: 1, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  nameInput: {
    alignSelf: 'stretch',
    minHeight: 52,
    borderRadius: HUB.tileRadius,
    paddingHorizontal: 16,
    fontFamily: 'NotoSansGeorgian_700Bold',
    fontSize: 18,
    textAlign: 'center',
  },
  editBadge: {
    position: 'absolute',
    bottom: -4,
    right: -2,
    borderRadius: 999,
    padding: 4,
  },
  presets: { flexDirection: 'row', borderRadius: 14, padding: 3, gap: 3 },
  preset: { flex: 1, minHeight: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: HUB.gutter,
    paddingTop: 12,
  },
});
