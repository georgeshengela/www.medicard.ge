import React from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Clock, Package, Syringe } from 'lucide-react-native';
import { PetListRow, PetPageScroll } from '@/components/pets/PetScreen';
import { ka } from '@/i18n/ka';

export default function PetCareAddScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <PetPageScroll>
      <View className="gap-2 pb-2">
        <Text className="text-lg font-bold text-text-100" style={{ fontFamily: 'NotoSansGeorgian_700Bold' }}>
          {ka.pets.careAdd}
        </Text>
        <Text className="text-base text-text-300">{ka.pets.careAddBody}</Text>
      </View>

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
