import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronRight, UserPlus } from 'lucide-react-native';
import { useFigmaAuth } from '@/constants/figmaAuthLayout';
import { ka } from '@/i18n/ka';
import { tx } from '@/i18n/locale';
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

/** Sign-in → sign-up: a tinted card button (owner: a text link was too easy to miss). */
export function SignInSwitchLink() {
  const router = useRouter();
  const auth = useFigmaAuth();
  const dark = useIsDark();
  const teal = '#14B8A6';

  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1, height: 1, backgroundColor: auth.dividerColor }} />
        <Text
          style={{
            fontFamily: 'NotoSansGeorgian_400Regular',
            fontSize: 13,
            lineHeight: 18,
            color: auth.textMuted,
          }}
        >
          {ka.auth.noAccount}
        </Text>
        <View style={{ flex: 1, height: 1, backgroundColor: auth.dividerColor }} />
      </View>

      <TouchableOpacity
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={ka.auth.signUpTitle}
        onPress={() => router.replace('/(auth)/sign-up')}
        style={{ width: '100%' }}
      >
        <View
          pointerEvents="none"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,
            minHeight: 64,
            paddingVertical: 12,
            paddingLeft: 12,
            paddingRight: 16,
            borderRadius: auth.primaryRadius,
            borderWidth: 1.5,
            borderColor: dark ? 'rgba(20,184,166,0.45)' : '#99F6E4',
            backgroundColor: dark ? 'rgba(20,184,166,0.12)' : '#F0FDFA',
          }}
        >
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: dark ? '#0D9488' : teal,
            }}
          >
            <UserPlus size={20} color="#FFFFFF" strokeWidth={2.2} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text
              style={{
                fontFamily: 'NotoSansGeorgian_700Bold',
                fontSize: 16,
                lineHeight: 22,
                color: dark ? '#99F6E4' : '#0F766E',
              }}
            >
              {ka.auth.signUpTitle}
            </Text>
            <Text
              style={{
                fontFamily: 'NotoSansGeorgian_400Regular',
                fontSize: 13,
                lineHeight: 18,
                color: auth.textSecondary,
              }}
            >
              {tx('უფასოა — ყველა ფუნქციით', 'Free — every feature included')}
            </Text>
          </View>
          <ChevronRight size={20} color={dark ? '#99F6E4' : '#0F766E'} />
        </View>
      </TouchableOpacity>
    </View>
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
