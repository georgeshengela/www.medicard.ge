import React from 'react';
import { Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { MediOrb } from '@/components/medi/MediOrb';
import { tx } from '@/i18n/locale';
import { isHrefAvailable, useFeatureState } from '@/lib/featureFlags';
import { mediRoute } from '@/lib/mediModes';
import { useThemeColors } from '@/theme/colors';

/**
 * „Ask Medi“ in a module header (owner 2026-10-04): the card and medications tabs are where „what does
 * this result mean?“ / „what is this medicine for?“ come up. Same 44 × 44 square as ModuleHeaderButton,
 * with Medi's orb instead of a line icon; hidden while Medi is paused in admin.
 */
export function MediHeaderButton() {
  const c = useThemeColors();
  const router = useRouter();
  const features = useFeatureState();
  if (!isHrefAvailable(mediRoute(), features)) return null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={tx('ჰკითხე Medi-ს', 'Ask Medi')}
      onPress={() => router.push(mediRoute() as never)}
      hitSlop={4}
      style={{ height: 44, width: 44, borderRadius: 16, backgroundColor: c.surface, justifyContent: 'center', alignItems: 'center' }}
    >
      <MediOrb size={24} />
    </Pressable>
  );
}
