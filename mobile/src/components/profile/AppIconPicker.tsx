import React, { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Check, X } from 'lucide-react-native';
import { APP_MODAL_OVERLAY, APP_MODAL_PROPS, Modal } from '@/components/ui/appModal';
import { APP_ICONS, currentAppIcon, setAppIcon, type AppIconId } from '@/lib/appIcon';
import { useAuth } from '@/store/AuthContext';
import { tx } from '@/i18n/locale';
import { HUB, hubText } from '@/theme/hub';
import { useIsDark, useThemeColors } from '@/theme/colors';

const ROSE = { light: '#C92A55', dark: '#FF8FA8' };

/**
 * „აპის აიქონი“ — the home-screen icon. One tap switches it at once (iOS confirms with its own
 * alert). The rose icon carries „შენთვის“ for women; every icon is open to everyone.
 */
export function AppIconPicker({
  visible,
  onClose,
  onChanged,
}: {
  visible: boolean;
  onClose: () => void;
  onChanged: (id: AppIconId) => void;
}) {
  const c = useThemeColors();
  const dark = useIsDark();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { user } = useAuth();
  const [current, setCurrent] = useState<AppIconId>('classic');
  const [busy, setBusy] = useState(false);
  const female = user?.gender === 'FEMALE';
  const columns = width < 360 ? 2 : 3;
  const tileWidth = (width - HUB.gutter * 2 - 12 * (columns - 1)) / columns;

  useEffect(() => {
    if (visible) setCurrent(currentAppIcon());
  }, [visible]);

  const pick = async (id: AppIconId) => {
    if (busy || id === current) return;
    setBusy(true);
    void Haptics.selectionAsync().catch(() => undefined);
    const now = await setAppIcon(id);
    setCurrent(now);
    onChanged(now);
    setBusy(false);
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
          style={[s.sheet, { backgroundColor: c.surface, paddingBottom: insets.bottom + 16, maxHeight: height * 0.9 }]}
        >
          <View style={[s.handle, { backgroundColor: c.bg300 }]} />
          <View style={s.head}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text accessibilityRole="header" style={[hubText.sectionTitle, { color: c.text100 }]}>
                {tx('აპის აიქონი', 'App icon')}
              </Text>
              <Text style={[hubText.body, { color: c.text200 }]}>
                {tx('აირჩიე, როგორ გამოჩნდეს MEDICARD ტელეფონის ეკრანზე.', 'Choose how MEDICARD looks on your home screen.')}
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
          <ScrollView style={{ flexShrink: 1 }} bounces={false} showsVerticalScrollIndicator={false}>
            <View accessibilityRole="radiogroup" style={s.grid}>
              {APP_ICONS.map((icon) => {
                const selected = icon.id === current;
                const forYou = female && icon.id === 'rose';
                const rose = dark ? ROSE.dark : ROSE.light;
                return (
                  <Pressable
                    key={icon.id}
                    accessibilityRole="radio"
                    accessibilityState={{ selected, disabled: busy }}
                    accessibilityLabel={icon.name}
                    disabled={busy}
                    onPress={() => void pick(icon.id)}
                    style={[s.tile, { width: tileWidth }]}
                  >
                    <View style={[s.frame, { borderColor: selected ? c.primary200 : 'transparent' }]}>
                      <Image source={icon.thumb} style={s.icon} accessibilityIgnoresInvertColors />
                      {selected ? (
                        <View style={[s.check, { backgroundColor: c.primary200, borderColor: c.surface }]}>
                          <Check size={13} color="#FFFFFF" strokeWidth={3} />
                        </View>
                      ) : null}
                    </View>
                    <Text numberOfLines={1} style={[hubText.caption, { color: selected ? c.text100 : c.text200, fontFamily: 'NotoSansGeorgian_600SemiBold' }]}>
                      {icon.name}
                    </Text>
                    {forYou ? <Text style={[s.badge, { color: rose }]}>{tx('შენთვის', 'For you')}</Text> : null}
                  </Pressable>
                );
              })}
            </View>
            <Text style={[hubText.small, { color: c.text200, marginTop: 14 }]}>
              {tx(
                'შეცვლისას iPhone მოკლე შეტყობინებას აჩვენებს — ეს Apple-ის წესია. აპი და მონაცემები იგივე რჩება.',
                'iPhone shows a short notice when the icon changes — that is Apple’s rule. The app and your data stay the same.',
              )}
            </Text>
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
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, rowGap: 18 },
  tile: { alignItems: 'center', gap: 6, minHeight: 44 },
  frame: { padding: 3, borderRadius: 26, borderWidth: 2.5 },
  icon: { width: 76, height: 76, borderRadius: 19 },
  check: {
    position: 'absolute',
    right: -4,
    top: -4,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: { fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 10, lineHeight: 14, marginTop: -4 },
});
