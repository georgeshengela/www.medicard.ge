import React, { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { UserRoundCheck } from 'lucide-react-native';
import { AuthPrimaryButton } from '@/components/auth/AuthPrimaryButton';
import { useFigmaAuth } from '@/constants/figmaAuthLayout';
import { tx } from '@/i18n/locale';
import { authErrorMessage } from '@/lib/authErrorMessage';
import { useIsDark, useThemeColors } from '@/theme/colors';
import { hubInk, hubTint } from '@/theme/hub';

/**
 * First screen of a brand-new account (owner 2026-10-05): „MEDICARD უკვე გამოგიყენებია?“.
 * Someone who started on the web with a phone and now signed up in the app with an email says
 * „კი“ here: the just-created empty account is removed and they go back to sign in the old way.
 */
export function ExistingAccountCheck({
  onNew,
  onHaveAccount,
}: {
  onNew: () => void;
  /** Removes the new account and signs out; throws when it is not allowed (it already holds data). */
  onHaveAccount: () => Promise<void>;
}) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const dark = useIsDark();
  const auth = useFigmaAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);

  const haveAccount = async () => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      await onHaveAccount();
    } catch (e) {
      setError(authErrorMessage(e));
      lock.current = false;
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface, paddingTop: insets.top + 24, paddingHorizontal: 24, paddingBottom: Math.max(insets.bottom, 16) + 8 }}>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: hubTint(hubInk('teal', dark), dark), alignItems: 'center', justifyContent: 'center' }}>
          <UserRoundCheck size={28} color={hubInk('teal', dark)} strokeWidth={1.9} />
        </View>
        <Text style={{ marginTop: 22, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 24, lineHeight: 33, color: colors.text100 }}>
          {tx('MEDICARD უკვე გამოგიყენებია?', 'Have you used MEDICARD before?')}
        </Text>
        <Text style={{ marginTop: 10, fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 15, lineHeight: 23, color: colors.text200 }}>
          {tx(
            'თუ ანგარიში უკვე გაქვს — ნომრით, ელ-ფოსტით, Apple-ით ან Google-ით, აპში ან ვებზე — შედი იმავე გზით. ასე ყველაფერი ერთ ანგარიშზე დარჩება.',
            'If you already have an account — with a phone number, email, Apple or Google, in the app or on the web — sign in the same way. That keeps everything on one account.',
          )}
        </Text>
        {error ? (
          <Text accessibilityLiveRegion="polite" style={{ marginTop: 14, fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, lineHeight: 20, color: colors.danger }}>
            {error}
          </Text>
        ) : null}
      </View>

      <View style={{ gap: 12 }}>
        <AuthPrimaryButton label={tx('არა, პირველად ვარ', 'No, I am new here')} disabled={busy} onPress={onNew} />
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => void haveAccount()}
          style={{
            minHeight: auth.primaryMinHeight,
            borderRadius: auth.primaryRadius,
            borderWidth: 1.5,
            borderColor: dark ? 'rgba(20,184,166,0.55)' : '#5EEAD4',
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 16,
          }}
        >
          {busy ? (
            <ActivityIndicator color={hubInk('teal', dark)} />
          ) : (
            <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 15, color: dark ? '#99F6E4' : '#0F766E' }}>
              {tx('კი, ანგარიში უკვე მაქვს', 'Yes, I already have an account')}
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}
