import React from 'react';
import { Text, View } from 'react-native';
import { Heart } from 'lucide-react-native';
import {
  cycleLegendClosingLine,
  cycleLegendItems,
  type CycleLegendItem,
  type CycleLegendKey,
  type CycleLegendOptions,
} from '@/lib/cycleLegendItems';
import { cycleHexAlpha, useCycleColors } from '@/theme/cycle';

/**
 * The one cycle legend (brief §8.2 item 3, §8.4). Three surfaces, one text:
 *  - under the ring on /cycle (`look="dense"`, phases only) with the closing line,
 *  - the calendar legend (`look="card"`, marks as tiny day cells — the legend shows exactly what the cells look like),
 *  - the ring's explain sheet (`look="plain"`, phases + marks + closing line),
 *  - the Home week tray (`look="dense"`, `only` = the marks that week shows).
 * Grammar: solid rose = logged, dashed rose = expected, soft turquoise = fertile, turquoise ring =
 * ovulation, grey dot = logged, rose dot = spotting, heart = sex. Phase dots are the ring's arc colours.
 */
type Props = CycleLegendOptions & {
  look?: 'dense' | 'card' | 'plain';
  /** Append „ფოლიკულური და ლუთეალური ფაზები მხოლოდ რგოლზე იხატება“ (where the ring is shown). */
  closingLine?: boolean;
  /** Dense rows are centred by default (under the ring); the tray keeps them left-aligned. */
  align?: 'center' | 'start';
};

export function CyclePhaseLegend({ look = 'card', closingLine, align = 'center', ...opts }: Props) {
  const c = useCycleColors();
  const items = cycleLegendItems(opts);
  if (!items.length && !closingLine) return null;
  const dense = look === 'dense';
  const phases = items.filter((i) => i.kind === 'phase');
  const marks = items.filter((i) => i.kind === 'mark');

  const closing = closingLine ? (
    <Text
      style={{
        color: c.mutedSoft,
        fontFamily: 'NotoSansGeorgian_400Regular',
        fontSize: dense ? 11 : 12,
        lineHeight: dense ? 15 : 17,
        textAlign: dense && align === 'center' ? 'center' : 'left',
      }}
    >
      {cycleLegendClosingLine()}
    </Text>
  ) : null;

  if (dense) {
    return (
      <View style={{ gap: 6 }}>
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: align === 'center' ? 'center' : 'flex-start',
            alignItems: 'center',
            columnGap: 12,
            rowGap: 4,
          }}
        >
          {items.map((item) => (
            <View key={item.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <DenseMark kind={item.key} />
              <Text
                numberOfLines={1}
                style={{ color: c.mutedSoft, fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 11, lineHeight: 15 }}
              >
                {item.label}
              </Text>
            </View>
          ))}
        </View>
        {closing}
      </View>
    );
  }

  const card = look === 'card';
  return (
    <View
      style={
        card
          ? { backgroundColor: c.card, borderRadius: 22, paddingVertical: 14, paddingHorizontal: 14, gap: 12 }
          : { gap: 12 }
      }
    >
      {phases.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 6 }}>
          {phases.map((item) => (
            <View key={item.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <DenseMark kind={item.key} size={10} />
              <Text style={{ color: c.muted, fontSize: 12, lineHeight: 16, fontFamily: 'NotoSansGeorgian_500Medium' }}>{item.label}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {marks.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 12 }}>
          {marks.map((item) => (
            <View
              key={item.key}
              style={{ width: '50%', flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 24, paddingRight: 6 }}
            >
              <View style={{ width: 24, alignItems: 'center' }}>
                <MarkGlyph item={item} />
              </View>
              <Text
                style={{ color: c.muted, fontSize: 12, lineHeight: 16, flexShrink: 1, fontFamily: 'NotoSansGeorgian_500Medium' }}
              >
                {item.label}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
      {closing}
    </View>
  );
}

/** 10 pt dot: a phase takes the ring's arc colour, a mark repeats the cell grammar without the numeral. */
function DenseMark({ kind, size = 10 }: { kind: CycleLegendKey; size?: number }) {
  const c = useCycleColors();
  const base = { width: size, height: size, borderRadius: size / 2 } as const;
  switch (kind) {
    case 'periodPhase':
      return <View style={[base, { backgroundColor: c.period }]} />;
    case 'follicular':
      return <View style={[base, { backgroundColor: c.follicularFill }]} />;
    case 'fertilePhase':
      return <View style={[base, { backgroundColor: c.fertileFill }]} />;
    case 'luteal':
      return <View style={[base, { backgroundColor: c.luteal }]} />;
    case 'logged':
      return <View style={[base, { backgroundColor: c.period }]} />;
    case 'classified':
      return <View style={[base, { backgroundColor: c.period, borderWidth: 1.5, borderColor: c.white }]} />;
    case 'predicted':
      return <View style={[base, { borderWidth: 1.5, borderColor: c.period, borderStyle: 'dashed' }]} />;
    case 'fertile':
      return <View style={[base, { backgroundColor: c.fertilitySoft, borderWidth: 1, borderColor: cycleHexAlpha(c.fertile, 0.55) }]} />;
    case 'ovulation':
      return <View style={[base, { backgroundColor: c.fertilitySoft, borderWidth: 1.5, borderColor: c.fertile }]} />;
    case 'symptom':
      return <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: c.mutedSoft, marginHorizontal: (size - 4) / 2 }} />;
    case 'spotting':
      return <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: c.period, marginHorizontal: (size - 5) / 2 }} />;
    case 'sex':
      return <Heart size={size} color={c.rose} fill={c.rose} strokeWidth={0} />;
  }
}

/** A tiny calendar day — the legend shows exactly what the cells look like. */
function MarkGlyph({ item }: { item: CycleLegendItem }) {
  const c = useCycleColors();
  switch (item.key) {
    case 'logged':
      return <MiniDay fill={c.period} ink={c.onPeriod} />;
    case 'classified':
      return <MiniDay fill={c.period} ink={c.onPeriod} border={c.white} />;
    case 'predicted':
      return <MiniDay ink={c.period} border={c.period} dashed />;
    case 'fertile':
      return <MiniDay fill={c.fertilitySoft} ink={c.fertile} />;
    case 'ovulation':
      return <MiniDay fill={c.fertilitySoft} ink={c.fertile} border={c.fertile} />;
    case 'symptom':
      return (
        <View style={{ alignItems: 'center' }}>
          <Numeral color={c.ink} />
          <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: c.mutedSoft, marginTop: 1 }} />
        </View>
      );
    case 'spotting':
      return (
        <View style={{ alignItems: 'center' }}>
          <Numeral color={c.ink} />
          <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: c.period, marginTop: 1 }} />
        </View>
      );
    case 'sex':
      return (
        <View style={{ alignItems: 'center' }}>
          <Numeral color={c.ink} />
          <Heart size={8} color={c.rose} fill={c.rose} strokeWidth={0} style={{ marginTop: 1 }} />
        </View>
      );
    default:
      return <DenseMark kind={item.key} />;
  }
}

function Numeral({ color }: { color: string }) {
  return <Text style={{ color, fontSize: 10, lineHeight: 12, fontFamily: 'NotoSansGeorgian_700Bold' }}>7</Text>;
}

function MiniDay({ fill, ink, border, dashed }: { fill?: string; ink: string; border?: string; dashed?: boolean }) {
  return (
    <View
      style={{
        width: 22,
        height: 22,
        borderRadius: 11,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: fill ?? 'transparent',
        borderWidth: border ? 1.5 : 0,
        borderColor: border ?? 'transparent',
        borderStyle: dashed ? 'dashed' : 'solid',
      }}
    >
      <Numeral color={ink} />
    </View>
  );
}
