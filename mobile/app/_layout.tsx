import '../global.css';

import React, { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
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
import { DailyCheckInHost } from '@/components/check-in/DailyCheckInHost';
import { QuotaReadyHost } from '@/components/QuotaReadyHost';
import { LocationAskHost } from '@/components/location/LocationAskHost';
import { QuestHost } from '@/components/quest/QuestHost';
import { useThemeColors } from '@/theme/colors';
import { AuthProvider, useAuth, needsHealthAssessment, needsProfileSetup } from '@/store/AuthContext';
import { routeFromNotificationData } from '@/lib/notificationPlan';
import { nextProfileSetupHref } from '@/lib/onboarding';
import { FontsProvider } from '@/store/FontsContext';
import { ThemeProvider, useTheme } from '@/store/ThemeContext';
import { api } from '@/lib/api';
import { APP_VERSION } from '@/lib/appVersion';
import { rememberMapboxToken } from '@/lib/run/mapbox';
import { rememberMediWorldExploreServerEnabled, rememberMediWorldGardenServerEnabled, rememberMediWorldMovementServerEnabled, rememberMediWorldServerEnabled } from '@/lib/mediWorld/enabled';
import { consumePendingCycleShare, isCycleShareCode, savePendingCycleShare } from '@/lib/cycleSharePending';
import { getHomeLanding, resolveInitialRoute } from '@/lib/homeScreenPrefs';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { STACK_PUSH, STACK_REDUCED } from '@/theme/stackMotion';

// Native screens = GPU stack transitions. Do not set this to false — that is
// what made page changes feel like a late pop. Tab chrome stays above via AppChromeOverlay.
enableScreens(true);
enableFreeze(true);

SplashScreen.preventAutoHideAsync().catch(() => undefined);

/** Redirects between the auth stack and the app shell as the session changes. */
function AuthGate({ children }: { children: React.ReactNode }) {
  const { ready: authReady, user, healthProfile, refreshHealthProfile } = useAuth();
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
        rememberMediWorldServerEnabled(status.settings.mediWorldEnabled);
        rememberMediWorldExploreServerEnabled(status.settings.mediWorldExploreEnabled);
        rememberMediWorldMovementServerEnabled(status.settings.mediWorldMovementEnabled);
        rememberMediWorldGardenServerEnabled(status.settings.mediWorldGardenEnabled);
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
  }, []);

  useEffect(() => {
    if (!ready || gate.kind !== 'ok') return;

    if (!splashHidden.current) {
      splashHidden.current = true;
      SplashScreen.hideAsync().catch(() => undefined);
    }

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
  }, [ready, user, segments, router, gate.kind, healthProfile, refreshHealthProfile, qaPreview]);

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
  const reduceMotion = usePrefersReducedMotion();
  const stackMotion = reduceMotion ? STACK_REDUCED : STACK_PUSH;
  const tabChromeHidden = useTabChromeHidden();
  const activeRunChrome = useActiveRunChrome();
  const showTabBar =
    Boolean(user) &&
    !tabChromeHidden &&
    (segments[0] === '(tabs)' || (segments[0] === 'run' && (segments.length === 1 || segments[1] === 'index')));
  const chromeInteractive = showTabBar || activeRunChrome;

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
      void import('@/lib/livePresence').then(({ stopLivePresence }) => stopLivePresence());
      void import('@/lib/userLocation').then(({ setLocationProfileListener, stopLiveLocationWatch }) => {
        setLocationProfileListener(null);
        stopLiveLocationWatch();
      });
      return;
    }
    void import('@/lib/livePresence').then(({ startLivePresence, setLivePresenceScreen }) => {
      startLivePresence();
      setLivePresenceScreen(segments.filter(Boolean).join('/') || 'home');
    });
  }, [user, segments]);

  useEffect(() => {
    if (!user) return;
    void import('@/lib/userLocation').then(({ setLocationProfileListener, startLiveLocationIfEnabled }) => {
      setLocationProfileListener(setHealthProfile);
      void startLiveLocationIfEnabled(healthProfile);
    });
  }, [user, Boolean(healthProfile), setHealthProfile]);

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
              <Stack.Screen name="(auth)" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="package" options={{ headerShown: false }} />
              <Stack.Screen name="health-metrics" options={{ headerShown: false }} />
              <Stack.Screen name="weather" options={{ headerShown: false }} />
              <Stack.Screen name="medi-quest" options={{ headerShown: false }} />
              <Stack.Screen name="medi-companion" options={{ headerShown: false }} />
              <Stack.Screen name="medi-world" options={{ headerShown: false }} />
              <Stack.Screen name="profile" options={{ headerShown: false }} />
              <Stack.Screen name="chat" options={{ headerShown: false }} />
              <Stack.Screen name="module" options={{ headerShown: false }} />
              <Stack.Screen name="cycle" options={{ headerShown: false }} />
              <Stack.Screen name="share" options={{ headerShown: false }} />
              <Stack.Screen name="visits" options={{ headerShown: false }} />
              <Stack.Screen name="medications" options={{ headerShown: false }} />
              <Stack.Screen name="lab" options={{ headerShown: false }} />
              <Stack.Screen name="symptoms" options={{ headerShown: false }} />
              <Stack.Screen name="pharmacy" options={{ headerShown: false }} />
              <Stack.Screen name="run" options={{ headerShown: false }} />
              <Stack.Screen name="record/[id]" options={{ headerBackTitle: 'უკან' }} />
            </Stack>
          </View>
          <AppChromeOverlay interactive={chromeInteractive}>
            {user ? <FloatingTabBar visible={showTabBar} /> : null}
            {user ? <ActiveRunBadge /> : null}
          </AppChromeOverlay>
          <DailyCheckInHost />
          <QuotaReadyHost />
          <LocationAskHost />
          <QuestHost />
          <OfflineBanner />
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
