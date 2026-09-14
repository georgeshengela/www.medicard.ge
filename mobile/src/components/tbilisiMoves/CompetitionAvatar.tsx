import React from 'react';
import { Image, Text, View } from 'react-native';
import { AVATAR_SOURCES, isAvatarId } from '@/constants/avatarAssets';
import { initialsFromHandle } from '@/lib/tbilisiMoves/format';
import { useThemeColors } from '@/theme/colors';

export function CompetitionAvatar({
  avatarId,
  handle,
  size = 44,
}: {
  avatarId?: string | null;
  handle?: string | null;
  size?: number;
}) {
  const colors = useThemeColors();
  if (avatarId && isAvatarId(avatarId)) {
    return (
      <Image
        source={AVATAR_SOURCES[avatarId]}
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.accent100 }}
      />
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.accent100,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: size * 0.32, color: colors.primary200 }}>
        {initialsFromHandle(handle)}
      </Text>
    </View>
  );
}
