import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import {
  ArrowUpRight,
  ChevronRight,
  CloudSun,
  HeartHandshake,
  MessageCircle,
  Route,
  ScanLine,
  FlaskConical,
  Sparkles,
  Stethoscope,
} from 'lucide-react-native';
import { useIsDark, useThemeColors } from '@/theme/colors';
import { useWeather } from '@/hooks/useWeather';
import { Meteocon, meteoconSlugFor } from '@/components/weather/Meteocon';
import { weatherConditionLabel } from '@/lib/weather';
import { getRunState } from '@/lib/run/store';

export function HomeRunDiscovery() {
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="MEDIRUN — გაისეირნე და აღმოაჩინე ქალაქი"
      onPress={() => {
        const phase = getRunState().phase;
        router.push(
          ['running', 'paused', 'ready', 'preparing'].includes(phase)
            ? '/run/active'
            : '/run',
        );
      }}
      style={[s.card, { backgroundColor: '#102C35', paddingBottom: 0 }]}
    >
      <View style={s.between}>
        <Text style={[s.brand, { color: '#FFFFFF' }]}>
          MEDI<Text style={{ color: '#5EEAD4', fontStyle: 'italic' }}>RUN</Text>
        </Text>
        <View style={s.runTag}>
          <Route size={13} color="#99F6E4" />
          <Text style={[s.small, { color: '#CCFBF1' }]}>შენი აღმოჩენები</Text>
        </View>
      </View>
      <Text style={[s.title, { color: '#FFFFFF', marginTop: 18 }]}>
        შენი ქალაქი.{'\n'}ახალი პერსპექტივით.
      </Text>
      <Text style={[s.body, { color: '#C5DADA', marginTop: 7, maxWidth: 290 }]}>
        ყოველი გასეირნება შენი ისტორიის ნაწილია.
      </Text>
      <View style={[s.between, { marginTop: 16 }]}>
        <View style={s.runCta}>
          <Text style={[s.cta, { color: '#073B36' }]}>გახსენი რუკა</Text>
          <ArrowUpRight size={17} color="#073B36" />
        </View>
        <Text style={[s.small, { color: '#C5DADA' }]}>
          ნაბიჯები · აღმოჩენები
        </Text>
      </View>
      <View
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
        style={{ height: 76, marginHorizontal: -22, marginTop: 13 }}
      >
        <Svg
          width="100%"
          height="76"
          viewBox="0 0 350 76"
          preserveAspectRatio="xMidYMid slice"
        >
          <Path
            d="M0 19L350 19M0 58L350 58M46 0L82 76M152 0L174 76M279 0L259 76"
            stroke="#264650"
            strokeWidth="2"
          />
          <Rect x="187" y="25" width="60" height="25" rx="10" fill="#204E4E" />
          <Path
            d="M-10 61H86C107 61 105 31 126 31H213C239 31 230 58 256 58H354"
            fill="none"
            stroke="#163D43"
            strokeWidth="14"
          />
          <Path
            d="M-10 61H86C107 61 105 31 126 31H213C239 31 230 58 256 58H354"
            fill="none"
            stroke="#5EEAD4"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <Circle cx="151" cy="31" r="12" fill="#5EEAD4" opacity="0.15" />
          <Circle
            cx="151"
            cy="31"
            r="5"
            fill="#FFFFFF"
            stroke="#5EEAD4"
            strokeWidth="2"
          />
        </Svg>
      </View>
    </Pressable>
  );
}

export function HomeCommunityDiscovery() {
  const dark = useIsDark(),
    router = useRouter();
  const ink = dark ? '#F6E8F0' : '#563449';
  const secondary = dark ? '#DBC4D5' : '#705568';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="ქალების სივრცე — შეუერთდი საუბარს"
      onPress={() => router.push('/community')}
      style={[
        s.card,
        {
          backgroundColor: dark ? '#272033' : '#F7EEF5',
          borderWidth: 1,
          borderColor: dark ? '#40324B' : '#EADAE7',
        },
      ]}
    >
      <View style={s.between}>
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={[s.small, { color: secondary }]}>ქალების სივრცე</Text>
          <Text style={[s.title, { color: ink }]}>
            აქ შენს ამბავს{'\n'}მოუსმენენ.
          </Text>
        </View>
        <View
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          style={{ width: 74, height: 74 }}
        >
          <View
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              width: 52,
              height: 49,
              borderRadius: 18,
              borderBottomRightRadius: 5,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: dark ? '#463452' : '#E4D5EB',
            }}
          >
            <MessageCircle
              size={25}
              color={dark ? '#E0C9EF' : '#72518B'}
              strokeWidth={1.6}
            />
          </View>
          <View
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              width: 46,
              height: 43,
              borderRadius: 16,
              borderBottomLeftRadius: 5,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: dark ? '#563644' : '#F0D9E3',
            }}
          >
            <HeartHandshake
              size={24}
              color={dark ? '#F1BDC9' : '#94546A'}
              strokeWidth={1.6}
            />
          </View>
        </View>
      </View>
      <Text style={[s.body, { color: secondary, marginTop: 12 }]}>
        ჰკითხე, გაუზიარე და იპოვე მხარდაჭერა — სახელით, მეტსახელით ან
        ანონიმურად.
      </Text>
      <View
        style={[
          s.between,
          {
            borderTopWidth: StyleSheet.hairlineWidth,
            borderColor: dark ? '#514058' : '#DFCADA',
            paddingTop: 14,
            marginTop: 17,
          },
        ]}
      >
        <Text style={[s.cta, { color: ink }]}>შეუერთდი საუბარს</Text>
        <ArrowUpRight size={20} color={ink} />
      </View>
    </Pressable>
  );
}

export function HomeWeatherCompact() {
  const { snapshot, loading, stale, fromCache } = useWeather();
  const dark = useIsDark(),
    router = useRouter();
  const ink = dark ? '#E2EDF8' : '#23465C';
  const muted = dark ? '#B9CCDD' : '#526E82';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="ამინდის ნახვა"
      onPress={() => router.push('/weather')}
      style={[
        s.weather,
        {
          backgroundColor: dark ? '#152638' : '#EDF5FB',
          borderColor: dark ? '#293D53' : '#D9E8F2',
        },
      ]}
    >
      <View
        style={{
          width: 48,
          height: 48,
          flexShrink: 0,
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {snapshot ? (
          <Meteocon
            slug={meteoconSlugFor(
              snapshot.current.condition,
              snapshot.current.isDay,
            )}
            size={47}
          />
        ) : (
          <CloudSun size={33} color={muted} />
        )}
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={[s.cta, { color: ink }]}>
          {snapshot?.location.city || 'ამინდი შენს ქალაქში'}
        </Text>
        <Text style={[s.small, { color: muted }]}>
          {snapshot
            ? `${weatherConditionLabel(snapshot.current.condition, 'ka')}${stale || fromCache ? ' · შენახული' : ''}`
            : loading
              ? 'ახლდება…'
              : 'ნახე პროგნოზი და ქალაქის პარამეტრები'}
        </Text>
      </View>
      {snapshot ? (
        <Text
          style={{
            fontFamily: 'NotoSansGeorgian_600SemiBold',
            fontSize: 28,
            color: ink,
          }}
        >
          {Math.round(snapshot.current.temperatureC)}°
        </Text>
      ) : (
        <ArrowUpRight size={19} color={ink} />
      )}
    </Pressable>
  );
}

const analysisTools = [
  {
    label: 'ლაბორატორიული ანალიზი',
    caption: 'ატვირთე პასუხები ფოტოდ ან PDF-ად',
    href: '/module/lab',
    Icon: FlaskConical,
    color: '#327C86',
    dark: '#9DD4DB',
  },
  {
    label: 'სამედიცინო გამოსახულება',
    caption: 'ატვირთე რენტგენი ან სხვა კვლევის სურათი',
    href: '/module/imaging',
    Icon: ScanLine,
    color: '#6864A0',
    dark: '#C4BEF0',
  },
  {
    label: 'კანის ფოტოს განხილვა',
    caption: 'გადაიღე კანის ის უბანი, რომელიც გაწუხებს',
    href: '/module/skin',
    Icon: Stethoscope,
    color: '#9A596F',
    dark: '#E6B7C6',
  },
  {
    label: 'კანის მოვლა',
    caption: 'მიიღე დახმარება მოვლის რუტინის შერჩევაში',
    href: '/module/skincare',
    Icon: Sparkles,
    color: '#86662E',
    dark: '#DDC491',
  },
];
export function HomeAnalysisShortcuts() {
  const c = useThemeColors(),
    dark = useIsDark(),
    router = useRouter();
  return (
    <View
      style={{
        backgroundColor: c.surface,
        borderRadius: 22,
        paddingHorizontal: 17,
      }}
    >
      {analysisTools.map(
        ({ label, caption, href, Icon, color, dark: darkColor }, index) => (
          <Pressable
            key={href}
            accessibilityRole="button"
            accessibilityLabel={`${label}. ${caption}`}
            onPress={() => router.push(href as never)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 13,
              paddingVertical: 17,
              borderTopWidth: index ? StyleSheet.hairlineWidth : 0,
              borderColor: c.bg300,
            }}
          >
            <View
              style={{
                width: 43,
                height: 46,
                borderRadius: 14,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: `${dark ? darkColor : color}14`,
              }}
            >
              <Icon
                size={23}
                color={dark ? darkColor : color}
                strokeWidth={1.7}
              />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={[s.cta, { color: c.text100 }]}>{label}</Text>
              <Text style={[s.small, { color: c.text200, fontSize: 12 }]}>
                {caption}
              </Text>
            </View>
            <ChevronRight size={16} color={c.text200} />
          </Pressable>
        ),
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: 25, padding: 22, overflow: 'hidden' },
  between: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
  brand: {
    fontFamily: 'NotoSansGeorgian_700Bold',
    fontSize: 22,
    letterSpacing: -0.6,
  },
  title: {
    fontFamily: 'NotoSansGeorgian_700Bold',
    fontSize: 22,
    lineHeight: 32,
  },
  body: {
    fontFamily: 'NotoSansGeorgian_400Regular',
    fontSize: 13,
    lineHeight: 22,
  },
  small: {
    fontFamily: 'NotoSansGeorgian_400Regular',
    fontSize: 11,
    lineHeight: 18,
  },
  cta: {
    fontFamily: 'NotoSansGeorgian_600SemiBold',
    fontSize: 13,
    lineHeight: 21,
  },
  runTag: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  runCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#99F6E4',
    borderRadius: 24,
    paddingVertical: 11,
    paddingHorizontal: 16,
  },
  weather: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
  },
});
