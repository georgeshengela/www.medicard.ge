import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MediCompanionFigure } from '@/components/companion/MediCompanionFigure';
import { companionApi } from '@/lib/companion/api';
import { companionCopy } from '@/lib/companion/copy';
import { peekCompanionCache, readCompanionCache, writeCompanionCache } from '@/lib/companion/cache';
import type { CompanionMoodKey, CompanionStage } from '@/lib/companion/api';
import { QUEST } from '@/theme/questTokens';
import { useIsDark, useThemeColors } from '@/theme/colors';

/**
 * Subtle Medi head near the Quest home block — opens /medi-companion.
 * Not a second dashboard card.
 */
export function HomeMediCompanionEntry({ locale = 'ka' }: { locale?: string }) {
  const router = useRouter();
  const colors = useThemeColors();
  const dark = useIsDark();
  const copy = companionCopy(locale);
  const [stage, setStage] = useState<CompanionStage | string>(() => peekCompanionCache()?.companion.stage || 'STAGE_1');
  const [mood, setMood] = useState<CompanionMoodKey | string>(() => peekCompanionCache()?.companion.moodKey || 'CALM');

  useEffect(() => {
    let alive = true;
    void (async () => {
      const cached = await readCompanionCache();
      if (alive && cached?.overview?.companion) {
        setStage(cached.overview.companion.stage);
        setMood(cached.overview.companion.moodKey);
      }
      try {
        const overview = await companionApi.overview();
        if (!alive) return;
        setStage(overview.companion.stage);
        setMood(overview.companion.moodKey);
        await writeCompanionCache(overview);
      } catch {
        /* keep cache / defaults */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        right: 16,
        top: 0,
        zIndex: 4,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={copy.homeA11y}
        onPress={() => router.push('/medi-companion' as never)}
        className="active:opacity-90"
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: dark ? QUEST.wash.dark : QUEST.wash.light,
          borderWidth: 1,
          borderColor: colors.bg300,
        }}
      >
        <MediCompanionFigure stage={stage} moodKey={mood} size={28} reducedMotion />
      </Pressable>
    </View>
  );
}
