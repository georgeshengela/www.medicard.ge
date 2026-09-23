import '../global.css';
import '@/lib/bootGuard';

import React, { useEffect, useRef, useState } from 'react';
import { LogBox, Text, View } from 'react-native';

// Expo SDK 57 treats sound: 'default' as a missing custom file in the native client.
// The repeating LogBox toast covers Home chrome; ignore only that known message.
LogBox.ignoreLogs([
  "Custom sound 'default' not found",
  /InteractionManager has been deprecated/,
  /ProgressBarAndroid has been extracted from react-native core/,
  /SafeAreaView has been deprecated/,
  /Clipboard has been extracted from react-native core/,
  /PushNotificationIOS has been extracted from react-native core/,
]);
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Stack, useGlobalSearchParams, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { Notifications } from '@/lib/expoNotifications';
import { enableFreeze, enableScreens } from 'react-native-screens';
import { AppChromeOverlay } from '@/components/navigation/AppChromeOverlay';
import { FloatingTabBar } from '@/components/navigation/FloatingTabBar';
import { useTabChromeHidden } from '@/components/navigation/tabChrome';
import { ActiveRunBadge, useActiveRunChrome } from '@/components/run/ActiveRunBadge';
import { OfflineBanner } from '@/components/OfflineBanner';
import { Button } from '@/components/ui/Button';
import { WifiOff } from 'lucide-react-native';
import { DailyCheckInHost } from '@/components/check-in/DailyCheckInHost';
import { QuotaReadyHost } from '@/components/QuotaReadyHost';
import { LocationAskHost } from '@/components/location/LocationAskHost';
import { AiSharingConsentHost } from '@/components/AiSharingConsentHost';
import { AssistantEntry } from '@/components/assistant/AssistantEntry';
import { setLocationProfileListener, hydrateLocationFromProfile } from '@/lib/userLocation';
import { localAccountId } from '@/lib/localAccount';
import { PermissionGateHost } from '@/components/permissions/PermissionGateHost';
import { QuestHost } from '@/components/quest/QuestHost';
import { useThemeColors } from '@/theme/colors';
import { AuthProvider, useAuth, needsHealthAssessment, needsProfileSetup } from '@/store/AuthContext';
import { routeFromNotificationData } from '@/lib/notificationPlan';
import { nextProfileSetupHref } from '@/lib/onboarding';
import { FontsProvider } from '@/store/FontsContext';
import { ThemeProvider, useTheme } from '@/store/ThemeContext';
import { api } from '@/lib/api';
import { APP_VERSION } from '@/lib/appVersion';
import { startLivePresence, setLivePresenceScreen, stopLivePresence } from '@/lib/livePresence';
import { rememberMapboxToken } from '@/lib/run/mapbox';
import { consumePendingCycleShare, isCycleShareCode, savePendingCycleShare } from '@/lib/cycleSharePending';
import { getHomeLanding, resolveInitialRoute } from '@/lib/homeScreenPrefs';
import { useStackMotion } from '@/hooks/useStackMotion';

// Native screens = GPU stack transitions. Do not set this to false — that is
// what made page changes feel like a late pop. Tab chrome stays above via AppChromeOverlay.
enableScreens(true);
enableFreeze(true);

SplashScreen.preventAutoHideAsync().catch(() => undefined);

/** Redirects between the auth stack and the app shell as the session changes. */
function AuthGate({ children }: { children: React.ReactNode }) {
  const { ready: authReady, user, healthProfile, refreshHealthProfile, sessionRestoreError, restoringSession, refresh } = useAuth();
  const { ready: themeReady } = useTheme();
  const ready = authReady && themeReady;
  const colors = useThemeColors();

  const segments = useSegments();
  const router = useRouter();
  const params = useGlobalSearchParams<{ preview?: string | string[] }>();
  const qaPreview =
    typeof __DEV__ !== 'undefined' &&
    __DEV__ &&
    (Array.isArray(params.preview) ? params.preview[0] : params.preview) === '1';
  const splashHidden = useRef(false);
  const [gate, setGate] = useState<{ kind: 'ok' } | { kind: 'maintenance' | 'update'; message: string }>({
    kind: 'ok',
  });

  useEffect(() => {
    api.app
      .status(APP_VERSION)
      .then((status) => {
        rememberMapboxToken(status.mapboxToken);
        if (status.settings.maintenanceMode) {
          setGate({ kind: 'maintenance', message: status.settings.maintenanceMessage });
          return;
        }
        if (status.client.blockedByForceUpdate) {
          setGate({
            kind: 'update',
            message: `განაახლეთ აპლიკაცია ვერსიამდე ${status.settings.minAppVersion} ან უფრო ახალამდე.`,
          });
          return;
        }
        setGate({ kind: 'ok' });
      })
      .catch(() => setGate({ kind: 'ok' }));
  }, [user?.id]);

  useEffect(() => {
    if (!ready || gate.kind !== 'ok') return;

    if (!splashHidden.current) {
      splashHidden.current = true;
      SplashScreen.hideAsync().catch(() => undefined);
    }
    if (sessionRestoreError && !user) return;

    const inAuthGroup = segments[0] === '(auth)';
    const parts = segments as string[];
    const onShare = parts[0] === 'share';
    const onAssessment = segments.includes('assessment');
    const onProfileSetup = segments.includes('profile-setup');
    const shareCode = onShare && parts[1] === 'cycle' ? String(parts[2] || '') : '';

    if (!user && !inAuthGroup) {
      if (isCycleShareCode(shareCode)) {
        void savePendingCycleShare(shareCode);
      }
      router.replace('/(auth)');
      return;
    }

    if (user && inAuthGroup) {
      // Dev QA — stay on any auth/onboarding screen when preview=1.
      if (qaPreview) return;

      void (async () => {
        const profile = healthProfile ?? (await refreshHealthProfile());

        if (needsHealthAssessment(profile)) {
          if (!onAssessment) router.replace('/(auth)/assessment');
          return;
        }

        if (needsProfileSetup(profile)) {
          if (!onProfileSetup) router.replace(nextProfileSetupHref(profile, user) as never);
          return;
        }

        const landing = await getHomeLanding();
        const onPrivacy = segments.includes('privacy');
        const onResults = segments.includes('results');
        const onAnalyzing = segments.includes('analyzing');
        if (onPrivacy || onResults || onAnalyzing) return;

        // Dev QA — allow profile-setup preview even when onboarding is complete.
        if (typeof __DEV__ !== 'undefined' && __DEV__ && (onProfileSetup || onAssessment)) {
          return;
        }

        const pendingShare = await consumePendingCycleShare();
        if (pendingShare) {
          router.replace(`/share/cycle/${pendingShare}` as never);
          return;
        }

        router.replace(resolveInitialRoute(landing, user.gender) as never);
      })();
    }
  }, [ready, user, segments, router, gate.kind, healthProfile, refreshHealthProfile, qaPreview, sessionRestoreError]);

  if (ready && sessionRestoreError && !user) {
    // No cached medical data is displayed until the server verifies this session.
    return <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.bg100, padding: 28 }}>
      <View style={{ width: '100%', maxWidth: 400, alignSelf: 'center', gap: 16 }}>
        <WifiOff size={30} color={colors.text200} />
        <Text accessibilityRole="header" style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 21, color: colors.text100 }}>კავშირი შეფერხდა</Text>
        <Text accessibilityRole="alert" style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 14, lineHeight: 23, color: colors.text200 }}>{sessionRestoreError}</Text>
        <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13, lineHeight: 21, color: colors.text200 }}>შესვლის მონაცემები შენახულია. კავშირის აღდგენის შემდეგ ხელახლა სცადე — პაროლის თავიდან შეყვანა საჭირო არ არის.</Text>
        <Button label="ხელახლა ცდა" style={{ backgroundColor: '#0F766E' }} loading={restoringSession} onPress={() => void refresh()} />
      </View>
    </View>;
  }

  if (gate.kind !== 'ok') {
    return (
      <View className="flex-1 items-center justify-center bg-bg-100 px-8">
        <Text className="text-center font-sans-bold text-2xl text-text-100">
          {gate.kind === 'maintenance' ? 'განახლება მიმდინარეობს' : 'საჭიროა განახლება'}
        </Text>
        <Text className="mt-3 text-center font-sans text-base leading-6 text-text-200">{gate.message}</Text>
      </View>
    );
  }

  if (!ready) return <View className="flex-1 bg-bg-100" />;

  const inAuthGroup = segments[0] === '(auth)';
  if (!user && !inAuthGroup) {
    return <View className="flex-1 bg-bg-100" />;
  }

  return <>{children}</>;
}

function AppShell() {
  const colors = useThemeColors();
  const { scheme } = useTheme();
  const { user, healthProfile, setHealthProfile } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const stackMotion = useStackMotion();
  const peerMotion = useStackMotion('peer');
  const tabChromeHidden = useTabChromeHidden();
  const activeRunChrome = useActiveRunChrome();
  const showTabBar =
    Boolean(user) &&
    !tabChromeHidden &&
    segments[0] === '(tabs)';
  const chromeInteractive = Boolean(user) || activeRunChrome;

  useEffect(() => {
    if (!user) {
      void import('@/lib/run/store').then(({ resetRunMemory }) => {
        resetRunMemory();
      });
      return;
    }
    void import('@/lib/run/store').then(({ hydrateActiveRun }) => {
      void hydrateActiveRun();
    });
  }, [user?.id]);

  useEffect(() => {
    if (!user) {
      stopLivePresence();
      return;
    }
    startLivePresence();
    setLivePresenceScreen(segments.filter(Boolean).join('/') || 'home');
  }, [user, segments]);

  useEffect(() => {
    const owner = user?.id;
    setLocationProfileListener(owner ? profile => {
      if (localAccountId() === owner) setHealthProfile(profile);
    } : null);
    if (owner && localAccountId() === owner) hydrateLocationFromProfile(healthProfile);
    return () => setLocationProfileListener(null);
  }, [user?.id, healthProfile, setHealthProfile]);

  useEffect(() => {
    const openFromData = (raw: unknown) => {
      const data = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null;
      const route = routeFromNotificationData(data);
      if (route) router.push(route as never);
    };

    Notifications.getLastNotificationResponseAsync()
      .then((last) => {
        openFromData(last?.notification.request.content.data);
      })
      .catch(() => undefined);

    const received = Notifications.addNotificationReceivedListener((notification) => {
      const content = notification.request.content;
      const data = (content.data ?? {}) as Record<string, unknown>;
      if (data.qa) return;
      void import('@/lib/pushCopy').then(({ logPushEvent }) =>
        logPushEvent({
          source: typeof data.campaignId === 'string' ? 'broadcast' : 'local',
          key: String(data.templateKey || data.type || 'unknown'),
          title: content.title ?? '',
          body: content.body ?? '',
        }),
      );
      if (data.type === 'pet_care') {
        void import('@/lib/petCareReminders').then(({ recordPetCareReceivedCallback }) =>
          recordPetCareReceivedCallback(data),
        );
      }
      if (data.type === 'medi_engage') {
        const now = new Date();
        const ymd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const key = String(data.templateKey || 'engage');
        const family = String(data.family || 'checkin');
        void import('@/lib/mediEngagePrefs').then(({ recordEngageSent, recordEngageOutcome }) => {
          void recordEngageSent({ key, family, at: Date.now(), ymd });
          void recordEngageOutcome({ key, family, sentAt: Date.now() });
        });
        const decisionId = typeof data.decisionId === 'string' ? data.decisionId : '';
        if (decisionId.startsWith('notif_dec_')) {
          void import('@/lib/productObservability').then(({ syncNotificationOutcome }) =>
            syncNotificationOutcome({ decisionId, outcome: 'delivered' }),
          );
        }
      }
    });

    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      void import('@/lib/mediNotificationActions').then(({ handleNotificationAction }) =>
        handleNotificationAction(response).then((result) => {
          if (!result.navigate) return;
          if (result.route) router.push(result.route as never);
          else openFromData(response.notification.request.content.data);
        }),
      );
    });

    return () => {
      received.remove();
      sub.remove();
    };
  }, [router]);

  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <AuthGate>
        <View style={{ flex: 1, backgroundColor: colors.bg100 }}>
          <View style={{ flex: 1 }}>
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: colors.bg100 },
                headerTitleStyle: { color: colors.text100, fontSize: 17, fontWeight: '700' },
                headerTintColor: colors.primary200,
                headerShadowVisible: false,
                contentStyle: { backgroundColor: colors.bg100 },
                ...stackMotion,
              }}
            >
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="(auth)" options={{ headerShown: false, ...peerMotion }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false, ...peerMotion }} />
              <Stack.Screen name="package" options={{ headerShown: false }} />
              <Stack.Screen name="health-metrics" options={{ headerShown: false }} />
              <Stack.Screen name="weather" options={{ headerShown: false }} />
              <Stack.Screen name="medi-quest" options={{ headerShown: false }} />
              <Stack.Screen name="medi-companion" options={{ headerShown: false }} />
              <Stack.Screen name="profile" options={{ headerShown: false }} />
              <Stack.Screen name="chat" options={{ headerShown: false }} />
              <Stack.Screen name="assistant" options={{ headerShown: false }} />
              <Stack.Screen name="module" options={{ headerShown: false }} />
              <Stack.Screen name="cycle" options={{ headerShown: false }} />
              <Stack.Screen name="share" options={{ headerShown: false }} />
              <Stack.Screen name="visits" options={{ headerShown: false }} />
              <Stack.Screen name="community" options={{ headerShown: false }} />
              <Stack.Screen name="pets" options={{ headerShown: false }} />
              <Stack.Screen name="medipulsi" options={{ headerShown: false }} />
              <Stack.Screen name="medications" options={{ headerShown: false }} />
              <Stack.Screen name="lab" options={{ headerShown: false }} />
              <Stack.Screen name="symptoms" options={{ headerShown: false }} />
              <Stack.Screen name="pharmacy" options={{ headerShown: false }} />
              <Stack.Screen name="run" options={{ headerShown: false }} />
              <Stack.Screen name="record/[id]" options={{ headerBackTitle: 'უკან' }} />
            </Stack>
          </View>
          <AppChromeOverlay interactive={chromeInteractive}>
            {user && !['run', 'medi-quest', 'medi-companion', 'pets', 'assistant', 'community'].includes(segments[0]) ? <FloatingTabBar visible={showTabBar} /> : null}
            {user ? <ActiveRunBadge /> : null}
            {user && segments[0] !== 'community' ? <AssistantEntry tabBar={showTabBar} /> : null}
          </AppChromeOverlay>
          <DailyCheckInHost />
          <QuotaReadyHost />
          <LocationAskHost />
          <QuestHost />
          <OfflineBanner />
          <PermissionGateHost />
          <AiSharingConsentHost />
        </View>
      </AuthGate>
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }} className="font-sans">
      <SafeAreaProvider>
        <FontsProvider>
          <ThemeProvider>
            <AuthProvider>
              <AppShell />
            </AuthProvider>
          </ThemeProvider>
        </FontsProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
