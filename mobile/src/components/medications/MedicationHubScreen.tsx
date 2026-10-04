import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CalendarDays, ChevronRight, FlaskConical, Plus, Search, Tag, type LucideIcon } from 'lucide-react-native';
import { ModuleHeader, ModuleHeaderButton } from '@/components/brand/ModuleHeader';
import { MediHeaderButton } from '@/components/medi/MediHeaderButton';
import { HomeSectionHeading } from '@/components/home/HomeSectionHeading';
import { MedicationPillIcon } from '@/components/medications/MedicationPillIcon';
import { MedipillHero } from '@/components/medications/MedipillHero';
import { MedsButton, MedsCard, MedsChip, MedsHairline, MedsIconTile, medsInk } from '@/components/medications/MedsHubUI';
import { CatalogProductRow } from '@/components/pharmacy/CatalogProductRow';
import { UpcomingDoseCard } from '@/components/medications/UpcomingDoseCard';
import { useTabBarInset } from '@/components/navigation/FloatingTabBar';
import { Switch } from '@/components/ui/AppSwitch';
import { MedsHubSkeleton } from '@/components/ui/Skeleton';
import { useMedicationImages } from '@/hooks/useMedicationImages';
import { useMedications } from '@/hooks/useMedications';
import { ka } from '@/i18n/ka';
import { tx } from '@/i18n/locale';
import { api, type CatalogProductSummary, type Medication, type ScheduledDose } from '@/lib/api';
import { isFeatureOn, useFeatureState } from '@/lib/featureFlags';
import { computeTodayDoses } from '@/lib/home/todayDoses';
import { findDoseLog, formatTime24h, parseFrequencyTimes, parseMedicationConfig, saveDoseLog, todayYmd } from '@/lib/medications.shared';
import { useIsDark, useThemeColors } from '@/theme/colors';
import { HUB, hubText, type HubInk } from '@/theme/hub';

const TODAY_PREVIEW = 4;
const POPULAR_ROWS = 3;

/**
 * MEDIPILL — the medications hub. Standard module header, one hero (today + the week as a pill
 * organiser), then what she acts on most: today's doses, her medications, tools, and the catalogue.
 */
export function MedicationHubScreen() {
  const c = useThemeColors();
  const dark = useIsDark();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tabInset = useTabBarInset();
  const features = useFeatureState();
  const pharmacyOn = isFeatureOn('pharmacy', features);
  const { medications, schedule, doseLogs, setDoseLogs, refreshing, loading, onRefresh, load } = useMedications();
  const images = useMedicationImages(medications);
  const [searchQuery, setSearchQuery] = useState('');
  const [catalogProducts, setCatalogProducts] = useState<CatalogProductSummary[]>([]);
  const [catalogTotal, setCatalogTotal] = useState(0);
  const today = todayYmd();
  const ink = medsInk(dark);

  useEffect(() => {
    void api.pharmacy
      .products({ sort: 'name', limit: POPULAR_ROWS })
      .then((res) => {
        setCatalogProducts(res.products);
        setCatalogTotal(res.pagination?.total ?? 0);
      })
      .catch(() => undefined);
  }, []);

  const activeMeds = useMemo(() => medications.filter((m) => m.active), [medications]);
  const pausedMeds = useMemo(() => medications.filter((m) => !m.active), [medications]);
  // Every dose of today in time order (answered ones keep their status pill). The day rules live in
  // computeTodayDoses; a medication scheduled today has all of its times today.
  const todayDoses = useMemo(() => {
    const scheduledToday = computeTodayDoses(medications, schedule, doseLogs, today).progressByMed;
    return schedule.filter((dose) => scheduledToday.has(dose.medicationId)).sort((a, b) => a.time.localeCompare(b.time));
  }, [medications, schedule, doseLogs, today]);

  const markDose = async (medicationId: string, time: string, status: 'taken' | 'skipped') => {
    const entry = { medicationId, date: today, time, status, updatedAt: new Date().toISOString() };
    await saveDoseLog(entry);
    setDoseLogs((prev) => [...prev.filter((l) => !(l.medicationId === medicationId && l.date === today && l.time === time)), entry]);
  };

  const openAdd = () => router.push('/medications/add');
  const openSearch = (q?: string) => router.push(q ? { pathname: '/medications/add/search', params: { q } } : '/medications/add/search');

  // One compact row of tools: a one-word label each, so nothing wraps or truncates.
  const tools: ToolItem[] = [
    { key: 'calendar', label: ka.meds.quickCalendar, href: '/medications/reminders/calendar', icon: CalendarDays, ink: 'sky' },
    { key: 'interaction', label: tx('თავსებადობა', 'Interactions'), href: '/medications/interaction', icon: FlaskConical, ink: 'violet' },
    ...(pharmacyOn ? [{ key: 'prices', label: tx('ფასები', 'Prices'), href: '/pharmacy', icon: Tag, ink: 'green' as const }] : []),
  ];

  return (
    <View style={{ flex: 1, backgroundColor: c.bg100 }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: tabInset + 24, width: '100%', maxWidth: 760, alignSelf: 'center' }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ink} />}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* The standard MEDI module header (MEDIRUN's): back · wordmark + one line · one icon button. */}
        <ModuleHeader
          module="pill"
          subtitle={tx('წამლები, დოზები და შეხსენებები', 'Medications, doses and reminders')}
          style={s.gutter}
          right={
            /* Medi beside + (owner 2026-10-04): „what is this medicine for?“ is asked right here. */
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <MediHeaderButton />
              <ModuleHeaderButton label={ka.meds.addMedicationCta} icon={Plus} onPress={openAdd} />
            </View>
          }
        />

        {loading && medications.length === 0 ? (
          <View style={{ marginTop: HUB.sectionGap - 8 }}>
            <MedsHubSkeleton />
          </View>
        ) : (
          <>
            <View style={[s.gutter, { marginTop: HUB.sectionGap - 8 }]}>
              <MedipillHero
                medications={medications}
                schedule={schedule}
                doseLogs={doseLogs}
                images={images}
                onOpenSchedule={() => router.push('/medications/reminders')}
                onOpenDay={(date) => router.push({ pathname: '/medications/reminders', params: { date } })}
                onTake={(dose: ScheduledDose) => void markDose(dose.medicationId, dose.time, 'taken')}
                onAdd={openAdd}
              />
            </View>

            {todayDoses.length > 0 ? (
              <View style={s.section}>
                <HomeSectionHeading
                  title={tx('დღის დოზები', 'Today’s doses')}
                  linkLabel={ka.meds.remindersScreenTitle}
                  onLink={() => router.push('/medications/reminders')}
                />
                <MedsCard style={{ gap: 14 }}>
                  {todayDoses.slice(0, TODAY_PREVIEW).map((dose, index) => {
                    const med = medications.find((m) => m.id === dose.medicationId);
                    const baseCfg = parseMedicationConfig(med?.config);
                    const cfg = { ...baseCfg, imageUrl: images[dose.medicationId] ?? baseCfg.imageUrl };
                    const log = findDoseLog(doseLogs, dose.medicationId, today, dose.time);
                    return (
                      <View key={`${dose.medicationId}-${dose.time}`}>
                        {index > 0 ? <MedsHairline style={{ marginBottom: 14 }} /> : null}
                        <UpcomingDoseCard
                          compact
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
                    <MedsButton
                      tone="quiet"
                      compact
                      label={tx(`ყველა დოზა (${todayDoses.length})`, `All doses (${todayDoses.length})`)}
                      onPress={() => router.push('/medications/reminders')}
                    />
                  ) : null}
                </MedsCard>
              </View>
            ) : null}

            {medications.length > 0 ? (
              <View style={s.section}>
                <HomeSectionHeading
                  title={`${ka.meds.myMedications} · ${activeMeds.length}`}
                  linkLabel={ka.meds.quickAdd}
                  onLink={openAdd}
                />
                <MedsCard style={{ gap: 14 }}>
                  {[...activeMeds, ...pausedMeds].map((med, index) => (
                    <MedicationRow
                      key={med.id}
                      med={med}
                      imageUrl={images[med.id]}
                      showDivider={index > 0}
                      onOpen={() => router.push(`/medications/${med.id}` as never)}
                      onToggle={() => apiToggle(med, load)}
                    />
                  ))}
                </MedsCard>
              </View>
            ) : null}

            <View style={s.section}>
              <HomeSectionHeading title={tx('ხელსაწყოები', 'Tools')} />
              <MedsCard style={s.tools}>
                {tools.map((tool) => (
                  <ToolButton key={tool.key} item={tool} onPress={() => router.push(tool.href as never)} />
                ))}
              </MedsCard>
            </View>

            <View style={s.section}>
              <HomeSectionHeading title={ka.meds.browseMedicationTitle} linkLabel={ka.meds.seeAll} onLink={() => openSearch()} />
              <MedsCard padded={false}>
                <View style={{ padding: HUB.cardPad, gap: 14 }}>
                  <MedSearchInput
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    onSubmit={() => openSearch(searchQuery.trim() || undefined)}
                  />
                  {/* One scrollable line of common searches — never wraps into a second row. */}
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={{ marginHorizontal: -HUB.cardPad }}
                    contentContainerStyle={{ paddingHorizontal: HUB.cardPad, gap: 8, alignItems: 'center' }}
                  >
                    <Text style={[hubText.caption, { color: c.text200 }]}>{ka.meds.mostCommon}</Text>
                    {MED_POPULAR_CHIPS.map((chip) => (
                      <MedsChip key={chip.query} label={chip.label} onPress={() => openSearch(chip.query)} />
                    ))}
                  </ScrollView>
                </View>
                {pharmacyOn && catalogProducts.length > 0 ? (
                  <>
                    <MedsHairline />
                    {catalogProducts.slice(0, POPULAR_ROWS).map((product, index) => (
                      <CatalogProductRow
                        key={product.id}
                        product={product}
                        first={index === 0}
                        onPress={() => router.push(`/pharmacy/product/${product.id}` as never)}
                      />
                    ))}
                  </>
                ) : null}
              </MedsCard>
              {catalogTotal > 0 ? (
                <Text style={[hubText.small, { color: c.text300, marginTop: 10, marginLeft: 4 }]}>{ka.pharmacy.catalogSize(catalogTotal)}</Text>
              ) : null}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

async function apiToggle(med: Medication, reload: () => void) {
  await api.medications.update(med.id, { active: !med.active }).catch(() => undefined);
  reload();
}

const MED_POPULAR_CHIPS = [
  { query: 'ibuprofen', label: tx('იბუპროფენი', 'Ibuprofen') },
  { query: 'amoxicillin', label: tx('ამოქსიცილინი', 'Amoxicillin') },
  { query: 'atorvastatin', label: tx('ატორვასტატინი', 'Atorvastatin') },
] as const;

function MedSearchInput({ value, onChangeText, onSubmit }: { value: string; onChangeText: (v: string) => void; onSubmit: () => void }) {
  const c = useThemeColors();
  const dark = useIsDark();
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
          <ChevronRight size={18} color={medsInk(dark)} strokeWidth={2.2} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** One of her medications: pill, name, when she takes it, and an on/off switch for its reminders. */
function MedicationRow({
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
  const dark = useIsDark();
  const cfg = parseMedicationConfig(med.config);
  const times = parseFrequencyTimes(med.frequency);
  const [on, setOn] = useState(med.active);
  useEffect(() => setOn(med.active), [med.active]);
  const when = times.length > 1
    ? `${ka.meds.timesPerDayLabel(times.length)} · ${times.map(formatTime24h).join(', ')}`
    : ka.meds.reminderSchedule(times[0] ? formatTime24h(times[0]) : '');
  const line = when;
  return (
    <View>
      {showDivider ? <MedsHairline style={{ marginBottom: 14 }} /> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, opacity: on ? 1 : 0.62 }}>
        <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={[med.medName, med.dosage, line].filter(Boolean).join(', ')} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <MedicationPillIcon color={cfg.pillColor} shape={cfg.pillShape ?? 'long'} size={48} border imageUrl={imageUrl ?? cfg.imageUrl} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={[hubText.cardTitle, { color: c.text100 }]}>
              {med.medName}
            </Text>
            <Text numberOfLines={1} style={[hubText.caption, { color: c.text200, marginTop: 2 }]}>
              {on ? line : ka.meds.pausedLabel}
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
          trackColor={{ true: medsInk(dark), false: c.bg300 }}
          thumbColor="#fff"
        />
      </View>
    </View>
  );
}

type ToolItem = { key: string; label: string; href: string; icon: LucideIcon; ink: HubInk };

function ToolButton({ item, onPress }: { item: ToolItem; onPress: () => void }) {
  const c = useThemeColors();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={item.label} onPress={onPress} style={s.tool}>
      <MedsIconTile icon={item.icon} ink={item.ink} size={46} iconSize={21} />
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={[hubText.caption, { color: c.text100, fontFamily: 'NotoSansGeorgian_600SemiBold' }]}>
        {item.label}
      </Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  tools: { flexDirection: 'row', paddingHorizontal: 8, paddingVertical: 14 },
  tool: { flex: 1, alignItems: 'center', gap: 8, paddingHorizontal: 2 },
  gutter: { paddingHorizontal: HUB.gutter },
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
