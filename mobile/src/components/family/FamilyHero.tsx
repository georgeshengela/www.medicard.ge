/**
 * MEDIFAMILY's one spotlight: the child's card. Coral gradient (moduleBrand `family`), corner glow and rings
 * like every MEDI hero, and the life ribbon — birth to 18 on a log scale (the first months get room), the
 * Georgian calendar's vaccine stations as beads, the child as a lit marker. Under it, the one thing to do now.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, Line, RadialGradient, Stop } from 'react-native-svg';
import { Pencil } from 'lucide-react-native';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { tx } from '@/i18n/locale';
import type { AgeInfo, FamilyMember, Hero, RibbonStation } from '@/lib/family/familyApi';
import { HUB } from '@/theme/hub';
import { MODULE_BRANDS } from '@/theme/moduleBrand';
import { ChildAvatar, FONT } from './FamilyUI';

const BRAND = MODULE_BRANDS.family;
const MAX_DAYS = 18 * 365.25;
const AMBER = '#FCD34D';
const STATION_LABEL: Record<string, [string, string]> = {
  birth: ['დაბ.', 'birth'], m2: ['2თ', '2m'], m3: ['3თ', '3m'], m4: ['4თ', '4m'], m12: ['1წ', '1y'], m18: ['1.5წ', '1.5y'], y5: ['5წ', '5y'], y10: ['10წ', '10y'], y14: ['14წ', '14y'],
};
const STATION_NAME: Record<string, [string, string]> = {
  birth: ['დაბადებისას', 'at birth'], m2: ['2 თვე', '2 months'], m3: ['3 თვე', '3 months'], m4: ['4 თვე', '4 months'], m12: ['12 თვე', '12 months'],
  m18: ['18 თვე', '18 months'], y5: ['5 წელი', '5 years'], y10: ['10–12 წელი', '10–12 years'], y14: ['14 წელი', '14 years'],
};

/** Log scale: day 0 → 0, 18 years → 1; 2, 3 and 4 months stay ~16 px apart on a phone. */
export function ribbonX(ageDays: number): number {
  return Math.log1p(Math.max(0, ageDays) / 30) / Math.log1p(MAX_DAYS / 30);
}

const CTA: Record<Hero['action'], [string, string]> = {
  vaccines: ['აცრების ბარათი', 'Vaccine card'],
  growth: ['გაზომვა', 'Measure'],
  health: ['ტემპერატურა', 'Temperature'],
  guide: ['ამ ასაკში', 'At this age'],
};

export function FamilyHero({ member, age, hero, ribbon, done, total, onAction, onEdit }: {
  member: FamilyMember; age: AgeInfo; hero: Hero; ribbon: RibbonStation[]; done: number; total: number;
  onAction: (action: Hero['action']) => void; onEdit: () => void;
}) {
  const next = ribbon.find((s) => s.status === 'overdue') || ribbon.find((s) => s.status === 'due') || ribbon.find((s) => s.status === 'soon' || s.status === 'upcoming');
  const nextName = next ? tx(...STATION_NAME[next.key] ?? [next.key, next.key]) : null;
  const ribbonLabel = tx(
    `აცრების გზა: ${done} ${total} დოზიდან ამ ასაკისთვის.${nextName ? ` შემდეგი ეტაპი — ${nextName}.` : ''}`,
    `Vaccine journey: ${done} of ${total} doses for this age.${nextName ? ` Next stop — ${nextName}.` : ''}`,
  );
  const toneInk = hero.tone === 'alert' ? '#FECACA' : hero.tone === 'watch' ? AMBER : BRAND.onHero;
  return (
    <View style={{ borderRadius: HUB.cardRadius + 4, overflow: 'hidden' }}>
      <LinearGradient colors={BRAND.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 20, gap: 18 }}>
        <Rings />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <ChildAvatar name={member.name} color={member.color} size={52} ring="rgba(255,255,255,0.65)" />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ fontFamily: FONT.bold, fontSize: 24, lineHeight: 32, color: '#FFFFFF' }}>{member.name}</Text>
            <Text numberOfLines={1} style={{ fontFamily: FONT.medium, fontSize: 14, lineHeight: 20, color: BRAND.onHero }}>
              {age.label}{age.correctedLabel ? tx(` · კორექტ. ${age.correctedLabel}`, ` · corrected ${age.correctedLabel}`) : ''}
            </Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={tx('პროფილის რედაქტირება', 'Edit profile')} onPress={onEdit} hitSlop={6}
            style={{ width: 44, height: 44, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' }}>
            <Pencil size={18} color="#FFFFFF" />
          </Pressable>
        </View>

        <View accessible accessibilityLabel={ribbonLabel} style={{ gap: 6 }}>
          <LifeRibbon stations={ribbon} ageDays={age.days} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontFamily: FONT.medium, fontSize: 11, color: 'rgba(255,237,213,0.75)' }}>{tx('დაბადება', 'Birth')}</Text>
            {next ? <Text style={{ fontFamily: FONT.semi, fontSize: 11, color: next.status === 'overdue' ? AMBER : '#FFFFFF' }}>{next.status === 'overdue' ? tx(`გადაცილებული: ${nextName}`, `Overdue: ${nextName}`) : tx(`შემდეგი: ${nextName}`, `Next: ${nextName}`)}</Text> : null}
            <Text style={{ fontFamily: FONT.medium, fontSize: 11, color: 'rgba(255,237,213,0.75)' }}>{tx('18 წელი', '18 years')}</Text>
          </View>
        </View>

        <View style={{ gap: 12 }}>
          <View style={{ gap: 2 }}>
            <Text style={{ fontFamily: FONT.bold, fontSize: 18, lineHeight: 26, color: toneInk }}>{hero.title}</Text>
            {hero.body ? <Text style={{ fontFamily: FONT.regular, fontSize: 14, lineHeight: 21, color: '#FFFFFF' }}>{hero.body}</Text> : null}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Pressable accessibilityRole="button" accessibilityLabel={tx(...CTA[hero.action])} onPress={() => onAction(hero.action)}
              style={{ height: 44, paddingHorizontal: 18, borderRadius: 14, backgroundColor: '#FFFFFF', justifyContent: 'center' }}>
              <Text style={{ fontFamily: FONT.semi, fontSize: 14, color: BRAND.gradient[0] }}>{tx(...CTA[hero.action])}</Text>
            </Pressable>
            <View style={{ flex: 1 }} />
            {total > 0 ? (
              <Text style={{ fontFamily: FONT.semi, fontSize: 13, color: BRAND.onHero }}>{tx(`აცრები ${done}/${total}`, `Vaccines ${done}/${total}`)}</Text>
            ) : null}
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}

/** Concentric rings + corner glow, the MEDI hero signature. Decoration only. */
function Rings() {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: -70, right: -70 }}>
      <Svg width={240} height={240}>
        <Defs>
          <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#FDBA74" stopOpacity="0.55" />
            <Stop offset="1" stopColor="#FDBA74" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx={120} cy={120} r={110} fill="url(#glow)" />
        {[46, 74, 102].map((r) => <Circle key={r} cx={120} cy={120} r={r} stroke="#FFFFFF" strokeOpacity={0.12} strokeWidth={1} fill="none" />)}
      </Svg>
    </View>
  );
}

/** Which beads get a label: a few landmarks plus the next stop, dropping a landmark that would touch it. */
function labelKeys(nextKey: string | undefined): string[] {
  const base = ['birth', 'm2', 'm12', 'y5', 'y14'];
  if (!nextKey || base.includes(nextKey)) return base;
  const crowded: Record<string, string> = { m3: 'm2', m4: 'm2', m18: 'm12', y10: 'y14' };
  return [...base.filter((k) => k !== crowded[nextKey]), nextKey];
}

function LifeRibbon({ stations, ageDays }: { stations: RibbonStation[]; ageDays: number }) {
  const [width, setWidth] = useState(0);
  const reduceMotion = usePrefersReducedMotion();
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1800, easing: Easing.out(Easing.quad), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [pulse, reduceMotion]);
  const H = 46;
  const Y = 18;
  const pad = 8;
  const span = Math.max(1, width - pad * 2);
  const xOf = (d: number) => pad + ribbonX(d) * span;
  const childX = xOf(ageDays);
  const nextKey = useMemo(() => (stations.find((s) => s.status === 'overdue') || stations.find((s) => s.status === 'due') || stations.find((s) => s.status === 'soon' || s.status === 'upcoming'))?.key, [stations]);
  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ height: H }}>
      {width > 0 ? (
        <>
          <Svg width={width} height={H}>
            <Defs>
              <RadialGradient id="child" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.9" />
                <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Line x1={pad} y1={Y} x2={width - pad} y2={Y} stroke="#FFFFFF" strokeOpacity={0.28} strokeWidth={2} strokeLinecap="round" />
            <Line x1={pad} y1={Y} x2={childX} y2={Y} stroke="#FFFFFF" strokeOpacity={0.9} strokeWidth={3} strokeLinecap="round" />
            {stations.map((s) => {
              const x = xOf(s.ageDays);
              const isNext = s.key === nextKey;
              if (s.status === 'done' || s.status === 'skipped') return <Circle key={s.key} cx={x} cy={Y} r={5.5} fill="#FFFFFF" />;
              if (s.status === 'overdue') return <Circle key={s.key} cx={x} cy={Y} r={6} fill={AMBER} stroke="#7C2D12" strokeWidth={1.5} />;
              if (s.status === 'expired') return <Circle key={s.key} cx={x} cy={Y} r={3.5} fill="#FFFFFF" fillOpacity={0.35} />;
              return <Circle key={s.key} cx={x} cy={Y} r={isNext ? 6.5 : 5} fill={isNext ? '#FFFFFF' : 'none'} fillOpacity={isNext ? 0.25 : 0} stroke="#FFFFFF" strokeOpacity={isNext ? 1 : 0.55} strokeWidth={isNext ? 2 : 1.5} />;
            })}
            <Circle cx={childX} cy={Y} r={14} fill="url(#child)" />
            <Circle cx={childX} cy={Y} r={6} fill="#FFFFFF" stroke={BRAND.gradient[1]} strokeWidth={2.5} />
          </Svg>
          {stations.filter((s) => labelKeys(nextKey).includes(s.key)).map((s) => {
            const x = xOf(s.ageDays);
            const label = tx(...(STATION_LABEL[s.key] ?? [s.key, s.key]));
            return (
              <Text key={`l-${s.key}`} style={{ position: 'absolute', top: Y + 10, left: Math.min(Math.max(0, x - 16), width - 32), width: 32, textAlign: 'center', fontFamily: s.key === nextKey ? FONT.bold : FONT.medium, fontSize: 10, color: s.key === nextKey ? '#FFFFFF' : 'rgba(255,237,213,0.7)' }}>
                {label}
              </Text>
            );
          })}
          {nextKey && !reduceMotion ? (() => {
            const s = stations.find((x) => x.key === nextKey)!;
            const x = xOf(s.ageDays);
            return (
              <Animated.View pointerEvents="none" style={{ position: 'absolute', left: x - 12, top: Y - 12, width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: s.status === 'overdue' ? AMBER : '#FFFFFF',
                opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.8, 0] }), transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.4] }) }] }} />
            );
          })() : null}
        </>
      ) : null}
    </View>
  );
}
