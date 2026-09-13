import React from 'react';
import { Text } from 'react-native';
import { useRouter } from 'expo-router';
import { SocialButton, SocialShell, useSocialCopy } from '@/components/world/SocialChrome';
import { SOCIAL_INTRO_KEY } from '@/hooks/useSocial';
import { setPreference } from '@/lib/storage';
import { useThemeColors } from '@/theme/colors';

export default function SocialIntroScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const { copy } = useSocialCopy();
  const fontBody = { fontFamily: 'NotoSansGeorgian_400Regular' as const };

  return (
    <SocialShell titleKey="introTitle">
      <Text maxFontSizeMultiplier={1.6} style={{ ...fontBody, fontSize: 17, lineHeight: 26, color: colors.text200, marginTop: 12 }}>{copy.introBody}</Text>
      <Text maxFontSizeMultiplier={1.6} style={{ ...fontBody, fontSize: 16, lineHeight: 24, color: colors.primary200, marginTop: 16 }}>{copy.promise}</Text>
      <SocialButton
        label={copy.introCta}
        onPress={() => {
          void setPreference(SOCIAL_INTRO_KEY, '1').then(() => router.replace('/medi-world/social' as never));
        }}
      />
    </SocialShell>
  );
}
