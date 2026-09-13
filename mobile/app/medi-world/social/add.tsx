import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { APP_MODAL_OVERLAY, APP_MODAL_PROPS } from '@/components/ui/appModal';
import { SocialButton, SocialShell, useSocialCopy } from '@/components/world/SocialChrome';
import { newSocialIdempotency, useSocial } from '@/hooks/useSocial';
import { mediWorldApi } from '@/lib/mediWorld/api';
import { socialUiFailure } from '@/lib/mediWorld/socialGate.js';
import { normalizeFriendCodeInput, parseSocialFriendQrPayload } from '@/lib/mediWorld/socialQr.js';
import { useThemeColors } from '@/theme/colors';

export default function SocialAddScreen() {
  const colors = useThemeColors();
  const { copy } = useSocialCopy();
  const { canMutate, enabled } = useSocial();
  const params = useLocalSearchParams<{ code?: string }>();
  const parsedLink = useMemo(
    () => (params.code ? parseSocialFriendQrPayload(`medicard://medi-world/social/add?code=${params.code}`) : null),
    [params.code],
  );
  const [code, setCode] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const fontBody = { fontFamily: 'NotoSansGeorgian_400Regular' as const };
  const normalized = normalizeFriendCodeInput(code);

  useEffect(() => {
    if (parsedLink?.ok && parsedLink.code) setCode(parsedLink.code);
  }, [parsedLink]);

  return (
    <SocialShell titleKey="addTitle">
      <Text maxFontSizeMultiplier={1.6} style={{ ...fontBody, fontSize: 16, lineHeight: 24, color: colors.text200, marginTop: 12 }}>{copy.addBody}</Text>
      {parsedLink && !parsedLink.ok ? (
        <Text style={{ ...fontBody, color: colors.text300, marginTop: 8 }}>{copy.requestUnavailable}</Text>
      ) : null}
      <TextInput
        value={code}
        onChangeText={setCode}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={24}
        maxFontSizeMultiplier={1.6}
        style={{ marginTop: 12, minHeight: 48, borderRadius: 14, backgroundColor: colors.bg200, paddingHorizontal: 14, color: colors.text100 }}
      />
      <SocialButton
        disabled={!enabled || !canMutate || normalized.length < 11}
        label={copy.sendRequest}
        onPress={() => setConfirmOpen(true)}
      />
      {notice ? <Text style={{ ...fontBody, color: colors.text300, marginTop: 8 }}>{notice}</Text> : null}
      <Modal visible={confirmOpen} {...APP_MODAL_PROPS} onRequestClose={() => setConfirmOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: APP_MODAL_OVERLAY, justifyContent: 'flex-end' }} onPress={() => setConfirmOpen(false)}>
          <View style={{ backgroundColor: colors.surface, padding: 20, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
            <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 18, color: colors.text100 }}>{copy.confirmSendTitle}</Text>
            <Text style={{ ...fontBody, fontSize: 16, lineHeight: 24, color: colors.text200, marginTop: 8 }}>{copy.confirmSendBody}</Text>
            <Text selectable style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 20, letterSpacing: 1, color: colors.text100, marginTop: 12 }}>{normalized}</Text>
            <SocialButton
              disabled={!canMutate}
              label={copy.confirmSend}
              onPress={() => {
                setConfirmOpen(false);
                void mediWorldApi.socialFriendRequest(normalized, newSocialIdempotency('req')).then((res) => {
                  setNotice(res.state);
                }).catch((error) => {
                  const kind = socialUiFailure(error);
                  setNotice(kind === 'rate_limited' ? copy.rateLimited : copy.requestUnavailable);
                });
              }}
            />
          </View>
        </Pressable>
      </Modal>
    </SocialShell>
  );
}
