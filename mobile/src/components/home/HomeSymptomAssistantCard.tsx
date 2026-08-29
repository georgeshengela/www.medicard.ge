import React, { useCallback, useMemo, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { AssistantChatDot, AssistantChecks, AssistantRobot } from '@/components/home/HomeAssistantIcons';
import { useFigmaChat } from '@/constants/figmaChatLayout';
import { ka } from '@/i18n/ka';
import { loadSymptomHistory } from '@/lib/symptomResultStorage';

type Props = {
  firstName?: string;
  onPress: () => void;
};

function clockLabel() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

export function HomeSymptomAssistantCard({ firstName, onPress }: Props) {
  const FIGMA_CHAT = useFigmaChat();
  const [lastCondition, setLastCondition] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void loadSymptomHistory().then((history) => {
        if (!alive) return;
        const name = history[0]?.result.conditions[0]?.nameKa?.trim();
        setLastCondition(name || null);
      });
      return () => {
        alive = false;
      };
    }, []),
  );

  const message = useMemo(() => {
    if (lastCondition) return ka.home.assistantFollowUp(lastCondition);
    return ka.home.assistantBubble(firstName?.trim() ?? '');
  }, [firstName, lastCondition]);

  return (
    <View>
      <View style={{ paddingVertical: 8 }}>
        <Text
          style={{
            fontFamily: 'NotoSansGeorgian_600SemiBold',
            fontSize: 16,
            lineHeight: 22,
            color: FIGMA_CHAT.textPrimary,
          }}
        >
          {ka.home.doctorEyebrow}
        </Text>
      </View>

      <TouchableOpacity accessibilityRole="button" accessibilityLabel={ka.home.doctorEyebrow} activeOpacity={0.92} onPress={onPress}>
        <View
          pointerEvents="none"
          style={{
            backgroundColor: FIGMA_CHAT.cardBg,
            borderWidth: 1,
            borderColor: FIGMA_CHAT.border,
            borderRadius: 24,
            padding: 16,
            gap: 16,
            overflow: 'hidden',
            ...FIGMA_CHAT.shadowXs,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 999,
                backgroundColor: FIGMA_CHAT.brandQuaternary,
                borderWidth: 1,
                borderColor: FIGMA_CHAT.brandBorderLight,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AssistantRobot size={24} />
            </View>

            <View
              style={{
                flex: 1,
                minWidth: 0,
                backgroundColor: FIGMA_CHAT.white,
                borderWidth: 1,
                borderColor: FIGMA_CHAT.border,
                borderRadius: 16,
                padding: 12,
                gap: 4,
                ...FIGMA_CHAT.shadowSm,
              }}
            >
              <Text
                style={{
                  fontFamily: 'NotoSansGeorgian_400Regular',
                  fontSize: 14,
                  lineHeight: 20,
                  color: FIGMA_CHAT.textPrimary,
                }}
              >
                {message}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                <Text
                  style={{
                    fontFamily: 'NotoSansGeorgian_400Regular',
                    fontSize: 12,
                    lineHeight: 16,
                    color: FIGMA_CHAT.textSecondary,
                  }}
                >
                  {clockLabel()}
                </Text>
                <AssistantChecks size={16} />
              </View>
            </View>
          </View>

          <View style={{ height: 1, backgroundColor: FIGMA_CHAT.border }} />

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
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
            <AssistantChatDot size={20} />
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
}
