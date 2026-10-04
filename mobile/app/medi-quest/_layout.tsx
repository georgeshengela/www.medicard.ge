import { Stack } from 'expo-router';
import { useStackMotion } from '@/hooks/useStackMotion';
import { ModuleToneProvider } from '@/theme/colors';

export default function MediQuestLayout() {
  const motion = useStackMotion();
  // Every MEDIQUEST page speaks the module's violet (owner 2026-10-04), like MEDIVET and MEDIFOOD.
  return (
    <ModuleToneProvider tone="quest">
      <Stack
        screenOptions={{
          headerShown: false,
          ...motion,
        }}
      />
    </ModuleToneProvider>
  );
}
