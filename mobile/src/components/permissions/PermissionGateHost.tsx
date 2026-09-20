import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSegments } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bell, Footprints } from 'lucide-react-native';
import {
  ProfileSetupLinkButton,
  ProfileSetupPrimaryButton,
} from '@/components/profile/ProfileSetupButtons';
import { ka } from '@/i18n/ka';
import {
  inspectDeviceAccessNeeds,
  isDeviceAccessGateFinished,
  isNativePermissionRuntime,
  markDeviceAccessGateFinished,
  resetDeviceAccessGate,
  setDeviceAccessGateBlocking,
} from '@/lib/deviceAccess';
import { connectHealthApp, preloadHealthNative } from '@/lib/healthSync';
import {
  registerPushTokenWithServer,
  requestNotificationPermission,
  setPushOptedIn,
} from '@/lib/notifications';
import { isQuestVisualSession } from '@/lib/quest/devFixture';
import { useAuth } from '@/store/AuthContext';
import { useThemeColors } from '@/theme/colors';

type GateStep = 'notifications' | 'health';

/**
 * iOS 26 only shows Allow from a tap on the main window — not from a Modal,
 * useEffect, or after getPermissionsAsync. Settings → MEDICARD AI stays at
 * Siri / Search / Mobile Data until that native request actually runs.
 */
export function PermissionGateHost() {
  const { user } = useAuth();
  return <PermissionGateForAccount key={user?.id || 'signed-out'} />;
}

function PermissionGateForAccount() {
  const { user } = useAuth();
  const segments = useSegments();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<GateStep | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false), alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const onAuth = segments[0] === '(auth)';
  const readyForGate = Boolean(user && !onAuth && !isQuestVisualSession());

  useEffect(() => {
    if (user) return;
    resetDeviceAccessGate();
    setStep(null);
  }, [user]);

  const finish = useCallback(() => {
    if (!alive.current) return;
    setStep(null);
    markDeviceAccessGateFinished();
  }, []);

  const advanceFromNotifications = useCallback(async () => {
    const needs = await inspectDeviceAccessNeeds();
    if (!alive.current) return;
    if (needs.health) {
      setStep('health');
      setDeviceAccessGateBlocking(true);
      void preloadHealthNative();
      return;
    }
    finish();
  }, [finish]);

  useEffect(() => {
    if (!readyForGate) return undefined;
    if (isDeviceAccessGateFinished()) return undefined;
    if (!isNativePermissionRuntime()) {
      markDeviceAccessGateFinished();
      return undefined;
    }

    let cancelled = false;
    void inspectDeviceAccessNeeds()
      .then((needs) => {
        if (cancelled) return;
        if (needs.notifications) {
          setStep('notifications');
          setDeviceAccessGateBlocking(true);
          return;
        }
        if (needs.health) {
          setStep('health');
          setDeviceAccessGateBlocking(true);
          void preloadHealthNative();
          return;
        }
        markDeviceAccessGateFinished();
      })
      .catch(() => {
        if (!cancelled) markDeviceAccessGateFinished();
      });

    return () => {
      cancelled = true;
    };
  }, [readyForGate, user?.id]);

  useEffect(() => {
    if (step === 'health') void preloadHealthNative();
  }, [step]);

  const enableNotifications = () => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError(null);
    void (async () => {
      try {
        const granted = await requestNotificationPermission();
        if (!alive.current) return;
        if (granted) {
          await setPushOptedIn(true);
          if (!alive.current) return;
          await registerPushTokenWithServer({ skipPermissionProbe: true }).catch(() => undefined);
          await advanceFromNotifications();
        } else setError('ნებართვა არ ჩაირთო. შეგიძლია მოგვიანებით გაააქტიურო ტელეფონის პარამეტრებიდან.');
      } catch {
        if (alive.current) setError('ნებართვა ვერ ჩაირთო. სცადე ხელახლა ან გააგრძელე მოგვიანებით.');
      } finally {
        busyRef.current = false;
        if (alive.current) setBusy(false);
      }
    })();
  };

  const enableHealth = () => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError(null);
    void (async () => {
      try {
        const result = await connectHealthApp();
        if (!alive.current) return;
        if (result.ok) {
          if (user?.id) {
            void import('@/lib/stepsMetrics').then(({ fetchStepsMetrics }) =>
              fetchStepsMetrics('1d', { force: true }).catch(() => undefined),
            );
          }
          finish();
        } else setError('ჯანმრთელობის მონაცემებზე წვდომა ვერ ჩაირთო. შეგიძლია მოგვიანებით დაუბრუნდე.');
      } catch {
        if (alive.current) setError('დაკავშირება ვერ მოხერხდა. სცადე ხელახლა ან გააგრძელე მოგვიანებით.');
      } finally {
        busyRef.current = false;
        if (alive.current) setBusy(false);
      }
    })();
  };

  const skip = () => {
    if (busyRef.current) return;
    if (step === 'notifications') {
      busyRef.current = true; setBusy(true); setError(null);
      void advanceFromNotifications().catch(finish).finally(() => { busyRef.current = false; if (alive.current) setBusy(false); });
      return;
    }
    finish();
  };

  if (!step) return null;

  const isNotifications = step === 'notifications';
  const title = isNotifications ? ka.permissions.gateNotificationsTitle : ka.permissions.gateHealthTitle;
  const body = isNotifications ? ka.permissions.gateNotificationsBody : ka.permissions.gateHealthBody;
  const Icon = isNotifications ? Bell : Footprints;

  return (
    <View
      pointerEvents="auto"
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        zIndex: 9999,
        elevation: 9999,
        backgroundColor: 'rgba(15, 23, 42, 0.55)',
      }}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          paddingHorizontal: 20,
          paddingTop: insets.top + 16,
          paddingBottom: Math.max(insets.bottom, 20),
        }}
      >
        <Pressable accessibilityRole="button" accessibilityLabel={ka.permissions.gateSkip} onPress={skip}>
          <View />
        </Pressable>
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 32,
            borderWidth: 1,
            borderColor: colors.bg300,
            padding: 22,
            gap: 20,
          }}
        >
          <View style={{ alignItems: 'center', gap: 14 }}>
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: 36,
                backgroundColor: `${colors.primary200}18`,
                borderWidth: 1,
                borderColor: `${colors.primary200}44`,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon size={34} color={colors.primary200} strokeWidth={2} />
            </View>
            <Text
              style={{
                fontFamily: 'NotoSansGeorgian_700Bold',
                fontSize: 24,
                lineHeight: 32,
                color: colors.text100,
                textAlign: 'center',
              }}
            >
              {title}
            </Text>
            <Text
              style={{
                fontFamily: 'NotoSansGeorgian_400Regular',
                fontSize: 15,
                lineHeight: 24,
                color: colors.text200,
                textAlign: 'center',
              }}
            >
              {body}
            </Text>
          </View>

          {error ? <Text accessibilityRole="alert" style={{ color: colors.text200, fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 14, lineHeight: 22 }}>{error}</Text> : null}
          <ProfileSetupPrimaryButton
            label={ka.permissions.gateEnable}
            onPress={isNotifications ? enableNotifications : enableHealth}
            loading={busy}
            icon="check"
          />
          <ProfileSetupLinkButton label={ka.permissions.gateSkip} onPress={skip} />
        </View>
      </ScrollView>
    </View>
  );
}
