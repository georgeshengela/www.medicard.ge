import React, { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  Bell,
  Boxes,
  CalendarDays,
  CalendarRange,
  Check,
  Clock,
  FlaskConical,
  Pill,
  Tag,
  Trash2,
  Utensils,
  X,
} from 'lucide-react-native';
import { HomeSectionHeading } from '@/components/home/HomeSectionHeading';
import { MedicationHeaderAction } from '@/components/medications/MedicationNavHeader';
import { MedicationPillIcon } from '@/components/medications/MedicationPillIcon';
import { MedicationRescheduleSheet } from '@/components/medications/MedicationRescheduleSheet';
import { MedsCard, MedsChip, MedsInfoRow, MedsStatusPill, doseAttentionInk, medsPrimaryFill, medsInk } from '@/components/medications/MedsHubUI';
import { ProfileMenuRow } from '@/components/profile/ProfileMenuRow';
import { DetailCardSkeleton } from '@/components/ui/Skeleton';
import { useMedicationImages } from '@/hooks/useMedicationImages';
import { useMedications } from '@/hooks/useMedications';
import { ka } from '@/i18n/ka';
import { tx } from '@/i18n/locale';
import { api } from '@/lib/api';
import { deleteMedication } from '@/lib/medicationDelete';
import { cancelNotificationsByPrefix } from '@/lib/notifications';
import {
  daysSummaryKa,
  findDoseLog,
  formatTime24h,
  parseFrequencyTimes,
  parseMedicationConfig,
  saveDoseLog,
  todayYmd,
} from '@/lib/medications.shared';
import { useIsDark, useThemeColors } from '@/theme/colors';
import { HUB, hubInk, hubText, hubTint } from '@/theme/hub';

/** 04.09.26 — short enough for „დაწყება – დასრულება“ on one line. */
function shortDate(iso?: string) {
  if (!iso) return '…';
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y.slice(2)}`;
}

export function MedicationDoseScreen() {
  const c = useThemeColors();
  const dark = useIsDark();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id, time, date } = useLocalSearchParams<{ id: string; time?: string; date?: string }>();
  const { medications, doseLogs, setDoseLogs, load, loading } = useMedications();
  const images = useMedicationImages(medications);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const med = medications.find((item) => item.id === id);
  const cfg = parseMedicationConfig(med?.config);
  const times = parseFrequencyTimes(med?.frequency ?? '');
  const doseTime = time ?? times[0] ?? '09:00';
  const doseDate = date ?? todayYmd();
  const log = findDoseLog(doseLogs, id, doseDate, doseTime);

  const markDose = useCallback(
    async (status: 'taken' | 'skipped', newTime?: string) => {
      const entry = {
        medicationId: id,
        date: doseDate,
        time: newTime ?? doseTime,
        status,
        updatedAt: new Date().toISOString(),
      };
      await saveDoseLog(entry);
      setDoseLogs((prev) => [
        ...prev.filter((item) => !(item.medicationId === id && item.date === doseDate && item.time === doseTime)),
        entry,
      ]);
      setRescheduleOpen(false);
      router.back();
    },
    [id, doseDate, doseTime, router, setDoseLogs],
  );

  const remove = () => {
    if (!med) return;
    Alert.alert(ka.meds.deleteFromSchedule, med.medName, [
      { text: ka.common.cancel, style: 'cancel' },
      {
        text: ka.common.delete,
        style: 'destructive',
        onPress: async () => {
          // A failed delete says so and keeps the medication and its reminders; a done one removes
          // its reminders at once, so none fires for a medication she believes is gone.
          const result = await deleteMedication(med.id, {
            remove: (medicationId) => api.medications.remove(medicationId),
            cancelReminders: cancelNotificationsByPrefix,
            fallbackMessage: tx('სცადე ხელახლა.', 'Please try again.'),
          });
          if (!result.ok) {
            Alert.alert(tx('წამალი ვერ წაიშალა', "Couldn't delete the medication"), result.message);
            return;
          }
          await load();
          router.replace('/(tabs)/medications');
        },
      },
    ]);
  };

  if (!med) {
    if (!loading) router.replace('/(tabs)/medications');
    return (
      <>
        <Stack.Screen options={{ title: ka.meds.scheduleScreenTitle }} />
        <View style={{ flex: 1, backgroundColor: c.bg100, paddingHorizontal: HUB.gutter, paddingTop: 8 }}>
          {loading ? <DetailCardSkeleton /> : <Text style={[hubText.body, { color: c.text200 }]}>{ka.meds.empty}</Text>}
        </View>
      </>
    );
  }

  const form = ka.meds.formLabels[cfg.form ?? 'pills'];
  const amount = cfg.amount ?? 1;
  const remaining = cfg.remainingCount;
  const knownAs = [cfg.genericName, cfg.strength].filter((v) => v && v !== med.medName).join(' · ') || null;
  const freqLabel =
    cfg.frequencyKind === 'weekly'
      ? ka.meds.frequencyWeekly
      : cfg.frequencyKind === 'as_needed'
        ? ka.meds.frequencyAsNeeded
        : cfg.frequencyKind === 'one_time'
          ? ka.meds.frequencyOneTime
          : ka.meds.frequencyDaily;
  const meal = cfg.mealTiming && cfg.mealTiming !== 'any' ? ka.meds.mealTiming[cfg.mealTiming] : null;
  const daysLabel = cfg.daysOfWeek?.length && cfg.daysOfWeek.length < 7 ? daysSummaryKa(cfg.daysOfWeek) : ka.meds.frequencyDaily;
  const course = cfg.startDate || cfg.endDate ? `${shortDate(cfg.startDate)} – ${shortDate(cfg.endDate)}` : null;
  const accent = medsInk(dark);
  const primary = medsPrimaryFill(c, dark);

  return (
    <>
      <Stack.Screen
        options={{
          // Opened from a dose → „მიღება · 09:00“; from her list of medications → „მედიკამენტი“.
          title: time ? `${ka.meds.scheduleScreenTitle} · ${formatTime24h(doseTime)}` : ka.meds.detailTitle,
          headerRight: () => <MedicationHeaderAction icon={Trash2} onPress={remove} accessibilityLabel={ka.meds.deleteFromSchedule} />,
        }}
      />

      <ScrollView
        style={{ flex: 1, backgroundColor: c.bg100 }}
        contentContainerStyle={{ paddingHorizontal: HUB.gutter, paddingTop: 4, paddingBottom: insets.bottom + 32, gap: HUB.sectionGap - 6 }}
        showsVerticalScrollIndicator={false}
      >
        <MedsCard style={{ alignItems: 'center', gap: 14, paddingVertical: 26 }}>
          <View style={[s.hero, { backgroundColor: hubTint(accent, dark) }]}>
            <MedicationPillIcon color={cfg.pillColor} shape={cfg.pillShape ?? 'long'} size={72} imageUrl={images[id] ?? cfg.imageUrl} />
          </View>
          <View style={{ alignItems: 'center', gap: 4 }}>
            <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 22, lineHeight: 29, color: c.text100, textAlign: 'center' }}>
              {med.medName}
            </Text>
            {knownAs ? (
              <Text style={[hubText.body, { fontSize: 14, color: c.text200, textAlign: 'center' }]}>{knownAs}</Text>
            ) : null}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
            <MedsChip label={formatTime24h(doseTime)} active />
            <MedsChip label={freqLabel} />
            {meal ? <MedsChip label={meal} ink="amber" /> : null}
          </View>
          {log ? <MedsStatusPill status={log.status} /> : null}
        </MedsCard>

        <View>
          <HomeSectionHeading title={ka.meds.doseActionsTitle} />
          <MedsCard style={{ flexDirection: 'row', gap: 10, paddingVertical: 20 }}>
            <DoseAction label={ka.meds.actionTake} fill={primary} color="#FFFFFF" icon={Check} onPress={() => void markDose('taken')} />
            <DoseAction label={ka.meds.actionReschedule} fill={hubTint(accent, dark)} color={accent} icon={Clock} onPress={() => setRescheduleOpen(true)} />
            <DoseAction label={ka.meds.actionSkip} fill={hubTint(doseAttentionInk(dark), dark)} color={doseAttentionInk(dark)} icon={X} onPress={() => void markDose('skipped')} />
          </MedsCard>
        </View>

        <View>
          <HomeSectionHeading title={ka.meds.detailsTitle} />
          <MedsCard padded={false}>
            <MedsInfoRow icon={Pill} label={tx('ერთ მიღებაზე', 'Per dose')} value={ka.meds.doseAmountLine(amount, form)} />
            {remaining != null ? <MedsInfoRow icon={Boxes} ink="sky" label={ka.meds.remainingLabel} value={ka.meds.pillsLeft(remaining)} /> : null}
            <MedsInfoRow icon={CalendarDays} ink="blue" label={ka.meds.daysOfWeekLabel} value={daysLabel} />
            {course ? <MedsInfoRow icon={CalendarRange} ink="violet" label={ka.meds.courseLabel} value={course} /> : null}
            {meal ? <MedsInfoRow icon={Utensils} ink="amber" label={ka.meds.mealTimingLabel} value={meal} /> : null}
            <MedsInfoRow icon={Bell} ink="rose" label={ka.meds.refillLabel} value={cfg.refillReminder ? ka.common.yes : ka.common.no} isLast />
          </MedsCard>
        </View>

        <MedsCard padded={false}>
          {cfg.catalogProductId ? (
            <ProfileMenuRow icon={Tag} ink="green" label={ka.meds.comparePrices} onPress={() => router.push(`/pharmacy/product/${cfg.catalogProductId}` as never)} />
          ) : null}
          <ProfileMenuRow icon={FlaskConical} ink="violet" label={ka.meds.interactionCardCta} onPress={() => router.push('/medications/interaction' as never)} />
          <ProfileMenuRow icon={Trash2} label={ka.meds.deleteFromSchedule} onPress={remove} danger isLast />
        </MedsCard>
      </ScrollView>

      <MedicationRescheduleSheet
        visible={rescheduleOpen}
        currentTime={doseTime}
        onClose={() => setRescheduleOpen(false)}
        onPick={(option) => void markDose('taken', option)}
      />
    </>
  );
}

function DoseAction({
  label,
  fill,
  color,
  icon: Icon,
  onPress,
}: {
  label: string;
  fill: string;
  color: string;
  icon: typeof Check;
  onPress: () => void;
}) {
  const c = useThemeColors();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={{ flex: 1, alignItems: 'center', gap: 8 }}>
      <View style={[s.actionCircle, { backgroundColor: fill }]}>
        <Icon size={24} color={color} strokeWidth={2.4} />
      </View>
      <Text numberOfLines={1} style={[hubText.caption, { color: c.text200 }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  hero: {
    width: 96,
    height: 96,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
