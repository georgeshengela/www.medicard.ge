import React, { useId } from 'react';
import Svg, { ClipPath, Defs, Path, Rect } from 'react-native-svg';
import { ANATOMICAL_BODY_VIEWS } from '@/lib/symptomBodyGeometry';
import { bodyPartById } from '@/constants/symptomCatalog';
import type { BodyPartId, BodySide, SymptomGender } from '@/types/symptoms';

export function SymptomBodyArtwork({ gender, side, width, height, selected, onSelect, fill, stroke, mini = false }: {
  gender: SymptomGender; side: BodySide; width: number; height: number;
  selected: BodyPartId | null; onSelect?: (id: BodyPartId) => void;
  fill: string; stroke: string; mini?: boolean;
}) {
  const view = ANATOMICAL_BODY_VIEWS[gender][side], prefix = useId().replace(/[^a-zA-Z0-9]/g, '');
  return <Svg width={width} height={height} viewBox={`0 0 ${view.w} ${view.h}`}>
    <Defs>{view.paths.filter(p => p.clip).map(p => <ClipPath key={p.key} id={`${prefix}-${p.key}`}><Rect x={0} y={p.clip!.y} width={view.w} height={p.clip!.height} /></ClipPath>)}</Defs>
    {view.paths.map(p => {
      const active = p.selectable && p.partId === selected;
      return <Path key={p.key} d={p.d} clipPath={p.clip ? `url(#${prefix}-${p.key})` : undefined}
        fill={p.fill === 'none' ? 'none' : active ? fill : p.fill}
        stroke={active ? stroke : mini ? '#D1D5DB' : '#9CA3AF'} strokeWidth={active && !mini ? 1.6 : 1}
        strokeLinejoin="round" strokeMiterlimit={10}
        pointerEvents={p.selectable && onSelect ? 'auto' : 'none'}
        accessibilityLabel={p.selectable ? bodyPartById(p.partId)?.labelKa : undefined}
        onPress={p.selectable && onSelect ? () => onSelect(p.partId) : undefined} />;
    })}
  </Svg>;
}
