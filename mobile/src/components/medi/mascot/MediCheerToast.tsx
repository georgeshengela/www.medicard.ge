import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
import { tx } from '@/i18n/locale';
import { useThemeColors } from '@/theme/colors';
import { MediMascot } from './MediMascot';

const SHOW_MS = 2600;

type Cheer = { key: number; allDone: boolean };

/**
 * MEDIPILL: Medi cheers when a dose is marked taken, and jumps when that was the last dose of the day.
 * Only ever positive — a skipped or missed dose shows nothing (no guilt, never `sad`).
 * `cheer(allDone)` from the tap handler; render `node` once near the bottom of the screen.
 */
export function useMediCheer({ bottom }: { bottom: number }) {
  const [cheer, setCheer] = useState<Cheer | null>(null);
  const seq = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const show = useCallback((allDone: boolean) => {
    seq.current += 1;
    setCheer({ key: seq.current, allDone });
    AccessibilityInfo.announceForAccessibility(allDone ? allDoneText() : takenText());
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCheer(null), SHOW_MS + (allDone ? 600 : 0));
  }, []);

  const node = cheer ? <CheerToast key={cheer.key} allDone={cheer.allDone} bottom={bottom} /> : null;
  return { cheer: show, node };
}

const takenText = () => tx('მიღებულია. ყოჩაღ!', 'Taken. Nice one!');
const allDoneText = () => tx('დღევანდელი ყველა დოზა მიღებულია!', 'Every dose for today is taken!');

function CheerToast({ allDone, bottom }: { allDone: boolean; bottom: number }) {
  const c = useThemeColors();
  return (
    <Animated.View
      entering={FadeInDown.duration(220)}
      exiting={FadeOut.duration(200)}
      pointerEvents="none"
      style={{ position: 'absolute', left: 20, right: 20, bottom, alignItems: 'center' }}
    >
      <View
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 8, paddingRight: 18, paddingVertical: 6, borderRadius: 22, backgroundColor: c.surface, borderWidth: 1, borderColor: c.bg300, maxWidth: 360 }}
      >
        {/* the full crop: Medi leaves the ground in both */}
        <MediMascot mood={allDone ? 'jump' : 'cheer'} size={allDone ? 84 : 76} />
        <Text style={{ flexShrink: 1, color: c.text100, fontSize: 14, lineHeight: 21, fontFamily: 'NotoSansGeorgian_600SemiBold' }}>
          {allDone ? allDoneText() : takenText()}
        </Text>
      </View>
    </Animated.View>
  );
}
