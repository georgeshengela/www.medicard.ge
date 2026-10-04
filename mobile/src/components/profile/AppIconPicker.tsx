import React, { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Check, X } from 'lucide-react-native';
import { APP_MODAL_OVERLAY, APP_MODAL_PROPS, Modal } from '@/components/ui/appModal';
import { APP_ICON_GROUPS, APP_ICONS, currentAppIcon, setAppIcon, type AppIconId, type AppIconInfo } from '@/lib/appIcon';
import { useAuth } from '@/store/AuthContext';
import { tx } from '@/i18n/locale';
import { HUB, hubText } from '@/theme/hub';
import { useIsDark, useThemeColors } from '@/theme/colors';

const ROSE = { light: '#C92A55', dark: '#FF8FA8' };

/**
 * „აპის აიქონი“ — the home-screen icon. Icons come in three groups (classic colours, the feminine
 * set, styles), each row with its picture, name and one line about it; one tap switches the icon at
 * once (iOS confirms with its own alert). Women see the feminine group first, marked „შენთვის“;
 * every icon is open to everyone.
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
  const { height } = useWindowDimensions();
  const { user } = useAuth();
  const [current, setCurrent] = useState<AppIconId>('classic');
  const [busy, setBusy] = useState(false);
  const female = user?.gender === 'FEMALE';
  const rose = dark ? ROSE.dark : ROSE.light;

  const groups = useMemo(() => {
    const order = female ? ['women', 'core', 'styles'] : ['core', 'women', 'styles'];
    return order
      .map((id) => ({ ...APP_ICON_GROUPS.find((g) => g.id === id)!, icons: APP_ICONS.filter((icon) => icon.group === id) }))
      .filter((g) => g.icons.length > 0);
  }, [female]);

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

  const row = (icon: AppIconInfo, last: boolean) => {
    const selected = icon.id === current;
    return (
      <Pressable
        key={icon.id}
        accessibilityRole="radio"
        accessibilityState={{ selected, disabled: busy }}
        accessibilityLabel={`${icon.name}. ${icon.note}`}
        disabled={busy}
        onPress={() => void pick(icon.id)}
        className="active:opacity-70"
        style={[s.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.bg300 }]}
      >
        <Image source={icon.thumb} style={s.thumb} accessibilityIgnoresInvertColors />
        <View style={s.copy}>
          <Text numberOfLines={1} style={[s.name, { color: c.text100 }]}>{icon.name}</Text>
          <Text numberOfLines={2} style={[hubText.caption, { color: c.text200 }]}>{icon.note}</Text>
        </View>
        <View
          style={[
            s.radio,
            selected ? { backgroundColor: c.primary200, borderColor: c.primary200 } : { borderColor: c.bg300 },
          ]}
        >
          {selected ? <Check size={14} color="#FFFFFF" strokeWidth={3} /> : null}
        </View>
      </Pressable>
    );
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
          style={[s.sheet, { backgroundColor: c.surface, paddingBottom: insets.bottom + 12, maxHeight: height * 0.9 }]}
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
          <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ gap: 18, paddingBottom: 4 }} showsVerticalScrollIndicator={false}>
            {groups.map((group) => (
              <View key={group.id} accessibilityRole="radiogroup" style={{ gap: 8 }}>
                <View style={s.groupHead}>
                  <Text accessibilityRole="header" style={[s.groupTitle, { color: c.text100 }]}>{group.title}</Text>
                  {female && group.id === 'women' ? <Text style={[s.badge, { color: rose }]}>{tx('შენთვის', 'For you')}</Text> : null}
                  <Text style={[hubText.small, { color: c.text300 }]}>{group.icons.length}</Text>
                </View>
                <View style={[s.card, { backgroundColor: c.bg100 }]}>
                  {group.icons.map((icon, i) => row(icon, i === group.icons.length - 1))}
                </View>
              </View>
            ))}
            <Text style={[hubText.small, { color: c.text200 }]}>
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
  groupHead: { flexDirection: 'row', alignItems: 'baseline', gap: 8, paddingHorizontal: 4 },
  groupTitle: { fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 15, lineHeight: 21 },
  badge: { fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 11, lineHeight: 16 },
  card: { borderRadius: 20, paddingHorizontal: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, minHeight: 72 },
  thumb: { width: 52, height: 52, borderRadius: 12 },
  copy: { flex: 1, minWidth: 0, gap: 1 },
  name: { fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 15, lineHeight: 21 },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
