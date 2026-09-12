import React from 'react';
import { Platform, Text, View } from 'react-native';
import { MedicardLogoMark } from '@/components/ui/MedicardLogoMark';
import { APP_VERSION } from '@/lib/appVersion';
import { versionLegend } from '@/lib/medicardVersion';
import { ka } from '@/i18n/ka';
import { useThemeColors } from '@/theme/colors';

const VERSION_FONT = Platform.select({
  ios: 'Menlo',
  android: 'sans-serif-medium',
  default: 'ui-monospace',
});

/** Compact About row — five-part wordmark, not a stacked hero. */
export function ProfileVersionCard() {
  const colors = useThemeColors();
  const legend = versionLegend(APP_VERSION);
  const lastDot = APP_VERSION.lastIndexOf('.');
  const head = lastDot >= 0 ? APP_VERSION.slice(0, lastDot + 1) : APP_VERSION;
  const tail = lastDot >= 0 ? APP_VERSION.slice(lastDot + 1) : '';

  return (
    <View
      accessibilityLabel={`${ka.profile.version} ${APP_VERSION}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: 54,
        paddingHorizontal: 14,
        paddingVertical: 10,
      }}
    >
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          backgroundColor: colors.accent100,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <MedicardLogoMark size={18} />
      </View>

      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          style={{
            fontFamily: VERSION_FONT,
            fontSize: 16,
            lineHeight: 20,
            letterSpacing: 0.4,
            fontVariant: ['tabular-nums'],
            color: colors.text100,
          }}
        >
          {head}
          <Text style={{ color: colors.primary200 }}>{tail}</Text>
        </Text>
        {legend ? (
          <Text
            numberOfLines={1}
            style={{
              marginTop: 2,
              fontFamily: 'NotoSansGeorgian_400Regular',
              fontSize: 12,
              lineHeight: 16,
              color: colors.text300,
            }}
          >
            {ka.profile.versionGeneration} {legend.generation}
            {' · '}
            {ka.profile.versionSeries} {legend.train}
            {' · '}
            {ka.profile.versionRevision} {legend.revision}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
