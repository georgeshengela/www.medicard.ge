import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  ArrowLeft,
  ArrowRight,
  BellRing,
  CalendarClock,
  Check,
  MapPinned,
  Stethoscope,
  UserRound,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { Button } from '@/components/ui/Button';
import { DetailCardSkeleton } from '@/components/ui/Skeleton';
import { Input } from '@/components/ui/Input';
import { CycleDateField } from '@/components/cycle/CycleDateField';
import { AddressSearchField } from '@/components/visits/AddressSearchField';
import { VisitMapPreview } from '@/components/visits/VisitMapPreview';
import { ka } from '@/i18n/ka';
import {
  DEFAULT_REMINDER_CONFIG,
  DOCTOR_TYPES,
  POPULAR_VISIT_TIMES,
  REMINDER_OFFSET_PRESETS,
  VISIT_TIME_SLOTS,
  type DoctorTypeCode,
} from '@/constants/visits';
import { ApiError, api, type DoctorVisit, type GeocodeResult, type VisitReminderConfig } from '@/lib/api';
import { defaultVisitTime, todayIsoLocal } from '@/lib/visitReminders';
import { formatCycleDateKa } from '@/components/cycle/CycleUI';
import { useThemeColors } from '@/theme/colors';

type Props = {
  visitId?: string;
};

const STEPS: { key: string; title: string; hint: string; icon: LucideIcon }[] = [
  { key: 'doctor', title: ka.visits.sectionDoctor, hint: ka.visits.wizardDoctorHint, icon: UserRound },
  { key: 'when', title: ka.visits.sectionWhen, hint: ka.visits.wizardWhenHint, icon: CalendarClock },
  { key: 'where', title: ka.visits.sectionWhere, hint: ka.visits.wizardWhereHint, icon: MapPinned },
  { key: 'extras', title: ka.visits.sectionExtras, hint: ka.visits.wizardExtrasHint, icon: BellRing },
];

function useKeyboardHeight() {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const show = Keyboard.addListener(showEvent, (event) => {
      setHeight(event.endCoordinates.height);
    });
    const hide = Keyboard.addListener(hideEvent, () => setHeight(0));

    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return height;
}

export function VisitEditorScreen({ visitId }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const keyboardHeight = useKeyboardHeight();
  const scrollRef = useRef<ScrollView>(null);

  const [loading, setLoading] = useState(Boolean(visitId));
  const [step, setStep] = useState(0);
  const [showAllTimes, setShowAllTimes] = useState(false);

  const [doctorType, setDoctorType] = useState<DoctorTypeCode>('GP');
  const [doctorFirstName, setDoctorFirstName] = useState('');
  const [doctorLastName, setDoctorLastName] = useState('');
  const [visitDate, setVisitDate] = useState(todayIsoLocal());
  const [visitTime, setVisitTime] = useState(defaultVisitTime());
  const [addressText, setAddressText] = useState('');
  const [geo, setGeo] = useState<GeocodeResult | null>(null);
  const [notes, setNotes] = useState('');
  const [offsets, setOffsets] = useState<number[]>(DEFAULT_REMINDER_CONFIG.offsetsMinutes);
  const [repeatCount, setRepeatCount] = useState(DEFAULT_REMINDER_CONFIG.repeatCount);
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visitId) return;
    let alive = true;
    (async () => {
      try {
        const { visits } = await api.visits.list();
        if (!alive) return;
        const initial = visits.find((v) => v.id === visitId);
        if (!initial) {
          setError(ka.common.error);
          return;
        }
        hydrate(initial);
      } catch {
        if (alive) setError(ka.common.error);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [visitId]);

  const hydrate = (initial: DoctorVisit) => {
    setDoctorType(initial.doctorType);
    setDoctorFirstName(initial.doctorFirstName ?? '');
    setDoctorLastName(initial.doctorLastName ?? '');
    setVisitDate(initial.visitDate);
    setVisitTime(initial.visitTime);
    setAddressText(initial.addressLabel ?? initial.address ?? '');
    setGeo(
      initial.lat != null && initial.lng != null
        ? {
            id: initial.id,
            label: initial.addressLabel ?? initial.address ?? '',
            lat: initial.lat,
            lng: initial.lng,
          }
        : null,
    );
    setNotes(initial.notes ?? '');
    setOffsets(initial.reminderConfig?.offsetsMinutes ?? DEFAULT_REMINDER_CONFIG.offsetsMinutes);
    setRepeatCount(initial.reminderConfig?.repeatCount ?? 1);
    setRemindersEnabled(initial.reminderConfig?.enabled ?? true);
  };

  const doctorLabel = useMemo(
    () => DOCTOR_TYPES.find((t) => t.code === doctorType)?.label ?? doctorType,
    [doctorType],
  );

  const summaryLine = useMemo(() => {
    const parts = [doctorLabel];
    if (visitDate) parts.push(formatCycleDateKa(visitDate));
    if (visitTime) parts.push(visitTime);
    return parts.join(' · ');
  }, [doctorLabel, visitDate, visitTime]);

  const toggleOffset = (minutes: number) => {
    setOffsets((prev) =>
      prev.includes(minutes) ? prev.filter((m) => m !== minutes) : [...prev, minutes].sort((a, b) => b - a),
    );
  };

  const reminderConfig: VisitReminderConfig = {
    enabled: remindersEnabled,
    offsetsMinutes: offsets.length ? offsets : [60],
    repeatCount,
  };

  const goNext = () => {
    if (step === 1 && (!visitDate || !visitTime)) {
      setError(ka.common.required);
      return;
    }
    setError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };

  const goBack = () => {
    if (step === 0) {
      router.back();
      return;
    }
    setError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    setStep((s) => s - 1);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };

  const save = async () => {
    if (!visitDate || !visitTime) {
      setError(ka.common.required);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const body = {
        doctorType,
        doctorFirstName: doctorFirstName.trim() || undefined,
        doctorLastName: doctorLastName.trim() || undefined,
        visitDate,
        visitTime,
        address: addressText.trim() || undefined,
        addressLabel: geo?.label ?? (addressText.trim() || undefined),
        lat: geo?.lat,
        lng: geo?.lng,
        notes: notes.trim() || undefined,
        reminderConfig,
      };

      if (visitId) {
        await api.visits.update(visitId, body);
      } else {
        await api.visits.create(body);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      router.back();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : ka.common.error);
    } finally {
      setBusy(false);
    }
  };

  const footerInset = Math.max(insets.bottom, 12);
  const scrollBottom = 24 + (keyboardHeight > 0 ? keyboardHeight : 0);
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const timeSlots = VISIT_TIME_SLOTS.filter((_, i) => i >= 16 && i <= 43);

  if (loading) {
    return (
      <View className="flex-1 bg-bg-100 px-5 pt-8">
        <DetailCardSkeleton />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-bg-100">
      <View className="border-b border-bg-300 bg-surface px-5 pb-4 pt-2" style={{ paddingTop: insets.top + 8 }}>
        <View className="mb-4 flex-row items-center">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={ka.common.back}
            onPress={goBack}
            className="mr-3 h-10 w-10 items-center justify-center rounded-xl bg-bg-200"
          >
            <ArrowLeft size={20} color={colors.text100} strokeWidth={2.2} />
          </Pressable>
          <View className="flex-1">
            <Text className="text-lg font-black text-text-100">
              {visitId ? ka.visits.editTitle : ka.visits.addTitle}
            </Text>
            <Text className="text-xs text-text-300">{ka.visits.stepOf(step + 1, STEPS.length)}</Text>
          </View>
          <View className="h-10 w-10 items-center justify-center rounded-xl bg-accent-100">
            <Stethoscope size={18} color={colors.primary200} strokeWidth={2.2} />
          </View>
        </View>

        <View className="mb-3 flex-row gap-2">
          {STEPS.map((s, index) => {
            const done = index < step;
            const active = index === step;
            return (
              <View key={s.key} className="flex-1">
                <View
                  className={`h-1.5 rounded-full ${done || active ? 'bg-primary-200' : 'bg-bg-300'}`}
                  style={{ opacity: active ? 1 : done ? 0.85 : 0.45 }}
                />
              </View>
            );
          })}
        </View>

        {step > 0 ? (
          <View className="rounded-xl border border-bg-300 bg-bg-100 px-3.5 py-2.5">
            <Text className="text-xs font-semibold text-text-300">{ka.visits.summaryLabel}</Text>
            <Text className="mt-0.5 text-sm font-bold text-text-100" numberOfLines={2}>
              {summaryLine}
            </Text>
          </View>
        ) : null}
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: scrollBottom }}
        >
        <View className="mb-5 flex-row items-center">
          <View className="mr-3 h-11 w-11 items-center justify-center rounded-2xl bg-accent-100">
            <current.icon size={20} color={colors.primary200} strokeWidth={2.2} />
          </View>
          <View className="flex-1">
            <Text className="text-xl font-black text-text-100">{current.title}</Text>
            <Text className="mt-0.5 text-sm text-text-300">{current.hint}</Text>
          </View>
        </View>

        {step === 0 ? (
          <View>
            <View className="flex-row flex-wrap gap-2">
              {DOCTOR_TYPES.map((t) => {
                const on = doctorType === t.code;
                return (
                  <Pressable
                    key={t.code}
                    accessibilityRole="button"
                    onPress={() => setDoctorType(t.code)}
                    style={{ width: '31.5%' }}
                    className={`items-center rounded-2xl border px-2 py-3 ${
                      on ? 'border-primary-200 bg-primary-200' : 'border-bg-300 bg-surface'
                    }`}
                  >
                    {on ? (
                      <View className="mb-1">
                        <Check size={14} color="#fff" strokeWidth={3} />
                      </View>
                    ) : (
                      <View className="mb-1 h-3.5" />
                    )}
                    <Text
                      numberOfLines={2}
                      className={`text-center text-[11px] font-bold leading-4 ${on ? 'text-white' : 'text-text-200'}`}
                    >
                      {t.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View className="mt-5 rounded-2xl border border-bg-300 bg-surface p-4">
              <Text className="mb-3 text-xs font-bold uppercase tracking-wide text-text-300">
                {ka.visits.doctorNameOptional}
              </Text>
              <Input
                label={ka.visits.doctorFirstName}
                placeholder={ka.visits.doctorFirstNamePh}
                value={doctorFirstName}
                onChangeText={setDoctorFirstName}
              />
              <View className="mt-3">
                <Input
                  label={ka.visits.doctorLastName}
                  placeholder={ka.visits.doctorLastNamePh}
                  value={doctorLastName}
                  onChangeText={setDoctorLastName}
                />
              </View>
            </View>
          </View>
        ) : null}

        {step === 1 ? (
          <View>
            <CycleDateField
              label={ka.visits.visitDate}
              value={visitDate}
              onChange={setVisitDate}
              range="due"
              variant="default"
            />

            <View className="mt-5 items-center rounded-2xl border border-primary-200/30 bg-accent-100/20 py-4">
              <Text className="text-[10px] font-bold uppercase tracking-widest text-text-300">
                {ka.visits.visitTime}
              </Text>
              <Text className="mt-1 text-4xl font-black tabular-nums text-primary-100">{visitTime}</Text>
            </View>

            <Text className="mb-2 mt-5 text-xs font-bold text-text-300">{ka.visits.popularTimes}</Text>
            <View className="flex-row flex-wrap gap-2">
              {POPULAR_VISIT_TIMES.map((slot) => {
                const on = visitTime === slot;
                return (
                  <Pressable
                    key={slot}
                    accessibilityRole="button"
                    onPress={() => setVisitTime(slot)}
                    className={`min-w-[30%] flex-1 items-center rounded-xl border py-3 ${
                      on ? 'border-primary-200 bg-primary-200' : 'border-bg-300 bg-surface'
                    }`}
                  >
                    <Text className={`text-base font-bold tabular-nums ${on ? 'text-white' : 'text-text-200'}`}>
                      {slot}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={() => setShowAllTimes((v) => !v)}
              className="mt-4 items-center rounded-xl border border-dashed border-bg-300 py-3 active:bg-bg-200"
            >
              <Text className="text-sm font-semibold text-primary-200">
                {showAllTimes ? ka.visits.hideAllTimes : ka.visits.showAllTimes}
              </Text>
            </Pressable>

            {showAllTimes ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-3">
                <View className="flex-row gap-2 pr-2">
                  {timeSlots.map((slot) => {
                    const on = visitTime === slot;
                    return (
                      <Pressable
                        key={slot}
                        accessibilityRole="button"
                        onPress={() => setVisitTime(slot)}
                        className={`min-w-[68px] items-center rounded-xl border px-3 py-2.5 ${
                          on ? 'border-primary-200 bg-primary-200' : 'border-bg-300 bg-surface'
                        }`}
                      >
                        <Text className={`text-sm font-bold tabular-nums ${on ? 'text-white' : 'text-text-200'}`}>
                          {slot}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>
            ) : null}
          </View>
        ) : null}

        {step === 2 ? (
          <View>
            <AddressSearchField
              value={addressText}
              selected={geo}
              onChangeText={setAddressText}
              onSelect={setGeo}
            />
            {geo ? (
              <View className="mt-4">
                <VisitMapPreview lat={geo.lat} lng={geo.lng} label={geo.label} height={200} />
              </View>
            ) : (
              <View className="mt-4 items-center rounded-2xl border border-dashed border-bg-300 bg-surface px-4 py-8">
                <MapPinned size={28} color={colors.text300} strokeWidth={1.8} />
                <Text className="mt-2 text-center text-sm text-text-300">{ka.visits.mapPlaceholder}</Text>
              </View>
            )}
          </View>
        ) : null}

        {step === 3 ? (
          <View>
            <Text className="mb-2 text-sm font-semibold text-text-200">{ka.visits.notes}</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder={ka.visits.notesPh}
              placeholderTextColor={colors.text300}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              className="min-h-[100px] rounded-2xl border border-bg-300 bg-surface px-4 py-3.5 text-base text-text-100"
            />

            <View className="mt-5 rounded-2xl border border-bg-300 bg-surface p-4">
              <View className="mb-3 flex-row items-center justify-between">
                <View className="flex-row items-center">
                  <BellRing size={16} color={colors.primary200} strokeWidth={2.2} />
                  <Text className="ml-2 text-base font-bold text-text-100">{ka.visits.reminders}</Text>
                </View>
                <Pressable
                  accessibilityRole="switch"
                  accessibilityState={{ checked: remindersEnabled }}
                  onPress={() => setRemindersEnabled((v) => !v)}
                  className={`rounded-full px-3 py-1.5 ${remindersEnabled ? 'bg-primary-200' : 'bg-bg-300'}`}
                >
                  <Text className={`text-xs font-bold ${remindersEnabled ? 'text-white' : 'text-text-300'}`}>
                    {remindersEnabled ? ka.cycle.remindersEnabled : 'OFF'}
                  </Text>
                </Pressable>
              </View>

              {remindersEnabled ? (
                <>
                  <Text className="mb-2 text-xs text-text-300">{ka.visits.remindersHint}</Text>
                  <View className="flex-row flex-wrap gap-2">
                    {REMINDER_OFFSET_PRESETS.map((p) => {
                      const on = offsets.includes(p.minutes);
                      return (
                        <Pressable
                          key={p.minutes}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: on }}
                          onPress={() => toggleOffset(p.minutes)}
                          className={`rounded-full border px-3 py-2 ${
                            on ? 'border-primary-200 bg-accent-100/40' : 'border-bg-300 bg-bg-100'
                          }`}
                        >
                          <Text className={`text-xs font-semibold ${on ? 'text-primary-100' : 'text-text-300'}`}>
                            {p.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  <Text className="mb-2 mt-4 text-sm font-semibold text-text-200">{ka.visits.reminderRepeat}</Text>
                  <View className="flex-row gap-2">
                    {[1, 2, 3].map((n) => {
                      const on = repeatCount === n;
                      const label = n === 1 ? ka.visits.repeat1 : n === 2 ? ka.visits.repeat2 : ka.visits.repeat3;
                      return (
                        <Pressable
                          key={n}
                          accessibilityRole="button"
                          onPress={() => setRepeatCount(n)}
                          className={`flex-1 items-center rounded-xl border py-3 ${
                            on ? 'border-primary-200 bg-primary-200' : 'border-bg-300 bg-bg-100'
                          }`}
                        >
                          <Text className={`text-sm font-bold ${on ? 'text-white' : 'text-text-200'}`}>{label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              ) : null}
            </View>
          </View>
        ) : null}

        {error ? <Text className="mt-4 text-sm text-state-danger">{error}</Text> : null}
        </ScrollView>

        <View
          className="border-t border-bg-300 bg-surface px-5 pt-3"
          style={{ paddingBottom: footerInset }}
        >
          <View className="flex-row gap-3">
            {step > 0 ? (
              <View className="flex-1">
                <Button label={ka.common.back} variant="secondary" onPress={goBack} />
              </View>
            ) : null}
            <View className={step > 0 ? 'flex-[1.4]' : 'flex-1'}>
              {isLast ? (
                <Button label={ka.visits.save} loading={busy} onPress={save} size="lg" icon={Check} />
              ) : (
                <Button label={ka.visits.next} onPress={goNext} size="lg" icon={ArrowRight} />
              )}
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
