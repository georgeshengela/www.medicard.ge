import React from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, LinearTransition } from 'react-native-reanimated';
import { Check, Clock3, MessageCircle } from 'lucide-react-native';
import { QuestClaimButton } from '@/components/quest/QuestClaimButton';
import { QuestIcon } from '@/components/quest/QuestIcon';
import { QuestMediLine } from '@/components/quest/QuestMediLine';
import { QuestProgressBar } from '@/components/quest/QuestProgressBar';
import { QuestReward } from '@/components/quest/QuestReward';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { QUEST, type QuestAccentKind } from '@/theme/questTokens';
import { useIsDark, useThemeColors } from '@/theme/colors';
import type { QuestItem } from '@/lib/quest/api';
import { formatQuestPercent, questKind } from '@/lib/quest/logic.js';
import { progressLabel, q, questHelper, questTitles } from '@/lib/quest/copy';

/**
 * One mission. Anatomy: icon well · title · progress pill / bar · reward pills ·
 * (claim CTA | Medi helper). Claimable cards get a brand border + soft wash;
 * claimed cards dim and swap the well for a success check.
 */
export function QuestCard({
  quest,
  locale = 'ka',
  weatherHint,
  weekly,
  offline,
  claiming,
  onClaim,
  onOpenMedi,
  index = 0,
}: {
  quest: QuestItem;
  locale?: string;
  weatherHint?: string | null;
  weekly?: boolean;
  offline?: boolean;
  claiming?: boolean;
  onClaim?: () => void;
  onOpenMedi?: () => void;
  /** Position in the list, drives the stagger. */
  index?: number;
}) {
  const colors = useThemeColors();
  const dark = useIsDark();
  const reduce = usePrefersReducedMotion();
  const copy = q(locale);
  const { kind, title } = questTitles(quest, locale);
  const helper = questHelper(quest, locale);
  const percent = formatQuestPercent(quest.progressPercent);
  const near = quest.status === 'ACTIVE' && percent >= 80;
  const claimed = quest.status === 'CLAIMED';
  const claimable = quest.claimable && !claimed;
  const active = quest.status === 'ACTIVE';
  const showBar = active || claimable;
  const a11y = copy.a11yQuest(title, quest.progress, quest.target, percent, quest.rewardCoins, quest.rewardXp);
  const accentKind: QuestAccentKind = weekly || kind === 'weekly' ? 'weekly' : (kind as QuestAccentKind);
  const conversational = kind === 'medi' && active;
  const accent = QUEST.accent[accentKind];

  const borderColor = claimable ? accent : weekly ? (dark ? colors.accent200 : colors.accent200) : colors.bg300;
  const background = claimable ? (dark ? QUEST.wash.dark : QUEST.wash.lightSoft) : dark ? colors.surface : '#FFFFFF';

  return (
    <Animated.View
      entering={reduce ? undefined : FadeInDown.duration(QUEST.motion.base).delay(index * QUEST.motion.stagger)}
      layout={reduce ? undefined : LinearTransition.duration(QUEST.motion.base)}
    >
    {/* Static opacity lives on an inner View so the layout animation never fights it. */}
    <View
      accessibilityLabel={a11y}
      style={{
        backgroundColor: background,
        borderWidth: 1,
        borderColor,
        borderRadius: QUEST.radius,
        padding: QUEST.pad,
        opacity: claimed ? 0.78 : 1,
        overflow: 'hidden',
      }}
    >
      {/* Header row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <QuestIcon kind={accentKind} done={claimed} ready={claimable} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            numberOfLines={2}
            style={{
              fontFamily: 'NotoSansGeorgian_700Bold',
              fontSize: 16,
              lineHeight: 22,
              letterSpacing: -0.2,
              color: colors.text100,
            }}
          >
            {title}
          </Text>
          {weekly ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
              <Clock3 size={12} color={colors.text300} strokeWidth={2.3} />
              <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 12, lineHeight: 16, color: colors.text300 }}>
                {copy.untilSunday}
              </Text>
            </View>
          ) : null}
        </View>
        {showBar && !conversational ? (
          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 999,
              backgroundColor: claimable ? accent : dark ? colors.bg200 : colors.bg100,
              borderWidth: claimable ? 0 : 1,
              borderColor: colors.bg300,
            }}
          >
            <Text
              style={{
                fontFamily: 'NotoSansGeorgian_700Bold',
                fontSize: 12,
                lineHeight: 16,
                color: claimable ? '#FFFFFF' : colors.text100,
              }}
            >
              {claimable ? '100%' : progressLabel(quest, locale)}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Progress */}
      {showBar && !conversational ? (
        <View style={{ marginTop: 14 }}>
          <QuestProgressBar
            percent={claimable ? 100 : percent}
            height={weekly ? QUEST.barWeekly : QUEST.barDaily + 1}
            color={accent}
            near={near}
            delay={index * QUEST.motion.stagger + 120}
          />
        </View>
      ) : null}

      {weatherHint && kind === 'movement' && active ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 }}>
          <Clock3 size={12} color={colors.primary200} strokeWidth={2.3} />
          <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 12, lineHeight: 16, color: colors.text300 }}>
            {weatherHint}
          </Text>
        </View>
      ) : null}

      {/* Reward + helper */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 14 }}>
        <QuestReward xp={quest.rewardXp} coins={quest.rewardCoins} locale={locale} muted={claimed} />
        {claimed ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 999,
              backgroundColor: colors.successBg,
            }}
          >
            <Check size={12} color={colors.success} strokeWidth={2.8} />
            <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 12, lineHeight: 16, color: colors.success }}>
              {copy.claimed}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Medi's one-line nudge for in-progress quests — own row so Georgian never truncates. */}
      {!claimed && !claimable && !conversational && helper ? (
        <Text
          numberOfLines={2}
          style={{
            marginTop: 10,
            fontFamily: 'NotoSansGeorgian_500Medium',
            fontSize: 12,
            lineHeight: 17,
            color: colors.text300,
          }}
        >
          {helper}
        </Text>
      ) : null}

      {claimable ? (
        <Animated.View entering={reduce ? undefined : FadeIn.duration(QUEST.motion.fast)} style={{ marginTop: 14 }}>
          <QuestClaimButton label={copy.claimReward} loading={claiming} disabled={offline} onPress={onClaim} />
          {offline ? (
            <Text style={{ marginTop: 8, fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 12, lineHeight: 16, color: colors.text300 }}>
              {copy.connectToClaim}
            </Text>
          ) : null}
        </Animated.View>
      ) : null}

      {conversational ? (
        <View style={{ marginTop: 14 }}>
          <QuestMediLine text={helper} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copy.openMedi}
            onPress={onOpenMedi}
            className="active:opacity-75"
            style={{
              marginTop: 12,
              height: 44,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: colors.bg300,
              backgroundColor: dark ? colors.surfaceRaised : colors.bg100,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <MessageCircle size={16} color={colors.primary200} strokeWidth={2.3} />
            <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 14, lineHeight: 20, color: colors.text100 }}>
              {copy.openMedi}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
    </Animated.View>
  );
}
