import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useFigmaAuth } from '@/constants/figmaAuthLayout';
import { ka } from '@/i18n/ka';
import type { VelvetPalette } from '@/theme/velvet';

type Props = {
  prompt: string;
  linkLabel: string;
  href: '/(auth)/sign-in' | '/(auth)/sign-up';
  /** When true, pop the stack if possible (e.g. sign-up → sign-in). */
  preferBack?: boolean;
  /** Velvet screens pass their palette for the ink. */
  palette?: VelvetPalette;
};

/** Auth screen switcher — full-width tap target. */
export function AuthSwitchLink({ prompt, linkLabel, href, preferBack = false, palette }: Props) {
  const router = useRouter();
  const auth = useFigmaAuth();

  const go = () => {
    if (preferBack && router.canGoBack()) {
      router.back();
      return;
    }
    router.replace(href);
  };

  return (
    <TouchableOpacity
      activeOpacity={0.65}
      accessibilityRole="link"
      accessibilityLabel={linkLabel}
      onPress={go}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      style={{
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 12,
        paddingBottom: 4,
        paddingHorizontal: 16,
      }}
    >
      <Text
        style={{
          textAlign: 'center',
          fontFamily: 'NotoSansGeorgian_400Regular',
          fontSize: 14,
          lineHeight: 20,
          color: palette ? palette.ink2 : auth.textSecondary,
        }}
      >
        {prompt}{' '}
        <Text
          style={{
            fontFamily: 'NotoSansGeorgian_700Bold',
            fontSize: 14,
            lineHeight: 20,
            color: palette ? palette.ink : auth.linkColor,
          }}
        >
          {linkLabel}
        </Text>
      </Text>
    </TouchableOpacity>
  );
}

export function SignUpSwitchLink({ palette }: { palette?: VelvetPalette } = {}) {
  return (
    <AuthSwitchLink
      prompt={ka.auth.hasAccount}
      linkLabel={ka.auth.signIn}
      href="/(auth)/sign-in"
      preferBack
      palette={palette}
    />
  );
}
