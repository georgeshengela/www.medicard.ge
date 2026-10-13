import React, { useState } from 'react';
import { ActivityIndicator, Pressable, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { PencilLine } from 'lucide-react-native';
import { ModuleHeader, ModuleHeaderButton } from '@/components/brand/ModuleHeader';
import { AstroGlyph } from '@/components/horoscope/AstroGlyph';
import { GLASS, GLASS_LINE, HORO_INK, HoroButton, HoroCard, HoroNote, HoroPage, HoroSection, HoroSegment, HText } from '@/components/horoscope/HoroUI';
import { SkyWheel } from '@/components/horoscope/SkyWheel';
import { useAccountQuery } from '@/hooks/useAccountQuery';
import { tx } from '@/i18n/locale';
import { horoscopeApi, type ChartResponse } from '@/lib/horoscope/horoscopeApi';
import { ROMAN, aspectHarmonious, aspectName, dayMonth, elementName, modalityName, planetName, signIn, signName } from '@/lib/horoscope/names';
import { FRESH } from '@/lib/queryClient';

type Tab = 'planets' | 'houses' | 'aspects';

/** „ჩემი ასტრორუკა“: the natal wheel (houses and aspects with a known birth time), the big three and every placement explained. */
export default function ChartScreen() {
  const q = useAccountQuery<ChartResponse>({ key: ['horoscope', 'chart'], fetch: () => horoscopeApi.chart(), staleTime: FRESH.SHORT });
  const [tab, setTab] = useState<Tab>('planets');
  const [open, setOpen] = useState<string | null>(null);
  const { width } = useWindowDimensions();
  const size = Math.min(width - 40, 380);
  const header = (
    <ModuleHeader module="horo" subtitle={tx('ჩემი ასტრორუკა', 'My birth chart')} fallbackHref="/horoscope"
      right={<ModuleHeaderButton label={tx('დაბადების დრო და ადგილი', 'Birth time and place')} icon={PencilLine} onPress={() => router.push('/horoscope/birth')} />} />
  );
  const d = q.data;
  if (!d) return <HoroPage header={header}><View style={{ paddingTop: 100, alignItems: 'center' }}><ActivityIndicator color={HORO_INK} /></View></HoroPage>;
  if (d.needBirthDate || !d.chart) {
    return (
      <HoroPage header={header}>
        <HoroCard style={{ gap: 12 }}>
          <HText size={15} weight="semibold">{tx('დაბადების თარიღი გვჭირდება', 'We need your birth date')}</HText>
          <HText muted>{tx('რუკა დაბადების თარიღიდან ითვლება — დაამატე პროფილში.', 'The chart is cast from your birth date — add it in your profile.')}</HText>
          <HoroButton label={tx('პროფილში დამატება', 'Add in profile')} onPress={() => router.push('/(tabs)/profile')} />
        </HoroCard>
      </HoroPage>
    );
  }
  const ch = d.chart;
  const sun = ch.bodies[0];
  const moon = ch.bodies[1];
  const big = [
    { key: 'sun', label: tx('მზე', 'Sun'), sign: sun.sign, deg: `${sun.degree}°${String(sun.minute).padStart(2, '0')}′` },
    { key: 'moon', label: tx('მთვარე', 'Moon'), sign: moon.sign, deg: ch.moonUncertain ? tx('დაზუსტდება დროით', 'needs the time') : `${moon.degree}°${String(moon.minute).padStart(2, '0')}′` },
    ...(ch.angles ? [{ key: 'asc', label: tx('ასცენდენტი', 'Ascendant'), sign: ch.angles.asc.sign, deg: `${ch.angles.asc.degree}°${String(ch.angles.asc.minute).padStart(2, '0')}′` }] : []),
  ];
  const birthLine = [dayMonth(ch.birth.date) + ` ${ch.birth.date.slice(0, 4)}`, ch.birth.time, ch.birth.placeName].filter(Boolean).join(' · ');
  return (
    <HoroPage header={header}>
      <View style={{ alignItems: 'center', gap: 8 }}>
        <SkyWheel size={size} mode={ch.angles ? 'chart' : 'sky'} highlight={ch.angles ? null : sun.sign} bodies={ch.bodies} chart={ch.angles ? ch : null} degrees={Boolean(ch.angles)} />
        <HText size={12} color="rgba(243,221,166,0.85)" center>{`${birthLine}${ch.system ? ` · ${ch.system === 'placidus' ? tx('პლაციდუსი', 'Placidus') : tx('მთელი ნიშნები', 'Whole sign')}` : ''}`}</HText>
      </View>

      {!ch.birth.timeKnown ? (
        <HoroCard style={{ gap: 10, borderColor: 'rgba(233,199,126,0.35)' }}>
          <HText size={14} muted>{tx('დაბადების დროის გარეშე ასცენდენტი და სახლები არ ჩანს, მთვარის ნიშანიც შეიძლება დასაზუსტებელი იყოს.', 'Without a birth time there is no ascendant or houses, and the Moon’s sign may be uncertain.')}</HText>
          <HoroButton quiet label={tx('დაბადების დრო და ადგილი', 'Birth time and place')} onPress={() => router.push('/horoscope/birth')} />
        </HoroCard>
      ) : null}

      <View style={{ flexDirection: 'row', gap: 8 }}>
        {big.map((b) => (
          <View key={b.key} style={{ flex: 1, backgroundColor: GLASS, borderRadius: 18, padding: 12, gap: 4, borderWidth: 1, borderColor: GLASS_LINE }}>
            <HText size={11} muted>{b.label}</HText>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <AstroGlyph name={b.sign} size={17} color={HORO_INK} />
              <HText size={13} weight="semibold" lines={2} lineHeight={17} style={{ flexShrink: 1 }}>{signName(b.sign)}</HText>
            </View>
            <HText size={11.5} muted>{b.deg}</HText>
          </View>
        ))}
      </View>

      <View style={{ gap: 12 }}>
        <HoroSegment<Tab> value={tab} onChange={setTab} options={[
          { key: 'planets', label: tx('პლანეტები', 'Planets') },
          ...(ch.houses ? [{ key: 'houses' as Tab, label: tx('სახლები', 'Houses') }] : []),
          { key: 'aspects', label: tx('ასპექტები', 'Aspects') },
        ]} />
        <HoroCard style={{ paddingVertical: 4 }}>
          {tab === 'planets' ? ch.bodies.map((b, i) => (
            <Expandable key={b.key} first={i === 0} open={open === b.key} onToggle={() => setOpen(open === b.key ? null : b.key)}
              glyph={b.key} title={`${planetName(b.key)} ${signIn(b.sign)}`}
              line={[b.house ? tx(`${ROMAN[b.house - 1]} სახლი`, `House ${ROMAN[b.house - 1]}`) : null, b.retro ? tx('რეტროგრადული', 'retrograde') : null].filter(Boolean).join(' · ')}
              right={`${b.degree}°${String(b.minute).padStart(2, '0')}′`}
              body={[b.planetText, b.signText, b.houseText, b.retroText]} />
          )) : null}
          {tab === 'houses' && ch.houses ? ch.houses.map((h, i) => (
            <Expandable key={h.n} first={i === 0} open={open === `h${h.n}`} onToggle={() => setOpen(open === `h${h.n}` ? null : `h${h.n}`)}
              glyph={h.sign} title={`${ROMAN[h.n - 1]} · ${h.title || tx(`სახლი ${h.n}`, `House ${h.n}`)}`} line={`${signName(h.sign)} ${h.degree}°`} body={[h.text]} />
          )) : null}
          {tab === 'aspects' ? (ch.aspects.length ? ch.aspects.map((a, i) => (
            <Expandable key={`${a.a}-${a.b}`} first={i === 0} open={open === `${a.a}-${a.b}`} onToggle={() => setOpen(open === `${a.a}-${a.b}` ? null : `${a.a}-${a.b}`)}
              glyph={a.aspect === 'conjunction' ? 'conjunction' : a.aspect === 'opposition' ? 'opposition' : a.aspect === 'sextile' ? 'sextile' : a.a}
              title={`${planetName(a.a)} · ${aspectName(a.aspect)} · ${planetName(a.b)}`}
              line={`${aspectHarmonious(a.aspect) ? tx('ჰარმონიული', 'harmonious') : a.aspect === 'conjunction' ? tx('შერწყმა', 'blending') : tx('დაძაბული', 'tense')} · ${a.orb.toFixed(1)}°`}
              body={[a.text]} />
          )) : <View style={{ paddingVertical: 14 }}><HText muted>{tx('ძლიერი ასპექტები არ არის.', 'No strong aspects.')}</HText></View>) : null}
        </HoroCard>
      </View>

      <HoroSection title={tx('სტიქიები და რიტმი', 'Elements and modes')}>
        <HoroCard style={{ gap: 12 }}>
          {['fire', 'earth', 'air', 'water'].map((e) => (
            <View key={e} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <HText size={13} style={{ width: 70 }}>{elementName(e)}</HText>
              <View style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                <View style={{ width: `${ch.elements[e] || 0}%`, height: 8, borderRadius: 4, backgroundColor: HORO_INK }} />
              </View>
              <HText size={12} muted style={{ width: 38, textAlign: 'right' }}>{`${ch.elements[e] || 0}%`}</HText>
            </View>
          ))}
          {(() => {
            const top = Object.entries(ch.elements).sort((x, y) => y[1] - x[1])[0]?.[0];
            return top && ch.elementTexts[top] ? <HText size={13} muted>{ch.elementTexts[top]}</HText> : null;
          })()}
          <HText size={12} muted>{Object.entries(ch.modalities).sort((x, y) => y[1] - x[1]).map(([k, v]) => `${modalityName(k)} ${v}%`).join(' · ')}</HText>
        </HoroCard>
      </HoroSection>
      <HoroNote text={tx('რუკა ასტრონომიულად ზუსტადაა გამოთვლილი; განმარტებები გასართობი და თვითშემეცნებისთვისაა.', 'The chart is astronomically exact; the meanings are for fun and reflection.')} />
    </HoroPage>
  );
}

function Expandable({ glyph, title, line, right, body, open, onToggle, first }: {
  glyph: string; title: string; line?: string; right?: string; body: (string | null | undefined)[]; open: boolean; onToggle: () => void; first?: boolean;
}) {
  const texts = body.filter(Boolean) as string[];
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={title} onPress={onToggle}
      style={{ paddingVertical: 12, borderTopWidth: first ? 0 : 1, borderTopColor: GLASS_LINE, gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(233,199,126,0.12)', alignItems: 'center', justifyContent: 'center' }}>
          <AstroGlyph name={glyph} size={20} color={HORO_INK} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <HText size={14} weight="semibold">{title}</HText>
          {line ? <HText size={12} muted>{line}</HText> : null}
        </View>
        {right ? <HText size={12.5} muted>{right}</HText> : null}
      </View>
      {open ? (texts.length ? texts.map((t, i) => <HText key={i} size={14} muted lineHeight={22}>{t}</HText>)
        : <HText size={13} muted>{tx('განმარტება მალე დაემატება.', 'The meaning will be added soon.')}</HText>) : null}
    </Pressable>
  );
}
