import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Droplet } from 'lucide-react-native';
import { MedicalSourcesLink } from '@/components/health/MedicalSourcesLink';
import { tx } from '@/i18n/locale';
import { cycleHexAlpha, useCycleColors } from '@/theme/cycle';
import { HUB, hubText } from '@/theme/hub';

/** The card's copy (ACOG's heavy-menstrual-bleeding signs), shared by the cycle screen and Home. */
export function heavyBleedingCopy() {
  return {
    title: tx('ძლიერი ან ხანგრძლივი სისხლდენა', 'Heavy or long bleeding'),
    body: tx(
      'თუ საფენი ან ტამპონი რამდენიმე საათის განმავლობაში ყოველ საათში ივსება, კოლტები მონეტაზე დიდია, ან სისხლდენა 7 დღეზე მეტ ხანს გრძელდება — ესაუბრე ექიმს.',
      'If a pad or tampon soaks through every hour for several hours, clots are larger than a coin, or bleeding lasts more than 7 days — talk to your doctor.',
    ),
  };
}

/**
 * Calm heavy-bleeding card (brief §9 item 15). Shown only while `showHeavyBleedingCard` holds:
 * ≥ 3 consecutive heavy days or a bleeding run longer than 7 days. Rose is the bleeding colour, not a
 * warning — the `danger` tokens are never used here, and the text is advice to talk to a doctor, not a
 * diagnosis.
 * `card` = a flat hub card on the cycle overview; `inset` = a soft block inside the Home hero.
 */
export function CycleHeavyBleedingCard({
  variant = 'card',
  showSources = true,
}: {
  variant?: 'card' | 'inset';
  /** false = the host already lists `heavyMenstrualBleeding` in its own sources link (Home hero). */
  showSources?: boolean;
}) {
  const c = useCycleColors();
  const copy = heavyBleedingCopy();
  const inset = variant === 'inset';
  return (
    <View
      accessibilityRole="summary"
      accessibilityLabel={`${copy.title}. ${copy.body}`}
      style={[inset ? s.inset : s.card, { backgroundColor: inset ? c.cardSoft : c.card }, inset && !showSources ? { paddingBottom: 14 } : null]}
    >
      <View style={s.row}>
        <View style={[s.tile, { backgroundColor: cycleHexAlpha(c.period, inset ? 0.12 : 0.1) }]}>
          <Droplet size={19} color={c.period} strokeWidth={2} fill={c.period} />
        </View>
        <Text style={[hubText.cardTitle, s.title, { color: c.ink }]}>{copy.title}</Text>
      </View>
      <Text style={[hubText.body, { color: c.muted }]}>{copy.body}</Text>
      {showSources ? <MedicalSourcesLink sourceIds={['heavyMenstrualBleeding']} tint={c.muted} /> : null}
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: HUB.cardRadius, padding: HUB.cardPad, gap: 10 },
  inset: { borderRadius: 18, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 4, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tile: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, minWidth: 0 },
});
