import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Share2 } from 'lucide-react-native';
import { HomeSectionHeading } from '@/components/home/HomeSectionHeading';
import { ProfileMenuRow } from '@/components/profile/ProfileMenuRow';
import { ka } from '@/i18n/ka';
import { api } from '@/lib/api';
import { trackFunnel } from '@/lib/funnel';
import { localAccountId } from '@/lib/localAccount';
import { referralShareMessage, type ReferralSummary } from '@/lib/referral';
import { HUB, hubText } from '@/theme/hub';
import { useThemeColors } from '@/theme/colors';
import { KeyRound } from 'lucide-react-native';
import { tx } from '@/i18n/locale';

/** Referral hub (Phase 3.4): share your code, see progress, enter a friend's code once. */
export default function InviteScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const c = useThemeColors();
  const [data, setData] = useState<ReferralSummary | null>(null);
  const [error, setError] = useState(false);

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

  const stat = (value: number, label: string) => (
    <View style={[s.stat, { backgroundColor: c.bg200 }]}>
      <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 22, color: c.text100 }}>{value}</Text>
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
            <Pressable accessibilityRole="button" onPress={() => router.push('/profile/verify-phone' as never)} style={[s.cta, { marginTop: 8 }]}>
              <Text style={s.ctaText}>{ka.referral.phoneCta}</Text>
            </Pressable>
          </View>
        ) : null}

        {data?.code ? (
          <View style={[s.card, { backgroundColor: c.surface, alignItems: 'center' }]}>
            <Text style={[hubText.caption, { color: c.text200 }]}>{ka.referral.yourCode}</Text>
            <Text selectable accessibilityLabel={`${ka.referral.yourCode}: ${data.code.split('').join(' ')}`} style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 34, letterSpacing: 6, color: c.text100, marginVertical: 6 }}>
              {data.code}
            </Text>
            <Pressable accessibilityRole="button" onPress={share} style={[s.cta, { alignSelf: 'stretch' }]}>
              <Share2 size={18} color="#FFFFFF" />
              <Text style={s.ctaText}>{ka.referral.share}</Text>
            </Pressable>
            <View style={{ flexDirection: 'row', gap: 8, alignSelf: 'stretch', marginTop: 10 }}>
              {stat(data.invited, ka.referral.statInvited)}
              {stat(data.pending, ka.referral.statPending)}
              {stat(data.coinsEarned, ka.referral.statCoins)}
            </View>
            <Text style={[hubText.caption, { color: c.text300, textAlign: 'center', marginTop: 6 }]}>
              {ka.referral.monthLeft(data.monthRemaining, data.monthlyCap)}
            </Text>
          </View>
        ) : null}

        {data ? (
          <View>
            <HomeSectionHeading title={ka.referral.how} />
            <View style={[s.card, { backgroundColor: c.surface }]}>
              {ka.referral.steps(data.coinsPerSide).map((line, i) => (
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
  stat: { flex: 1, borderRadius: 16, paddingVertical: 10, paddingHorizontal: 6, alignItems: 'center', gap: 2 },
  cta: { minHeight: 50, borderRadius: 16, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0D9488', paddingHorizontal: 16 },
  ctaText: { fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 15, color: '#FFFFFF' },
});
