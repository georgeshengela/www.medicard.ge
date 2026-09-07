import React, { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Lock, MapPin } from 'lucide-react-native';
import type { CompanionJourney, JourneyMilestone } from '@/lib/companion/api';
import {
  companionChapterTitle,
  companionCopy,
  companionMilestoneBody,
  companionMilestoneTitle,
} from '@/lib/companion/copy';
import { trackQuestEvent } from '@/lib/productObservability';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { QUEST } from '@/theme/questTokens';
import { useIsDark, useThemeColors } from '@/theme/colors';

type Props = {
  journey: CompanionJourney;
  locale?: string;
  /** When true, show a shorter trail around the current position. */
  compact?: boolean;
};

export function MediJourneyPath({ journey, locale = 'ka', compact }: Props) {
  const colors = useThemeColors();
  const dark = useIsDark();
  const reduce = usePrefersReducedMotion();
  const copy = companionCopy(locale);

  const visible = useMemo(() => {
    const all = journey.milestones || [];
    if (!compact || all.length <= 9) return all;
    const nextIdx = all.findIndex((m) => m.key === journey.nextMilestoneKey);
    const curIdx = all.findIndex((m) => m.key === journey.currentMilestoneKey);
    const idx = Math.max(0, nextIdx >= 0 ? nextIdx : curIdx);
    const start = Math.max(0, idx - 3);
    const end = Math.min(all.length, start + 9);
    return all.slice(Math.max(0, end - 9), end);
  }, [journey, compact]);

  const next = journey.milestones.find((m) => m.key === journey.nextMilestoneKey);
  const remaining =
    next && journey.nextAt != null ? Math.max(0, journey.nextAt - journey.units) : null;

  return (
    <View style={{ gap: QUEST.gap }}>
      <View
        style={{
          backgroundColor: dark ? colors.surface : '#FFFFFF',
          borderWidth: 1,
          borderColor: colors.bg300,
          borderRadius: QUEST.radius,
          padding: QUEST.pad,
          gap: 8,
        }}
      >
        <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 16, color: colors.text100 }}>
          {companionChapterTitle(journey.chapterKey, locale)}
        </Text>
        {next ? (
          <View style={{ gap: 8 }}>
            <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13, lineHeight: 20, color: colors.text200 }}>
              {copy.nextStop}: {companionMilestoneTitle(next.titleKey, locale)}
              {remaining != null ? ` · ${copy.unitsToGo(remaining)}` : ''}
            </Text>
            {journey.nextAt != null && journey.currentMilestoneKey ? (
              <BetweenProgress units={journey.units} nextAt={journey.nextAt} milestones={journey.milestones} dark={dark} colors={colors} />
            ) : journey.nextAt != null && journey.units > 0 ? (
              <BetweenProgress units={journey.units} nextAt={journey.nextAt} milestones={journey.milestones} dark={dark} colors={colors} />
            ) : null}
          </View>
        ) : (
          <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13, color: colors.text200 }}>
            {copy.journeyComplete}
          </Text>
        )}
      </View>

      <View style={{ paddingLeft: 8 }}>
        {visible.map((m, i) => (
          <MilestoneRow
            key={m.key}
            milestone={m}
            locale={locale}
            isCurrent={m.key === journey.currentMilestoneKey}
            isNext={m.key === journey.nextMilestoneKey}
            isLast={i === visible.length - 1}
            reduce={reduce}
            delay={reduce ? 0 : i * QUEST.motion.stagger}
          />
        ))}
      </View>
    </View>
  );
}

function MilestoneRow({
  milestone,
  locale,
  isCurrent,
  isNext,
  isLast,
  reduce,
  delay,
}: {
  milestone: JourneyMilestone;
  locale: string;
  isCurrent: boolean;
  isNext: boolean;
  isLast: boolean;
  reduce: boolean;
  delay: number;
}) {
  const colors = useThemeColors();
  const dark = useIsDark();
  const copy = companionCopy(locale);
  const unlocked = milestone.unlocked;
  const title = companionMilestoneTitle(milestone.titleKey, locale);
  const body = companionMilestoneBody(milestone.descriptionKey, locale);

  const ink = unlocked
    ? dark
      ? colors.primary100
      : QUEST.accent.medi
    : colors.text300;
  const fill = unlocked
    ? dark
      ? QUEST.wash.dark
      : QUEST.wash.light
    : dark
      ? colors.bg200
      : colors.bg100;

  return (
    <Animated.View
      entering={reduce ? undefined : FadeInDown.delay(delay).duration(220)}
      style={{ flexDirection: 'row', minHeight: 72 }}
    >
      <View style={{ width: 28, alignItems: 'center' }}>
        <View
          style={{
            width: milestone.major ? 26 : isCurrent ? 20 : 16,
            height: milestone.major ? 26 : isCurrent ? 20 : 16,
            borderRadius: 999,
            backgroundColor: fill,
            borderWidth: milestone.major || isCurrent ? 2.5 : 2,
            borderColor: isCurrent ? (dark ? colors.primary100 : QUEST.accent.medi) : ink,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: unlocked ? 1 : 0.5,
          }}
        >
          {unlocked ? (
            isCurrent ? <MapPin size={milestone.major ? 12 : 10} color={ink} strokeWidth={2.4} /> : milestone.major ? (
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: ink }} />
            ) : null
          ) : (
            <Lock size={9} color={ink} strokeWidth={2.2} />
          )}
        </View>
        {!isLast ? (
          <View
            style={{
              width: 2,
              flex: 1,
              marginTop: 4,
              backgroundColor: unlocked ? ink : colors.bg300,
              opacity: unlocked ? 0.45 : 0.35,
            }}
          />
        ) : null}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        onPress={() => void trackQuestEvent('medi_journey_milestone_viewed', milestone.key)}
        style={{
          flex: 1,
          marginLeft: 10,
          marginBottom: 10,
          padding: 12,
          borderRadius: QUEST.rowRadius,
          backgroundColor: dark ? colors.surface : '#FFFFFF',
          borderWidth: 1,
          borderColor: isCurrent || isNext ? (dark ? colors.primary200 : QUEST.accent.medi) : colors.bg300,
          opacity: unlocked ? 1 : 0.72,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text
            style={{
              flex: 1,
              fontFamily: 'NotoSansGeorgian_600SemiBold',
              fontSize: 14,
              color: unlocked ? colors.text100 : colors.text300,
            }}
          >
            {unlocked ? title : `· · ·`}
          </Text>
          {isCurrent ? (
            <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 11, color: dark ? colors.primary100 : QUEST.accent.medi }}>
              {copy.youAreHere}
            </Text>
          ) : isNext ? (
            <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 11, color: colors.text300 }}>
              {copy.nextStop}
            </Text>
          ) : !unlocked ? (
            <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 11, color: colors.text300 }}>
              {copy.locked}
            </Text>
          ) : null}
        </View>
        {unlocked && body ? (
          <Text
            style={{
              marginTop: 4,
              fontFamily: 'NotoSansGeorgian_400Regular',
              fontSize: 12,
              lineHeight: 18,
              color: colors.text200,
            }}
          >
            {body}
          </Text>
        ) : !unlocked ? (
          <Text
            style={{
              marginTop: 4,
              fontFamily: 'NotoSansGeorgian_400Regular',
              fontSize: 12,
              color: colors.text300,
            }}
          >
            {copy.locked}
          </Text>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

function BetweenProgress({
  units,
  nextAt,
  milestones,
  dark,
  colors,
}: {
  units: number;
  nextAt: number;
  milestones: JourneyMilestone[];
  dark: boolean;
  colors: ReturnType<typeof useThemeColors>;
}) {
  const prev = [...milestones].reverse().find((m) => m.at <= units);
  const prevAt = prev?.at ?? 0;
  const span = Math.max(1, nextAt - prevAt);
  const filled = Math.min(1, Math.max(0, (units - prevAt) / span));
  return (
    <View style={{ gap: 4 }}>
      <View style={{ height: 6, borderRadius: 999, backgroundColor: dark ? colors.bg300 : colors.bg200, overflow: 'hidden' }}>
        <View
          style={{
            width: `${Math.round(filled * 100)}%`,
            height: '100%',
            backgroundColor: dark ? colors.primary200 : QUEST.accent.medi,
            borderRadius: 999,
          }}
        />
      </View>
      <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 11, color: colors.text300 }}>
        {units} / {nextAt}
      </Text>
    </View>
  );
}
