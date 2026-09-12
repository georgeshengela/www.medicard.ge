import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CycleAtmosphere, cycleNavHeader } from '@/components/cycle/CycleUI';
import { APP_MODAL_OVERLAY, APP_MODAL_PROPS } from '@/components/ui/appModal';
import { ka } from '@/i18n/ka';
import {
  pregnancyCareCategoryLabel,
  pregnancyCareCopy,
} from '@/i18n/cycle/pregnancyCare.js';
import { api, ApiError, type CyclePregnancyCarePlan, type CyclePregnancyCarePlanItem } from '@/lib/api';
import { supportsCycleCapability } from '@/lib/cycleModes';
import { loadCycleView } from '@/lib/cycleOffline';
import { todayKey } from '@/components/cycle/CycleCalendar';
import { cycleToday } from '@/lib/cycleCanonical';
import { getNotificationPermissionStatus, requestNotificationPermission } from '@/lib/notifications';
import { syncPregnancyCareReminders } from '@/lib/pregnancyCareReminders';
import { PregnancyCareCalendarExport } from '@/components/cycle/PregnancyCareCalendarExport';
import { PregnancyCarePlannedTime } from '@/components/cycle/PregnancyCarePlannedTime';
import { PregnancyCarePlannedPlace } from '@/components/cycle/PregnancyCarePlannedPlace';
import {
  EXACT_REMINDER_DEFAULT_MINUTES,
  PREGNANCY_CARE_REMINDER_SUPPRESSION,
  reminderPreviewFromSchedule,
  resolvePrenatalCareReminderSchedule,
} from '@/lib/pregnancyCareReminderContract.js';
import {
  isRenderableCareItem,
  pregnancyCareSourceById,
  renderablePregnancyCareItems,
} from '@/lib/pregnancyCareCatalog.js';
import { useAuth } from '@/store/AuthContext';
import { useCycleColors } from '@/theme/cycle';

function educationalPlan(): CyclePregnancyCarePlan {
  return {
    version: 'prenatal-care-v1',
    reviewedAt: '2026-09-10',
    sourceSet: 'who-nhs-nice-acog-2026',
    available: true,
    personalized: false,
    reviewRequired: false,
    pregnancyActive: true,
    offline: true,
    pregnancyEpisodeId: null,
    items: renderablePregnancyCareItems().map((item) => ({
      id: item.id,
      category: item.category,
      titleKey: item.titleKey,
      descriptionKey: item.descriptionKey,
      whyKey: item.whyKey,
      disclaimerKey: item.disclaimerKey,
      optional: Boolean(item.optional),
      regionalVariation: Boolean(item.regionalVariation),
      timing: {
        startWeek: item.startWeek,
        endWeek: item.endWeek,
        relation: null,
        type: item.timingType || 'WINDOW',
      },
      plannedDateOutsideWindow: false,
      sources: (item.sourceRefs || [])
        .map((id) => pregnancyCareSourceById(id))
        .filter((src) => src && isRenderableCareItem(item))
        .map((src) => ({
          organization: src.organization,
          title: src.title,
          reviewedAt: src.reviewedAt,
          url: src.url,
        })),
      userState: null,
    })),
  };
}

function itemStatusLabel(copy: typeof ka.cycle.carePlan, item: CyclePregnancyCarePlanItem) {
  if (item.userState?.status === 'PLANNED') return copy.statusPlanned;
  if (item.userState?.status === 'COMPLETED') return copy.statusCompleted;
  if (item.userState?.status === 'DISMISSED') return copy.statusDismissed;
  if (item.userState?.status === 'NOT_APPLICABLE') return copy.statusNotApplicable;
  if (item.timing.relation === 'IN_WINDOW') return copy.statusInWindow;
  if (item.timing.relation === 'BEFORE_WINDOW') return copy.statusUpcoming;
  if (item.timing.relation === 'AFTER_WINDOW') return copy.windowPassed;
  return copy.commonlyDiscussed;
}

function CareItemRow({
  item,
  onPress,
}: {
  item: CyclePregnancyCarePlanItem;
  onPress: () => void;
}) {
  const c = useCycleColors();
  const copy = ka.cycle.carePlan;
  const title = pregnancyCareCopy(item.titleKey);
  const timing = copy.weekRange(item.timing.startWeek, item.timing.endWeek);
  const status = itemStatusLabel(copy, item);
  const planned = item.userState?.plannedDate;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[title, timing, status, planned].filter(Boolean).join(', ')}
      style={{
        borderRadius: 14,
        borderWidth: 1,
        borderColor: c.border,
        backgroundColor: c.card,
        padding: 14,
        marginBottom: 10,
      }}
    >
      <Text style={{ color: c.mutedSoft, fontSize: 11, lineHeight: 16 }}>
        {pregnancyCareCategoryLabel(item.category)}
      </Text>
      <Text
        style={{
          color: c.ink,
          fontFamily: 'NotoSansGeorgian_700Bold',
          fontSize: 16,
          lineHeight: 22,
          marginTop: 4,
        }}
      >
        {title}
      </Text>
      <Text style={{ color: c.muted, fontSize: 13, lineHeight: 19, marginTop: 4 }}>{timing}</Text>
      <Text style={{ color: c.ink, fontSize: 13, lineHeight: 19, marginTop: 4 }}>{status}</Text>
      {planned ? (
        <Text style={{ color: c.brand, fontSize: 13, lineHeight: 19, marginTop: 4 }}>
          {copy.plannedDate}: {planned}
        </Text>
      ) : null}
    </Pressable>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const c = useCycleColors();
  return (
    <View style={{ marginTop: 18 }}>
      <Text
        style={{
          color: c.ink,
          fontFamily: 'NotoSansGeorgian_700Bold',
          fontSize: 15,
          lineHeight: 22,
          marginBottom: 8,
        }}
      >
        {title}
      </Text>
      {children}
    </View>
  );
}

export default function CyclePregnancyCarePlanScreen() {
  const c = useCycleColors();
  const navigation = useNavigation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ item?: string }>();
  const copy = ka.cycle.carePlan;
  const [plan, setPlan] = useState<CyclePregnancyCarePlan | null>(null);
  const [offline, setOffline] = useState(false);
  const [detail, setDetail] = useState<CyclePregnancyCarePlanItem | null>(null);
  const [sourcesItem, setSourcesItem] = useState<CyclePregnancyCarePlanItem | null>(null);
  const [plannedDate, setPlannedDate] = useState('');
  const [plannedTime, setPlannedTime] = useState<string | null>(null);
  const [plannedPlace, setPlannedPlace] = useState<string | null>(null);
  const [completedDate, setCompletedDate] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devicePermission, setDevicePermission] = useState<'granted' | 'denied' | 'undetermined' | null>(null);
  const [exactInvalidated, setExactInvalidated] = useState(false);
  const openedFromLink = useRef(false);
  const detailIdRef = useRef<string | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions(cycleNavHeader(c, copy.title));
  }, [navigation, c, copy.title]);

  const load = useCallback(() => {
    if (!user?.id) return;
    loadCycleView(user.id)
      .then((view) => {
        if (!supportsCycleCapability(view.display?.profile?.mode, 'showPregnancyCarePlanner')) {
          router.replace('/cycle');
          return null;
        }
        if (view.reachable === false) {
          setOffline(true);
          setPlan(educationalPlan());
          return null;
        }
        return api.cycle.pregnancyCarePlan();
      })
      .then((next) => {
        if (!next) return;
        setOffline(false);
        setPlan(next);
      })
      .catch((err) => {
        if (err instanceof ApiError && (err.status === 404 || err.status === 401)) {
          router.replace('/cycle');
          return;
        }
        setOffline(true);
        setPlan(educationalPlan());
      });
  }, [user?.id, router]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!plan || openedFromLink.current) return;
    const id = typeof params.item === 'string' ? params.item : '';
    if (!id) return;
    openedFromLink.current = true;
    const hit = plan.items.find((row) => row.id === id);
    if (hit) setDetail(hit);
  }, [plan, params.item]);

  useEffect(() => {
    if (!detail) return;
    if (detailIdRef.current !== detail.id) {
      detailIdRef.current = detail.id;
      setExactInvalidated(false);
    }
    setPlannedDate(detail.userState?.plannedDate || '');
    setPlannedTime(detail.userState?.plannedTime || null);
    setPlannedPlace(detail.userState?.plannedPlace || null);
    setCompletedDate(detail.userState?.completedDate || '');
    setNote(detail.userState?.note || '');
    setError(null);
    void getNotificationPermissionStatus().then(setDevicePermission);
  }, [detail]);

  async function refreshReminders(next: CyclePregnancyCarePlan) {
    if (!user?.id || next.offline) return;
    try {
      const view = await loadCycleView(user.id);
      await syncPregnancyCareReminders({
        plan: next,
        userId: user.id,
        mode: view.canonical.profile.mode,
        today: cycleToday(view.canonical, todayKey()),
        privacyEnabled: Boolean(view.canonical.profile.privacyEnabled),
      });
    } catch {
      /* Brain sync must not block planner writes */
    }
  }

  const buckets = useMemo(() => {
    const items = plan?.items || [];
    const hidden = (row: CyclePregnancyCarePlanItem) =>
      row.userState?.status === 'DISMISSED' || row.userState?.status === 'NOT_APPLICABLE';
    if (!plan?.personalized) {
      return {
        now: [],
        upcoming: [],
        passed: [],
        catalog: items.filter((row) => !hidden(row) && row.userState?.status !== 'COMPLETED'),
        planned: items.filter((row) => row.userState?.status === 'PLANNED'),
        completed: items.filter((row) => row.userState?.status === 'COMPLETED'),
        dismissed: items.filter(hidden),
      };
    }
    return {
      now: items.filter((row) => row.timing.relation === 'IN_WINDOW' && !hidden(row) && row.userState?.status !== 'COMPLETED'),
      upcoming: items.filter((row) => row.timing.relation === 'BEFORE_WINDOW' && !hidden(row) && row.userState?.status !== 'COMPLETED'),
      passed: items.filter((row) => row.timing.relation === 'AFTER_WINDOW' && !hidden(row) && row.userState?.status !== 'COMPLETED'),
      catalog: [],
      planned: items.filter((row) => row.userState?.status === 'PLANNED'),
      completed: items.filter((row) => row.userState?.status === 'COMPLETED'),
      dismissed: items.filter(hidden),
    };
  }, [plan]);

  async function save(status: string | null) {
    if (!detail || offline) {
      setError(copy.onlineRequired);
      return;
    }
    if (note.length > 400) {
      setError(copy.noteTooLong);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const next = await api.cycle.upsertPregnancyCareItem(detail.id, {
        status,
        plannedDate: plannedDate || null,
        plannedTime: plannedDate ? plannedTime : null,
        plannedPlace: plannedDate ? plannedPlace : null,
        completedDate: completedDate || null,
        note: note || null,
      });
      setPlan(next);
      const updated = next.items.find((row) => row.id === detail.id) || null;
      setDetail(updated);
      await refreshReminders(next);
    } catch {
      setError(copy.saveFailed);
      setPlannedDate(detail.userState?.plannedDate || '');
      setPlannedTime(detail.userState?.plannedTime || null);
      setPlannedPlace(detail.userState?.plannedPlace || null);
    } finally {
      setSaving(false);
    }
  }

  async function savePlannedTime(nextTime: string | null) {
    if (!detail || offline) {
      setError(copy.onlineRequired);
      return;
    }
    if (!plannedDate) {
      setError(copy.plannedTimeNeedDate);
      return;
    }
    const previous = plannedTime;
    const previousExact = detail.userState?.reminderMode === 'EXACT_TIME' && detail.userState?.reminderEnabled;
    setPlannedTime(nextTime);
    setSaving(true);
    setError(null);
    try {
      const next = await api.cycle.upsertPregnancyCareItem(detail.id, {
        status: 'PLANNED',
        plannedDate,
        plannedTime: nextTime,
        plannedPlace,
      });
      setPlan(next);
      const updated = next.items.find((row) => row.id === detail.id) || null;
      setDetail(updated);
      setPlannedTime(updated?.userState?.plannedTime || null);
      setExactInvalidated(Boolean(previousExact && !nextTime));
      await refreshReminders(next);
    } catch {
      setPlannedTime(previous);
      setError(copy.saveFailed);
    } finally {
      setSaving(false);
    }
  }

  async function savePlannedPlace(nextPlace: string | null) {
    if (!detail || offline) {
      setError(copy.onlineRequired);
      return;
    }
    if (!plannedDate) {
      setError(copy.plannedPlaceNeedDate);
      return;
    }
    const previous = plannedPlace;
    setPlannedPlace(nextPlace);
    setSaving(true);
    setError(null);
    try {
      const next = await api.cycle.upsertPregnancyCareItem(detail.id, {
        status: 'PLANNED',
        plannedDate,
        plannedTime,
        plannedPlace: nextPlace,
      });
      setPlan(next);
      const updated = next.items.find((row) => row.id === detail.id) || null;
      setDetail(updated);
      setPlannedPlace(updated?.userState?.plannedPlace || null);
      await refreshReminders(next);
    } catch {
      setPlannedPlace(previous);
      setError(copy.saveFailed);
    } finally {
      setSaving(false);
    }
  }

  async function saveReminder(opts: {
    enabled: boolean;
    mode?: 'DATE_BASED' | 'EXACT_TIME';
    offsetDays?: 0 | 1 | 3;
    exactMinutes?: 0 | 30 | 60 | 120;
  }) {
    if (!detail || offline) {
      setError(copy.onlineRequired);
      return;
    }
    if (detail.userState?.status !== 'PLANNED' || !detail.userState.plannedDate) {
      setError(copy.reminderNeedSave);
      return;
    }
    const hasTime = Boolean(detail.userState.plannedTime);
    const currentExact =
      detail.userState.reminderEnabled && detail.userState.reminderMode === 'EXACT_TIME' && hasTime;
    const mode: 'DATE_BASED' | 'EXACT_TIME' = !opts.enabled
      ? 'DATE_BASED'
      : opts.mode
        ? opts.mode
        : currentExact
          ? 'EXACT_TIME'
          : 'DATE_BASED';
    if (opts.enabled && mode === 'EXACT_TIME' && !hasTime) {
      setError(copy.plannedTimeNeedDate);
      return;
    }
    const offsetDays = opts.offsetDays ?? ((detail.userState.reminderOffset as 0 | 1 | 3) || 1);
    const exactMinutes =
      opts.exactMinutes ??
      (detail.userState.exactReminderOffsetMinutes ?? EXACT_REMINDER_DEFAULT_MINUTES);
    setSaving(true);
    setError(null);
    try {
      if (opts.enabled) {
        const status = await getNotificationPermissionStatus();
        if (status === 'undetermined') {
          const asked = await requestNotificationPermission();
          setDevicePermission(asked ? 'granted' : 'denied');
        } else {
          setDevicePermission(status);
        }
      }
      const next = await api.cycle.upsertPregnancyCareItem(detail.id, {
        status: 'PLANNED',
        plannedDate: detail.userState.plannedDate,
        plannedTime: detail.userState.plannedTime,
        plannedPlace: detail.userState.plannedPlace,
        reminderEnabled: opts.enabled,
        reminderOffset: offsetDays,
        reminderMode: mode,
        exactReminderOffsetMinutes: opts.enabled && mode === 'EXACT_TIME' ? exactMinutes : null,
      });
      setPlan(next);
      const updated = next.items.find((row) => row.id === detail.id) || null;
      setDetail(updated);
      setExactInvalidated(false);
      await refreshReminders(next);
    } catch {
      setError(copy.saveFailed);
    } finally {
      setSaving(false);
    }
  }

  return (
    <CycleAtmosphere>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: insets.bottom + 32,
        }}
      >
        <Text style={{ color: c.muted, fontSize: 13, lineHeight: 20 }}>{copy.disclaimer}</Text>
        <Text style={{ color: c.muted, fontSize: 13, lineHeight: 19, marginTop: 8 }}>{copy.honesty}</Text>
        {offline ? (
          <Text style={{ color: c.muted, fontSize: 13, lineHeight: 19, marginTop: 8 }}>{copy.onlineRequired}</Text>
        ) : null}
        {plan?.reviewRequired ? (
          <Text style={{ color: c.muted, fontSize: 13, lineHeight: 19, marginTop: 8 }}>{copy.reviewRequired}</Text>
        ) : null}

        {buckets.now.length ? (
          <Section title={copy.sectionNow}>
            {buckets.now.map((item) => (
              <CareItemRow key={item.id} item={item} onPress={() => setDetail(item)} />
            ))}
          </Section>
        ) : null}
        {buckets.upcoming.length ? (
          <Section title={copy.sectionUpcoming}>
            {buckets.upcoming.map((item) => (
              <CareItemRow key={item.id} item={item} onPress={() => setDetail(item)} />
            ))}
          </Section>
        ) : null}
        {buckets.passed.length ? (
          <Section title={copy.sectionPassed}>
            {buckets.passed.map((item) => (
              <CareItemRow key={item.id} item={item} onPress={() => setDetail(item)} />
            ))}
          </Section>
        ) : null}
        {buckets.catalog.length ? (
          <Section title={copy.title}>
            {buckets.catalog.map((item) => (
              <CareItemRow key={item.id} item={item} onPress={() => setDetail(item)} />
            ))}
          </Section>
        ) : null}
        {buckets.planned.length ? (
          <Section title={copy.sectionMyPlan}>
            {buckets.planned.map((item) => (
              <CareItemRow key={`plan-${item.id}`} item={item} onPress={() => setDetail(item)} />
            ))}
          </Section>
        ) : null}
        {buckets.completed.length ? (
          <Section title={copy.sectionCompleted}>
            {buckets.completed.map((item) => (
              <CareItemRow key={item.id} item={item} onPress={() => setDetail(item)} />
            ))}
          </Section>
        ) : null}
        {buckets.dismissed.length ? (
          <Section title={copy.sectionDismissed}>
            {buckets.dismissed.map((item) => (
              <CareItemRow key={item.id} item={item} onPress={() => setDetail(item)} />
            ))}
          </Section>
        ) : null}
      </ScrollView>

      <Modal visible={Boolean(detail)} {...APP_MODAL_PROPS} onRequestClose={() => setDetail(null)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: APP_MODAL_OVERLAY }}>
          <Pressable style={{ flex: 1 }} onPress={() => setDetail(null)} accessibilityLabel={ka.common.close} />
          <View
            style={{
              backgroundColor: c.card,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              paddingHorizontal: 16,
              paddingTop: 16,
              paddingBottom: insets.bottom + 16,
              maxHeight: '88%',
            }}
          >
            {detail ? (
              <ScrollView>
                <Text style={{ color: c.mutedSoft, fontSize: 11, lineHeight: 16 }}>
                  {pregnancyCareCategoryLabel(detail.category)}
                </Text>
                <Text
                  style={{
                    color: c.ink,
                    fontFamily: 'NotoSansGeorgian_700Bold',
                    fontSize: 20,
                    lineHeight: 26,
                    marginTop: 4,
                  }}
                >
                  {pregnancyCareCopy(detail.titleKey)}
                </Text>
                <Text style={{ color: c.muted, fontSize: 13, lineHeight: 20, marginTop: 8 }}>
                  {copy.timingHeading}: {copy.weekRange(detail.timing.startWeek, detail.timing.endWeek)}
                </Text>
                <Text style={{ color: c.muted, fontSize: 14, lineHeight: 21, marginTop: 10 }}>
                  {pregnancyCareCopy(detail.descriptionKey)}
                </Text>
                <Text
                  style={{
                    color: c.ink,
                    fontFamily: 'NotoSansGeorgian_600SemiBold',
                    fontSize: 14,
                    marginTop: 14,
                  }}
                >
                  {copy.whyHeading}
                </Text>
                <Text style={{ color: c.muted, fontSize: 14, lineHeight: 21, marginTop: 6 }}>
                  {pregnancyCareCopy(detail.whyKey)}
                </Text>
                {detail.regionalVariation ? (
                  <Text style={{ color: c.muted, fontSize: 13, lineHeight: 19, marginTop: 10 }}>
                    {copy.regionalNote}
                  </Text>
                ) : null}
                {detail.disclaimerKey ? (
                  <Text style={{ color: c.muted, fontSize: 13, lineHeight: 19, marginTop: 8 }}>
                    {pregnancyCareCopy(detail.disclaimerKey)}
                  </Text>
                ) : null}
                {detail.timing.relation === 'AFTER_WINDOW' ? (
                  <Text style={{ color: c.muted, fontSize: 13, lineHeight: 19, marginTop: 8 }}>
                    {copy.windowPassed}. {copy.windowPassedHint}
                  </Text>
                ) : null}
                {detail.plannedDateOutsideWindow ? (
                  <Text style={{ color: c.muted, fontSize: 13, lineHeight: 19, marginTop: 8 }}>
                    {copy.outsideWindow}
                  </Text>
                ) : null}

                <Text
                  style={{
                    color: c.ink,
                    fontFamily: 'NotoSansGeorgian_600SemiBold',
                    fontSize: 14,
                    marginTop: 16,
                  }}
                >
                  {copy.userStateHeading}
                </Text>
                <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18, marginTop: 4 }}>
                  {copy.completedMeansUser}
                </Text>
                <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18, marginTop: 10 }}>{copy.plannedDate}</Text>
                <TextInput
                  value={plannedDate}
                  onChangeText={setPlannedDate}
                  placeholder={copy.dateHint}
                  placeholderTextColor={c.mutedSoft}
                  accessibilityLabel={copy.plannedDate}
                  style={{
                    minHeight: 44,
                    borderWidth: 1,
                    borderColor: c.border,
                    borderRadius: 12,
                    paddingHorizontal: 12,
                    color: c.ink,
                    marginTop: 4,
                  }}
                />
                <PregnancyCarePlannedTime
                  plannedDate={plannedDate}
                  plannedTime={plannedTime}
                  disabled={saving || offline}
                  colors={c}
                  copy={copy}
                  onPick={(time) => void savePlannedTime(time)}
                  onClear={() => void savePlannedTime(null)}
                />
                <PregnancyCarePlannedPlace
                  plannedDate={plannedDate}
                  plannedPlace={plannedPlace}
                  disabled={saving || offline}
                  colors={c}
                  copy={copy}
                  onSave={(place) => void savePlannedPlace(place)}
                  onClear={() => void savePlannedPlace(null)}
                  onInvalid={(message) => setError(message)}
                />
                <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18, marginTop: 10 }}>{copy.completedDate}</Text>
                <TextInput
                  value={completedDate}
                  onChangeText={setCompletedDate}
                  placeholder={copy.dateHint}
                  placeholderTextColor={c.mutedSoft}
                  accessibilityLabel={copy.completedDate}
                  style={{
                    minHeight: 44,
                    borderWidth: 1,
                    borderColor: c.border,
                    borderRadius: 12,
                    paddingHorizontal: 12,
                    color: c.ink,
                    marginTop: 4,
                  }}
                />
                <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18, marginTop: 10 }}>{copy.note}</Text>
                <TextInput
                  value={note}
                  onChangeText={setNote}
                  placeholder={copy.noteHint}
                  placeholderTextColor={c.mutedSoft}
                  accessibilityLabel={copy.note}
                  multiline
                  style={{
                    minHeight: 72,
                    borderWidth: 1,
                    borderColor: c.border,
                    borderRadius: 12,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    color: c.ink,
                    marginTop: 4,
                  }}
                />
                {detail.userState?.status === 'COMPLETED' ||
                detail.userState?.status === 'DISMISSED' ||
                detail.userState?.status === 'NOT_APPLICABLE' ? null : detail.userState?.status === 'PLANNED' &&
                  detail.userState.plannedDate ? (
                  <View style={{ marginTop: 16 }}>
                    <Text
                      style={{
                        color: c.ink,
                        fontFamily: 'NotoSansGeorgian_600SemiBold',
                        fontSize: 14,
                      }}
                    >
                      {copy.remindMe}
                    </Text>
                    <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18, marginTop: 4 }}>
                      {copy.reminderHint}
                    </Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                      <Pressable
                        onPress={() => void saveReminder({ enabled: false })}
                        accessibilityRole="button"
                        accessibilityLabel={`${copy.reminder} ${copy.reminderOff}`}
                        testID="care-reminder-off"
                        disabled={saving}
                        style={{
                          minHeight: 44,
                          paddingHorizontal: 14,
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: c.border,
                          backgroundColor: detail.userState.reminderEnabled ? c.card : c.roseSoft,
                          justifyContent: 'center',
                        }}
                      >
                        <Text style={{ color: c.ink, fontFamily: 'NotoSansGeorgian_700Bold' }}>{copy.reminderOff}</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => void saveReminder({ enabled: true })}
                        accessibilityRole="button"
                        accessibilityLabel={`${copy.remindMe} ${copy.reminderOn}`}
                        testID="care-reminder-on"
                        disabled={saving}
                        style={{
                          minHeight: 44,
                          paddingHorizontal: 14,
                          borderRadius: 12,
                          backgroundColor: detail.userState.reminderEnabled ? c.cta : c.roseSoft,
                          justifyContent: 'center',
                        }}
                      >
                        <Text
                          style={{
                            color: detail.userState.reminderEnabled ? '#fff' : c.brand,
                            fontFamily: 'NotoSansGeorgian_700Bold',
                          }}
                        >
                          {copy.reminderOn}
                        </Text>
                      </Pressable>
                    </View>
                    {exactInvalidated ? (
                      <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18, marginTop: 8 }}>
                        {copy.reminderExactInvalidated}
                      </Text>
                    ) : null}
                    {detail.userState.reminderEnabled ? (
                      <View style={{ marginTop: 10, gap: 8 }}>
                        {detail.userState.plannedTime ? (
                          <>
                            <Text style={{ color: c.ink, fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 13 }}>
                              {copy.reminderTiming}
                            </Text>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                              <Pressable
                                onPress={() => void saveReminder({ enabled: true, mode: 'DATE_BASED' })}
                                accessibilityRole="button"
                                accessibilityLabel={copy.reminderByDate}
                                accessibilityState={{ selected: detail.userState.reminderMode !== 'EXACT_TIME' }}
                                testID="care-reminder-mode-date"
                                disabled={saving}
                                style={{
                                  minHeight: 44,
                                  paddingHorizontal: 14,
                                  borderRadius: 12,
                                  borderWidth: 1,
                                  borderColor: c.border,
                                  backgroundColor:
                                    detail.userState.reminderMode !== 'EXACT_TIME' ? c.roseSoft : c.card,
                                  justifyContent: 'center',
                                }}
                              >
                                <Text style={{ color: c.ink, fontFamily: 'NotoSansGeorgian_600SemiBold' }}>
                                  {copy.reminderByDate}
                                </Text>
                              </Pressable>
                              <Pressable
                                onPress={() =>
                                  void saveReminder({
                                    enabled: true,
                                    mode: 'EXACT_TIME',
                                    exactMinutes:
                                      detail.userState?.exactReminderOffsetMinutes ?? EXACT_REMINDER_DEFAULT_MINUTES,
                                  })
                                }
                                accessibilityRole="button"
                                accessibilityLabel={copy.reminderByTime}
                                accessibilityState={{ selected: detail.userState.reminderMode === 'EXACT_TIME' }}
                                testID="care-reminder-mode-exact"
                                disabled={saving}
                                style={{
                                  minHeight: 44,
                                  paddingHorizontal: 14,
                                  borderRadius: 12,
                                  borderWidth: 1,
                                  borderColor: c.border,
                                  backgroundColor:
                                    detail.userState.reminderMode === 'EXACT_TIME' ? c.roseSoft : c.card,
                                  justifyContent: 'center',
                                }}
                              >
                                <Text style={{ color: c.ink, fontFamily: 'NotoSansGeorgian_600SemiBold' }}>
                                  {copy.reminderByTime}
                                </Text>
                              </Pressable>
                            </View>
                            {detail.userState.reminderMode === 'EXACT_TIME' ? (
                              <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18 }}>
                                {copy.reminderExactHint}
                              </Text>
                            ) : null}
                          </>
                        ) : null}
                        {detail.userState.reminderMode !== 'EXACT_TIME'
                          ? (
                              [
                                [0, copy.reminderSameDay],
                                [1, copy.reminderOneDay],
                                [3, copy.reminderThreeDays],
                              ] as const
                            ).map(([offset, label]) => (
                              <Pressable
                                key={offset}
                                onPress={() => void saveReminder({ enabled: true, mode: 'DATE_BASED', offsetDays: offset })}
                                accessibilityRole="button"
                                accessibilityLabel={label}
                                accessibilityState={{ selected: detail.userState?.reminderOffset === offset }}
                                disabled={saving}
                                style={{
                                  minHeight: 44,
                                  paddingHorizontal: 14,
                                  borderRadius: 12,
                                  borderWidth: 1,
                                  borderColor: c.border,
                                  backgroundColor: detail.userState?.reminderOffset === offset ? c.roseSoft : c.card,
                                  justifyContent: 'center',
                                }}
                              >
                                <Text style={{ color: c.ink, fontFamily: 'NotoSansGeorgian_600SemiBold' }}>{label}</Text>
                              </Pressable>
                            ))
                          : (
                              [
                                [0, copy.reminderAtTime],
                                [30, copy.reminder30Min],
                                [60, copy.reminder1Hour],
                                [120, copy.reminder2Hours],
                              ] as const
                            ).map(([minutes, label]) => (
                              <Pressable
                                key={minutes}
                                onPress={() =>
                                  void saveReminder({ enabled: true, mode: 'EXACT_TIME', exactMinutes: minutes })
                                }
                                accessibilityRole="button"
                                accessibilityLabel={label}
                                accessibilityState={{
                                  selected: detail.userState?.exactReminderOffsetMinutes === minutes,
                                }}
                                testID={`care-reminder-exact-${minutes}`}
                                disabled={saving}
                                style={{
                                  minHeight: 44,
                                  paddingHorizontal: 14,
                                  borderRadius: 12,
                                  borderWidth: 1,
                                  borderColor: c.border,
                                  backgroundColor:
                                    detail.userState?.exactReminderOffsetMinutes === minutes ? c.roseSoft : c.card,
                                  justifyContent: 'center',
                                }}
                              >
                                <Text style={{ color: c.ink, fontFamily: 'NotoSansGeorgian_600SemiBold' }}>{label}</Text>
                              </Pressable>
                            ))}
                      </View>
                    ) : null}
                    {(() => {
                      if (!detail.userState.reminderEnabled) return null;
                      const schedule = resolvePrenatalCareReminderSchedule(detail.userState);
                      if (!schedule.ok) {
                        if (schedule.reason === PREGNANCY_CARE_REMINDER_SUPPRESSION.NONEXISTENT_LOCAL_TIME) {
                          return (
                            <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18, marginTop: 8 }}>
                              {copy.reminderNonexistentTime}
                            </Text>
                          );
                        }
                        return null;
                      }
                      const preview = reminderPreviewFromSchedule(schedule, new Date());
                      if (detail.userState.reminderMode === 'EXACT_TIME') {
                        return (
                          <>
                            <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18, marginTop: 8 }}>
                              {copy.reminderPreview(schedule.fireClock)}
                            </Text>
                            {preview?.past ? (
                              <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18, marginTop: 4 }}>
                                {copy.reminderPastFire}
                              </Text>
                            ) : null}
                          </>
                        );
                      }
                      return detail.userState.plannedDate && detail.userState.plannedDate < todayKey() ? (
                        <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18, marginTop: 8 }}>
                          {copy.reminderPast}
                        </Text>
                      ) : null;
                    })()}
                    {detail.userState.reminderEnabled && devicePermission === 'denied' ? (
                      <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18, marginTop: 8 }}>
                        {copy.reminderPrefOnDeviceOff}
                      </Text>
                    ) : null}
                  </View>
                ) : (
                  <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18, marginTop: 12 }}>{copy.reminderNeedDate}</Text>
                )}
                {user?.id && plan?.pregnancyEpisodeId ? (
                  <PregnancyCareCalendarExport
                    userId={user.id}
                    episodeId={plan.pregnancyEpisodeId}
                    careItemId={detail.id}
                    itemTitle={pregnancyCareCopy(detail.titleKey)}
                    plannedDate={detail.userState?.plannedDate || null}
                    plannedTime={detail.userState?.plannedTime || null}
                    today={todayKey()}
                    colors={c}
                    copy={copy}
                  />
                ) : null}
                {error ? (
                  <Text style={{ color: c.muted, fontSize: 13, lineHeight: 19, marginTop: 8 }}>{error}</Text>
                ) : null}

                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
                  <Pressable
                    onPress={() => void save('PLANNED')}
                    accessibilityRole="button"
                    accessibilityLabel={copy.markPlanned}
                    disabled={saving}
                    style={{ minHeight: 44, paddingHorizontal: 14, borderRadius: 12, backgroundColor: c.roseSoft, justifyContent: 'center' }}
                  >
                    <Text style={{ color: c.brand, fontFamily: 'NotoSansGeorgian_700Bold' }}>{copy.markPlanned}</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => void save('COMPLETED')}
                    accessibilityRole="button"
                    accessibilityLabel={copy.markCompleted}
                    disabled={saving}
                    style={{ minHeight: 44, paddingHorizontal: 14, borderRadius: 12, backgroundColor: c.cta, justifyContent: 'center' }}
                  >
                    <Text style={{ color: '#fff', fontFamily: 'NotoSansGeorgian_700Bold' }}>{copy.markCompleted}</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => void save('DISMISSED')}
                    accessibilityRole="button"
                    accessibilityLabel={copy.markDismiss}
                    disabled={saving}
                    style={{ minHeight: 44, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: c.border, justifyContent: 'center' }}
                  >
                    <Text style={{ color: c.ink, fontFamily: 'NotoSansGeorgian_700Bold' }}>{copy.markDismiss}</Text>
                  </Pressable>
                  {detail.userState?.status === 'DISMISSED' || detail.userState?.status === 'NOT_APPLICABLE' ? (
                    <Pressable
                      onPress={() => void save(null)}
                      accessibilityRole="button"
                      accessibilityLabel={copy.restore}
                      disabled={saving}
                      style={{ minHeight: 44, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: c.border, justifyContent: 'center' }}
                    >
                      <Text style={{ color: c.ink, fontFamily: 'NotoSansGeorgian_700Bold' }}>{copy.restore}</Text>
                    </Pressable>
                  ) : null}
                </View>
                <Pressable
                  onPress={() => setSourcesItem(detail)}
                  accessibilityRole="button"
                  accessibilityLabel={copy.sources}
                  style={{ minHeight: 44, justifyContent: 'center', marginTop: 8 }}
                >
                  <Text style={{ color: c.brand, fontFamily: 'NotoSansGeorgian_700Bold' }}>{copy.sources}</Text>
                </Pressable>
                <Pressable
                  onPress={() => setDetail(null)}
                  accessibilityRole="button"
                  accessibilityLabel={ka.common.close}
                  style={{ minHeight: 44, justifyContent: 'center' }}
                >
                  <Text style={{ color: c.muted }}>{ka.common.close}</Text>
                </Pressable>
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>

      <Modal visible={Boolean(sourcesItem)} {...APP_MODAL_PROPS} onRequestClose={() => setSourcesItem(null)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: APP_MODAL_OVERLAY }}>
          <Pressable style={{ flex: 1 }} onPress={() => setSourcesItem(null)} accessibilityLabel={ka.common.close} />
          <View
            style={{
              backgroundColor: c.card,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              padding: 16,
              paddingBottom: insets.bottom + 16,
            }}
          >
            <Text style={{ color: c.ink, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 18, lineHeight: 24 }}>
              {copy.sources}
            </Text>
            {(sourcesItem?.sources || []).map((src) => (
              <Pressable
                key={src.url}
                onPress={() => void Linking.openURL(src.url)}
                accessibilityRole="link"
                accessibilityLabel={`${src.organization}, ${src.title}`}
                style={{ minHeight: 44, marginTop: 12 }}
              >
                <Text style={{ color: c.ink, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 14, lineHeight: 20 }}>
                  {src.organization}
                </Text>
                <Text style={{ color: c.muted, fontSize: 13, lineHeight: 19, marginTop: 2 }}>{src.title}</Text>
                <Text style={{ color: c.mutedSoft, fontSize: 12, lineHeight: 17, marginTop: 2 }}>
                  {copy.sourcesReviewed(src.reviewedAt)}
                </Text>
                <Text style={{ color: c.brand, fontSize: 13, marginTop: 4 }}>{copy.openSource}</Text>
              </Pressable>
            ))}
            <Pressable
              onPress={() => setSourcesItem(null)}
              accessibilityRole="button"
              accessibilityLabel={ka.common.close}
              style={{ minHeight: 44, justifyContent: 'center', marginTop: 8 }}
            >
              <Text style={{ color: c.muted }}>{ka.common.close}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </CycleAtmosphere>
  );
}
