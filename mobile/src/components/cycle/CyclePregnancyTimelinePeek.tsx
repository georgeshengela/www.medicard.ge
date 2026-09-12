import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { ka } from '@/i18n/ka';
import {
  timelineCopy,
  timelineStatusLabel,
  timelineTrimesterLabel,
} from '@/i18n/cycle/pregnancyTimeline.js';
import type { CyclePregnancyTimeline } from '@/lib/api';
import { useCycleColors } from '@/theme/cycle';

export function pregnancyTimelineProgressWidth(fraction: number | null | undefined) {
  if (typeof fraction !== 'number' || Number.isNaN(fraction)) return '0%';
  const clamped = Math.max(0, Math.min(1, fraction));
  return `${Math.round(clamped * 1000) / 10}%`;
}

export function CyclePregnancyCalendarRail({
  fraction,
  label,
}: {
  fraction: number | null | undefined;
  label: string;
}) {
  const c = useCycleColors();
  return (
      <View
        accessibilityRole="progressbar"
        accessibilityLabel={label}
        accessibilityValue={{ min: 0, max: 40, now: Math.max(0, Math.min(40, Math.round((typeof fraction === 'number' ? fraction : 0) * 40))) }}
        style={{ marginTop: 10 }}
      >
      <View
        style={{
          height: 6,
          borderRadius: 99,
          backgroundColor: c.creamDeep,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            width: pregnancyTimelineProgressWidth(fraction),
            height: 6,
            borderRadius: 99,
            backgroundColor: c.rose,
          }}
        />
      </View>
      <Text style={{ color: c.mutedSoft, fontSize: 11, lineHeight: 16, marginTop: 6 }}>{label}</Text>
    </View>
  );
}

export function CyclePregnancyTimelinePeek({
  timeline,
  onOpen,
}: {
  timeline: CyclePregnancyTimeline | null | undefined;
  onOpen: () => void;
}) {
  const c = useCycleColors();
  const copy = ka.cycle.timeline;
  if (!timeline || timeline.reviewRequired || !timeline.available) return null;

  const nextTitle = timeline.nextMilestone ? timelineCopy(timeline.nextMilestone.titleKey) : null;
  const weekLabel = copy.weekOf40(timeline.currentWeek ?? 0);

  return (
    <View
      style={{
        marginTop: 12,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: c.border,
        backgroundColor: c.card,
        padding: 16,
      }}
    >
      <Text
        style={{
          color: c.ink,
          fontFamily: 'NotoSansGeorgian_700Bold',
          fontSize: 15,
          lineHeight: 22,
        }}
      >
        {copy.journey}
      </Text>
      <Text
        style={{
          color: c.brand,
          fontFamily: 'NotoSansGeorgian_600SemiBold',
          fontSize: 13,
          lineHeight: 18,
          marginTop: 6,
        }}
      >
        {timelineTrimesterLabel(timeline.trimester)}
      </Text>
      <Text
        style={{
          color: c.ink,
          fontFamily: 'NotoSansGeorgian_700Bold',
          fontSize: 16,
          lineHeight: 22,
          marginTop: 4,
        }}
      >
        {ka.cycle.pregnancyWeekDay(timeline.currentWeek ?? 0, timeline.currentDay ?? 0)}
      </Text>
      <CyclePregnancyCalendarRail fraction={timeline.progress?.fraction} label={`${weekLabel}. ${copy.progressHint}`} />
      {timeline.beyondStandardTerm ? (
        <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18, marginTop: 8 }}>
          {copy.beyondTerm}
        </Text>
      ) : nextTitle ? (
        <Text style={{ color: c.muted, fontSize: 13, lineHeight: 19, marginTop: 8 }}>
          {copy.next}: {nextTitle}
        </Text>
      ) : null}
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={copy.cta}
        style={{
          minHeight: 44,
          marginTop: 12,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: c.border,
          backgroundColor: c.roseSoft,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 12,
        }}
      >
        <Text
          style={{
            color: c.brand,
            fontFamily: 'NotoSansGeorgian_700Bold',
            fontSize: 14,
            textAlign: 'center',
          }}
        >
          {copy.cta}
        </Text>
      </Pressable>
    </View>
  );
}

export function CyclePregnancyJournalJourneyCta({
  timeline,
  onOpen,
}: {
  timeline: CyclePregnancyTimeline | null | undefined;
  onOpen: () => void;
}) {
  const c = useCycleColors();
  if (!timeline?.available) return null;
  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={ka.cycle.timeline.cta}
      style={{
        minHeight: 44,
        marginTop: 14,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: c.border,
        backgroundColor: c.roseSoft,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 12,
      }}
    >
      <Text style={{ color: c.brand, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 14 }}>
        {ka.cycle.timeline.cta}
      </Text>
    </Pressable>
  );
}

export { timelineStatusLabel };
