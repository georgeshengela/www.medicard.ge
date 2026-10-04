import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Info } from 'lucide-react-native';
import { ModuleHeader, ModuleHeaderButton } from '@/components/brand/ModuleHeader';
import { MedicalSourcesLink } from '@/components/health/MedicalSourcesLink';
import { HomeSectionHeading } from '@/components/home/HomeSectionHeading';
import { LabParamChart } from '@/components/lab/LabParamChart';
import { LabParamExplainSheet } from '@/components/lab/LabParamExplainSheet';
import { LabParamRow } from '@/components/lab/LabParamRow';
import { flagIsOff, hasRange, rangePosition, useMedilab } from '@/components/lab/MedilabUI';
import { useLab } from '@/hooks/useLab';
import { ka } from '@/i18n/ka';
import { tx } from '@/i18n/locale';
import { formatLabDateKa, isTodayYmd } from '@/lib/labExtract';
import { formatPrintedNorm } from '@/lib/labExplain';
import { resolveCanonicalLabKey, titledLabName } from '@/lib/labNames';
import { MODULE_BRANDS } from '@/theme/moduleBrand';
import { HUB, hubText } from '@/theme/hub';

const BRAND = MODULE_BRANDS.lab;
const ATTENTION = '#FCD34D';

/**
 * One lab value over time: the latest result as the page's indigo hero (value, status, range bar,
 * change since last time), the trend chart, then every earlier result.
 */
export default function LabParamScreen() {
  const M = useMedilab();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { key: rawKey } = useLocalSearchParams<{ key: string }>();
  const key = rawKey ? decodeURIComponent(Array.isArray(rawKey) ? rawKey[0] : rawKey) : '';
  const chartKey = key ? resolveCanonicalLabKey({ key, nameEn: key, nameKa: key }) : '';
  const { seriesFor, loading } = useLab();
  const [explainOpen, setExplainOpen] = useState(false);
  const points = useMemo(() => (chartKey ? seriesFor(chartKey) : []), [chartKey, seriesFor]);
  const latest = points[points.length - 1];
  const previous = points.length > 1 ? points[points.length - 2] : null;
  const name = latest ? titledLabName(latest.param) : key;
  const latin = latest?.param.nameEn && latest.param.nameEn !== name ? latest.param.nameEn : '';
  const printed = latest ? formatPrintedNorm(latest.param) : null;
  const diff = latest && previous ? latest.param.value - previous.param.value : null;
  const off = latest ? flagIsOff(latest.param.flag) : false;
  const status = !latest ? '' : latest.param.flag === 'H' ? ka.lab.above : latest.param.flag === 'L' ? ka.lab.below : latest.param.flag === 'N' ? ka.lab.normal : ka.lab.unknown;

  return (
    <View style={{ flex: 1, backgroundColor: M.c.bg100 }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40, paddingHorizontal: HUB.gutter }}
        showsVerticalScrollIndicator={false}
      >
        <ModuleHeader
          module="lab"
          subtitle={latin ? `${name} · ${latin}` : name}
          right={latest ? <ModuleHeaderButton label={ka.lab.explainA11y} icon={Info} onPress={() => setExplainOpen(true)} /> : undefined}
        />

        {!latest ? (
          <Text style={[hubText.body, { color: M.c.text200, marginTop: 24 }]}>{loading ? ka.common.loading : ka.lab.needMorePoints}</Text>
        ) : (
          <>
            {/* The page's one hero: the latest result. */}
            <View style={[s.heroWrap, { marginTop: 20 }]}>
              <LinearGradient colors={BRAND.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
                <View pointerEvents="none" style={[s.glow, { backgroundColor: BRAND.glow }]} />
                <View pointerEvents="none" style={[s.ring, s.ringOuter]} />
                <View pointerEvents="none" style={[s.ring, s.ringInner]} />
                <Text numberOfLines={1} style={s.heroName}>{name}</Text>
                <View style={s.heroValueRow}>
                  <Text style={[s.heroValue, off && { color: ATTENTION }]}>{latest.param.display}</Text>
                  {latest.param.unit ? <Text style={s.heroUnit}>{latest.param.unit}</Text> : null}
                  <View style={{ flex: 1 }} />
                  <View style={[s.heroPill, off && { backgroundColor: 'rgba(252,211,77,0.18)', borderColor: 'rgba(252,211,77,0.45)' }]}>
                    <Text style={[s.heroPillText, off && { color: ATTENTION }]}>{status}</Text>
                  </View>
                </View>
                {hasRange(latest.param) ? (
                  <View style={{ gap: 6 }}>
                    <View style={s.track}>
                      <View style={s.band} />
                      <View
                        style={[
                          s.dot,
                          {
                            left: `${rangePosition(latest.param.value, latest.param.refLow as number, latest.param.refHigh as number) * 100}%`,
                            backgroundColor: off ? ATTENTION : '#FFFFFF',
                          },
                        ]}
                      />
                    </View>
                    <View style={{ flexDirection: 'row' }}>
                      <Text style={[s.scale, { left: '25%' }]}>{latest.param.refLow}</Text>
                      <Text style={[s.scale, { left: '75%' }]}>{latest.param.refHigh}</Text>
                    </View>
                  </View>
                ) : null}
                <View style={s.heroMeta}>
                  <Text style={s.heroMetaText}>{isTodayYmd(latest.date) ? ka.common.today : formatLabDateKa(latest.date)}</Text>
                  {printed ? <Text style={s.heroMetaText}>{tx(`ნორმა ${printed}`, `Range ${printed}`)}</Text> : null}
                </View>
                {diff != null && previous ? (
                  <Text style={s.heroDelta}>
                    {ka.lab.vsPrevious(`${diff > 0 ? '+' : diff < 0 ? '−' : ''}${fmt(Math.abs(diff))}`, latest.param.unit)}
                  </Text>
                ) : null}
              </LinearGradient>
            </View>

            {points.length > 1 ? (
              <View style={{ marginTop: HUB.sectionGap }}>
                <HomeSectionHeading title={tx('დინამიკა', 'Trend')} />
                <LabParamChart points={points} />
              </View>
            ) : null}

            <View style={{ marginTop: HUB.sectionGap }}>
              <HomeSectionHeading title={ka.lab.historyByDate} />
              <View style={s.card}>
                {points
                  .slice()
                  .reverse()
                  .map((point, index) => (
                    <LabParamRow
                      key={point.date + point.panelId}
                      first={index === 0}
                      name={isTodayYmd(point.date) ? ka.common.today : formatLabDateKa(point.date)}
                      sub={formatPrintedNorm(point.param) ? tx(`ნორმა ${formatPrintedNorm(point.param)}`, `Range ${formatPrintedNorm(point.param)}`) : undefined}
                      value={point.param.value}
                      display={point.param.display}
                      unit={point.param.unit}
                      flag={point.param.flag}
                      refLow={point.param.refLow}
                      refHigh={point.param.refHigh}
                      showBar={false}
                      onPress={() => router.push(`/lab/${point.date}` as never)}
                    />
                  ))}
              </View>
              <Text style={[hubText.caption, { color: M.c.text300, marginTop: 12, marginHorizontal: 4 }]}>
                {tx('ნიშანი ლაბორატორიის ფურცელზე დაბეჭდილ ნიშანს ან საცნობარო დიაპაზონს ეფუძნება, არა აპის საკუთარ ნორმებს.', 'The flag is based on the mark or reference range printed on the lab report, not on the app’s own ranges.')}
              </Text>
              <View style={{ marginTop: 6, marginHorizontal: 4 }}>
                <MedicalSourcesLink sourceIds={['labResults']} />
              </View>
            </View>
          </>
        )}
      </ScrollView>
      <LabParamExplainSheet visible={explainOpen} param={latest?.param ?? null} onClose={() => setExplainOpen(false)} />
    </View>
  );
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(Math.abs(n) >= 10 ? 1 : 2).replace(/\.0$/, '');
}

const s = StyleSheet.create({
  card: { borderRadius: HUB.cardRadius, overflow: 'hidden' },
  heroWrap: { borderRadius: HUB.cardRadius, overflow: 'hidden' },
  hero: { padding: 18, gap: 12, overflow: 'hidden' },
  glow: { position: 'absolute', width: 200, height: 200, borderRadius: 100, right: -70, top: -90 },
  ring: { position: 'absolute', borderWidth: 1, borderColor: 'rgba(199,210,254,0.16)' },
  ringOuter: { width: 240, height: 240, borderRadius: 120, right: -100, top: -110 },
  ringInner: { width: 160, height: 160, borderRadius: 80, right: -60, top: -70 },
  heroName: { fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, lineHeight: 20, color: BRAND.onHero },
  heroValueRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginTop: -4 },
  heroValue: { fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 44, lineHeight: 52, letterSpacing: -1, color: '#FFFFFF' },
  heroUnit: { fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 16, lineHeight: 22, color: BRAND.onHero, paddingBottom: 8 },
  heroPill: { marginBottom: 10, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3, backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(199,210,254,0.3)' },
  heroPillText: { fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 12.5, lineHeight: 18, color: '#FFFFFF' },
  track: { height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.16)', justifyContent: 'center' },
  band: { position: 'absolute', left: '25%', width: '50%', top: 0, bottom: 0, borderRadius: 4, backgroundColor: 'rgba(199,210,254,0.5)' },
  dot: { position: 'absolute', width: 16, height: 16, borderRadius: 8, marginLeft: -8, borderWidth: 3, borderColor: '#312E81' },
  scale: { position: 'absolute', width: 60, marginLeft: -30, textAlign: 'center', fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 11, lineHeight: 15, color: BRAND.onHero },
  heroMeta: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: 10 },
  heroMetaText: { fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 12.5, lineHeight: 18, color: '#FFFFFF', opacity: 0.85 },
  heroDelta: { fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 13, lineHeight: 19, color: '#FFFFFF' },
});
