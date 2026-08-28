import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  BellRing,
  Camera,
  Footprints,
  Image as ImageIcon,
  Lock,
  RotateCcw,
  ScanFace,
  ShieldCheck,
} from 'lucide-react-native';
import {
  PermissionGroup,
  PermissionSectionLabel,
  PermissionToggleRow,
} from '@/components/profile/PermissionToggleRow';
import { FIGMA_HEALTH_METRICS } from '@/constants/figmaHealthMetricsLayout';
import { ka } from '@/i18n/ka';
import {
  connectHealthConnection,
  disableBiometricLock,
  disableCyclePrivacyLock,
  disablePushConnection,
  disconnectHealthConnection,
  enableBiometricLock,
  enableCyclePrivacyLock,
  enablePushConnection,
  loadAppPermissions,
  openAppSystemSettings,
  openHealthConnectionSettings,
  requestCameraAccess,
  requestNotificationAccess,
  requestPhotosAccess,
  resetAllConnectionsAndPermissions,
  resetLocalReminders,
  type AppPermissionsSnapshot,
} from '@/lib/appPermissions';
import type { HealthConnectResult } from '@/lib/healthSync';

function explainHealthFailure(result: Extract<HealthConnectResult, { ok: false }>): string {
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
}

function openSettingsAlert(message: string, openSettings: () => Promise<void>) {
  Alert.alert(ka.permissions.openSettingsTitle, message, [
    { text: ka.common.cancel, style: 'cancel' },
    { text: ka.permissions.openSettingsAction, onPress: () => void openSettings() },
  ]);
}

export default function PermissionsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [snapshot, setSnapshot] = useState<AppPermissionsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(null), 2800);
  }, []);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  const reload = useCallback(async () => {
    try {
      const data = await loadAppPermissions();
      setSnapshot(data);
      return data;
    } catch {
      return null;
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void reload().finally(() => setLoading(false));
    }, [reload]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }, [reload]);

  const withBusy = async (id: string, fn: () => Promise<void>) => {
    setBusyId(id);
    try {
      await fn();
      await reload();
    } finally {
      setBusyId(null);
    }
  };

  const toggleHealth = async (next: boolean) => {
    if (snapshot?.health.expoGo) {
      showToast(ka.cycle.healthExpoGo);
      return;
    }
    await withBusy('health', async () => {
      if (next) {
        const result = await connectHealthConnection();
        if (!result.ok) {
          showToast(explainHealthFailure(result));
          if (result.reason === 'denied') {
            openSettingsAlert(ka.cycle.healthDenied, openHealthConnectionSettings);
          }
          throw new Error('health');
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
        showToast(ka.cycle.healthConnected);
        return;
      }
      await disconnectHealthConnection();
      showToast(ka.cycle.healthDisconnected);
    }).catch(() => undefined);
  };

  const toggleNotifications = async (next: boolean) => {
    if (next) {
      await withBusy('notifications', async () => {
        const granted = await requestNotificationAccess();
        if (!granted) {
          openSettingsAlert(ka.meds.notificationsDenied, openAppSystemSettings);
          throw new Error('notif');
        }
        const registered = await enablePushConnection();
        if (!registered) {
          showToast(ka.meds.notificationsDenied);
          throw new Error('push');
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
        showToast(ka.permissions.notificationsEnabledToast);
      }).catch(() => undefined);
      return;
    }

    Alert.alert(ka.permissions.disableNotificationsTitle, ka.permissions.disableNotificationsBody, [
      { text: ka.common.cancel, style: 'cancel' },
      {
        text: ka.permissions.disable,
        style: 'destructive',
        onPress: () =>
          void withBusy('notifications-off', async () => {
            await disablePushConnection();
            await resetLocalReminders();
            showToast(ka.permissions.notificationsDisabledToast);
          }),
      },
    ]);
  };

  const toggleCamera = async (next: boolean) => {
    if (next) {
      await withBusy('camera', async () => {
        const state = await requestCameraAccess();
        if (state !== 'granted') {
          openSettingsAlert(ka.permissions.permissionDeniedHint, openAppSystemSettings);
          throw new Error('camera');
        }
        Haptics.selectionAsync().catch(() => undefined);
      }).catch(() => undefined);
      return;
    }
    openSettingsAlert(ka.permissions.revokeInSettingsHint, openAppSystemSettings);
  };

  const togglePhotos = async (next: boolean) => {
    if (next) {
      await withBusy('photos', async () => {
        const state = await requestPhotosAccess();
        if (state !== 'granted') {
          openSettingsAlert(ka.permissions.permissionDeniedHint, openAppSystemSettings);
          throw new Error('photos');
        }
        Haptics.selectionAsync().catch(() => undefined);
      }).catch(() => undefined);
      return;
    }
    openSettingsAlert(ka.permissions.revokeInSettingsHint, openAppSystemSettings);
  };

  const toggleBiometric = async (next: boolean) => {
    if (!snapshot?.biometric.hardware) return;
    await withBusy('biometric', async () => {
      if (next) {
        if (!snapshot.biometric.enrolled) {
          showToast(ka.permissions.biometricNotEnrolled);
          throw new Error('bio');
        }
        const ok = await enableBiometricLock();
        if (!ok) throw new Error('bio');
        showToast(ka.permissions.biometricEnabledToast);
        return;
      }
      await disableBiometricLock();
      showToast(ka.permissions.biometricDisabledToast);
    }).catch(() => undefined);
  };

  const toggleCycleLock = async (next: boolean) => {
    await withBusy('cycle-lock', async () => {
      if (next) {
        await enableCyclePrivacyLock();
        showToast(ka.permissions.cycleLockEnabledToast);
        return;
      }
      await disableCyclePrivacyLock();
      showToast(ka.permissions.cycleLockDisabledToast);
    });
  };

  const confirmResetAll = () => {
    Alert.alert(ka.permissions.resetAllTitle, ka.permissions.resetAllBody, [
      { text: ka.common.cancel, style: 'cancel' },
      {
        text: ka.permissions.resetAllConfirm,
        style: 'destructive',
        onPress: () =>
          void withBusy('reset-all', async () => {
            await resetAllConnectionsAndPermissions();
            showToast(ka.permissions.resetAllToast);
          }),
      },
    ]);
  };

  const notificationsOn = snapshot?.push.permission === 'granted';

  return (
    <View style={{ flex: 1, backgroundColor: FIGMA_HEALTH_METRICS.cardBg }}>
      <View
        style={{
          paddingTop: insets.top + 4,
          paddingHorizontal: 16,
          paddingBottom: 12,
          backgroundColor: FIGMA_HEALTH_METRICS.cardBg,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            minHeight: 44,
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={ka.common.back}
            onPress={() => router.back()}
            hitSlop={10}
            style={({ pressed }) => ({
              width: 44,
              height: 44,
              alignItems: 'flex-start',
              justifyContent: 'center',
              opacity: pressed ? 0.55 : 1,
            })}
          >
            <ArrowLeft size={22} color={FIGMA_HEALTH_METRICS.textPrimary} strokeWidth={2.2} />
          </Pressable>

          <Text
            numberOfLines={1}
            style={{
              flex: 1,
              textAlign: 'right',
              fontFamily: 'NotoSansGeorgian_700Bold',
              fontSize: 17,
              lineHeight: 22,
              color: FIGMA_HEALTH_METRICS.textPrimary,
              letterSpacing: -0.2,
            }}
          >
            {ka.permissions.titleShort}
          </Text>

          <View
            style={{
              width: 44,
              height: 44,
              alignItems: 'flex-end',
              justifyContent: 'center',
            }}
          >
            <ShieldCheck size={20} color={`${FIGMA_HEALTH_METRICS.brand}55`} strokeWidth={2} />
          </View>
        </View>
      </View>

      {loading && !snapshot ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={FIGMA_HEALTH_METRICS.brand} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24, gap: 20 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={FIGMA_HEALTH_METRICS.brand} />
          }
          showsVerticalScrollIndicator={false}
        >
          {toast ? (
            <View
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 14,
                borderWidth: 1,
                borderColor: `${FIGMA_HEALTH_METRICS.brand}44`,
                paddingHorizontal: 14,
                paddingVertical: 11,
              }}
            >
              <Text
                style={{
                  fontFamily: 'NotoSansGeorgian_400Regular',
                  fontSize: 13,
                  lineHeight: 18,
                  color: FIGMA_HEALTH_METRICS.textPrimary,
                  textAlign: 'center',
                }}
              >
                {toast}
              </Text>
            </View>
          ) : null}

          <View style={{ gap: 8 }}>
            <PermissionSectionLabel title={ka.permissions.sectionConnections} />
            <PermissionGroup>
              {snapshot?.health.supported ? (
                <PermissionToggleRow
                  icon={Footprints}
                  label={
                    snapshot.health.platform === 'apple' ? ka.cycle.healthApple : ka.cycle.healthGoogle
                  }
                  value={snapshot.health.connected}
                  disabled={snapshot.health.expoGo}
                  loading={busyId === 'health'}
                  onValueChange={(next) => void toggleHealth(next)}
                />
              ) : null}
              <PermissionToggleRow
                icon={BellRing}
                iconColor="#6366F1"
                label={ka.permissions.notificationsTitle}
                value={notificationsOn}
                disabled={!snapshot?.push.device}
                loading={busyId === 'notifications' || busyId === 'notifications-off'}
                isLast
                onValueChange={(next) => void toggleNotifications(next)}
              />
            </PermissionGroup>
          </View>

          <View style={{ gap: 8 }}>
            <PermissionSectionLabel title={ka.permissions.sectionDevice} />
            <PermissionGroup>
              <PermissionToggleRow
                icon={Camera}
                iconColor="#EF4444"
                label={ka.permissions.cameraTitle}
                value={snapshot?.camera.permission === 'granted'}
                loading={busyId === 'camera'}
                onValueChange={(next) => void toggleCamera(next)}
              />
              <PermissionToggleRow
                icon={ImageIcon}
                iconColor="#8B5CF6"
                label={ka.permissions.photosTitle}
                value={snapshot?.photos.permission === 'granted'}
                loading={busyId === 'photos'}
                onValueChange={(next) => void togglePhotos(next)}
              />
              <PermissionToggleRow
                icon={ScanFace}
                iconColor="#0EA5E9"
                label={ka.permissions.biometricTitle}
                value={snapshot?.biometric.enabledInApp ?? false}
                disabled={!snapshot?.biometric.hardware}
                loading={busyId === 'biometric'}
                isLast
                onValueChange={(next) => void toggleBiometric(next)}
              />
            </PermissionGroup>
          </View>

          <View style={{ gap: 8 }}>
            <PermissionSectionLabel title={ka.permissions.sectionPrivacy} />
            <PermissionGroup>
              <PermissionToggleRow
                icon={Lock}
                iconColor="#E11D48"
                label={ka.permissions.cycleLockTitle}
                value={snapshot?.cyclePrivacyLock ?? false}
                loading={busyId === 'cycle-lock'}
                isLast
                onValueChange={(next) => void toggleCycleLock(next)}
              />
            </PermissionGroup>
          </View>

          <View style={{ gap: 8, marginTop: 4 }}>
            <PermissionSectionLabel title={ka.permissions.sectionDanger} />
            <Pressable
              accessibilityRole="button"
              onPress={confirmResetAll}
              disabled={busyId === 'reset-all'}
              style={({ pressed }) => ({
                backgroundColor: '#FFFFFF',
                borderRadius: 18,
                borderWidth: 1,
                borderColor: FIGMA_HEALTH_METRICS.border,
                overflow: 'hidden',
                opacity: pressed ? 0.92 : 1,
              })}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 14,
                  paddingVertical: 13,
                  gap: 12,
                }}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 11,
                    backgroundColor: '#FFF1F2',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {busyId === 'reset-all' ? (
                    <ActivityIndicator size="small" color="#E11D48" />
                  ) : (
                    <RotateCcw size={17} color="#E11D48" strokeWidth={2.1} />
                  )}
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text
                    style={{
                      fontFamily: 'NotoSansGeorgian_600SemiBold',
                      fontSize: 15,
                      color: FIGMA_HEALTH_METRICS.textPrimary,
                    }}
                  >
                    {ka.permissions.resetAllRowTitle}
                  </Text>
                  <Text
                    style={{
                      fontFamily: 'NotoSansGeorgian_400Regular',
                      fontSize: 12,
                      lineHeight: 16,
                      color: FIGMA_HEALTH_METRICS.textSecondary,
                    }}
                  >
                    {ka.permissions.resetAllRowHint}
                  </Text>
                </View>
              </View>
            </Pressable>
          </View>

          <Text
            style={{
              fontFamily: 'NotoSansGeorgian_400Regular',
              fontSize: 11,
              lineHeight: 16,
              color: FIGMA_HEALTH_METRICS.textSecondary,
              textAlign: 'center',
              paddingHorizontal: 20,
              opacity: 0.85,
            }}
          >
            {ka.permissions.footerHintCompact}
          </Text>
        </ScrollView>
      )}
    </View>
  );
}
