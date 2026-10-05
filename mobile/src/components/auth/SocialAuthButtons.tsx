import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppleLogo, GoogleLogo } from '@/components/auth/BrandLogos';
import { useFigmaAuth } from '@/constants/figmaAuthLayout';
import { tx } from '@/i18n/locale';
import { authErrorMessage } from '@/lib/authErrorMessage';
import { setPendingSocialLink } from '@/lib/socialLinkState';
import { SocialSignInError, appleSignInAvailable, googleSignInAvailable } from '@/lib/socialSignIn';
import { useAuth, type SocialProvider, type SocialSignInResult } from '@/store/AuthContext';
import { useIsDark, useThemeColors } from '@/theme/colors';

// Dev web preview shows both buttons so the layout can be reviewed; tapping explains they need the app.
const PREVIEW_ON_WEB = __DEV__ && Platform.OS === 'web';

type ButtonProps = {
  provider: SocialProvider;
  busy: boolean;
  disabled: boolean;
  onPress: () => void;
};

/**
 * Apple: black on light / white on dark (Apple HIG). Google: white with a hairline border and the
 * four-colour G (Google branding; white stays white on dark — owner rule "Google on dark is white").
 * The two sit side by side at the same size, radius and weight, so neither is more prominent
 * (App Review 4.8); screen readers still hear the full "Continue with …" label.
 */
function ProviderButton({ provider, busy, disabled, onPress }: ButtonProps) {
  const auth = useFigmaAuth();
  const dark = useIsDark();
  const apple = provider === 'apple';
  const background = apple ? (dark ? '#FFFFFF' : '#000000') : '#FFFFFF';
  const ink = apple ? (dark ? '#000000' : '#FFFFFF') : '#1F1F1F';
  const name = apple ? 'Apple' : 'Google';
  const label = apple ? tx('Apple-ით გაგრძელება', 'Continue with Apple') : tx('Google-ით გაგრძელება', 'Continue with Google');

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || busy, busy }}
      activeOpacity={0.85}
      disabled={disabled || busy}
      onPress={onPress}
      style={{ flex: 1 }}
    >
      <View
        pointerEvents="none"
        style={{
          minHeight: auth.primaryMinHeight,
          borderRadius: auth.primaryRadius,
          backgroundColor: background,
          borderWidth: apple ? 0 : 1,
          borderColor: dark ? '#FFFFFF' : '#D1D5DB',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          paddingHorizontal: 12,
          opacity: disabled && !busy ? 0.5 : 1,
        }}
      >
        <View style={{ width: 20, height: 20, alignItems: 'center', justifyContent: 'center' }}>
          {busy ? (
            <ActivityIndicator size="small" color={apple ? ink : '#4285F4'} />
          ) : apple ? (
            <AppleLogo size={18} color={ink} />
          ) : (
            <GoogleLogo size={18} />
          )}
        </View>
        <Text
          numberOfLines={1}
          style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 16, lineHeight: 22, color: ink }}
        >
          {name}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

/** "Continue with Apple / Google" block for sign-in and sign-up, with an "or with email" divider under it. */
export function SocialAuthButtons({ dividerLabel }: { dividerLabel?: string } = {}) {
  const router = useRouter();
  const auth = useFigmaAuth();
  const colors = useThemeColors();
  const { signInWithApple, signInWithGoogle } = useAuth();
  const [apple, setApple] = useState(PREVIEW_ON_WEB);
  const [google] = useState(() => PREVIEW_ON_WEB || googleSignInAvailable());
  const [busy, setBusy] = useState<SocialProvider | null>(null);
  const [error, setError] = useState<string | null>(null);
  const running = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    if (!PREVIEW_ON_WEB) {
      void appleSignInAvailable().then((available) => {
        if (mounted.current) setApple(available);
      });
    }
    return () => {
      mounted.current = false;
    };
  }, []);

  const start = async (provider: SocialProvider) => {
    if (running.current) return;
    running.current = true;
    setBusy(provider);
    setError(null);
    try {
      if (PREVIEW_ON_WEB) {
        throw new SocialSignInError(tx('ეს ღილაკი მხოლოდ აპში მუშაობს.', 'This button works in the app only.'), 'preview');
      }
      const result: SocialSignInResult = provider === 'apple' ? await signInWithApple() : await signInWithGoogle();
      if (result.status === 'link') {
        setPendingSocialLink({ provider: result.provider, email: result.email, linkToken: result.linkToken });
        router.push('/(auth)/link-account');
      }
      // signed-in: AuthGate owns the destination (onboarding, Home or a pending share).
    } catch (caught) {
      if (!mounted.current) return;
      setError(caught instanceof SocialSignInError ? caught.message : authErrorMessage(caught));
    } finally {
      running.current = false;
      if (mounted.current) setBusy(null);
    }
  };

  if (!apple && !google) return null;

  return (
    <View style={{ gap: 20 }}>
      <View style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {apple ? <ProviderButton provider="apple" busy={busy === 'apple'} disabled={busy !== null} onPress={() => void start('apple')} /> : null}
          {google ? <ProviderButton provider="google" busy={busy === 'google'} disabled={busy !== null} onPress={() => void start('google')} /> : null}
        </View>

        {error ? (
          <View
            accessibilityLiveRegion="polite"
            style={{
              borderRadius: 16,
              borderWidth: 1,
              borderColor: colors.danger,
              backgroundColor: colors.dangerBg,
              paddingHorizontal: 16,
              paddingVertical: 12,
            }}
          >
            <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, lineHeight: 20, color: colors.danger }}>{error}</Text>
          </View>
        ) : null}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1, height: 1, backgroundColor: auth.dividerColor }} />
        <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13, lineHeight: 18, color: auth.textMuted }}>
          {dividerLabel ?? tx('ან ელ-ფოსტით', 'or with email')}
        </Text>
        <View style={{ flex: 1, height: 1, backgroundColor: auth.dividerColor }} />
      </View>
    </View>
  );
}
