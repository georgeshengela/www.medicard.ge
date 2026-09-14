import React from 'react';
import { Text, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { Card } from '@/components/ui/Card';
import { PetPhoto } from '@/components/pets/PetPhoto';
import { ka } from '@/i18n/ka';
import type { Pet } from '@/lib/api';
import { formatPetAgeKa } from '@/lib/petsAge';
import { getSpecies } from '@/lib/petsCatalog';
import { useThemeColors } from '@/theme/colors';

function breedLabel(pet: Pet): string {
  if (pet.breedId === 'custom' && pet.customBreed) return pet.customBreed;
  if (pet.breedId === 'mixed') return ka.pets.breedMixed;
  if (pet.breedId === 'unknown') return ka.pets.breedUnknown;
  const species = getSpecies(pet.speciesId);
  return species?.breeds.find((row) => row.id === pet.breedId)?.label || ka.pets.breedUnknown;
}

export function PetCard({ pet, onPress }: { pet: Pet; onPress: () => void }) {
  const colors = useThemeColors();
  const species = getSpecies(pet.speciesId);
  const age = formatPetAgeKa(pet.age, ka.pets);
  const meta = [species?.labelKa, breedLabel(pet), age].filter(Boolean).join(' · ');

  return (
    <Card padded={false} onPress={onPress}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14, minHeight: 76, gap: 12 }}>
        <PetPhoto photoUrl={pet.photoUrl} name={pet.name} size={56} />
        <View style={{ flex: 1 }}>
          <Text
            numberOfLines={1}
            style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 16, color: colors.text100 }}
          >
            {pet.name}
          </Text>
          <Text numberOfLines={2} style={{ marginTop: 4, fontSize: 13, lineHeight: 18, color: colors.text300 }}>
            {meta}
          </Text>
        </View>
        <ChevronRight size={18} color={colors.text300} strokeWidth={2} />
      </View>
    </Card>
  );
}
