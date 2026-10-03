import { CyclePressable as Pressable } from '@/components/cycle/CyclePressable';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Info } from 'lucide-react-native';
import { CycleExplainSheet } from '@/components/cycle/CycleExplainSheet';
import { tx } from '@/i18n/locale';
import { ttcSignalExplain, type TtcSignal, type TtcSignalKind } from '@/lib/cycleTtcSignals';
import { useCycleColors } from '@/theme/cycle';

/**
 * The one TTC fertility-sign line (`cycleTtcSignals`, brief §9 wave 2 item 4): a soft turquoise row with
 * the dashed estimate ring, the hedged sentence and an ⓘ — a tap opens `CycleTtcSignalSheet` with the
 * rule in plain words. Shown only on /cycle (TTC card) and in today's day sheet; never on Home.
 */
export function CycleTtcSignalLine({ signal, onPress }: { signal: TtcSignal; onPress: () => void }) {
  const c = useCycleColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={signal.text}
      accessibilityHint={tx('როგორ ვკითხულობთ — ახსნა', 'How we read this — explanation')}
      style={[s.row, { backgroundColor: c.fertilitySoft }]}
    >
      <View style={[s.ring, { borderColor: c.fertile }]} />
      <Text style={[s.text, { color: c.ink }]}>{signal.text}</Text>
      <Info size={16} color={c.fertile} strokeWidth={2.2} />
    </Pressable>
  );
}

/** The explanation behind a line. `embedded` draws inside the parent's Modal (the day sheet). */
export function CycleTtcSignalSheet({
  kind,
  visible,
  embedded,
  onClose,
}: {
  kind: TtcSignalKind | null;
  visible: boolean;
  embedded?: boolean;
  onClose: () => void;
}) {
  const c = useCycleColors();
  const copy = kind ? ttcSignalExplain(kind) : null;
  return (
    <CycleExplainSheet
      embedded={embedded}
      visible={visible && copy != null}
      title={copy?.title ?? ''}
      body={copy?.body}
      accent={c.fertile}
      sourceIds={copy?.sourceIds}
      caption={copy?.caption}
      funnelTopic="ttc_signal"
      onClose={onClose}
    />
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12, minHeight: 44 },
  ring: { width: 12, height: 12, borderRadius: 6, borderWidth: 1.5, borderStyle: 'dashed' },
  text: { flex: 1, minWidth: 0, fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 13, lineHeight: 19 },
});
