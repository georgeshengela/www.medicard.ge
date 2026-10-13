import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { ModuleHeader } from '@/components/brand/ModuleHeader';
import { AstroGlyph } from '@/components/horoscope/AstroGlyph';
import { GLASS_LINE, HORO_INK, HoroCard, HoroNote, HoroPage, HoroSection, HText } from '@/components/horoscope/HoroUI';
import { ReadingView } from '@/components/horoscope/ReadingView';
import { useAccountQuery } from '@/hooks/useAccountQuery';
import { tx } from '@/i18n/locale';
import { horoscopeApi, type SignPage } from '@/lib/horoscope/horoscopeApi';
import { SIGN_KEYS, elementName, modalityName, planetName, signDates, signName, type SignKey } from '@/lib/horoscope/names';
import { FRESH } from '@/lib/queryClient';

/** One sign: who it is (profile from the library) and today's reading for it. */
export default function SignScreen() {
  const { sign: raw } = useLocalSearchParams<{ sign: string }>();
  const sign = (SIGN_KEYS as readonly string[]).includes(String(raw)) ? (String(raw) as SignKey) : 'aries';
  const q = useAccountQuery<SignPage>({ key: ['horoscope', 'sign', sign], fetch: () => horoscopeApi.sign(sign), staleTime: FRESH.LONG });
  const p = q.data?.profile;
  const today = q.data?.readings.today;
  return (
    <HoroPage header={<ModuleHeader module="horo" subtitle={signName(sign)} fallbackHref="/horoscope" />}>
      <View style={{ alignItems: 'center', gap: 8, paddingTop: 6 }}>
        <View style={{ width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(233,199,126,0.45)', backgroundColor: 'rgba(233,199,126,0.08)' }}>
          <AstroGlyph name={sign} size={50} color={HORO_INK} />
        </View>
        <HText size={28} weight="serif" color="#FBF3E0">{signName(sign)}</HText>
        <HText size={13} muted>{signDates(sign)}</HText>
        {p?.title ? <HText size={15} color={HORO_INK} center>{p.title}</HText> : null}
      </View>
      {!q.data ? <ActivityIndicator color={HORO_INK} /> : (
        <>
          <HoroCard style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            {[[tx('სტიქია', 'Element'), elementName(p!.element)], [tx('რიტმი', 'Mode'), modalityName(p!.modality)], [tx('მმართველი', 'Ruler'), planetName(p!.ruler)]].map(([k, v]) => (
              <View key={k} style={{ alignItems: 'center', flex: 1 }}>
                <HText size={11} muted>{k}</HText>
                <HText size={14} weight="semibold">{v}</HText>
              </View>
            ))}
          </HoroCard>
          {p?.text ? <HoroCard><HText size={15} lineHeight={25}>{p.text}</HText></HoroCard> : null}
          {p?.strengths?.length || p?.challenges?.length ? (
            <HoroCard style={{ gap: 12 }}>
              {p?.strengths?.length ? <View style={{ gap: 6 }}><HText size={13} weight="semibold" color={HORO_INK}>{tx('ძლიერი მხარეები', 'Strengths')}</HText><HText size={14} muted>{p.strengths.join(' · ')}</HText></View> : null}
              {p?.challenges?.length ? <View style={{ gap: 6, borderTopWidth: 1, borderTopColor: GLASS_LINE, paddingTop: 12 }}><HText size={13} weight="semibold" color={HORO_INK}>{tx('სასწავლი მხარეები', 'Growth edges')}</HText><HText size={14} muted>{p.challenges.join(' · ')}</HText></View> : null}
            </HoroCard>
          ) : null}
          {today ? (
            <HoroSection title={tx('დღეს', 'Today')}>
              <HText size={20} weight="serif" color="#FBF3E0">{today.headline}</HText>
              <ReadingView reading={today} />
            </HoroSection>
          ) : null}
        </>
      )}
      <HoroNote text={tx('ნიშნის აღწერა ზოგადია — ყველა ადამიანი უფრო მრავალფეროვანია, ვიდრე ერთი ნიშანი.', 'A sign description is general — every person is richer than one sign.')} />
    </HoroPage>
  );
}
