import { CyclePressable as Pressable } from '@/components/cycle/CyclePressable';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { Lock } from 'lucide-react-native';
import { CycleLoading } from '@/components/cycle/CycleUI';
import { ka } from '@/i18n/ka';
import { onReturnToForeground } from '@/lib/appForeground';
import { requireCycleUnlock } from '@/lib/cyclePrivacy';
import { isCyclePrivacyLockEnabled } from '@/lib/cycleReminderPrefs';
import { useCycleColors } from '@/theme/cycle';
import { useStackMotion } from '@/hooks/useStackMotion';

/**
 * The cycle lock (Face ID / passcode) runs when the cycle stack opens and when the app comes back from
 * the background — never on a plain refocus (back from Medi, a sheet, another tab), which used to remount
 * the whole stack behind a spinner, drop the open sub-page and ask for Face ID every time. After the first
 * unlock the stack stays mounted; a re-check covers it until it passes.
 */
function CyclePrivacyGate({ children }: { children: React.ReactNode }) {
  const c = useCycleColors();
  const [state, setState] = useState<'loading' | 'locked' | 'unlocked'>('loading');
  /** Unlocked once: from then on the children stay mounted under any cover. */
  const [opened, setOpened] = useState(false);
  const alive = useRef(true);
  const checking = useRef(false);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const check = useCallback(async () => {
    if (checking.current) return;
    checking.current = true;
    setState('loading');
    try {
      const ok = await requireCycleUnlock().catch(() => false);
      if (!alive.current) return;
      if (ok) setOpened(true);
      setState(ok ? 'unlocked' : 'locked');
    } finally {
      checking.current = false;
    }
  }, []);

  useEffect(() => {
    void check();
  }, [check]);

  // Back from the background (not iOS inactive → active, which Face ID itself causes): lock again if on.
  useEffect(
    () =>
      onReturnToForeground(() => {
        void isCyclePrivacyLockEnabled()
          .then((on) => {
            if (on && alive.current) void check();
          })
          .catch(() => undefined);
      }),
    [check],
  );

  const cover =
    state === 'loading' ? (
      <CycleLoading />
    ) : state === 'locked' ? (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          padding: 32,
          backgroundColor: c.cream,
        }}
      >
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: 24,
            backgroundColor: c.accentSoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Lock size={32} color={c.rose} strokeWidth={2} />
        </View>
        <Text
          style={{
            color: c.ink,
            fontSize: 20,
            fontFamily: 'NotoSansGeorgian_700Bold',
            marginTop: 20,
            textAlign: 'center',
          }}
        >
          {ka.cycle.privacyLockTitle}
        </Text>
        <Pressable
          onPress={check}
          style={{
            marginTop: 24,
            backgroundColor: c.cta,
            paddingHorizontal: 28,
            paddingVertical: 14,
            borderRadius: 16,
          }}
        >
          <Text style={{ color: c.onPrimary, fontFamily: 'NotoSansGeorgian_700Bold' }}>{ka.cycle.privacyUnlock}</Text>
        </Pressable>
      </View>
    ) : null;

  if (!opened) return cover ?? <>{children}</>;

  return (
    <View style={{ flex: 1 }}>
      {children}
      {cover ? (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: c.cream }]} accessibilityViewIsModal>
          {cover}
        </View>
      ) : null}
    </View>
  );
}

export default function CycleLayout() {
  const motion = useStackMotion();
  const c = useCycleColors();
  return (
    <CyclePrivacyGate>
      <Stack screenOptions={{ headerBackTitle: ka.common.back, contentStyle: { backgroundColor: c.cream }, ...motion }} />
    </CyclePrivacyGate>
  );
}
