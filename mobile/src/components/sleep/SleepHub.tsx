import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChartColumn, MessageCircle, SlidersHorizontal } from 'lucide-react-native';
import { ModuleHeader, ModuleHeaderButton } from '@/components/brand/ModuleHeader';
import { tx } from '@/i18n/locale';
import { localAccountId } from '@/lib/localAccount';
import { mediPrefillRoute } from '@/lib/mediHandoff';
import { invalidate } from '@/lib/queryClient';
import { greetingFor, SLEEP_ASK_MEDI } from '@/lib/sleep/sleepCopy';
import { importSleepFromHealth } from '@/lib/sleep/sleepHealth';
import { flushPendingNights, useSleepSession } from '@/lib/sleep/sleepSession';
import { dayPhase, plannedBedtimeMinutes, wakeMinutesFor, ymd } from '@/lib/sleep/sleepTime';
import { saveSleepPlan, useSleepCatalog, useSleepHub, useSleepHubEffects } from '@/lib/sleep/useSleepData';
import type { SleepPlan } from '@/lib/sleep/sleepTypes';
import { useThemeColors } from '@/theme/colors';
import { MixerSheet, NowPlayingBar } from './SleepSounds';
import { CheckinQuick, LastNightCard, SessionBanner, SleepTools, SoundShelf, TonightHero, WeekCard } from './SleepHubParts';
import { NightCard, ORCHID, SleepBody, SleepSection } from './SleepKit';

const DAY = 86_400_000;

function useMinuteClock(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

/** Dial position → plan: the wake time of tonight's morning and the goal (window − 15 min to fall asleep). */
function planFromDial(base: SleepPlan, dial: { bedtime: number; wake: number }, morning: Date): SleepPlan {
  const window = (((dial.wake - dial.bedtime) % 1440) + 1440) % 1440;
  const goalMinutes = Math.max(300, Math.min(660, Math.round((window - 15) / 5) * 5));
  const wakeText = `${String(Math.floor(dial.wake / 60)).padStart(2, '0')}:${String(dial.wake % 60).padStart(2, '0')}`;
  const weekend = morning.getDay() === 0 || morning.getDay() === 6;
  if (weekend && base.weekendWakeTime) return { ...base, goalMinutes, weekendWakeTime: wakeText };
  return { ...base, goalMinutes, wakeTime: wakeText };
}

export default function SleepHub() {
  const c = useThemeColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const now = useMinuteClock();
  const hubQ = useSleepHub();
  const hub = hubQ.data;
  useSleepHubEffects(hub);
  const catalogQ = useSleepCatalog();
  const session = useSleepSession();
  const [mixerOpen, setMixerOpen] = useState(false);
  const [draft, setDraft] = useState<{ bedtime: number; wake: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void flushPendingNights();
      void importSleepFromHealth().then((changed) => {
        if (changed > 0) void invalidate('sleep');
      });
    }, []),
  );

  const plan = hub?.plan ?? null;
  const base = plan ?? hub?.suggested.plan ?? null;
  // Tonight's morning: the next wake-up from now.
  const morning = useMemo(() => {
    if (!base) return new Date(now.getTime() + DAY);
    const w = wakeMinutesFor(base, now);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, w);
    return today.getTime() > now.getTime() ? today : new Date(today.getTime() + DAY);
  }, [base, now]);
  const dial = draft ?? (base ? { bedtime: plannedBedtimeMinutes(base, morning), wake: wakeMinutesFor(base, morning) } : { bedtime: 23 * 60, wake: 7 * 60 });
  const phase = dayPhase(plan, now);

  const commitDial = async (next: { bedtime: number; wake: number }) => {
    if (!base || !plan) {
      setDraft(next);
      return;
    }
    setSaving(true);
    try {
      await saveSleepPlan(planFromDial(plan, next, morning));
      setDraft(null);
    } catch {
      setDraft(null);
    } finally {
      setSaving(false);
    }
  };

  const basisNote = useMemo(() => {
    const b = hub?.suggested.basis;
    if (!b || b.usualHours == null) return null;
    const usual = b.usualBand === '5' ? tx('5 საათი ან ნაკლები', '5 hours or less') : b.usualBand === '10' ? tx('10 საათი ან მეტი', '10 hours or more') : tx(`~${b.usualHours} საათი`, `about ${b.usualHours} hours`);
    return tx(`რეგისტრაციისას თქვი, რომ გძინავს ${usual}. ზრდასრულს 7–9 საათი სჭირდება — დავიწყოთ ამით.`, `You told us you sleep ${usual}. Adults need 7–9 hours — let's start from here.`);
  }, [hub?.suggested.basis]);

  const nightsByDate = useMemo(() => [...(hub?.nights ?? [])].sort((a, b) => b.night.localeCompare(a.night)), [hub?.nights]);
  const todayYmd = hub?.today ?? ymd(now);
  const lastNight = nightsByDate.find((n) => n.night >= ymd(new Date(Date.parse(`${todayYmd}T12:00:00`) - DAY))) ?? null;
  // „როგორ გეძინა?“ belongs to the morning and the day after a night — never the evening before the next one.
  const needsCheckin = !session && (phase === 'morning' || phase === 'day') && (lastNight ? !lastNight.checkedIn && lastNight.night === todayYmd : phase === 'morning');
  const checkinNight = lastNight?.night ?? todayYmd;
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => ymd(new Date(Date.parse(`${todayYmd}T12:00:00`) - (6 - i) * DAY))), [todayYmd]);
  const sounds = catalogQ.data?.sounds ?? [];
  const shelf = useMemo(() => [...sounds].sort((a, b) => Number(b.featured) - Number(a.featured)).slice(0, 8), [sounds]);

  const header = (
    <ModuleHeader
      module="sleep"
      subtitle={greetingFor(now)}
      fallbackHref="/(tabs)/home"
      right={<ModuleHeaderButton label={tx('ძილის გეგმა', 'Sleep plan')} icon={SlidersHorizontal} onPress={() => router.push('/sleep/plan' as never)} />}
    />
  );

  if (!hub) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg100, paddingTop: insets.top + 12, paddingHorizontal: 20, gap: 24 }}>
        {header}
        {hubQ.isError ? (
          <NightCard style={{ gap: 12 }}>
            <SleepBody>{tx('MEDISLEEP ვერ ჩაიტვირთა. შეამოწმე ინტერნეტი.', 'MEDISLEEP could not load. Check your connection.')}</SleepBody>
            <Pressable accessibilityRole="button" onPress={() => void hubQ.refetch()}>
              <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, color: ORCHID }}>{tx('ხელახლა ცდა', 'Try again')}</Text>
            </Pressable>
          </NightCard>
        ) : (
          <ActivityIndicator color={ORCHID} style={{ marginTop: 40 }} />
        )}
      </View>
    );
  }

  const hero = (
    <TonightHero
      plan={plan}
      suggested={hub.suggested.plan}
      bedtime={dial.bedtime}
      wake={dial.wake}
      onDraft={setDraft}
      onCommit={(next) => void commitDial(next)}
      onStart={() => router.push('/sleep/night' as never)}
      onSetup={() => router.push('/sleep/plan?setup=1' as never)}
      onSounds={() => router.push('/sleep/sounds' as never)}
      basisNote={basisNote}
    />
  );
  const lastNightBlock = lastNight ? (
    <SleepSection title={tx('ბოლო ღამე', 'Last night')}>
      <LastNightCard
        night={lastNight}
        goalMinutes={hub.summary.goalMinutes}
        onEdit={() => router.push(`/sleep/log?night=${lastNight.night}` as never)}
        onRate={() => router.push(`/sleep/checkin?night=${lastNight.night}` as never)}
      />
    </SleepSection>
  ) : null;
  const morningFirst = phase === 'morning' && !session;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg100 }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: insets.bottom + 120, gap: 28 }}
        refreshControl={
          <RefreshControl
            tintColor={ORCHID}
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void importSleepFromHealth({ force: true })
                .then(() => Promise.all([hubQ.refetch(), catalogQ.refetch()]))
                .finally(() => setRefreshing(false));
            }}
          />
        }
      >
        {header}
        {session ? <SessionBanner startedAt={session.startedAt} alarmAt={session.alarmAt} onOpen={() => router.push('/sleep/night' as never)} /> : null}
        {needsCheckin ? <CheckinQuick night={checkinNight} onPick={(q) => router.push(`/sleep/checkin?night=${checkinNight}&quality=${q}` as never)} /> : null}
        {morningFirst ? lastNightBlock : null}
        {hero}
        {saving ? <Text style={{ marginTop: -18, textAlign: 'center', fontSize: 12, color: c.text300 }}>{tx('ვინახავ…', 'Saving…')}</Text> : null}
        {!morningFirst ? lastNightBlock : null}
        {shelf.length ? (
          <SleepSection title={tx('ხმები ძილისთვის', 'Sounds for sleep')} action={{ label: tx('ყველა', 'All'), onPress: () => router.push('/sleep/sounds' as never) }}>
            <SoundShelf sounds={shelf} />
          </SleepSection>
        ) : null}
        <SleepSection title={tx('ეს კვირა', 'This week')} action={{ label: tx('ანალიტიკა', 'Analytics'), onPress: () => router.push('/sleep/insights' as never) }}>
          {hub.summary.nightsLogged ? (
            <WeekCard
              hub={hub}
              days={weekDays}
              plannedBed={base ? plannedBedtimeMinutes(base, morning) : null}
              plannedWake={base ? wakeMinutesFor(base, morning) : null}
              onOpen={() => router.push('/sleep/insights' as never)}
            />
          ) : (
            <NightCard style={{ gap: 6 }}>
              <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 15, lineHeight: 22, color: c.text100 }}>{tx('პირველი ღამე წინაა', 'Your first night is ahead')}</Text>
              <SleepBody>
                {tx('ჩართე ძილის რეჟიმი დაწოლისას, ან დილით ჩაწერე ღამე. Apple Health / Health Connect-ის ძილიც აქ გამოჩნდება.', 'Turn on sleep mode at bedtime, or log the night in the morning. Sleep from Apple Health / Health Connect shows up here too.')}
              </SleepBody>
            </NightCard>
          )}
        </SleepSection>
        {hub.tips.length ? (
          <SleepSection title={tx('შენთვის', 'For you')}>
            <View style={{ gap: 10 }}>
              {hub.tips.slice(0, 2).map((tip) => (
                <NightCard key={tip.id} style={{ gap: 6 }}>
                  <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 14, lineHeight: 21, color: c.text100 }}>{tip.title}</Text>
                  <SleepBody>{tip.body}</SleepBody>
                </NightCard>
              ))}
            </View>
          </SleepSection>
        ) : null}
        <SleepSection title={tx('ჰკითხე Medi-ს', 'Ask Medi')}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {SLEEP_ASK_MEDI.map((q) => (
              <Pressable
                key={q}
                accessibilityRole="button"
                onPress={() => router.push(mediPrefillRoute(localAccountId(), q) as never)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, minHeight: 40, borderRadius: 20, backgroundColor: c.surface }}
              >
                <MessageCircle size={14} color={ORCHID} />
                <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 13, color: c.text100 }}>{q}</Text>
              </Pressable>
            ))}
          </View>
        </SleepSection>
        <SleepSection title={tx('ხელსაწყოები', 'Tools')}>
          <SleepTools breathing={hub.config.breathing} />
        </SleepSection>
        <Pressable accessibilityRole="button" onPress={() => router.push('/sleep/insights' as never)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 6 }}>
          <ChartColumn size={16} color={c.text300} />
          <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 12, color: c.text300 }}>{tx('ძილის სრული ანალიტიკა', 'Full sleep analytics')}</Text>
        </Pressable>
      </ScrollView>
      <View pointerEvents="box-none" style={{ position: 'absolute', left: 16, right: 16, bottom: insets.bottom + 12 }}>
        <NowPlayingBar onOpenMixer={() => setMixerOpen(true)} />
      </View>
      <MixerSheet
        visible={mixerOpen}
        onClose={() => setMixerOpen(false)}
        timerOptions={hub.config.timerOptions}
        onAddSounds={() => {
          setMixerOpen(false);
          router.push('/sleep/sounds' as never);
        }}
      />
    </View>
  );
}
