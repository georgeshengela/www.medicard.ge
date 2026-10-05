import { brandHex } from '@/theme/brandTone';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Clipboard, Image, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, ChevronLeft, Copy } from 'lucide-react-native';
import { HomeSectionHeading } from '@/components/home/HomeSectionHeading';
import { ProfileMenuRow } from '@/components/profile/ProfileMenuRow';
import { COIN_ART, REFERRAL_ART } from '@/constants/appArt';
import { ka } from '@/i18n/ka';
import { api } from '@/lib/api';
import { trackFunnel } from '@/lib/funnel';
import { localAccountId } from '@/lib/localAccount';
import { referralShareMessage, type ReferralSummary } from '@/lib/referral';
import { HUB, hubText } from '@/theme/hub';
import { useThemeColors } from '@/theme/colors';
import { KeyRound } from 'lucide-react-native';
import { dateLocale, tx } from '@/i18n/locale';

/** Referral hub: copy or share your code, see who joined and this month's limit, enter a friend's code once. */
export default function InviteScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const c = useThemeColors();
  const [data, setData] = useState<ReferralSummary | null>(null);
  const [error, setError] = useState(false);
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
  }, []);

  useFocusEffect(
    useCallback(() => {
      const owner = localAccountId();
      let live = true;
      setError(false);
      api.referrals
        .me()
        .then((next) => {
          if (live && owner === localAccountId()) setData(next);
        })
        .catch(() => {
          if (live) setError(true);
        });
      return () => {
        live = false;
      };
    }, []),
  );

  const share = () => {
    if (!data?.code || !data.link) return;
    void Share.share({ message: referralShareMessage(data.code, data.link, data.coinsPerSide) })
      .then((result) => {
        if (result.action === Share.sharedAction) trackFunnel('referral_shared');
      })
      .catch(() => undefined);
  };

  const copyCode = () => {
    if (!data?.code) return;
    try {
      Clipboard.setString(data.code);
    } catch {
      return;
    }
    setCopied(true);
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(false), 2000);
  };

  const invitees = data?.invitees ?? [];
  const monthUsed = data ? data.invitedThisMonth ?? Math.max(0, data.monthlyCap - data.monthRemaining) : 0;
  const shortDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short' });
    } catch {
      return iso.slice(0, 10);
    }
  };

  const stat = (value: number | string, label: string, coin = false) => (
    <View style={[s.stat, { backgroundColor: c.bg200 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        {coin ? (
          <Image source={COIN_ART} resizeMode="contain" accessible={false} accessibilityIgnoresInvertColors style={{ width: 20, height: 20 }} />
        ) : null}
        <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 22, color: c.text100 }}>{value}</Text>
      </View>
      <Text style={[hubText.caption, { color: c.text200, textAlign: 'center' }]}>{label}</Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.bg100, paddingTop: insets.top }}>
      <View style={{ height: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tx('უკან დაბრუნება', 'Go back')}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/profile' as never))}
          style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <ChevronLeft size={24} color={c.text100} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: HUB.gutter, paddingBottom: insets.bottom + 32, gap: HUB.sectionGap }}>
        <View style={{ gap: 6 }}>
          <Text accessibilityRole="header" style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 26, lineHeight: 34, color: c.text100 }}>
            {ka.referral.title}
          </Text>
          <Text style={[hubText.body, { color: c.text200, fontSize: 14, lineHeight: 22 }]}>{ka.referral.body}</Text>
        </View>

        {!data && !error ? <ActivityIndicator color={c.primary200} /> : null}
        {error ? <Text style={[hubText.body, { color: c.danger }]}>{ka.referral.loadError}</Text> : null}

        {data?.phoneRequired ? (
          <View style={[s.card, { backgroundColor: c.surface }]}>
            <Text style={[hubText.cardTitle, { color: c.text100 }]}>{ka.referral.phoneTitle}</Text>
            <Text style={[hubText.body, { color: c.text200 }]}>{ka.referral.phoneBody}</Text>
            <Pressable accessibilityRole="button" onPress={() => router.push('/profile/verify-phone' as never)} style={[s.cta, { marginTop: 8, backgroundColor: brandHex('#0D9488') }]}>
              <Text style={s.ctaText}>{ka.referral.phoneCta}</Text>
            </Pressable>
          </View>
        ) : null}

        {data?.code ? (
          <Image
            source={REFERRAL_ART.hero}
            resizeMode="contain"
            accessible={false}
            accessibilityIgnoresInvertColors
            style={{ width: 180, height: 180, alignSelf: 'center', marginBottom: -HUB.sectionGap + 8 }}
          />
        ) : null}

        {data?.code ? (
          <View style={[s.card, { backgroundColor: c.surface, alignItems: 'center' }]}>
            <Text style={[hubText.caption, { color: c.text200 }]}>{ka.referral.yourCode}</Text>
            <Text selectable accessibilityLabel={`${ka.referral.yourCode}: ${data.code.split('').join(' ')}`} style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 34, letterSpacing: 6, color: c.text100, marginVertical: 6 }}>
              {data.code}
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, alignSelf: 'stretch' }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={copied ? ka.referral.copiedCode : `${ka.referral.copy}: ${data.code}`}
                onPress={copyCode}
                style={[s.cta, { flex: 1, backgroundColor: c.bg200 }]}
              >
                {copied ? <Check size={20} color={c.primary200} /> : <Copy size={20} color={c.text100} />}
                <Text style={[s.ctaText, { color: copied ? c.primary200 : c.text100 }]}>{copied ? ka.referral.copiedCode : ka.referral.copy}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={share} style={[s.cta, { flex: 1, backgroundColor: brandHex('#0D9488') }]}>
                <Image source={REFERRAL_ART.share} resizeMode="contain" accessible={false} accessibilityIgnoresInvertColors style={{ width: 22, height: 22 }} />
                <Text style={s.ctaText}>{ka.referral.share}</Text>
              </Pressable>
            </View>
            <View style={{ flexDirection: 'row', gap: 8, alignSelf: 'stretch', marginTop: 10 }}>
              {stat(data.invited, ka.referral.statInvited)}
              {stat(`${monthUsed}/${data.monthlyCap}`, ka.referral.statMonth)}
              {stat(data.coinsEarned, ka.referral.statCoins, true)}
            </View>
            <Text style={[hubText.caption, { color: data.monthRemaining > 0 ? c.text300 : c.text200, textAlign: 'center', marginTop: 6 }]}>
              {data.monthRemaining > 0 ? ka.referral.monthLeft(data.monthRemaining, data.monthlyCap) : ka.referral.monthFull(data.monthlyCap)}
            </Text>
          </View>
        ) : null}

        {data?.code ? (
          <View>
            <HomeSectionHeading title={ka.referral.listTitle} />
            <View style={[s.list, { backgroundColor: c.surface }]}>
              {invitees.length ? (
                invitees.map((person, i) => (
                  <View
                    key={`${person.at}-${i}`}
                    style={[s.row, i > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.bg300 } : null]}
                  >
                    <View style={[s.avatar, { backgroundColor: c.accent100 }]}>
                      <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 16, color: c.primary200 }}>{[...person.name][0] ?? '•'}</Text>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text numberOfLines={1} style={[hubText.cardTitle, { color: c.text100 }]}>{person.name}</Text>
                      <Text style={[hubText.caption, { color: c.text300 }]}>{shortDate(person.at)}</Text>
                    </View>
                    {person.coins > 0 ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Image source={COIN_ART} resizeMode="contain" accessible={false} accessibilityIgnoresInvertColors style={{ width: 18, height: 18 }} />
                        <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 15, color: c.text100 }}>+{person.coins}</Text>
                      </View>
                    ) : (
                      <Text style={[hubText.caption, { color: c.text300 }]}>{ka.referral.listPending}</Text>
                    )}
                  </View>
                ))
              ) : (
                <Text style={[hubText.body, { color: c.text200, padding: HUB.cardPad }]}>{ka.referral.listEmpty}</Text>
              )}
            </View>
          </View>
        ) : null}

        {data ? (
          <View>
            <HomeSectionHeading title={ka.referral.how} />
            <View style={[s.card, { backgroundColor: c.surface }]}>
              {ka.referral.steps(data.coinsPerSide, data.monthlyCap, data.claimWindowDays ?? 14).map((line, i) => (
                <View key={line} style={{ flexDirection: 'row', gap: 10 }}>
                  <Text style={[hubText.cardTitle, { color: c.primary200, width: 18 }]}>{i + 1}</Text>
                  <Text style={[hubText.body, { color: c.text100, flex: 1 }]}>{line}</Text>
                </View>
              ))}
              <Text style={[hubText.caption, { color: c.text300, marginTop: 4 }]}>{ka.referral.noValue}</Text>
            </View>
          </View>
        ) : null}

        {data?.invitedBy ? (
          <View style={[s.card, { backgroundColor: c.surface }]}>
            {data.invitedBy.name ? <Text style={[hubText.cardTitle, { color: c.text100 }]}>{ka.referral.invitedBy(data.invitedBy.name)}</Text> : null}
            <Text style={[hubText.body, { color: c.text200 }]}>
              {data.invitedBy.status === 'REWARDED' ? ka.referral.invitedDone : ka.referral.invitedPending}
            </Text>
          </View>
        ) : data?.canClaim ? (
          <View style={[s.list, { backgroundColor: c.surface }]}>
            <ProfileMenuRow icon={KeyRound} ink="teal" label={ka.referral.haveCode} value={ka.referral.haveCodeHint} onPress={() => router.push('/profile/invite-code' as never)} isLast />
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: HUB.cardRadius, padding: HUB.cardPad, gap: 8 },
  list: { borderRadius: HUB.cardRadius, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: HUB.cardPad, paddingVertical: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  stat: { flex: 1, borderRadius: 16, paddingVertical: 10, paddingHorizontal: 6, alignItems: 'center', gap: 2 },
  cta: { minHeight: 50, borderRadius: 16, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0D9488', paddingHorizontal: 16 },
  ctaText: { fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 15, color: '#FFFFFF' },
});
