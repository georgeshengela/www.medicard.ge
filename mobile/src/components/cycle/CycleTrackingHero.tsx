import { CyclePressable as Pressable } from '@/components/cycle/CyclePressable';
import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Check, Droplet, Heart, Plus, type LucideIcon } from 'lucide-react-native';
import { CycleExplainSheet } from '@/components/cycle/CycleExplainSheet';
import { CyclePhaseLegend } from '@/components/cycle/CyclePhaseLegend';
import { CycleStatusGauge } from '@/components/cycle/CycleStatusGauge';
import { ka } from '@/i18n/ka';
import { MONTHS_KA } from '@/constants/cycle';
import type { CycleBundle } from '@/lib/api';
import { isBleedFlow } from '@/lib/cycleLogSave';
import { trackingHeroActions, trackingRingDays } from '@/lib/home/homeCycle';
import { trackingCopy } from '@/lib/cycleTrackingCopy';
import { useCycleColors } from '@/theme/cycle';

type Props = {
  bundle: CycleBundle;
  today: string;
  onLog: () => void;
  /** „ახალი ციკლის დაწყება“ — logs a bleed today; forecasts stay off. */
  onStart: () => void;
  onEnd: () => void;
  onSex?: () => void;
  sexLogged?: boolean;
};

/**
 * „თვალყურის დევნება“ / Tracking hero on /cycle (brief §9 wave 2 item 17): she expects no periods, so
 * nothing is estimated. The ring is the last four weeks of what she logged (rose = bleeding, dots =
 * other logged days), the centre is today's date, then „როგორ ხარ დღეს?“ and the log action. A manual
 * new cycle start stays (spotting / withdrawal bleed) and never turns forecasts back on.
 */
export function CycleTrackingHero({ bundle, today, onLog, onStart, onEnd, onSex, sexLogged }: Props) {
  const c = useCycleColors();
  const [explain, setExplain] = useState(false);
  const ring = useMemo(() => trackingRingDays({ today, logs: bundle.logs }), [today, bundle.logs]);
  const bleedingToday = isBleedFlow(bundle.logs.find((l) => l.date === today)?.flow);
  const plan = trackingHeroActions({ bleedingToday });
  const [, mm, dd] = today.split('-').map(Number);
  const title = trackingCopy.title();

  return (
    <View style={{ paddingTop: 18, paddingBottom: 18, borderRadius: 22, backgroundColor: c.card }}>
      <CycleStatusGauge
        day={null}
        cycleLength={ring.days}
        trackingWindow={ring}
        phaseHint={title}
        a11yLabel={`${title}. ${trackingCopy.ringA11y(ring.bleed.length, ring.logged.length + (ring.spotting?.length ?? 0))}`}
        center={{ top: trackingCopy.today(), value: String(dd), bottom: MONTHS_KA[mm - 1] ?? null, tone: 'ink' }}
        onInfo={() => setExplain(true)}
      />
      <CycleExplainSheet
        visible={explain}
        title={title}
        body={trackingCopy.explainBody()}
        accent={c.mutedSoft}
        sourceIds={['menstrualCycle']}
        caption={trackingCopy.explainCaption()}
        funnelTopic="tracking"
        onClose={() => setExplain(false)}
      >
        <CyclePhaseLegend look="plain" marks only={['logged', 'symptom', 'spotting']} loggedBleedLabel={trackingCopy.bleedLegend()} />
      </CycleExplainSheet>

      <View style={{ paddingHorizontal: 18, marginTop: 2 }}>
        <Text style={{ color: c.ink, fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 15, lineHeight: 22, textAlign: 'center' }}>
          {trackingCopy.howAreYou()}
        </Text>
        <Text style={{ color: c.muted, fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 4 }}>
          {trackingCopy.detail()}
        </Text>
        <View accessible={false} importantForAccessibility="no-hide-descendants" style={{ marginTop: 12 }}>
          <CyclePhaseLegend look="dense" marks only={['logged', 'symptom', 'spotting']} loggedBleedLabel={trackingCopy.bleedLegend()} />
        </View>

        <View style={{ marginTop: 16, gap: 10 }}>
          <HeroButton filled label={ka.cycle.logTodayCta} icon={Plus} onPress={onLog} />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {plan.secondary === 'end' ? (
              <HeroButton filled={false} label={trackingCopy.endBleed()} onPress={onEnd} />
            ) : (
              <HeroButton filled={false} label={trackingCopy.newCycleShort()} a11y={trackingCopy.newCycle()} icon={Droplet} onPress={onStart} />
            )}
            {onSex ? <SexButton logged={Boolean(sexLogged)} onPress={onSex} /> : null}
          </View>
        </View>
      </View>
    </View>
  );
}

/** CycleHero's buttons: filled 50 pt rose pill, tonal 46 pt (flat, no border, no shadow). */
function HeroButton({ label, a11y, icon: Icon, filled, onPress }: { label: string; a11y?: string; icon?: LucideIcon; filled: boolean; onPress: () => void }) {
  const c = useCycleColors();
  const fg = filled ? c.onPrimary : c.ink;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y ?? label}
      style={{
        flex: filled ? undefined : 1,
        minHeight: filled ? 50 : 46,
        borderRadius: filled ? 25 : 23,
        paddingHorizontal: filled ? 10 : 12,
        paddingVertical: filled ? 6 : 0,
        backgroundColor: filled ? c.cta : c.cardSoft,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
      }}
    >
      {Icon ? <Icon size={17} color={fg} strokeWidth={2.2} /> : null}
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.85}
        style={{ color: fg, fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: filled ? 14 : 13, lineHeight: filled ? 19 : 18, textAlign: 'center', flexShrink: 1 }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** „♥ სექსი“ — the same one-tap button as the classic hero. */
function SexButton({ logged, onPress }: { logged: boolean; onPress: () => void }) {
  const c = useCycleColors();
  const fg = logged ? c.onPeriod : c.period;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={logged ? ka.cycle.sexLoggedA11y : ka.cycle.sexLogA11y}
      style={{
        minHeight: 46,
        borderRadius: 23,
        paddingHorizontal: 16,
        backgroundColor: logged ? c.period : c.periodSoft,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
      }}
    >
      {logged ? <Check size={15} color={fg} strokeWidth={3} /> : <Heart size={16} color={fg} strokeWidth={2.4} fill={fg} />}
      <Text numberOfLines={1} style={{ color: fg, fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 13, lineHeight: 18 }}>{ka.cycle.sexShort}</Text>
    </Pressable>
  );
}
