import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFigmaAuth } from '@/constants/figmaAuthLayout';
import { appLang, setLanguageAndReload, tx, type AppLang } from '@/i18n/locale';
import { useThemeColors } from '@/theme/colors';

/** Each language names itself (endonym) and shows the other language's name for it. */
export const LANGUAGE_OPTIONS: { value: AppLang; badge: string; native: string; other: string }[] = [
  { value: 'ka', badge: 'ქა', native: 'ქართული', other: 'Georgian' },
  { value: 'en', badge: 'EN', native: 'English', other: 'ინგლისური' },
];

const SWITCH_COPY: Record<AppLang, { title: string; body: string; confirm: string; cancel: string }> = {
  ka: {
    title: 'ენის შეცვლა',
    body: 'აპი ქართულად გადაიტვირთება. შენი მონაცემები უცვლელი რჩება.',
    confirm: 'შეცვლა',
    cancel: 'გაუქმება',
  },
  en: {
    title: 'Change language',
    body: 'The app will restart in English. Your data stays exactly as it is.',
    confirm: 'Switch',
    cancel: 'Cancel',
  },
};

/** Asks before restarting in `lang`; `onStart` runs once the person confirms. */
export function confirmLanguageSwitch(lang: AppLang, onStart: () => Promise<void>) {
  const copy = SWITCH_COPY[lang];
  Alert.alert(copy.title, copy.body, [
    { text: copy.cancel, style: 'cancel' },
    { text: copy.confirm, onPress: () => void onStart() },
  ]);
}

/** Profile → Settings: two-option segmented control that restarts the app in the chosen language. */
export function LanguageSelect() {
  const colors = useThemeColors();
  const auth = useFigmaAuth();
  const current = appLang();
  const [pending, setPending] = useState<AppLang | null>(null);

  const choose = (lang: AppLang) => {
    if (lang === current || pending) return;
    confirmLanguageSwitch(lang, async () => {
      setPending(lang);
      await setLanguageAndReload(lang).finally(() => setPending(null));
    });
  };

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={tx('ენა', 'Language')}
      style={[styles.track, { borderColor: colors.bg300, backgroundColor: colors.bg200 }]}
    >
      {LANGUAGE_OPTIONS.map((option) => {
        const selected = (pending ?? current) === option.value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={option.native}
            onPress={() => choose(option.value)}
            style={[styles.chip, selected ? { backgroundColor: auth.primaryBg } : undefined]}
          >
            <View
              style={[
                styles.badge,
                { backgroundColor: selected ? 'rgba(255,255,255,0.22)' : colors.surface, borderColor: selected ? 'transparent' : colors.bg300 },
              ]}
            >
              <Text style={[styles.badgeText, { color: selected ? colors.onPrimary : colors.primary200 }]}>{option.badge}</Text>
            </View>
            <Text numberOfLines={1} style={[styles.label, { color: selected ? colors.onPrimary : colors.text200 }]}>
              {option.native}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 999,
    padding: 3,
    gap: 2,
  },
  chip: {
    flex: 1,
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 6,
    borderRadius: 999,
  },
  badge: {
    minWidth: 24,
    height: 20,
    paddingHorizontal: 4,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '700',
  },
  label: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
});
