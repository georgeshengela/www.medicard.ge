import type { ImageSourcePropType } from 'react-native';
import type { PillShape } from '@/types/medications';

/** Figma 8856:126835 — bundled local pill artwork (PNG from SVG). */
export const FIGMA_PILL_SHAPE_SOURCES: Record<PillShape, ImageSourcePropType> = {
  long: require('../../assets/figma/meds/long.png'),
  diamond: require('../../assets/figma/meds/diamond.png'),
  square: require('../../assets/figma/meds/square.png'),
  triangle: require('../../assets/figma/meds/triangle.png'),
  hexagon: require('../../assets/figma/meds/hexagon.png'),
  rectangle: require('../../assets/figma/meds/rectangle.png'),
  teardrop: require('../../assets/figma/meds/teardrop.png'),
  pentagon: require('../../assets/figma/meds/pentagon.png'),
  trapezoid: require('../../assets/figma/meds/trapezoid.png'),
  shield: require('../../assets/figma/meds/shield.png'),
  circle: require('../../assets/figma/meds/circle.png'),
};

export const FIGMA_SHAPE_PICKER_ROWS: PillShape[][] = [
  ['long', 'diamond', 'square', 'triangle'],
  ['hexagon', 'rectangle', 'teardrop', 'pentagon'],
  ['trapezoid', 'shield', 'circle', 'triangle'],
];

export const POPULAR_SEARCH_META = [
  { shape: 'rectangle' as const, alias: 'Lipitor', category: 'Diabetes Management' },
  { shape: 'hexagon' as const, alias: 'Levothyroxine', category: 'Used to treat hypothyroidism' },
  { shape: 'long' as const, alias: 'Glucophage', category: 'Diabetes Management' },
] as const;

export function pillShapeLabel(shape: PillShape, labels: Record<PillShape, string>): string {
  return labels[shape] ?? shape;
}
