import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { HomeSectionHeading } from '@/components/home/HomeSectionHeading';
import { LogBar } from '@/components/nutrition/NutritionUi';
import { useHomeAccent } from '@/theme/homeAccent';
import { HUB } from '@/theme/hub';
import { tx } from '@/i18n/locale';

/**
 * „ჩაწერე კვება“ — MEDIFOOD's logging bar on Home (the same one as on the hub, in the layout's accent):
 * search, barcode and photo in one field, then say / saved / every other way. Each opens the diary
 * with that method running (`/nutrition/diary?method=…`); back or save returns here. Without AI
 * (`nutritionAi` off) the photo and „თქვი“ step aside inside LogBar.
 */
export function HomeQuickLog({ first = false }: { first?: boolean }) {
  const accent = useHomeAccent();
  const router = useRouter();
  return (
    <View style={{ paddingHorizontal: HUB.gutter, marginTop: first ? 22 : HUB.sectionGap }}>
      <HomeSectionHeading title={tx('ჩაწერე კვება', 'Log food')} linkLabel={tx('დღიური', 'Diary')} onLink={() => router.push('/nutrition/diary' as never)} />
      <LogBar ink={accent.ink} fill={accent.cta} onFill={accent.onCta} />
    </View>
  );
}
