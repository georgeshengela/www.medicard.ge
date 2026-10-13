import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router } from 'expo-router';
import { ModuleHeader } from '@/components/brand/ModuleHeader';
import { GLASS, GLASS_LINE, HORO_INK, HoroButton, HoroCard, HoroNote, HoroPage, HoroSection, HText } from '@/components/horoscope/HoroUI';
import { useAccountQuery } from '@/hooks/useAccountQuery';
import { tx } from '@/i18n/locale';
import { horoscopeApi, type Numerology } from '@/lib/horoscope/horoscopeApi';
import { FRESH } from '@/lib/queryClient';

/** Life path, personal year and personal day numbers (Pythagorean, master numbers kept) from the birth date. */
export default function NumerologyScreen() {
  const q = useAccountQuery<Numerology>({ key: ['horoscope', 'numerology'], fetch: () => horoscopeApi.numerology(), staleTime: FRESH.LONG });
  const d = q.data;
  const header = <ModuleHeader module="horo" subtitle={tx('ნუმეროლოგია', 'Numerology')} fallbackHref="/horoscope" />;
  if (!d) return <HoroPage header={header}><View style={{ paddingTop: 80, alignItems: 'center' }}><ActivityIndicator color={HORO_INK} /></View></HoroPage>;
  if (d.needBirthDate) {
    return (
      <HoroPage header={header}>
        <HoroCard style={{ gap: 12 }}>
          <HText muted>{tx('რიცხვები დაბადების თარიღიდან ითვლება — დაამატე პროფილში.', 'The numbers come from your birth date — add it in your profile.')}</HText>
          <HoroButton label={tx('პროფილში დამატება', 'Add in profile')} onPress={() => router.push('/(tabs)/profile')} />
        </HoroCard>
      </HoroPage>
    );
  }
  const lp = d.lifePathText;
  return (
    <HoroPage header={header}>
      <View style={{ alignItems: 'center', gap: 4, paddingTop: 8 }}>
        <HText size={13} muted>{tx('ცხოვრების გზის რიცხვი', 'Life path number')}</HText>
        <HText size={96} weight="serif" color={HORO_INK} lineHeight={112}>{String(d.lifePath)}</HText>
        {lp?.title ? <HText size={22} weight="serif" color="#FBF3E0">{lp.title}</HText> : null}
      </View>
      {lp?.text ? <HoroCard><HText size={15} lineHeight={25}>{lp.text}</HText></HoroCard> : null}
      {lp?.strengths?.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {lp.strengths.map((s) => (
            <View key={s} style={{ borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: 'rgba(233,199,126,0.12)' }}>
              <HText size={13} color={HORO_INK}>{s}</HText>
            </View>
          ))}
        </View>
      ) : null}
      {lp?.love || lp?.work ? (
        <HoroCard style={{ paddingVertical: 4 }}>
          {lp.love ? <View style={{ paddingVertical: 12, gap: 4 }}><HText size={14} weight="semibold">{tx('სიყვარულში', 'In love')}</HText><HText size={14} muted>{lp.love}</HText></View> : null}
          {lp.work ? <View style={{ paddingVertical: 12, gap: 4, borderTopWidth: 1, borderTopColor: GLASS_LINE }}><HText size={14} weight="semibold">{tx('საქმეში', 'At work')}</HText><HText size={14} muted>{lp.work}</HText></View> : null}
        </HoroCard>
      ) : null}
      <HoroSection title={tx('ახლა', 'Right now')}>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {[
            [tx('წლის რიცხვი', 'Year number'), d.personalYear, d.yearText],
            [tx('დღის რიცხვი', 'Day number'), d.personalDay, d.dayText],
          ].map(([label, n, text]) => (
            <View key={String(label)} style={{ flex: 1, backgroundColor: GLASS, borderRadius: 18, padding: 14, gap: 4, borderWidth: 1, borderColor: GLASS_LINE }}>
              <HText size={11} muted>{String(label)}</HText>
              <HText size={36} weight="serif" color={HORO_INK}>{String(n)}</HText>
              {(text as { title?: string } | null)?.title ? <HText size={13} weight="semibold">{(text as { title?: string }).title}</HText> : null}
              {(text as { text?: string } | null)?.text ? <HText size={12.5} muted>{(text as { text?: string }).text}</HText> : null}
            </View>
          ))}
        </View>
      </HoroSection>
      <HoroNote text={tx('ნუმეროლოგია გასართობია: რიცხვები დაბადების თარიღის ციფრებიდან ითვლება.', 'Numerology is for fun: the numbers come from the digits of your birth date.')} />
    </HoroPage>
  );
}
