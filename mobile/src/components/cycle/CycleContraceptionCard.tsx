import React from 'react';
import { Text, View } from 'react-native';
import type { CycleBundle } from '@/lib/api';
import { showContraceptionContextCard } from '@/lib/cycleContraception';
import { ka } from '@/i18n/ka';
import { useCycleColors } from '@/theme/cycle';

export function CycleContraceptionCard({ bundle }: { bundle: CycleBundle }) {
  const c = useCycleColors();
  if (!showContraceptionContextCard(bundle)) return null;
  const kind = bundle.contraception?.presentation.contextKind;
  const fam = bundle.contraception?.presentation.famNotCertified;
  const body =
    kind === 'limited'
      ? ka.cycle.contraceptionLimitedCard
      : fam
        ? ka.cycle.contraceptionFamWarn
        : ka.cycle.contraceptionCautionCard;

  return (
    <View
      style={{
        backgroundColor: c.card,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: c.border,
        padding: 16,
        marginBottom: 16,
      }}
    >
      <Text
        style={{
          color: c.ink,
          fontFamily: 'NotoSansGeorgian_700Bold',
          fontSize: 14,
          marginBottom: 8,
        }}
      >
        {ka.cycle.contraceptionTitle}
      </Text>
      <Text style={{ color: c.muted, fontSize: 13, lineHeight: 19, fontFamily: 'NotoSansGeorgian_400Regular' }}>
        {body}
      </Text>
    </View>
  );
}
