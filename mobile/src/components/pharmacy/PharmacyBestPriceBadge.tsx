import React from 'react';
import { Text, View } from 'react-native';
import { Crown, Sparkles } from 'lucide-react-native';
import { pharmPx } from '@/constants/pharmacyVisuals';
import { ka } from '@/i18n/ka';
import { useIsDark } from '@/theme/colors';

type Size = 'sm' | 'md' | 'lg';

const SIZES: Record<
  Size,
  { padX: number; padY: number; icon: number; font: number; gap: number; radius: number }
> = {
  sm: { padX: pharmPx(6), padY: pharmPx(3), icon: pharmPx(10), font: pharmPx(9), gap: pharmPx(3), radius: 999 },
  md: { padX: pharmPx(8), padY: pharmPx(4), icon: pharmPx(12), font: pharmPx(10), gap: pharmPx(4), radius: 999 },
  lg: { padX: pharmPx(10), padY: pharmPx(5), icon: pharmPx(14), font: pharmPx(11), gap: pharmPx(5), radius: 999 },
};

type Props = {
  accent?: string;
  size?: Size;
  variant?: 'pill' | 'ribbon';
};

export function PharmacyBestPriceBadge({ accent = '#0f8a5f', size = 'md', variant = 'pill' }: Props) {
  const dark = useIsDark();
  const s = SIZES[size];
  const bg = variant === 'ribbon' ? accent : `${accent}${dark ? '28' : '18'}`;
  const fg = variant === 'ribbon' ? '#ffffff' : accent;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: s.gap,
        paddingHorizontal: s.padX,
        paddingVertical: s.padY,
        borderRadius: s.radius,
        backgroundColor: bg,
        borderWidth: variant === 'pill' ? 1 : 0,
        borderColor: `${accent}${dark ? '55' : '35'}`,
      }}
    >
      {variant === 'ribbon' ? (
        <Sparkles size={s.icon} color={fg} strokeWidth={2.4} />
      ) : (
        <Crown size={s.icon} color={fg} strokeWidth={2.5} />
      )}
      <Text style={{ fontSize: s.font, fontWeight: '800', color: fg, letterSpacing: 0.3 }}>
        {ka.pharmacy.bestShort}
      </Text>
    </View>
  );
}
