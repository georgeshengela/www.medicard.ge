import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ArrowUpRight, type LucideIcon } from 'lucide-react-native';
import { HUB, hubInk, hubText, hubTint, type HubInk } from '@/theme/hub';
import { useIsDark, useThemeColors } from '@/theme/colors';

type Props = {
  title: string;
  body: string;
  cta: string;
  onPress: () => void;
  accessibilityLabel?: string;
  /** Icon tile (surface tone) — or pass `lead` to render your own header element. */
  icon?: LucideIcon;
  ink?: HubInk;
  lead?: React.ReactNode;
  /** `spotlight` is the one dark card a page is allowed. */
  tone?: 'surface' | 'spotlight';
  /** Decorative art rendered below the CTA, bleeding to the card edges. */
  art?: React.ReactNode;
};

/**
 * The hub's feature card: lead, title, body, then a CTA row. Same bones in
 * both tones so a page can hold one spotlight and several quiet cards without
 * looking like two apps.
 */
export function HubFeatureCard({
  title,
  body,
  cta,
  onPress,
  accessibilityLabel,
  icon: Icon,
  ink = 'teal',
  lead,
  tone = 'surface',
  art,
}: Props) {
  const c = useThemeColors();
  const dark = useIsDark();
  const spotlight = tone === 'spotlight';
  const inkHex = hubInk(ink, dark);
  const textPrimary = spotlight ? '#FFFFFF' : c.text100;
  const textSecondary = spotlight ? '#C5DADA' : c.text200;
  const ctaColor = spotlight ? '#99F6E4' : c.primary100;
  const rule = spotlight ? 'rgba(255,255,255,0.14)' : c.bg300;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? `${title}. ${cta}`}
      onPress={onPress}
      style={[s.card, { backgroundColor: spotlight ? HUB.spotlightBg : c.surface }]}
    >
      <View style={s.head}>
        {lead ??
          (Icon ? (
            <View style={[s.tile, { backgroundColor: spotlight ? 'rgba(255,255,255,0.12)' : hubTint(inkHex, dark) }]}>
              <Icon size={21} color={spotlight ? '#99F6E4' : inkHex} strokeWidth={1.8} />
            </View>
          ) : null)}
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <Text style={[hubText.cardTitle, { color: textPrimary, fontSize: 16, lineHeight: 23 }]}>{title}</Text>
          <Text style={[hubText.body, { color: textSecondary }]}>{body}</Text>
        </View>
      </View>
      <View style={[s.ctaRow, { borderColor: rule }]}>
        <Text style={[hubText.link, { color: ctaColor, flex: 1 }]}>{cta}</Text>
        <ArrowUpRight size={18} color={ctaColor} />
      </View>
      {art ? (
        <View accessible={false} importantForAccessibility="no-hide-descendants" pointerEvents="none" style={s.art}>
          {art}
        </View>
      ) : null}
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: {
    borderRadius: HUB.cardRadius,
    padding: HUB.cardPad,
    overflow: 'hidden',
    gap: 14,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  tile: {
    width: HUB.tile,
    height: HUB.tile,
    borderRadius: HUB.tileRadius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
    minHeight: 44,
  },
  art: {
    marginHorizontal: -HUB.cardPad,
    marginBottom: -HUB.cardPad,
    marginTop: -2,
  },
});
