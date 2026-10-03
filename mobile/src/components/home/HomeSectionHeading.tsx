import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { HUB, hubText } from '@/theme/hub';
import { useThemeColors } from '@/theme/colors';
import { useHomeAccent } from '@/theme/homeAccent';
import { ModuleWordmark } from '@/components/brand/ModuleWordmark';
import type { ModuleBrandId } from '@/theme/moduleBrand';

/** Section label that sits above its card, with an optional right-aligned link. */
export function HomeSectionHeading({
  title,
  brand,
  linkLabel,
  onLink,
}: {
  title: string;
  /** MEDI module wordmark in place of the title text (title stays the accessible name). */
  brand?: ModuleBrandId;
  linkLabel?: string;
  onLink?: () => void;
}) {
  const c = useThemeColors();
  const accent = useHomeAccent();
  return (
    <View style={s.row}>
      {brand ? (
        <View style={{ flex: 1 }}><ModuleWordmark module={brand} size={19} /></View>
      ) : (
        <Text accessibilityRole="header" style={[hubText.sectionTitle, { color: c.text100, flex: 1 }]}>
          {title}
        </Text>
      )}
      {linkLabel && onLink ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${title} — ${linkLabel}`}
          onPress={onLink}
          style={s.link}
        >
          <Text style={[hubText.link, { color: accent.ink }]}>{linkLabel}</Text>
          <ChevronRight size={15} color={accent.ink} />
        </Pressable>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: HUB.headingGap,
  },
  link: {
    minHeight: 44,
    flexDirection: 'row',
    gap: 2,
    alignItems: 'center',
  },
});
