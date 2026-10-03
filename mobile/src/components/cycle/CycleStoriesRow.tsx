import React from 'react';
import { Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { MessageCircle, Plus, type LucideIcon } from 'lucide-react-native';
import { CyclePressable as Pressable } from './CyclePressable';
import { ka } from '@/i18n/ka';
import { tx } from '@/i18n/locale';
import { cycleHexAlpha, useCycleColors } from '@/theme/cycle';

/**
 * Two tiles under the hero (brief §8.2 item 7, §6 weakness 3): only what the hero does not already
 * say — „როგორ ხარ დღეს?“ (symptoms, mood) and „ჰკითხე Medi-ს ციკლზე“ (the consultation with one
 * neutral question prefilled). The cycle day lives in the dial / status line and the one-tap „♥ სექსი“
 * sits in the hero's action row, so neither is repeated here. The day's advice lives in „დღის რჩევები“.
 */
export function CycleStoriesRow({ onLog, onAskMedi }: { onLog: () => void; onAskMedi: () => void }) {
  const c = useCycleColors();
  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      <Tile title={ka.cycle.storyLogTitle} caption={ka.cycle.storyLogCaption} Icon={Plus} solid={c.cta} onPress={onLog} />
      <Tile
        title={ka.cycle.storyAskMedi}
        caption={tx('ერთი კითხვა, პასუხი კონტექსტით', 'One question, answered in context')}
        Icon={MessageCircle}
        accent={c.brand}
        wash={c.accentSoft}
        onPress={onAskMedi}
      />
    </View>
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
  onPress: () => void;
}) {
  const c = useCycleColors();
  const ink = solid ? c.onPrimary : c.ink;
  const tint = solid ? c.onPrimary : accent ?? c.brand;
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync().catch(() => undefined);
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${caption}`}
      style={{ flex: 1, minHeight: 124, borderRadius: 22, backgroundColor: solid ?? wash ?? c.card, padding: 14, justifyContent: 'space-between', gap: 12 }}
    >
      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: cycleHexAlpha(solid ? '#FFFFFF' : tint, solid ? 0.22 : 0.16), alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={18} color={tint} strokeWidth={2.3} />
      </View>
      <View>
        <Text numberOfLines={2} style={{ color: ink, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 13, lineHeight: 18 }}>{title}</Text>
        <Text numberOfLines={2} style={{ color: ink, opacity: 0.72, fontSize: 11, lineHeight: 15, marginTop: 3 }}>{caption}</Text>
      </View>
    </Pressable>
  );
}
