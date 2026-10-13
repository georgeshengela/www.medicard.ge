import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '@/store/AuthContext';
import { useStackMotion } from '@/hooks/useStackMotion';
import { useHoroFonts } from '@/components/horoscope/HoroUI';
import { ModuleToneProvider, NightProvider } from '@/theme/colors';

const NIGHT = '#060A1F';

/** MEDIHOROSCOPE is a night space everywhere — the lapis sky with brass — whatever the phone's theme. */
export default function HoroscopeLayout() {
  const motion = useStackMotion();
  const { user, ready } = useAuth();
  const fonts = useHoroFonts();
  if (!ready || !fonts) return <View style={{ flex: 1, justifyContent: 'center', backgroundColor: NIGHT }}><ActivityIndicator color="#E9C77E" /></View>;
  if (!user) return <Redirect href="/" />;
  return (
    <NightProvider>
      <ModuleToneProvider tone="horo">
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: NIGHT }, ...motion }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="oracle" />
          <Stack.Screen name="chart" />
          <Stack.Screen name="birth" />
          <Stack.Screen name="sign/[sign]" />
          <Stack.Screen name="compat" />
          <Stack.Screen name="tarot" />
          <Stack.Screen name="numerology" />
          <Stack.Screen name="chinese" />
          <Stack.Screen name="dreams" />
          <Stack.Screen name="sky" />
        </Stack>
      </ModuleToneProvider>
    </NightProvider>
  );
}
