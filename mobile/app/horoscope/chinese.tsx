import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router } from 'expo-router';
import { ModuleHeader } from '@/components/brand/ModuleHeader';
import { GLASS_LINE, HORO_INK, HoroButton, HoroCard, HoroNote, HoroPage, HoroSection, HText } from '@/components/horoscope/HoroUI';
import { useAccountQuery } from '@/hooks/useAccountQuery';
import { tx } from '@/i18n/locale';
import { horoscopeApi, type Chinese } from '@/lib/horoscope/horoscopeApi';
import { chineseFull, chineseName, dayMonth } from '@/lib/horoscope/names';
import { FRESH } from '@/lib/queryClient';

/** The person's Chinese sign (by the real Chinese New Year of their birth year), its profile and the year ahead. */
export default function ChineseScreen() {
  const q = useAccountQuery<Chinese>({ key: ['horoscope', 'chinese'], fetch: () => horoscopeApi.chinese(), staleTime: FRESH.LONG });
  const d = q.data;
  const header = <ModuleHeader module="horo" subtitle={tx('ჩინური ჰოროსკოპი', 'Chinese horoscope')} fallbackHref="/horoscope" />;
  if (!d) return <HoroPage header={header}><View style={{ paddingTop: 80, alignItems: 'center' }}><ActivityIndicator color={HORO_INK} /></View></HoroPage>;
  if (d.needBirthDate) {
    return (
      <HoroPage header={header}>
        <HoroCard style={{ gap: 12 }}>
          <HText muted>{tx('ჩინური ნიშანი დაბადების თარიღიდან ითვლება — დაამატე პროფილში.', 'Your Chinese sign comes from your birth date — add it in your profile.')}</HText>
          <HoroButton label={tx('პროფილში დამატება', 'Add in profile')} onPress={() => router.push('/(tabs)/profile')} />
        </HoroCard>
      </HoroPage>
    );
  }
  const p = d.profile;
  const y = d.yearForecast;
  return (
    <HoroPage header={header}>
      <View style={{ alignItems: 'center', gap: 6, paddingTop: 8 }}>
        <HText size={13} muted>{tx(`${d.year} წელი · ${d.yin ? 'ინი' : 'იანი'}`, `${d.year} · ${d.yin ? 'Yin' : 'Yang'}`)}</HText>
        <HText size={34} weight="serif" color={HORO_INK} center>{chineseFull(d.element, d.animal)}</HText>
        {p?.title ? <HText size={16} color="#FBF3E0" center>{p.title}</HText> : null}
        <HText size={12} muted center>{tx(`ჩინური ახალი წელი: ${dayMonth(d.newYear)} ${d.newYear.slice(0, 4)}`, `Chinese New Year: ${dayMonth(d.newYear)} ${d.newYear.slice(0, 4)}`)}</HText>
      </View>
      {p?.text ? <HoroCard><HText size={15} lineHeight={25}>{p.text}</HText></HoroCard> : null}
      {p?.love || p?.work ? (
        <HoroCard style={{ paddingVertical: 4 }}>
          {p.love ? <View style={{ paddingVertical: 12, gap: 4 }}><HText size={14} weight="semibold">{tx('სიყვარულში', 'In love')}</HText><HText size={14} muted>{p.love}</HText></View> : null}
          {p.work ? <View style={{ paddingVertical: 12, gap: 4, borderTopWidth: 1, borderTopColor: GLASS_LINE }}><HText size={14} weight="semibold">{tx('საქმეში', 'At work')}</HText><HText size={14} muted>{p.work}</HText></View> : null}
        </HoroCard>
      ) : null}
      <HoroSection title={tx(`${d.forecastYear} შენთვის`, `${d.forecastYear} for you`)}>
        <HoroCard style={{ gap: 10 }}>
          {y?.headline ? <HText size={19} weight="serif" color="#FBF3E0">{y.headline}</HText> : null}
          <HText size={15} lineHeight={25}>{y?.text || tx('წლის პროგნოზი ჯერ იწერება.', 'The year ahead is still being written.')}</HText>
          {y?.love ? <HText size={14} muted>{y.love}</HText> : null}
          {y?.work ? <HText size={14} muted>{y.work}</HText> : null}
        </HoroCard>
      </HoroSection>
      {d.bestMatches.length ? (
        <HoroSection title={tx('საუკეთესო წყვილები', 'Best matches')}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {d.bestMatches.map((a) => (
              <View key={a} style={{ borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: 'rgba(233,199,126,0.12)' }}>
                <HText size={14} color={HORO_INK}>{chineseName(a)}</HText>
              </View>
            ))}
          </View>
        </HoroSection>
      ) : null}
      <HoroNote text={tx('ჩინური ნიშანი ითვლება დაბადების წლის ჩინური ახალი წლიდან, მთვარის კალენდრით.', 'The Chinese sign counts from the Chinese New Year of your birth year, by the lunar calendar.')} />
    </HoroPage>
  );
}
