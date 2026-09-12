import React from 'react';
import { Modal, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { APP_MODAL_PROPS } from '@/components/ui/appModal';
import { ka } from '@/i18n/ka';
import {
  observationExplainCopy,
  type ObservationExplainTopic,
} from '@/lib/cycleObservationExplainabilityCopy';
import { useCycleColors } from '@/theme/cycle';

type Props = {
  visible: boolean;
  topic: ObservationExplainTopic | null;
  reason?: string | null;
  onClose: () => void;
};

export function CycleObservationExplainSheet({ visible, topic, reason, onClose }: Props) {
  const c = useCycleColors();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  if (!topic) return null;
  const copy = observationExplainCopy(topic, reason);

  return (
    <Modal visible={visible} {...APP_MODAL_PROPS} onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={ka.common.close}
          onPress={onClose}
          style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: c.overlay }}
        />
        <View
          style={{
            backgroundColor: c.card,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            paddingHorizontal: 20,
            paddingTop: 12,
            paddingBottom: insets.bottom + 18,
            borderTopWidth: 1,
            borderColor: c.border,
            maxHeight: height * 0.8,
          }}
        >
          <View
            style={{
              width: 40,
              height: 4,
              borderRadius: 2,
              backgroundColor: c.border,
              alignSelf: 'center',
              marginBottom: 16,
            }}
          />
          <ScrollView
            style={{ maxHeight: height * 0.8 - 140 }}
            contentContainerStyle={{ paddingBottom: 8 }}
          >
            <Text
              accessibilityRole="header"
              style={{
                color: c.ink,
                fontFamily: 'NotoSansGeorgian_700Bold',
                fontSize: 18,
                lineHeight: 26,
                marginBottom: 10,
              }}
            >
              {copy.title}
            </Text>
            <Text
              style={{
                color: c.muted,
                fontFamily: 'NotoSansGeorgian_400Regular',
                fontSize: 14,
                lineHeight: 22,
              }}
            >
              {copy.body}
            </Text>
          </ScrollView>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={ka.common.close}
            style={{
              marginTop: 16,
              minHeight: 48,
              borderRadius: 18,
              backgroundColor: c.cardSoft,
              borderWidth: 1,
              borderColor: c.border,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: c.ink, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 15 }}>
              {ka.common.close}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
