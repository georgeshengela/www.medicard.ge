import React from 'react';
import { Pressable, Text, View, type ViewStyle } from 'react-native';
import { aiConsentDeclinedText, aiConsentRetryLabel } from '@/lib/aiConsentDecline';
import { useThemeColors } from '@/theme/colors';

/**
 * The calm state after she declined or closed the AI disclosure (App Review correction 2026-09-22:
 * a choice, never a network error). One neutral line and a neutral „ხელახლა ცდა“ that runs the same
 * request again — the consent flow runs first, so the disclosure opens again. No red, no error
 * toast, no error haptic; the caller keeps whatever the person typed or picked.
 */
export function AiConsentDeclinedNote({ onRetry, busy = false, background, style }: {
  onRetry?: () => void;
  busy?: boolean;
  /** Card fill; defaults to the theme surface. Pass a raised tone on screens whose canvas is the surface. */
  background?: string;
  style?: ViewStyle;
}) {
  const C = useThemeColors();
  return (
    <View accessibilityLiveRegion="polite" style={[{ padding: 14, gap: 10, borderRadius: 22, backgroundColor: background ?? C.surface }, style ?? null]}>
      <Text style={{ fontSize: 14, lineHeight: 21, color: C.text200, fontFamily: 'NotoSansGeorgian_400Regular' }}>{aiConsentDeclinedText()}</Text>
      {onRetry ? (
        <Pressable accessibilityRole="button" disabled={busy} onPress={onRetry}
          style={{ alignSelf: 'flex-start', minHeight: 44, paddingHorizontal: 18, borderRadius: 22, justifyContent: 'center', backgroundColor: C.accent100, opacity: busy ? 0.55 : 1 }}>
          <Text style={{ color: C.primary100, fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14 }}>{aiConsentRetryLabel()}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
