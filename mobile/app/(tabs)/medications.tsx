import React, { useCallback, useState } from 'react';
import { Alert, Modal, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BellRing, Clock, Pill, Plus, ShieldCheck, Trash2, X } from 'lucide-react-native';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Markdown } from '@/components/ui/Markdown';
import { Disclaimer } from '@/components/Disclaimer';
import { EmptyState } from '@/components/EmptyState';
import { QuotaSheet } from '@/components/QuotaSheet';
import { ka } from '@/i18n/ka';
import { ApiError, api, type Medication, type ScheduledDose } from '@/lib/api';
import { nextDoseTime } from '@/lib/format';
import { syncMedicationReminders } from '@/lib/notifications';
import { useTabBarInset } from '@/components/navigation/FloatingTabBar';
import { useThemeColors } from '@/theme/colors';
import { useAuth } from '@/store/AuthContext';

const HOURS = Array.from({ length: 24 }, (_, hour) => `${String(hour).padStart(2, '0')}:00`);

export default function Medications() {
  const { applyUsage } = useAuth();
  const colors = useThemeColors();
  const tabInset = useTabBarInset();

  const [medications, setMedications] = useState<Medication[]>([]);
  const [schedule, setSchedule] = useState<ScheduledDose[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [reminderCount, setReminderCount] = useState<number | null>(null);
  const [review, setReview] = useState<string | null>(null);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [quotaBlock, setQuotaBlock] = useState<number | undefined>(undefined);

  const load = useCallback(async () => {
    try {
      const response = await api.medications.list();
      setMedications(response.medications);
      setSchedule(response.schedule);
      // Local notifications are a mirror of the server schedule, so re-sync on every read.
      const scheduled = await syncMedicationReminders(response.schedule);
      setReminderCount(scheduled);
    } catch {
      /* the pull-to-refresh affordance is the retry */
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const remove = (medication: Medication) => {
    Alert.alert(ka.meds.deleteConfirm, medication.medName, [
      { text: ka.common.cancel, style: 'cancel' },
      {
        text: ka.common.delete,
        style: 'destructive',
        onPress: async () => {
          await api.medications.remove(medication.id).catch(() => undefined);
          load();
        },
      },
    ]);
  };

  const toggleActive = async (medication: Medication) => {
    await api.medications.update(medication.id, { active: !medication.active }).catch(() => undefined);
    load();
  };

  const runReview = async () => {
    setReviewBusy(true);
    try {
      const response = await api.ai.medicationReview();
      setReview(response.analysis);
      applyUsage(response.usage);
    } catch (err) {
      if (err instanceof ApiError && err.isQuotaExceeded) {
        setQuotaBlock(err.usage?.resetsInMs);
        if (err.usage) applyUsage(err.usage);
      } else {
        Alert.alert(ka.common.error, err instanceof ApiError ? err.message : ka.common.error);
      }
    } finally {
      setReviewBusy(false);
    }
  };

  const upcoming = nextDoseTime(schedule.map((dose) => dose.time));

  return (
    <>
      <ScrollView
        className="flex-1 bg-bg-100"
        contentContainerStyle={{ paddingBottom: tabInset }}
        contentContainerClassName="px-4 pt-3"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary200} />}
        showsVerticalScrollIndicator={false}
      >
        {reminderCount !== null && reminderCount > 0 ? (
          <View className="mb-3 flex-row items-center rounded-2xl border border-state-success/20 bg-state-successBg px-3.5 py-2.5">
            <BellRing size={15} color={colors.success} strokeWidth={2.2} />
            <Text className="ml-2 text-sm font-semibold text-state-success">
              {ka.meds.remindersScheduled(reminderCount)}
            </Text>
          </View>
        ) : null}

        {schedule.length > 0 ? (
          <Card className="mb-3">
            <Text className="mb-3 text-sm font-bold uppercase text-text-300">{ka.meds.todaySchedule}</Text>
            {schedule.map((dose, index) => {
              const isNext = dose.time === upcoming;
              return (
                <View
                  key={`${dose.medicationId}-${dose.time}`}
                  className={`flex-row items-center py-2 ${index > 0 ? 'border-t border-bg-300' : ''}`}
                >
                  <View
                    className={`h-9 w-14 items-center justify-center rounded-xl ${
                      isNext ? 'bg-primary-200' : 'bg-bg-200'
                    }`}
                  >
                    <Text className={`text-sm font-bold ${isNext ? 'text-white' : 'text-text-200'}`}>{dose.time}</Text>
                  </View>
                  <View className="ml-3 flex-1">
                    <Text numberOfLines={1} className="text-base font-semibold text-text-100">
                      {dose.medName}
                    </Text>
                    <Text numberOfLines={1} className="text-sm text-text-300">
                      {dose.notes ? `${dose.dosage} · ${dose.notes}` : dose.dosage}
                    </Text>
                  </View>
                  {isNext ? <Badge label={ka.home.nextDose} tone="brand" icon={Clock} /> : null}
                </View>
              );
            })}
          </Card>
        ) : null}

        {medications.length === 0 ? (
          <EmptyState icon={Pill} title={ka.meds.empty} body={ka.meds.emptyHint}>
            <Button label={ka.meds.addTitle} icon={Plus} size="lg" onPress={() => setEditorOpen(true)} />
          </EmptyState>
        ) : (
          <>
            {medications.map((medication) => (
              <Card key={medication.id} className="mb-2.5">
                <View className="flex-row items-start">
                  <View
                    className={`h-10 w-10 items-center justify-center rounded-xl ${
                      medication.active ? 'bg-accent-100/50' : 'bg-bg-200'
                    }`}
                  >
                    <Pill
                      size={18}
                      color={medication.active ? colors.primary200 : colors.text300}
                      strokeWidth={2.1}
                    />
                  </View>

                  <View className="ml-3 flex-1">
                    <Text className="text-base font-bold text-text-100">{medication.medName}</Text>
                    <Text className="mt-0.5 text-sm text-text-200">{medication.dosage}</Text>
                    <Text className="mt-0.5 text-sm text-text-300">{medication.frequency}</Text>
                    {medication.notes ? (
                      <Text className="mt-0.5 text-sm italic text-text-300">{medication.notes}</Text>
                    ) : null}

                    <View className="mt-2.5 flex-row items-center">
                      <Badge
                        label={medication.active ? ka.meds.activeLabel : ka.meds.pausedLabel}
                        tone={medication.active ? 'success' : 'neutral'}
                      />
                      <Pressable
                        accessibilityRole="button"
                        hitSlop={8}
                        className="ml-3"
                        onPress={() => toggleActive(medication)}
                      >
                        <Text className="text-sm font-semibold text-primary-200">
                          {medication.active ? ka.meds.pause : ka.meds.resume}
                        </Text>
                      </Pressable>
                    </View>
                  </View>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={ka.common.delete}
                    hitSlop={10}
                    onPress={() => remove(medication)}
                  >
                    <Trash2 size={17} color={colors.text300} strokeWidth={2} />
                  </Pressable>
                </View>
              </Card>
            ))}

            <View className="mt-2">
              <Button label={ka.meds.addTitle} icon={Plus} variant="secondary" onPress={() => setEditorOpen(true)} />
            </View>

            <View className="mt-2.5">
              <Button
                label={ka.meds.reviewCta}
                icon={ShieldCheck}
                loading={reviewBusy}
                onPress={runReview}
                disabled={medications.filter((m) => m.active).length === 0}
              />
            </View>
          </>
        )}

        {review ? (
          <Card className="mt-3">
            <Text className="mb-3 text-lg font-bold text-text-100">{ka.meds.reviewTitle}</Text>
            <Markdown content={review} />
          </Card>
        ) : null}

        <Disclaimer className="mt-4" />
      </ScrollView>

      <MedicationEditor
        visible={editorOpen}
        onClose={() => setEditorOpen(false)}
        onSaved={() => {
          setEditorOpen(false);
          load();
        }}
      />

      <QuotaSheet
        visible={quotaBlock !== undefined}
        resetsInMs={quotaBlock}
        onClose={() => setQuotaBlock(undefined)}
        onUpgrade={() => {
          setQuotaBlock(undefined);
          Alert.alert(ka.usage.upsellTitle, ka.usage.premiumSoon);
        }}
      />
    </>
  );
}

function MedicationEditor({
  visible,
  onClose,
  onSaved,
}: {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const [medName, setMedName] = useState('');
  const [dosage, setDosage] = useState('');
  const [times, setTimes] = useState<string[]>(['09:00']);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setMedName('');
    setDosage('');
    setTimes(['09:00']);
    setNotes('');
    setError(null);
  };

  const toggleTime = (time: string) => {
    setTimes((prev) =>
      prev.includes(time) ? prev.filter((t) => t !== time) : prev.length < 8 ? [...prev, time].sort() : prev,
    );
  };

  const save = async () => {
    if (medName.trim().length < 2) {
      setError(ka.meds.nameLabel + ': ' + ka.common.required);
      return;
    }
    if (dosage.trim().length < 1) {
      setError(ka.meds.dosageLabel + ': ' + ka.common.required);
      return;
    }
    if (times.length === 0) {
      setError(ka.meds.timesLabel + ': ' + ka.common.required);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await api.medications.create({
        medName: medName.trim(),
        dosage: dosage.trim(),
        frequency: times.join(', '),
        notes: notes.trim() || undefined,
      });
      reset();
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : ka.common.error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-text-100/45">
        <View className="max-h-[88%] rounded-t-3xl border-t border-bg-300 bg-bg-100 px-5 pt-3">
          <View className="mb-4 h-1 w-10 self-center rounded-full bg-bg-300" />

          <View className="mb-4 flex-row items-center justify-between">
            <Text className="text-xl font-bold text-text-100">{ka.meds.addTitle}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={ka.common.close} hitSlop={12} onPress={onClose}>
              <X size={20} color={colors.text300} strokeWidth={2.2} />
            </Pressable>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
          >
            <View className="gap-3.5">
              <Input
                label={ka.meds.nameLabel}
                placeholder={ka.meds.namePlaceholder}
                value={medName}
                onChangeText={setMedName}
              />
              <Input
                label={ka.meds.dosageLabel}
                placeholder={ka.meds.dosagePlaceholder}
                value={dosage}
                onChangeText={setDosage}
              />
            </View>

            <Text className="mb-2 mt-4 text-sm font-semibold text-text-200">{ka.meds.timesLabel}</Text>
            <View className="mb-2.5 flex-row flex-wrap">
              {ka.meds.frequencyPresets.map((preset) => (
                <Pressable
                  key={preset.label}
                  accessibilityRole="button"
                  onPress={() => setTimes([...preset.times])}
                  className="mb-2 mr-2 rounded-full border border-primary-300/40 bg-accent-100/25 px-3 py-1.5 active:opacity-70"
                >
                  <Text className="text-xs font-semibold text-primary-100">{preset.label}</Text>
                </Pressable>
              ))}
            </View>

            <Text className="mb-2 text-xs text-text-300">{ka.meds.timesHint}</Text>
            <View className="flex-row flex-wrap">
              {HOURS.map((hour) => {
                const selected = times.includes(hour);
                return (
                  <Pressable
                    key={hour}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}
                    onPress={() => toggleTime(hour)}
                    className={`mb-2 mr-2 rounded-xl border px-2.5 py-1.5 active:opacity-70 ${
                      selected ? 'border-primary-200 bg-primary-200' : 'border-bg-300 bg-surface'
                    }`}
                  >
                    <Text className={`text-xs font-semibold ${selected ? 'text-white' : 'text-text-300'}`}>{hour}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View className="mt-3">
              <Text className="mb-1.5 text-sm font-semibold text-text-200">
                {ka.meds.notesLabel} <Text className="font-normal text-text-300">({ka.common.optional})</Text>
              </Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder={ka.meds.notesPlaceholder}
                placeholderTextColor={colors.text300}
                className="rounded-2xl border border-bg-300 bg-surface px-4 py-3 text-base text-text-100"
                style={{ fontSize: 15 }}
              />
            </View>

            {error ? (
              <View className="mt-3 rounded-2xl border border-state-danger/20 bg-state-dangerBg p-3.5">
                <Text className="text-sm text-state-danger">{error}</Text>
              </View>
            ) : null}

            <View className="mt-5">
              <Button label={ka.common.save} size="lg" loading={busy} onPress={save} />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
