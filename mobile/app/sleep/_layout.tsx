import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '@/store/AuthContext';
import { useStackMotion } from '@/hooks/useStackMotion';
import { ModuleToneProvider, NightProvider } from '@/theme/colors';

/** MEDISLEEP is a night space everywhere — hub, sounds, sleep mode, analytics — whatever the phone's theme. */
export default function SleepLayout() {
  const motion = useStackMotion();
  const completionMotion = useStackMotion('completion');
  const { user, ready } = useAuth();
  if (!ready) return <View style={{ flex: 1, justifyContent: 'center', backgroundColor: '#0B0A1F' }}><ActivityIndicator color="#D9A8FF" /></View>;
  if (!user) return <Redirect href="/" />;
  return (
    <NightProvider>
      <ModuleToneProvider tone="sleep">
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0B0A1F' }, ...motion }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="night" options={{ ...completionMotion, gestureEnabled: false, fullScreenGestureEnabled: false }} />
          <Stack.Screen name="checkin" options={completionMotion} />
          <Stack.Screen name="sounds" />
          <Stack.Screen name="insights" />
          <Stack.Screen name="plan" />
          <Stack.Screen name="log" />
          <Stack.Screen name="breathe" options={completionMotion} />
        </Stack>
      </ModuleToneProvider>
    </NightProvider>
  );
}
