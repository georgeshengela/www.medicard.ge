import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { MoonStar } from 'lucide-react-native';
import { HomeSectionHeading } from '@/components/home/HomeSectionHeading';
import { QualityMoon } from '@/components/sleep/SleepKit';
import { tx } from '@/i18n/locale';
import { QUALITY_COPY } from '@/lib/sleep/sleepCopy';
import { useSleepSession } from '@/lib/sleep/sleepSession';
import { clockOf, dayPhase, formatDuration, formatHoursCompact, hhmm, plannedBedtimeMinutes, tonight, wakeMinutesFor } from '@/lib/sleep/sleepTime';
import type { SleepHub } from '@/lib/sleep/sleepTypes';
import { HUB } from '@/theme/hub';
import { MODULE_BRANDS, moduleInk } from '@/theme/moduleBrand';
import { useIsDark, useThemeColors } from '@/theme/colors';

/**
 * MEDISLEEP on Home (one compact card, no second spotlight): the evening leads with tonight's bedtime and a
 * one-tap „ძილის რეჟიმი“; the morning and the day with last night and „შეაფასე“; no plan yet → set one.
 * The hub query is read once in home.tsx and passed down (Home's one-subscriber rule).
 */
export function HomeSleep({ hub }: { hub: SleepHub | undefined }) {
  const c = useThemeColors();
  const dark = useIsDark();
  const router = useRouter();
  const session = useSleepSession();
  if (!hub) return null;
  const now = new Date();
  const ink = moduleInk('sleep', dark);
  const plan = hub.plan;
  const phase = dayPhase(plan, now);
  const last = [...hub.nights].sort((a, b) => b.night.localeCompare(a.night))[0];
  const lastIsRecent = last && last.night >= new Date(Date.now() - 36 * 3600_000).toISOString().slice(0, 10);

  let title: string;
  let line: string;
  let action: { label: string; href: string; icon?: boolean } | null = null;
  if (session) {
    title = tx('ძილის რეჟიმი ჩართულია', 'Sleep mode is on');
    line = session.alarmAt ? tx(`მაღვიძარა ${clockOf(new Date(session.alarmAt))}`, `Alarm ${clockOf(new Date(session.alarmAt))}`) : tx('მაღვიძარის გარეშე', 'No alarm');
    action = { label: tx('გახსნა', 'Open'), href: '/sleep/night' };
  } else if (!plan) {
    title = tx('ძილის გეგმა', 'Sleep plan');
    line = tx('დროული დაწოლა, ხმები და დილის მაღვიძარა', 'An on-time bedtime, sounds and a wake-up alarm');
    action = { label: tx('დაყენება', 'Set up'), href: '/sleep/plan?setup=1' };
  } else if (phase === 'evening' || phase === 'night') {
    const t = tonight(plan, now);
    title = tx(`დაწოლა ${clockOf(t.bedtime)}-ზე`, `Bedtime ${clockOf(t.bedtime)}`);
    line = tx(`ადგომა ${clockOf(t.wake)}`, `Up at ${clockOf(t.wake)}`) + (lastIsRecent && last.sleptMinutes ? tx(` · ბოლო ღამე ${formatHoursCompact(last.sleptMinutes)}`, ` · last night ${formatHoursCompact(last.sleptMinutes)}`) : '');
    action = { label: tx('ძილის რეჟიმი', 'Sleep mode'), href: '/sleep/night', icon: true };
  } else if (lastIsRecent && last.sleptMinutes) {
    title = tx(`ბოლო ღამე ${formatDuration(last.sleptMinutes)}`, `Last night ${formatDuration(last.sleptMinutes)}`);
    const bed = hhmm(plannedBedtimeMinutes(plan, new Date(now.getTime() + 18 * 3600_000)));
    line = last.quality ? QUALITY_COPY[last.quality] : tx(`ამაღამ დაწოლა ${bed}`, `Bedtime tonight ${bed}`);
    if (!last.checkedIn) action = { label: tx('შეაფასე', 'Rate it'), href: `/sleep/checkin?night=${last.night}` };
  } else {
    const wake = hhmm(wakeMinutesFor(plan, now));
    title = tx('როგორ გეძინა?', 'How did you sleep?');
    line = tx(`გეგმა: ადგომა ${wake}`, `Plan: up at ${wake}`);
    action = { label: tx('ჩაწერა', 'Log it'), href: '/sleep/log' };
  }

  const g = MODULE_BRANDS.sleep.gradient;
  return (
    <View style={s.section}>
      <HomeSectionHeading title="MEDISLEEP" brand="sleep" linkLabel={tx('ძილი', 'Sleep')} onLink={() => router.push('/sleep' as never)} />
      <View style={[s.card, { backgroundColor: c.surface }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={`MEDISLEEP. ${title}. ${line}`} onPress={() => router.push('/sleep' as never)} style={s.main}>
        <LinearGradient colors={[g[0], g[1]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.tile}>
          <QualityMoon level={last?.quality && lastIsRecent ? last.quality : 2} size={24} dim="rgba(255,255,255,0.18)" />
        </LinearGradient>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={[s.title, { color: c.text100 }]}>{title}</Text>
          <Text numberOfLines={1} style={[s.line, { color: c.text200 }]}>{line}</Text>
        </View>
        </Pressable>
        {action ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push(action!.href as never)}
            hitSlop={6}
            accessibilityLabel={action.label}
            style={[action.icon ? s.round : s.pill, { backgroundColor: `${ink}${dark ? '2E' : '1A'}` }]}
          >
            {action.icon ? <MoonStar size={20} color={ink} /> : <Text numberOfLines={1} style={[s.pillText, { color: ink }]}>{action.label}</Text>}
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  section: { paddingHorizontal: HUB.gutter, marginTop: HUB.sectionGap },
  card: { borderRadius: HUB.cardRadius, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  main: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12 },
  tile: { width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 15, lineHeight: 21 },
  line: { fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 12, lineHeight: 17 },
  pill: { height: 34, paddingHorizontal: 12, borderRadius: 17, alignItems: 'center', justifyContent: 'center', maxWidth: 130 },
  pillText: { fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 12 },
  round: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
});
