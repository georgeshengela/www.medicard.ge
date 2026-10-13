import React from 'react';
import { View } from 'react-native';
import { tx } from '@/i18n/locale';
import type { Reading } from '@/lib/horoscope/horoscopeApi';
import { dayMonth, luckyColor, monthName, weekdayName } from '@/lib/horoscope/names';
import { Dots, GLASS, GLASS_LINE, HORO_INK, HoroCard, HText } from './HoroUI';

const AREAS: { key: 'love' | 'money' | 'mood'; label: () => string }[] = [
  { key: 'love', label: () => tx('სიყვარული', 'Love') },
  { key: 'money', label: () => tx('საქმე და ფული', 'Work & money') },
  { key: 'mood', label: () => tx('განწყობა', 'Mood') },
];

/** One reading: the general text, the three areas with their dots, then lucky signs / key dates and the tip. */
export function ReadingView({ reading }: { reading: Reading }) {
  return (
    <View style={{ gap: 12 }}>
      <HoroCard>
        <HText size={15.5} lineHeight={26}>{reading.general}</HText>
      </HoroCard>
      <HoroCard style={{ paddingVertical: 4 }}>
        {AREAS.map((a, i) => (
          <View key={a.key} style={{ paddingVertical: 14, borderTopWidth: i ? 1 : 0, borderTopColor: GLASS_LINE, gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <HText size={14} weight="semibold">{a.label()}</HText>
              {reading.scores ? <Dots value={reading.scores[a.key]} /> : null}
            </View>
            <HText size={14} muted lineHeight={22}>{reading[a.key]}</HText>
          </View>
        ))}
      </HoroCard>
      {reading.lucky ? <Lucky lucky={reading.lucky} /> : null}
      {reading.bestDay ? (
        <HoroCard style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <HText size={13} muted>{tx('კვირის საუკეთესო დღე', 'Best day of the week')}</HText>
          <HText size={15} weight="semibold" color={HORO_INK}>{weekdayName(reading.bestDay)}</HText>
        </HoroCard>
      ) : null}
      {reading.keyDates?.length ? (
        <HoroCard style={{ gap: 10 }}>
          <HText size={13} weight="semibold" color={HORO_INK}>{tx('მთავარი დღეები', 'Key dates')}</HText>
          {reading.keyDates.map((d) => (
            <View key={d.date} style={{ flexDirection: 'row', gap: 12 }}>
              <HText size={13} weight="semibold" style={{ width: 96 }}>{dayMonth(d.date)}</HText>
              <HText size={13} muted style={{ flex: 1 }}>{d.text}</HText>
            </View>
          ))}
        </HoroCard>
      ) : null}
      {reading.highlights?.length ? (
        <HoroCard style={{ gap: 10 }}>
          <HText size={13} weight="semibold" color={HORO_INK}>{tx('წლის მთავარი თვეები', 'Key months of the year')}</HText>
          {reading.highlights.map((d) => (
            <View key={d.month} style={{ flexDirection: 'row', gap: 12 }}>
              <HText size={13} weight="semibold" style={{ width: 96 }}>{monthName(Number(d.month.slice(5)))}</HText>
              <HText size={13} muted style={{ flex: 1 }}>{d.text}</HText>
            </View>
          ))}
        </HoroCard>
      ) : null}
      <HoroCard style={{ borderColor: 'rgba(233,199,126,0.35)' }}>
        <HText size={12} weight="semibold" color={HORO_INK}>{reading.kind === 'day' ? tx('დღის რჩევა', 'Tip of the day') : tx('რჩევა', 'Tip')}</HText>
        <HText size={15} weight="serif" lineHeight={23} style={{ marginTop: 4 }}>{reading.tip}</HText>
      </HoroCard>
    </View>
  );
}

function Lucky({ lucky }: { lucky: NonNullable<Reading['lucky']> }) {
  const color = luckyColor(lucky.color);
  const cell = { flex: 1, backgroundColor: GLASS, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: GLASS_LINE } as const;
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <View style={cell}>
        <HText size={11} muted>{tx('რიცხვი', 'Number')}</HText>
        <HText size={20} weight="serif" color={HORO_INK}>{String(lucky.number)}</HText>
      </View>
      <View style={cell}>
        <HText size={11} muted>{tx('ფერი', 'Colour')}</HText>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
          <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: color.hex, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' }} />
          <HText size={13} weight="semibold" lines={2} lineHeight={17} style={{ flexShrink: 1 }}>{color.name}</HText>
        </View>
      </View>
      <View style={cell}>
        <HText size={11} muted>{tx('დრო', 'Time')}</HText>
        <HText size={20} weight="serif" color={HORO_INK}>{lucky.time}</HText>
      </View>
    </View>
  );
}
