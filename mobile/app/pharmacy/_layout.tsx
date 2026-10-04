import { Stack } from 'expo-router';
import { MedicationNavHeader } from '@/components/medications/MedicationNavHeader';
import { ka } from '@/i18n/ka';
import { useStackMotion } from '@/hooks/useStackMotion';
import { useThemeColors } from '@/theme/colors';

/** Prices belong to MEDIPILL: every pharmacy page wears the same standard module header. */
export default function PharmacyLayout() {
  const motion = useStackMotion();
  const c = useThemeColors();
  return (
    <Stack
      screenOptions={{
        header: (props) => <MedicationNavHeader {...props} />,
        headerShadowVisible: false,
        contentStyle: { flex: 1, backgroundColor: c.bg100 },
        ...motion,
      }}
    >
      <Stack.Screen name="index" options={{ title: ka.pharmacy.title }} />
      <Stack.Screen name="category/[slug]" options={{ title: ka.pharmacy.categories }} />
      <Stack.Screen name="product/[id]" options={{ title: ka.pharmacy.compareTitle }} />
    </Stack>
  );
}
