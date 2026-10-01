import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { UserPlus } from 'lucide-react-native';
import { useFigmaAuth } from '@/constants/figmaAuthLayout';
import { ka } from '@/i18n/ka';
import { useIsDark } from '@/theme/colors';

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

/**
 * Sign-in → sign-up: the secondary button under „შესვლა“ in the pinned footer (owner: a text link was
 * too easy to miss). Outlined in the brand teal, same height and radius as the primary CTA.
 */
export function SignInSwitchLink() {
  const router = useRouter();
  const auth = useFigmaAuth();
  const dark = useIsDark();
  const ink = dark ? '#99F6E4' : '#0F766E';

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={ka.auth.signUpTitle}
      accessibilityHint={ka.auth.noAccount}
      onPress={() => router.replace('/(auth)/sign-up')}
      style={{ width: '100%' }}
    >
      <View
        pointerEvents="none"
        style={{
          minHeight: auth.primaryMinHeight,
          borderRadius: auth.primaryRadius,
          borderWidth: 1.5,
          borderColor: dark ? 'rgba(20,184,166,0.55)' : '#5EEAD4',
          backgroundColor: dark ? 'rgba(20,184,166,0.08)' : '#F0FDFA',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          paddingHorizontal: 20,
        }}
      >
        <UserPlus size={18} color={ink} strokeWidth={2.2} />
        <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 16, lineHeight: 22, color: ink }}>
          {ka.auth.signUpTitle}
        </Text>
      </View>
    </TouchableOpacity>
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
