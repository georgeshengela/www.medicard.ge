import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { SocialButton, SocialShell, useSocialCopy } from '@/components/world/SocialChrome';
import { newSocialIdempotency, useSocial } from '@/hooks/useSocial';
import { mediWorldApi } from '@/lib/mediWorld/api';
import { socialUiFailure } from '@/lib/mediWorld/socialGate.js';
import type { SocialFriendProjection } from '@/lib/mediWorld/types';
import { onSocialInvalidate } from '@/lib/quest/socket';
import {
  getFriendProjection,
  rememberFriendProjection,
  revokeFriendProjection,
} from '@/lib/mediWorld/worldEconomyCache.js';
import { useAuth } from '@/store/AuthContext';
import { useThemeColors } from '@/theme/colors';

const WAVES = ['hello', 'cheer', 'proud_of_you', 'gentle_support', 'garden_love'] as const;

export default function SocialFriendScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colors = useThemeColors();
  const { copy } = useSocialCopy();
  const { user } = useAuth();
  const userId = user?.id || null;
  const { canMutate, offline } = useSocial();
  const [profile, setProfile] = useState<SocialFriendProjection | null>(null);
  const [stale, setStale] = useState(false);
  const [waveNotice, setWaveNotice] = useState('');
  const [loadError, setLoadError] = useState<'rate_limited' | 'unavailable' | 'error' | null>(null);
  const fontBody = { fontFamily: 'NotoSansGeorgian_400Regular' as const };
  const loadGenRef = useRef(0);

  const load = useCallback(async () => {
    const gen = ++loadGenRef.current;
    if (!id || !userId) {
      if (gen === loadGenRef.current) setProfile(null);
      return;
    }
    if (offline) {
      if (gen !== loadGenRef.current) return;
      setProfile(getFriendProjection(userId, id));
      setStale(true);
      setLoadError(null);
      return;
    }
    try {
      const next = await mediWorldApi.socialFriendProfile(id);
      if (gen !== loadGenRef.current) return;
      rememberFriendProjection(userId, id, next);
      setProfile(next);
      setStale(false);
      setLoadError(null);
    } catch (error) {
      if (gen !== loadGenRef.current) return;
      const kind = socialUiFailure(error);
      if (kind === 'unavailable') {
        revokeFriendProjection(userId, id);
        setProfile(null);
        setLoadError('unavailable');
        return;
      }
      if (kind === 'rate_limited') {
        setLoadError('rate_limited');
        const cached = getFriendProjection(userId, id);
        if (cached) {
          setProfile(cached);
          setStale(true);
        }
        return;
      }
      setLoadError('error');
    }
  }, [id, offline, userId]);

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
    <SocialShell titleKey="friendProfile">
      {profile ? (
        <View style={{ marginTop: 16 }}>
          {stale ? <Text style={{ ...fontBody, color: colors.text300, marginBottom: 8 }}>{copy.stale}</Text> : null}
          {loadError === 'rate_limited' ? <Text style={{ ...fontBody, color: colors.text200, marginBottom: 8 }}>{copy.rateLimited}</Text> : null}
          <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 22, color: colors.text100 }}>{profile.displayName}</Text>
          <Text style={{ ...fontBody, color: colors.text200, marginTop: 6 }}>{profile.bio}</Text>
          <Text style={{ ...fontBody, color: colors.text300, marginTop: 8 }}>{profile.companionStage}</Text>
          {profile.garden ? (
            <View style={{ marginTop: 10 }}>
              <Text style={{ ...fontBody, color: colors.text200 }}>{copy.gardenPreview}</Text>
              <Text style={{ ...fontBody, color: colors.text300, marginTop: 4 }}>{profile.garden.atmosphereKey}</Text>
              {profile.garden.plots.map((plot) => (
                <Text key={plot.plotIndex} style={{ ...fontBody, color: colors.text200, marginTop: 4 }}>
                  {plot.plotIndex} · {plot.presentationKey} · {plot.stage}
                </Text>
              ))}
            </View>
          ) : (
            <Text style={{ ...fontBody, color: colors.text300, marginTop: 10 }}>{copy.gardenOff}</Text>
          )}
          <Text style={{ ...fontBody, color: colors.text300, marginTop: 16 }}>{copy.waveHint}</Text>
          {WAVES.map((type) => (
            <SocialButton
              key={type}
              disabled={!canMutate}
              label={copy[type]}
              onPress={() => {
                setWaveNotice('');
                void mediWorldApi.socialWave(profile.publicId, type, newSocialIdempotency(type)).then(() => {
                  setWaveNotice(copy.waveSent);
                }).catch((error) => {
                  const kind = socialUiFailure(error);
                  setWaveNotice(kind === 'unavailable' ? copy.unavailable : kind === 'rate_limited' ? copy.rateLimited : copy.retry);
                });
              }}
            />
          ))}
          {waveNotice ? <Text style={{ ...fontBody, color: colors.text100, marginTop: 8 }}>{waveNotice}</Text> : null}
          <SocialButton label={copy.report} onPress={() => router.push(`/medi-world/social/report?publicId=${profile.publicId}` as never)} />
          <SocialButton
            disabled={!canMutate}
            label={copy.block}
            onPress={() => {
              void mediWorldApi.socialBlock(profile.publicId).then(() => {
                if (userId && id) revokeFriendProjection(userId, id);
                router.replace('/medi-world/social/friends' as never);
              });
            }}
          />
        </View>
      ) : (
        <>
          <Text style={{ ...fontBody, color: colors.text300, marginTop: 12 }}>
            {loadError === 'unavailable' ? copy.unavailable : loadError === 'rate_limited' ? copy.rateLimited : offline ? copy.stale : copy.retry}
          </Text>
          {loadError && loadError !== 'unavailable' ? <SocialButton label={copy.retry} onPress={() => void load()} /> : null}
        </>
      )}
    </SocialShell>
  );
}
