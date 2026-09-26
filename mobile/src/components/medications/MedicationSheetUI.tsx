import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, X } from 'lucide-react-native';
import { APP_MODAL_OVERLAY, APP_MODAL_PROPS } from '@/components/ui/appModal';
import { MedsButton, MedsChip } from '@/components/medications/MedsHubUI';
import { ka } from '@/i18n/ka';
import { useThemeColors } from '@/theme/colors';
import { hubText } from '@/theme/hub';

type SheetProps = {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  contentStyle?: ViewStyle;
  /** Wrap the body in a ScrollView (for long option lists). */
  scrollable?: boolean;
};

/**
 * The one bottom sheet every medication picker uses: fading scrim (sibling,
 * never a parent), a flat `surface` sheet with a handle, a section-title
 * header and an optional pinned footer.
 */
export function MedicationSheetModal({ visible, title, subtitle, onClose, children, footer, contentStyle, scrollable }: SheetProps) {
  const c = useThemeColors();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} {...APP_MODAL_PROPS} onRequestClose={onClose}>
      <View style={s.root}>
        <Pressable style={s.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel={ka.common.close} />

        <View style={[s.sheet, { backgroundColor: c.surface, paddingBottom: Math.max(insets.bottom, 12) }]}>
          <View style={[s.handle, { backgroundColor: c.bg300 }]} />

          <View style={s.header}>
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <Text accessibilityRole="header" style={[hubText.sectionTitle, { color: c.text100 }]}>
                {title}
              </Text>
              {subtitle ? <Text style={[hubText.caption, { color: c.text200 }]}>{subtitle}</Text> : null}
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={ka.common.close}
              style={[s.close, { backgroundColor: c.bg200 }]}
            >
              <X size={18} color={c.text200} strokeWidth={2.2} />
            </Pressable>
          </View>

          {scrollable ? (
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              style={{ flexShrink: 1 }}
              contentContainerStyle={[s.body, contentStyle]}
            >
              {children}
            </ScrollView>
          ) : (
            <View style={[s.body, contentStyle]}>{children}</View>
          )}

          {footer ? <View style={s.footer}>{footer}</View> : null}
        </View>
      </View>
    </Modal>
  );
}

export function MedicationSheetApplyButton({ label, onPress, disabled }: { label?: string; onPress: () => void; disabled?: boolean }) {
  return <MedsButton label={label ?? ka.meds.sheetApply} onPress={onPress} disabled={disabled} icon={Check} />;
}

export function MedicationSheetChip({ label, active, onPress }: { label: string; active?: boolean; onPress: () => void }) {
  return <MedsChip label={label} active={active} onPress={onPress} />;
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: APP_MODAL_OVERLAY,
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '88%',
    paddingTop: 10,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 6,
  },
  close: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 8,
    flexShrink: 1,
    minHeight: 0,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 14,
  },
});
