import { Stack } from 'expo-router';
import { MedicationNavHeader } from '@/components/medications/MedicationNavHeader';
import { useFigmaMeds } from '@/constants/figmaMedicationsLayout';
import { useStackMotion } from '@/hooks/useStackMotion';

export default function MedicationsLayout() {
  const motion = useStackMotion();
  const FIGMA_MEDS = useFigmaMeds();
  return (
    <Stack
      screenOptions={{
        header: (props) => <MedicationNavHeader {...props} />,
        headerShadowVisible: false,
        contentStyle: { flex: 1, backgroundColor: FIGMA_MEDS.pageBg },
        ...motion,
      }}
    />
  );
}
