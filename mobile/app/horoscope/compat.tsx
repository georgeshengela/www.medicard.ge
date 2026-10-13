import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { ModuleHeader } from '@/components/brand/ModuleHeader';
import { AstroGlyph } from '@/components/horoscope/AstroGlyph';
import { Dots, GLASS_LINE, HORO_INK, HoroCard, HoroNote, HoroPage, HText } from '@/components/horoscope/HoroUI';
import { useAccountQuery } from '@/hooks/useAccountQuery';
import { tx } from '@/i18n/locale';
import { horoscopeApi, type Compat, type Hub } from '@/lib/horoscope/horoscopeApi';
import { SIGN_KEYS, signName, type SignKey } from '@/lib/horoscope/names';
import { FRESH } from '@/lib/queryClient';

/** Two signs side by side: a score ring, then love, friendship and work. Starts from the person's own sign. */
export default function CompatScreen() {
  const hub = useAccountQuery<Hub>({ key: ['horoscope', 'hub', 'me'], fetch: () => horoscopeApi.hub(), staleTime: FRESH.LONG });
  const mine = hub.data?.sign?.key ?? 'aries';
  const [a, setA] = useState<SignKey | null>(null);
  const [b, setB] = useState<SignKey>('libra');
  const [picking, setPicking] = useState<'a' | 'b'>('b');
  const left = a ?? mine;
  const q = useAccountQuery<Compat>({ key: ['horoscope', 'compat', left, b], fetch: () => horoscopeApi.compat(left, b), staleTime: FRESH.LONG });
  const d = q.data;
  const pick = (s: SignKey) => (picking === 'a' ? setA(s) : setB(s));
  return (
    <HoroPage header={<ModuleHeader module="horo" subtitle={tx('თავსებადობა', 'Compatibility')} fallbackHref="/horoscope" />}>
      <HoroCard style={{ gap: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Medal sign={left} active={picking === 'a'} onPress={() => setPicking('a')} />
          <Ring score={d?.score ?? null} />
          <Medal sign={b} active={picking === 'b'} onPress={() => setPicking('b')} />
        </View>
        <HText size={12} muted center>{picking === 'a' ? tx('აირჩიე პირველი ნიშანი', 'Pick the first sign') : tx('აირჩიე მეორე ნიშანი', 'Pick the second sign')}</HText>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {SIGN_KEYS.map((s) => {
            const on = (picking === 'a' ? left : b) === s;
            return (
              <Pressable key={s} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={signName(s)} onPress={() => pick(s)}
                style={{ alignItems: 'center', gap: 4, width: 56, paddingVertical: 9, borderRadius: 14, backgroundColor: on ? 'rgba(233,199,126,0.16)' : 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: on ? 'rgba(233,199,126,0.6)' : GLASS_LINE }}>
                <AstroGlyph name={s} size={19} color={on ? HORO_INK : '#C9CDE4'} />
                <HText size={9.5} lines={1} muted={!on} color={on ? HORO_INK : undefined}>{signName(s)}</HText>
              </Pressable>
            );
          })}
        </ScrollView>
      </HoroCard>

      {!d ? <ActivityIndicator color={HORO_INK} /> : (
        <Animated.View key={`${left}-${b}`} entering={FadeIn.duration(400)} style={{ gap: 12 }}>
          {d.headline ? <HText size={21} weight="serif" color="#FBF3E0" center>{d.headline}</HText> : null}
          {d.text ? <HoroCard><HText size={15} lineHeight={25}>{d.text}</HText></HoroCard> : <HoroCard><HText muted center>{tx('ამ წყვილის აღწერა ჯერ იწერება — ცოტა ხანში დაბრუნდი.', 'This pair is still being written — check back soon.')}</HText></HoroCard>}
          {d.loveText ? (
            <HoroCard style={{ paddingVertical: 4 }}>
              {([['love', tx('სიყვარული', 'Love'), d.loveText], ['friendship', tx('მეგობრობა', 'Friendship'), d.friendText], ['work', tx('საქმე', 'Work'), d.workText]] as const).map(([k, label, text], i) => (
                <View key={k} style={{ paddingVertical: 14, gap: 6, borderTopWidth: i ? 1 : 0, borderTopColor: GLASS_LINE }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <HText size={14} weight="semibold">{label}</HText>
                    {typeof d[k] === 'number' ? <Dots value={d[k] as number} /> : null}
                  </View>
                  {text ? <HText size={14} muted lineHeight={22}>{text}</HText> : null}
                </View>
              ))}
            </HoroCard>
          ) : null}
        </Animated.View>
      )}
      <HoroNote text={tx('თავსებადობა მზის ნიშნებით ითვლება — ეს თამაშია, ურთიერთობას ადამიანები ქმნიან.', 'Compatibility uses sun signs — it’s a game; people make the relationship.')} />
    </HoroPage>
  );
}

function Medal({ sign, active, onPress }: { sign: SignKey; active: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={signName(sign)} onPress={onPress} style={{ alignItems: 'center', gap: 8, width: 92 }}>
      <View style={{ width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(233,199,126,0.1)', borderWidth: active ? 1.5 : 1, borderColor: active ? HORO_INK : 'rgba(233,199,126,0.25)' }}>
        <AstroGlyph name={sign} size={36} color={HORO_INK} />
      </View>
      <HText size={14} weight="semibold">{signName(sign)}</HText>
    </Pressable>
  );
}

function Ring({ score }: { score: number | null }) {
  const r = 46;
  const len = 2 * Math.PI * r;
  return (
    <View style={{ width: 112, height: 112, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={112} height={112} style={{ position: 'absolute' }}>
        <Circle cx={56} cy={56} r={r} stroke="rgba(255,255,255,0.1)" strokeWidth={6} fill="none" />
        {score != null ? <Circle cx={56} cy={56} r={r} stroke={HORO_INK} strokeWidth={6} fill="none" strokeLinecap="round" strokeDasharray={`${(score / 100) * len} ${len}`} transform="rotate(-90 56 56)" /> : null}
      </Svg>
      <HText size={30} weight="serif" color="#FBF3E0">{score != null ? String(score) : '…'}</HText>
    </View>
  );
}


