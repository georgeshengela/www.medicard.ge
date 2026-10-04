import React, { useMemo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { APP_MODAL_OVERLAY, APP_MODAL_PROPS, Modal } from '@/components/ui/appModal';
import { LabFlaskTriangle } from '@/components/lab/LabIcons';
import { useMedilab } from '@/components/lab/MedilabUI';
import { ka } from '@/i18n/ka';
import { explainLabParam, formatPrintedNorm } from '@/lib/labExplain';
import type { LabParameter } from '@/types/lab';

type Props = {
  visible: boolean;
  param: LabParameter | null;
  onClose: () => void;
};

export function LabParamExplainSheet({ visible, param, onClose }: Props) {
  const M = useMedilab();
  const insets = useSafeAreaInsets();
  const copy = useMemo(() => (param ? explainLabParam(param) : null), [param]);
  const printed = param ? formatPrintedNorm(param) : null;
  if (!param || !copy) return null;

  const flag = param.flag;
  const flagLabel = flag === 'H' ? ka.lab.above : flag === 'L' ? ka.lab.below : flag === 'N' ? ka.lab.normal : ka.lab.unknown;
  const flagColor = flag === 'N' ? M.normal : flag === 'U' ? M.c.text200 : M.attention;

  const blocks = [
    { title: ka.lab.explainWhat, body: copy.what },
    { title: ka.lab.explainWhy, body: copy.why },
    { title: ka.lab.explainTypical, body: copy.typicalNorm },
    ...(printed ? [{ title: ka.lab.explainYourNorm, body: printed }] : []),
    { title: ka.lab.explainHigh, body: copy.high },
    { title: ka.lab.explainLow, body: copy.low },
    { title: ka.lab.explainNote, body: copy.note },
  ];

  return (
    <Modal visible={visible} {...APP_MODAL_PROPS} onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: APP_MODAL_OVERLAY }} onPress={onClose} />
        <View
          style={{
            backgroundColor: M.c.surface,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            maxHeight: '88%',
            paddingTop: 12,
            paddingBottom: Math.max(insets.bottom, 16),
          }}
        >
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: M.c.bg300, alignSelf: 'center', marginBottom: 16 }} />
          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 8, gap: 16 }} showsVerticalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 16,
                  backgroundColor: M.inkSoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <LabFlaskTriangle color={M.ink} />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 12, lineHeight: 16, color: M.c.text200 }}>
                  {ka.lab.explainKicker}
                </Text>
                <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 22, lineHeight: 28, letterSpacing: -0.3, color: M.c.text100 }}>
                  {copy.title}
                </Text>
                <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 14, lineHeight: 20, color: M.ink }}>
                  {copy.alsoKnown}
                </Text>
              </View>
            </View>

            <View
              style={{
                backgroundColor: M.c.bg100,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: M.c.bg300,
                padding: 16,
                gap: 8,
              }}
            >
              <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 12, lineHeight: 16, color: M.c.text200 }}>
                {ka.lab.yourValue}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6 }}>
                <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 28, lineHeight: 34, color: M.c.text100 }}>
                  {param.display}
                </Text>
                {param.unit ? (
                  <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 16, lineHeight: 24, color: M.c.text200, paddingBottom: 2 }}>
                    {param.unit}
                  </Text>
                ) : null}
              </View>
              <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, lineHeight: 20, color: flagColor }}>
                {flagLabel}
                {printed ? `  ·  ${printed}` : ''}
              </Text>
            </View>

            {blocks.map((block) => (
              <View key={block.title} style={{ gap: 6 }}>
                <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, lineHeight: 20, color: M.ink }}>
                  {block.title}
                </Text>
                <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 15, lineHeight: 22, color: M.c.text100 }}>
                  {block.body}
                </Text>
              </View>
            ))}

            <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 12, lineHeight: 18, color: M.c.text300 }}>
              {ka.lab.explainDisclaimer}
            </Text>

            <Pressable
              onPress={onClose}
              style={{
                backgroundColor: M.ink,
                minHeight: 52,
                borderRadius: 14,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: '#FFFFFF', fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 16 }}>{ka.lab.explainClose}</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
