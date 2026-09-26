import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { HUB, hubText } from '@/theme/hub';
import { useThemeColors } from '@/theme/colors';

/** Section label that sits above its card, with an optional right-aligned link. */
export function HomeSectionHeading({
  title,
  linkLabel,
  onLink,
}: {
  title: string;
  linkLabel?: string;
  onLink?: () => void;
}) {
  const c = useThemeColors();
  return (
    <View style={s.row}>
      <Text accessibilityRole="header" style={[hubText.sectionTitle, { color: c.text100, flex: 1 }]}>
        {title}
      </Text>
      {linkLabel && onLink ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${title} — ${linkLabel}`}
          onPress={onLink}
          style={s.link}
        >
          <Text style={[hubText.link, { color: c.primary100 }]}>{linkLabel}</Text>
          <ChevronRight size={15} color={c.primary100} />
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
