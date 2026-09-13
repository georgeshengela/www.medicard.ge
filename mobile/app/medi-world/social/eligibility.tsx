import React, { useState } from 'react';
import { Text } from 'react-native';
import { useRouter } from 'expo-router';
import { SocialButton, SocialShell, useSocialCopy } from '@/components/world/SocialChrome';
import { useSocial } from '@/hooks/useSocial';
import { mediWorldApi } from '@/lib/mediWorld/api';
import { rememberSocial } from '@/lib/mediWorld/worldEconomyCache.js';
import { useAuth } from '@/store/AuthContext';
import { useThemeColors } from '@/theme/colors';

export default function SocialEligibilityScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const { copy } = useSocialCopy();
  const { canMutate } = useSocial();
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fontBody = { fontFamily: 'NotoSansGeorgian_400Regular' as const };

  return (
    <SocialShell titleKey="eligibilityTitle">
      <Text maxFontSizeMultiplier={1.6} style={{ ...fontBody, fontSize: 16, lineHeight: 24, color: colors.text200, marginTop: 12 }}>{copy.eligibilityBody}</Text>
      <Text maxFontSizeMultiplier={1.6} style={{ ...fontBody, fontSize: 14, lineHeight: 22, color: colors.text300, marginTop: 12 }}>{copy.eligibilityHint}</Text>
      <SocialButton
        disabled={!canMutate || busy}
        label={copy.eligibilityConfirm}
        onPress={() => {
          setBusy(true);
          setError(null);
          void mediWorldApi.socialEligibility().then((me) => {
            rememberSocial(me, user?.id);
            router.replace('/medi-world/social/profile' as never);
          }).catch(() => setError(copy.retry)).finally(() => setBusy(false));
        }}
      />
      {error ? <Text style={{ ...fontBody, color: colors.text200, marginTop: 12 }}>{error}</Text> : null}
    </SocialShell>
  );
}
