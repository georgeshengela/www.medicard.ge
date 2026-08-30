import React from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOffline } from '@/hooks/useOffline';
import { ka } from '@/i18n/ka';
import { useThemeColors } from '@/theme/colors';

/** Non-blocking hint when the device cannot reach the API (OBS-NET-01). */
export function OfflineBanner() {
  const offline = useOffline();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();

  if (!offline) return null;

  return (
    <View
      accessibilityRole="text"
      accessibilityLiveRegion="polite"
      style={{
        paddingTop: Math.max(insets.top, 8),
        paddingHorizontal: 16,
        paddingBottom: 10,
        backgroundColor: colors.warningBg,
        borderBottomWidth: 1,
        borderBottomColor: colors.bg300,
      }}
    >
      <Text
        style={{
          color: colors.warning,
          fontSize: 13,
          fontWeight: '700',
        }}
      >
        {ka.common.offlineMode}
      </Text>
      <Text style={{ color: colors.text200, fontSize: 12, marginTop: 2, lineHeight: 16 }}>
        {ka.common.offlineCached}
      </Text>
    </View>
  );
}
