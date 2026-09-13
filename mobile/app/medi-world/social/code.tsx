import React, { useMemo, useState } from 'react';
import { Pressable, Share, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { SocialButton, SocialShell, useSocialCopy } from '@/components/world/SocialChrome';
import { useSocial } from '@/hooks/useSocial';
import { mediWorldApi } from '@/lib/mediWorld/api';
import { buildSocialFriendQrPayload } from '@/lib/mediWorld/socialQr.js';
import { rememberSocial } from '@/lib/mediWorld/worldEconomyCache.js';
import { useAuth } from '@/store/AuthContext';
import { useThemeColors } from '@/theme/colors';

export default function SocialCodeScreen() {
  const colors = useThemeColors();
  const { copy } = useSocialCopy();
  const { user } = useAuth();
  const { payload, canMutate } = useSocial();
  const [copied, setCopied] = useState(false);
  const code = payload?.friendCode || '';
  const qrPayload = useMemo(() => buildSocialFriendQrPayload(code), [code]);
  const fontBody = { fontFamily: 'NotoSansGeorgian_400Regular' as const };
  const fontTitle = { fontFamily: 'NotoSansGeorgian_700Bold' as const };

  return (
    <SocialShell titleKey="codeTitle">
      <Text maxFontSizeMultiplier={1.6} style={{ ...fontBody, fontSize: 16, lineHeight: 24, color: colors.text200, marginTop: 12 }}>{copy.codeBody}</Text>
      <Text
        selectable
        accessibilityLabel={copy.qrLabel}
        maxFontSizeMultiplier={1.6}
        style={{ ...fontTitle, fontSize: 28, letterSpacing: 2, color: colors.text100, marginTop: 18 }}
      >
        {code}
      </Text>
      {qrPayload ? (
        <View
          accessible
          accessibilityRole="image"
          accessibilityLabel={copy.qrLabel}
          style={{
            marginTop: 16,
            alignSelf: 'center',
            backgroundColor: '#FFFFFF',
            padding: 16,
            borderRadius: 16,
          }}
        >
          <QRCode
            value={qrPayload}
            size={184}
            backgroundColor="#FFFFFF"
            color="#111827"
            ecl="M"
            quietZone={16}
          />
        </View>
      ) : null}
      <Text style={{ ...fontBody, color: colors.text300, marginTop: 8 }}>{copy.qrHint}</Text>
      <SocialButton
        label={copied ? copy.copied : copy.copyCode}
        onPress={() => {
          void Share.share({ message: code }).then(() => setCopied(true));
        }}
      />
      <SocialButton
        disabled={!canMutate}
        label={copy.rotateCode}
        onPress={() => {
          void mediWorldApi.socialRotateCode().then((me) => {
            rememberSocial(me, user?.id);
          });
        }}
      />
      <Text style={{ ...fontBody, color: colors.text300, marginTop: 8 }}>{copy.rotateHint}</Text>
      <Pressable />
    </SocialShell>
  );
}
