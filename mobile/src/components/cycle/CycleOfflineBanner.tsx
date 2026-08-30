import React from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { ka } from '@/i18n/ka';
import {
  formatCycleCachedAtKa,
  type CycleAttentionItem,
  type CycleSyncState,
  type CycleView,
} from '@/lib/cycleOffline';
import { useCycleColors } from '@/theme/cycle';

type Props = {
  view: Pick<
    CycleView,
    'stale' | 'reachable' | 'cachedAt' | 'syncState' | 'pendingCount' | 'attention'
  > | null;
  today: string;
  onRetry?: () => void;
  onDiscard?: (id: string) => void;
};

function statusLabel(state: CycleSyncState, pending: number): string | null {
  if (state === 'saving') return ka.cycle.syncSaving;
  if (state === 'saved_offline' || (pending > 0 && state !== 'sync_failed' && state !== 'auth_paused')) {
    return ka.cycle.syncSavedOffline;
  }
  if (state === 'sync_needed') return ka.cycle.syncNeeded;
  if (state === 'sync_failed') return ka.cycle.syncFailed;
  if (state === 'auth_paused') return ka.cycle.syncAuthPaused;
  return null;
}

export function CycleOfflineBanner({ view, today, onRetry, onDiscard }: Props) {
  const c = useCycleColors();
  if (!view) return null;
  const attention = view.attention ?? [];
  const showStale = view.reachable === false;
  const status = statusLabel(view.syncState, view.pendingCount);
  if (!showStale && !status && attention.length === 0) return null;
  const when = formatCycleCachedAtKa(view.cachedAt, today);
  const dates = [...new Set(attention.map((item) => item.date).filter(Boolean))].join(', ');

  const confirmDiscard = (item: CycleAttentionItem) => {
    Alert.alert(ka.cycle.discardPending, ka.cycle.discardPendingConfirm, [
      { text: ka.common.cancel, style: 'cancel' },
      {
        text: ka.cycle.discardPending,
        style: 'destructive',
        onPress: () => onDiscard?.(item.id),
      },
    ]);
  };

  return (
    <View
      style={{
        marginHorizontal: 16,
        marginBottom: 10,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 14,
        backgroundColor: c.card,
        borderWidth: 1,
        borderColor: c.border,
        gap: 4,
      }}
    >
      {showStale ? (
        <Text style={{ color: c.ink, fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 13 }}>
          {ka.cycle.offlineBanner}
        </Text>
      ) : null}
      {when ? (
        <Text style={{ color: c.muted, fontSize: 12, lineHeight: 17 }}>
          {ka.cycle.offlineShowingStale(when)}
        </Text>
      ) : null}
      {showStale ? (
        <Text style={{ color: c.muted, fontSize: 12, lineHeight: 17 }}>{ka.cycle.offlineRefreshHint}</Text>
      ) : null}
      {status ? (
        <Text style={{ color: c.brand, fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 12 }}>
          {status}
        </Text>
      ) : null}
      {attention.length > 0 ? (
        <>
          <Text style={{ color: c.danger, fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 12 }}>
            {ka.cycle.syncAttention(attention.length)}
          </Text>
          {dates ? (
            <Text style={{ color: c.muted, fontSize: 12 }}>{ka.cycle.syncAttentionDates(dates)}</Text>
          ) : null}
        </>
      ) : null}
      {onRetry && (view.stale || view.pendingCount > 0 || view.syncState === 'sync_failed') ? (
        <Pressable
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel={ka.cycle.retry}
          style={{ minHeight: 36, justifyContent: 'center', alignSelf: 'flex-start' }}
        >
          <Text style={{ color: c.brand, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 13 }}>
            {ka.cycle.retry}
          </Text>
        </Pressable>
      ) : null}
      {onDiscard && attention[0] ? (
        <Pressable
          onPress={() => confirmDiscard(attention[0])}
          accessibilityRole="button"
          accessibilityLabel={ka.cycle.discardPending}
          style={{ minHeight: 36, justifyContent: 'center', alignSelf: 'flex-start' }}
        >
          <Text style={{ color: c.danger, fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 13 }}>
            {ka.cycle.discardPending}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
