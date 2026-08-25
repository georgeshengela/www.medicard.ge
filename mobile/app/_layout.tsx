import '../global.css';

import React, { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { enableScreens } from 'react-native-screens';
import Constants from 'expo-constants';
import { FloatingTabBar } from '@/components/navigation/FloatingTabBar';
import { useThemeColors } from '@/theme/colors';
import { AuthProvider, useAuth, needsHealthAssessment, needsProfileSetup } from '@/store/AuthContext';
import { FontsProvider } from '@/store/FontsContext';
import { ThemeProvider, useTheme } from '@/store/ThemeContext';
import { api } from '@/lib/api';
import { getHomeLanding, resolveInitialRoute } from '@/lib/homeScreenPrefs';

enableScreens(false);

SplashScreen.preventAutoHideAsync().catch(() => undefined);

const APP_VERSION = Constants.expoConfig?.version ?? '3.0.0';

/** Redirects between the auth stack and the app shell as the session changes. */
function AuthGate({ children }: { children: React.ReactNode }) {
  const { ready: authReady, user, healthProfile, refreshHealthProfile } = useAuth();
  const { ready: themeReady } = useTheme();
  const ready = authReady && themeReady;
  const colors = useThemeColors();

  const segments = useSegments();
  const router = useRouter();
  const splashHidden = useRef(false);
  const [gate, setGate] = useState<{ kind: 'ok' } | { kind: 'maintenance' | 'update'; message: string }>({
    kind: 'ok',
  });

  useEffect(() => {
    api.app
      .status(APP_VERSION)
      .then((status) => {
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
    const onAssessment = segments.includes('assessment');
    const onProfileSetup = segments.includes('profile-setup');

    if (!user && !inAuthGroup) {
      router.replace('/(auth)');
      return;
    }

    if (user && inAuthGroup) {
      void (async () => {
        const profile = healthProfile ?? (await refreshHealthProfile());

        if (needsHealthAssessment(profile)) {
          if (!onAssessment) router.replace('/(auth)/assessment');
          return;
        }

        if (needsProfileSetup(profile)) {
          if (!onProfileSetup) router.replace('/(auth)/profile-setup/avatar');
          return;
        }

        const landing = await getHomeLanding();
        router.replace(resolveInitialRoute(landing, user.gender) as never);
      })();
    }
  }, [ready, user, segments, router, gate.kind, healthProfile, refreshHealthProfile]);

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

  if (!ready) return <View className="flex-1" style={{ backgroundColor: colors.bg100 }} />;
  return <>{children}</>;
}

function AppShell() {
  const colors = useThemeColors();
  const { scheme } = useTheme();
  const { user } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const showTabBar = Boolean(user) && segments[0] === '(tabs)';

  useEffect(() => {
    const openRoute = (route: unknown) => {
      if (typeof route === 'string' && route.startsWith('/')) {
        router.push(route as never);
      }
    };

    Notifications.getLastNotificationResponseAsync()
      .then((last) => {
        const data = last?.notification.request.content.data;
        if (data?.type === 'cycle_reminder' && data?.route) {
          openRoute(data.route);
        }
        if (data?.type === 'visit_reminder' && data?.route) {
          openRoute(data.route);
        }
      })
      .catch(() => undefined);

    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      if (data?.type === 'cycle_reminder' && data?.route) {
        openRoute(data.route);
      }
      if (data?.type === 'visit_reminder' && data?.route) {
        openRoute(data.route);
      }
    });

    return () => sub.remove();
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
              }}
            >
              <Stack.Screen name="(auth)" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="chat/[mode]" options={{ headerBackTitle: 'უკან' }} />
              <Stack.Screen name="module/lab" options={{ headerBackTitle: 'უკან' }} />
              <Stack.Screen name="module/imaging" options={{ headerBackTitle: 'უკან' }} />
              <Stack.Screen name="module/skin" options={{ headerBackTitle: 'უკან' }} />
              <Stack.Screen name="module/skincare" options={{ headerBackTitle: 'უკან' }} />
              <Stack.Screen name="cycle" options={{ headerShown: false }} />
              <Stack.Screen name="visits" options={{ headerShown: false }} />
              <Stack.Screen name="pharmacy" options={{ headerShown: false }} />
              <Stack.Screen name="record/[id]" options={{ headerBackTitle: 'უკან' }} />
            </Stack>
          </View>
          {showTabBar ? <FloatingTabBar /> : null}
        </View>
      </AuthGate>
    </>
  );
}

export default function RootLayout() {
  return (
    <View style={{ flex: 1 }} className="font-sans">
      <SafeAreaProvider>
        <FontsProvider>
          <ThemeProvider>
            <AuthProvider>
              <AppShell />
            </AuthProvider>
          </ThemeProvider>
        </FontsProvider>
      </SafeAreaProvider>
    </View>
  );
}
