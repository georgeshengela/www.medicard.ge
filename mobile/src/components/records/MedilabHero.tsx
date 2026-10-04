import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight, FlaskConical } from 'lucide-react-native';
import { tx } from '@/i18n/locale';
import { formatYmd } from '@/lib/format';
import { isTodayYmd } from '@/lib/labExtract';
import { labRowName } from '@/lib/labNames';
import type { LabPanel, LabParameter } from '@/types/lab';
import { MODULE_BRANDS } from '@/theme/moduleBrand';
import { HUB } from '@/theme/hub';
import { rangePosition } from '@/components/lab/MedilabUI';

const BRAND = MODULE_BRANDS.lab;
/** Out-of-range marker: warm amber reads as „look here“ on the indigo without shouting like red. */
const ATTENTION = '#FCD34D';
const MAX_ROWS = 3;

type Row = { key: string; name: string; display: string; unit: string; flag: LabParameter['flag']; at: number };

/**
 * MEDILAB's one hero card: the latest lab sheet as reference-range bars — the soft band is the normal
 * range, the dot is her value (amber when outside it). Values outside the range come first. The whole
 * card opens /lab; without any lab values yet it invites the first upload instead.
 */
export function MedilabHero({ panels, onOpenLab, onUpload, openLabel = tx('ყველა', 'All') }: {
  panels: LabPanel[];
  onOpenLab: () => void;
  /** Label of the small pill in the corner (where the tap leads). */
  openLabel?: string;
  /** Omitted when lab reading is paused from admin. */
  onUpload?: () => void;
}) {
  const latest = useMemo(() => latestPanel(panels), [panels]);
  const rows = useMemo(() => (latest ? heroRows(latest.parameters) : []), [latest]);

  if (!latest && !onUpload) return null;

  if (!latest) {
    return (
      <HeroShell
        onPress={onUpload!}
        label={tx('ატვირთე პირველი ანალიზი', 'Upload your first lab test')}
      >
        <View style={s.emptyTop}>
          <View style={s.flask}>
            <FlaskConical size={22} color="#FFFFFF" strokeWidth={1.9} />
          </View>
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Text style={s.title}>{tx('ატვირთე პირველი ანალიზი', 'Upload your first lab test')}</Text>
            <Text style={[s.sub, { color: BRAND.onHero }]}>
              {tx('Medi წაიკითხავს და აქ ნორმასთან შედარებით გაჩვენებს', 'Medi reads it and shows each value against its normal range here')}
            </Text>
          </View>
        </View>
        <PreviewBars />
      </HeroShell>
    );
  }

  const params = latest.parameters;
  const outside = params.filter((p) => p.flag === 'H' || p.flag === 'L').length;
  const when = isTodayYmd(latest.date) ? tx('დღეს', 'today') : formatYmd(latest.date);

  return (
    <HeroShell
      onPress={onOpenLab}
      label={tx(
        `ბოლო ანალიზი, ${when}: ${params.length} მაჩვენებელი, ${outside} ნორმის გარეთ`,
        `Latest lab test, ${when}: ${params.length} values, ${outside} outside the range`,
      )}
    >
      <View style={s.head}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={s.title}>{tx('ბოლო ანალიზი', 'Latest lab test')} · {when}</Text>
          <Text numberOfLines={1} style={[s.sub, { color: BRAND.onHero }]}>
            {outside
              ? tx(`${params.length} მაჩვენებელი · ${outside} ნორმის გარეთ`, `${params.length} values · ${outside} outside the range`)
              : tx(`${params.length} მაჩვენებელი · ყველა ნორმაშია`, `${params.length} values · all in range`)}
          </Text>
        </View>
        <View style={s.more}>
          <Text style={s.moreText}>{openLabel}</Text>
          <ChevronRight size={15} color="#FFFFFF" strokeWidth={2.4} />
        </View>
      </View>
      {rows.length ? (
        <View style={s.rows}>
          {rows.map((row) => (
            <View key={row.key} style={s.row}>
              <Text numberOfLines={1} style={s.name}>{row.name}</Text>
              <RangeBar at={row.at} attention={row.flag === 'H' || row.flag === 'L'} />
              <Text numberOfLines={1} style={[s.value, (row.flag === 'H' || row.flag === 'L') && { color: ATTENTION }]}>
                {row.display}
                <Text style={s.unit}> {row.unit}</Text>
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </HeroShell>
  );
}

function HeroShell({ children, onPress, label }: { children: React.ReactNode; onPress: () => void; label: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={s.wrap}>
      <LinearGradient colors={BRAND.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.card}>
        {/* Corner glow and two thin rings — the module hero's light, kept small. */}
        <View pointerEvents="none" style={[s.glow, { backgroundColor: BRAND.glow }]} />
        <View pointerEvents="none" style={[s.ring, s.ringOuter]} />
        <View pointerEvents="none" style={[s.ring, s.ringInner]} />
        {children}
      </LinearGradient>
    </Pressable>
  );
}

/** Track = the scale, soft band = the normal range (middle half), dot = the value. */
function RangeBar({ at, attention }: { at: number; attention: boolean }) {
  return (
    <View style={s.track}>
      <View style={s.band} />
      <View style={[s.dot, { left: `${at * 100}%`, backgroundColor: attention ? ATTENTION : '#FFFFFF' }]} />
    </View>
  );
}

/** Three quiet sample bars for the empty card, so the promise is visible before the first upload. */
function PreviewBars() {
  return (
    <View style={[s.rows, { opacity: 0.55 }]} accessible={false}>
      {[0.32, 0.58, 0.82].map((at) => (
        <View key={at} style={s.row}>
          <View style={s.ghostName} />
          <RangeBar at={at} attention={at > 0.75} />
          <View style={s.ghostValue} />
        </View>
      ))}
    </View>
  );
}

function latestPanel(panels: LabPanel[]): LabPanel | null {
  const usable = panels.filter((panel) => panel.parameters?.length);
  if (!usable.length) return null;
  return [...usable].sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || '').localeCompare(a.createdAt || ''))[0];
}

/** Values with a full reference range, outside-the-range first, at most three. */
function heroRows(params: LabParameter[]): Row[] {
  const ranged = params.filter((p) => Number.isFinite(p.value) && p.refLow != null && p.refHigh != null && p.refHigh > p.refLow);
  const ordered = [
    ...ranged.filter((p) => p.flag === 'H' || p.flag === 'L'),
    ...ranged.filter((p) => p.flag !== 'H' && p.flag !== 'L'),
  ];
  return ordered.slice(0, MAX_ROWS).map((p) => ({
    key: p.key,
    name: labRowName(p),
    display: p.display || String(p.value),
    unit: p.unit,
    flag: p.flag,
    at: rangePosition(p.value, p.refLow as number, p.refHigh as number),
  }));
}

const s = StyleSheet.create({
  wrap: { borderRadius: HUB.cardRadius, overflow: 'hidden' },
  card: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16, gap: 14, overflow: 'hidden' },
  glow: { position: 'absolute', width: 200, height: 200, borderRadius: 100, right: -70, top: -90 },
  ring: { position: 'absolute', borderWidth: 1, borderColor: 'rgba(199,210,254,0.16)' },
  ringOuter: { width: 240, height: 240, borderRadius: 120, right: -100, top: -110 },
  ringInner: { width: 160, height: 160, borderRadius: 80, right: -60, top: -70 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  emptyTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flask: {
    width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(30,27,75,0.35)', borderWidth: 1, borderColor: 'rgba(199,210,254,0.25)',
  },
  title: { fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 16, lineHeight: 22, color: '#FFFFFF' },
  sub: { fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 12.5, lineHeight: 17 },
  more: {
    flexDirection: 'row', alignItems: 'center', gap: 2, height: 30, paddingLeft: 12, paddingRight: 8, borderRadius: 15,
    backgroundColor: 'rgba(30,27,75,0.35)', borderWidth: 1, borderColor: 'rgba(199,210,254,0.22)',
  },
  moreText: { fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 12, lineHeight: 16, color: '#FFFFFF' },
  rows: { gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { width: 104, fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 13, lineHeight: 18, color: '#FFFFFF' },
  track: { flex: 1, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.16)', justifyContent: 'center' },
  band: { position: 'absolute', left: '25%', width: '50%', top: 0, bottom: 0, borderRadius: 3, backgroundColor: 'rgba(199,210,254,0.5)' },
  dot: {
    position: 'absolute', width: 12, height: 12, borderRadius: 6, marginLeft: -6,
    borderWidth: 2, borderColor: '#312E81',
  },
  value: { minWidth: 76, textAlign: 'right', fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 13.5, lineHeight: 18, color: '#FFFFFF' },
  unit: { fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 11, color: BRAND.onHero },
  ghostName: { width: 104, height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.28)' },
  ghostValue: { width: 76, height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.28)' },
});
