import React from 'react';
import { Image, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowUpRight, Plus } from 'lucide-react-native';
import { PETS_ART } from '@/constants/appArt';
import { HomeSectionTitle } from '@/components/home/HomeSectionTitle';
import { Bone } from '@/components/ui/Skeleton';
import { PetPhoto } from './PetPhoto';
import { PetButton, PetPanel, PetText } from './PetUi';
import { usePetList } from './usePetList';
import { useThemeColors } from '@/theme/colors';
import { tx } from '@/i18n/locale';

export function ProfilePetsSection({ hideTitle = false }: { hideTitle?: boolean } = {}) {
  const router = useRouter(), c = useThemeColors(), { pets, ready, error, reload } = usePetList();
  return <View style={{ gap: 10 }}>{hideTitle ? null : <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><HomeSectionTitle title={tx('ჩემი ცხოველები', 'My pets')} style={{ marginBottom: 0 }} /><Pressable accessibilityRole="button" onPress={() => router.push('/pets')} style={{ minHeight: 44, justifyContent: 'center' }}><PetText size={13} color={c.primary100}>{tx('ყველას ნახვა', 'See all')}</PetText></Pressable></View>}{!ready ? <Bone height={160} radius={24} /> : <PetPanel style={hideTitle ? { borderWidth: 0, borderRadius: 22 } : undefined}><View style={{ gap: 14 }}><View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}><Image source={PETS_ART.dog} resizeMode="contain" accessibilityIgnoresInvertColors style={{ width: 46, height: 46 }} /><View style={{ flex: 1 }}><PetText size={17} bold>{pets.length ? tx('მათი ზრუნვის სივრცე', 'Their care space') : tx('ზრუნვა პატარა მეგობრებზე', 'Care for little friends')}</PetText><PetText size={12} muted>{tx('პროფილი, მოვლის გეგმა და Medi Vet', 'Profile, care plan and Medi Vet')}</PetText></View></View>{pets.length ? <><View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>{pets.slice(0, 3).map(pet => <Pressable key={pet.id} accessibilityRole="button" accessibilityLabel={tx(`${pet.name} — პროფილი`, `${pet.name} — profile`)} onPress={() => router.push(`/pets/${pet.id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 7, padding: 7, paddingRight: 12, borderRadius: 16, backgroundColor: c.surfaceRaised, maxWidth: '100%' }}><PetPhoto photoUrl={pet.photoUrl} name={pet.name} speciesId={pet.speciesId} size={32} /><PetText size={13} bold>{pet.name}</PetText></Pressable>)}</View><PetButton variant="secondary" label={pets.length > 3 ? tx(`ყველა ცხოველი · ${pets.length}`, `All pets · ${pets.length}`) : tx('ზრუნვის სივრცის გახსნა', 'Open care space')} icon={ArrowUpRight} onPress={() => router.push('/pets')} /></> : error ? <><PetText size={13} muted>{error}</PetText><PetButton variant="secondary" label={tx('ხელახლა ცდა', 'Try again')} onPress={() => void reload()} /></> : <><PetText muted>{tx('დაუმატე შენს ცხოველს პირადი პროფილი და შეინახე მისთვის მნიშვნელოვანი ამბები.', 'Add a personal profile for your pet and keep what matters to them.')}</PetText><PetButton label={tx('ცხოველის დამატება', 'Add a pet')} icon={Plus} onPress={() => router.push('/pets/new')} /></>}{error && pets.length ? <PetText size={12} muted>{error}</PetText> : null}</View></PetPanel>}</View>;
}
