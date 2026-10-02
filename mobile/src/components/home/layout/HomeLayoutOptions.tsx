import React from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Check } from 'lucide-react-native';
import { HomeLayoutThumb } from '@/components/home/layout/HomeLayoutThumb';
import type { FeatureState } from '@/lib/featureFlags';
import {
  availableHomeLayouts,
  HOME_LAYOUT_DESCRIPTIONS,
  HOME_LAYOUT_NAMES,
  homeLayoutAvailable,
  type HomeLayoutId,
} from '@/lib/home/homeLayout';
import { tx } from '@/i18n/locale';
import { homeAccentFor } from '@/theme/homeAccent';
import { HUB, hubText } from '@/theme/hub';
import { useIsDark, useThemeColors } from '@/theme/colors';

type Props = {
  value: HomeLayoutId | null;
  onSelect: (layout: HomeLayoutId) => void;
  gender: string | null | undefined;
  features: FeatureState;
  recommended: HomeLayoutId | null;
  /** Card fill: the picker sits on a surface sheet, onboarding on the page canvas. */
  onSurface?: boolean;
};

/** The four layouts as radio cards (two columns; one column of rows under 360 pt). */
export function HomeLayoutOptions({ value, onSelect, gender, features, recommended, onSurface = true }: Props) {
  const c = useThemeColors();
  const dark = useIsDark();
  const narrow = useWindowDimensions().width < 360;
  const idle = onSurface ? (dark ? c.bg200 : c.bg100) : c.surface;
  return (
    <View accessibilityRole="radiogroup" style={[s.grid, narrow && s.gridNarrow]}>
      {availableHomeLayouts(gender).map((id) => {
        const available = homeLayoutAvailable(id, gender, features);
        const selected = id === value;
        const accent = homeAccentFor(id, dark, c);
        return (
          <Pressable
            key={id}
            accessibilityRole="radio"
            accessibilityState={{ selected, disabled: !available }}
            accessibilityLabel={`${HOME_LAYOUT_NAMES[id]}. ${HOME_LAYOUT_DESCRIPTIONS[id]}`}
            disabled={!available}
            onPress={() => onSelect(id)}
            style={[
              s.card,
              narrow ? s.cardNarrow : s.cardWide,
              {
                backgroundColor: selected ? accent.tint : idle,
                borderColor: selected ? accent.ink : 'transparent',
                opacity: available ? 1 : 0.45,
              },
            ]}
          >
            <View style={narrow ? { width: 96 } : undefined}>
              <HomeLayoutThumb layout={id} height={narrow ? 76 : 104} />
            </View>
            <View style={[{ gap: 2, paddingHorizontal: 2 }, narrow ? { flex: 1 } : null]}>
              <View style={s.nameRow}>
                <Text style={[hubText.cardTitle, { color: c.text100 }]}>{HOME_LAYOUT_NAMES[id]}</Text>
                {id === recommended && available ? (
                  <View style={[s.badge, { backgroundColor: accent.tint }]}>
                    <Text style={[s.badgeText, { color: accent.ink }]}>{tx('შენთვის', 'For you')}</Text>
                  </View>
                ) : null}
              </View>
              <Text numberOfLines={3} style={[hubText.caption, { color: c.text200 }]}>
                {available ? HOME_LAYOUT_DESCRIPTIONS[id] : tx('დროებით მიუწვდომელია', 'Unavailable for now')}
              </Text>
            </View>
            {selected ? (
              <View style={[s.check, { backgroundColor: accent.cta, borderColor: c.surface }]}>
                <Check size={14} color={accent.onCta} strokeWidth={3} />
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  gridNarrow: { flexDirection: 'column' },
  card: { borderRadius: HUB.cardRadius, borderWidth: 2, padding: 10, gap: 8 },
  cardWide: { flexBasis: '46%', flexGrow: 1 },
  cardNarrow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  nameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  badge: { borderRadius: 7, paddingHorizontal: 7, paddingVertical: 2 },
  badgeText: { fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 10, lineHeight: 14 },
  check: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
