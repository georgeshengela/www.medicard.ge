import React, { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { APP_MODAL_OVERLAY, APP_MODAL_PROPS } from '@/components/ui/appModal';
import { SocialButton, SocialShell, useSocialCopy } from '@/components/world/SocialChrome';
import { useSocial } from '@/hooks/useSocial';
import { mediWorldApi } from '@/lib/mediWorld/api';
import { socialUiFailure } from '@/lib/mediWorld/socialGate.js';
import { onSocialInvalidate } from '@/lib/quest/socket';
import type { SocialCircle } from '@/lib/mediWorld/types';
import { useThemeColors } from '@/theme/colors';

export default function SocialCircleScreen() {
  const colors = useThemeColors();
  const { copy } = useSocialCopy();
  const { canMutate } = useSocial();
  const [circle, setCircle] = useState<SocialCircle | null>(null);
  const [invite, setInvite] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [confirm, setConfirm] = useState<'leave' | 'delete' | 'transfer' | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [notice, setNotice] = useState('');
  const fontBody = { fontFamily: 'NotoSansGeorgian_400Regular' as const };

  const load = useCallback(async () => {
    try {
      const next = await mediWorldApi.socialCircleCurrent();
      setCircle(next.circle);
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, []);

  const viewer = circle?.members.find((member) => member.viewer);
  const isOwner = viewer?.role === 'owner';

  function actionError(error: unknown) {
    const kind = socialUiFailure(error);
    setNotice(kind === 'rate_limited' ? copy.rateLimited : copy.requestUnavailable);
  }

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useEffect(() => {
    return onSocialInvalidate(() => {
      void load();
    });
  }, [load]);

  return (
    <SocialShell titleKey="circleTitle">
      {loadError ? <SocialButton label={copy.retry} onPress={() => void load()} /> : null}
      <Text maxFontSizeMultiplier={1.6} style={{ ...fontBody, fontSize: 16, lineHeight: 24, color: colors.text200, marginTop: 12 }}>{copy.circleBody}</Text>
      {notice ? <Text style={{ ...fontBody, color: colors.text300, marginTop: 8 }}>{notice}</Text> : null}
      {!circle ? (
        <>
          <SocialButton disabled={!canMutate} label={copy.createCircle} onPress={() => void mediWorldApi.socialCircleCreate().then((res) => { setCircle(res.circle); setNotice(''); }).catch(actionError)} />
          <TextInput value={joinCode} onChangeText={setJoinCode} maxLength={24} autoCapitalize="characters" style={{ marginTop: 12, minHeight: 48, borderRadius: 14, backgroundColor: colors.bg200, paddingHorizontal: 14, color: colors.text100 }} />
          <SocialButton
            disabled={!canMutate || joinCode.trim().length < 6}
            label={copy.joinCircle}
            onPress={() => void mediWorldApi.socialCircleJoin(joinCode.trim()).then((res) => { setCircle(res.circle); setNotice(''); }).catch(actionError)}
          />
        </>
      ) : (
        <>
          <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 20, color: colors.text100, marginTop: 12 }}>{circle.name}</Text>
          <Text style={{ ...fontBody, color: colors.text300, marginTop: 4 }}>{copy.members}: {circle.memberCount}/{circle.memberCap}</Text>
          {circle.members.map((member) => (
            <View key={member.publicId || member.displayName} style={{ marginTop: 8 }}>
              <Text style={{ ...fontBody, color: colors.text100 }}>{member.displayName} · {member.role === 'owner' ? copy.owner : copy.member}</Text>
              {isOwner && member.role !== 'owner' && member.publicId ? (
                <>
                  <SocialButton disabled={!canMutate} label={copy.removeMember} onPress={() => void mediWorldApi.socialCircleRemove(member.publicId!).then((res) => setCircle(res.circle)).catch(actionError)} />
                  <SocialButton disabled={!canMutate} label={copy.transfer} onPress={() => setConfirm('transfer')} />
                </>
              ) : null}
            </View>
          ))}
          {isOwner ? (
            <>
              <SocialButton disabled={!canMutate} label={copy.inviteCode} onPress={() => void mediWorldApi.socialCircleInvite().then((res) => setInvite(res.inviteCode)).catch(actionError)} />
              {invite ? <Text selectable style={{ ...fontBody, color: colors.text100, marginTop: 8 }}>{invite}</Text> : null}
              <SocialButton disabled={!canMutate} label={copy.deleteCircle} onPress={() => setConfirm('delete')} />
            </>
          ) : (
            <SocialButton disabled={!canMutate} label={copy.leaveCircle} onPress={() => setConfirm('leave')} />
          )}
        </>
      )}
      <Modal visible={Boolean(confirm)} {...APP_MODAL_PROPS} onRequestClose={() => setConfirm(null)}>
        <Pressable style={{ flex: 1, backgroundColor: APP_MODAL_OVERLAY, justifyContent: 'flex-end' }} onPress={() => setConfirm(null)}>
          <View style={{ backgroundColor: colors.surface, padding: 20, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
            <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 18, color: colors.text100 }}>{copy.confirmAction}</Text>
            <SocialButton
              disabled={!canMutate}
              label={copy.confirmAction}
              onPress={() => {
                if (confirm === 'leave') {
                  void mediWorldApi.socialCircleLeave().then(() => { setConfirm(null); setCircle(null); setNotice(''); }).catch((error) => { setConfirm(null); actionError(error); });
                }
                if (confirm === 'delete') {
                  void mediWorldApi.socialCircleDelete().then(() => { setConfirm(null); setCircle(null); setNotice(''); }).catch((error) => { setConfirm(null); actionError(error); });
                }
                if (confirm === 'transfer') {
                  const other = circle?.members.find((member) => !member.viewer && member.publicId);
                  if (other?.publicId) void mediWorldApi.socialCircleTransfer(other.publicId).then((res) => { setConfirm(null); setCircle(res.circle); setNotice(''); }).catch((error) => { setConfirm(null); actionError(error); });
                }
              }}
            />
          </View>
        </Pressable>
      </Modal>
    </SocialShell>
  );
}
