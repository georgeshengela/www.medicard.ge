import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, X } from 'lucide-react-native';
import { FIGMA_MEDS } from '@/constants/figmaMedicationsLayout';
import { ka } from '@/i18n/ka';

const OVERLAY = 'rgba(15, 23, 42, 0.52)';

type SheetProps = {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  contentStyle?: ViewStyle;
};

export function MedicationSheetModal({ visible, title, onClose, children, footer, contentStyle }: SheetProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel={ka.common.close} />

        <View style={styles.stackWrap} pointerEvents="none">
          <View style={styles.stackLayerOuter} />
          <View style={styles.stackLayerInner} />
        </View>

        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 8) }]}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={12} style={styles.closeHit}>
              <X size={24} color={FIGMA_MEDS.textPrimary} strokeWidth={2} />
            </Pressable>
          </View>

          <View style={[styles.body, contentStyle]}>{children}</View>

          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </View>
      </View>
    </Modal>
  );
}

export function MedicationSheetApplyButton({ label, onPress, disabled }: { label?: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={{
        backgroundColor: FIGMA_MEDS.brand,
        borderRadius: 16,
        minHeight: 48,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 10,
        opacity: disabled ? 0.6 : 1,
        ...FIGMA_MEDS.shadowInput,
      }}
    >
      <Text style={{ color: '#fff', fontWeight: '600', fontSize: 16 }}>{label ?? ka.meds.sheetApply}</Text>
      <Check size={20} color="#fff" strokeWidth={2.5} />
    </Pressable>
  );
}

export function MedicationSheetChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        minHeight: 32,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: active ? FIGMA_MEDS.brand : FIGMA_MEDS.borderTertiary,
        backgroundColor: active ? FIGMA_MEDS.brandQuaternary : FIGMA_MEDS.cardBg,
        ...FIGMA_MEDS.shadowInput,
      }}
    >
      <Text style={{ fontSize: 14, fontWeight: '500', color: active ? FIGMA_MEDS.brand : FIGMA_MEDS.textPrimary }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: OVERLAY,
  },
  stackWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 52,
    alignItems: 'stretch',
  },
  stackLayerOuter: {
    position: 'absolute',
    left: 33,
    right: 33,
    bottom: 8,
    height: 24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  stackLayerInner: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
    height: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.72)',
  },
  sheet: {
    backgroundColor: FIGMA_MEDS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '88%',
    borderTopWidth: 1,
    borderColor: FIGMA_MEDS.border,
  },
  body: {
    paddingHorizontal: 16,
    flexShrink: 1,
    minHeight: 0,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: FIGMA_MEDS.borderTertiary,
    backgroundColor: FIGMA_MEDS.white,
  },
  handle: {
    width: 36,
    height: 5,
    borderRadius: 100,
    backgroundColor: FIGMA_MEDS.border,
    alignSelf: 'center',
    marginTop: 5,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 4,
    minHeight: 40,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 24,
    color: FIGMA_MEDS.textPrimary,
  },
  closeHit: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
