import React, { useEffect } from 'react';
import { AccessibilityInfo, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { ShieldCheck, X } from 'lucide-react-native';
import { APP_MODAL_OVERLAY, APP_MODAL_PROPS, Modal } from '@/components/ui/appModal';
import { HomeLayoutOptions } from '@/components/home/layout/HomeLayoutOptions';
import { useHomeLayout } from '@/hooks/useHomeLayout';
import { primaryGoalFromProfile } from '@/lib/assessmentForm';
import { useFeatureState } from '@/lib/featureFlags';
import { trackHomeLayoutChanged, trackHomeLayoutPickerOpened } from '@/lib/funnel';
import type { FunnelHomeLayoutSource } from '@/lib/funnelQueue';
import { HOME_LAYOUT_NAMES, recommendedHomeLayout, type HomeLayoutId } from '@/lib/home/homeLayout';
import { chooseHomeLayout } from '@/lib/home/homeLayoutStore';
import { useAuth } from '@/store/AuthContext';
import { tx } from '@/i18n/locale';
import { HUB, hubText } from '@/theme/hub';
import { useThemeColors } from '@/theme/colors';

type Props = {
  visible: boolean;
  onClose: () => void;
  source: Exclude<FunnelHomeLayoutSource, 'onboarding'>;
};

/**
 * „მთავარი გვერდი“ — pick one of the layouts. Applies at once (same Home screen, new order and
 * accent); the server write follows. Opened from the Home header, the row at the end of Home,
 * Profile → Settings and the women's offer card.
 */
export function HomeLayoutPicker({ visible, onClose, source }: Props) {
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { user, healthProfile } = useAuth();
  const features = useFeatureState();
  const { layout: current, chosen } = useHomeLayout();
  const gender = user?.gender;
  const recommended = recommendedHomeLayout(primaryGoalFromProfile(healthProfile), gender, features);

  useEffect(() => {
    if (visible) trackHomeLayoutPickerOpened(source);
  }, [visible, source]);

  const pick = (next: HomeLayoutId) => {
    // Compare with the saved choice, not the one shown: a paused module can show standard while
    // the saved choice is another layout, and tapping standard then must save standard.
    if (next !== (chosen ?? current)) {
      void Haptics.selectionAsync().catch(() => undefined);
      chooseHomeLayout(next, { offerDone: true });
      trackHomeLayoutChanged(next, current, source);
      AccessibilityInfo.announceForAccessibility(tx(`მთავარი გვერდი: ${HOME_LAYOUT_NAMES[next]}`, `Home layout: ${HOME_LAYOUT_NAMES[next]}`));
    }
    onClose();
  };

  return (
    <Modal visible={visible} {...APP_MODAL_PROPS} onRequestClose={onClose}>
      <View style={StyleSheet.absoluteFill}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tx('დახურვა', 'Close')}
          onPress={onClose}
          style={[StyleSheet.absoluteFill, { backgroundColor: APP_MODAL_OVERLAY }]}
        />
        <View
          accessibilityViewIsModal
          style={[s.sheet, { backgroundColor: c.surface, paddingBottom: insets.bottom + 16, maxHeight: height * 0.92 }]}
        >
          <View style={[s.handle, { backgroundColor: c.bg300 }]} />
          <View style={s.head}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text accessibilityRole="header" style={[hubText.sectionTitle, { color: c.text100 }]}>
                {tx('მთავარი გვერდი', 'Home layout')}
              </Text>
              <Text style={[hubText.body, { color: c.text200 }]}>
                {tx('აირჩიე, რა გამოჩნდეს პირველად. შეცვლა ნებისმიერ დროს შეგიძლია.', 'Choose what you want to see first. You can change it any time.')}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={tx('დახურვა', 'Close')}
              hitSlop={6}
              onPress={onClose}
              style={[s.close, { backgroundColor: c.bg100 }]}
            >
              <X size={17} color={c.text200} strokeWidth={2.2} />
            </Pressable>
          </View>
          <ScrollView style={{ flexShrink: 1 }} bounces={false} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 4 }}>
            <HomeLayoutOptions value={current} onSelect={pick} gender={gender} features={features} recommended={recommended} />
            <View style={s.foot}>
              <ShieldCheck size={14} color={c.text200} strokeWidth={2} />
              <Text style={[hubText.small, { color: c.text200, flex: 1 }]}>
                {tx(
                  'იცვლება მხოლოდ მთავარი გვერდის თანმიმდევრობა და იერი — შენი მონაცემები და ქვედა მენიუ იგივე რჩება.',
                  'Only the order and look of Home change — your data and the bottom menu stay the same.',
                )}
              </Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 10,
    paddingHorizontal: HUB.gutter,
    gap: 14,
  },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  close: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  foot: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14 },
});
