import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { ArrowUpRight, CalendarCheck2, HeartPulse, MessageCircle, PawPrint, Plus, Scale } from 'lucide-react-native';
import type { Pet } from '@/lib/api';
import { getSpecies } from '@/lib/petsCatalog';
import { formatPetAgeKa } from '@/lib/petsAge';
import { ka } from '@/i18n/ka';
import { useThemeColors } from '@/theme/colors';
import { PetPhoto } from './PetPhoto';
import { PetAction, PetButton, PetIntro, PetPanel, PetText } from './PetUi';
import { PetErrorText, PetFilterChip } from './PetScreen';

export function PetsHubView({ pets, error, offline, onNavigate, onRetry }: { pets: Pet[]; error?: string | null; offline?: boolean; onNavigate: (path: string) => void; onRetry: () => void }) {
  const c = useThemeColors(), [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = pets.find(pet => pet.id === selectedId) ?? pets[0];
  return <View style={{ gap: 22 }}>
    <PetIntro title="მათი პატარა სამყარო." body="მეტი ზრუნვა, ნაკლები დავიწყება. შენი ცხოველების ამბები და ყოველდღიური მოვლა ერთ სივრცეში." />
    {error ? <View style={{ gap: 8 }}><PetErrorText message={error} /><PetButton label="განახლება" variant="secondary" onPress={onRetry} /></View> : null}
    {!pets.length && !error ? <PetPanel><View style={{ gap: 16 }}><View style={{ width: 64, height: 64, borderRadius: 22, backgroundColor: c.accent100, alignItems: 'center', justifyContent: 'center' }}><PawPrint size={30} color={c.primary100} /></View><PetText size={21} bold>პირველი ნაბიჯი — გაცნობა.</PetText><PetText muted>დაიწყე სახელითა და სახეობით. ფოტო, ასაკი და სხვა დეტალები მოგვიანებითაც შეგიძლია დაამატო.</PetText><PetButton label="ცხოველის დამატება" icon={Plus} onPress={() => onNavigate('/pets/new')} /></View></PetPanel> : null}
    {pets.length ? <View style={{ gap: 12 }}><View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><PetText size={17} bold>ჩემი ცხოველები · {pets.length}</PetText><Pressable accessibilityRole="button" accessibilityLabel="ცხოველის დამატება" onPress={() => onNavigate('/pets/new')} style={{ minWidth: 44, minHeight: 44, borderRadius: 16, backgroundColor: c.accent100, alignItems: 'center', justifyContent: 'center' }}><Plus size={21} color={c.primary100} /></Pressable></View>{pets.map(pet => <PetPanel key={pet.id} onPress={() => onNavigate(`/pets/${pet.id}`)}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}><PetPhoto photoUrl={pet.photoUrl} name={pet.name} size={66} /><View style={{ flex: 1, gap: 4 }}><PetText size={19} bold>{pet.name}</PetText><PetText size={12} muted>{getSpecies(pet.speciesId)?.labelKa} · {formatPetAgeKa(pet.age, ka.pets)}</PetText><PetText size={12} color={c.primary100}>პროფილი და ჩანაწერები</PetText></View><ArrowUpRight size={20} color={c.primary100} /></View></PetPanel>)}</View> : null}
    {selected ? <View style={{ gap: 12 }}><PetText size={17} bold>ზრუნვა · {selected.name}</PetText>{pets.length > 1 ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>{pets.map(pet => <PetFilterChip key={pet.id} selected={selected.id === pet.id} label={pet.name} onPress={() => setSelectedId(pet.id)} />)}</ScrollView> : null}<PetAction icon={CalendarCheck2} title="მოვლის კალენდარი" body="დაგეგმე პროცედურები და ნახე, რა გაქვს შესასრულებელი." onPress={() => onNavigate(`/pets/${selected.id}/care`)} /><View style={{ flexDirection: 'row', gap: 10 }}><PetAction compact icon={Scale} title="წონის ჩანაწერი" body="გაზომვები და ცვლილება" onPress={() => onNavigate(`/pets/${selected.id}/weight`)} /><PetAction compact icon={MessageCircle} title="Medi Vet" body="AI დამხმარე ზრუნვაში" onPress={() => onNavigate(`/pets/${selected.id}/chat`)} /></View>{offline ? <PetText size={12} muted>ნაჩვენებია შენახული სია. ახალი ჩანაწერისთვის ინტერნეტკავშირი დაგჭირდება.</PetText> : null}</View> : null}
    <PetPanel><View style={{ gap: 12 }}><PetText bold>როგორ დავიწყო?</PetText>{[{ title: '01 · შექმენი პროფილი', body: 'თითოეულ ცხოველს თავისი ჩანაწერები და ისტორია აქვს.' }, { title: '02 · შეინახე და დაგეგმე', body: 'უკვე ჩატარებული პროცედურა ჩაწერე ისტორიაში, მომავალი კი მოვლის გეგმაში.' }, { title: '03 · მიჰყევი ცვლილებებს', body: 'დაამატე წონა, ალერგიები და მდგომარეობები. საჭიროებისას ინფორმაცია ვეტერინარს გაუზიარე.' }].map(item => <View key={item.title} style={{ gap: 4 }}><PetText bold size={13} color={c.primary100}>{item.title}</PetText><PetText size={12} muted>{item.body}</PetText></View>)}<View style={{ height: 1, backgroundColor: c.bg300 }} /><PetText size={12} muted>Medi Vet ინფორმაციის გაგებაში გეხმარება. დიაგნოზისა და მკურნალობისთვის მიმართე ვეტერინარს.</PetText></View></PetPanel>
  </View>;
}
