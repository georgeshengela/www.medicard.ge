import React, { useMemo } from 'react';
import { Linking, Platform, Pressable, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { ExternalLink, MapPin } from 'lucide-react-native';
import { ka } from '@/i18n/ka';
import { buildLeafletMapHtml } from '@/lib/visitMapHtml';
import { useThemeColors } from '@/theme/colors';

type Props = {
  lat: number;
  lng: number;
  label?: string;
  height?: number;
};

export function VisitMapPreview({ lat, lng, label, height = 180 }: Props) {
  const colors = useThemeColors();
  const html = useMemo(() => buildLeafletMapHtml(lat, lng, label), [lat, lng, label]);

  const openExternal = () => {
    const url = Platform.select({
      ios: `maps:?q=${lat},${lng}`,
      android: `geo:${lat},${lng}?q=${lat},${lng}`,
      default: `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`,
    });
    if (url) void Linking.openURL(url);
  };

  return (
    <View className="overflow-hidden rounded-2xl border border-bg-300 bg-bg-200">
      <View className="flex-row items-center justify-between border-b border-bg-300 px-3.5 py-2.5">
        <View className="flex-row items-center">
          <MapPin size={14} color={colors.primary200} strokeWidth={2.2} />
          <Text className="ml-1.5 text-xs font-bold uppercase tracking-wide text-text-300">
            {ka.visits.mapPreview}
          </Text>
        </View>
        <Pressable accessibilityRole="button" onPress={openExternal} className="flex-row items-center">
          <Text className="text-xs font-semibold text-primary-200">{ka.visits.openMaps}</Text>
          <ExternalLink size={12} color={colors.primary200} strokeWidth={2.2} style={{ marginLeft: 4 }} />
        </Pressable>
      </View>
      <WebView
        originWhitelist={['*']}
        source={{ html }}
        style={{ height, backgroundColor: colors.bg200 }}
        scrollEnabled={false}
        nestedScrollEnabled
      />
    </View>
  );
}
