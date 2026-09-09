import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { NotebookPen, Plus } from 'lucide-react-native';
import { cycleLogFactBits, cycleLogHasFacts } from '@/lib/cycleLogFacts';
import { ka } from '@/i18n/ka';
import type { CycleLog } from '@/lib/api';
import { useCycleColors } from '@/theme/cycle';

/**
 * DaySummary — compact logged-facts row (§4.2.1). Row, not card wall.
 * Shows only what the user actually logged; empty state invites one tap.
 */
export function CycleDaySummary({
  log,
  onPress,
}: {
  log: CycleLog | undefined | null;
  onPress: () => void;
}) {
  const c = useCycleColors();
  const bits = cycleLogFactBits(log);
  const hasContent = cycleLogHasFacts(log);
  const summary = bits.length ? bits.join(' · ') : ka.cycle.loggedEntryEmpty;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={hasContent ? `${ka.cycle.loggedByYou}: ${summary}` : ka.cycle.todayEmpty}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: 56,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: c.border,
        backgroundColor: c.card,
        paddingHorizontal: 14,
        paddingVertical: 10,
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 12,
          backgroundColor: hasContent ? c.roseSoft : c.cardSoft,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 12,
        }}
      >
        {hasContent ? (
          <NotebookPen size={17} color={c.rose} strokeWidth={2.1} />
        ) : (
          <Plus size={18} color={c.brand} strokeWidth={2.2} />
        )}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        {hasContent ? (
          <>
            <Text
              style={{
                color: c.mutedSoft,
                fontSize: 11,
                fontFamily: 'NotoSansGeorgian_600SemiBold',
                letterSpacing: 0.3,
              }}
            >
              {ka.cycle.loggedByYou}
            </Text>
            <Text
              numberOfLines={2}
              style={{
                color: c.ink,
                fontSize: 13,
                lineHeight: 18,
                marginTop: 2,
                fontFamily: 'NotoSansGeorgian_600SemiBold',
              }}
            >
              {summary}
            </Text>
          </>
        ) : (
          <Text
            style={{
              color: c.muted,
              fontSize: 13,
              lineHeight: 18,
              fontFamily: 'NotoSansGeorgian_500Medium',
            }}
          >
            {ka.cycle.todayEmpty}
          </Text>
        )}
      </View>
      <Text style={{ color: c.brand, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 13 }}>
        {hasContent ? ka.common.edit : ka.cycle.logFab}
      </Text>
    </Pressable>
  );
}
