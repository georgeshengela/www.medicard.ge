import React from 'react';
import { Text, View } from 'react-native';
import { CyclePressable as Pressable } from '@/components/cycle/CyclePressable';
import { tx } from '@/i18n/locale';
import { useCycleColors } from '@/theme/cycle';

/**
 * Period auto-end (brief §9 wave 2 item 3, [კ-22]): on the day after the usual length, with nothing
 * logged today, one quiet line „ჯერ კიდევ გაქვს?“ and two small buttons. „კი“ logs today's flow; „დასრულდა“
 * is the hero's one-tap end (undo in the toast). With no answer the period simply counts as ended
 * tomorrow — the line never comes back and never nags. Same on Home and /cycle.
 */
export function CycleStillBleedingRow({
  onYes,
  onEnded,
  disabled = false,
}: {
  onYes: () => void;
  onEnded: () => void;
  disabled?: boolean;
}) {
  const c = useCycleColors();
  const question = tx('ჯერ კიდევ გაქვს?', 'Still bleeding?');
  return (
    <View
      accessibilityRole="none"
      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 8 }}
    >
      <Text style={{ color: c.ink, fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, lineHeight: 20, marginRight: 2 }}>
        {question}
      </Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <SmallChoice
          label={tx('კი', 'Yes')}
          a11y={tx('კი, ჯერ კიდევ მაქვს — დღევანდელი სისხლდენის აღრიცხვა', 'Yes, still bleeding — log today’s flow')}
          bg={c.periodSoft}
          fg={c.period}
          disabled={disabled}
          onPress={onYes}
        />
        <SmallChoice
          label={tx('დასრულდა', 'It ended')}
          a11y={tx('მენსტრუაცია დასრულდა', 'My period ended')}
          bg={c.cardSoft}
          fg={c.ink}
          disabled={disabled}
          onPress={onEnded}
        />
      </View>
    </View>
  );
}

function SmallChoice({
  label,
  a11y,
  bg,
  fg,
  disabled,
  onPress,
}: {
  label: string;
  a11y: string;
  bg: string;
  fg: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ disabled }}
      hitSlop={6}
      style={{
        minHeight: 34,
        minWidth: 52,
        borderRadius: 17,
        paddingHorizontal: 14,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <Text numberOfLines={1} style={{ color: fg, fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 13, lineHeight: 18 }}>
        {label}
      </Text>
    </Pressable>
  );
}
