import { Stack } from 'expo-router';
import { ka } from '@/i18n/ka';

export default function ShareLayout() {
  return <Stack screenOptions={{ headerBackTitle: ka.common.back }} />;
}
