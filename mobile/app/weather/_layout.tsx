import { Stack } from 'expo-router';

export default function WeatherLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />
  );
}
