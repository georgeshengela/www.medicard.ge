import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Stethoscope } from 'lucide-react-native';
import { HomeSectionHeading } from '@/components/home/HomeSectionHeading';
import { HubLinkRow } from '@/components/home/HubTiles';
import { ScanLens } from '@/components/scan/ScanLens';
import { scanKindInfo } from '@/components/scan/scanKinds';
import { tx } from '@/i18n/locale';
import type { ScanKind } from '@/lib/scanThread';
import { MODULE_BRANDS } from '@/theme/moduleBrand';
import { HUB } from '@/theme/hub';

const BRAND = MODULE_BRANDS.scan;
const PARAM: Record<ScanKind, string> = { LAB: 'lab', IMAGING: 'imaging', SKIN: 'skin' };

/**
 * MEDISCAN on Home (owner 2026-10-04: its own section, beautiful and handy). One compact hero card
 * in the module's cyan — the glass lens, what it reads in one line, and a glass chip per choice
 * (lab sheet, imaging, skin) that opens /scan with that choice already picked; a tap anywhere else
 * opens the chat with the choice open. Each chip follows its own admin switch. Symptoms keep a quiet
 * row under the card, so the AI check-ups stay in one place. Nothing is sent from here: the scan
 * screen's own AI consent and upload flow is the only path.
 */
export function HomeScanSection({ kinds, symptomsOn }: { kinds: ScanKind[]; symptomsOn: boolean }) {
  const router = useRouter();
  if (!kinds.length && !symptomsOn) return null;
  const open = (kind?: ScanKind) => router.push((kind ? `/scan?type=${PARAM[kind]}` : '/scan') as never);

  return (
    <View style={s.section}>
      {kinds.length ? (
        <HomeSectionHeading title="MEDISCAN" brand="scan" />
      ) : (
        <HomeSectionHeading title={tx('შემოწმება AI-სთან', 'Check with AI')} />
      )}
      {kinds.length ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tx('MEDISCAN — ანალიზის, გამოსახულების ან კანის ფოტოს წაკითხვა', 'MEDISCAN — read a lab sheet, an imaging scan or a skin photo')}
          onPress={() => open()}
          style={s.cardWrap}
        >
          <LinearGradient colors={[BRAND.gradient[0], '#0E7490', BRAND.gradient[1]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.card}>
            {/* Corner glow and two thin rings — the module hero's light, kept small. */}
            <View pointerEvents="none" style={[s.glow, { backgroundColor: BRAND.glow }]} />
            <View pointerEvents="none" style={[s.ring, s.ringOuter]} />
            <View pointerEvents="none" style={[s.ring, s.ringInner]} />
            <View style={s.top}>
              <View style={s.lens}>
                <ScanLens size={34} />
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Text numberOfLines={1} style={s.title}>{tx('გადაიღე ან ატვირთე', 'Snap or upload')}</Text>
                <Text numberOfLines={2} style={[s.sub, { color: BRAND.onHero }]}>{tx('Medi წაიკითხავს და აგიხსნის', 'Medi reads it and explains')}</Text>
              </View>
            </View>
            <View style={s.chips}>
              {kinds.map((kind) => {
                const info = scanKindInfo(kind);
                const Icon = info.icon;
                return (
                  <Pressable
                    key={kind}
                    accessibilityRole="button"
                    accessibilityLabel={tx(`MEDISCAN — ${info.label}`, `MEDISCAN — ${info.label}`)}
                    hitSlop={4}
                    onPress={() => open(kind)}
                    style={s.chip}
                  >
                    <Icon size={18} color="#FFFFFF" strokeWidth={1.9} />
                    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={s.chipText}>
                      {info.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </LinearGradient>
        </Pressable>
      ) : null}
      {symptomsOn ? (
        <HubLinkRow
          icon={Stethoscope}
          ink="teal"
          title={tx('სიმპტომები', 'Symptoms')}
          detail={tx('აღწერე, რა და სად გაწუხებს', 'Describe what bothers you and where')}
          href="/symptoms"
          style={kinds.length ? { marginTop: 10 } : undefined}
        />
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  section: { paddingHorizontal: HUB.gutter, marginTop: HUB.sectionGap },
  cardWrap: { borderRadius: HUB.cardRadius, overflow: 'hidden' },
  card: { padding: 14, gap: 12, overflow: 'hidden' },
  glow: { position: 'absolute', width: 180, height: 180, borderRadius: 90, right: -60, top: -80 },
  ring: { position: 'absolute', borderWidth: 1, borderColor: 'rgba(207,250,254,0.16)' },
  ringOuter: { width: 220, height: 220, borderRadius: 110, right: -90, top: -100 },
  ringInner: { width: 150, height: 150, borderRadius: 75, right: -55, top: -65 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  lens: { width: 58, height: 58, alignItems: 'center', justifyContent: 'center', marginVertical: -6, marginLeft: -6 },
  title: { fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 16, lineHeight: 22, color: '#FFFFFF' },
  sub: { fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 12.5, lineHeight: 17 },
  chips: { flexDirection: 'row', gap: 6 },
  chip: {
    flex: 1,
    minHeight: 58,
    borderRadius: 16,
    paddingHorizontal: 2,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: 'rgba(8,51,68,0.42)',
    borderWidth: 1,
    borderColor: 'rgba(207,250,254,0.22)',
  },
  chipText: { fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 11.5, lineHeight: 16, letterSpacing: -0.1, color: '#FFFFFF', textAlign: 'center' },
});
