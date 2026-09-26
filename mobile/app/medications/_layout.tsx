import { Stack } from 'expo-router';
import { MedicationNavHeader } from '@/components/medications/MedicationNavHeader';
import { useStackMotion } from '@/hooks/useStackMotion';
import { useThemeColors } from '@/theme/colors';

export default function MedicationsLayout() {
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
    />
  );
}
