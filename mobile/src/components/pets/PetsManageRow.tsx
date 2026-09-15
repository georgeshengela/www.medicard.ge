import React, { useRef } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import {
  Bird,
  Cat,
  ChevronRight,
  Dog,
  Fence,
  Fish,
  PawPrint,
  Pencil,
  Rabbit,
  Rat,
  Trash2,
  Turtle,
  type LucideIcon,
} from 'lucide-react-native';
import { PetPhoto } from '@/components/pets/PetPhoto';
import { ka } from '@/i18n/ka';
import type { Pet } from '@/lib/api';
import { formatPetAgeKa } from '@/lib/petsAge';
import { getSpecies } from '@/lib/petsCatalog';
import { useIsDark, useThemeColors } from '@/theme/colors';

const FLAT = {
  shadowColor: 'transparent',
  shadowOpacity: 0,
  shadowRadius: 0,
  shadowOffset: { width: 0, height: 0 },
  elevation: 0,
} as const;

const GEO = {
  title: 'NotoSansGeorgian_700Bold',
  semibold: 'NotoSansGeorgian_600SemiBold',
  regular: 'NotoSansGeorgian_400Regular',
} as const;

function speciesIcon(id: string): LucideIcon {
  switch (id) {
    case 'dog':
      return Dog;
    case 'cat':
      return Cat;
    case 'bird':
      return Bird;
    case 'rabbit':
      return Rabbit;
    case 'rodent':
      return Rat;
    case 'fish':
      return Fish;
    case 'reptile':
      return Turtle;
    case 'horse':
      return Fence;
    default:
      return PawPrint;
  }
}

function breedLabel(pet: Pet): string {
  if (pet.breedId === 'custom' && pet.customBreed) return pet.customBreed;
  if (pet.breedId === 'mixed') return ka.pets.breedMixed;
  if (pet.breedId === 'unknown') return ka.pets.breedUnknown;
  return getSpecies(pet.speciesId)?.breeds.find((row) => row.id === pet.breedId)?.label || ka.pets.breedUnknown;
}

function petMeta(pet: Pet): string {
  const age = formatPetAgeKa(pet.age, ka.pets);
  return [getSpecies(pet.speciesId)?.labelKa, breedLabel(pet), age].filter(Boolean).join(' · ');
}

function ActionWell({
  color,
  icon: Icon,
  label,
  onPress,
}: {
  color: string;
  icon: LucideIcon;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className="active:opacity-90"
      style={{
        ...FLAT,
        flex: 1,
        width: 76,
        marginVertical: 2,
        borderRadius: 20,
        backgroundColor: color,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
      }}
    >
      <Icon size={20} color="#FFFFFF" strokeWidth={2.2} />
      <Text style={{ fontFamily: GEO.semibold, fontSize: 11, color: '#FFFFFF' }}>{label}</Text>
    </Pressable>
  );
}

type Props = {
  pet: Pet;
  onOpen: () => void;
  onEdit: () => void;
  onArchive: () => void;
  onWillOpen?: (ref: Swipeable) => void;
};

export function PetsManageRow({ pet, onOpen, onEdit, onArchive, onWillOpen }: Props) {
  const colors = useThemeColors();
  const dark = useIsDark();
  const swipeRef = useRef<Swipeable | null>(null);
  const SpeciesIcon = speciesIcon(pet.speciesId);

  const closeThen = (fn: () => void) => {
    swipeRef.current?.close();
    fn();
  };

  return (
    <Swipeable
      ref={swipeRef}
      friction={2}
      overshootLeft={false}
      overshootRight={false}
      onSwipeableWillOpen={() => {
        if (swipeRef.current) onWillOpen?.(swipeRef.current);
      }}
      renderLeftActions={() => (
        <View style={{ width: 84, marginRight: 8 }}>
          <ActionWell
            color={colors.primary200}
            icon={Pencil}
            label={ka.common.edit}
            onPress={() => closeThen(onEdit)}
          />
        </View>
      )}
      renderRightActions={() => (
        <View style={{ width: 84, marginLeft: 8 }}>
          <ActionWell color={colors.danger} icon={Trash2} label={ka.pets.archiveAction} onPress={() => closeThen(onArchive)} />
        </View>
      )}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={pet.name}
        onPress={onOpen}
        className="active:opacity-90"
        style={{
          ...FLAT,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
          minHeight: 88,
          padding: 12,
          borderRadius: 22,
          borderWidth: 1,
          borderColor: colors.bg300,
          backgroundColor: colors.surface,
        }}
      >
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 32,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: dark ? colors.accent100 : '#F0FDFA',
            borderWidth: 2,
            borderColor: colors.primary200,
          }}
        >
          <PetPhoto photoUrl={pet.photoUrl} name={pet.name} size={56} />
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
          <Text numberOfLines={1} style={{ fontFamily: GEO.title, fontSize: 17, lineHeight: 22, color: colors.text100 }}>
            {pet.name}
          </Text>
          <Text numberOfLines={2} style={{ fontFamily: GEO.regular, fontSize: 13, lineHeight: 18, color: colors.text300 }}>
            {petMeta(pet)}
          </Text>
          <View
            style={{
              alignSelf: 'flex-start',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: 999,
              backgroundColor: colors.accent100,
              borderWidth: 1,
              borderColor: colors.bg300,
            }}
          >
            <SpeciesIcon size={12} color={colors.primary200} strokeWidth={2.2} />
            <Text style={{ fontFamily: GEO.semibold, fontSize: 11, color: colors.primary200 }}>
              {getSpecies(pet.speciesId)?.labelKa || ka.pets.species}
            </Text>
          </View>
        </View>
        <ChevronRight size={18} color={colors.text300} strokeWidth={2.2} />
      </Pressable>
    </Swipeable>
  );
}
