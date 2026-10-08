import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { SvgXml } from 'react-native-svg';
import { Check } from 'lucide-react-native';
import { CYCLE_ICON_SVG, type CycleIconGlyph } from '@/constants/cycleIconSvg';
import { tx } from '@/i18n/locale';
import { foldTiles } from '@/lib/cycleFullLog';
import { tileLabelFit, type CycleIconGroup } from '@/lib/cycleIconMap';
import { useCycleColors } from '@/theme/cycle';

/**
 * One tile for everything a woman can log (2026-10-03): a 60 pt disc, one flat glyph, a label.
 * Selected = a 2 pt ring and a ✓ badge in the group's ink (bleeding rose, fertility turquoise,
 * everything else the plain ink — colour means a fact or a phase, never a category). Flo's and
 * Clue's pickers are built the same way; this replaces five chip systems.
 */
export const TILE_W = 70;
const DISC = 56;
const GLYPH = 32;

export type CycleIconTileProps = {
  glyph: CycleIconGlyph;
  label: string;
  selected: boolean;
  onPress: () => void;
  onLongPress?: () => void;
  /** Screen-reader name of the long-press action (pain: „ინტენსივობის არჩევა“). */
  longPressLabel?: string;
  group?: CycleIconGroup;
  disabled?: boolean;
  /** Bleeding amount: the drop's size and opacity; `hollow` draws the „არა“ outline drop. */
  glyphScale?: number;
  glyphOpacity?: number;
  hollow?: boolean;
  /** Strength or level under the label: `level` of `levelMax` dots (pain 1–3 of 3, energy 1–5 of 5; 0 = all empty, e.g. no caffeine). */
  level?: number | null;
  levelMax?: number;
  /** Spoken name of the level; pain tiles default to მსუბუქი / ზომიერი / ძლიერი, level tiles carry it in the label. */
  levelName?: string | null;
  /** Pre-filled from a device or an expectation — a dashed ring until confirmed. */
  dashed?: boolean;
  /** `button` = an action tile (e.g. „იგივე, რაც გუშინ“), not a choice that stays selected. */
  role?: 'checkbox' | 'radio' | 'button';
  accessibilityHint?: string;
  /** A fact, not a choice (day sheet): drawn selected, no press, no haptic, read as text. */
  readOnly?: boolean;
  /** Read-only tiles only: a tap opens „გაიგე მეტი“ for the fact (day sheet) instead of doing nothing. */
  onExplain?: () => void;
};

export function CycleIconTile({
  glyph,
  label,
  selected,
  onPress,
  onLongPress,
  longPressLabel,
  group = 'neutral',
  disabled = false,
  glyphScale = 1,
  glyphOpacity = 1,
  hollow = false,
  level = null,
  levelMax = 3,
  levelName,
  dashed = false,
  role = 'checkbox',
  accessibilityHint,
  readOnly = false,
  onExplain,
}: CycleIconTileProps) {
  const c = useCycleColors();
  const ink = group === 'bleeding' ? c.period : group === 'fertility' ? c.fertile : c.ink;
  const onInk = group === 'neutral' ? c.card : c.onPeriod;
  const size = Math.round(GLYPH * glyphScale);
  const spokenLevel = level ? (levelName === undefined ? (levelMax === 3 ? levelLabel(level as 1 | 2 | 3) : null) : levelName) : null;
  const dots = Math.max(1, Math.min(6, Math.round(levelMax)));
  const explainable = readOnly && Boolean(onExplain);
  return (
    <Pressable
      accessibilityRole={explainable ? 'button' : readOnly ? 'text' : role}
      accessibilityState={readOnly ? undefined : role === 'radio' ? { selected, disabled } : role === 'button' ? { disabled } : { checked: selected, disabled }}
      accessibilityLabel={spokenLevel ? `${label}, ${spokenLevel}` : label}
      accessibilityHint={explainable ? tx('გაიგე მეტი', 'Learn more') : readOnly ? undefined : accessibilityHint}
      disabled={disabled || (readOnly && !explainable)}
      onPress={() => {
        if (readOnly) {
          onExplain?.();
          return;
        }
        Haptics.selectionAsync().catch(() => undefined);
        onPress();
      }}
      onLongPress={readOnly ? undefined : onLongPress}
      accessibilityActions={!readOnly && onLongPress && longPressLabel ? [{ name: 'longpress', label: longPressLabel }] : undefined}
      onAccessibilityAction={
        !readOnly && onLongPress && longPressLabel
          ? (e) => {
              if (e.nativeEvent.actionName === 'longpress') onLongPress();
            }
          : undefined
      }
      style={[s.tile, { opacity: disabled && !readOnly ? 0.5 : 1 }]}
    >
      <View
        style={[
          s.disc,
          { backgroundColor: c.creamDeep },
          selected ? { borderWidth: 2, borderColor: ink } : null,
          dashed && !selected ? { borderWidth: 1.5, borderColor: ink, borderStyle: 'dashed' } : null,
        ]}
      >
        {hollow ? (
          <View style={{ width: size * 0.62, height: size * 0.62, borderRadius: size, borderWidth: 2.5, borderColor: ink, opacity: glyphOpacity }} />
        ) : (
          <View style={{ opacity: glyphOpacity }}>
            <SvgXml xml={CYCLE_ICON_SVG[glyph]} width={size} height={size} color={ink} />
          </View>
        )}
        {selected ? (
          <View style={[s.badge, { backgroundColor: ink }]}>
            <Check size={11} color={onInk} strokeWidth={3.2} />
          </View>
        ) : null}
      </View>
      <Text
        numberOfLines={2}
        style={[s.label, labelFit(label), { color: selected ? c.ink : c.muted, fontFamily: selected ? 'NotoSansGeorgian_600SemiBold' : 'NotoSansGeorgian_500Medium' }]}
      >
        {label}
      </Text>
      {level != null ? (
        <View style={s.dots} accessible={false}>
          {Array.from({ length: dots }, (_, i) => i + 1).map((n) => (
            <View key={n} style={[s.dot, { backgroundColor: n <= level ? ink : c.border }]} />
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}

function labelFit(label: string) {
  return tileLabelFit(label, TILE_W);
}

export function levelLabel(level: 1 | 2 | 3): string {
  return level === 1 ? tx('მსუბუქი', 'mild') : level === 2 ? tx('ზომიერი', 'moderate') : tx('ძლიერი', 'severe');
}

/** The „+N“ tile that opens the rest of a group. */
export function CycleMoreTile({ count, onPress, label }: { count: number; onPress: () => void; label?: string }) {
  const c = useCycleColors();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label ?? tx(`კიდევ ${count}`, `${count} more`)} onPress={onPress} style={s.tile}>
      <View style={[s.disc, { borderWidth: 1.5, borderColor: c.border }]}>
        <Text style={[s.more, { color: c.muted }]}>{`+${count}`}</Text>
      </View>
      <Text numberOfLines={1} style={[s.label, { color: c.muted }]}>
        {label ?? tx('ყველა', 'All')}
      </Text>
    </Pressable>
  );
}

/**
 * Column gap that spreads tiles over the whole width: as many 70 pt columns as fit with at least
 * `minGap` between them, the spare width shared out evenly. Every row of a card then sits on the same
 * columns, and a short row („ყველაფერი რიგზეა“ + two symptoms) keeps the same airy spacing instead of
 * huddling on the left with its two-line labels touching (owner 2026-10-08).
 */
export function tileGridGap(width: number, minGap: number): number {
  if (!(width > 0)) return minGap;
  const cols = Math.max(1, Math.floor((width + minGap) / (TILE_W + minGap)));
  if (cols < 2) return minGap;
  return Math.max(minGap, Math.floor(((width - cols * TILE_W) / (cols - 1)) * 2) / 2);
}

/** A wrapping grid of tiles that measures itself and spreads them with `tileGridGap`. */
export function CycleTileGrid({ minGap = 2, style, children }: { minGap?: number; style?: StyleProp<ViewStyle>; children: React.ReactNode }) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (Math.abs(w - width) > 0.5) setWidth(w);
  };
  return (
    <View onLayout={onLayout} style={[s.row, style, { columnGap: tileGridGap(width, minGap) }]}>
      {children}
    </View>
  );
}

/**
 * A row of tiles: the first `visible` ones (plus every selected one, so an edited day never hides what
 * it holds) and a „+N“ tile; tapping it unfolds the whole group as a wrapped grid (same tiles, same
 * order). Rendering is left to `renderTile` so rows stay dumb. `gap` is the smallest column gap; the
 * grid spreads the tiles over the full width (0 lets five 70 pt tiles share a 350 pt card).
 */
export function CycleIconRow<T extends { id: string }>({
  items,
  visible = 5,
  renderTile,
  expandedByDefault = false,
  isSelected,
  gap = 2,
}: {
  items: T[];
  visible?: number;
  renderTile: (item: T) => React.ReactNode;
  expandedByDefault?: boolean;
  isSelected?: (item: T) => boolean;
  gap?: number;
}) {
  const [expanded, setExpanded] = useState(expandedByDefault);
  const folded = foldTiles(items, visible, isSelected ?? (() => false));
  const shown = expanded ? items : folded.shown;
  return (
    <CycleTileGrid minGap={gap}>
      {shown.map((item) => (
        <React.Fragment key={item.id}>{renderTile(item)}</React.Fragment>
      ))}
      {!expanded && folded.hidden > 0 ? <CycleMoreTile count={folded.hidden} onPress={() => setExpanded(true)} /> : null}
    </CycleTileGrid>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 2, rowGap: 12 },
  tile: { width: TILE_W, alignItems: 'center', gap: 6 },
  disc: { width: DISC, height: DISC, borderRadius: DISC / 2, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -3, right: -3, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 10.5, lineHeight: 13, textAlign: 'center', width: TILE_W + 6, marginHorizontal: -3 },
  dots: { flexDirection: 'row', gap: 3, marginTop: -2 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  more: { fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14 },
});
