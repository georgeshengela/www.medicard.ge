import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Circle } from 'react-native-svg';
import { AudioLines, Calculator, ChevronRight, MoonStar, PenLine, Sparkles, Wind } from 'lucide-react-native';
import { tx } from '@/i18n/locale';
import { FACTOR_COPY, QUALITY_COPY, REGULARITY_COPY, SCORE_BAND_COPY, SOURCE_COPY } from '@/lib/sleep/sleepCopy';
import { clockOf, formatDuration, formatHoursCompact } from '@/lib/sleep/sleepTime';
import type { SleepHub, SleepNight, SleepPlan, SleepSound } from '@/lib/sleep/sleepTypes';
import { useThemeColors } from '@/theme/colors';
import { NightSky } from './NightSky';
import { SleepDial } from './SleepDial';
import { SleepRhythmChart } from './SleepCharts';
import { ClockText, GhostButton, MOON, MoonButton, NightCard, ORCHID, QualityMoon, SleepBody, SleepDuration, SleepSection, SleepStat, StageBar } from './SleepKit';
import { SoundCard } from './SleepSounds';

/** Tonight: the dial on the night sky, the plan in words, „ძილის რეჟიმი“. The hub's one spotlight. */
export function TonightHero({
  plan,
  suggested,
  bedtime,
  wake,
  onDraft,
  onCommit,
  onStart,
  onSetup,
  onSounds,
  basisNote,
}: {
  plan: SleepPlan | null;
  suggested: SleepPlan;
  bedtime: number;
  wake: number;
  onDraft: (next: { bedtime: number; wake: number }) => void;
  onCommit: (next: { bedtime: number; wake: number }) => void;
  onStart: () => void;
  onSetup: () => void;
  onSounds: () => void;
  basisNote: string | null;
}) {
  const goal = (plan ?? suggested).goalMinutes;
  return (
    <View style={{ borderRadius: 28, overflow: 'hidden', paddingTop: 18, paddingBottom: 18, paddingHorizontal: 18 }}>
      <NightSky seed={11} />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 15, lineHeight: 22, color: '#FFFFFF' }}>{tx('ამაღამ', 'Tonight')}</Text>
        <View style={{ paddingHorizontal: 10, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.12)', justifyContent: 'center' }}>
          <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 12, color: '#FFFFFF' }}>{tx(`მიზანი ${formatDuration(goal)}`, `Goal ${formatDuration(goal)}`)}</Text>
        </View>
      </View>
      <SleepDial bedtime={bedtime} wake={wake} onChange={onDraft} onCommit={onCommit} sleepMinutes={Math.max(0, ((((wake - bedtime) % 1440) + 1440) % 1440) - 15)} />
      <Text style={{ textAlign: 'center', fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 12, lineHeight: 18, color: 'rgba(255,255,255,0.7)', marginTop: 2, marginBottom: 14 }}>
        {plan
          ? tx('გადაათრიე მთვარე ან მზე, რომ დრო შეცვალო', 'Drag the moon or the sun to change the times')
          : basisNote ?? tx('ეს შენი ასაკისთვის რეკომენდებული ძილია', 'This is the sleep recommended for your age')}
      </Text>
      {plan ? (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <MoonButton label={tx('ძილის რეჟიმი', 'Sleep mode')} icon={MoonStar} onPress={onStart} style={{ flex: 1 }} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={tx('ხმები', 'Sounds')}
            onPress={onSounds}
            style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}
          >
            <AudioLines size={22} color="#FFFFFF" />
          </Pressable>
        </View>
      ) : (
        <MoonButton label={tx('ძილის გეგმის დაყენება', 'Set my sleep plan')} icon={Sparkles} onPress={onSetup} />
      )}
    </View>
  );
}

/** Sleep mode is running (she opened the app at night or left it on): back to the night screen. */
export function SessionBanner({ startedAt, alarmAt, onOpen }: { startedAt: number; alarmAt: number | null; onOpen: () => void }) {
  const c = useThemeColors();
  const minutes = Math.round((Date.now() - startedAt) / 60_000);
  return (
    <Pressable accessibilityRole="button" onPress={onOpen} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 20, backgroundColor: c.surfaceRaised }}>
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(244,227,181,0.16)', alignItems: 'center', justifyContent: 'center' }}>
        <MoonStar size={20} color={MOON} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 14, lineHeight: 20, color: c.text100 }}>{tx('ძილის რეჟიმი ჩართულია', 'Sleep mode is on')}</Text>
        <Text numberOfLines={1} style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 12, lineHeight: 17, color: c.text300 }}>
          {formatDuration(minutes)}{alarmAt ? tx(` · მაღვიძარა ${clockOf(new Date(alarmAt))}`, ` · alarm ${clockOf(new Date(alarmAt))}`) : ''}
        </Text>
      </View>
      <ChevronRight size={18} color={c.text300} />
    </Pressable>
  );
}

/** „როგორ გეძინა?“ — five moons, one tap opens the check-in with that answer chosen. */
export function CheckinQuick({ night, onPick }: { night: string; onPick: (quality: number) => void }) {
  const c = useThemeColors();
  return (
    <NightCard style={{ gap: 14 }}>
      <View style={{ gap: 2 }}>
        <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 16, lineHeight: 23, color: c.text100 }}>{tx('როგორ გეძინა?', 'How did you sleep?')}</Text>
        <SleepBody muted>{tx('ერთი შეხება — და კვირის ბოლოს დაინახავ, რა მოქმედებს შენს ძილზე.', 'One tap — and by the end of the week you will see what affects your sleep.')}</SleepBody>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }} accessibilityLabel={night}>
        {[1, 2, 3, 4, 5].map((q) => (
          <Pressable key={q} accessibilityRole="button" accessibilityLabel={QUALITY_COPY[q]} onPress={() => onPick(q)} style={{ alignItems: 'center', gap: 6, flex: 1 }}>
            <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: c.surfaceRaised, alignItems: 'center', justifyContent: 'center' }}>
              <QualityMoon level={q} size={30} />
            </View>
            <Text numberOfLines={2} style={{ textAlign: 'center', fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 10, lineHeight: 13, color: c.text300 }}>{QUALITY_COPY[q]}</Text>
          </Pressable>
        ))}
      </View>
    </NightCard>
  );
}

/** Last night in one card: how long, from when to when, how it felt, stages when Health had them. */
export function LastNightCard({ night, goalMinutes, onEdit, onRate }: { night: SleepNight; goalMinutes: number; onEdit: () => void; onRate: () => void }) {
  const c = useThemeColors();
  const slept = night.sleptMinutes;
  const diff = slept != null ? slept - goalMinutes : null;
  return (
    <NightCard style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <View style={{ gap: 4, flexShrink: 1 }}>
          <SleepDuration minutes={slept} size={40} />
          {night.bedAt && night.wakeAt ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <ClockText value={clockOf(new Date(night.bedAt))} size={15} color={c.text200} />
              <Text style={{ color: c.text300 }}>→</Text>
              <ClockText value={clockOf(new Date(night.wakeAt))} size={15} color={c.text200} />
            </View>
          ) : null}
        </View>
        {night.quality ? (
          <View style={{ alignItems: 'center', gap: 4 }}>
            <QualityMoon level={night.quality} size={34} />
            <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 11, color: c.text200 }}>{QUALITY_COPY[night.quality]}</Text>
          </View>
        ) : (
          <Pressable accessibilityRole="button" onPress={onRate} style={{ paddingHorizontal: 12, height: 34, borderRadius: 17, backgroundColor: 'rgba(244,227,181,0.14)', justifyContent: 'center' }}>
            <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 12, color: MOON }}>{tx('შეაფასე', 'Rate it')}</Text>
          </Pressable>
        )}
      </View>
      {diff != null ? (
        <SleepBody>
          {Math.abs(diff) < 15
            ? tx('ზუსტად შენი მიზანი.', 'Right on your goal.')
            : diff > 0
              ? tx(`მიზანზე ${formatDuration(diff)}-ით მეტი.`, `${formatDuration(diff)} more than your goal.`)
              : tx(`მიზანს ${formatDuration(-diff)} აკლდა.`, `${formatDuration(-diff)} short of your goal.`)}
          {night.asleepMinutes == null && night.inBedMinutes ? tx(' ეს საწოლში გატარებული დროა.', ' This is time in bed.') : ''}
        </SleepBody>
      ) : null}
      {night.stages ? <StageBar stages={night.stages} /> : null}
      {night.factors.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {night.factors.map((f) => {
            const Icon = FACTOR_COPY[f].icon;
            return (
              <View key={f} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, height: 28, borderRadius: 14, backgroundColor: c.surfaceRaised }}>
                <Icon size={13} color={c.text200} />
                <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 11, color: c.text200 }}>{FACTOR_COPY[f].label}</Text>
              </View>
            );
          })}
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 11, color: c.text300 }}>{SOURCE_COPY[night.timesSource]}</Text>
        <Pressable accessibilityRole="button" onPress={onEdit} hitSlop={10} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <PenLine size={13} color={ORCHID} />
          <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 12, color: ORCHID }}>{tx('შესწორება', 'Edit')}</Text>
        </Pressable>
      </View>
    </NightCard>
  );
}

/** A horizontal shelf of sounds (featured first). */
export function SoundShelf({ sounds }: { sounds: SleepSound[] }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingHorizontal: 20 }} style={{ marginHorizontal: -20 }}>
      {sounds.map((s) => (
        <SoundCard key={s.id} sound={s} />
      ))}
    </ScrollView>
  );
}

/** The week: the rhythm chart and three numbers that matter (average, rhythm, debt), plus the score. */
export function WeekCard({ hub, days, plannedBed, plannedWake, onOpen }: { hub: SleepHub; days: string[]; plannedBed: number | null; plannedWake: number | null; onOpen: () => void }) {
  const c = useThemeColors();
  const s = hub.summary;
  const showScore = !hub.plan?.hideScore && s.score != null;
  return (
    <NightCard onPress={onOpen} accessibilityLabel={tx('ძილის ანალიტიკა', 'Sleep analytics')} style={{ gap: 16 }}>
      {showScore ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <ScoreRing score={s.score!} />
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 15, lineHeight: 22, color: c.text100 }}>
              {tx('კვირის ძილი', "This week's sleep")}: {SCORE_BAND_COPY[s.scoreBand!]}
            </Text>
            <SleepBody muted>{tx('ხანგრძლივობა, რიტმი და შენი დილის შეფასება.', 'Length, rhythm and how rested you felt.')}</SleepBody>
          </View>
          <ChevronRight size={18} color={c.text300} />
        </View>
      ) : null}
      <SleepRhythmChart days={days} nights={hub.nights} plannedBed={plannedBed} plannedWake={plannedWake} goalMinutes={s.goalMinutes} height={190} />
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <SleepStat value={s.avgSleptMinutes != null ? formatHoursCompact(s.avgSleptMinutes) : '—'} label={tx('საშუალოდ ღამეში', 'Average a night')} />
        <SleepStat
          value={s.regularity.spreadMinutes != null ? `±${s.regularity.spreadMinutes}′` : '—'}
          label={s.regularity.band ? REGULARITY_COPY[s.regularity.band].label : tx('რიტმი (3 ღამიდან)', 'Rhythm (from 3 nights)')}
        />
        <SleepStat value={s.debtMinutes != null ? formatHoursCompact(s.debtMinutes) : '—'} label={tx('ძილის დეფიციტი', 'Sleep debt')} tone={s.debtMinutes && s.debtMinutes > 180 ? MOON : undefined} />
      </View>
    </NightCard>
  );
}

function ScoreRing({ score }: { score: number }) {
  const size = 58;
  const stroke = 6;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.1)" strokeWidth={stroke} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={MOON} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={`${(score / 100) * circ} ${circ}`} />
      </Svg>
      <Text style={{ fontWeight: '300', fontSize: 20, color: '#FFFFFF', fontVariant: ['tabular-nums'] }}>{score}</Text>
    </View>
  );
}

/** Small tools: breathing, the cycle calculator, a hand entry. */
export function SleepTools({ breathing }: { breathing: boolean }) {
  const router = useRouter();
  const c = useThemeColors();
  const tools = [
    breathing ? { key: 'breathe', icon: Wind, title: tx('სუნთქვა', 'Breathing'), note: tx('4-7-8 და მშვიდი ამოსუნთქვა', '4-7-8 and a slow exhale'), href: '/sleep/breathe' } : null,
    { key: 'calc', icon: Calculator, title: tx('როდის დავწვე?', 'When to sleep?'), note: tx('90-წუთიანი ციკლებით', 'By 90-minute cycles'), href: '/sleep/plan?calc=1' },
    { key: 'log', icon: PenLine, title: tx('ღამის ჩაწერა', 'Log a night'), note: tx('ხელით, თუ რეჟიმი არ ჩართე', "By hand, if sleep mode wasn't on"), href: '/sleep/log' },
  ].filter(Boolean) as { key: string; icon: typeof Wind; title: string; note: string; href: string }[];
  return (
    <View style={{ gap: 10 }}>
      {tools.map((t) => {
        const Icon = t.icon;
        return (
          <Pressable key={t.key} accessibilityRole="button" onPress={() => router.push(t.href as never)} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 20, backgroundColor: c.surface }}>
            <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: 'rgba(217,168,255,0.14)', alignItems: 'center', justifyContent: 'center' }}>
              <Icon size={20} color={ORCHID} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, lineHeight: 20, color: c.text100 }}>{t.title}</Text>
              <Text numberOfLines={1} style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 12, lineHeight: 17, color: c.text300 }}>{t.note}</Text>
            </View>
            <ChevronRight size={18} color={c.text300} />
          </Pressable>
        );
      })}
    </View>
  );
}

export { SleepSection };
