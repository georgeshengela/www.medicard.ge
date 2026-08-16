import { Stack } from 'expo-router';
import { useThemeColors } from '@/theme/colors';

export default function AuthLayout() {
  const colors = useThemeColors();

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg100 } }}>
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="sign-up" />
      <Stack.Screen name="phone" />
    </Stack>
  );
}
