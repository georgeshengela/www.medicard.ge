import React, { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import qrcode from 'qrcode-generator';
import { MedicardLogoMark } from '@/components/ui/MedicardLogoMark';

/**
 * MEDICARD-styled QR: rounded-square modules, rounded corner markers with a teal eye, and the logo in
 * the centre. Error correction H. Geometry verified with a decoder (jsQR) on 80 random codes at
 * 140–340 px: round dots failed, rounded squares ≥ 0.46 of a cell with a 20 % logo decoded 80/80.
 * Keep MODULE ≥ 0.47 and LOGO ≤ 0.2 if you restyle it.
 */
const MODULE = 0.47;
const LOGO = 0.2;

export function StyledQr({ value, size = 240, ink = '#0F1A1C', eye = '#0D9488', background = '#FFFFFF' }: { value: string; size?: number; ink?: string; eye?: string; background?: string }) {
  const model = useMemo(() => {
    const q = qrcode(0, 'H');
    q.addData(value);
    q.make();
    return q;
  }, [value]);
  const n = model.getModuleCount();
  const quiet = 2;
  const cell = size / (n + quiet * 2);
  const at = (i: number) => (i + quiet) * cell;
  const inFinder = (r: number, c: number) => (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
  const logoCells = Math.ceil(n * LOGO) | 1;
  const lo = Math.floor((n - logoCells) / 2);
  const inLogo = (r: number, c: number) => r >= lo - 1 && r <= lo + logoCells && c >= lo - 1 && c <= lo + logoCells;

  const dots: React.ReactElement[] = [];
  for (let r = 0; r < n; r += 1) {
    for (let c = 0; c < n; c += 1) {
      if (!model.isDark(r, c) || inFinder(r, c) || inLogo(r, c)) continue;
      dots.push(<Rect key={`${r}-${c}`} x={at(c) + cell * (0.5 - MODULE)} y={at(r) + cell * (0.5 - MODULE)} width={cell * MODULE * 2} height={cell * MODULE * 2} rx={cell * 0.3} fill={ink} />);
    }
  }
  const finder = (r: number, c: number) => (
    <React.Fragment key={`f${r}-${c}`}>
      <Rect x={at(c) + cell / 2} y={at(r) + cell / 2} width={cell * 6} height={cell * 6} rx={cell * 2} fill="none" stroke={ink} strokeWidth={cell} />
      <Rect x={at(c) + cell * 2} y={at(r) + cell * 2} width={cell * 3} height={cell * 3} rx={cell * 1.1} fill="url(#eye)" />
    </React.Fragment>
  );
  const logo = logoCells * cell;
  return (
    <View style={{ width: size, height: size }} accessibilityRole="image" accessibilityLabel="QR კოდი">
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id="eye" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#14B8A6" />
            <Stop offset="1" stopColor={eye} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={size} height={size} rx={cell * 3} fill={background} />
        {dots}
        {finder(0, 0)}
        {finder(0, n - 7)}
        {finder(n - 7, 0)}
      </Svg>
      <View
        pointerEvents="none"
        style={{ position: 'absolute', left: (size - logo) / 2, top: (size - logo) / 2, width: logo, height: logo, borderRadius: logo * 0.28, backgroundColor: background, alignItems: 'center', justifyContent: 'center' }}
      >
        <MedicardLogoMark size={logo * 0.78} />
      </View>
    </View>
  );
}
