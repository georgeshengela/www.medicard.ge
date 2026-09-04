import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Moon, Sun } from 'lucide-react-native';
import { useFigmaAuth } from '@/constants/figmaAuthLayout';
import { ka } from '@/i18n/ka';
import { useThemeColors } from '@/theme/colors';
import { useTheme, type ThemePreference } from '@/store/ThemeContext';

const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'light', label: ka.profile.themeLight },
  { value: 'dark', label: ka.profile.themeDark },
  { value: 'system', label: ka.profile.themeSystem },
];

function ThemePreview({ kind, selected }: { kind: ThemePreference; selected: boolean }) {
  const ring = selected ? 'rgba(255,255,255,0.65)' : 'rgba(15,26,28,0.12)';

  if (kind === 'system') {
    return (
      <View style={[styles.swatch, { borderColor: ring }]}>
        <View style={styles.splitRow}>
          <View style={[styles.splitHalf, styles.splitLight]}>
            <Sun size={8} color="#0F766E" strokeWidth={2.6} />
          </View>
          <View style={[styles.splitHalf, styles.splitDark]}>
            <Moon size={8} color="#99F6E4" strokeWidth={2.6} />
          </View>
        </View>
      </View>
    );
  }

  const dark = kind === 'dark';
  return (
    <View
      style={[
        styles.swatch,
        { backgroundColor: dark ? '#030712' : '#FFFFFF', borderColor: ring },
      ]}
    >
      {dark ? (
        <Moon size={11} color="#99F6E4" strokeWidth={2.4} />
      ) : (
        <Sun size={11} color="#0F766E" strokeWidth={2.4} />
      )}
    </View>
  );
}

export function ThemeSelect() {
  const { preference, setPreference } = useTheme();
  const colors = useThemeColors();
  const auth = useFigmaAuth();

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={ka.profile.appearance}
      style={[styles.track, { borderColor: colors.bg300, backgroundColor: colors.bg200 }]}
    >
      {OPTIONS.map((option) => {
        const selected = preference === option.value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={option.label}
            accessibilityHint={option.value === 'system' ? ka.profile.themeHint : undefined}
            onPress={() => setPreference(option.value)}
            style={[styles.chip, selected ? { backgroundColor: auth.primaryBg } : undefined]}
          >
            <ThemePreview kind={option.value} selected={selected} />
            <Text
              numberOfLines={1}
              style={[styles.label, { color: selected ? colors.onPrimary : colors.text200 }]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 999,
    padding: 3,
    gap: 2,
  },
  chip: {
    flex: 1,
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 4,
    borderRadius: 999,
  },
  label: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  swatch: {
    width: 20,
    height: 20,
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splitRow: {
    flex: 1,
    flexDirection: 'row',
    alignSelf: 'stretch',
    width: '100%',
  },
  splitHalf: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splitLight: {
    backgroundColor: '#FFFFFF',
  },
  splitDark: {
    backgroundColor: '#030712',
  },
});
