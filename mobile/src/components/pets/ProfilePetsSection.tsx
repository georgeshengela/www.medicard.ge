import React, { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  Bird,
  Cat,
  ChevronRight,
  Dog,
  Fence,
  Fish,
  HeartPulse,
  MessageCircle,
  PawPrint,
  Plus,
  Rabbit,
  Rat,
  Turtle,
  type LucideIcon,
} from 'lucide-react-native';
import { HomeSectionTitle } from '@/components/home/HomeSectionTitle';
import { PetPhoto } from '@/components/pets/PetPhoto';
import { ka } from '@/i18n/ka';
import { ApiError, api, type Pet } from '@/lib/api';
import { cachePetsList, loadCachedPetsList } from '@/lib/petsDraft';
import { formatPetAgeKa } from '@/lib/petsAge';
import { getSpecies } from '@/lib/petsCatalog';
import { FIGMA_AUTH_DARK } from '@/constants/figmaAuthLayout';
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
  return [breedLabel(pet), age].filter(Boolean).join(' · ');
}

function PhotoHalo({ pet, size = 72 }: { pet: Pet; size?: number }) {
  const colors = useThemeColors();
  const dark = useIsDark();
  const ring = size + 8;

  return (
    <View
      style={{
        width: ring,
        height: ring,
        borderRadius: ring / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: dark ? colors.accent100 : '#F0FDFA',
        borderWidth: 2,
        borderColor: colors.primary200,
      }}
    >
      <PetPhoto photoUrl={pet.photoUrl} name={pet.name} size={size} />
    </View>
  );
}

function ActionChip({
  icon: Icon,
  label,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  const dark = useIsDark();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className="active:opacity-80"
      style={{
        ...FLAT,
        flex: 1,
        minWidth: 0,
        minHeight: 56,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.bg300,
        backgroundColor: dark ? colors.surfaceRaised : colors.bg100,
      }}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 10,
          backgroundColor: colors.accent100,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon size={16} color={colors.primary200} strokeWidth={2.2} />
      </View>
      <Text
        numberOfLines={1}
        style={{ flex: 1, fontFamily: GEO.semibold, fontSize: 13, lineHeight: 18, color: colors.text100 }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function ExtraPetsRow({ pets, onOpen }: { pets: Pet[]; onOpen: (id: string) => void }) {
  const colors = useThemeColors();
  const dark = useIsDark();
  if (!pets.length) return null;

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
      {pets.map((pet) => (
        <Pressable
          key={pet.id}
          accessibilityRole="button"
          accessibilityLabel={pet.name}
          onPress={() => onOpen(pet.id)}
          className="active:opacity-80"
          style={{
            ...FLAT,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingRight: 10,
            paddingLeft: 4,
            paddingVertical: 4,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: colors.bg300,
            backgroundColor: dark ? colors.surfaceRaised : colors.bg100,
          }}
        >
          <PetPhoto photoUrl={pet.photoUrl} name={pet.name} size={28} />
          <Text numberOfLines={1} style={{ maxWidth: 88, fontFamily: GEO.semibold, fontSize: 12, color: colors.text100 }}>
            {pet.name}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export function ProfilePetsSection() {
  const colors = useThemeColors();
  const dark = useIsDark();
  const router = useRouter();
  const [pets, setPets] = useState<Pet[]>([]);

  const load = useCallback(async () => {
    try {
      const cached = await loadCachedPetsList();
      if (cached.length) setPets(cached as Pet[]);
      const { pets: rows } = await api.pets.list();
      setPets(rows);
      await cachePetsList(rows);
    } catch (error) {
      if (error instanceof ApiError && error.status === 503) {
        setPets([]);
        return;
      }
      const cached = await loadCachedPetsList();
      setPets(cached as Pet[]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const featured = pets[0] ?? null;
  const extras = pets.slice(1, 4);
  const SpeciesIcon = featured ? speciesIcon(featured.speciesId) : PawPrint;
  const openPet = (id: string) => router.push(`/pets/${id}`);
  const openNew = () => router.push('/pets/new');
  const openManage = () => router.push('/pets');
  const cardHref = featured ? `/pets/${featured.id}` : '/pets/new';
  const a11y = featured
    ? [ka.pets.hubTitle, featured.name, petMeta(featured)].filter(Boolean).join('. ')
    : `${ka.pets.hubTitle}. ${ka.pets.emptyTitle}`;
  const wash = dark ? colors.accent100 : '#CCFBF1';
  const ctaBg = dark ? FIGMA_AUTH_DARK.primaryBg : colors.primary200;

  return (
    <View className="mt-5">
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
        <HomeSectionTitle title={ka.pets.hubTitle} style={{ marginBottom: 0, flex: 1 }} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={ka.pets.seeAll}
          onPress={openManage}
          hitSlop={8}
          className="active:opacity-80"
          style={{
            ...FLAT,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 2,
            paddingVertical: 4,
            paddingLeft: 12,
          }}
        >
          <Text style={{ fontFamily: GEO.semibold, fontSize: 13, color: colors.primary200 }}>{ka.pets.seeAll}</Text>
          <ChevronRight size={16} color={colors.primary200} strokeWidth={2.2} />
        </Pressable>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={a11y}
        onPress={() => router.push(cardHref)}
        className="active:opacity-90"
        style={{
          ...FLAT,
          borderRadius: 24,
          borderWidth: 1,
          borderColor: colors.bg300,
          overflow: 'hidden',
        }}
      >
        <LinearGradient
          colors={dark ? [colors.surface, wash] : ['#FFFFFF', wash]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1.1, y: 1.2 }}
          style={{ padding: 16 }}
        >
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              right: -40,
              top: -48,
              width: 150,
              height: 150,
              borderRadius: 75,
              backgroundColor: wash,
              opacity: dark ? 0.9 : 0.55,
            }}
          />
          <View pointerEvents="none" style={{ position: 'absolute', right: -18, bottom: -28, opacity: dark ? 0.12 : 0.1 }}>
            <PawPrint size={128} color={colors.primary200} strokeWidth={1.4} />
          </View>

          {featured ? (
            <View style={{ gap: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <PhotoHalo pet={featured} />
                <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
                  <Text
                    numberOfLines={1}
                    style={{ fontFamily: GEO.title, fontSize: 18, lineHeight: 24, color: colors.text100 }}
                  >
                    {featured.name}
                  </Text>
                  <Text numberOfLines={2} style={{ fontFamily: GEO.regular, fontSize: 13, lineHeight: 18, color: colors.text300 }}>
                    {petMeta(featured)}
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
                      {getSpecies(featured.speciesId)?.labelKa || ka.pets.species}
                    </Text>
                  </View>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={ka.pets.addAnother}
                  onPress={openNew}
                  hitSlop={8}
                  className="active:opacity-80"
                  style={{
                    ...FLAT,
                    width: 40,
                    height: 40,
                    borderRadius: 14,
                    backgroundColor: colors.accent100,
                    borderWidth: 1,
                    borderColor: colors.bg300,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Plus size={20} color={colors.primary200} strokeWidth={2.2} />
                </Pressable>
              </View>

              <View style={{ flexDirection: 'row', gap: 8 }}>
                <ActionChip
                  icon={MessageCircle}
                  label={ka.pets.vetName}
                  onPress={() => router.push(`/pets/${featured.id}/chat`)}
                />
                <ActionChip
                  icon={HeartPulse}
                  label={ka.pets.careTitle}
                  onPress={() => router.push(`/pets/${featured.id}/care`)}
                />
              </View>

              <ExtraPetsRow pets={extras} onOpen={openPet} />
            </View>
          ) : (
            <View style={{ gap: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <View
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 22,
                    backgroundColor: colors.accent100,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 1,
                    borderColor: colors.bg300,
                  }}
                >
                  <PawPrint size={28} color={colors.primary200} strokeWidth={2.2} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontFamily: GEO.title, fontSize: 18, lineHeight: 24, color: colors.text100 }}>
                    {ka.pets.emptyTitle}
                  </Text>
                  <Text style={{ marginTop: 4, fontFamily: GEO.regular, fontSize: 13, lineHeight: 18, color: colors.text300 }}>
                    {ka.pets.emptyBody}
                  </Text>
                </View>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={ka.pets.add}
                onPress={openNew}
                className="active:opacity-90"
                style={{
                  ...FLAT,
                  minHeight: 48,
                  borderRadius: 16,
                  backgroundColor: ctaBg,
                  paddingHorizontal: 14,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Text style={{ fontFamily: GEO.title, fontSize: 15, color: '#FFFFFF' }}>{ka.pets.add}</Text>
                <ChevronRight size={18} color="#FFFFFF" strokeWidth={2.2} />
              </Pressable>
            </View>
          )}
        </LinearGradient>
      </Pressable>
    </View>
  );
}
