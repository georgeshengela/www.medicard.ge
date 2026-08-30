import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { AssistantChatDot } from '@/components/home/HomeAssistantIcons';
import { HomeSectionTitle } from '@/components/home/HomeSectionTitle';
import { useFigmaChat } from '@/constants/figmaChatLayout';
import { ka } from '@/i18n/ka';
import { loadSymptomHistory } from '@/lib/symptomResultStorage';
import { useIsDark } from '@/theme/colors';

const VIRUS_VIDEO = require('../../../assets/home/virus.mp4');

function safePlay(player: { play: () => void; pause: () => void }, action: 'play' | 'pause') {
  try {
    if (action === 'play') player.play();
    else player.pause();
  } catch {
    /* native player is already released when Home unmounts / tab detaches */
  }
}

type Props = {
  firstName?: string;
  onPress: () => void;
};

export function HomeSymptomAssistantCard({ firstName, onPress }: Props) {
  const FIGMA_CHAT = useFigmaChat();
  const dark = useIsDark();
  const [lastCondition, setLastCondition] = useState<string | null>(null);

  const player = useVideoPlayer(VIRUS_VIDEO, (next) => {
    next.loop = true;
    next.muted = true;
    safePlay(next, 'play');
  });

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      safePlay(player, 'play');
      void loadSymptomHistory().then((history) => {
        if (!alive) return;
        const name = history[0]?.result.conditions[0]?.nameKa?.trim();
        setLastCondition(name || null);
      });
      return () => {
        alive = false;
        safePlay(player, 'pause');
      };
    }, [player]),
  );

  const title = ka.home.doctorCardTitle;
  const body = useMemo(() => {
    if (lastCondition) return ka.home.assistantFollowUp(lastCondition);
    const copy = ka.home.doctorCardBody;
    if (typeof copy === 'function') return copy(firstName?.trim() ?? '');
    return ka.home.assistantBubble(firstName?.trim() ?? '');
  }, [firstName, lastCondition]);

  const fade = dark
    ? (['#111827', 'rgba(17,24,39,0.92)', 'rgba(17,24,39,0.35)', 'rgba(17,24,39,0)'] as const)
    : (['#F9FAFB', 'rgba(249,250,251,0.94)', 'rgba(249,250,251,0.42)', 'rgba(249,250,251,0)'] as const);

  return (
    <View>
      <HomeSectionTitle title={ka.home.doctorEyebrow} />

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={ka.home.doctorEyebrow}
        activeOpacity={0.92}
        onPress={onPress}
      >
        <View
          style={{
            minHeight: 136,
            borderRadius: 24,
            borderWidth: 1,
            borderColor: FIGMA_CHAT.border,
            backgroundColor: FIGMA_CHAT.cardBg,
            overflow: 'hidden',
            ...FIGMA_CHAT.shadowXs,
          }}
        >
          <VideoView
            player={player}
            style={StyleSheet.absoluteFillObject}
            contentFit="cover"
            nativeControls={false}
            fullscreenOptions={{ enable: false }}
            surfaceType="textureView"
            pointerEvents="none"
          />
          <View
            pointerEvents="none"
            style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(20,184,166,0.14)' }]}
          />
          <LinearGradient
            colors={[...fade]}
            locations={[0, 0.38, 0.64, 1]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />

          <View
            pointerEvents="none"
            style={{
              flex: 1,
              padding: 16,
              gap: 8,
              maxWidth: '72%',
              justifyContent: 'center',
            }}
          >
            <Text
              style={{
                fontFamily: 'NotoSansGeorgian_600SemiBold',
                fontSize: 16,
                lineHeight: 22,
                color: FIGMA_CHAT.textPrimary,
              }}
            >
              {title}
            </Text>
            <Text
              style={{
                fontFamily: 'NotoSansGeorgian_400Regular',
                fontSize: 14,
                lineHeight: 20,
                color: FIGMA_CHAT.textSecondary,
              }}
            >
              {body}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text
                style={{
                  fontFamily: 'NotoSansGeorgian_600SemiBold',
                  fontSize: 14,
                  lineHeight: 20,
                  color: FIGMA_CHAT.brand,
                }}
              >
                {ka.home.assistantCta}
              </Text>
              <AssistantChatDot size={20} color={FIGMA_CHAT.brand} />
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
}
