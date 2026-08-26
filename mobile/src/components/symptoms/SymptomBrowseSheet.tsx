import React from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { FIGMA_SYMPTOMS as T } from '@/constants/figmaSymptomsLayout';
import { ka } from '@/i18n/ka';
import { SymptomCta } from './SymptomCta';
import { SymptomCheckbox } from './SymptomCheckbox';

type Props = {
  visible: boolean;
  title: string;
  onClose: () => void;
  onApply: () => void;
  applyDisabled?: boolean;
  children: React.ReactNode;
};

/** Figma stacked bottom sheet — Browse Organs / Browse Body Areas. */
export function SymptomBrowseSheet({ visible, title, onClose, onApply, applyDisabled, children }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(229,231,235,0.92)' }} onPress={onClose} />

        <View style={{ marginHorizontal: 33, height: 12, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: 'rgba(255,255,255,0.5)' }} />
        <View style={{ marginHorizontal: 16, marginTop: -8, height: 16, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: 'rgba(255,255,255,0.72)' }} />

        <View
          style={{
            backgroundColor: T.white,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            maxHeight: '82%',
            paddingBottom: Math.max(insets.bottom, 8),
          }}
        >
          <View style={{ alignItems: 'center', paddingTop: 8 }}>
            <View style={{ width: 36, height: 5, borderRadius: 100, backgroundColor: T.border }} />
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, gap: 16 }}>
            <Text style={{ flex: 1, fontSize: 18, lineHeight: 24, fontWeight: '600', color: T.textPrimary }}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={12} style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
              <X size={22} color={T.textPrimary} strokeWidth={2} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8 }}>
            {children}
          </ScrollView>

          <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
            <SymptomCta label={ka.symptoms.apply} onPress={onApply} disabled={applyDisabled} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

type OrganRowProps = {
  label: string;
  icon: React.ReactNode;
  selected: boolean;
  onPress: () => void;
};

export function SymptomOrganBrowseRow({ label, icon, selected, onPress }: OrganRowProps) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        marginBottom: 8,
        borderRadius: T.itemRadius,
        borderWidth: 1,
        borderColor: selected ? T.brand : T.border,
        backgroundColor: selected ? T.brandSoft : T.cardBg,
        ...T.shadowXs,
      }}
    >
      <View style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}>{icon}</View>
      <Text style={{ flex: 1, fontSize: 16, lineHeight: 22, fontWeight: '600', color: T.textPrimary }}>{label}</Text>
      <SymptomCheckbox checked={selected} />
    </Pressable>
  );
}

type BodyTileProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  children: React.ReactNode;
};

export function SymptomBodyAreaTile({ label, selected, onPress, children }: BodyTileProps) {
  return (
    <Pressable onPress={onPress} style={{ width: '31%', alignItems: 'center', marginBottom: 16 }}>
      <View
        style={{
          width: '100%',
          aspectRatio: 88 / 128,
          borderRadius: 16,
          borderWidth: selected ? 1 : 0,
          borderColor: selected ? T.brand : 'transparent',
          backgroundColor: selected ? T.brandSoft : 'transparent',
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {children}
      </View>
      <Text style={{ marginTop: 8, fontSize: 14, lineHeight: 20, fontWeight: '500', color: T.textSecondary, textAlign: 'center' }}>
        {label}
      </Text>
    </Pressable>
  );
}
