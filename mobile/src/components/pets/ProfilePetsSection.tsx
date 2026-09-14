import React, { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { ChevronRight, PawPrint } from 'lucide-react-native';
import { HomeSectionTitle } from '@/components/home/HomeSectionTitle';
import { PetPhoto } from '@/components/pets/PetPhoto';
import { Card } from '@/components/ui/Card';
import { ka } from '@/i18n/ka';
import { ApiError, api, type Pet } from '@/lib/api';
import { cachePetsList, loadCachedPetsList } from '@/lib/petsDraft';
import { useThemeColors } from '@/theme/colors';

export function ProfilePetsSection() {
  const colors = useThemeColors();
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

  const preview = pets.slice(0, 3);

  return (
    <View className="mt-5">
      <HomeSectionTitle title={ka.pets.hubTitle} />
      {pets.length === 0 ? (
        <Card onPress={() => router.push('/pets/new')}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                backgroundColor: colors.accent100,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <PawPrint size={20} color={colors.primary200} strokeWidth={2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 15, color: colors.text100 }}>
                {ka.pets.add}
              </Text>
              <Text style={{ marginTop: 2, fontSize: 13, color: colors.text300 }}>{ka.pets.emptyBody}</Text>
            </View>
          </View>
        </Card>
      ) : (
        <Card padded={false}>
          {preview.map((pet, index) => (
            <Pressable
              key={pet.id}
              accessibilityRole="button"
              accessibilityLabel={pet.name}
              onPress={() => router.push(`/pets/${pet.id}`)}
              className="active:opacity-80"
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                paddingHorizontal: 14,
                paddingVertical: 12,
                minHeight: 64,
                borderTopWidth: index === 0 ? 0 : 1,
                borderTopColor: colors.bg300,
              }}
            >
              <PetPhoto photoUrl={pet.photoUrl} name={pet.name} size={44} />
              <Text style={{ flex: 1, fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 15, color: colors.text100 }}>
                {pet.name}
              </Text>
            </Pressable>
          ))}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={ka.pets.seeAll}
            onPress={() => router.push('/pets')}
            className="active:opacity-80"
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 14,
              paddingVertical: 14,
              minHeight: 48,
              borderTopWidth: 1,
              borderTopColor: colors.bg300,
            }}
          >
            <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, color: colors.primary200 }}>
              {ka.pets.seeAll}
            </Text>
            <ChevronRight size={18} color={colors.primary200} strokeWidth={2} />
          </Pressable>
        </Card>
      )}
    </View>
  );
}
