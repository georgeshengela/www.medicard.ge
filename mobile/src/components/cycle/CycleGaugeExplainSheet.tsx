import React from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { APP_MODAL_PROPS } from '@/components/ui/appModal';
import { ka } from '@/i18n/ka';
import { useCycleColors } from '@/theme/cycle';

export type GaugeExplain = {
  title: string;
  range?: string;
  body: string;
  accent: 'pink' | 'purple';
};

type Props = {
  visible: boolean;
  explain: GaugeExplain | null;
  onClose: () => void;
};

export function CycleGaugeExplainSheet({ visible, explain, onClose }: Props) {
  const c = useCycleColors();
  const insets = useSafeAreaInsets();
  if (!explain) return null;
  const accent = explain.accent === 'purple' ? c.fertile : c.brand;

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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: accent }} />
            <Text
              style={{
                color: c.ink,
                fontFamily: 'NotoSansGeorgian_700Bold',
                fontSize: 18,
                lineHeight: 25,
                flex: 1,
              }}
            >
              {explain.title}
            </Text>
          </View>
          {explain.range ? (
            <Text
              style={{
                color: accent,
                fontFamily: 'NotoSansGeorgian_600SemiBold',
                fontSize: 15,
                lineHeight: 22,
                marginBottom: 8,
              }}
            >
              {explain.range}
            </Text>
          ) : null}
          <Text style={{ color: c.muted, fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 14, lineHeight: 21 }}>
            {explain.body}
          </Text>
          <Text
            style={{
              color: c.mutedSoft,
              fontFamily: 'NotoSansGeorgian_400Regular',
              fontSize: 12,
              lineHeight: 18,
              marginTop: 14,
            }}
          >
            {ka.cycle.gaugeRingCaption}
          </Text>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={ka.common.close}
            style={{
              marginTop: 18,
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
