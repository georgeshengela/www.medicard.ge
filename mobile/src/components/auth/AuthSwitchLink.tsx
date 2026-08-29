import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useFigmaAuth } from '@/constants/figmaAuthLayout';
import { ka } from '@/i18n/ka';

type Props = {
  prompt: string;
  linkLabel: string;
  href: '/(auth)/sign-in' | '/(auth)/sign-up';
  /** When true, pop the stack if possible (e.g. sign-up → sign-in). */
  preferBack?: boolean;
};

/** Auth screen switcher — full-width tap target. */
export function AuthSwitchLink({ prompt, linkLabel, href, preferBack = false }: Props) {
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
        paddingVertical: 14,
        paddingHorizontal: 16,
      }}
    >
      <Text
        style={{
          textAlign: 'center',
          fontFamily: 'NotoSansGeorgian_400Regular',
          fontSize: 14,
          lineHeight: 20,
          color: auth.textSecondary,
        }}
      >
        {prompt}{' '}
        <Text
          style={{
            fontFamily: 'NotoSansGeorgian_700Bold',
            fontSize: 14,
            lineHeight: 20,
            color: auth.linkColor,
          }}
        >
          {linkLabel}
        </Text>
      </Text>
    </TouchableOpacity>
  );
}

export function SignInSwitchLink() {
  return (
    <AuthSwitchLink prompt={ka.auth.noAccount} linkLabel={ka.auth.signUp} href="/(auth)/sign-up" />
  );
}

export function SignUpSwitchLink() {
  return (
    <AuthSwitchLink
      prompt={ka.auth.hasAccount}
      linkLabel={ka.auth.signIn}
      href="/(auth)/sign-in"
      preferBack
    />
  );
}
