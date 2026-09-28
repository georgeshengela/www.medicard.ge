import React from 'react';
import { Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { Check, Droplet, Undo2 } from 'lucide-react-native';
import { CyclePressable } from './CyclePressable';
import { ka } from '@/i18n/ka';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { cycleHexAlpha, useCycleColors } from '@/theme/cycle';

/** Confirmation after one-tap "period started": what happened, plus add-flow and undo within reach. */
export function CyclePeriodToast({
  bottomInset,
  onAddFlow,
  onUndo,
  title = ka.cycle.periodStartedToast,
  hint = ka.cycle.periodStartedToastHint,
  primaryLabel = ka.cycle.periodStartedAddFlow,
  PrimaryIcon = Droplet,
}: {
  bottomInset: number;
  onAddFlow: () => void;
  onUndo: () => void;
  title?: string;
  hint?: string;
  primaryLabel?: string;
  PrimaryIcon?: typeof Droplet;
}) {
  const c = useCycleColors();
  const reduceMotion = usePrefersReducedMotion();
  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeInDown.duration(260)}
      exiting={reduceMotion ? undefined : FadeOutDown.duration(200)}
      accessibilityLiveRegion="polite"
      style={{ position: 'absolute', left: 16, right: 16, bottom: Math.max(bottomInset, 12) + 8 }}
    >
      <View
        style={{
          borderRadius: 22,
          backgroundColor: c.ink,
          paddingVertical: 12,
          paddingHorizontal: 14,
          gap: 10,
          shadowColor: '#000',
          shadowOpacity: 0.18,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 8 },
          elevation: 8,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: c.period, alignItems: 'center', justifyContent: 'center' }}>
            <Check size={16} color={c.onPeriod} strokeWidth={3} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: c.card, fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, lineHeight: 20 }}>{title}</Text>
            <Text style={{ color: c.card, opacity: 0.75, fontSize: 12, lineHeight: 17 }}>{hint}</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <ToastButton label={primaryLabel} icon={<PrimaryIcon size={15} color={c.ink} strokeWidth={2.3} />} onPress={onAddFlow} primary />
          <ToastButton label={ka.cycle.periodStartedUndo} icon={<Undo2 size={15} color={c.card} strokeWidth={2.3} />} onPress={onUndo} />
        </View>
      </View>
    </Animated.View>
  );
}

function ToastButton({ label, icon, onPress, primary }: { label: string; icon: React.ReactNode; onPress: () => void; primary?: boolean }) {
  const c = useCycleColors();
  return (
    <CyclePressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        flex: 1,
        minHeight: 44,
        borderRadius: 22,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: primary ? c.card : 'transparent',
        borderWidth: primary ? 0 : 1,
        borderColor: primary ? 'transparent' : cycleHexAlpha(c.card, 0.4),
      }}
    >
      {icon}
      <Text style={{ color: primary ? c.ink : c.card, fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 13 }}>{label}</Text>
    </CyclePressable>
  );
}
