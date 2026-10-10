import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { tx } from '@/i18n/locale';
import type { LabBodyGender, LabSystemId } from '@/lib/labBody';
import { MODULE_BRANDS } from '@/theme/moduleBrand';
import { HUB } from '@/theme/hub';
import { LabOrganArt } from './LabOrganArt';
import { useMedilab } from './MedilabUI';

const BRAND = MODULE_BRANDS.lab;
const AMBER = '#FCD34D';

/**
 * The test at a glance (owner 2026-10-10, second pass: no lit tiles). The date, one sentence — how
 * many values need a look — and one quiet bar split by share: amber outside, white inside, a faint
 * part for values without a printed range; the counts sit under it.
 */
export function LabSummaryCard({ dateLabel, total, inRange, off }: { dateLabel: string; total: number; inRange: number; off: number }) {
  const unknown = Math.max(0, total - inRange - off);
  return (
    <View style={s.heroWrap}>
      <LinearGradient colors={BRAND.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
        <View pointerEvents="none" style={[s.glow, { backgroundColor: BRAND.glow }]} />
        <View pointerEvents="none" style={[s.ring, s.ringOuter]} />
        <View pointerEvents="none" style={[s.ring, s.ringInner]} />
        <Text style={[s.kicker, { color: BRAND.onHero }]}>{tx(`${dateLabel} · ${total} მაჩვენებელი`, `${dateLabel} · ${total} values`)}</Text>
        <Text style={s.headline} accessibilityRole="header">
          {off
            ? tx(`${off} მაჩვენებელს ყურადღება სჭირდება`, off === 1 ? '1 value needs a look' : `${off} values need a look`)
            : tx('ყველა მაჩვენებელი ნორმაშია', 'Every value is in range')}
        </Text>
        <View style={s.bar} accessible={false}>
          {off ? <View style={{ flex: off, backgroundColor: AMBER }} /> : null}
          {inRange ? <View style={{ flex: inRange, backgroundColor: 'rgba(255,255,255,0.88)' }} /> : null}
          {unknown ? <View style={{ flex: unknown, backgroundColor: 'rgba(255,255,255,0.28)' }} /> : null}
        </View>
        <View style={s.legend}>
          {off ? <Legend color={AMBER} label={tx(`${off} ნორმის გარეთ`, `${off} outside`)} /> : null}
          <Legend color="rgba(255,255,255,0.88)" label={tx(`${inRange} ნორმაში`, `${inRange} in range`)} />
          {unknown ? <Legend color="rgba(255,255,255,0.28)" label={tx(`${unknown} ნორმის გარეშე`, `${unknown} no range`)} /> : null}
        </View>
      </LinearGradient>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={s.legendItem}>
      <View style={[s.legendDot, { backgroundColor: color }]} />
      <Text style={[s.legendText, { color: BRAND.onHero }]}>{label}</Text>
    </View>
  );
}

/** The organ drawing on a soft tile, with a small status dot. `onPage` = sits on the page, not a card. */
export function OrganTile({ system, gender, tone, size = 52, onPage = false }: { system: LabSystemId; gender: LabBodyGender; tone: 'warn' | 'ok' | 'unknown'; size?: number; onPage?: boolean }) {
  const M = useMedilab();
  const dot = tone === 'warn' ? M.attention : tone === 'ok' ? M.normal : M.c.text300;
  return (
    <View style={[s.organ, { width: size, height: size, borderRadius: size * 0.34, backgroundColor: onPage ? M.c.surface : M.c.bg100 }]}>
      <LabOrganArt system={system} gender={gender} size={size * 0.8} />
      <View style={[s.organDot, { backgroundColor: dot, borderColor: onPage ? M.c.bg100 : M.c.surface }]} />
    </View>
  );
}

const s = StyleSheet.create({
  heroWrap: { borderRadius: HUB.cardRadius, overflow: 'hidden' },
  hero: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 16, overflow: 'hidden' },
  glow: { position: 'absolute', width: 200, height: 200, borderRadius: 100, right: -70, top: -90 },
  ring: { position: 'absolute', borderWidth: 1, borderColor: 'rgba(199,210,254,0.16)' },
  ringOuter: { width: 240, height: 240, borderRadius: 120, right: -100, top: -110 },
  ringInner: { width: 160, height: 160, borderRadius: 80, right: -60, top: -70 },
  kicker: { fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 12.5, lineHeight: 17 },
  headline: { fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 20, lineHeight: 28, color: '#FFFFFF', marginTop: 4 },
  bar: { flexDirection: 'row', gap: 3, height: 8, borderRadius: 4, overflow: 'hidden', marginTop: 14 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 4, marginTop: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 12, lineHeight: 16 },
  organ: { alignItems: 'center', justifyContent: 'center' },
  organDot: { position: 'absolute', right: -1, top: -1, width: 12, height: 12, borderRadius: 6, borderWidth: 2 },
});
