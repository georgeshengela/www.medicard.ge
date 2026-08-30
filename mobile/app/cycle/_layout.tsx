import React, { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Stack, useFocusEffect } from 'expo-router';
import { Lock } from 'lucide-react-native';
import { CycleLoading } from '@/components/cycle/CycleUI';
import { ka } from '@/i18n/ka';
import { requireCycleUnlock } from '@/lib/cyclePrivacy';
import { useCycleColors } from '@/theme/cycle';

function CyclePrivacyGate({ children }: { children: React.ReactNode }) {
  const c = useCycleColors();
  const [state, setState] = useState<'loading' | 'locked' | 'unlocked'>('loading');

  const check = useCallback(async () => {
    setState('loading');
    const ok = await requireCycleUnlock();
    setState(ok ? 'unlocked' : 'locked');
  }, []);

  useFocusEffect(
    useCallback(() => {
      check();
    }, [check]),
  );

  if (state === 'loading') return <CycleLoading />;

  if (state === 'locked') {
    return (
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
            backgroundColor: c.roseSoft,
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
          <Text style={{ color: '#fff', fontFamily: 'NotoSansGeorgian_700Bold' }}>{ka.cycle.privacyUnlock}</Text>
        </Pressable>
      </View>
    );
  }

  return <>{children}</>;
}

export default function CycleLayout() {
  return (
    <CyclePrivacyGate>
      <Stack screenOptions={{ headerBackTitle: ka.common.back }} />
    </CyclePrivacyGate>
  );
}
