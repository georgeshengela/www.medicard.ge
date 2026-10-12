import { Stack } from 'expo-router';
import { useStackMotion } from '@/hooks/useStackMotion';
import { ModuleToneProvider, useThemeColors } from '@/theme/colors';

/**
 * MEDIFAMILY: every page speaks the module's coral (ModuleToneProvider). Pages draw the standard
 * ModuleHeader themselves (scrolling with the content, or ModuleStackHeader where a footer is pinned).
 */
export default function FamilyLayout() {
  return (
    <ModuleToneProvider tone="family">
      <FamilyStack />
    </ModuleToneProvider>
  );
}

function FamilyStack() {
  const motion = useStackMotion();
  const c = useThemeColors();
  return <Stack screenOptions={{ ...motion, headerShown: false, contentStyle: { backgroundColor: c.bg100 } }} />;
}
