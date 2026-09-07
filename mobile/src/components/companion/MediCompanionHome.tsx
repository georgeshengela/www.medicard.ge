import React, { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  MessageCircle,
  Palette,
  Sparkles,
  Trophy,
  Footprints,
} from 'lucide-react-native';
import { MediCompanionScene } from '@/components/companion/MediCompanionScene';
import type { CompanionOverview } from '@/lib/companion/api';
import {
  companionChapterTitle,
  companionCopy,
  companionMessage,
  companionStageLabel,
} from '@/lib/companion/copy';
import { trackQuestEvent } from '@/lib/productObservability';
import { QUEST } from '@/theme/questTokens';
import { useIsDark, useThemeColors } from '@/theme/colors';

type Props = {
  overview: CompanionOverview;
  locale?: string;
  offline?: boolean;
  reducedMotion?: boolean;
  focused?: boolean;
};

export function MediCompanionHome({
  overview,
  locale = 'ka',
  offline,
  reducedMotion,
  focused = true,
}: Props) {
  const router = useRouter();
  const colors = useThemeColors();
  const dark = useIsDark();
  const copy = companionCopy(locale);
  const { companion, journey, equipment } = overview;
  const message = companionMessage(companion.messageKey, locale);
  const stageLabel = companionStageLabel(companion.stage, locale);
  const chapter = companionChapterTitle(journey.chapterKey, locale);
  const journeyDone = !journey.nextMilestoneKey;

  const actions = [
    {
      key: 'quest',
      label: copy.todaysQuest,
      icon: Sparkles,
      onPress: () => router.push('/medi-quest' as never),
    },
    {
      key: 'journey',
      label: copy.journey,
      icon: Footprints,
      onPress: () => router.push('/medi-companion/journey' as never),
    },
    {
      key: 'achievements',
      label: copy.achievements,
      icon: Trophy,
      onPress: () => router.push('/medi-quest/achievements' as never),
    },
    {
      key: 'collection',
      label: `${copy.collection} / ${copy.style}`,
      icon: Palette,
      onPress: () => router.push('/medi-companion/collection' as never),
    },
  ] as const;

  return (
    <View style={{ gap: QUEST.gap }}>
      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 22, color: colors.text100 }}>
              {copy.title}
            </Text>
            <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13, color: colors.text300 }}>
              {stageLabel} · {copy.level} {companion.level}
              {chapter ? ` · ${chapter}` : ''}
            </Text>
          </View>
        </View>

        <MediCompanionScene
          stage={companion.stage}
          moodKey={companion.moodKey}
          equipment={equipment}
          reducedMotion={reducedMotion || companion.reducedMotion || !focused}
        />

        <Text
          style={{
            fontFamily: 'NotoSansGeorgian_500Medium',
            fontSize: 15,
            lineHeight: 22,
            color: colors.text200,
            textAlign: 'center',
            paddingHorizontal: 8,
          }}
        >
          {message}
        </Text>

        {journeyDone ? (
          <Text
            style={{
              textAlign: 'center',
              fontFamily: 'NotoSansGeorgian_400Regular',
              fontSize: 12,
              color: colors.text300,
            }}
          >
            {copy.journeyComplete}
          </Text>
        ) : null}

        {offline ? (
          <Text
            style={{
              textAlign: 'center',
              fontFamily: 'NotoSansGeorgian_400Regular',
              fontSize: 12,
              color: colors.text300,
            }}
          >
            {copy.offline}
          </Text>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.talk}
          onPress={() => {
            void trackQuestEvent('medi_talk_tapped');
            router.push('/chat/doctor' as never);
          }}
          className="active:opacity-90"
          style={{
            minHeight: 52,
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: 8,
            backgroundColor: dark ? '#0D9488' : QUEST.accent.medi,
          }}
        >
          <MessageCircle size={18} color="#FFFFFF" strokeWidth={2.2} />
          <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 15, color: '#FFFFFF' }}>
            {copy.talk}
          </Text>
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Pressable
              key={action.key}
              accessibilityRole="button"
              accessibilityLabel={action.label}
              onPress={action.onPress}
              className="active:opacity-90"
              style={{
                width: '48%',
                flexGrow: 1,
                minHeight: 56,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                paddingHorizontal: 12,
                borderRadius: QUEST.rowRadius,
                backgroundColor: dark ? colors.surface : '#FFFFFF',
                borderWidth: 1,
                borderColor: colors.bg300,
              }}
            >
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: dark ? QUEST.wash.dark : QUEST.wash.light,
                }}
              >
                <Icon size={16} color={dark ? colors.primary100 : QUEST.accent.medi} strokeWidth={2.1} />
              </View>
              <Text
                style={{
                  flex: 1,
                  fontFamily: 'NotoSansGeorgian_600SemiBold',
                  fontSize: 13,
                  lineHeight: 18,
                  color: colors.text100,
                }}
                numberOfLines={3}
              >
                {action.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
