import React, { useEffect, useState } from 'react';
import { Image, Platform, Text, View, type ImageSourcePropType } from 'react-native';
import { PawPrint } from 'lucide-react-native';
import { API_BASE_URL } from '@/lib/api';
import { cachedAuthImage } from '@/lib/authImageCache';
import { privateFileImageSource } from '@/lib/privateFile';
import { getToken } from '@/lib/storage';
import { localAccountId } from '@/lib/localAccount';
import { useThemeColors } from '@/theme/colors';
import { PETS_ART } from '@/constants/appArt';

/** 3D species portrait; unknown species fall back to the generic one. */
export function petSpeciesArt(speciesId: string): ImageSourcePropType {
  return (PETS_ART as Record<string, ImageSourcePropType>)[speciesId] ?? PETS_ART.other;
}

export function PetPhoto({
  photoUrl,
  name,
  size = 64,
  speciesId,
}: {
  photoUrl: string | null;
  name: string;
  size?: number;
  /** When set, the no-photo fallback shows the species portrait instead of the first letter. */
  speciesId?: string | null;
}) {
  const colors = useThemeColors();
  const [source, setSource] = useState<{ uri: string; headers: { Authorization: string } } | null>(null);
  const [failed, setFailed] = useState(false);
  const owner = localAccountId();
  const [loadedKey, setLoadedKey] = useState('');
  const sourceKey = `${owner}:${photoUrl}`;

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    setSource(null);
    void (async () => {
      const token = await getToken();
      let next = privateFileImageSource(photoUrl, token, API_BASE_URL);
      // Android's <Image> drops the Authorization header (401): show a cached, authorised download instead.
      if (next && token && Platform.OS !== 'web') next = { uri: await cachedAuthImage(next.uri, token, owner ?? ''), headers: { Authorization: '' } };
      if (!cancelled && localAccountId() === owner) { setSource(next); setLoadedKey(sourceKey); }
    })().catch(() => { if (!cancelled) setFailed(true); });
    return () => {
      cancelled = true;
    };
  }, [photoUrl, owner, sourceKey]);

  const letter = (name || '?').trim().slice(0, 1).toUpperCase();
  const radius = size / 2;

  if (!source || failed || sourceKey !== loadedKey) {
    return (
      <View
        accessibilityRole="image"
        accessibilityLabel={name}
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: colors.accent100,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {speciesId !== undefined ? (
          <Image
            source={petSpeciesArt(speciesId ?? 'other')}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
            style={{ width: size * 0.9, height: size * 0.9 }}
          />
        ) : letter ? (
          <Text style={{ color: colors.primary100, fontSize: size * 0.38, fontFamily: 'NotoSansGeorgian_700Bold' }}>{letter}</Text>
        ) : (
          <PawPrint size={size * 0.42} color={colors.primary200} strokeWidth={2} />
        )}
      </View>
    );
  }

  return (
    <Image
      accessibilityLabel={name}
      source={source}
      onError={() => setFailed(true)}
      style={{ width: size, height: size, borderRadius: radius, backgroundColor: colors.bg200 }}
    />
  );
}
