import { Stack } from 'expo-router';
import { MedicationNavHeader } from '@/components/medications/MedicationNavHeader';
import { FIGMA_MEDS } from '@/constants/figmaMedicationsLayout';

export default function MedicationsLayout() {
  return (
    <Stack
      screenOptions={{
        header: (props) => <MedicationNavHeader {...props} />,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: FIGMA_MEDS.white },
      }}
    />
  );
}
