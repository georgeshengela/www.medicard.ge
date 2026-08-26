import React, { useEffect, useMemo, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
  ArrowRight,
  Bell,
  ChevronRight,
  FlaskConical,
  MessageCircle,
  Pill,
  Plus,
  Search,
} from 'lucide-react-native';
import { HomeDashboardHeader } from '@/components/home/HomeDashboardHeader';
import { MedicationCircularProgress } from '@/components/medications/MedicationCircularProgress';
import { MedicationPillIcon } from '@/components/medications/MedicationPillIcon';
import { MedCard, MedChip, MedDivider, MedInsetCard, MedSectionHeader } from '@/components/medications/MedicationUI';
import { POPULAR_SEARCH_META } from '@/constants/medicationPillAssets';
import { useTabBarInset } from '@/components/navigation/FloatingTabBar';
import { FIGMA_MEDS, MED_POPULAR_CHIPS } from '@/constants/figmaMedicationsLayout';
import { FIGMA_HOME_DASHBOARD } from '@/constants/figmaHomeDashboardLayout';
import { MEDICATION_CATALOG } from '@/constants/medicationCatalog';
import { useMedications } from '@/hooks/useMedications';
import { ka } from '@/i18n/ka';
import type { Medication } from '@/lib/api';
import {
  adherenceStats,
  findDoseLog,
  formatTime12h,
  parseFrequencyTimes,
  parseMedicationConfig,
  saveDoseLog,
  todayYmd,
} from '@/lib/medications.shared';
import { getPreference, setPreference } from '@/lib/storage';
import { useAuth } from '@/store/AuthContext';
import type { PillShape } from '@/types/medications';

const ONBOARDING_KEY = 'medicard.meds.onboardingDone';

type Props = { showOnboarding?: boolean };

export function MedicationHubScreen({ showOnboarding }: Props) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const tabInset = useTabBarInset();
  const { user, healthProfile } = useAuth();
  const { medications, schedule, doseLogs, setDoseLogs, refreshing, loading, onRefresh, load } = useMedications();
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const today = todayYmd();
  const stats = adherenceStats(doseLogs);
  const activeMeds = medications.filter((m) => m.active);
  const firstName = user?.fullName?.split(' ')[0] ?? '';
  const initials =
    user?.fullName
      ?.split(' ')
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase() ?? 'M';
  const avatarId =
    typeof (healthProfile?.extraAnswers as Record<string, unknown> | undefined)?.avatarId === 'string'
      ? ((healthProfile?.extraAnswers as Record<string, unknown>).avatarId as string)
      : null;

  useEffect(() => {
    getPreference(ONBOARDING_KEY).then((v) => setOnboardingDone(v === '1'));
  }, []);

  const todayDoses = useMemo(
    () =>
      schedule
        .filter((d) => {
          const med = medications.find((m) => m.id === d.medicationId);
          if (!med?.active) return false;
          const cfg = parseMedicationConfig(med.config);
          if (!cfg.daysOfWeek?.length) return true;
          const dow = (new Date().getDay() + 6) % 7;
          return cfg.daysOfWeek.includes(dow);
        })
        .sort((a, b) => a.time.localeCompare(b.time)),
    [schedule, medications],
  );

  const takenToday = todayDoses.filter((d) => findDoseLog(doseLogs, d.medicationId, today, d.time)?.status === 'taken').length;

  const markDose = async (medicationId: string, time: string, status: 'taken' | 'skipped') => {
    const entry = { medicationId, date: today, time, status, updatedAt: new Date().toISOString() };
    await saveDoseLog(entry);
    setDoseLogs((prev) => [...prev.filter((l) => !(l.medicationId === medicationId && l.date === today && l.time === time)), entry]);
  };

  if (!loading && onboardingDone === null && medications.length === 0) {
    return <View style={{ flex: 1, backgroundColor: FIGMA_MEDS.white }} />;
  }

  if (!loading && medications.length === 0 && onboardingDone === false && showOnboarding !== false) {
    return (
      <MedicationOnboarding
        onContinue={async () => {
          await setPreference(ONBOARDING_KEY, '1');
          setOnboardingDone(true);
          router.push('/medications/add');
        }}
      />
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: FIGMA_MEDS.white }}
      contentContainerStyle={{ paddingBottom: tabInset + 16 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={FIGMA_MEDS.brand} />}
      showsVerticalScrollIndicator={false}
    >
      <LinearGradient
        colors={[FIGMA_HOME_DASHBOARD.brand, 'rgba(20,184,166,0)']}
        style={{ paddingTop: insets.top, paddingBottom: 8 }}
      >
        <HomeDashboardHeader
          firstName={firstName}
          initials={initials}
          gender={user?.gender}
          avatarId={avatarId}
          streak={1}
          onPackagePress={() => router.push('/package' as never)}
          onAvatarPress={() => router.push('/(tabs)/profile' as never)}
        />

        <View style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
          <MedCard style={{ padding: 16, gap: 16 }}>
            <View style={{ flexDirection: 'row', gap: 16 }}>
              <MetricCell value={`${stats.onTime}`} suffix="x" label={ka.meds.metricOnTime} />
              <MetricCell value={`${stats.late}`} suffix="%" label={ka.meds.metricLate} />
              <MetricCell value={`${stats.skipped}`} suffix="%" label={ka.meds.metricMissed} />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {todayDoses.slice(0, 4).map((dose, idx) => {
                const med = medications.find((m) => m.id === dose.medicationId);
                const cfg = parseMedicationConfig(med?.config);
                const log = findDoseLog(doseLogs, dose.medicationId, today, dose.time);
                const progress = log?.status === 'taken' ? 1 : log?.status === 'skipped' ? 0.2 : idx === 0 ? 0.4 : 0.15;
                return (
                  <View
                    key={`${dose.medicationId}-${dose.time}`}
                    style={{
                      width: 288,
                      minHeight: 92,
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor: FIGMA_MEDS.border,
                      padding: 12,
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: FIGMA_MEDS.cardBg,
                    }}
                  >
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={{ fontSize: 12, color: FIGMA_MEDS.textSecondary }}>{ka.meds.doseProgress(takenToday, todayDoses.length)}</Text>
                      <Text style={{ fontSize: 16, fontWeight: '800', color: FIGMA_MEDS.textPrimary }} numberOfLines={1}>{dose.medName}</Text>
                      <Text style={{ fontSize: 14, color: FIGMA_MEDS.textSecondary }} numberOfLines={1}>{dose.dosage}</Text>
                    </View>
                    <MedicationCircularProgress progress={progress} pillColor={cfg.pillColor} shape={cfg.pillShape} />
                  </View>
                );
              })}
            </ScrollView>
          </MedCard>
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 }}>
          <QuickIcon primary icon={Plus} label={ka.meds.quickAdd} onPress={() => router.push('/medications/add')} />
          <QuickIcon icon={Search} label={ka.meds.quickSearch} onPress={() => router.push('/medications/add/search')} />
          <QuickIcon icon={FlaskConical} label={ka.meds.quickInteraction} onPress={() => router.push('/medications/interaction')} />
          <QuickIcon icon={Bell} label={ka.meds.quickReminders} onPress={() => router.push('/medications/reminders')} />
        </View>
      </LinearGradient>

      <MedSectionHeader title={ka.meds.upcomingTitle} actionLabel={ka.meds.seeAll} onAction={() => router.push('/medications/reminders')} />
      <View style={{ paddingHorizontal: 16 }}>
        <MedInsetCard style={{ padding: 16 }}>
          {todayDoses.length === 0 ? (
            <Text style={{ color: FIGMA_MEDS.textSecondary }}>{ka.meds.noDosesToday}</Text>
          ) : (
            todayDoses.slice(0, 2).map((dose, index) => {
              const med = medications.find((m) => m.id === dose.medicationId);
              const cfg = parseMedicationConfig(med?.config);
              const log = findDoseLog(doseLogs, dose.medicationId, today, dose.time);
              return (
                <View key={`${dose.medicationId}-${dose.time}`}>
                  {index > 0 ? (
                    <View style={{ marginVertical: 20 }}>
                      <MedDivider />
                    </View>
                  ) : null}
                  <UpcomingDoseCard
                    dose={dose}
                    cfg={cfg}
                    logStatus={log?.status}
                    onTaken={() => markDose(dose.medicationId, dose.time, 'taken')}
                    onSkipped={() => markDose(dose.medicationId, dose.time, 'skipped')}
                    onOpen={() => router.push(`/medications/${dose.medicationId}?time=${dose.time}&date=${today}`)}
                  />
                </View>
              );
            })
          )}
        </MedInsetCard>
      </View>

      <MedSectionHeader title={ka.meds.browseMedicationTitle} actionLabel={ka.meds.seeAll} onAction={() => router.push('/medications/add/search')} />
      <View style={{ paddingHorizontal: 16 }}>
        <MedInsetCard style={{ overflow: 'hidden', padding: 0 }}>
          <View style={{ height: 131, backgroundColor: FIGMA_MEDS.brandQuaternary, alignItems: 'center', justifyContent: 'center' }}>
            <MedicationPillIcon shape="long" size={72} />
          </View>
          <View style={{ padding: 16, gap: 12 }}>
            <MedInputSearch value={searchQuery} onChangeText={setSearchQuery} onSubmit={() => router.push({ pathname: '/medications/add/search', params: { q: searchQuery } })} />
            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
              <Text style={{ fontSize: 14, fontWeight: '500', color: FIGMA_MEDS.textSecondary }}>{ka.meds.mostCommon}</Text>
              {MED_POPULAR_CHIPS.map((chip) => (
                <MedChip key={chip} label={chip} onPress={() => router.push({ pathname: '/medications/add/setup', params: { name: chip, generic: chip } })} />
              ))}
            </View>
          </View>
        </MedInsetCard>
      </View>

      <MedSectionHeader title={ka.meds.popularSearchesTitle} actionLabel={ka.meds.seeAll} onAction={() => router.push('/medications/add/search')} />
      <View style={{ paddingHorizontal: 16 }}>
        <MedInsetCard style={{ padding: 0, overflow: 'hidden' }}>
          {MEDICATION_CATALOG.slice(0, 3).map((entry, index) => {
            const meta = POPULAR_SEARCH_META[index];
            return (
              <PopularSearchRow
                key={entry.inn}
                rank={index + 1}
                shape={meta?.shape ?? 'long'}
                alias={meta?.alias ?? entry.inn}
                title={entry.ka}
                subtitle={meta?.category ?? entry.inn}
                onPress={() => router.push({ pathname: '/medications/add/setup', params: { name: entry.ka, generic: entry.inn } })}
                showDivider={index < 2}
              />
            );
          })}
        </MedInsetCard>
      </View>

      <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
        <MedInsetCard style={{ overflow: 'hidden', padding: 0 }}>
          <View style={{ height: 133, backgroundColor: FIGMA_MEDS.brandQuaternary, alignItems: 'center', justifyContent: 'center' }}>
            <FlaskConical size={64} color={FIGMA_MEDS.brand} strokeWidth={1.6} />
          </View>
          <View style={{ padding: 16, gap: 12 }}>
            <Text style={{ fontSize: 14, lineHeight: 22, color: FIGMA_MEDS.textSecondary }}>{ka.meds.interactionCardBody}</Text>
            <MedDivider />
            <Pressable onPress={() => router.push('/medications/interaction')} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontWeight: '700', fontSize: 14, color: FIGMA_MEDS.brand }}>{ka.meds.interactionCardCta}</Text>
              <ArrowRight size={16} color={FIGMA_MEDS.brand} style={{ marginLeft: 4 }} />
            </Pressable>
          </View>
        </MedInsetCard>
      </View>

      <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
        <LinearGradient colors={['#14B8A6', '#0D9488']} style={{ borderRadius: FIGMA_MEDS.cardRadiusSm, overflow: 'hidden', flexDirection: 'row' }}>
          <View style={{ flex: 1, padding: 16, gap: 12 }}>
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700', lineHeight: 22 }}>{ka.meds.supportBannerTitle}</Text>
            <Pressable style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontWeight: '800' }}>{ka.meds.supportBannerCta}</Text>
              <ArrowRight size={16} color="#fff" style={{ marginLeft: 4 }} />
            </Pressable>
          </View>
          <View style={{ width: 108, alignItems: 'center', justifyContent: 'center' }}>
            <MessageCircle size={56} color="rgba(255,255,255,0.35)" strokeWidth={1.5} />
          </View>
        </LinearGradient>
      </View>

      <MedSectionHeader title={ka.meds.drugReminderTitle} actionLabel={ka.meds.seeAll} onAction={() => router.push('/medications/reminders')} />
      <View style={{ paddingHorizontal: 16 }}>
        <MedInsetCard style={{ padding: 16, gap: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 32, fontWeight: '700', color: FIGMA_MEDS.textPrimary, lineHeight: 40 }}>{activeMeds.length}</Text>
              <Text style={{ fontSize: 14, lineHeight: 20, color: FIGMA_MEDS.textSecondary }}>{ka.meds.activeReminders}</Text>
            </View>
            <Pressable
              onPress={() => router.push('/medications/add')}
              style={{
                width: 48,
                height: 48,
                borderRadius: 999,
                backgroundColor: FIGMA_MEDS.textPrimary,
                alignItems: 'center',
                justifyContent: 'center',
                padding: 12,
                ...FIGMA_MEDS.shadowInput,
              }}
            >
              <Plus size={24} color="#fff" strokeWidth={2.5} />
            </Pressable>
          </View>
          {activeMeds.slice(0, 2).map((med, index) => (
            <ReminderRow key={med.id} med={med} showDivider={index > 0} onToggle={() => apiToggle(med, load)} />
          ))}
        </MedInsetCard>
      </View>
    </ScrollView>
  );
}

async function apiToggle(med: Medication, reload: () => void) {
  const { api } = await import('@/lib/api');
  await api.medications.update(med.id, { active: !med.active }).catch(() => undefined);
  reload();
}

function MetricCell({ value, suffix, label }: { value: string; suffix: string; label: string }) {
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>
        <Text style={{ fontSize: 24, fontWeight: '800', color: FIGMA_MEDS.textPrimary }}>{value}</Text>
        <Text style={{ fontSize: 16, fontWeight: '500', color: FIGMA_MEDS.textSecondary, paddingBottom: 2 }}>{suffix}</Text>
      </View>
      <Text style={{ fontSize: 14, color: FIGMA_MEDS.textSecondary, marginTop: 4 }}>{label}</Text>
    </View>
  );
}

function QuickIcon({ icon: Icon, label, onPress, primary }: { icon: typeof Plus; label: string; onPress: () => void; primary?: boolean }) {
  return (
    <Pressable onPress={onPress} style={{ alignItems: 'center', width: 74, gap: 6 }}>
      <View
        style={{
          width: FIGMA_MEDS.iconBtn,
          height: FIGMA_MEDS.iconBtn,
          borderRadius: 999,
          backgroundColor: primary ? FIGMA_MEDS.brand : FIGMA_MEDS.cardBg,
          borderWidth: primary ? 0 : 1,
          borderColor: FIGMA_MEDS.borderTertiary,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 12,
          ...FIGMA_MEDS.shadowInput,
        }}
      >
        <Icon size={22} color={primary ? '#fff' : FIGMA_MEDS.brand} strokeWidth={2.2} />
      </View>
      <Text style={{ fontSize: 12, fontWeight: '600', color: FIGMA_MEDS.textPrimary, textAlign: 'center' }}>{label}</Text>
    </Pressable>
  );
}

function UpcomingDoseCard({
  dose,
  cfg,
  logStatus,
  onTaken,
  onSkipped,
  onOpen,
}: {
  dose: { medName: string; dosage: string; time: string; notes: string | null };
  cfg: ReturnType<typeof parseMedicationConfig>;
  logStatus?: string;
  onTaken: () => void;
  onSkipped: () => void;
  onOpen: () => void;
}) {
  const meal = cfg.mealTiming && cfg.mealTiming !== 'any' ? ka.meds.mealTiming[cfg.mealTiming] : null;
  const subtitle = cfg.genericName ? `${cfg.genericName} - ${ka.meds.formLabels[cfg.form ?? 'pills']}` : dose.dosage;

  return (
    <View style={{ gap: 16 }}>
      <Pressable onPress={onOpen} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
        <MedicationPillIcon shape={cfg.pillShape ?? 'rectangle'} size={48} border />
        <View style={{ flex: 1, gap: 8 }}>
          <View style={{ gap: 4 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', lineHeight: 20, color: FIGMA_MEDS.textPrimary }} numberOfLines={1}>
              {dose.medName}
            </Text>
            <Text style={{ fontSize: 14, lineHeight: 20, color: FIGMA_MEDS.textSecondary }} numberOfLines={2}>
              {subtitle}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ fontSize: 14, fontWeight: '600', lineHeight: 20, color: FIGMA_MEDS.brand }}>
              {ka.meds.doseAt(formatTime12h(dose.time))}
            </Text>
            <ChevronRight size={20} color={FIGMA_MEDS.brand} strokeWidth={2.5} />
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontSize: 12, lineHeight: 16, color: FIGMA_MEDS.textSecondary }}>{dose.dosage}</Text>
            {meal ? (
              <>
                <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: FIGMA_MEDS.border }} />
                <Text style={{ fontSize: 12, lineHeight: 16, color: FIGMA_MEDS.textSecondary }}>{meal}</Text>
              </>
            ) : null}
          </View>
        </View>
      </Pressable>

      {logStatus ? (
        <Text style={{ fontWeight: '700', fontSize: 14, color: logStatus === 'taken' ? FIGMA_MEDS.success : FIGMA_MEDS.destructive }}>
          {logStatus === 'taken' ? ka.meds.statusTaken : ka.meds.statusSkipped}
        </Text>
      ) : (
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Pressable
            onPress={onSkipped}
            style={{
              flex: 1,
              paddingVertical: 6,
              paddingHorizontal: 10,
              borderRadius: 12,
              backgroundColor: FIGMA_MEDS.cardBg,
              borderWidth: 1,
              borderColor: FIGMA_MEDS.borderTertiary,
              alignItems: 'center',
              ...FIGMA_MEDS.shadowInput,
            }}
          >
            <Text style={{ fontWeight: '600', fontSize: 14, lineHeight: 20, color: FIGMA_MEDS.textPrimary }}>{ka.meds.actionSkip}</Text>
          </Pressable>
          <Pressable
            onPress={onTaken}
            style={{
              flex: 1,
              paddingVertical: 6,
              paddingHorizontal: 10,
              borderRadius: 12,
              backgroundColor: FIGMA_MEDS.brandQuaternary,
              borderWidth: 1,
              borderColor: FIGMA_MEDS.brandTertiary,
              alignItems: 'center',
              ...FIGMA_MEDS.shadowInput,
            }}
          >
            <Text style={{ fontWeight: '600', fontSize: 14, lineHeight: 20, color: FIGMA_MEDS.brand }}>{ka.meds.actionTake}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function PopularSearchRow({
  rank,
  shape,
  alias,
  title,
  subtitle,
  onPress,
  showDivider,
}: {
  rank: number;
  shape: PillShape;
  alias: string;
  title: string;
  subtitle: string;
  onPress: () => void;
  showDivider: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={{ position: 'relative' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View
            style={{
              width: 24,
              height: 24,
              borderRadius: 999,
              backgroundColor: FIGMA_MEDS.brandQuaternary,
              borderWidth: 1,
              borderColor: FIGMA_MEDS.brandTertiary,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: -14,
              zIndex: 2,
              ...FIGMA_MEDS.shadowInput,
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: '600', color: FIGMA_MEDS.brand }}>{rank}</Text>
          </View>
          <MedicationPillIcon shape={shape} size={48} border />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ fontSize: 12, fontWeight: '500', color: FIGMA_MEDS.textSecondary }}>{alias}</Text>
          <Text style={{ fontSize: 14, fontWeight: '600', color: FIGMA_MEDS.textPrimary }}>{title}</Text>
          <Text style={{ fontSize: 14, color: FIGMA_MEDS.textSecondary }}>{subtitle}</Text>
        </View>
        <ChevronRight size={24} color={FIGMA_MEDS.textMuted} strokeWidth={2} />
      </View>
      {showDivider ? <MedDivider /> : null}
    </Pressable>
  );
}

function MedInputSearch({ value, onChangeText, onSubmit }: { value: string; onChangeText: (v: string) => void; onSubmit: () => void }) {
  return (
    <View
      style={{
        minHeight: FIGMA_MEDS.inputHeight,
        borderRadius: FIGMA_MEDS.inputRadius,
        borderWidth: 1,
        borderColor: FIGMA_MEDS.borderTertiary,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        gap: 8,
        backgroundColor: FIGMA_MEDS.white,
        ...FIGMA_MEDS.shadowInput,
      }}
    >
      <Search size={18} color={FIGMA_MEDS.textMuted} strokeWidth={2} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        placeholder={ka.meds.searchPlaceholder}
        placeholderTextColor={FIGMA_MEDS.textMuted}
        style={{ flex: 1, fontSize: 16, color: FIGMA_MEDS.textPrimary, paddingVertical: 12 }}
      />
    </View>
  );
}

function ReminderRow({ med, showDivider, onToggle }: { med: Medication; showDivider: boolean; onToggle: () => void }) {
  const cfg = parseMedicationConfig(med.config);
  const times = parseFrequencyTimes(med.frequency);
  const [on, setOn] = useState(med.active);
  return (
    <View>
      {showDivider ? <MedDivider /> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 }}>
        <MedicationPillIcon shape={cfg.pillShape ?? 'long'} size={48} border />
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: '800', color: FIGMA_MEDS.textPrimary }}>{med.medName}</Text>
          <Text style={{ fontSize: 13, color: FIGMA_MEDS.textSecondary, marginTop: 2 }}>
            {ka.meds.reminderSchedule(times[0] ? formatTime12h(times[0]) : '')}
          </Text>
        </View>
        <Switch
          value={on}
          onValueChange={() => {
            setOn(!on);
            onToggle();
          }}
          trackColor={{ true: FIGMA_MEDS.brand, false: FIGMA_MEDS.border }}
          thumbColor="#fff"
        />
      </View>
    </View>
  );
}

function MedicationOnboarding({ onContinue }: { onContinue: () => void }) {
  return (
    <View style={{ flex: 1, backgroundColor: FIGMA_MEDS.white, paddingHorizontal: 16, justifyContent: 'center' }}>
      <View style={{ alignItems: 'center', marginBottom: 48 }}>
        <Pill size={120} color={FIGMA_MEDS.brand} strokeWidth={1.2} />
        <Text style={{ marginTop: 32, fontSize: 30, fontWeight: '800', color: FIGMA_MEDS.textPrimary, textAlign: 'center' }}>{ka.meds.onboardingEmptyTitle}</Text>
        <Text style={{ marginTop: 16, fontSize: 18, lineHeight: 28, color: FIGMA_MEDS.textSecondary, textAlign: 'center' }}>{ka.meds.onboardingEmptyBody}</Text>
      </View>
      <Pressable onPress={onContinue} style={{ backgroundColor: FIGMA_MEDS.brand, borderRadius: 14, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>{ka.meds.onboardingContinue}</Text>
      </Pressable>
    </View>
  );
}

export async function shouldShowMedicationOnboarding(): Promise<boolean> {
  const done = await getPreference(ONBOARDING_KEY);
  return done !== '1';
}
