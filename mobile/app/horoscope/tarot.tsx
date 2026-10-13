import React, { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeIn } from 'react-native-reanimated';
import { ModuleHeader } from '@/components/brand/ModuleHeader';
import { HORO_INK, HoroButton, HoroCard, HoroNote, HoroPage, HoroSection, HText } from '@/components/horoscope/HoroUI';
import { TarotCard } from '@/components/horoscope/TarotCard';
import { useAccountQuery } from '@/hooks/useAccountQuery';
import { tx } from '@/i18n/locale';
import { horoscopeApi, type Tarot } from '@/lib/horoscope/horoscopeApi';
import { FRESH } from '@/lib/queryClient';

const POSITIONS = () => [tx('წარსული', 'Past'), tx('აწმყო', 'Present'), tx('მომავალი', 'Future')];

/** The card of the day (same all day, different per person) and a three-card spread; both turn over on arrival. */
export default function TarotScreen() {
  const q = useAccountQuery<Tarot>({ key: ['horoscope', 'tarot'], fetch: () => horoscopeApi.tarot(), staleTime: FRESH.LONG });
  const [revealed, setRevealed] = useState(false);
  const [spread, setSpread] = useState(false);
  const d = q.data;
  return (
    <HoroPage header={<ModuleHeader module="horo" subtitle={tx('ტარო', 'Tarot')} fallbackHref="/horoscope" />}>
      {!d ? <View style={{ paddingTop: 80, alignItems: 'center' }}><ActivityIndicator color={HORO_INK} /></View> : (
        <>
          <View style={{ alignItems: 'center', gap: 16 }}>
            <HText size={13} muted center>{tx('დღის კარტი — ერთი მთელი დღისთვის', 'Card of the day — one for the whole day')}</HText>
            <TarotCard card={d.card} width={170} delay={500} onReveal={() => setRevealed(true)} />
          </View>
          {revealed ? (
            <Animated.View entering={FadeIn.duration(500)} style={{ gap: 12 }}>
              <HText size={24} weight="serif" color="#FBF3E0" center>{d.card.name}</HText>
              {d.card.keywords?.length ? <HText size={13} color={HORO_INK} center>{d.card.keywords.join(' · ')}</HText> : null}
              <HoroCard><HText size={15} lineHeight={25}>{d.card.text || tx('კარტის განმარტება მალე დაემატება.', 'The meaning will be added soon.')}</HText></HoroCard>
              {d.card.advice ? (
                <HoroCard style={{ borderColor: 'rgba(233,199,126,0.35)' }}>
                  <HText size={12} weight="semibold" color={HORO_INK}>{tx('რჩევა', 'Advice')}</HText>
                  <HText size={15} weight="serif" style={{ marginTop: 4 }}>{d.card.advice}</HText>
                </HoroCard>
              ) : null}
            </Animated.View>
          ) : null}

          <HoroSection title={tx('სამი კარტი', 'Three cards')}>
            {!spread ? (
              <HoroCard style={{ gap: 12 }}>
                <HText muted>{tx('ჩაიფიქრე კითხვა და გაშალე სამი კარტი: წარსული, აწმყო და მომავალი.', 'Hold a question in mind and lay out three cards: past, present and future.')}</HText>
                <HoroButton label={tx('კარტების გაშლა', 'Lay out the cards')} onPress={() => setSpread(true)} />
              </HoroCard>
            ) : (
              <View style={{ gap: 14 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  {d.spread.map((c, i) => (
                    <View key={c.id} style={{ alignItems: 'center', gap: 8 }}>
                      <HText size={12} muted>{POSITIONS()[i]}</HText>
                      <TarotCard card={c} width={100} delay={250 + i * 500} />
                    </View>
                  ))}
                </View>
                {d.spread.map((c, i) => (
                  <Animated.View key={c.id} entering={FadeIn.delay(1800 + i * 300).duration(400)}>
                    <HoroCard style={{ gap: 4 }}>
                      <HText size={12} color={HORO_INK} weight="semibold">{`${POSITIONS()[i]} · ${c.roman} ${c.name}`}</HText>
                      <HText size={14} muted lineHeight={22}>{c.text || ''}</HText>
                    </HoroCard>
                  </Animated.View>
                ))}
                <HoroButton quiet label={tx('ორაკულს ვკითხავ ამ კარტებზე', 'Ask the Oracle about these cards')}
                  onPress={() => router.push({ pathname: '/horoscope/oracle', params: { ask: tx(`ამიხსენი ჩემი განლაგება: ${d.spread.map((c) => c.name).join(', ')}`, `Explain my spread: ${d.spread.map((c) => c.name).join(', ')}`), go: '1' } })} />
              </View>
            )}
          </HoroSection>
        </>
      )}
      <HoroNote text={tx('ტარო თვითშემეცნებისა და გართობისთვისაა — გადაწყვეტილებას შენ იღებ.', 'Tarot is for reflection and fun — the decisions are yours.')} />
    </HoroPage>
  );
}
