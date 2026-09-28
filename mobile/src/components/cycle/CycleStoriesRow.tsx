import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Heart, MessageCircle, Moon, Plus, type LucideIcon } from 'lucide-react-native';
import { CyclePressable as Pressable } from './CyclePressable';
import { ka } from '@/i18n/ka';
import type { CyclePhaseInfo } from '@/lib/cycleCanonical';
import { cycleHexAlpha, useCycleColors } from '@/theme/cycle';

/**
 * Quick row under the dial (Flo-style tiles): log today · cycle day · sex (its own private sheet) · ask Medi.
 * The day's advice lives in "Medi's tips for today" further down, so nothing is repeated here.
 */
export function CycleStoriesRow({
  phase,
  sexLogged,
  onLog,
  onSex,
  onPhase,
  onAskMedi,
}: {
  phase: CyclePhaseInfo | null;
  sexLogged: boolean;
  onLog: () => void;
  onSex: () => void;
  onPhase?: () => void;
  onAskMedi: () => void;
}) {
  const c = useCycleColors();
  const phaseColor =
    phase?.phase === 'period'
      ? c.period
      : phase?.phase === 'fertile' || phase?.phase === 'ovulation'
        ? c.fertileFill
        : phase?.phase === 'luteal'
          ? c.luteal
          : c.follicularFill;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}>
      <Tile title={ka.cycle.storyLogTitle} caption={ka.cycle.storyLogCaption} Icon={Plus} solid={c.cta} onPress={onLog} />
      <Tile
        title={ka.cycle.sexSectionTitle}
        caption={sexLogged ? ka.cycle.storySexLogged : ka.cycle.storySexCaption}
        Icon={Heart}
        accent={c.period}
        wash={c.periodSoft}
        onPress={onSex}
      />
      {phase?.day != null && phase.phase !== 'unknown' ? (
        <Tile title={ka.cycle.storyCycleDay(phase.day)} caption={phase.phaseKa} Icon={Moon} accent={phaseColor} wash={cycleHexAlpha(phaseColor, 0.14)} onPress={onPhase} />
      ) : null}
      <Tile title={ka.cycle.storyAskMedi} caption="Medi" Icon={MessageCircle} accent={c.brand} wash={c.accentSoft} onPress={onAskMedi} />
    </ScrollView>
  );
}

function Tile({
  title,
  caption,
  Icon,
  accent,
  wash,
  solid,
  onPress,
}: {
  title: string;
  caption: string;
  Icon: LucideIcon;
  accent?: string;
  wash?: string;
  solid?: string;
  onPress?: () => void;
}) {
  const c = useCycleColors();
  const ink = solid ? c.onPrimary : c.ink;
  const tint = solid ? c.onPrimary : accent ?? c.brand;
  return (
    <Pressable
      disabled={!onPress}
      onPress={() => {
        Haptics.selectionAsync().catch(() => undefined);
        onPress?.();
      }}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${caption}`}
      style={{ width: 118, height: 132, borderRadius: 20, backgroundColor: solid ?? wash ?? c.card, padding: 12, justifyContent: 'space-between' }}
    >
      <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: cycleHexAlpha(solid ? '#FFFFFF' : tint, solid ? 0.22 : 0.16), alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={17} color={tint} strokeWidth={2.3} />
      </View>
      <View>
        <Text numberOfLines={2} style={{ color: ink, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 13, lineHeight: 18 }}>{title}</Text>
        <Text numberOfLines={1} style={{ color: ink, opacity: 0.72, fontSize: 11, lineHeight: 15, marginTop: 3 }}>{caption}</Text>
      </View>
    </Pressable>
  );
}
