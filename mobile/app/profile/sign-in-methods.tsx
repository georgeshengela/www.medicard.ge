import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, ChevronLeft, ChevronRight, Mail, Smartphone } from 'lucide-react-native';
import { AccountConflictSheet } from '@/components/auth/AccountConflictSheet';
import { AppleLogo, GoogleLogo } from '@/components/auth/BrandLogos';
import { useAccountQuery } from '@/hooks/useAccountQuery';
import { tx } from '@/i18n/locale';
import { accountConflictOf, api, type AccountConflict, type SignInMethods } from '@/lib/api';
import { authErrorMessage } from '@/lib/authErrorMessage';
import { FRESH } from '@/lib/queryClient';
import { SocialSignInError, appleSignInAvailable, googleSignInAvailable } from '@/lib/socialSignIn';
import { useAuth } from '@/store/AuthContext';
import { useIsDark, useThemeColors } from '@/theme/colors';
import { HUB, hubInk, hubText, hubTint } from '@/theme/hub';

function maskPhone(phone: string) {
  return phone.replace(/^(\+995)(\d{3})\d{3}(\d{3})$/, '$1 $2 *** $3');
}

/**
 * Profile → „შესვლის გზები“ (owner 2026-10-05): every way into this one account — phone, email +
 * password, Apple, Google — with a button to add the missing ones, so a person never ends up with
 * one account per sign-in method. A method that belongs to another of their accounts opens the
 * account-conflict sheet.
 */
export default function SignInMethodsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const dark = useIsDark();
  const { user, linkApple, linkGoogle } = useAuth();
  const [appleOn, setAppleOn] = useState(false);
  const [googleOn] = useState(() => googleSignInAvailable());
  const [busy, setBusy] = useState<null | 'apple' | 'google'>(null);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<AccountConflict | null>(null);
  const lock = useRef(false);

  const query = useAccountQuery<{ methods: SignInMethods }>({
    key: ['signin-methods'],
    fetch: () => api.auth.methods(),
    staleTime: FRESH.LIVE,
  });
  const methods = query.data?.methods ?? null;

  useEffect(() => {
    let alive = true;
    void appleSignInAvailable().then((on) => {
      if (alive) setAppleOn(on);
    });
    return () => {
      alive = false;
    };
  }, []);

  const link = async (provider: 'apple' | 'google') => {
    if (lock.current) return;
    lock.current = true;
    setBusy(provider);
    setError(null);
    try {
      const result = provider === 'apple' ? await linkApple() : await linkGoogle();
      if (result === 'linked') await query.refetch();
    } catch (e) {
      const found = accountConflictOf(e);
      if (found) setConflict(found);
      else setError(e instanceof SocialSignInError ? e.message : authErrorMessage(e));
    } finally {
      lock.current = false;
      setBusy(null);
    }
  };

  if (!user) return null;

  const rows: React.ReactNode[] = [];
  rows.push(
    <MethodRow
      key="phone"
      icon={<Smartphone size={19} color={hubInk('teal', dark)} strokeWidth={1.9} />}
      label={tx('ტელეფონის ნომერი', 'Phone number')}
      value={methods?.phone ? maskPhone(methods.phone) : null}
      onAdd={() => router.push('/profile/verify-phone')}
      loading={!methods}
    />,
    <MethodRow
      key="email"
      icon={<Mail size={19} color={hubInk('blue', dark)} strokeWidth={1.9} />}
      label={tx('ელ-ფოსტა და პაროლი', 'Email and password')}
      value={methods?.email ?? null}
      onAdd={() => router.push('/profile/add-email' as never)}
      loading={!methods}
    />,
  );
  if (appleOn || methods?.apple) {
    rows.push(
      <MethodRow
        key="apple"
        icon={<AppleLogo size={18} color={colors.text100} />}
        label="Apple"
        value={methods?.apple ? tx('მიბმულია', 'Linked') : null}
        onAdd={appleOn ? () => void link('apple') : undefined}
        loading={!methods}
        busy={busy === 'apple'}
      />,
    );
  }
  if (googleOn || methods?.google) {
    rows.push(
      <MethodRow
        key="google"
        icon={<GoogleLogo size={18} />}
        label="Google"
        value={methods?.google ? tx('მიბმულია', 'Linked') : null}
        onAdd={googleOn ? () => void link('google') : undefined}
        loading={!methods}
        busy={busy === 'google'}
      />,
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg100 }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: Math.max(insets.bottom, 24) + 16 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ paddingHorizontal: HUB.gutter }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={tx('უკან', 'Back')}
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/profile' as never))}
            hitSlop={10}
            style={{ width: 44, height: 44, borderRadius: 16, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}
          >
            <ChevronLeft size={20} color={colors.text100} strokeWidth={2.2} />
          </Pressable>
          <Text style={{ marginTop: 18, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 24, lineHeight: 32, color: colors.text100 }}>
            {tx('შესვლის გზები', 'Sign-in methods')}
          </Text>
          <Text style={[hubText.body, { marginTop: 6, color: colors.text200 }]}>
            {tx(
              'ყველა გზა ამ ერთ ანგარიშში შეგიყვანს — აპშიც და ვებზეც. დაამატე ის გზები, რომლითაც შეიძლება შეხვიდე, რომ მეორე ანგარიში შემთხვევით არ შეიქმნას.',
              'Every method signs you in to this one account — in the app and on the web. Add the ones you might use, so a second account is never created by accident.',
            )}
          </Text>
        </View>

        <View style={[s.list, { backgroundColor: colors.surface }]}>
          {rows.map((row, index) => (
            <React.Fragment key={index}>
              {index ? <View style={{ height: 1, backgroundColor: colors.bg300, marginLeft: 68 }} /> : null}
              {row}
            </React.Fragment>
          ))}
        </View>

        {error || query.error ? (
          <Text accessibilityLiveRegion="polite" style={[hubText.body, { color: colors.danger, marginTop: 12, paddingHorizontal: HUB.gutter }]}>
            {error ?? authErrorMessage(query.error)}
          </Text>
        ) : null}

        {Platform.OS === 'android' ? null : (
          <Text style={[hubText.caption, { color: colors.text300, marginTop: 14, paddingHorizontal: HUB.gutter }]}>
            {tx(
              'Apple-ის „ელ-ფოსტის დამალვის“ შემთხვევაში მისამართი აქ არ გამოჩნდება — Apple-ით შესვლა მაინც იმუშავებს.',
              'With Apple’s „Hide My Email“ the address does not show here — signing in with Apple still works.',
            )}
          </Text>
        )}
      </ScrollView>

      <AccountConflictSheet
        conflict={conflict}
        onClose={() => setConflict(null)}
        onDone={(outcome) => {
          setConflict(null);
          if (outcome.action === 'switch') router.replace('/(tabs)/home' as never);
          else void query.refetch();
        }}
      />
    </View>
  );
}

function MethodRow({
  icon,
  label,
  value,
  onAdd,
  loading,
  busy = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null;
  onAdd?: () => void;
  loading: boolean;
  busy?: boolean;
}) {
  const colors = useThemeColors();
  const dark = useIsDark();
  const linked = Boolean(value);
  const tappable = !linked && !loading && Boolean(onAdd);
  return (
    <Pressable
      accessibilityRole={tappable ? 'button' : undefined}
      accessibilityLabel={linked ? `${label}: ${value}` : `${label}: ${tx('დამატება', 'Add')}`}
      disabled={!tappable || busy}
      onPress={onAdd}
      style={{ flexDirection: 'row', alignItems: 'center', minHeight: 62, paddingHorizontal: 16, paddingVertical: 10, gap: 12 }}
    >
      <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: hubTint(hubInk('neutral', dark), dark), alignItems: 'center', justifyContent: 'center' }}>
        {icon}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[hubText.cardTitle, { fontSize: 14, lineHeight: 20, color: colors.text100 }]}>{label}</Text>
        {linked ? (
          <Text numberOfLines={1} style={[hubText.caption, { color: colors.text200 }]}>{value}</Text>
        ) : null}
      </View>
      {loading || busy ? (
        <ActivityIndicator color={colors.text300} />
      ) : linked ? (
        <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: hubTint(hubInk('green', dark), dark), alignItems: 'center', justifyContent: 'center' }}>
          <Check size={15} color={hubInk('green', dark)} strokeWidth={2.6} />
        </View>
      ) : onAdd ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
          <Text style={[hubText.link, { color: hubInk('teal', dark) }]}>{tx('დამატება', 'Add')}</Text>
          <ChevronRight size={16} color={hubInk('teal', dark)} strokeWidth={2.2} />
        </View>
      ) : null}
    </Pressable>
  );
}

const s = StyleSheet.create({
  list: { marginHorizontal: HUB.gutter, marginTop: 20, borderRadius: HUB.cardRadius, overflow: 'hidden' },
});
