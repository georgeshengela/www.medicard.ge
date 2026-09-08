import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { NotebookPen, Plus } from 'lucide-react-native';
import { FLOW_OPTIONS, MOOD_OPTIONS, PHYSICAL_SYMPTOMS } from '@/constants/cycle';
import { formatPainEntry } from '@/lib/cycleObservations';
import { ka } from '@/i18n/ka';
import type { CycleLog } from '@/lib/api';
import { useCycleColors } from '@/theme/cycle';

function labelOf(id: string, list: { id: string; label: string }[]) {
  return list.find((x) => x.id === id)?.label ?? id;
}

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

  const bits: string[] = [];
  if (log?.flow) bits.push(labelOf(log.flow, FLOW_OPTIONS));
  for (const entry of log?.painEntries ?? []) bits.push(formatPainEntry(entry));
  for (const mood of (log?.moods ?? []).slice(0, 2)) bits.push(labelOf(mood, MOOD_OPTIONS));
  const symptomCount = log?.symptoms?.length ?? 0;
  if (symptomCount > 0) {
    const first = labelOf(log!.symptoms[0], PHYSICAL_SYMPTOMS);
    bits.push(symptomCount === 1 ? first : `${first} +${symptomCount - 1}`);
  }
  if (log?.notes?.trim()) bits.push(ka.cycle.journalTitle);

  const hasContent = bits.length > 0;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        hasContent ? `${ka.cycle.loggedByYou}: ${bits.join(', ')}` : ka.cycle.todayEmpty
      }
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
              {bits.join(' · ')}
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
