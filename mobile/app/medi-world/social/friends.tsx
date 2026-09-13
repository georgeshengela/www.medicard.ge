import React, { useEffect, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { APP_MODAL_OVERLAY, APP_MODAL_PROPS } from '@/components/ui/appModal';
import { SocialButton, SocialShell, useSocialCopy } from '@/components/world/SocialChrome';
import { useSocial } from '@/hooks/useSocial';
import { mediWorldApi } from '@/lib/mediWorld/api';
import { socialUiFailure } from '@/lib/mediWorld/socialGate.js';
import type { SocialFriendItem } from '@/lib/mediWorld/types';
import { useThemeColors } from '@/theme/colors';

export default function SocialFriendsScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const { copy } = useSocialCopy();
  const { canMutate } = useSocial();
  const [items, setItems] = useState<SocialFriendItem[]>([]);
  const [confirm, setConfirm] = useState<SocialFriendItem | null>(null);
  const [loadError, setLoadError] = useState<'rate_limited' | 'error' | null>(null);
  const fontBody = { fontFamily: 'NotoSansGeorgian_400Regular' as const };

  async function load() {
    try {
      const next = await mediWorldApi.socialFriends();
      setItems(next.items);
      setLoadError(null);
    } catch (error) {
      setLoadError(socialUiFailure(error) === 'rate_limited' ? 'rate_limited' : 'error');
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const incoming = items.filter((row) => row.state === 'pending' && row.direction === 'incoming');
  const outgoing = items.filter((row) => row.state === 'pending' && row.direction === 'outgoing');
  const accepted = items.filter((row) => row.state === 'accepted');

  return (
    <SocialShell titleKey="friendsTitle">
      {loadError ? (
        <>
          <Text style={{ ...fontBody, color: colors.text200, marginTop: 12 }}>
            {loadError === 'rate_limited' ? copy.rateLimited : copy.retry}
          </Text>
          <SocialButton label={copy.retry} onPress={() => void load()} />
        </>
      ) : null}
      <Text style={{ ...fontBody, color: colors.text200, marginTop: 12 }}>{copy.incoming}</Text>
      {incoming.map((row) => (
        <View key={row.relationshipId} style={{ marginTop: 8 }}>
          <Text style={{ ...fontBody, color: colors.text100 }}>{row.displayName}</Text>
          <SocialButton disabled={!canMutate} label={copy.accept} onPress={() => void mediWorldApi.socialFriendAccept(row.relationshipId).then(load).catch(() => undefined)} />
          <SocialButton disabled={!canMutate} label={copy.decline} onPress={() => void mediWorldApi.socialFriendDecline(row.relationshipId).then(load).catch(() => undefined)} />
        </View>
      ))}
      <Text style={{ ...fontBody, color: colors.text200, marginTop: 16 }}>{copy.outgoing}</Text>
      {outgoing.map((row) => (
        <View key={row.relationshipId} style={{ marginTop: 8 }}>
          <Text style={{ ...fontBody, color: colors.text100 }}>{row.displayName}</Text>
          <SocialButton disabled={!canMutate} label={copy.cancel} onPress={() => void mediWorldApi.socialFriendCancel(row.relationshipId).then(load)} />
        </View>
      ))}
      {accepted.length === 0 ? <Text style={{ ...fontBody, color: colors.text300, marginTop: 16 }}>{copy.emptyFriends}</Text> : null}
      {accepted.map((row) => (
        <Pressable
          key={row.relationshipId}
          accessibilityRole="button"
          onPress={() => router.push(`/medi-world/social/friend/${row.relationshipId}` as never)}
          className="active:opacity-75"
          style={{ marginTop: 10, borderRadius: 16, borderWidth: 1, borderColor: colors.bg300, padding: 16, backgroundColor: colors.surface }}
        >
          <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', color: colors.text100 }}>{row.displayName}</Text>
          <SocialButton disabled={!canMutate} label={copy.remove} onPress={() => setConfirm(row)} />
        </Pressable>
      ))}
      <Modal visible={Boolean(confirm)} {...APP_MODAL_PROPS} onRequestClose={() => setConfirm(null)}>
        <Pressable style={{ flex: 1, backgroundColor: APP_MODAL_OVERLAY, justifyContent: 'flex-end' }} onPress={() => setConfirm(null)}>
          <View style={{ backgroundColor: colors.surface, padding: 20, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
            <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 18, color: colors.text100 }}>{copy.confirmRemove}</Text>
            <SocialButton
              disabled={!canMutate}
              label={copy.remove}
              onPress={() => {
                if (!confirm) return;
                void mediWorldApi.socialFriendRemove(confirm.relationshipId).then(() => {
                  setConfirm(null);
                  return load();
                });
              }}
            />
          </View>
        </Pressable>
      </Modal>
    </SocialShell>
  );
}
