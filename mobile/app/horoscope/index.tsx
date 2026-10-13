import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { CalendarDays } from 'lucide-react-native';
import { ModuleHeader, ModuleHeaderButton } from '@/components/brand/ModuleHeader';
import { AstroGlyph } from '@/components/horoscope/AstroGlyph';
import { Dots, GLASS, GLASS_LINE, HORO_INK, HoroButton, HoroCard, HoroNote, HoroPage, HoroRow, HoroSection, HoroSegment, HText } from '@/components/horoscope/HoroUI';
import { OracleMascot } from '@/components/horoscope/OracleMascot';
import { ReadingView } from '@/components/horoscope/ReadingView';
import { SkyWheel } from '@/components/horoscope/SkyWheel';
import { moonPath } from '@/components/horoscope/skyGeometry';
import Svg, { Circle, Path } from 'react-native-svg';
import { useAccountQuery } from '@/hooks/useAccountQuery';
import { tx } from '@/i18n/locale';
import { horoscopeApi, type Hub, type Reading } from '@/lib/horoscope/horoscopeApi';
import { SIGN_KEYS, aspectName, chineseFull, dayMonth, eventText, phaseName, planetName, signIn, signName, type SignKey } from '@/lib/horoscope/names';
import { FRESH } from '@/lib/queryClient';

type Period = 'today' | 'tomorrow' | 'week' | 'month' | 'year';

const NOTE = () => tx(
  'ჰოროსკოპი გასართობი და თვითშემეცნების საშუალებაა — არ არის სამედიცინო, ფინანსური ან ფსიქოლოგიური რჩევა. პლანეტების მდებარეობა ასტრონომიულად ზუსტია.',
  'Horoscopes are for fun and reflection — not medical, financial or psychological advice. Planet positions are astronomically exact.',
);

/**
 * MEDIHOROSCOPE hub: the night sky with the person's sign on the astrolabe (real planets, today's Moon), the
 * reading for today / tomorrow / week / month / year, the Oracle, the person's day on their own chart, the
 * tarot card of the day, the sky now and the tools. Another sign can be read from the sign strip.
 */
export default function HoroscopeHub() {
  const [viewSign, setViewSign] = useState<SignKey | null>(null);
  const [period, setPeriod] = useState<Period>('today');
  const hub = useAccountQuery<Hub>({ key: ['horoscope', 'hub', viewSign ?? 'me'], fetch: () => horoscopeApi.hub(viewSign ?? undefined), staleTime: FRESH.SHORT });
  const d = hub.data;
  const mySign = d?.sign?.key ?? null;
  const shown = (viewSign ?? mySign) as SignKey | null;
  const { width } = useWindowDimensions();
  const wheel = Math.min(width - 40, 360);

  const header = (
    <ModuleHeader
      module="horo"
      subtitle={shown && d ? `${signName(shown)} · ${dayMonth(d.today)}` : tx('ჰოროსკოპი', 'Horoscope')}
      right={<ModuleHeaderButton label={tx('ცის კალენდარი', 'Sky calendar')} icon={CalendarDays} onPress={() => router.push('/horoscope/sky')} />}
    />
  );

  if (!d) {
    return (
      <HoroPage header={header}>
        <View style={{ paddingTop: 120, alignItems: 'center', gap: 12 }}>
          {hub.isError ? <HText muted center>{tx('ვარსკვლავები ვერ ჩაიტვირთა — შეამოწმე ინტერნეტი.', 'Could not load the stars — check your connection.')}</HText> : <ActivityIndicator color={HORO_INK} />}
        </View>
      </HoroPage>
    );
  }

  const reading: Reading | null = d.readings ? d.readings[period] : null;
  const today = d.readings?.today;

  return (
    <HoroPage header={header}>
      {/* The one bold element: the astrolabe floating on the sky. */}
      <View style={{ alignItems: 'center', gap: 6 }}>
        <SkyWheel size={wheel} mode="sky" bodies={d.sky.bodies} highlight={shown} moonAngle={d.sky.moon.angle} />
        <HText size={12} color="rgba(243,221,166,0.85)" center>
          {`${phaseName(d.sky.moon.key)} ${Math.round(d.sky.moon.illumination * 100)}% · ${tx('მთვარე', 'Moon')} ${signIn(d.sky.moon.sign)}`}
        </HText>
        {shown ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
            <AstroGlyph name={shown} size={22} color={HORO_INK} />
            <HText size={15} weight="semibold" color={HORO_INK}>{signName(shown)}</HText>
            {viewSign && viewSign !== mySign ? (
              <Pressable accessibilityRole="button" onPress={() => setViewSign(null)} hitSlop={8}>
                <HText size={12} muted>{tx(' · ჩემი ნიშანი', ' · my sign')}</HText>
              </Pressable>
            ) : null}
          </View>
        ) : null}
        {today ? (
          <>
            <HText size={23} weight="serif" center color="#FBF3E0" style={{ marginTop: 2, paddingHorizontal: 8 }}>{today.headline}</HText>
            {today.scores ? (
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, alignSelf: 'stretch' }}>
                {([['love', tx('სიყვარული', 'Love')], ['money', tx('საქმე', 'Work')], ['mood', tx('განწყობა', 'Mood')]] as const).map(([k, label]) => (
                  <View key={k} style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12, gap: 6, borderWidth: 1, borderColor: GLASS_LINE }}>
                    <HText size={11} muted>{label}</HText>
                    <Dots value={today.scores![k]} />
                  </View>
                ))}
              </View>
            ) : null}
          </>
        ) : null}
      </View>

      <SignStrip mine={mySign} shown={shown} onPick={(s) => setViewSign(s === mySign ? null : s)} />

      {d.needBirthDate ? (
        <HoroCard style={{ gap: 12 }}>
          <HText size={15} weight="semibold">{tx('დაბადების თარიღი გვჭირდება', 'We need your birth date')}</HText>
          <HText size={14} muted>{tx('შენი ნიშანი, რუკა და რიცხვები დაბადების თარიღიდან ითვლება. დაამატე პროფილში — მერე აქ ყველაფერი შენზე იქნება.', 'Your sign, chart and numbers come from your birth date. Add it in your profile and everything here becomes yours.')}</HText>
          <HoroButton label={tx('პროფილში დამატება', 'Add in profile')} onPress={() => router.push('/(tabs)/profile')} />
        </HoroCard>
      ) : null}

      <View style={{ gap: 14 }}>
        <HoroSegment<Period>
          value={period}
          onChange={setPeriod}
          options={[
            { key: 'today', label: tx('დღეს', 'Today') },
            { key: 'tomorrow', label: tx('ხვალ', 'Tomorrow') },
            { key: 'week', label: tx('კვირა', 'Week') },
            { key: 'month', label: tx('თვე', 'Month') },
            { key: 'year', label: d.today.slice(0, 4) },
          ]}
        />
        {reading ? (
          <>
            {period !== 'today' ? <HText size={20} weight="serif" color="#FBF3E0">{reading.headline}</HText> : null}
            <ReadingView reading={reading} />
          </>
        ) : shown ? (
          <HoroCard><HText muted center>{tx('ვარსკვლავები ამ ჰოროსკოპს ჯერ წერენ — ცოტა ხანში დაბრუნდი.', 'The stars are still writing this one — check back soon.')}</HText></HoroCard>
        ) : null}
      </View>

      {d.oracle.enabled ? <OracleCard name={d.oracle.name} /> : null}

      {mySign && !viewSign ? <PersonalDay d={d} /> : null}

      <HoroSection title={tx('დღის ტარო', 'Tarot of the day')} link={tx('განლაგება', 'Spread')} onLink={() => router.push('/horoscope/tarot')}>
        <HoroCard onPress={() => router.push('/horoscope/tarot')} label={d.tarot.name} style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
          <View style={{ width: 58, height: 94, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(233,199,126,0.55)', backgroundColor: '#0E1533', alignItems: 'center', justifyContent: 'space-around', paddingVertical: 6 }}>
            <HText size={11} weight="serif" color={HORO_INK}>{d.tarot.roman}</HText>
            <AstroGlyph name={d.tarot.glyph} size={26} color="#FBF3E0" />
            <View style={{ height: 11 }} />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <HText size={16} weight="serif" color="#FBF3E0">{d.tarot.name}</HText>
            <HText size={13} muted lines={3}>{d.tarot.text || tx('შეეხე, რომ კარტი გადმოაბრუნო.', 'Tap to turn the card over.')}</HText>
          </View>
        </HoroCard>
      </HoroSection>

      <SkyNow d={d} />

      {d.numbers || d.chinese ? (
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {d.numbers ? (
            <HoroCard onPress={() => router.push('/horoscope/numerology')} label={tx('ნუმეროლოგია', 'Numerology')} style={{ flex: 1, gap: 4 }}>
              <HText size={11} muted>{tx('დღის რიცხვი', 'Number of the day')}</HText>
              <HText size={34} weight="serif" color={HORO_INK}>{String(d.numbers.personalDay)}</HText>
              <HText size={12} muted lines={2}>{d.numbers.dayText?.title || tx(`ცხოვრების გზა: ${d.numbers.lifePath}`, `Life path: ${d.numbers.lifePath}`)}</HText>
            </HoroCard>
          ) : null}
          {d.chinese ? (
            <HoroCard onPress={() => router.push('/horoscope/chinese')} label={tx('ჩინური ჰოროსკოპი', 'Chinese horoscope')} style={{ flex: 1, gap: 4 }}>
              <HText size={11} muted>{tx('ჩინური ნიშანი', 'Chinese sign')}</HText>
              <HText size={18} weight="serif" color={HORO_INK} lines={2}>{chineseFull(d.chinese.element, d.chinese.animal)}</HText>
              <HText size={12} muted lines={2}>{d.chinese.headline || String(d.chinese.year)}</HText>
            </HoroCard>
          ) : null}
        </View>
      ) : null}

      <HoroSection title={tx('მეტი', 'More')}>
        <HoroCard style={{ paddingVertical: 2 }}>
          {[
            ['sun', tx('ჩემი ასტრორუკა', 'My birth chart'), tx('ნატალური რუკა, სახლები და ასპექტები', 'Natal chart, houses and aspects'), '/horoscope/chart'],
            ['venus', tx('თავსებადობა', 'Compatibility'), tx('ორი ნიშანი: სიყვარული, მეგობრობა, საქმე', 'Two signs: love, friendship, work'), '/horoscope/compat'],
            ['moon', tx('ტარო', 'Tarot'), tx('დღის კარტი და სამკარტიანი განლაგება', 'Card of the day and a three-card spread'), '/horoscope/tarot'],
            ['neptune', tx('სიზმრების ახსნა', 'Dream meanings'), tx('სიმბოლოების ლექსიკონი', 'A dictionary of symbols'), '/horoscope/dreams'],
            ['jupiter', tx('ნუმეროლოგია', 'Numerology'), tx('ცხოვრების გზა, წლის და დღის რიცხვი', 'Life path, year and day numbers'), '/horoscope/numerology'],
            ['saturn', tx('ჩინური ჰოროსკოპი', 'Chinese horoscope'), tx('შენი ცხოველი და წლის პროგნოზი', 'Your animal and the year ahead'), '/horoscope/chinese'],
            ['mercury', tx('ცის კალენდარი', 'Sky calendar'), tx('მთვარის ფაზები, რეტროგრადები, დაბნელებები', 'Moon phases, retrogrades, eclipses'), '/horoscope/sky'],
          ].map(([glyph, title, line, href], i) => (
            <HoroRow key={href} first={i === 0} title={title} line={line} icon={<AstroGlyph name={glyph} size={22} color={HORO_INK} />} onPress={() => router.push(href as never)} />
          ))}
        </HoroCard>
      </HoroSection>

      <HoroNote text={NOTE()} />
    </HoroPage>
  );
}

function SignStrip({ mine, shown, onPick }: { mine: SignKey | null; shown: SignKey | null; onPick: (s: SignKey) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 2 }} style={{ marginHorizontal: -2 }}>
      {SIGN_KEYS.map((s) => {
        const on = s === shown;
        return (
          <Pressable key={s} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={signName(s)} onPress={() => onPick(s)}
            style={{ alignItems: 'center', gap: 4, width: 58, paddingVertical: 10, borderRadius: 16, backgroundColor: on ? 'rgba(233,199,126,0.16)' : GLASS, borderWidth: 1, borderColor: on ? 'rgba(233,199,126,0.6)' : GLASS_LINE }}>
            <AstroGlyph name={s} size={20} color={on || s === mine ? HORO_INK : '#C9CDE4'} />
            <HText size={10} lines={1} color={on ? HORO_INK : undefined} muted={!on}>{signName(s)}</HText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function OracleCard({ name }: { name: string }) {
  const asks = [
    tx('რა მელის დღეს?', 'What does today hold for me?'),
    tx('ამომიღე ტაროს კარტი', 'Draw me a tarot card'),
    tx('ამიხსენი სიზმარი', 'Explain my dream'),
  ];
  return (
    <HoroCard style={{ padding: 0, overflow: 'hidden', borderColor: 'rgba(185,166,255,0.28)' }}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${name} — ${tx('ჰკითხე ვარსკვლავებს', 'Ask the stars')}`} onPress={() => router.push('/horoscope/oracle')}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, padding: 16, paddingBottom: 6 }}>
        <OracleMascot size={104} mood="idle" />
        <View style={{ flex: 1, gap: 4 }}>
          <HText size={11} color="#B9A6FF" weight="semibold">{name}</HText>
          <HText size={18} weight="serif" color="#FBF3E0">{tx('ჰკითხე ვარსკვლავებს', 'Ask the stars')}</HText>
          <HText size={13} muted>{tx('რუკას, ტაროს და სიზმრებს ერთად წავიკითხავთ.', 'We’ll read your chart, tarot and dreams together.')}</HText>
        </View>
      </Pressable>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 16, paddingTop: 8 }}>
        {asks.map((q) => (
          <Pressable key={q} accessibilityRole="button" accessibilityLabel={q} onPress={() => router.push({ pathname: '/horoscope/oracle', params: { ask: q, go: '1' } })}
            style={{ borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: 'rgba(185,166,255,0.12)', borderWidth: 1, borderColor: 'rgba(185,166,255,0.25)' }}>
            <HText size={12.5} color="#DCD3FF">{q}</HText>
          </Pressable>
        ))}
      </View>
    </HoroCard>
  );
}

function PersonalDay({ d }: { d: Hub }) {
  const transits = d.personal?.transits ?? [];
  if (!d.personal?.timeKnown) {
    return (
      <HoroSection title={tx('შენი დღე შენს რუკაზე', 'Your day on your chart')}>
        <HoroCard style={{ gap: 12 }}>
          <HText size={14} muted>{tx('დაბადების დრო და ადგილი რომ დაამატო, ვნახავთ ასცენდენტს, სახლებს და იმას, როგორ ეხება დღევანდელი ცა სწორედ შენს რუკას.', 'Add your birth time and place to see your ascendant, houses and how today’s sky touches your own chart.')}</HText>
          <HoroButton label={tx('დაბადების დრო და ადგილი', 'Birth time and place')} onPress={() => router.push('/horoscope/birth')} />
          {transits.length ? <HText size={12} muted>{tx(`ახლაც: ${planetName(transits[0].transit)} — ${aspectName(transits[0].aspect)} — შენი ${planetName(transits[0].natal)}`, `Even now: ${planetName(transits[0].transit)} ${aspectName(transits[0].aspect)} your ${planetName(transits[0].natal)}`)}</HText> : null}
        </HoroCard>
      </HoroSection>
    );
  }
  return (
    <HoroSection title={tx('შენი დღე შენს რუკაზე', 'Your day on your chart')} link={tx('ასტრორუკა', 'Chart')} onLink={() => router.push('/horoscope/chart')}>
      <HoroCard style={{ paddingVertical: 2 }}>
        {transits.length ? transits.slice(0, 3).map((t, i) => (
          <HoroRow key={`${t.transit}-${t.natal}`} first={i === 0}
            icon={<AstroGlyph name={t.transit} size={22} color={HORO_INK} />}
            title={t.title || `${planetName(t.transit)} · ${aspectName(t.aspect)} · ${tx('შენი', 'your')} ${planetName(t.natal)}`}
            line={t.title ? t.text || null : t.text || null} />
        )) : <View style={{ paddingVertical: 14 }}><HText muted>{tx('დღეს ცა შენს რუკას მშვიდად უვლის გვერდს — კარგი დღეა საკუთარი რიტმისთვის.', 'Today the sky passes your chart quietly — a good day for your own rhythm.')}</HText></View>}
      </HoroCard>
    </HoroSection>
  );
}

function SkyNow({ d }: { d: Hub }) {
  const m = d.sky.moon;
  const events = useMemo(() => d.sky.events.filter((e) => !(e.type === 'ingress' && ['uranus', 'neptune', 'pluto'].includes(String(e.body)))).slice(0, 4), [d.sky.events]);
  return (
    <HoroSection title={tx('ცა ახლა', 'The sky now')} link={tx('კალენდარი', 'Calendar')} onLink={() => router.push('/horoscope/sky')}>
      <HoroCard style={{ gap: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <Svg width={52} height={52} viewBox="0 0 52 52">
            <Circle cx={26} cy={26} r={24} fill="#1F2A55" />
            <Path d={moonPath(26, 26, 24, m.angle)} fill="#E8EDF7" />
          </Svg>
          <View style={{ flex: 1 }}>
            <HText size={15} weight="semibold">{phaseName(m.key)}</HText>
            <HText size={13} muted>{tx(`მთვარე ${signIn(m.sign)} · მთვარის მე-${m.lunarDay} დღე`, `Moon ${signIn(m.sign)} · lunar day ${m.lunarDay}`)}</HText>
          </View>
        </View>
        {m.text ? <HText size={13} muted>{m.text}</HText> : null}
        {d.sky.retrograde.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {d.sky.retrograde.map((p) => (
              <View key={p} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: 'rgba(233,199,126,0.12)' }}>
                <AstroGlyph name={p} size={13} color={HORO_INK} />
                <HText size={12} color={HORO_INK}>{tx(`${planetName(p)} · რეტრო`, `${planetName(p)} · retro`)}</HText>
              </View>
            ))}
          </View>
        ) : null}
        <View>
          {events.map((e, i) => {
            const [title, sub] = eventText(e);
            const date = new Date(e.at);
            const day = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tbilisi', day: 'numeric' }).format(date);
            const month = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tbilisi', month: 'numeric' }).format(date);
            return (
              <View key={`${e.type}-${e.at}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: GLASS_LINE }}>
                <View style={{ width: 44, alignItems: 'center' }}>
                  <HText size={19} weight="serif" color={HORO_INK}>{day}</HText>
                  <HText size={10} muted>{dayMonth(`2000-${month.padStart(2, '0')}-01`).replace(/^1\s/, '').slice(0, 3)}</HText>
                </View>
                <View style={{ flex: 1 }}>
                  <HText size={14} weight="semibold">{title}</HText>
                  <HText size={12} muted>{sub}</HText>
                </View>
              </View>
            );
          })}
        </View>
      </HoroCard>
    </HoroSection>
  );
}
