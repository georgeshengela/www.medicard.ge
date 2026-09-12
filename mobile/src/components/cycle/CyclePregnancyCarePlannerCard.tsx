import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { ka } from '@/i18n/ka';
import { pregnancyCareCopy } from '@/i18n/cycle/pregnancyCare.js';
import type { CyclePregnancyCarePlannerSummary } from '@/lib/api';
import { useCycleColors } from '@/theme/cycle';

export function CyclePregnancyCarePlannerCard({
  summary,
  onOpen,
}: {
  summary: CyclePregnancyCarePlannerSummary | null | undefined;
  onOpen: () => void;
}) {
  const c = useCycleColors();
  const copy = ka.cycle.carePlan;
  if (!summary?.available) return null;

  const next = summary.next;
  const nextTitle = next ? pregnancyCareCopy(next.titleKey) : null;
  const window =
    next && Number.isInteger(next.startWeek) && Number.isInteger(next.endWeek)
      ? copy.windowLabel(next.startWeek, next.endWeek)
      : null;
  const status =
    next?.status === 'PLANNED'
      ? copy.statusPlanned
      : next?.relation === 'IN_WINDOW'
        ? copy.statusInWindow
        : next?.relation === 'BEFORE_WINDOW'
          ? copy.statusUpcoming
          : null;

  const a11y = [copy.title, nextTitle, window, status].filter(Boolean).join(', ');

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
        {copy.title}
      </Text>
      {summary.reviewRequired ? (
        <Text style={{ color: c.muted, fontSize: 13, lineHeight: 19, marginTop: 8 }}>
          {copy.reviewRequired}
        </Text>
      ) : nextTitle ? (
        <>
          <Text style={{ color: c.mutedSoft, fontSize: 11, lineHeight: 16, marginTop: 8 }}>
            {copy.nextLabel}
            {status ? ` · ${status}` : ''}
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
            {nextTitle}
          </Text>
          {window ? (
            <Text style={{ color: c.muted, fontSize: 13, lineHeight: 19, marginTop: 4 }}>{window}</Text>
          ) : null}
        </>
      ) : (
        <Text style={{ color: c.muted, fontSize: 13, lineHeight: 19, marginTop: 8 }}>
          {copy.commonlyDiscussed}
        </Text>
      )}
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={a11y || copy.cta}
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
