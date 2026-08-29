import React from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { APP_MODAL_PROPS } from '@/components/ui/appModal';
import { useFigmaSymptoms } from '@/constants/figmaSymptomsLayout';
import { SymptomCta } from './SymptomCta';

type Props = {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  ctaLabel?: string;
  onCta?: () => void;
  ctaDisabled?: boolean;
};

export function SymptomSheet({ visible, title, subtitle, onClose, children, ctaLabel, onCta, ctaDisabled }: Props) {
  const T = useFigmaSymptoms();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} {...APP_MODAL_PROPS} onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.45)' }} onPress={onClose} />
        <View
          style={{
            backgroundColor: T.white,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            maxHeight: '88%',
            paddingBottom: Math.max(insets.bottom, 16),
          }}
        >
          <View style={{ alignItems: 'center', paddingTop: 10 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: T.borderTertiary }} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 }}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={{ fontSize: 20, lineHeight: 28, fontWeight: '700', color: T.textPrimary }}>{title}</Text>
              {subtitle ? (
                <Text style={{ marginTop: 4, fontSize: 14, lineHeight: 20, color: T.textSecondary }}>{subtitle}</Text>
              ) : null}
            </View>
            <Pressable onPress={onClose} hitSlop={10} style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}>
              <X size={20} color={T.brand} strokeWidth={2.2} />
            </Pressable>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 12 }}>
            {children}
          </ScrollView>
          {ctaLabel && onCta ? (
            <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
              <SymptomCta label={ctaLabel} onPress={onCta} disabled={ctaDisabled} />
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}
