import React, { useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { socialCopy } from '@/i18n/world/social.js';
import { useMediWorldSocialAvailable } from '@/lib/mediWorld/enabled';
import { useWorldStitch } from '@/theme/worldStitch';
import { WorldButton, WorldHeader, useWorldLocale } from '@/components/world/WorldChrome';

export function useSocialCopy() {
  const { locale, setLocale } = useWorldLocale();
  const copy = useMemo(() => socialCopy(locale), [locale]);
  return { locale, setLocale, copy };
}

export function SocialShell({
  titleKey,
  children,
  footer,
}: {
  titleKey: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const t = useWorldStitch();
  const { copy } = useSocialCopy();
  const enabled = useMediWorldSocialAvailable();
  const fontBody = { fontFamily: 'NotoSansGeorgian_400Regular' as const };
  const title = (copy as Record<string, string>)[titleKey] || copy.title;

  return (
    <View style={{ flex: 1, backgroundColor: t.surface }}>
      <WorldHeader title={title} backLabel={copy.back} />
      <ScrollView
        contentContainerStyle={{
          paddingBottom: Math.max(insets.bottom, 24) + 24,
          paddingHorizontal: 16,
          paddingTop: 12,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {enabled ? children : (
          <Text maxFontSizeMultiplier={1.6} style={{ ...fontBody, fontSize: 16, lineHeight: 24, color: t.onVariant, marginTop: 4 }}>
            {copy.socialOff}
          </Text>
        )}
        {enabled ? footer : null}
      </ScrollView>
    </View>
  );
}

export function SocialButton({
  label,
  onPress,
  disabled,
  danger,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return <WorldButton label={label} onPress={onPress} disabled={disabled} danger={danger} />;
}
