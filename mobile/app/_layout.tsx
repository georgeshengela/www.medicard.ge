import '../global.css';

import React, { useEffect } from 'react';
import { View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { enableScreens } from 'react-native-screens';
import { FloatingTabBar } from '@/components/navigation/FloatingTabBar';
import { useThemeColors } from '@/theme/colors';
import { AuthProvider, useAuth } from '@/store/AuthContext';
import { ThemeProvider, useTheme } from '@/store/ThemeContext';

// Keep screens in the JS tree so a root-level tab bar is never covered by a
// native full-window host view.
enableScreens(false);

SplashScreen.preventAutoHideAsync().catch(() => undefined);

/** Redirects between the auth stack and the app shell as the session changes. */
function AuthGate({ children }: { children: React.ReactNode }) {
  const { ready: authReady, user } = useAuth();
  const { ready: themeReady } = useTheme();
  const ready = authReady && themeReady;

  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;

    SplashScreen.hideAsync().catch(() => undefined);

    const inAuthGroup = segments[0] === '(auth)';
    if (!user && !inAuthGroup) {
      router.replace('/(auth)/sign-in');
    } else if (user && inAuthGroup) {
      router.replace('/(tabs)/home');
    }
  }, [ready, user, segments, router]);

  if (!ready) return <View className="flex-1 bg-bg-100" />;
  return <>{children}</>;
}

function AppShell() {
  const colors = useThemeColors();
  const { scheme } = useTheme();
  const { user } = useAuth();
  const segments = useSegments();
  const showTabBar = Boolean(user) && segments[0] === '(tabs)';

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
    <View style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <AppShell />
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </View>
  );
}
