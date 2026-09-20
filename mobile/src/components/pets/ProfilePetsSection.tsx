import React from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowUpRight, PawPrint, Plus } from 'lucide-react-native';
import { HomeSectionTitle } from '@/components/home/HomeSectionTitle';
import { Bone } from '@/components/ui/Skeleton';
import { PetPhoto } from './PetPhoto';
import { PetButton, PetPanel, PetText } from './PetUi';
import { usePetList } from './usePetList';
import { useThemeColors } from '@/theme/colors';

export function ProfilePetsSection() {
  const router = useRouter(), c = useThemeColors(), { pets, ready, error, reload } = usePetList();
  return <View style={{ gap: 10 }}><View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><HomeSectionTitle title="ჩემი ცხოველები" style={{ marginBottom: 0 }} /><Pressable accessibilityRole="button" onPress={() => router.push('/pets')} style={{ minHeight: 44, justifyContent: 'center' }}><PetText size={13} color={c.primary100}>ყველას ნახვა</PetText></Pressable></View>{!ready ? <Bone height={160} radius={24} /> : <PetPanel><View style={{ gap: 14 }}><View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}><View style={{ width: 46, height: 46, borderRadius: 16, backgroundColor: c.accent100, alignItems: 'center', justifyContent: 'center' }}><PawPrint size={24} color={c.primary100} /></View><View style={{ flex: 1 }}><PetText size={17} bold>{pets.length ? 'მათი ზრუნვის სივრცე' : 'ზრუნვა პატარა მეგობრებზე'}</PetText><PetText size={12} muted>პროფილი, მოვლის გეგმა და Medi Vet</PetText></View></View>{pets.length ? <><View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>{pets.slice(0, 3).map(pet => <Pressable key={pet.id} accessibilityRole="button" accessibilityLabel={`${pet.name} — პროფილი`} onPress={() => router.push(`/pets/${pet.id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 7, padding: 7, paddingRight: 12, borderRadius: 16, backgroundColor: c.surfaceRaised, maxWidth: '100%' }}><PetPhoto photoUrl={pet.photoUrl} name={pet.name} size={32} /><PetText size={13} bold>{pet.name}</PetText></Pressable>)}</View><PetButton variant="secondary" label={pets.length > 3 ? `ყველა ცხოველი · ${pets.length}` : 'ზრუნვის სივრცის გახსნა'} icon={ArrowUpRight} onPress={() => router.push('/pets')} /></> : error ? <><PetText size={13} muted>{error}</PetText><PetButton variant="secondary" label="ხელახლა ცდა" onPress={() => void reload()} /></> : <><PetText muted>დაუმატე შენს ცხოველს პირადი პროფილი და შეინახე მისთვის მნიშვნელოვანი ამბები.</PetText><PetButton label="ცხოველის დამატება" icon={Plus} onPress={() => router.push('/pets/new')} /></>}{error && pets.length ? <PetText size={12} muted>{error}</PetText> : null}</View></PetPanel>}</View>;
}
