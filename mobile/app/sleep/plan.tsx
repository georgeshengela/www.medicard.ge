import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Minus, Plus } from 'lucide-react-native';
import { ModuleHeader } from '@/components/brand/ModuleHeader';
import { TimePickerSheet } from '@/components/ui/TimePickerSheet';
import { ClockText, MOON, MoonButton, NightCard, NightSwitch, ORCHID, PinnedFooter, SleepBody, SleepSection } from '@/components/sleep/SleepKit';
import { tx } from '@/i18n/locale';
import { sleepAlarmIsSystemAlarm } from '@/lib/sleep/sleepAlarm';
import { clockOf, cycleBedtimes, cycleWakeups, formatDuration, hhmm, parseHHMM, plannedBedtimeMinutes } from '@/lib/sleep/sleepTime';
import { saveSleepPlan, useSleepHub } from '@/lib/sleep/useSleepData';
import type { SleepPlan } from '@/lib/sleep/sleepTypes';
import { useThemeColors } from '@/theme/colors';

const WIND_DOWN = [0, 15, 30, 45, 60];

function Row({ title, note, right, onPress }: { title: string; note?: string; right: React.ReactNode; onPress?: () => void }) {
  const c = useThemeColors();
  const body = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52 }}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, lineHeight: 20, color: c.text100 }}>{title}</Text>
        {note ? <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 12, lineHeight: 17, color: c.text300 }}>{note}</Text> : null}
      </View>
      {right}
    </View>
  );
  return onPress ? <Pressable accessibilityRole="button" onPress={onPress}>{body}</Pressable> : body;
}

/**
 * The sleep plan: how long, when she gets up (weekdays / weekend), wind-down, reminders, alarm, the score. With
 * `setup=1` it starts from the plan built from her registration answers; `calc=1` scrolls to the calculator.
 */
export default function SleepPlanScreen() {
  const c = useThemeColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ setup?: string; calc?: string }>();
  const hub = useSleepHub().data;
  const initial = hub?.plan ?? hub?.suggested.plan ?? null;
  const [plan, setPlan] = useState<SleepPlan | null>(initial);
  const [sheet, setSheet] = useState<'wake' | 'weekend' | 'calc' | null>(null);
  const [calcWake, setCalcWake] = useState<string>(initial?.wakeTime ?? '07:00');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scroll = useRef<ScrollView>(null);
  const calcY = useRef(0);

  useEffect(() => {
    if (!plan && initial) {
      setPlan(initial);
      setCalcWake(initial.wakeTime);
    }
  }, [initial]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (params.calc === '1') setTimeout(() => scroll.current?.scrollTo({ y: calcY.current, animated: true }), 350);
  }, [params.calc]);

  const set = (patch: Partial<SleepPlan>) => setPlan((p) => (p ? { ...p, ...patch } : p));
  const basis = hub?.suggested.basis;
  const firstTime = !hub?.plan;

  const weekdayBed = plan ? plannedBedtimeMinutes(plan, new Date(2026, 9, 13)) : null; // a Tuesday morning
  const weekendBed = plan?.weekendWakeTime ? plannedBedtimeMinutes(plan, new Date(2026, 9, 17)) : null; // a Saturday

  const calc = useMemo(() => {
    const m = parseHHMM(calcWake) ?? 420;
    const now = new Date();
    const wake = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, Math.floor(m / 60), m % 60);
    return { bedtimes: cycleBedtimes(wake), wakeups: cycleWakeups(now) };
  }, [calcWake]);

  const save = async () => {
    if (!plan || saving) return;
    setSaving(true);
    setError(null);
    try {
      await saveSleepPlan(plan);
      router.dismissTo('/sleep' as never);
    } catch (e) {
      setError((e as Error)?.message || tx('ვერ შევინახე. სცადე თავიდან.', 'Could not save. Try again.'));
    } finally {
      setSaving(false);
    }
  };

  if (!plan) return <View style={{ flex: 1, backgroundColor: c.bg100 }} />;

  const step = (delta: number) => set({ goalMinutes: Math.max(300, Math.min(660, plan.goalMinutes + delta)) });

  return (
    <View style={{ flex: 1, backgroundColor: c.bg100 }}>
      <ScrollView ref={scroll} contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: insets.bottom + 120, gap: 26 }}>
        <ModuleHeader module="sleep" subtitle={tx('ძილის გეგმა', 'Sleep plan')} fallbackHref="/sleep" />
        {firstTime ? (
          <NightCard style={{ gap: 6 }}>
            <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 16, lineHeight: 23, color: c.text100 }}>{tx('დავიწყოთ შენი რიტმით', "Let's start from your rhythm")}</Text>
            <SleepBody>
              {basis?.usualHours != null
                ? tx(`რეგისტრაციისას თქვი, რომ საშუალოდ ~${basis.usualHours} საათი გძინავს. ${basis.age != null && basis.age >= 65 ? 'შენს ასაკში 7–8 საათია რეკომენდებული.' : 'ზრდასრულს 7–9 საათი სჭირდება.'} ქვემოთ ყველაფერი შეგიძლია შეცვალო.`,
                    `You told us you sleep about ${basis.usualHours} hours. ${basis.age != null && basis.age >= 65 ? '7–8 hours is recommended at your age.' : 'Adults need 7–9 hours.'} You can change everything below.`)
                : tx('ზრდასრულს 7–9 საათი ძილი სჭირდება. აირჩიე, როდის დგები — დაწოლის დროს თავად გამოვთვლით.', 'Adults need 7–9 hours of sleep. Pick when you get up — we work out the bedtime.')}
            </SleepBody>
          </NightCard>
        ) : null}

        <SleepSection title={tx('რამდენი ძილი გინდა?', 'How much sleep do you want?')}>
          <NightCard style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <Pressable accessibilityRole="button" accessibilityLabel={tx('15 წუთით ნაკლები', '15 minutes less')} onPress={() => step(-15)} style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: c.surfaceRaised, alignItems: 'center', justifyContent: 'center' }}>
              <Minus size={20} color={c.text100} />
            </Pressable>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontWeight: '200', fontSize: 38, lineHeight: 46, color: c.text100, fontVariant: ['tabular-nums'] }}>{formatDuration(plan.goalMinutes)}</Text>
              <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 12, color: c.text300 }}>
                {plan.goalMinutes < 420 ? tx('7 საათზე ნაკლები — ზრდასრულისთვის მცირეა', 'Under 7 hours — short for an adult') : plan.goalMinutes > 540 ? tx('9 საათზე მეტი', 'Over 9 hours') : tx('რეკომენდებულ ფარგლებში', 'Within the recommended range')}
              </Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={tx('15 წუთით მეტი', '15 minutes more')} onPress={() => step(15)} style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: c.surfaceRaised, alignItems: 'center', justifyContent: 'center' }}>
              <Plus size={20} color={c.text100} />
            </Pressable>
          </NightCard>
        </SleepSection>

        <SleepSection title={tx('როდის დგები?', 'When do you get up?')}>
          <NightCard style={{ gap: 4 }}>
            <Row
              title={tx('სამუშაო დღეებში', 'On weekdays')}
              note={weekdayBed != null ? tx(`დაწოლა ${hhmm(weekdayBed)}-ზე`, `Bedtime ${hhmm(weekdayBed)}`) : undefined}
              onPress={() => setSheet('wake')}
              right={<ClockText value={plan.wakeTime} size={26} />}
            />
            <View style={{ height: 1, backgroundColor: c.bg200 }} />
            <Row
              title={tx('შაბათ-კვირას სხვა დროს', 'A different time on weekends')}
              note={plan.weekendWakeTime && weekendBed != null ? tx(`${plan.weekendWakeTime} · დაწოლა ${hhmm(weekendBed)}`, `${plan.weekendWakeTime} · bedtime ${hhmm(weekendBed)}`) : tx('საუკეთესო რიტმი — ერთი და იგივე დრო', 'Best rhythm — the same time every day')}
              right={
                <NightSwitch value={!!plan.weekendWakeTime} onValueChange={(on) => (on ? setSheet('weekend') : set({ weekendWakeTime: null }))} accessibilityLabel={tx('შაბათ-კვირას სხვა დრო', 'A different weekend time')}/>
              }
            />
          </NightCard>
        </SleepSection>

        <SleepSection title={tx('საღამო', 'Evening')}>
          <NightCard style={{ gap: 12 }}>
            <Row
              title={tx('დამშვიდების შეხსენება', 'Wind-down reminder')}
              note={plan.bedtimeReminder ? (plan.windDownMinutes ? tx(`დაწოლამდე ${plan.windDownMinutes} წუთით ადრე`, `${plan.windDownMinutes} minutes before bedtime`) : tx('დაწოლის დროს', 'At bedtime')) : tx('გამორთულია', 'Off')}
              right={<NightSwitch value={plan.bedtimeReminder} onValueChange={(v) => set({ bedtimeReminder: v })} />}
            />
            {plan.bedtimeReminder ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {WIND_DOWN.map((m) => (
                  <Pressable key={m} accessibilityRole="radio" accessibilityState={{ selected: plan.windDownMinutes === m }} onPress={() => set({ windDownMinutes: m })} style={{ height: 36, paddingHorizontal: 12, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: plan.windDownMinutes === m ? MOON : c.surfaceRaised }}>
                    <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 12, color: plan.windDownMinutes === m ? '#1B1145' : c.text100 }}>{m === 0 ? tx('დაწოლისას', 'At bedtime') : tx(`${m} წთ ადრე`, `${m} min before`)}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </NightCard>
        </SleepSection>

        <SleepSection title={tx('დილა', 'Morning')}>
          <NightCard style={{ gap: 4 }}>
            <Row
              title={tx('მაღვიძარა ძილის რეჟიმში', 'Alarm in sleep mode')}
              note={sleepAlarmIsSystemAlarm() ? tx('iPhone-ის ნამდვილი მაღვიძარა', 'A real iPhone alarm') : tx('შეტყობინება ხმით', 'A notification with sound')}
              right={<NightSwitch value={plan.alarm} onValueChange={(v) => set({ alarm: v })} />}
            />
            <View style={{ height: 1, backgroundColor: c.bg200 }} />
            <Row
              title={tx('„როგორ გეძინა?“', '“How did you sleep?”')}
              note={tx('დილით, გაღვიძებიდან 45 წუთში', 'In the morning, 45 minutes after waking')}
              right={<NightSwitch value={plan.checkinReminder} onValueChange={(v) => set({ checkinReminder: v })} />}
            />
            <View style={{ height: 1, backgroundColor: c.bg200 }} />
            <Row
              title={tx('ძილის ქულის ჩვენება', 'Show the sleep score')}
              note={tx('ზოგს რიცხვი აღელვებს — შეგიძლია დამალო', 'Some find a number stressful — you can hide it')}
              right={<NightSwitch value={!plan.hideScore} onValueChange={(v) => set({ hideScore: !v })} />}
            />
          </NightCard>
        </SleepSection>

        <View onLayout={(e) => (calcY.current = e.nativeEvent.layout.y - 12)}>
          <SleepSection title={tx('როდის დავწვე?', 'When should I go to bed?')}>
            <NightCard style={{ gap: 14 }}>
              <Pressable accessibilityRole="button" onPress={() => setSheet('calc')} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, color: c.text100 }}>{tx('ხვალ უნდა ავდგე', 'Tomorrow I get up at')}</Text>
                <ClockText value={calcWake} size={24} color={MOON} />
              </Pressable>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {calc.bedtimes.map((b) => (
                  <View key={b.cycles} style={{ flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 16, backgroundColor: c.surfaceRaised, gap: 2 }}>
                    <ClockText value={clockOf(b.bedtime)} size={22} />
                    <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 11, color: c.text300 }}>{tx(`${b.cycles} ციკლი · ${formatDuration(b.sleepMinutes)}`, `${b.cycles} cycles · ${formatDuration(b.sleepMinutes)}`)}</Text>
                  </View>
                ))}
              </View>
              <View style={{ height: 1, backgroundColor: c.bg200 }} />
              <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, color: c.text100 }}>{tx('თუ ახლავე დავწვები, ავდგე', 'If I go to bed now, wake at')}</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {calc.wakeups.map((w) => (
                  <View key={w.cycles} style={{ flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 16, backgroundColor: c.surfaceRaised, gap: 2 }}>
                    <ClockText value={clockOf(w.wake)} size={22} />
                    <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 11, color: c.text300 }}>{tx(`${w.cycles} ციკლი`, `${w.cycles} cycles`)}</Text>
                  </View>
                ))}
              </View>
              <SleepBody muted>{tx('ძილი ~90-წუთიანი ციკლებით მიდის, ჩაძინებას კი ~15 წუთი სჭირდება. ციკლის ბოლოს გაღვიძება უფრო ადვილია. ეს საშუალო მაჩვენებელია და არა გაზომვა.', 'Sleep runs in ~90-minute cycles, and falling asleep takes ~15 minutes. Waking at the end of a cycle feels easier. This is an average, not a measurement.')}</SleepBody>
            </NightCard>
          </SleepSection>
        </View>
      </ScrollView>
      <PinnedFooter bottom={insets.bottom}>
        {error ? <Text style={{ textAlign: 'center', fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 13, color: MOON }}>{error}</Text> : null}
        <MoonButton label={firstTime ? tx('გეგმის დაყენება', 'Set the plan') : tx('შენახვა', 'Save')} onPress={() => void save()} loading={saving} />
      </PinnedFooter>
      <TimePickerSheet
        visible={sheet !== null}
        title={sheet === 'weekend' ? tx('შაბათ-კვირას ვდგები', 'On weekends I get up at') : sheet === 'calc' ? tx('ხვალ ვდგები', 'Tomorrow I get up at') : tx('სამუშაო დღეებში ვდგები', 'On weekdays I get up at')}
        value={sheet === 'weekend' ? plan.weekendWakeTime ?? plan.wakeTime : sheet === 'calc' ? calcWake : plan.wakeTime}
        fill="#9A4FD6"
        quickTimes={['06:00', '06:30', '07:00', '07:30', '08:00', '09:00']}
        onClose={() => setSheet(null)}
        onApply={(time) => {
          if (sheet === 'wake') set({ wakeTime: time });
          else if (sheet === 'weekend') set({ weekendWakeTime: time });
          else if (sheet === 'calc') setCalcWake(time);
          setSheet(null);
        }}
      />
    </View>
  );
}
