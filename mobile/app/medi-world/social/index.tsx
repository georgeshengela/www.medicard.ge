import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SocialButton, SocialShell, useSocialCopy } from '@/components/world/SocialChrome';
import { useSocial, SOCIAL_INTRO_KEY } from '@/hooks/useSocial';
import { getPreference } from '@/lib/storage';
import { useThemeColors } from '@/theme/colors';

export default function SocialHubScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const { copy } = useSocialCopy();
  const { payload, loading, error, offline, stale, refresh, enabled, canMutate } = useSocial();
  const [introSeen, setIntroSeen] = useState<boolean | null>(null);
  const fontBody = { fontFamily: 'NotoSansGeorgian_400Regular' as const };

  useEffect(() => {
    void getPreference(SOCIAL_INTRO_KEY).then((seen) => setIntroSeen(seen === '1'));
  }, []);

  useEffect(() => {
    if (introSeen === false) router.replace('/medi-world/social/intro' as never);
  }, [introSeen, router]);

  if (!enabled) {
    return (
      <SocialShell titleKey="title">
        <Text maxFontSizeMultiplier={1.6} style={{ ...fontBody, fontSize: 16, lineHeight: 24, color: colors.text200, marginTop: 12 }}>{copy.socialOff}</Text>
      </SocialShell>
    );
  }

  if (loading && !payload) {
    return (
      <SocialShell titleKey="title">
        <View style={{ height: 72, borderRadius: 16, backgroundColor: colors.bg200, marginTop: 16 }} />
      </SocialShell>
    );
  }

  if (error && !payload) {
    return (
      <SocialShell titleKey="title">
        <SocialButton label={copy.retry} onPress={() => void refresh()} />
      </SocialShell>
    );
  }

  if (payload?.eligibility !== 'adult_confirmed') {
    return (
      <SocialShell titleKey="title">
        <Text maxFontSizeMultiplier={1.6} style={{ ...fontBody, fontSize: 16, lineHeight: 24, color: colors.text200, marginTop: 12 }}>{copy.eligibilityBody}</Text>
        <SocialButton label={copy.eligibilityTitle} onPress={() => router.push('/medi-world/social/eligibility' as never)} />
      </SocialShell>
    );
  }

  if (!payload?.socialEnabled) {
    return (
      <SocialShell titleKey="disabledTitle">
        <Text maxFontSizeMultiplier={1.6} style={{ ...fontBody, fontSize: 16, lineHeight: 24, color: colors.text200, marginTop: 12 }}>{copy.disabledBody}</Text>
        {stale || offline ? <Text style={{ ...fontBody, color: colors.text300, marginTop: 8 }}>{copy.stale}</Text> : null}
        <SocialButton label={copy.profileTitle} onPress={() => router.push('/medi-world/social/profile' as never)} />
      </SocialShell>
    );
  }

  const links: Array<[string, string]> = [
    [copy.profileTitle, '/medi-world/social/profile'],
    [copy.privacyTitle, '/medi-world/social/privacy'],
    [copy.previewTitle, '/medi-world/social/preview'],
    [copy.codeTitle, '/medi-world/social/code'],
    [copy.addTitle, '/medi-world/social/add'],
    [copy.friendsTitle, '/medi-world/social/friends'],
    [copy.inboxTitle, '/medi-world/social/inbox'],
    [copy.circleTitle, '/medi-world/social/circle'],
    [copy.blocksTitle, '/medi-world/social/blocks'],
  ];

  return (
    <SocialShell titleKey="title">
      <Text maxFontSizeMultiplier={1.6} style={{ ...fontBody, fontSize: 16, lineHeight: 24, color: colors.text200, marginTop: 10 }}>{copy.promise}</Text>
      {stale || offline ? <Text style={{ ...fontBody, color: colors.text300, marginTop: 8 }}>{copy.stale}</Text> : null}
      {links.map(([label, href]) => (
        <Pressable
          key={href}
          accessibilityRole="button"
          accessibilityLabel={label}
          onPress={() => router.push(href as never)}
          className="active:opacity-75"
          style={{ marginTop: 10, borderRadius: 16, borderWidth: 1, borderColor: colors.bg300, backgroundColor: colors.surface, padding: 16 }}
        >
          <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 16, color: colors.text100 }}>{label}</Text>
        </Pressable>
      ))}
      {!canMutate ? <Text style={{ ...fontBody, color: colors.text300, marginTop: 12 }}>{copy.offlineMutate}</Text> : null}
    </SocialShell>
  );
}
