import { useEffect, useRef } from 'react';
import { Stack, useSegments } from 'expo-router';
import { useStackMotion } from '@/hooks/useStackMotion';
import { trackOnboardingStep } from '@/lib/funnel';

/** Onboarding steps 6–8 (privacy, AI consent, notifications, Home layout) for the product funnel: keys only. */
const FUNNEL_TAIL = ['privacy', 'ai-privacy', 'notifications', 'home-layout', 'analyzing'];

export default function ProfileSetupLayout() {
  const motion = useStackMotion();
  const segments = useSegments() as string[];
  const screen = segments[segments.length - 1] || '';
  const previous = useRef<string | null>(null);
  useEffect(() => {
    const at = FUNNEL_TAIL.indexOf(screen);
    if (at < 0) return;
    const before = previous.current ? FUNNEL_TAIL.indexOf(previous.current) : -1;
    if (before >= 0 && at > before) trackOnboardingStep('completed', previous.current);
    if (screen !== 'analyzing') trackOnboardingStep('viewed', screen);
    previous.current = screen;
  }, [screen]);
  return (
    <Stack screenOptions={{ headerShown: false, ...motion }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="avatar" />
      <Stack.Screen name="phone" />
      <Stack.Screen name="verify" />
      <Stack.Screen name="success" />
      <Stack.Screen name="face-id" />
      <Stack.Screen name="privacy" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="home-layout" />
      <Stack.Screen name="ai-privacy" />
      <Stack.Screen name="location" />
      <Stack.Screen name="analyzing" />
      <Stack.Screen name="results" />
      <Stack.Screen name="dev-launcher" />
    </Stack>
  );
}
