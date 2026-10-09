import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  Bean, BeanOff, Check, Droplets, Egg, EggOff, Fish, FishOff, Flame, Flower2, LeafyGreen, Milk, MilkOff,
  Nut, NutOff, Salad, Shell, Shrimp, Sprout, Utensils, Vegan, Wheat, WheatOff, Wine, X,
  type LucideIcon,
} from 'lucide-react-native';
import { useThemeColors } from '@/theme/colors';

/**
 * The cycle log's icon tile (CycleIconTile: 56 pt disc, glyph, label, ring + badge when chosen) for MEDIFOOD
 * choices. `exclude` tiles mean „leave this out“: the chosen state swaps to the crossed-out glyph where
 * one exists and wears a red ✕ instead of the ✓.
 */
const TILE_W = 70;
const DISC = 56;
const GLYPH = 26;

type Glyph = { on: LucideIcon; off?: LucideIcon };
export const FOOD_GLYPHS: Record<string, Glyph> = {
  balanced: { on: Utensils },
  vegetarian: { on: Salad },
  vegan: { on: Vegan },
  milk: { on: Milk, off: MilkOff },
  eggs: { on: Egg, off: EggOff },
  fish: { on: Fish, off: FishOff },
  shellfish: { on: Shrimp },
  nuts: { on: Nut, off: NutOff },
  peanuts: { on: Bean, off: BeanOff },
  soy: { on: Sprout },
  gluten: { on: Wheat, off: WheatOff },
  sesame: { on: Droplets },
  celery: { on: LeafyGreen },
  mustard: { on: Flame },
  sulphites: { on: Wine },
  lupin: { on: Flower2 },
  molluscs: { on: Shell },
};

export function FoodIconTile({ id, label, selected, onPress, ink, exclude = false, disabled = false, role = 'checkbox' }: {
  id: string;
  label: string;
  selected: boolean;
  onPress: () => void;
  /** Module ink (MEDIFOOD green) for normal choices. */
  ink: string;
  exclude?: boolean;
  disabled?: boolean;
  role?: 'checkbox' | 'radio';
}) {
  const c = useThemeColors();
  const glyph = FOOD_GLYPHS[id] || { on: Utensils };
  const tone = selected ? (exclude ? c.danger : ink) : c.text200;
  const Icon = selected && exclude && glyph.off ? glyph.off : glyph.on;
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityState={role === 'radio' ? { selected, disabled } : { checked: selected, disabled }}
      accessibilityLabel={label}
      disabled={disabled}
      onPress={() => {
        Haptics.selectionAsync().catch(() => undefined);
        onPress();
      }}
      style={[s.tile, { opacity: disabled ? 0.75 : 1 }]}
    >
      <View style={[s.disc, { backgroundColor: selected ? tone + '14' : c.bg200 }, selected ? { borderWidth: 2, borderColor: tone } : null]}>
        <Icon size={GLYPH} strokeWidth={1.7} color={tone} />
        {selected ? (
          <View style={[s.badge, { backgroundColor: tone, borderColor: c.surface }]}>
            {exclude ? <X size={11} color="#fff" strokeWidth={3.2} /> : <Check size={11} color="#fff" strokeWidth={3.2} />}
          </View>
        ) : null}
      </View>
      <Text
        numberOfLines={2}
        style={[s.label, { color: selected ? c.text100 : c.text200, fontFamily: selected ? 'NotoSansGeorgian_600SemiBold' : 'NotoSansGeorgian_500Medium', fontSize: label.length > 11 ? 10.5 : 11.5 }]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** Tiles on even columns across the width (same idea as the cycle log's spread grid). */
export function FoodIconGrid({ children, role }: { children: React.ReactNode; role?: 'radiogroup' }) {
  return <View accessibilityRole={role} style={s.grid}>{children}</View>;
}

const s = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start', columnGap: 6, rowGap: 14 },
  tile: { width: TILE_W, alignItems: 'center', gap: 6 },
  disc: { width: DISC, height: DISC, borderRadius: DISC / 2, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', right: -2, top: -2, width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  label: { textAlign: 'center', lineHeight: 15, maxWidth: TILE_W },
});
