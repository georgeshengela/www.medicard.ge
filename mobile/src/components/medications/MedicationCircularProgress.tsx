import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { MedicationPillIcon } from '@/components/medications/MedicationPillIcon';
import { FIGMA_MEDS, useFigmaMeds } from '@/constants/figmaMedicationsLayout';
import type { PillShape } from '@/types/medications';

type Props = {
  progress: number;
  size?: number;
  color?: string;
  shape?: PillShape;
  pillColor?: string;
  imageUrl?: string | null;
};

export function MedicationCircularProgress({
  progress,
  size = 64,
  color = FIGMA_MEDS.brand,
  shape = 'long',
  pillColor,
  imageUrl,
}: Props) {
  const FIGMA_MEDS = useFigmaMeds();
  const stroke = 5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, progress));
  const dash = c * pct;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={FIGMA_MEDS.border} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${dash} ${c}`}
          strokeLinecap="round"
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <MedicationPillIcon color={pillColor ?? color} shape={shape} size={size * 0.55} imageUrl={imageUrl} />
    </View>
  );
}

/** Figma 11416:83303 — 64px track, 5.33 stroke, ~26.67 radius. */
const RING_SIZE = 64;
const RING_STROKE = 5.33333;
const RING_R = (RING_SIZE - RING_STROKE) / 2;
const RING_C = RING_SIZE / 2;

function polar(deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: RING_C + RING_R * Math.cos(rad), y: RING_C + RING_R * Math.sin(rad) };
}

function arcPath(startDeg: number, endDeg: number) {
  const start = polar(startDeg);
  const end = polar(endDeg);
  const sweep = ((endDeg - startDeg) % 360 + 360) % 360;
  const large = sweep > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${RING_R} ${RING_R} 0 ${large} 1 ${end.x} ${end.y}`;
}

/** One rounded lane per scheduled dose — Figma gaps (~21° on a 5-step ring). */
function stepLanePaths(steps: number): string[] {
  const n = Math.max(1, steps);
  if (n === 1) return [];
  const gapDeg = Math.min(22, 110 / n);
  const sweep = (360 - n * gapDeg) / n;
  const origin = -90 + gapDeg / 2;
  return Array.from({ length: n }, (_, i) => {
    const a0 = origin + i * (sweep + gapDeg);
    return arcPath(a0, a0 + sweep);
  });
}

const FIGMA_PILL_OVAL =
  'M16.669 3.24554C19.3365 2.46106 21.9936 2.60918 23.693 4.30853C25.3922 6.00788 25.5404 8.66509 24.756 11.3325C23.9607 14.036 22.1563 16.9809 19.5675 19.5698C16.9787 22.1586 14.0337 23.963 11.3302 24.7582C8.66281 25.5427 6.0056 25.3945 4.30625 23.6953C2.60691 21.9959 2.45878 19.3387 3.24326 16.6713C4.03852 13.9678 5.84176 11.0217 8.4306 8.43288C11.0195 5.84403 13.9655 4.04078 16.669 3.24554ZM9.06293 10.3014C6.97423 12.5555 5.56041 14.9973 4.92263 17.1658C4.21439 19.574 4.50931 21.4237 5.54356 22.4579C6.57783 23.4921 8.42754 23.7871 10.8357 23.0789C13.0042 22.4411 15.4449 21.0261 17.699 18.9374L9.06293 10.3014ZM22.4557 5.54584C21.4214 4.51161 19.5716 4.21672 17.1635 4.92491C14.9955 5.56257 12.554 6.97602 10.3002 9.06407L18.9363 17.7001C21.0243 15.4464 22.4389 13.006 23.0766 10.838C23.7848 8.42988 23.4898 6.5801 22.4557 5.54584Z';

export function MedicationFigmaStepRing({ steps = 1, filled = 0 }: { steps?: number; filled?: number }) {
  const FIGMA_MEDS = useFigmaMeds();
  const n = Math.max(1, Math.round(steps));
  const lit = Math.max(0, Math.min(n, Math.round(filled)));
  const lanes = stepLanePaths(n);

  return (
    <View style={{ width: RING_SIZE, height: RING_SIZE, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`} fill="none" style={{ position: 'absolute' }}>
        {n === 1 ? (
          <Circle
            cx={RING_C}
            cy={RING_C}
            r={RING_R}
            stroke={lit >= 1 ? FIGMA_MEDS.brand : FIGMA_MEDS.border}
            strokeWidth={RING_STROKE}
            fill="none"
          />
        ) : (
          lanes.map((d, index) => (
            <Path
              key={`${n}-${index}`}
              d={d}
              stroke={index < lit ? FIGMA_MEDS.brand : FIGMA_MEDS.border}
              strokeWidth={RING_STROKE}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          ))
        )}
      </Svg>
      <Svg width={28} height={28} viewBox="0 0 28 28" fill="none">
        <Path fillRule="evenodd" clipRule="evenodd" d={FIGMA_PILL_OVAL} fill={FIGMA_MEDS.textSecondary} />
      </Svg>
    </View>
  );
}

export function MedicationProgressTrack({ width = 288, height = 92 }: { width?: number; height?: number }) {
  const FIGMA_MEDS = useFigmaMeds();
  return (
    <View style={{ width, height, borderRadius: FIGMA_MEDS.cardRadiusMd, overflow: 'hidden' }}>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Path d={`M0 0h${width}v${height}H0z`} fill={FIGMA_MEDS.white} />
      </Svg>
    </View>
  );
}
