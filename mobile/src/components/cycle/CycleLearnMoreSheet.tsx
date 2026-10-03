import { CyclePressable as Pressable } from '@/components/cycle/CyclePressable';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Info } from 'lucide-react-native';
import { CycleExplainSheet } from '@/components/cycle/CycleExplainSheet';
import type { MedicalSourceId } from '@/constants/medicalSources';
import { learnMoreHeadings, learnMoreText, type LearnMoreEntry } from '@/i18n/cycle/learnMore';
import { tx } from '@/i18n/locale';
import { useCycleColors } from '@/theme/cycle';

export type LearnMoreItem = { title?: string; entry: LearnMoreEntry };

type Props = {
  visible: boolean;
  title: string;
  /** One entry, or several with their own subtitles (the private group's two intimate symptoms). */
  items: readonly LearnMoreItem[];
  /** Inside another sheet's Modal (day sheet) — see `CycleExplainSheet.embedded`. */
  embedded?: boolean;
  onClose: () => void;
};

/**
 * „გაიგე მეტი“ (brief §8.3/§8.4, Clue's per-option Learn more): what it is · ხშირია · როდის მივმართო
 * ექიმს · წყარო, in the cycle module's one explain sheet. Static copy from `i18n/cycle/learnMore.ts`;
 * opening it sends nothing anywhere (no analytics, no ids).
 */
export function CycleLearnMoreSheet({ visible, title, items, embedded, onClose }: Props) {
  const sourceIds = [...new Set(items.map((item) => item.entry.sourceId))] as MedicalSourceId[];
  return (
    <CycleExplainSheet
      visible={visible}
      title={title}
      sourceIds={sourceIds}
      caption={tx('ზოგადი ინფორმაციაა — შენს ჩანაწერს არ აფასებს.', 'General information — it does not assess your entry.')}
      embedded={embedded}
      onClose={onClose}
    >
      <View style={{ gap: 18 }}>
        {items.map((item, i) => (
          <LearnMoreBlock key={item.title ?? i} item={item} />
        ))}
      </View>
    </CycleExplainSheet>
  );
}

function LearnMoreBlock({ item }: { item: LearnMoreItem }) {
  const c = useCycleColors();
  const text = learnMoreText(item.entry);
  const h = learnMoreHeadings();
  return (
    <View style={{ gap: 10 }}>
      {item.title ? <Text style={[s.subtitle, { color: c.ink }]}>{item.title}</Text> : null}
      <Text style={[s.what, { color: c.ink }]}>{text.what}</Text>
      <View style={[s.block, { backgroundColor: c.cardSoft }]}>
        <Text style={[s.heading, { color: c.mutedSoft }]}>{h.typical}</Text>
        <Text style={[s.body, { color: c.muted }]}>{text.typical}</Text>
        <View style={[s.rule, { backgroundColor: c.border }]} />
        <Text style={[s.heading, { color: c.mutedSoft }]}>{h.whenDoctor}</Text>
        <Text style={[s.body, { color: c.ink }]}>{text.whenDoctor}</Text>
      </View>
    </View>
  );
}

/** The small ⓘ beside a group title in the full log. */
export function CycleInfoButton({ label, onPress }: { label: string; onPress: () => void }) {
  const c = useCycleColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${tx('გაიგე მეტი', 'Learn more')}: ${label}`}
      onPress={onPress}
      hitSlop={12}
      style={s.info}
    >
      <Info size={16} color={c.muted} strokeWidth={2.2} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  subtitle: { fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 15, lineHeight: 21 },
  what: { fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 15, lineHeight: 22 },
  block: { borderRadius: 18, padding: 14, gap: 6 },
  heading: { fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 12, lineHeight: 16, letterSpacing: 0.2 },
  body: { fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 14, lineHeight: 21 },
  rule: { height: StyleSheet.hairlineWidth, marginVertical: 6 },
  info: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
