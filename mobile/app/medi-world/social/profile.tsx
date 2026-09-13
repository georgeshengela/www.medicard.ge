import React, { useState } from 'react';
import { Text, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { SocialButton, SocialShell, useSocialCopy } from '@/components/world/SocialChrome';
import { useSocial } from '@/hooks/useSocial';
import { mediWorldApi } from '@/lib/mediWorld/api';
import { rememberSocial } from '@/lib/mediWorld/worldEconomyCache.js';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/store/AuthContext';
import { useThemeColors } from '@/theme/colors';

export default function SocialProfileScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const { copy } = useSocialCopy();
  const { payload, canMutate } = useSocial();
  const { user } = useAuth();
  const [name, setName] = useState(payload?.displayName || '');
  const [bio, setBio] = useState(payload?.bio || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fontBody = { fontFamily: 'NotoSansGeorgian_400Regular' as const };

  async function save(socialEnabled: boolean) {
    if (!canMutate) return;
    setBusy(true);
    setError(null);
    try {
      const me = await mediWorldApi.socialUpdateMe({ displayName: name, bio, socialEnabled });
      rememberSocial(me, user?.id);
      router.replace('/medi-world/social' as never);
    } catch (err) {
      const code = err instanceof ApiError ? err.code : '';
      setError(code === 'SOCIAL_NAME_REQUIRED' ? copy.nameRequired : copy.retry);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SocialShell titleKey="profileTitle">
      <Text style={{ ...fontBody, color: colors.text200, marginTop: 12 }}>{copy.displayName}</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        maxLength={24}
        maxFontSizeMultiplier={1.6}
        style={{ marginTop: 8, minHeight: 48, borderRadius: 14, backgroundColor: colors.bg200, paddingHorizontal: 14, color: colors.text100 }}
      />
      <Text style={{ ...fontBody, color: colors.text200, marginTop: 12 }}>{copy.bio}</Text>
      <TextInput
        value={bio}
        onChangeText={setBio}
        maxLength={80}
        multiline
        maxFontSizeMultiplier={1.6}
        style={{ marginTop: 8, minHeight: 72, borderRadius: 14, backgroundColor: colors.bg200, paddingHorizontal: 14, paddingTop: 12, color: colors.text100 }}
      />
      <SocialButton disabled={!canMutate || busy} label={copy.enableSocial} onPress={() => void save(true)} />
      <SocialButton disabled={!canMutate || busy} label={copy.disableSocial} onPress={() => void save(false)} />
      {error ? <Text style={{ ...fontBody, color: colors.text200, marginTop: 12 }}>{error}</Text> : null}
    </SocialShell>
  );
}
