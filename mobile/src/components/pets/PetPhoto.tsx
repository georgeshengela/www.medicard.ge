import React, { useEffect, useState } from 'react';
import { Image, Text, View } from 'react-native';
import { PawPrint } from 'lucide-react-native';
import { API_BASE_URL } from '@/lib/api';
import { privateFileImageSource } from '@/lib/privateFile';
import { getToken } from '@/lib/storage';
import { useThemeColors } from '@/theme/colors';

export function PetPhoto({
  photoUrl,
  name,
  size = 64,
}: {
  photoUrl: string | null;
  name: string;
  size?: number;
}) {
  const colors = useThemeColors();
  const [source, setSource] = useState<{ uri: string; headers: { Authorization: string } } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    void (async () => {
      const token = await getToken();
      const next = privateFileImageSource(photoUrl, token, API_BASE_URL);
      if (!cancelled) setSource(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [photoUrl]);

  const letter = (name || '?').trim().slice(0, 1).toUpperCase();
  const radius = size / 2;

  if (!source || failed) {
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
        }}
      >
        {letter ? (
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
