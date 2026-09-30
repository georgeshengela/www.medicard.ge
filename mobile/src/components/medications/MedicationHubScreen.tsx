import React, { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { CalendarDays, ChevronRight, Crown, FlaskConical, Pill, Plus, Search } from 'lucide-react-native';
import { HomeSectionHeading } from '@/components/home/HomeSectionHeading';
import { HubFeatureCard } from '@/components/home/HubFeatureCard';
import { HubTileGrid, type HubTile } from '@/components/home/HubTiles';
import { MedicationPillIcon } from '@/components/medications/MedicationPillIcon';
import { MedsButton, MedsCard, MedsChip, MedsHairline, MedsIconTile, MedsRing } from '@/components/medications/MedsHubUI';
import { UpcomingDoseCard } from '@/components/medications/UpcomingDoseCard';
import { useTabBarInset } from '@/components/navigation/FloatingTabBar';
import { MedsHubSkeleton } from '@/components/ui/Skeleton';
import { useMedicationImages } from '@/hooks/useMedicationImages';
import { useMedications } from '@/hooks/useMedications';
import { EMPTY_ART } from '@/constants/appArt';
import { ka } from '@/i18n/ka';
import { api, type CatalogProductSummary, type Medication } from '@/lib/api';
import { computeTodayDoses } from '@/lib/home/todayDoses';
import { catalogProductMeta } from '@/lib/medicationCatalogNav';
import {
  adherenceStats,
  findDoseLog,
  formatTime24h,
  parseFrequencyTimes,
  parseMedicationConfig,
  saveDoseLog,
  todayYmd,
} from '@/lib/medications.shared';
import { getPreference, setPreference } from '@/lib/storage';
import { useIsDark, useThemeColors } from '@/theme/colors';
import { HUB, hubInk, hubText } from '@/theme/hub';
import { tx } from '@/i18n/locale';

const ONBOARDING_KEY = 'medicard.meds.onboardingDone';
const TODAY_PREVIEW = 4;

type Props = { showOnboarding?: boolean };

export function MedicationHubScreen({ showOnboarding }: Props) {
  const c = useThemeColors();
  const router = useRouter();
  const tabInset = useTabBarInset();
  const { medications, schedule, doseLogs, setDoseLogs, refreshing, loading, onRefresh, load } = useMedications();
  const images = useMedicationImages(medications);
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

  const todayView = useMemo(() => computeTodayDoses(medications, schedule, doseLogs, today), [medications, schedule, doseLogs, today]);
  const todayDoses = useMemo(
    () =>
      schedule
        .filter((d) => {
          const med = medications.find((m) => m.id === d.medicationId);
          if (!med?.active) return false;
          const cfg = parseMedicationConfig(med.config);
          if (cfg.startDate && today < cfg.startDate) return false;
          if (cfg.endDate && today > cfg.endDate) return false;
          if (!cfg.daysOfWeek?.length) return true;
          return cfg.daysOfWeek.includes((new Date().getDay() + 6) % 7);
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
    <Pressable accessibilityRole="button" accessibilityLabel={ka.meds.quickAdd} hitSlop={10} onPress={openAdd} style={{ paddingHorizontal: 4, paddingVertical: 4 }}>
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
    { key: 'add', title: ka.meds.quickAdd, detail: ka.meds.quickAddHint, href: '/medications/add', icon: Plus, ink: 'teal' },
    { key: 'search', title: ka.meds.quickSearch, detail: ka.meds.quickSearchHint, href: '/medications/add/search', icon: Search, ink: 'sky' },
    { key: 'calendar', title: ka.meds.quickCalendar, detail: ka.meds.quickCalendarHint, href: '/medications/reminders/calendar', icon: CalendarDays, ink: 'amber' },
    { key: 'interaction', title: ka.meds.quickInteraction, detail: ka.meds.quickInteractionHint, href: '/medications/interaction', icon: FlaskConical, ink: 'violet' },
  ];

  const heading = (title: string, href?: string, label?: string) => (
    <HomeSectionHeading title={title} linkLabel={href ? (label ?? ka.meds.seeAll) : undefined} onLink={href ? () => router.push(href as never) : undefined} />
  );

  const nextPending = todayView.pending[0];
  const spotlightTitle = todayView.total === 0 ? ka.meds.todayNothingPlanned : ka.meds.todayProgress(todayView.taken, todayView.total);
  const spotlightBody =
    todayView.total === 0
      ? ka.meds.subtitle
      : nextPending
        ? ka.meds.nextDoseLine(formatTime24h(nextPending.time), nextPending.medName)
        : ka.meds.todayAllTaken;

  return (
    <>
      <Stack.Screen options={{ headerRight }} />
      <ScrollView
        style={{ flex: 1, backgroundColor: c.bg100 }}
        contentContainerStyle={{ paddingBottom: tabInset + 20, width: '100%', maxWidth: 760, alignSelf: 'center' }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary100} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={[s.section, { marginTop: 12 }]}>
          {heading(ka.meds.todaySchedule, '/medications/reminders', ka.meds.remindersScreenTitle)}
          <HubFeatureCard
            tone="spotlight"
            lead={<TodayRing taken={todayView.taken} total={todayView.total} />}
            title={spotlightTitle}
            body={spotlightBody}
            cta={ka.meds.viewSchedule}
            onPress={() => router.push('/medications/reminders')}
          />

          <MedsCard style={{ marginTop: 12 }}>
            <View style={{ flexDirection: 'row', gap: 16 }}>
              <MetricCell value={`${stats.onTime}`} suffix="%" label={ka.meds.metricOnTime} />
              <MetricCell value={`${stats.skipped}`} suffix="%" label={ka.meds.metricMissed} />
              <MetricCell value={`${activeMeds.length}`} suffix="" label={ka.meds.metricActive} />
            </View>
          </MedsCard>

          {todayDoses.length > 0 ? (
            <MedsCard style={{ marginTop: 12, gap: 16 }}>
              {todayDoses.slice(0, TODAY_PREVIEW).map((dose, index) => {
                const med = medications.find((m) => m.id === dose.medicationId);
                const baseCfg = parseMedicationConfig(med?.config);
                const cfg = { ...baseCfg, imageUrl: images[dose.medicationId] ?? baseCfg.imageUrl };
                const log = findDoseLog(doseLogs, dose.medicationId, today, dose.time);
                return (
                  <View key={`${dose.medicationId}-${dose.time}`}>
                    {index > 0 ? <MedsHairline style={{ marginBottom: 16 }} /> : null}
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
              {todayDoses.length > TODAY_PREVIEW ? (
                <MedsButton tone="quiet" compact label={`${ka.meds.seeAll} (${todayDoses.length})`} onPress={() => router.push('/medications/reminders')} />
              ) : null}
            </MedsCard>
          ) : null}
        </View>

        <View style={s.section}>
          {heading(ka.meds.browseTitle)}
          <HubTileGrid tiles={QUICK_TILES} />
        </View>

        <View style={s.section}>
          {heading(ka.meds.browseMedicationTitle, '/medications/add/search')}
          <MedsCard style={{ gap: 14 }}>
            <MedSearchInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmit={() => router.push({ pathname: '/medications/add/search', params: { q: searchQuery } })}
            />
            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <Text style={[hubText.caption, { color: c.text200 }]}>{ka.meds.mostCommon}</Text>
              {MED_POPULAR_CHIPS.map((chip) => (
                <MedsChip key={chip.query} label={chip.labelKa} onPress={() => router.push({ pathname: '/medications/add/search', params: { q: chip.query } })} />
              ))}
            </View>
            {catalogTotal > 0 ? <Text style={[hubText.small, { color: c.text300 }]}>{ka.pharmacy.catalogSize(catalogTotal)}</Text> : null}
          </MedsCard>
        </View>

        {catalogProducts.length > 0 ? (
          <View style={s.section}>
            {heading(ka.meds.popularSearchesTitle, '/medications/add/search')}
            <MedsCard padded={false}>
              {catalogProducts.slice(0, 4).map((product, index) => (
                <PopularSearchRow
                  key={product.id}
                  imageUrl={product.imageUrl}
                  category={product.category?.nameKa ?? null}
                  title={product.name}
                  subtitle={catalogProductMeta(product)}
                  bestPriceGel={product.bestPriceGel}
                  onPress={() => router.push(`/pharmacy/product/${product.id}` as never)}
                  showDivider={index < Math.min(catalogProducts.length, 4) - 1}
                />
              ))}
            </MedsCard>
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
          {heading(ka.meds.myMedications, activeMeds.length > 0 ? '/medications/reminders' : undefined)}
          {activeMeds.length === 0 ? (
            <MedsCard style={{ gap: 12 }}>
              <Image
                source={EMPTY_ART.meds}
                resizeMode="contain"
                accessible={false}
                accessibilityIgnoresInvertColors
                style={{ width: 96, height: 96, alignSelf: 'center' }}
              />
              <Text style={[hubText.body, { color: c.text200 }]}>{ka.meds.emptyHint}</Text>
              <MedsButton label={ka.meds.addMedicationCta} icon={Plus} tone="tonal" onPress={openAdd} />
            </MedsCard>
          ) : (
            <MedsCard style={{ gap: 14 }}>
              {activeMeds.map((med, index) => (
                <ReminderRow
                  key={med.id}
                  med={med}
                  imageUrl={images[med.id]}
                  showDivider={index > 0}
                  onOpen={() => router.push(`/medications/${med.id}` as never)}
                  onToggle={() => apiToggle(med, load)}
                />
              ))}
            </MedsCard>
          )}
        </View>
      </ScrollView>
    </>
  );
}

async function apiToggle(med: Medication, reload: () => void) {
  await api.medications.update(med.id, { active: !med.active }).catch(() => undefined);
  reload();
}

const MED_POPULAR_CHIPS = [
  { query: 'ibuprofen', labelKa: tx('იბუპროფენი', 'Ibuprofen') },
  { query: 'amoxicillin', labelKa: tx('ამოქსიცილინი', 'Amoxicillin') },
  { query: 'atorvastatin', labelKa: tx('ატორვასტატინი', 'Atorvastatin') },
] as const;

/** The spotlight's lead: a ring that fills as today's doses get taken. */
function TodayRing({ taken, total }: { taken: number; total: number }) {
  return (
    <MedsRing size={64} stroke={6} progress={total > 0 ? taken / total : 0} color="#99F6E4" track="rgba(255,255,255,0.16)">
      <Text style={[hubText.value, { fontSize: 15, color: '#FFFFFF' }]}>{total > 0 ? `${taken}/${total}` : '—'}</Text>
    </MedsRing>
  );
}

function MetricCell({ value, suffix, label }: { value: string; suffix: string; label: string }) {
  const c = useThemeColors();
  return (
    <View style={{ flex: 1 }} accessible accessibilityLabel={`${label}: ${value}${suffix}`}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>
        <Text style={[hubText.value, { fontSize: 22, lineHeight: 28, color: c.text100 }]}>{value}</Text>
        {suffix ? <Text style={[hubText.caption, { color: c.text200, paddingBottom: 3 }]}>{suffix}</Text> : null}
      </View>
      <Text numberOfLines={1} style={[hubText.caption, { color: c.text200, marginTop: 2 }]}>
        {label}
      </Text>
    </View>
  );
}

function MedSearchInput({ value, onChangeText, onSubmit }: { value: string; onChangeText: (v: string) => void; onSubmit: () => void }) {
  const c = useThemeColors();
  return (
    <View style={[s.searchShell, { backgroundColor: c.bg100 }]}>
      <Search size={18} color={c.text300} strokeWidth={2} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        placeholder={ka.meds.searchPlaceholder}
        placeholderTextColor={c.text300}
        returnKeyType="search"
        style={[hubText.body, { flex: 1, fontSize: 15, color: c.text100, paddingVertical: 12 }]}
      />
      {value.trim() ? (
        <Pressable onPress={onSubmit} hitSlop={8} accessibilityRole="button" accessibilityLabel={ka.meds.quickSearch}>
          <ChevronRight size={18} color={c.primary100} strokeWidth={2.2} />
        </Pressable>
      ) : null}
    </View>
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
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={title}>
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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <Crown size={11} color={priceInk} strokeWidth={2.4} />
            <Text style={[hubText.value, { fontSize: 14, color: priceInk }]}>{bestPriceGel.toFixed(2)} ₾</Text>
          </View>
        ) : (
          <ChevronRight size={18} color={c.text300} strokeWidth={2} />
        )}
      </View>
      {showDivider ? <MedsHairline inset={HUB.cardPad} /> : null}
    </Pressable>
  );
}

function ReminderRow({
  med,
  imageUrl,
  showDivider,
  onOpen,
  onToggle,
}: {
  med: Medication;
  imageUrl?: string | null;
  showDivider: boolean;
  onOpen: () => void;
  onToggle: () => void;
}) {
  const c = useThemeColors();
  const cfg = parseMedicationConfig(med.config);
  const times = parseFrequencyTimes(med.frequency);
  const [on, setOn] = useState(med.active);
  const schedule = times.length > 1 ? `${ka.meds.timesPerDayLabel(times.length)} · ${times.map(formatTime24h).join(', ')}` : ka.meds.reminderSchedule(times[0] ? formatTime24h(times[0]) : '');
  return (
    <View>
      {showDivider ? <MedsHairline style={{ marginBottom: 14 }} /> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={med.medName} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <MedicationPillIcon color={cfg.pillColor} shape={cfg.pillShape ?? 'long'} size={52} border imageUrl={imageUrl ?? cfg.imageUrl} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={[hubText.cardTitle, { color: c.text100 }]}>
              {med.medName}
            </Text>
            <Text numberOfLines={1} style={[hubText.caption, { color: c.text200, marginTop: 2 }]}>
              {schedule}
            </Text>
          </View>
        </Pressable>
        <Switch
          value={on}
          onValueChange={() => {
            setOn(!on);
            onToggle();
          }}
          accessibilityLabel={`${med.medName}: ${on ? ka.meds.activeLabel : ka.meds.pausedLabel}`}
          trackColor={{ true: c.primary200, false: c.bg300 }}
          thumbColor="#fff"
        />
      </View>
    </View>
  );
}

function MedicationOnboarding({ onContinue }: { onContinue: () => void }) {
  const c = useThemeColors();
  return (
    <View style={{ flex: 1, backgroundColor: c.bg100, paddingHorizontal: HUB.gutter, justifyContent: 'center' }}>
      <View style={{ alignItems: 'center', marginBottom: 40, gap: 24 }}>
        <MedsIconTile icon={Pill} ink="teal" size={88} iconSize={44} style={{ borderRadius: 26 }} />
        <View style={{ gap: 12, alignItems: 'center' }}>
          <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 26, lineHeight: 33, color: c.text100, textAlign: 'center' }}>
            {ka.meds.onboardingEmptyTitle}
          </Text>
          <Text style={[hubText.body, { fontSize: 16, lineHeight: 24, color: c.text200, textAlign: 'center' }]}>{ka.meds.onboardingEmptyBody}</Text>
        </View>
      </View>
      <MedsButton label={ka.meds.onboardingContinue} onPress={onContinue} />
    </View>
  );
}

export async function shouldShowMedicationOnboarding(): Promise<boolean> {
  const done = await getPreference(ONBOARDING_KEY);
  return done !== '1';
}

const s = StyleSheet.create({
  section: { paddingHorizontal: HUB.gutter, marginTop: HUB.sectionGap },
  searchShell: {
    minHeight: 46,
    borderRadius: HUB.tileRadius,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 10,
  },
});
