import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  CalendarCheck,
  Camera,
  FlaskConical,
  Scale,
  ScanLine,
  Stethoscope,
  Sun,
  type LucideIcon,
} from 'lucide-react-native';
import { useIsDark, useThemeColors } from '@/theme/colors';
import { HUB, hubTint } from '@/theme/hub';

type Action = {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  light: string;
  dark: string;
};

/** The things people open Medicard to *do*. Most frequent first; the rest peek from the right edge. */
const ACTIONS: Action[] = [
  { key: 'symptoms', label: 'სიმპტომები', href: '/symptoms', icon: Stethoscope, light: '#0F766E', dark: '#5EEAD4' },
  { key: 'lab', label: 'ანალიზი', href: '/module/lab', icon: FlaskConical, light: '#1D4ED8', dark: '#93C5FD' },
  { key: 'food', label: 'კვება', href: '/nutrition', icon: Camera, light: '#B45309', dark: '#FCD34D' },
  { key: 'weight', label: 'წონა', href: '/health-metrics/weight', icon: Scale, light: '#6D28D9', dark: '#C4B5FD' },
  { key: 'visits', label: 'ვიზიტები', href: '/visits', icon: CalendarCheck, light: '#BE185D', dark: '#F9A8D4' },
  { key: 'imaging', label: 'რენტგენი', href: '/module/imaging', icon: ScanLine, light: '#0369A1', dark: '#7DD3FC' },
  { key: 'skin', label: 'კანი', href: '/module/skin', icon: Sun, light: '#A16207', dark: '#FDE68A' },
];

const TILE = 78;

export function HomeQuickActions() {
  const c = useThemeColors();
  const dark = useIsDark();
  const router = useRouter();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: HUB.gutter, gap: 10 }}
      style={{ marginHorizontal: -HUB.gutter }}
    >
      {ACTIONS.map((action) => {
        const ink = dark ? action.dark : action.light;
        return (
          <Pressable
            key={action.key}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            onPress={() => router.push(action.href as never)}
            style={[s.tile, { backgroundColor: c.surface }]}
          >
            <View style={[s.iconWrap, { backgroundColor: hubTint(ink, dark) }]}>
              <action.icon size={22} color={ink} strokeWidth={1.9} />
            </View>
            <Text numberOfLines={1} style={[s.label, { color: c.text100 }]}>
              {action.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  tile: {
    width: TILE,
    paddingVertical: 12,
    borderRadius: 20,
    alignItems: 'center',
    gap: 8,
  },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: 'NotoSansGeorgian_600SemiBold',
    fontSize: 11,
    lineHeight: 15,
  },
});
