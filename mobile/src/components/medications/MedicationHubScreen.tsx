import React, { useEffect, useMemo, useState } from 'react';
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
import { MedicationCircularProgress } from '@/components/medications/MedicationCircularProgress';
import { MedicationPillIcon } from '@/components/medications/MedicationPillIcon';
import { MedCard, MedChip, MedDivider, MedInsetCard, MedSectionHeader } from '@/components/medications/MedicationUI';
import { UpcomingDoseCard } from '@/components/medications/UpcomingDoseCard';
import { useTabBarInset } from '@/components/navigation/FloatingTabBar';
import { useFigmaMeds, MED_POPULAR_CHIPS } from '@/constants/figmaMedicationsLayout';
import { useMedications } from '@/hooks/useMedications';
import { ka } from '@/i18n/ka';
import { api, type CatalogProductSummary, type Medication } from '@/lib/api';
import { catalogProductMeta, catalogProductSetupParams } from '@/lib/medicationCatalogNav';
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
import { MedsHubSkeleton } from '@/components/ui/Skeleton';

const ONBOARDING_KEY = 'medicard.meds.onboardingDone';

type Props = { showOnboarding?: boolean };

export function MedicationHubScreen({ showOnboarding }: Props) {
  const FIGMA_MEDS = useFigmaMeds();
  const router = useRouter();
  const tabInset = useTabBarInset();
  const { medications, schedule, doseLogs, setDoseLogs, refreshing, loading, onRefresh, load } = useMedications();
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [catalogProducts, setCatalogProducts] = useState<CatalogProductSummary[]>([]);
  const today = todayYmd();
  const stats = adherenceStats(doseLogs);
  const activeMeds = medications.filter((m) => m.active);

  useEffect(() => {
    getPreference(ONBOARDING_KEY).then((v) => setOnboardingDone(v === '1'));
  }, []);

  useEffect(() => {
    void api.pharmacy
      .products({ sort: 'name', limit: 8 })
      .then((res) => setCatalogProducts(res.products))
      .catch(() => undefined);
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

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: FIGMA_MEDS.pageBg, paddingTop: 8 }}>
        <MedsHubSkeleton />
      </View>
    );
  }

  if (!loading && onboardingDone === null && medications.length === 0) {
    return <View style={{ flex: 1, backgroundColor: FIGMA_MEDS.pageBg }} />;
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
      style={{ flex: 1, backgroundColor: FIGMA_MEDS.pageBg }}
      contentContainerStyle={{ paddingBottom: tabInset }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={FIGMA_MEDS.brand} />}
      showsVerticalScrollIndicator={false}
    >
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
                    <MedicationCircularProgress progress={progress} pillColor={cfg.pillColor} shape={cfg.pillShape} imageUrl={cfg.imageUrl} />
                  </View>
                );
              })}
            </ScrollView>
          </MedCard>
        </View>

      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}>
        <View
          style={{
            backgroundColor: FIGMA_MEDS.cardBg,
            borderRadius: FIGMA_MEDS.cardRadiusSm,
            borderWidth: 1,
            borderColor: FIGMA_MEDS.border,
            padding: 8,
            gap: 8,
            ...FIGMA_MEDS.shadowCard,
          }}
        >
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <QuickActionTile
              primary
              icon={Plus}
              label={ka.meds.quickAdd}
              onPress={() => router.push('/medications/add')}
            />
            <QuickActionTile
              icon={Search}
              label={ka.meds.quickSearch}
              onPress={() => router.push('/medications/add/search')}
            />
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <QuickActionTile
              icon={FlaskConical}
              label={ka.meds.quickInteraction}
              onPress={() => router.push('/medications/interaction')}
            />
            <QuickActionTile
              icon={Bell}
              label={ka.meds.quickReminders}
              onPress={() => router.push('/medications/reminders')}
            />
          </View>
        </View>
      </View>

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
            <MedicationPillIcon shape="long" size={72} imageUrl={catalogProducts[0]?.imageUrl} />
          </View>
          <View style={{ padding: 16, gap: 12 }}>
            <MedInputSearch value={searchQuery} onChangeText={setSearchQuery} onSubmit={() => router.push({ pathname: '/medications/add/search', params: { q: searchQuery } })} />
            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
              <Text style={{ fontSize: 14, fontWeight: '500', color: FIGMA_MEDS.textSecondary }}>{ka.meds.mostCommon}</Text>
              {MED_POPULAR_CHIPS.map((chip) => (
                <MedChip key={chip} label={chip} onPress={() => router.push({ pathname: '/medications/add/search', params: { q: chip } })} />
              ))}
            </View>
          </View>
        </MedInsetCard>
      </View>

      {catalogProducts.length > 0 ? (
        <>
          <MedSectionHeader title={ka.meds.popularSearchesTitle} actionLabel={ka.meds.seeAll} onAction={() => router.push('/medications/add/search')} />
          <View style={{ paddingHorizontal: 16 }}>
            <MedInsetCard style={{ padding: 0, overflow: 'hidden' }}>
              {catalogProducts.slice(0, 3).map((product, index) => (
                <PopularSearchRow
                  key={product.id}
                  rank={index + 1}
                  imageUrl={product.imageUrl}
                  alias={product.category?.nameKa ?? catalogProductMeta(product)}
                  title={product.name}
                  subtitle={catalogProductMeta(product)}
                  onPress={() => router.push({ pathname: '/medications/add/setup', params: catalogProductSetupParams(product) })}
                  showDivider={index < Math.min(catalogProducts.length, 3) - 1}
                />
              ))}
            </MedInsetCard>
          </View>
        </>
      ) : null}

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
  const FIGMA_MEDS = useFigmaMeds();
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

function QuickActionTile({
  icon: Icon,
  label,
  onPress,
  primary,
}: {
  icon: typeof Plus;
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  const FIGMA_MEDS = useFigmaMeds();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{
        flex: 1,
        minHeight: 64,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 16,
        backgroundColor: primary ? FIGMA_MEDS.brandQuaternary : FIGMA_MEDS.white,
        borderWidth: 1,
        borderColor: primary ? FIGMA_MEDS.brandTertiary : FIGMA_MEDS.border,
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: primary ? FIGMA_MEDS.brand : FIGMA_MEDS.brandQuaternary,
        }}
      >
        <Icon size={18} color={primary ? '#fff' : FIGMA_MEDS.brand} strokeWidth={2.3} />
      </View>
      <Text
        numberOfLines={2}
        style={{
          flex: 1,
          fontSize: 13,
          fontWeight: '700',
          lineHeight: 18,
          color: FIGMA_MEDS.textPrimary,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function PopularSearchRow({
  rank,
  imageUrl,
  alias,
  title,
  subtitle,
  onPress,
  showDivider,
}: {
  rank: number;
  imageUrl?: string | null;
  alias: string;
  title: string;
  subtitle: string;
  onPress: () => void;
  showDivider: boolean;
}) {
  const FIGMA_MEDS = useFigmaMeds();
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
          <MedicationPillIcon size={48} border imageUrl={imageUrl} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          {alias ? <Text style={{ fontSize: 12, fontWeight: '500', color: FIGMA_MEDS.textSecondary }}>{alias}</Text> : null}
          <Text style={{ fontSize: 14, fontWeight: '600', color: FIGMA_MEDS.textPrimary }}>{title}</Text>
          {subtitle && subtitle !== alias ? (
            <Text style={{ fontSize: 14, color: FIGMA_MEDS.textSecondary }} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        <ChevronRight size={24} color={FIGMA_MEDS.textMuted} strokeWidth={2} />
      </View>
      {showDivider ? <MedDivider /> : null}
    </Pressable>
  );
}

function MedInputSearch({ value, onChangeText, onSubmit }: { value: string; onChangeText: (v: string) => void; onSubmit: () => void }) {
  const FIGMA_MEDS = useFigmaMeds();
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
  const FIGMA_MEDS = useFigmaMeds();
  const cfg = parseMedicationConfig(med.config);
  const times = parseFrequencyTimes(med.frequency);
  const [on, setOn] = useState(med.active);
  return (
    <View>
      {showDivider ? <MedDivider /> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 }}>
        <MedicationPillIcon shape={cfg.pillShape ?? 'long'} size={48} border imageUrl={cfg.imageUrl} />
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
  const FIGMA_MEDS = useFigmaMeds();
  return (
    <View style={{ flex: 1, backgroundColor: FIGMA_MEDS.pageBg, paddingHorizontal: 16, justifyContent: 'center' }}>
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
