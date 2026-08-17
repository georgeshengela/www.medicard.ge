import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, Switch, Text, View } from 'react-native';
import { Activity, ExternalLink } from 'lucide-react-native';
import { CycleCard } from '@/components/cycle/CycleUI';
import { ka } from '@/i18n/ka';
import {
  connectHealthApp,
  disconnectHealthApp,
  getHealthPlatform,
  isHealthPlatformSupported,
  isHealthSyncEnabled,
  openHealthAppSettings,
  type HealthConnectResult,
} from '@/lib/healthSync';
import { cycleShadow, useCycleColors } from '@/theme/cycle';

type Props = {
  onConnected?: () => void | Promise<void>;
};

export function CycleHealthConnectCard({ onConnected }: Props) {
  const c = useCycleColors();
  const platform = getHealthPlatform();
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<'muted' | 'success' | 'error'>('muted');

  const load = useCallback(async () => {
    const on = await isHealthSyncEnabled();
    setEnabled(on);
  }, []);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  const platformLabel =
    platform === 'apple' ? ka.cycle.healthApple : platform === 'google' ? ka.cycle.healthGoogle : '';

  const explainFailure = (result: Extract<HealthConnectResult, { ok: false }>) => {
    switch (result.reason) {
      case 'denied':
        return ka.cycle.healthDenied;
      case 'not_installed':
        return ka.cycle.healthNotInstalled;
      case 'expo_go':
        return ka.cycle.healthExpoGo;
      case 'unavailable':
        return ka.cycle.healthUnavailable;
      default:
        return result.message || ka.common.error;
    }
  };

  const connect = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const result = await connectHealthApp();
      if (!result.ok) {
        setEnabled(false);
        setStatusTone('error');
        setStatus(explainFailure(result));
        return;
      }

      setEnabled(true);
      setStatusTone('success');
      setStatus(ka.cycle.healthConnected);
      await onConnected?.();
    } finally {
      setBusy(false);
    }
  };

  const onToggle = async (next: boolean) => {
    if (busy) return;
    if (!next) {
      setBusy(true);
      try {
        await disconnectHealthApp();
        setEnabled(false);
        setStatusTone('muted');
        setStatus(ka.cycle.healthDisconnected);
      } finally {
        setBusy(false);
      }
      return;
    }
    await connect();
  };

  if (!isHealthPlatformSupported()) {
    return (
      <CycleCard>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Activity size={18} color={c.muted} />
          <Text style={{ color: c.muted, marginLeft: 10, flex: 1, fontSize: 13, lineHeight: 18 }}>
            {ka.cycle.healthUnavailable}
          </Text>
        </View>
      </CycleCard>
    );
  }

  return (
    <CycleCard>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 12 }}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              backgroundColor: c.lavenderSoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Activity size={20} color={c.lavender} strokeWidth={2.1} />
          </View>
          <View style={{ marginLeft: 12, flex: 1, minWidth: 0 }}>
            <Text style={{ color: c.ink, fontWeight: '800', fontSize: 15 }}>{platformLabel}</Text>
            <Text style={{ color: c.muted, fontSize: 12, marginTop: 3, lineHeight: 16 }}>
              {ka.cycle.healthSyncOn}
            </Text>
          </View>
        </View>
        {busy ? (
          <ActivityIndicator color={c.rose} />
        ) : (
          <Switch
            value={enabled}
            onValueChange={onToggle}
            trackColor={{ true: c.blushDeep, false: c.creamDeep }}
            thumbColor="#fff"
          />
        )}
      </View>

      {enabled ? (
        <Text style={{ color: c.mutedSoft, fontSize: 12, marginTop: 12, lineHeight: 17 }}>
          {ka.cycle.healthHint}
        </Text>
      ) : null}

      {status ? (
        <Text
          style={{
            color: statusTone === 'error' ? c.danger : statusTone === 'success' ? c.success : c.muted,
            fontSize: 12,
            marginTop: 10,
            fontWeight: '700',
          }}
        >
          {status}
        </Text>
      ) : null}

      {Platform.OS === 'android' && enabled ? (
        <Pressable
          onPress={() => openHealthAppSettings().catch(() => undefined)}
          style={({ pressed }) => ({
            marginTop: 12,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: c.lavenderSoft,
            borderRadius: 14,
            paddingVertical: 12,
            opacity: pressed ? 0.85 : 1,
            ...cycleShadow.soft,
          })}
        >
          <ExternalLink size={16} color={c.ink} />
          <Text style={{ color: c.ink, fontWeight: '700', marginLeft: 8, fontSize: 13 }}>
            {ka.cycle.healthOpenSettings}
          </Text>
        </Pressable>
      ) : null}
    </CycleCard>
  );
}
