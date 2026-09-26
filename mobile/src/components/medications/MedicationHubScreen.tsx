import { medicationCourseIncludesDate } from '@/lib/notificationPlan';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import {
  Bell,
  ChevronRight,
  Crown,
  FlaskConical,
  Pill,
  Plus,
  Search,
} from 'lucide-react-native';
import { HomeSectionHeading } from '@/components/home/HomeSectionHeading';
import { HubFeatureCard } from '@/components/home/HubFeatureCard';
import { HubTileGrid, type HubTile } from '@/components/home/HubTiles';
import { MedicationPillIcon } from '@/components/medications/MedicationPillIcon';
import { UpcomingDoseCard } from '@/components/medications/UpcomingDoseCard';
import { useTabBarInset } from '@/components/navigation/FloatingTabBar';
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
import { useIsDark, useThemeColors } from '@/theme/colors';
import { HUB, hubInk, hubText, hubTint } from '@/theme/hub';
import { MedsHubSkeleton } from '@/components/ui/Skeleton';

const ONBOARDING_KEY = 'medicard.meds.onboardingDone';

type Props = { showOnboarding?: boolean };

export function MedicationHubScreen({ showOnboarding }: Props) {
  const c = useThemeColors();
  const router = useRouter();
  const tabInset = useTabBarInset();
  const { medications, schedule, doseLogs, setDoseLogs, refreshing, loading, onRefresh, load } = useMedications();
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [catalogProducts, setCatalogProducts] = useState<CatalogProductSummary[]>([]);
  const [catalogTotal, setCatalogTotal] = useState(0);
  const today = todayYmd();
  const stats = adherenceStats(doseLogs);
  const activeMeds = medications.filter((m) => m.active);

  useEffect(() => {
    getPreference(ONBOARDING_KEY).then((v) => setOnboardingDone(v === '1'));
  }, []);

  useEffect(() => {
    void api.pharmacy
      .products({ sort: 'name', limit: 6 })
      .then((res) => {
        setCatalogProducts(res.products);
        setCatalogTotal(res.pagination?.total ?? 0);
      })
      .catch(() => undefined);
  }, []);

  const todayDoses = useMemo(
    () =>
      schedule
        .filter((d) => {
          const med = medications.find((m) => m.id === d.medicationId);
          if (!med?.active) return false;
          const cfg = parseMedicationConfig(med.config);
          if (!medicationCourseIncludesDate(cfg, today)) return false;
          if (!cfg.daysOfWeek?.length) return true;
          const dow = (new Date().getDay() + 6) % 7;
          return cfg.daysOfWeek.includes(dow);
        })
        .sort((a, b) => a.time.localeCompare(b.time)),
    [schedule, medications, today],
  );

  const markDose = async (medicationId: string, time: string, status: 'taken' | 'skipped') => {
    const entry = { medicationId, date: today, time, status, updatedAt: new Date().toISOString() };
    await saveDoseLog(entry);
    setDoseLogs((prev) => [...prev.filter((l) => !(l.medicationId === medicationId && l.date === today && l.time === time)), entry]);
  };

  const openAdd = () => router.push('/medications/add');

  const headerRight = () => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={ka.meds.quickAdd}
      hitSlop={10}
      onPress={openAdd}
      style={{ paddingHorizontal: 4, paddingVertical: 4 }}
    >
      <Plus size={22} color={c.primary200} strokeWidth={2.3} />
    </Pressable>
  );

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg100, paddingTop: 8 }}>
        <Stack.Screen options={{ headerRight }} />
        <MedsHubSkeleton />
      </View>
    );
  }

  if (!loading && onboardingDone === null && medications.length === 0) {
    return <View style={{ flex: 1, backgroundColor: c.bg100 }} />;
  }

  if (!loading && medications.length === 0 && onboardingDone === false && showOnboarding !== false) {
    return (
      <MedicationOnboarding
        onContinue={async () => {
          await setPreference(ONBOARDING_KEY, '1');
          setOnboardingDone(true);
          openAdd();
        }}
      />
    );
  }

  const QUICK_TILES: HubTile[] = [
    { key: 'add', title: ka.meds.quickAdd, detail: ka.meds.browseMedicationTitle, href: '/medications/add', icon: Plus, ink: 'teal' },
    { key: 'search', title: ka.meds.quickSearch, detail: ka.pharmacy.compareHint, href: '/medications/add/search', icon: Search, ink: 'sky' },
    { key: 'interaction', title: ka.meds.quickInteraction, detail: ka.meds.interactionCardCta, href: '/medications/interaction', icon: FlaskConical, ink: 'violet' },
    { key: 'reminders', title: ka.meds.quickReminders, detail: ka.meds.drugReminderTitle, href: '/medications/reminders', icon: Bell, ink: 'amber' },
  ];

  const heading = (title: string, href?: string) => (
    <HomeSectionHeading title={title} linkLabel={href ? ka.meds.seeAll : undefined} onLink={href ? () => router.push(href as never) : undefined} />
  );

  return (
    <>
      <Stack.Screen options={{ headerRight }} />
      <ScrollView
        style={{ flex: 1, backgroundColor: c.bg100 }}
        contentContainerStyle={{ paddingBottom: tabInset + 20, width: '100%', maxWidth: 760, alignSelf: 'center' }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary100} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={[s.section, { marginTop: 16 }]}>
          {heading(ka.meds.todaySchedule, '/medications/reminders/calendar')}
          <View style={[s.card, { backgroundColor: c.surface }]}>
            <View style={{ flexDirection: 'row', gap: 16 }}>
              <MetricCell value={`${stats.onTime}`} suffix="x" label={ka.meds.metricOnTime} />
              <MetricCell value={`${stats.late}`} suffix="%" label={ka.meds.metricLate} />
              <MetricCell value={`${stats.skipped}`} suffix="%" label={ka.meds.metricMissed} />
            </View>
          </View>

          {todayDoses.length === 0 ? (
            <View style={[s.card, { backgroundColor: c.surface, marginTop: 12 }]}>
              <Text style={[hubText.body, { color: c.text200 }]}>{ka.meds.noDosesToday}</Text>
            </View>
          ) : (
            <View style={[s.card, { backgroundColor: c.surface, marginTop: 12, gap: 16 }]}>
              {todayDoses.slice(0, 3).map((dose, index) => {
                const med = medications.find((m) => m.id === dose.medicationId);
                const cfg = parseMedicationConfig(med?.config);
                const log = findDoseLog(doseLogs, dose.medicationId, today, dose.time);
                return (
                  <View key={`${dose.medicationId}-${dose.time}`}>
                    {index > 0 ? <View style={[s.hairline, { backgroundColor: c.bg300, marginBottom: 16 }]} /> : null}
                    <UpcomingDoseCard
                      dose={dose}
                      cfg={cfg}
                      logStatus={log?.status}
                      onTaken={() => markDose(dose.medicationId, dose.time, 'taken')}
                      onSkipped={() => markDose(dose.medicationId, dose.time, 'skipped')}
                      onOpen={() => router.push(`/medications/${dose.medicationId}?time=${dose.time}&date=${today}` as never)}
                    />
                  </View>
                );
              })}
            </View>
          )}
        </View>

        <View style={s.section}>
          {heading(ka.meds.browseTitle)}
          <HubTileGrid tiles={QUICK_TILES} />
        </View>

        <View style={s.section}>
          {heading(ka.meds.browseMedicationTitle, '/medications/add/search')}
          <View style={[s.card, { backgroundColor: c.surface, gap: 14 }]}>
            <MedSearchInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmit={() => router.push({ pathname: '/medications/add/search', params: { q: searchQuery } })}
            />
            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <Text style={[hubText.caption, { color: c.text200 }]}>{ka.meds.mostCommon}</Text>
              {MED_POPULAR_CHIPS.map((chip) => (
                <PopularChip
                  key={chip.query}
                  label={chip.labelKa}
                  onPress={() => router.push({ pathname: '/medications/add/search', params: { q: chip.query } })}
                />
              ))}
            </View>
            {catalogTotal > 0 ? (
              <Text style={[hubText.small, { color: c.text300 }]}>{ka.pharmacy.catalogSize(catalogTotal)}</Text>
            ) : null}
          </View>
        </View>

        {catalogProducts.length > 0 ? (
          <View style={s.section}>
            {heading(ka.meds.popularSearchesTitle, '/medications/add/search')}
            <View style={[s.card, { backgroundColor: c.surface, padding: 0, overflow: 'hidden' }]}>
              {catalogProducts.slice(0, 4).map((product, index) => (
                <PopularSearchRow
                  key={product.id}
                  imageUrl={product.imageUrl}
                  category={product.category?.nameKa ?? null}
                  title={product.name}
                  subtitle={catalogProductMeta(product)}
                  bestPriceGel={product.bestPriceGel}
                  onPress={() => router.push({ pathname: '/medications/add/setup', params: catalogProductSetupParams(product) })}
                  showDivider={index < Math.min(catalogProducts.length, 4) - 1}
                />
              ))}
            </View>
          </View>
        ) : null}

        <View style={s.section}>
          <HubFeatureCard
            icon={FlaskConical}
            ink="violet"
            title={ka.meds.interactionScreenTitle}
            body={ka.meds.interactionCardBody}
            cta={ka.meds.interactionCardCta}
            onPress={() => router.push('/medications/interaction')}
          />
        </View>

        <View style={s.section}>
          {heading(ka.meds.drugReminderTitle, '/medications/reminders')}
          <View style={[s.card, { backgroundColor: c.surface, gap: 4 }]}>
            <Text style={[hubText.small, { color: c.text200 }]}>{ka.meds.activeReminders}</Text>
            <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 30, lineHeight: 36, color: c.text100 }}>
              {activeMeds.length}
            </Text>
          </View>
          {activeMeds.length > 0 ? (
            <View style={[s.card, { backgroundColor: c.surface, marginTop: 12, gap: 14 }]}>
              {activeMeds.slice(0, 3).map((med, index) => (
                <ReminderRow key={med.id} med={med} showDivider={index > 0} onToggle={() => apiToggle(med, load)} />
              ))}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </>
  );
}

async function apiToggle(med: Medication, reload: () => void) {
  const { api } = await import('@/lib/api');
  await api.medications.update(med.id, { active: !med.active }).catch(() => undefined);
  reload();
}

const MED_POPULAR_CHIPS = [
  { query: 'ibuprofen', labelKa: 'იბუპროფენი' },
  { query: 'amoxicillin', labelKa: 'ამოქსიცილინი' },
  { query: 'atorvastatin', labelKa: 'ატორვასტატინი' },
] as const;

function MetricCell({ value, suffix, label }: { value: string; suffix: string; label: string }) {
  const c = useThemeColors();
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>
        <Text style={[hubText.value, { fontSize: 22, color: c.text100 }]}>{value}</Text>
        <Text style={[hubText.caption, { color: c.text200, paddingBottom: 2 }]}>{suffix}</Text>
      </View>
      <Text style={[hubText.caption, { color: c.text200, marginTop: 4 }]}>{label}</Text>
    </View>
  );
}

function MedSearchInput({ value, onChangeText, onSubmit }: { value: string; onChangeText: (v: string) => void; onSubmit: () => void }) {
  const c = useThemeColors();
  return (
    <Pressable onPress={onSubmit} style={[s.searchShell, { backgroundColor: c.bg100 }]}>
      <Search size={18} color={c.text300} strokeWidth={2} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        placeholder={ka.meds.searchPlaceholder}
        placeholderTextColor={c.text300}
        style={[hubText.body, { flex: 1, fontSize: 15, color: c.text100, paddingVertical: 12 }]}
      />
    </Pressable>
  );
}

function PopularChip({ label, onPress }: { label: string; onPress: () => void }) {
  const c = useThemeColors();
  return (
    <Pressable onPress={onPress} style={[s.chip, { backgroundColor: c.bg100 }]}>
      <Text style={[hubText.caption, { color: c.text100, fontWeight: '600' }]}>{label}</Text>
    </Pressable>
  );
}

function PopularSearchRow({
  imageUrl,
  category,
  title,
  subtitle,
  bestPriceGel,
  onPress,
  showDivider,
}: {
  imageUrl?: string | null;
  category: string | null;
  title: string;
  subtitle: string;
  bestPriceGel: number | null;
  onPress: () => void;
  showDivider: boolean;
}) {
  const c = useThemeColors();
  const dark = useIsDark();
  const priceInk = hubInk('green', dark);
  return (
    <Pressable onPress={onPress}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: HUB.cardPad, paddingVertical: 12 }}>
        <MedicationPillIcon size={44} border imageUrl={imageUrl} />
        <View style={{ flex: 1, gap: 3, minWidth: 0 }}>
          {category ? (
            <Text numberOfLines={1} style={[hubText.small, { color: c.text300 }]}>
              {category}
            </Text>
          ) : null}
          <Text numberOfLines={1} style={[hubText.cardTitle, { color: c.text100 }]}>
            {title}
          </Text>
          {subtitle && subtitle !== category ? (
            <Text numberOfLines={1} style={[hubText.caption, { color: c.text200 }]}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {bestPriceGel != null ? (
          <View style={{ alignItems: 'flex-end', gap: 2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <Crown size={11} color={priceInk} strokeWidth={2.4} />
              <Text style={[hubText.value, { fontSize: 14, color: priceInk }]}>{bestPriceGel.toFixed(2)} ₾</Text>
            </View>
          </View>
        ) : (
          <ChevronRight size={18} color={c.text300} strokeWidth={2} />
        )}
      </View>
      {showDivider ? <View style={[s.hairline, { backgroundColor: c.bg300, marginLeft: HUB.cardPad }]} /> : null}
    </Pressable>
  );
}

function ReminderRow({ med, showDivider, onToggle }: { med: Medication; showDivider: boolean; onToggle: () => void }) {
  const c = useThemeColors();
  const cfg = parseMedicationConfig(med.config);
  const times = parseFrequencyTimes(med.frequency);
  const [on, setOn] = useState(med.active);
  return (
    <View>
      {showDivider ? <View style={[s.hairline, { backgroundColor: c.bg300, marginBottom: 14 }]} /> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <MedicationPillIcon shape={cfg.pillShape ?? 'long'} size={44} border imageUrl={cfg.imageUrl} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={[hubText.cardTitle, { color: c.text100 }]}>{med.medName}</Text>
          <Text style={[hubText.caption, { color: c.text200, marginTop: 2 }]}>
            {ka.meds.reminderSchedule(times[0] ? formatTime12h(times[0]) : '')}
          </Text>
        </View>
        <Switch
          value={on}
          onValueChange={() => {
            setOn(!on);
            onToggle();
          }}
          trackColor={{ true: c.primary200, false: c.bg300 }}
          thumbColor="#fff"
        />
      </View>
    </View>
  );
}

function MedicationOnboarding({ onContinue }: { onContinue: () => void }) {
  const c = useThemeColors();
  const dark = useIsDark();
  const ink = hubInk('teal', dark);
  return (
    <View style={{ flex: 1, backgroundColor: c.bg100, paddingHorizontal: 20, justifyContent: 'center' }}>
      <View style={{ alignItems: 'center', marginBottom: 40, gap: 24 }}>
        <View style={{ width: 88, height: 88, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: hubTint(ink, dark) }}>
          <Pill size={44} color={ink} strokeWidth={1.6} />
        </View>
        <View style={{ gap: 12, alignItems: 'center' }}>
          <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 26, lineHeight: 33, color: c.text100, textAlign: 'center' }}>
            {ka.meds.onboardingEmptyTitle}
          </Text>
          <Text style={[hubText.body, { fontSize: 16, lineHeight: 24, color: c.text200, textAlign: 'center' }]}>
            {ka.meds.onboardingEmptyBody}
          </Text>
        </View>
      </View>
      <Pressable
        onPress={onContinue}
        style={{ backgroundColor: c.primary200, borderRadius: HUB.tileRadius, minHeight: 52, alignItems: 'center', justifyContent: 'center' }}
      >
        <Text style={{ color: c.onPrimary, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 16 }}>{ka.meds.onboardingContinue}</Text>
      </Pressable>
    </View>
  );
}

export async function shouldShowMedicationOnboarding(): Promise<boolean> {
  const done = await getPreference(ONBOARDING_KEY);
  return done !== '1';
}

const s = StyleSheet.create({
  section: { paddingHorizontal: HUB.gutter, marginTop: HUB.sectionGap },
  card: { borderRadius: HUB.cardRadius, padding: HUB.cardPad },
  hairline: { height: StyleSheet.hairlineWidth },
  searchShell: {
    minHeight: 46,
    borderRadius: HUB.tileRadius,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 10,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
});
