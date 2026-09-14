import { Stack } from 'expo-router';
import { ka } from '@/i18n/ka';
import { STACK_PUSH } from '@/theme/stackMotion';

export default function PetCareScheduleLayout() {
  return (
    <Stack screenOptions={{ headerBackTitle: ka.common.back, headerTitleStyle: { fontWeight: '700' }, ...STACK_PUSH }}>
      <Stack.Screen name="[scheduleId]" options={{ title: ka.pets.scheduleActive }} />
    </Stack>
  );
}
