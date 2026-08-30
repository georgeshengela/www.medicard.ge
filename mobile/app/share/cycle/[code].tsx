import React, { useCallback, useLayoutEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CycleAtmosphere,
  CycleCard,
  CycleLoading,
  CyclePrimaryButton,
} from '@/components/cycle/CycleUI';
import { ka } from '@/i18n/ka';
import { api, ApiError, type CyclePartnerPayload } from '@/lib/api';
import { cycleChipLabel } from '@/lib/cycleLabels';
import { isCycleShareCode } from '@/lib/cycleSharePending';
import { useCycleColors } from '@/theme/cycle';

export default function PartnerCycleShareScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const token = String(code || '').trim();
  const c = useCycleColors();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const router = useRouter();
  const [state, setState] = useState<'loading' | 'ready' | 'denied' | 'auth' | 'network'>('loading');
  const [payload, setPayload] = useState<CyclePartnerPayload | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: ka.cycle.partnerShare,
      headerStyle: { backgroundColor: c.cream },
      headerTintColor: c.ink,
      headerTitleStyle: { color: c.ink, fontFamily: 'NotoSansGeorgian_700Bold' },
    });
  }, [c.cream, c.ink, navigation]);

  const load = useCallback(async () => {
    setState('loading');
    setPayload(null);
    if (!isCycleShareCode(token)) {
      setState('denied');
      return;
    }
    try {
      await api.cycle.acceptShare(token);
      const data = await api.cycle.peekShare(token);
      setPayload(data);
      setState('ready');
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          setState('auth');
          return;
        }
        if (err.status === 0 || err.status === 408) {
          setState('network');
          return;
        }
      }
      setState('denied');
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (state === 'loading') return <CycleLoading />;

  const message =
    state === 'auth'
      ? ka.cycle.partnerShareNeedAuth
      : state === 'network'
        ? ka.common.networkError
        : ka.cycle.partnerShareDenied;

  return (
    <CycleAtmosphere>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: insets.bottom + 32,
        }}
      >
        {state !== 'ready' || !payload ? (
          <CycleCard>
            <Text
              style={{
                color: c.ink,
                fontFamily: 'NotoSansGeorgian_700Bold',
                fontSize: 18,
                textAlign: 'center',
              }}
            >
              {message}
            </Text>
            {state === 'network' ? (
              <View style={{ marginTop: 16 }}>
                <CyclePrimaryButton label={ka.common.retry} onPress={() => void load()} />
              </View>
            ) : null}
            {state === 'auth' ? (
              <View style={{ marginTop: 16 }}>
                <CyclePrimaryButton label={ka.common.continue} onPress={() => router.replace('/(auth)')} />
              </View>
            ) : null}
          </CycleCard>
        ) : (
          <PartnerShareBody payload={payload} />
        )}
      </ScrollView>
    </CycleAtmosphere>
  );
}

function PartnerShareBody({ payload }: { payload: CyclePartnerPayload }) {
  const c = useCycleColors();
  const empty = !payload.period && !payload.phase && !payload.fertileWindow && !payload.symptoms;

  if (empty) {
    return (
      <CycleCard>
        <Text style={{ color: c.ink, fontWeight: '700', textAlign: 'center' }}>
          {ka.cycle.partnerShareEmpty}
        </Text>
      </CycleCard>
    );
  }

  return (
    <View style={{ gap: 12 }}>
      {payload.period ? (
        <CycleCard>
          <Text style={{ color: c.muted, fontSize: 13, fontWeight: '700' }}>{ka.cycle.partnerPermPeriod}</Text>
          <Text style={{ color: c.ink, fontSize: 18, fontFamily: 'NotoSansGeorgian_700Bold', marginTop: 6 }}>
            {payload.period.inPeriod
              ? payload.period.inPeriodEstimated
                ? ka.cycle.partnerEstimatedPeriod
                : ka.cycle.partnerObservedPeriod
              : ka.cycle.partnerEstimatedNext}
          </Text>
          {payload.period.nextPeriodStart ? (
            <Text style={{ color: c.muted, marginTop: 6 }}>
              {ka.cycle.estimatedNextPeriod}: {payload.period.nextPeriodStart}
            </Text>
          ) : null}
        </CycleCard>
      ) : null}
      {payload.phase ? (
        <CycleCard>
          <Text style={{ color: c.muted, fontSize: 13, fontWeight: '700' }}>{ka.cycle.partnerPermPhase}</Text>
          <Text style={{ color: c.ink, fontSize: 18, fontFamily: 'NotoSansGeorgian_700Bold', marginTop: 6 }}>
            {ka.cycle.estimatedPhase(payload.phase.phaseKa)}
          </Text>
          {payload.phase.cycleDay != null ? (
            <Text style={{ color: c.muted, marginTop: 6 }}>
              {ka.cycle.day} {payload.phase.cycleDay}
            </Text>
          ) : null}
        </CycleCard>
      ) : null}
      {payload.fertileWindow ? (
        <CycleCard>
          <Text style={{ color: c.muted, fontSize: 13, fontWeight: '700' }}>{ka.cycle.estimatedFertileTitle}</Text>
          <Text style={{ color: c.ink, marginTop: 8, fontWeight: '700' }}>
            {payload.fertileWindow.start ?? '—'} – {payload.fertileWindow.end ?? '—'}
          </Text>
          {payload.fertileWindow.ovulationDate ? (
            <Text style={{ color: c.muted, marginTop: 6 }}>
              {ka.cycle.estimatedOvulationTitle}: {payload.fertileWindow.ovulationDate}
            </Text>
          ) : null}
        </CycleCard>
      ) : null}
      {payload.symptoms ? (
        <CycleCard>
          <Text style={{ color: c.muted, fontSize: 13, fontWeight: '700' }}>{ka.cycle.partnerPermSymptoms}</Text>
          <Text style={{ color: c.ink, marginTop: 8, fontWeight: '700' }}>
            {payload.symptoms.keys.length
              ? payload.symptoms.keys.map(cycleChipLabel).join(', ')
              : '—'}
          </Text>
        </CycleCard>
      ) : null}
    </View>
  );
}
