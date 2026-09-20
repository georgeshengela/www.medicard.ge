import React from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Clock, Package, Syringe } from 'lucide-react-native';
import { PetIntro } from '@/components/pets/PetUi';
import { PetListRow, PetPageScroll } from '@/components/pets/PetScreen';
import { ka } from '@/i18n/ka';

export default function PetCareAddScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <PetPageScroll>
      <PetIntro title="რას ვამატებთ დღეს?" body="აირჩიე მომავალი გეგმა, უკვე ჩატარებული პროცედურა ან პროდუქტი, რომელსაც იყენებ." />

      <PetListRow
        icon={Syringe}
        title={ka.pets.planCare}
        subtitle={ka.pets.planCareHint}
        onPress={() => router.push(`/pets/${id}/care/plan`)}
      />
      <PetListRow
        icon={Package}
        title={ka.pets.productAdd}
        subtitle={ka.pets.productAddHint}
        onPress={() => router.push(`/pets/${id}/care/products/new`)}
      />
      <PetListRow
        icon={Clock}
        title={ka.pets.recordAdmin}
        subtitle={ka.pets.recordAdminHint}
        onPress={() => router.push(`/pets/${id}/care/record`)}
      />

      <Text className="text-sm text-text-300">{ka.pets.plannedDisclaimer}</Text>
    </PetPageScroll>
  );
}
