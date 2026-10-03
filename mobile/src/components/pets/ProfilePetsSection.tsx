import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronRight, HeartPulse, Plus, RotateCw } from 'lucide-react-native';
import { PETS_ART } from '@/constants/appArt';
import { HomeSectionTitle } from '@/components/home/HomeSectionTitle';
import { Bone } from '@/components/ui/Skeleton';
import { formatPetAgeKa } from '@/lib/petsAge';
import { ka } from '@/i18n/ka';
import { PetPhoto } from './PetPhoto';
import { PetText } from './PetUi';
import { usePetList } from './usePetList';
import { useIsDark, useThemeColors } from '@/theme/colors';
import { HUB, hubInk, hubText, hubTint } from '@/theme/hub';
import { tx } from '@/i18n/locale';

const AVATAR = 60;

/** Profile → „ჩემი ცხოველები“: pets as a row of avatars (tap = profile), an add circle, and one row into the care space. */
export function ProfilePetsSection({ hideTitle = false }: { hideTitle?: boolean } = {}) {
  const router = useRouter();
  const c = useThemeColors();
  const dark = useIsDark();
  const { pets, ready, error, reload } = usePetList();
  const ink = hubInk('teal', dark);

  const title = hideTitle ? null : (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <HomeSectionTitle title={tx('ჩემი ცხოველები', 'My pets')} style={{ marginBottom: 0 }} />
      <Pressable accessibilityRole="button" onPress={() => router.push('/pets')} style={{ minHeight: 44, justifyContent: 'center' }}>
        <PetText size={13} color={c.primary100}>{tx('ყველას ნახვა', 'See all')}</PetText>
      </Pressable>
    </View>
  );

  if (!ready) {
    return (
      <View style={{ gap: 10 }}>
        {title}
        <Bone height={150} radius={HUB.cardRadius} />
      </View>
    );
  }

  return (
    <View style={{ gap: 10 }}>
      {title}
      <View style={[s.card, { backgroundColor: c.surface }]}>
        {pets.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.strip}>
            {pets.map((pet) => {
              const age = formatPetAgeKa(pet.age, ka.pets);
              return (
                <Pressable
                  key={pet.id}
                  accessibilityRole="button"
                  accessibilityLabel={tx(`${pet.name} — პროფილი`, `${pet.name} — profile`)}
                  onPress={() => router.push(`/pets/${pet.id}`)}
                  style={s.pet}
                >
                  <View style={[s.ring, { borderColor: `${ink}55` }]}>
                    <PetPhoto photoUrl={pet.photoUrl} name={pet.name} speciesId={pet.speciesId} size={AVATAR} />
                  </View>
                  <Text numberOfLines={1} style={[hubText.link, { color: c.text100, maxWidth: AVATAR + 24 }]}>
                    {pet.name}
                  </Text>
                  <Text numberOfLines={1} style={[hubText.small, { color: c.text300, maxWidth: AVATAR + 24, marginTop: -2 }]}>
                    {age}
                  </Text>
                </Pressable>
              );
            })}
            <Pressable accessibilityRole="button" accessibilityLabel={tx('ცხოველის დამატება', 'Add a pet')} onPress={() => router.push('/pets/new')} style={s.pet}>
              <View style={[s.add, { borderColor: c.bg300, backgroundColor: dark ? c.bg200 : c.bg100 }]}>
                <Plus size={22} color={c.primary200} strokeWidth={2.4} />
              </View>
              <Text numberOfLines={1} style={[hubText.link, { color: c.primary200 }]}>{tx('დამატება', 'Add')}</Text>
            </Pressable>
          </ScrollView>
        ) : error ? (
          <View style={[s.empty, { paddingBottom: 14 }]}>
            <Text style={[hubText.caption, { flex: 1, color: c.text200 }]}>{error}</Text>
            <Pressable accessibilityRole="button" onPress={() => void reload()} style={[s.pill, { backgroundColor: hubTint(ink, dark) }]}>
              <RotateCw size={14} color={ink} strokeWidth={2.2} />
              <Text style={[hubText.link, { color: ink }]}>{tx('ხელახლა', 'Retry')}</Text>
            </Pressable>
          </View>
        ) : (
          <View style={[s.empty, { paddingBottom: 14 }]}>
            <Image source={PETS_ART.dog} resizeMode="contain" accessibilityIgnoresInvertColors style={{ width: 52, height: 52 }} />
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <Text style={[hubText.cardTitle, { color: c.text100 }]}>{tx('ზრუნვა პატარა მეგობრებზე', 'Care for little friends')}</Text>
              <Text numberOfLines={2} style={[hubText.small, { color: c.text300 }]}>
                {tx('პროფილი, მოვლის გეგმა და MEDIVET — ერთ ადგილას.', 'Profile, care plan and MEDIVET — in one place.')}
              </Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={tx('ცხოველის დამატება', 'Add a pet')} onPress={() => router.push('/pets/new')} style={[s.addSmall, { backgroundColor: '#0D9488' }]}>
              <Plus size={20} color="#FFFFFF" strokeWidth={2.4} />
            </Pressable>
          </View>
        )}

        {error && pets.length ? <Text style={[hubText.small, { color: c.text300, paddingHorizontal: 16, paddingBottom: 8 }]}>{error}</Text> : null}

        {pets.length ? (
          <>
            <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.bg300, marginHorizontal: 14 }} />
            <Pressable accessibilityRole="button" onPress={() => router.push('/pets')} style={s.row}>
              <View style={[s.rowIcon, { backgroundColor: hubTint(hubInk('rose', dark), dark) }]}>
                <HeartPulse size={17} color={hubInk('rose', dark)} strokeWidth={2} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={[hubText.cardTitle, { fontSize: 14, lineHeight: 20, color: c.text100 }]}>
                  {tx('ზრუნვის სივრცე', 'Care space')}
                </Text>
                <Text numberOfLines={1} style={[hubText.small, { color: c.text300 }]}>
                  {tx('მოვლის გეგმა, წონა და MEDIVET', 'Care plan, weight and MEDIVET')}
                </Text>
              </View>
              <ChevronRight size={16} color={c.text300} strokeWidth={2} />
            </Pressable>
          </>
        ) : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: HUB.cardRadius, overflow: 'hidden' },
  strip: { paddingHorizontal: 12, paddingTop: 16, paddingBottom: 12, gap: 6 },
  pet: { alignItems: 'center', gap: 4, minWidth: AVATAR + 20, paddingHorizontal: 2 },
  ring: { borderRadius: (AVATAR + 8) / 2, borderWidth: 2, padding: 2 },
  add: {
    width: AVATAR + 8,
    height: AVATAR + 8,
    borderRadius: (AVATAR + 8) / 2,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 14 },
  addSmall: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, borderRadius: 17, paddingHorizontal: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingHorizontal: 14, paddingVertical: 9 },
  rowIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
