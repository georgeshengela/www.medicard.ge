import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Footprints, MessageCircle, Moon } from 'lucide-react-native';
import { ModuleHeader } from '@/components/brand/ModuleHeader';
import { SleepRhythmChart, SleepWaveChart, WeekdayBars } from '@/components/sleep/SleepCharts';
import { MOON, MOON_INK, NightCard, ORCHID, SleepBody, SleepSection, SleepStat } from '@/components/sleep/SleepKit';
import { tx } from '@/i18n/locale';
import { localAccountId } from '@/lib/localAccount';
import { mediPrefillRoute } from '@/lib/mediHandoff';
import { FACTOR_COPY, REGULARITY_COPY, SCORE_BAND_COPY } from '@/lib/sleep/sleepCopy';
import { formatDuration, hhmm, plannedBedtimeMinutes, wakeMinutesFor, ymd } from '@/lib/sleep/sleepTime';
import { useSleepInsights } from '@/lib/sleep/useSleepData';
import { useThemeColors } from '@/theme/colors';

const PERIODS: { days: 7 | 30 | 90; label: string }[] = [
  { days: 7, label: tx('7 დღე', '7 days') },
  { days: 30, label: tx('30 დღე', '30 days') },
  { days: 90, label: tx('90 დღე', '90 days') },
];
const DAY = 86_400_000;

function effectSentence(factor: keyof typeof FACTOR_COPY, slept: number, quality: number | null, nights: number): string {
  const name = FACTOR_COPY[factor].label;
  const s = Math.abs(slept);
  const sleptPart = s >= 15 ? (slept < 0 ? tx(`${formatDuration(s)}-ით ნაკლები გძინავს`, `you sleep ${formatDuration(s)} less`) : tx(`${formatDuration(s)}-ით მეტი გძინავს`, `you sleep ${formatDuration(s)} more`)) : null;
  const qPart = quality != null && Math.abs(quality) >= 0.5 ? (quality < 0 ? tx('და ძილს უარესად აფასებ', 'and you rate the night lower') : tx('და ძილს უკეთ აფასებ', 'and you rate the night higher')) : null;
  return tx(`„${name}“ — ასეთ ღამეებში ${[sleptPart, qPart].filter(Boolean).join(' ')} (${nights} ღამე).`, `“${name}” — on those nights ${[sleptPart, qPart].filter(Boolean).join(' ')} (${nights} nights).`);
}

/** MEDISLEEP analytics: score, length, rhythm, debt, social jetlag, what affects her sleep, weekdays. */
export default function SleepInsightsScreen() {
  const c = useThemeColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const q = useSleepInsights(days);
  const data = q.data;
  const s = data?.summary;
  const plan = data?.plan ?? null;

  const points = useMemo(() => {
    if (!data) return [];
    const byNight = new Map(data.nights.map((n) => [n.night, n.sleptMinutes]));
    const end = Date.parse(`${data.today}T12:00:00`);
    return Array.from({ length: days }, (_, i) => {
      const night = ymd(new Date(end - (days - 1 - i) * DAY));
      return { night, minutes: byNight.get(night) ?? null };
    });
  }, [data, days]);
  const lastWeek = useMemo(() => (data ? Array.from({ length: 7 }, (_, i) => ymd(new Date(Date.parse(`${data.today}T12:00:00`) - (6 - i) * DAY))) : []), [data]);
  const tomorrow = new Date(Date.now() + DAY);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg100 }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: insets.bottom + 60, gap: 26 }}>
        <ModuleHeader module="sleep" subtitle={tx('ძილის ანალიტიკა', 'Sleep analytics')} fallbackHref="/sleep" />
        <View style={{ flexDirection: 'row', backgroundColor: c.surface, borderRadius: 18, padding: 4 }}>
          {PERIODS.map((p) => {
            const on = days === p.days;
            return (
              <Pressable key={p.days} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => setDays(p.days)} style={{ flex: 1, height: 38, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? MOON : 'transparent' }}>
                <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 13, color: on ? MOON_INK : c.text200 }}>{p.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {!s ? (
          <ActivityIndicator color={ORCHID} style={{ marginTop: 40 }} />
        ) : !s.nightsLogged ? (
          <NightCard style={{ gap: 6 }}>
            <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 15, color: c.text100 }}>{tx('ამ პერიოდში ღამე ჯერ არ არის', 'No nights in this period yet')}</Text>
            <SleepBody>{tx('ჩართე ძილის რეჟიმი ან ჩაწერე ღამე — ანალიტიკა პირველივე ღამიდან დაიწყება.', 'Turn on sleep mode or log a night — analytics start from the first night.')}</SleepBody>
          </NightCard>
        ) : (
          <>
            {!plan?.hideScore && s.score != null && s.scoreBand ? (
              <NightCard style={{ gap: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
                  <Text style={{ fontWeight: '200', fontSize: 54, lineHeight: 60, color: c.text100, fontVariant: ['tabular-nums'] }}>{s.score}</Text>
                  <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 16, color: MOON }}>{SCORE_BAND_COPY[s.scoreBand]}</Text>
                </View>
                <SleepBody>
                  {tx('ძილის ქულა: ხანგრძლივობა შენს მიზანთან (50%), რიტმი — რამდენად ერთსა და იმავე დროს გძინავს (30%) და დილის შენი შეფასება (20%). ფაზებს ტელეფონი ვერ ზომავს, ამიტომ ქულაში არ შედის.', 'Sleep score: length against your goal (50%), rhythm — how steady your sleep time is (30%) and your morning rating (20%). A phone cannot measure stages, so they are not part of it.')}
                </SleepBody>
              </NightCard>
            ) : null}

            <SleepSection title={tx('ძილის ხანგრძლივობა', 'Sleep length')}>
              <NightCard>
                <SleepWaveChart points={points} goalMinutes={s.goalMinutes} />
              </NightCard>
            </SleepSection>

            <SleepSection title={tx('რიტმი · ბოლო 7 ღამე', 'Rhythm · last 7 nights')}>
              <NightCard style={{ gap: 10 }}>
                <SleepRhythmChart
                  days={lastWeek}
                  nights={data!.nights}
                  plannedBed={plan ? plannedBedtimeMinutes(plan, tomorrow) : null}
                  plannedWake={plan ? wakeMinutesFor(plan, tomorrow) : null}
                  goalMinutes={s.goalMinutes}
                />
                {s.regularity.band ? <SleepBody>{REGULARITY_COPY[s.regularity.band].note}</SleepBody> : null}
              </NightCard>
            </SleepSection>

            <SleepSection title={tx('მთავარი ციფრები', 'Key numbers')}>
              <NightCard style={{ gap: 18 }}>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <SleepStat value={formatDuration(s.avgSleptMinutes)} label={tx('საშუალოდ ღამეში', 'Average a night')} />
                  <SleepStat value={`${s.nightsOnGoal}/${s.nightsLogged}`} label={tx('ღამე მიზანზე', 'Nights on goal')} />
                  <SleepStat value={s.debtMinutes != null ? formatDuration(s.debtMinutes) : '—'} label={tx('დეფიციტი (7 ღამე)', 'Debt (7 nights)')} tone={s.debtMinutes && s.debtMinutes > 180 ? MOON : undefined} />
                </View>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <SleepStat value={s.avgBedtime != null ? hhmm(s.avgBedtime) : '—'} label={tx('საშუალო დაწოლა', 'Average bedtime')} />
                  <SleepStat value={s.avgWake != null ? hhmm(s.avgWake) : '—'} label={tx('საშუალო ადგომა', 'Average wake-up')} />
                  <SleepStat value={s.regularity.spreadMinutes != null ? `±${s.regularity.spreadMinutes}′` : '—'} label={tx('რიტმის რყევა', 'Rhythm spread')} />
                </View>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <SleepStat value={s.avgQuality != null ? `${s.avgQuality}/5` : '—'} label={tx('დილის შეფასება', 'Morning rating')} />
                  <SleepStat value={s.avgLatencyMinutes != null ? formatDuration(s.avgLatencyMinutes) : '—'} label={tx('ჩაძინებას სჭირდება', 'To fall asleep')} />
                  <SleepStat value={s.avgWakeups != null ? String(s.avgWakeups) : '—'} label={tx('ღამის გაღვიძება', 'Night wake-ups')} />
                </View>
                {s.socialJetlagMinutes != null && s.socialJetlagMinutes >= 45 ? (
                  <SleepBody>
                    {tx(`შაბათ-კვირას ძილს საშუალოდ ${formatDuration(s.socialJetlagMinutes)}-ით წევ. ორშაბათს სხეული ისე გრძნობს თავს, თითქოს სხვა საათობრივ სარტყელში იყავი.`, `On weekends your sleep shifts by ${formatDuration(s.socialJetlagMinutes)} on average. On Monday your body feels like it changed time zones.`)}
                  </SleepBody>
                ) : null}
                {s.previousAvgSleptMinutes != null && s.avgSleptMinutes != null && Math.abs(s.avgSleptMinutes - s.previousAvgSleptMinutes) >= 10 ? (
                  <SleepBody>
                    {s.avgSleptMinutes > s.previousAvgSleptMinutes
                      ? tx(`წინა პერიოდზე ${formatDuration(s.avgSleptMinutes - s.previousAvgSleptMinutes)}-ით მეტი გძინავს.`, `You sleep ${formatDuration(s.avgSleptMinutes - s.previousAvgSleptMinutes)} more than the period before.`)
                      : tx(`წინა პერიოდზე ${formatDuration(s.previousAvgSleptMinutes - s.avgSleptMinutes)}-ით ნაკლები გძინავს.`, `You sleep ${formatDuration(s.previousAvgSleptMinutes - s.avgSleptMinutes)} less than the period before.`)}
                  </SleepBody>
                ) : null}
              </NightCard>
            </SleepSection>

            <SleepSection title={tx('რა მოქმედებს შენს ძილზე', 'What affects your sleep')}>
              <NightCard style={{ gap: 14 }}>
                {s.factorEffects.length ? (
                  s.factorEffects.slice(0, 5).map((e) => {
                    const Icon = FACTOR_COPY[e.factor].icon;
                    return (
                      <View key={e.factor} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                        <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(217,168,255,0.14)', alignItems: 'center', justifyContent: 'center' }}>
                          <Icon size={18} color={ORCHID} />
                        </View>
                        <Text style={{ flex: 1, fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 14, lineHeight: 21, color: c.text100 }}>{effectSentence(e.factor, e.sleptDiff, e.qualityDiff, e.nightsWith)}</Text>
                      </View>
                    );
                  })
                ) : (
                  <SleepBody>{tx('როცა დილის შეფასებაში ფაქტორებს აღნიშნავ (ყავა, სტრესი, ეკრანი…), აქ გამოჩნდება, რომელი მოქმედებს სწორედ შენზე. საჭიროა სულ მცირე 3 ღამე ფაქტორით და 3 — მის გარეშე.', 'When you tick factors in the morning check-in (coffee, stress, screens…), this shows which ones affect you. It needs at least 3 nights with a factor and 3 without.')}</SleepBody>
                )}
                {s.stepsEffect && Math.abs(s.stepsEffect.sleptDiff) >= 10 ? (
                  <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                    <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(244,227,181,0.14)', alignItems: 'center', justifyContent: 'center' }}>
                      <Footprints size={18} color={MOON} />
                    </View>
                    <Text style={{ flex: 1, fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 14, lineHeight: 21, color: c.text100 }}>
                      {s.stepsEffect.sleptDiff > 0
                        ? tx(`${s.stepsEffect.stepsCut.toLocaleString()}+ ნაბიჯის დღის შემდეგ ${formatDuration(s.stepsEffect.sleptDiff)}-ით მეტი გძინავს.`, `After a day of ${s.stepsEffect.stepsCut.toLocaleString()}+ steps you sleep ${formatDuration(s.stepsEffect.sleptDiff)} longer.`)
                        : tx(`აქტიური დღის შემდეგ ${formatDuration(-s.stepsEffect.sleptDiff)}-ით ნაკლები გძინავს — სცადე ვარჯიში საღამოს ადრე.`, `After an active day you sleep ${formatDuration(-s.stepsEffect.sleptDiff)} less — try exercising earlier in the evening.`)}
                    </Text>
                  </View>
                ) : null}
                {s.bestBedtime ? (
                  <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                    <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(244,227,181,0.14)', alignItems: 'center', justifyContent: 'center' }}>
                      <Moon size={18} color={MOON} />
                    </View>
                    <Text style={{ flex: 1, fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 14, lineHeight: 21, color: c.text100 }}>
                      {tx(`საუკეთესოდ გძინავს, როცა დაახლოებით ${hhmm(s.bestBedtime.bedtime)}-ზე წვები (${s.bestBedtime.nights} კარგი ღამე).`, `You sleep best when you go to bed around ${hhmm(s.bestBedtime.bedtime)} (${s.bestBedtime.nights} good nights).`)}
                    </Text>
                  </View>
                ) : null}
              </NightCard>
            </SleepSection>

            <SleepSection title={tx('კვირის დღეების მიხედვით', 'By day of the week')}>
              <NightCard>
                <WeekdayBars weekday={s.weekday} goalMinutes={s.goalMinutes} />
              </NightCard>
            </SleepSection>

            <Pressable
              accessibilityRole="button"
              onPress={() => router.push(mediPrefillRoute(localAccountId(), tx('გადახედე ჩემს ძილს ბოლო კვირებში და მითხარი, რა გავაუმჯობესო.', 'Look at my sleep over the last weeks and tell me what to improve.')) as never)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 22, backgroundColor: c.surface }}
            >
              <MessageCircle size={20} color={ORCHID} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 14, color: c.text100 }}>{tx('Medi-სთან ერთად გადახედე', 'Review it with Medi')}</Text>
                <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 12, color: c.text300 }}>{tx('Medi ხედავს შენს ღამეებს და გეგმას', 'Medi sees your nights and your plan')}</Text>
              </View>
            </Pressable>
            <SleepBody muted>{tx('ეს შენი ჩანაწერებია და არა დიაგნოზი. თუ კვირებია ცუდად გძინავს, ხვრინავ ან დღისით გეძინება, ექიმს მიმართე.', 'These are your own records, not a diagnosis. If you have slept badly for weeks, snore or feel sleepy in the day, see a doctor.')}</SleepBody>
          </>
        )}
      </ScrollView>
    </View>
  );
}
