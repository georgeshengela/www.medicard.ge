import React, { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { ModuleHeader } from '@/components/brand/ModuleHeader';
import { AstroGlyph } from '@/components/horoscope/AstroGlyph';
import { GLASS_LINE, HORO_INK, HoroCard, HoroNote, HoroPage, HoroSection, HText } from '@/components/horoscope/HoroUI';
import { moonPath } from '@/components/horoscope/skyGeometry';
import { useAccountQuery } from '@/hooks/useAccountQuery';
import { tx } from '@/i18n/locale';
import { horoscopeApi, type SkyPage } from '@/lib/horoscope/horoscopeApi';
import { dayMonth, eventText, monthName, phaseName, planetName, signIn, signName } from '@/lib/horoscope/names';
import { FRESH } from '@/lib/queryClient';

const shift = (month: string, by: number) => {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};
const WEEK = () => [tx('ორ', 'Mo'), tx('სა', 'Tu'), tx('ოთ', 'We'), tx('ხუ', 'Th'), tx('პა', 'Fr'), tx('შა', 'Sa'), tx('კვ', 'Su')];

/** The sky calendar: every planet now (retrogrades explained), the Moon for each day of a month, and what's coming. */
export default function SkyScreen() {
  const [month, setMonth] = useState<string | null>(null);
  const q = useAccountQuery<SkyPage>({ key: ['horoscope', 'sky', month ?? 'now'], fetch: () => horoscopeApi.sky(month ?? undefined), staleTime: FRESH.LONG });
  const d = q.data;
  const shown = month ?? d?.calendar.month ?? null;
  return (
    <HoroPage header={<ModuleHeader module="horo" subtitle={tx('ცის კალენდარი', 'Sky calendar')} fallbackHref="/horoscope" />}>
      {!d || !shown ? <View style={{ paddingTop: 80, alignItems: 'center' }}><ActivityIndicator color={HORO_INK} /></View> : (
        <>
          <HoroSection title={tx('პლანეტები ახლა', 'Planets now')}>
            <HoroCard style={{ paddingVertical: 2 }}>
              {d.bodies.map((b, i) => (
                <View key={b.key} style={{ paddingVertical: 11, borderTopWidth: i ? 1 : 0, borderTopColor: GLASS_LINE, gap: 4 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={{ width: 34, alignItems: 'center' }}><AstroGlyph name={b.key} size={20} color={HORO_INK} /></View>
                    <HText size={14} weight="semibold" style={{ flex: 1 }}>{`${planetName(b.key)} ${signIn(b.sign)}`}</HText>
                    <HText size={12.5} muted>{`${b.degree}°${b.retro ? ' ℞' : ''}`}</HText>
                  </View>
                  {b.retro && d.retroTexts[b.key] ? <HText size={13} muted style={{ paddingLeft: 46 }}>{d.retroTexts[b.key]}</HText> : null}
                </View>
              ))}
            </HoroCard>
          </HoroSection>

          <HoroSection title={tx('მთვარის კალენდარი', 'Moon calendar')}>
            <HoroCard style={{ gap: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Pressable accessibilityRole="button" accessibilityLabel={tx('წინა თვე', 'Previous month')} onPress={() => setMonth(shift(shown, -1))} hitSlop={10}><ChevronLeft size={22} color={HORO_INK} /></Pressable>
                <HText size={16} weight="serif" color="#FBF3E0">{`${monthName(Number(shown.slice(5)))} ${shown.slice(0, 4)}`}</HText>
                <Pressable accessibilityRole="button" accessibilityLabel={tx('შემდეგი თვე', 'Next month')} onPress={() => setMonth(shift(shown, 1))} hitSlop={10}><ChevronRight size={22} color={HORO_INK} /></Pressable>
              </View>
              <View style={{ flexDirection: 'row' }}>{WEEK().map((w) => <HText key={w} size={11} muted center style={{ flex: 1 }}>{w}</HText>)}</View>
              <MoonGrid days={d.calendar.days} today={d.today} />
              {d.moon.text ? <HText size={13} muted>{`${phaseName(d.moon.key)}: ${d.moon.text}`}</HText> : null}
            </HoroCard>
          </HoroSection>

          <HoroSection title={tx('რა მოდის', 'Coming up')}>
            <HoroCard style={{ paddingVertical: 2 }}>
              {d.events.map((e, i) => {
                const [title, sub] = eventText(e);
                const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tbilisi', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(e.at));
                return (
                  <View key={`${e.type}-${e.at}`} style={{ flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 11, borderTopWidth: i ? 1 : 0, borderTopColor: GLASS_LINE }}>
                    <HText size={13} weight="semibold" color={HORO_INK} style={{ width: 92 }}>{dayMonth(ymd)}</HText>
                    <View style={{ flex: 1 }}>
                      <HText size={14} weight="semibold">{title}</HText>
                      <HText size={12} muted>{sub}</HText>
                    </View>
                  </View>
                );
              })}
            </HoroCard>
          </HoroSection>
        </>
      )}
      <HoroNote text={tx('პლანეტები და მთვარის ფაზები ასტრონომიულად ითვლება თბილისის დროით.', 'Planets and Moon phases are computed astronomically for Tbilisi time.')} />
    </HoroPage>
  );
}

function MoonGrid({ days, today }: { days: SkyPage['calendar']['days']; today: string }) {
  const first = new Date(`${days[0].date}T12:00:00Z`).getUTCDay();
  const lead = (first + 6) % 7; // Monday first
  const cells: (SkyPage['calendar']['days'][number] | null)[] = [...Array(lead).fill(null), ...days];
  while (cells.length % 7) cells.push(null);
  const rows = Array.from({ length: cells.length / 7 }, (_, r) => cells.slice(r * 7, r * 7 + 7));
  return (
    <View style={{ gap: 6 }}>
      {rows.map((row, r) => (
        <View key={r} style={{ flexDirection: 'row' }}>
          {row.map((day, i) => (
            <View key={i} style={{ flex: 1, alignItems: 'center', gap: 2, paddingVertical: 4, borderRadius: 10, backgroundColor: day?.date === today ? 'rgba(233,199,126,0.16)' : 'transparent' }}
              accessibilityLabel={day ? `${dayMonth(day.date)}: ${phaseName(day.key)}, ${signName(day.sign)}` : undefined}>
              {day ? (
                <>
                  <Svg width={22} height={22} viewBox="0 0 22 22">
                    <Circle cx={11} cy={11} r={10} fill="#1F2A55" />
                    <Path d={moonPath(11, 11, 10, day.angle)} fill="#E8EDF7" />
                  </Svg>
                  <HText size={10.5} muted={day.date !== today} color={day.date === today ? HORO_INK : undefined}>{String(Number(day.date.slice(8)))}</HText>
                </>
              ) : null}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}
