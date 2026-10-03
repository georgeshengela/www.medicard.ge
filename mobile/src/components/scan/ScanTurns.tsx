import React, { memo } from 'react';
import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native';
import { CalendarDays, ChevronRight, FileText, ScanLine, Sparkles } from 'lucide-react-native';
import { Markdown } from '@/components/ui/Markdown';
import { labRowName } from '@/lib/labNames';
import { formatLabDateKa, stripLabJson } from '@/lib/labExtract';
import type { ScanFile, ScanKind } from '@/lib/scanThread';
import type { LabParameter } from '@/types/lab';
import { MODULE_BRANDS } from '@/theme/moduleBrand';
import { useIsDark, useThemeColors } from '@/theme/colors';
import { tx } from '@/i18n/locale';
import { scanKindInfo, scanTextInk } from './scanKinds';

function useScanInk() {
  const dark = useIsDark();
  return dark ? MODULE_BRANDS.scan.ink.dark : MODULE_BRANDS.scan.ink.light;
}

/** MEDISCAN's avatar in the thread: the scan glyph in the brand ink on its tint. */
export function ScanAvatar({ size = 26 }: { size?: number }) {
  const ink = useScanInk();
  const dark = useIsDark();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2.6, alignItems: 'center', justifyContent: 'center', backgroundColor: `${ink}${dark ? '2E' : '1C'}` }}>
      <ScanLine size={size * 0.58} color={ink} strokeWidth={2.2} />
    </View>
  );
}

function Header({ title }: { title: string }) {
  const dark = useIsDark();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <ScanAvatar />
      <Text style={{ color: scanTextInk(dark), fontSize: 12, lineHeight: 16, fontFamily: 'NotoSansGeorgian_600SemiBold' }}>{title}</Text>
    </View>
  );
}

/** What the person sent: the pages or photo, the choice and their note. */
export const UploadTurn = memo(function UploadTurn({ scan, files, note, region }: { scan: ScanKind; files: ScanFile[]; note: string; region?: string }) {
  const c = useThemeColors();
  const dark = useIsDark();
  const info = scanKindInfo(scan);
  const shown = files.slice(0, 3);
  return (
    <View style={{ alignItems: 'flex-end', gap: 6, paddingLeft: 48 }}>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {shown.map((file, i) => (
          <View key={`${file.uri}:${i}`} style={{ width: 84, height: 104, borderRadius: 16, overflow: 'hidden', backgroundColor: c.bg200, alignItems: 'center', justifyContent: 'center' }}>
            {file.isPdf ? <><FileText size={24} color={c.text200} /><Text numberOfLines={2} style={{ color: c.text200, fontSize: 10, textAlign: 'center', paddingHorizontal: 6, marginTop: 4 }}>{file.name}</Text></>
              : <Image source={{ uri: file.uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />}
            {i === shown.length - 1 && files.length > shown.length ? (
              <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15,23,42,0.55)' }}>
                <Text style={{ color: '#FFFFFF', fontSize: 16, fontFamily: 'NotoSansGeorgian_700Bold' }}>+{files.length - shown.length}</Text>
              </View>
            ) : null}
          </View>
        ))}
      </View>
      <Text style={{ color: c.text300, fontSize: 12, fontFamily: 'NotoSansGeorgian_400Regular' }}>
        {info.label}{region ? ` · ${region}` : ''}{files.length > 1 ? ` · ${files.length} ${tx('გვერდი', 'pages')}` : ''}
      </Text>
      {note.trim() ? (
        <View style={{ backgroundColor: dark ? '#134E4A' : '#DDF3EF', borderRadius: 20, borderBottomRightRadius: 6, paddingHorizontal: 14, paddingVertical: 9 }}>
          <Text selectable style={{ color: dark ? '#E6FFFA' : '#0B3B37', fontSize: 14, lineHeight: 22, fontFamily: 'NotoSansGeorgian_400Regular' }}>{note}</Text>
        </View>
      ) : null}
    </View>
  );
});

/** An imaging or skin review. */
export const ResultTurn = memo(function ResultTurn({ scan, text, onOpenRecord }: { scan: 'IMAGING' | 'SKIN'; text: string; onOpenRecord: (() => void) | null }) {
  const c = useThemeColors();
  return (
    <View style={{ gap: 8 }}>
      <Header title={`MEDISCAN · ${scanKindInfo(scan).resultTitle}`} />
      <View style={{ paddingLeft: 2 }}><Markdown content={text} /></View>
      {onOpenRecord ? (
        <Pressable accessibilityRole="button" onPress={onOpenRecord} style={{ alignSelf: 'flex-start', minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text style={{ color: c.text100, fontSize: 13, fontFamily: 'NotoSansGeorgian_600SemiBold' }}>{tx('ჩემს ბარათში ნახვა', 'View in my card')}</Text>
          <ChevronRight size={16} color={c.text200} />
        </Pressable>
      ) : null}
    </View>
  );
});

const FLAG_LOOK: Record<string, { light: string; dark: string; label: () => string }> = {
  H: { light: '#B91C1C', dark: '#FCA5A5', label: () => tx('მაღალი', 'High') },
  L: { light: '#1D4ED8', dark: '#93C5FD', label: () => tx('დაბალი', 'Low') },
  N: { light: '#047857', dark: '#6EE7B7', label: () => tx('ნორმა', 'Normal') },
};

/** Lab values read from the sheet: out-of-range first, then the rest; tap one to see its history. */
export const LabTurn = memo(function LabTurn({ parameters, savedDate, analysis, explaining, onChooseDate, onExplain, onOpenParam, onOpenLab }: {
  parameters: LabParameter[]; savedDate?: string; analysis?: string; explaining: boolean;
  onChooseDate: (() => void) | null; onExplain: (() => void) | null; onOpenParam: ((key: string) => void) | null; onOpenLab: () => void;
}) {
  const c = useThemeColors();
  const dark = useIsDark();
  const ordered = [...parameters].sort((a, b) => Number(a.flag === 'N' || a.flag === 'U') - Number(b.flag === 'N' || b.flag === 'U'));
  const outOfRange = parameters.filter(p => p.flag === 'H' || p.flag === 'L').length;
  return (
    <View style={{ gap: 10 }}>
      <Header title={`MEDISCAN · ${scanKindInfo('LAB').resultTitle}`} />
      {parameters.length ? (
        <>
          <Text style={{ color: c.text100, fontSize: 15, lineHeight: 23, fontFamily: 'NotoSansGeorgian_600SemiBold' }}>
            {outOfRange
              ? tx(`${parameters.length} მაჩვენებელი წავიკითხე · ${outOfRange} ნორმის გარეთაა`, `Read ${parameters.length} values · ${outOfRange} outside the range`)
              : tx(`${parameters.length} მაჩვენებელი წავიკითხე · ყველა ნორმაშია`, `Read ${parameters.length} values · all within range`)}
          </Text>
          <View style={{ borderRadius: 20, backgroundColor: c.surface, overflow: 'hidden' }}>
            {ordered.map((p, i) => {
              const look = FLAG_LOOK[p.flag];
              const color = look ? (dark ? look.dark : look.light) : c.text300;
              return (
                <Pressable key={p.key} accessibilityRole="button" disabled={!onOpenParam} onPress={() => onOpenParam?.(p.key)}
                  style={{ minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderTopColor: c.bg200 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={{ color: c.text100, fontSize: 14, lineHeight: 20, fontFamily: 'NotoSansGeorgian_600SemiBold' }}>{labRowName(p)}</Text>
                    {p.refLow != null || p.refHigh != null ? (
                      <Text style={{ color: c.text300, fontSize: 11.5, lineHeight: 16, fontFamily: 'NotoSansGeorgian_400Regular' }}>{tx('ნორმა', 'Range')} {p.refLow ?? ''}–{p.refHigh ?? ''} {p.unit}</Text>
                    ) : null}
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ color: look && p.flag !== 'N' ? color : c.text100, fontSize: 15, fontFamily: 'NotoSansGeorgian_700Bold' }}>{p.display} <Text style={{ color: c.text300, fontSize: 11.5, fontFamily: 'NotoSansGeorgian_400Regular' }}>{p.unit}</Text></Text>
                    {look && p.flag !== 'N' ? <Text style={{ color, fontSize: 11, fontFamily: 'NotoSansGeorgian_600SemiBold' }}>{look.label()}</Text> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
          {savedDate ? (
            <Text style={{ color: c.text200, fontSize: 12.5, fontFamily: 'NotoSansGeorgian_400Regular' }}>{tx(`შენახულია ლაბორატორიაში · ${formatLabDateKa(savedDate)}`, `Saved in lab results · ${formatLabDateKa(savedDate)}`)}</Text>
          ) : onChooseDate ? (
            <Pressable accessibilityRole="button" onPress={onChooseDate} style={{ alignSelf: 'flex-start', minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <CalendarDays size={16} color={c.text100} />
              <Text style={{ color: c.text100, fontSize: 13, fontFamily: 'NotoSansGeorgian_600SemiBold' }}>{tx('აირჩიე ანალიზის თარიღი შესანახად', 'Choose the test date to save')}</Text>
            </Pressable>
          ) : null}
          {analysis ? <View style={{ paddingLeft: 2 }}><Markdown content={stripLabJson(analysis)} /></View> : onExplain ? (
            <Pressable accessibilityRole="button" onPress={onExplain} disabled={explaining}
              style={{ minHeight: 48, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#0D9488', opacity: explaining ? 0.65 : 1 }}>
              {explaining ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Sparkles size={17} color="#FFFFFF" />}
              <Text style={{ color: '#FFFFFF', fontSize: 14, fontFamily: 'NotoSansGeorgian_700Bold' }}>{explaining ? tx('Medi წერს ახსნას…', 'Medi is writing…') : tx('ამიხსენი შედეგები', 'Explain my results')}</Text>
            </Pressable>
          ) : null}
          <Pressable accessibilityRole="button" onPress={onOpenLab} style={{ alignSelf: 'flex-start', minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={{ color: c.text100, fontSize: 13, fontFamily: 'NotoSansGeorgian_600SemiBold' }}>{tx('ყველა ანალიზი და დინამიკა', 'All lab results and trends')}</Text>
            <ChevronRight size={16} color={c.text200} />
          </Pressable>
        </>
      ) : (
        <Text style={{ color: c.text200, fontSize: 14, lineHeight: 22, fontFamily: 'NotoSansGeorgian_400Regular' }}>
          {tx('მაჩვენებლები ვერ წავიკითხე. სცადე უფრო ნათელი ფოტო ან PDF.', "I couldn't read any values. Try a brighter photo or the PDF.")}
        </Text>
      )}
    </View>
  );
});

/** While a file is being read: the stage in words, beside the scan avatar. */
export function ScanProgress({ label }: { label: string }) {
  const c = useThemeColors();
  return (
    <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <ScanAvatar />
      <Text style={{ color: c.text200, fontSize: 14, fontFamily: 'NotoSansGeorgian_400Regular' }}>{label}</Text>
      <ActivityIndicator size="small" color={MODULE_BRANDS.scan.gradient[1]} />
    </View>
  );
}
