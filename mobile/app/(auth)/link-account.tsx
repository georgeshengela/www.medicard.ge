import React, { useEffect, useRef, useState } from 'react';
import { Keyboard, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Lock } from 'lucide-react-native';
import { AuthShell } from '@/components/AuthShell';
import { AuthBackHeader } from '@/components/auth/AuthBackHeader';
import { AuthPrimaryButton } from '@/components/auth/AuthPrimaryButton';
import { AppleLogo, GoogleLogo } from '@/components/auth/BrandLogos';
import { Input } from '@/components/ui/Input';
import { useFigmaAuth } from '@/constants/figmaAuthLayout';
import { ka } from '@/i18n/ka';
import { tx } from '@/i18n/locale';
import { ApiError } from '@/lib/api';
import { authErrorMessage } from '@/lib/authErrorMessage';
import { pendingSocialLink, setPendingSocialLink } from '@/lib/socialLinkState';
import { useAuth } from '@/store/AuthContext';
import { useIsDark, useThemeColors } from '@/theme/colors';

/**
 * Apple / Google returned an email that an existing email+password account already uses.
 * The person proves that account once with its password; after that the provider signs in alone.
 * (Server rule: email sign-up never verified the address, so it is not linked automatically.)
 */
export default function LinkAccount() {
  const router = useRouter();
  const auth = useFigmaAuth();
  const colors = useThemeColors();
  const dark = useIsDark();
  const { linkSocialAccount } = useAuth();
  const [link] = useState(pendingSocialLink);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);

  useEffect(() => {
    // Opened without a pending sign-in (restart, deep link): nothing to link — back to sign-in.
    if (!link) router.replace('/(auth)/sign-in');
  }, [link, router]);

  if (!link) return null;
  const providerName = link.provider === 'apple' ? 'Apple' : 'Google';

  const submit = async () => {
    if (submitting.current || busy) return;
    if (!password) {
      setError(ka.common.required);
      return;
    }
    Keyboard.dismiss();
    submitting.current = true;
    setBusy(true);
    setError(null);
    try {
      await linkSocialAccount(link.linkToken, password);
      setPendingSocialLink(null);
      // AuthGate moves on to Home / onboarding once the session is set.
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'SOCIAL_LINK_EXPIRED') {
        setPendingSocialLink(null);
      }
      setError(authErrorMessage(caught));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };

  return (
    <AuthShell
      footer={
        <AuthPrimaryButton
          label={tx('დაკავშირება და შესვლა', 'Link and sign in')}
          loading={busy}
          onPress={() => void submit()}
        />
      }
    >
      <AuthBackHeader
        title={tx('ანგარიში უკვე გაქვს', 'You already have an account')}
        subtitle={tx(
          `${providerName}-ის ელ-ფოსტით Medicard-ის ანგარიში უკვე არსებობს. შეიყვანე მისი პაროლი ერთხელ — შემდეგ ${providerName}-ით ერთი შეხებით შეხვალ.`,
          `A Medicard account already uses this ${providerName} email. Enter its password once — after that you can sign in with ${providerName} in one tap.`,
        )}
      />

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          borderRadius: 16,
          paddingHorizontal: 14,
          paddingVertical: 12,
          marginBottom: 20,
          backgroundColor: dark ? 'rgba(20,184,166,0.12)' : '#F0FDFA',
        }}
      >
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: link.provider === 'apple' ? (dark ? '#FFFFFF' : '#000000') : '#FFFFFF',
          }}
        >
          {link.provider === 'apple' ? <AppleLogo size={18} color={dark ? '#000000' : '#FFFFFF'} /> : <GoogleLogo size={18} />}
        </View>
        <Text
          numberOfLines={1}
          style={{ flex: 1, fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 15, lineHeight: 21, color: colors.text100 }}
        >
          {link.email}
        </Text>
      </View>

      <Input
        label={ka.auth.password}
        placeholder={ka.auth.passwordPlaceholderSignIn}
        icon={Lock}
        value={password}
        onChangeText={(value) => {
          setPassword(value);
          setError(null);
        }}
        error={error ?? undefined}
        secure
        autoFocus
        autoCapitalize="none"
        autoComplete="current-password"
        returnKeyType="go"
        onSubmitEditing={() => void submit()}
        figma
      />

      <Pressable
        accessibilityRole="button"
        hitSlop={8}
        onPress={() => router.push({ pathname: '/(auth)/forgot-password/email', params: { email: link.email } })}
        style={{ alignSelf: 'flex-start', marginTop: 14, paddingVertical: 4 }}
      >
        <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 14, lineHeight: 20, color: auth.linkColor }}>
          {ka.auth.forgotPassword}
        </Text>
      </Pressable>
    </AuthShell>
  );
}
