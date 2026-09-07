import { Stack } from 'expo-router';
import { ka } from '@/i18n/ka';
import { STACK_PUSH } from '@/theme/stackMotion';

export default function ShareLayout() {
  return <Stack screenOptions={{ headerBackTitle: ka.common.back, ...STACK_PUSH }} />;
}
