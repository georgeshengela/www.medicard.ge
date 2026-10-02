import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Droplets, Footprints, Plus } from 'lucide-react-native';
import { HomeSectionHeading } from '@/components/home/HomeSectionHeading';
import { MedicalSourcesLink } from '@/components/health/MedicalSourcesLink';
import type { useHydration } from '@/hooks/useHydration';
import type { useStepsMetrics } from '@/hooks/useStepsMetrics';
import { HYDRATION_DROP_ML } from '@/types/hydration';
import { tx } from '@/i18n/locale';
import { useHomeAccent } from '@/theme/homeAccent';
import { HUB, hubText } from '@/theme/hub';
import { useIsDark, useThemeColors } from '@/theme/colors';

const groupDigits = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const liters = (ml: number) => (ml / 1000).toFixed(1);

type Props = {
  steps: ReturnType<typeof useStepsMetrics>;
  hydration: ReturnType<typeof useHydration>;
  onAddWater: () => void;
  stepsOn: boolean;
  waterOn: boolean;
  title: string;
  linkLabel: string;
  linkHref: string;
};

/**
 * Steps and water side by side (women's „შენი დღე“, nutrition & weight „წყალი და ნაბიჯები“).
 * Data comes from the Home root hooks — no second subscriber. A paused module's tile leaves and
 * the other one takes the full width; both paused → nothing.
 */
export function HomeDayPair({ steps, hydration, onAddWater, stepsOn, waterOn, title, linkLabel, linkHref }: Props) {
  const c = useThemeColors();
  const dark = useIsDark();
  const accent = useHomeAccent();
  const router = useRouter();
  if (!stepsOn && !waterOn) return null;

  const water = dark ? '#60A5FA' : '#2563EB';
  const total = steps.bundle?.todayTotal ?? 0;
  const goal = steps.bundle?.goal ?? 0;
  const stepsReady = Boolean(steps.bundle);

  return (
    <View style={s.section}>
      <HomeSectionHeading title={title} linkLabel={linkLabel} onLink={() => router.push(linkHref as never)} />
      <View style={s.row}>
        {stepsOn ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              stepsReady
                ? tx(`ნაბიჯები: ${groupDigits(total)}, მიზანი ${groupDigits(goal)}`, `Steps: ${groupDigits(total)}, goal ${groupDigits(goal)}`)
                : tx('ნაბიჯები', 'Steps')
            }
            onPress={() => router.push('/health-metrics/steps' as never)}
            style={[s.tile, { backgroundColor: c.surface }]}
          >
            <View style={[s.icon, { backgroundColor: accent.tint }]}>
              <Footprints size={21} color={accent.ink} strokeWidth={1.8} />
            </View>
            <View>
              <Text numberOfLines={1} style={[s.value, { color: c.text100 }]}>
                {steps.loading && !stepsReady ? '…' : groupDigits(total)}
              </Text>
              <Text style={[hubText.caption, { color: c.text200 }]}>{tx('ნაბიჯი', 'steps')}</Text>
            </View>
            <Bar progress={goal > 0 ? total / goal : 0} color={accent.ink} track={c.bg200} />
            <Text numberOfLines={1} style={[hubText.small, { color: c.text200 }]}>
              {goal > 0 ? tx(`მიზანი ${groupDigits(goal)}`, `Goal ${groupDigits(goal)}`) : tx('დააკავშირე მოწყობილობა', 'Connect a device')}
            </Text>
          </Pressable>
        ) : null}
        {waterOn ? (
          <View style={[s.tile, { backgroundColor: c.surface }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={tx(
                `წყალი: ${liters(hydration.todayMl)} ლიტრი ${liters(hydration.goalMl)}-დან`,
                `Water: ${liters(hydration.todayMl)} of ${liters(hydration.goalMl)} litres`,
              )}
              onPress={() => router.push('/health-metrics/hydration' as never)}
              style={s.tileMain}
            >
              <View style={[s.icon, { backgroundColor: `${water}${dark ? '26' : '14'}` }]}>
                <Droplets size={21} color={water} strokeWidth={1.8} />
              </View>
              <View>
                <Text numberOfLines={1} style={[s.value, { color: c.text100 }]}>
                  {hydration.loading ? '…' : `${liters(hydration.todayMl)} / ${liters(hydration.goalMl)} ${tx('ლ', 'L')}`}
                </Text>
                <Text style={[hubText.caption, { color: c.text200 }]}>{tx('წყალი', 'water')}</Text>
              </View>
              <Bar progress={hydration.progress} color={dark ? '#60A5FA' : '#3B82F6'} track={c.bg200} />
              <Text numberOfLines={1} style={[hubText.small, { color: c.text200 }]}>
                {hydration.loading
                  ? ' '
                  : hydration.remainingMl > 0
                    ? tx(`დარჩა ${liters(hydration.remainingMl)} ლ`, `${liters(hydration.remainingMl)} L to go`)
                    : tx('მიზანი შესრულდა', 'Goal reached')}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={tx(`წყლის დამატება, ${HYDRATION_DROP_ML} მლ`, `Add water, ${HYDRATION_DROP_ML} ml`)}
              hitSlop={6}
              onPress={onAddWater}
              style={[s.plus, { backgroundColor: dark ? '#1E3A5F' : '#DBEAFE' }]}
            >
              <Plus size={17} color={water} strokeWidth={2.4} />
            </Pressable>
          </View>
        ) : null}
      </View>
      <MedicalSourcesLink sourceIds={[...(stepsOn ? ['dailySteps' as const] : []), ...(waterOn ? ['waterIntake' as const] : [])]} />
    </View>
  );
}

function Bar({ progress, color, track }: { progress: number; color: string; track: string }) {
  const pct = Math.round(Math.min(1, Math.max(0, progress)) * 100);
  return (
    <View style={[s.track, { backgroundColor: track }]}>
      <View style={[s.fill, { width: `${pct}%`, backgroundColor: color }]} />
    </View>
  );
}

const s = StyleSheet.create({
  section: { paddingHorizontal: HUB.gutter, marginTop: HUB.sectionGap },
  row: { flexDirection: 'row', gap: 12 },
  tile: { flex: 1, minWidth: 0, borderRadius: HUB.cardRadius, padding: 16, gap: 10 },
  tileMain: { gap: 10 },
  icon: { width: HUB.tile, height: HUB.tile, borderRadius: HUB.tileRadius, alignItems: 'center', justifyContent: 'center' },
  value: { fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 19, lineHeight: 24 },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  plus: { position: 'absolute', top: 16, right: 16, width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
