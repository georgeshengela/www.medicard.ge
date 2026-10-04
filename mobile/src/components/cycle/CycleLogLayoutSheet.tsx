import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Switch } from '@/components/ui/AppSwitch';
import * as Haptics from 'expo-haptics';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { CycleExplainSheet } from '@/components/cycle/CycleExplainSheet';
import { ka } from '@/i18n/ka';
import { tx } from '@/i18n/locale';
import {
  DEFAULT_LOG_LAYOUT,
  canMoveLogGroup,
  isGroupVisible,
  minimalLogLayout,
  moveLogGroup,
  sameLayout,
  sectionGroups,
  setGroupVisible,
  type CycleLogLayout,
  type LogLayoutGroup,
} from '@/lib/cycleLogLayout';
import { useCycleColors } from '@/theme/cycle';

export function logGroupTitle(id: LogLayoutGroup): string {
  switch (id) {
    case 'pain':
      return ka.cycle.pain;
    case 'lifestyle':
      return ka.cycle.lifestyle;
    case 'tags':
      return ka.cycle.customTags;
    case 'journal':
      return ka.cycle.journalTitle;
    default:
      return ka.cycle.trackGroup[id];
  }
}

/**
 * „კატეგორიების მორგება“: switch groups of the log off and move them up or down inside their section
 * (no drag library). სისხლდენა is always on. Two presets: სრული (every group, original order) and
 * მინიმალური (სისხლდენა, ტკივილი, განწყობა). Changes apply at once to the full log behind the sheet and
 * to the quick log; a switched-off group that holds something today keeps showing — nothing is deleted.
 */
export function CycleLogLayoutSheet({
  visible,
  layout,
  onChange,
  onClose,
  available = () => true,
}: {
  visible: boolean;
  layout: CycleLogLayout;
  onChange: (next: CycleLogLayout) => void;
  onClose: () => void;
  /** Groups the current mode logs (fertility signs only where the mode has them). */
  available?: (group: LogLayoutGroup) => boolean;
}) {
  const c = useCycleColors();
  const minimal = minimalLogLayout();
  const isFull = sameLayout(layout, DEFAULT_LOG_LAYOUT);
  const isMinimal = sameLayout(layout, minimal);
  const apply = (next: CycleLogLayout) => {
    Haptics.selectionAsync().catch(() => undefined);
    onChange(next);
  };

  const presets: { id: string; title: string; sub: string; on: boolean; layout: CycleLogLayout }[] = [
    { id: 'full', title: tx('სრული', 'Full'), sub: tx('ყველა ჯგუფი, თავდაპირველი რიგით', 'Every group, original order'), on: isFull, layout: DEFAULT_LOG_LAYOUT },
    {
      id: 'minimal',
      title: tx('მინიმალური', 'Minimal'),
      sub: tx('სისხლდენა · ტკივილი · განწყობა', 'Bleeding · pain · mood'),
      on: isMinimal,
      layout: minimal,
    },
  ];

  const section = (tab: 'feel' | 'more', title: string) => {
    const groups = sectionGroups(layout, tab).filter(available);
    return (
      <View style={s.section}>
        <Text accessibilityRole="header" style={[s.sectionTitle, { color: c.mutedSoft }]}>
          {title}
        </Text>
        <View style={[s.card, { backgroundColor: c.cardSoft }]}>
          {groups.map((id, i) => {
            const on = isGroupVisible(layout, id);
            const name = logGroupTitle(id);
            const up = canMoveLogGroup(layout, id, -1);
            const down = canMoveLogGroup(layout, id, 1);
            return (
              <View key={id} style={[s.row, i > 0 ? { borderTopWidth: 1, borderTopColor: c.border } : null]}>
                <Text numberOfLines={2} style={[s.rowTitle, { color: on ? c.ink : c.muted }]}>
                  {name}
                </Text>
                <MoveButton dir="up" disabled={!up} label={`${name} — ${tx('ზემოთ', 'move up')}`} onPress={() => apply(moveLogGroup(layout, id, -1))} />
                <MoveButton dir="down" disabled={!down} label={`${name} — ${tx('ქვემოთ', 'move down')}`} onPress={() => apply(moveLogGroup(layout, id, 1))} />
                <Switch
                  value={on}
                  onValueChange={(next) => apply(setGroupVisible(layout, id, next))}
                  accessibilityLabel={name}
                  trackColor={{ false: c.controlBorder, true: c.cta }}
                  thumbColor={c.white}
                  ios_backgroundColor={c.controlBorder}
                  // react-native-web paints the „on“ thumb teal unless told otherwise; native ignores it.
                  {...({ activeThumbColor: c.white } as object)}
                />
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  return (
    <CycleExplainSheet
      visible={visible}
      title={tx('კატეგორიების მორგება', 'Customize categories')}
      body={tx(
        'აირჩიე, რა გამოჩნდეს აღრიცხვისას და რა რიგით. დამალული ჯგუფი არაფერს შლის — თუ ამ დღეს უკვე აღნიშნე, ისევ გამოჩნდება.',
        'Choose what shows when you log and in which order. Hiding a group deletes nothing — if the day already has something there, it still shows.',
      )}
      closeLabel={tx('მზადაა', 'Done')}
      onClose={onClose}
    >
      <View style={s.presets}>
        {presets.map((p) => (
          <Pressable
            key={p.id}
            accessibilityRole="radio"
            accessibilityState={{ selected: p.on }}
            accessibilityLabel={`${p.title}. ${p.sub}`}
            onPress={() => apply(p.layout)}
            style={[s.preset, { backgroundColor: c.cardSoft, borderColor: p.on ? c.ink : 'transparent' }]}
          >
            <Text style={[s.presetTitle, { color: c.ink }]}>{p.title}</Text>
            <Text numberOfLines={2} style={[s.presetSub, { color: c.muted }]}>
              {p.sub}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={[s.card, s.fixed, { backgroundColor: c.cardSoft }]}>
        <Text style={[s.rowTitle, { color: c.ink }]}>{tx('სისხლდენა', 'Bleeding')}</Text>
        <Text style={[s.fixedNote, { color: c.mutedSoft }]}>{tx('ყოველთვის ჩანს', 'Always shown')}</Text>
      </View>

      {section('feel', ka.cycle.logStepFeel)}
      {section('more', ka.cycle.logStepMore)}
    </CycleExplainSheet>
  );
}

function MoveButton({ dir, disabled, label, onPress }: { dir: 'up' | 'down'; disabled: boolean; label: string; onPress: () => void }) {
  const c = useCycleColors();
  const Icon = dir === 'up' ? ChevronUp : ChevronDown;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[s.move, { opacity: disabled ? 0.3 : 1 }]}
    >
      <Icon size={18} color={c.ink} strokeWidth={2.2} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  presets: { flexDirection: 'row', gap: 10 },
  preset: { flex: 1, borderRadius: 16, borderWidth: 2, paddingVertical: 10, paddingHorizontal: 12, gap: 2, minHeight: 64 },
  presetTitle: { fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, lineHeight: 20 },
  presetSub: { fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 11.5, lineHeight: 15 },
  card: { borderRadius: 16, overflow: 'hidden' },
  fixed: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingHorizontal: 14, minHeight: 52, marginTop: 16 },
  fixedNote: { fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 12 },
  section: { marginTop: 16, gap: 8 },
  sectionTitle: { fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 12, lineHeight: 16, paddingHorizontal: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingLeft: 14, paddingRight: 10, minHeight: 56 },
  rowTitle: { flex: 1, fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 14, lineHeight: 19 },
  move: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
});
