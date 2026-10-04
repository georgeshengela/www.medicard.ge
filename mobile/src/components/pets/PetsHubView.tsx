import React, { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { CalendarCheck2, ChevronRight, MessageCircle, Plus, Scale } from 'lucide-react-native';
import type { Pet } from '@/lib/api';
import { getSpecies } from '@/lib/petsCatalog';
import { formatPetAgeKa } from '@/lib/petsAge';
import { ka } from '@/i18n/ka';
import { useThemeColors } from '@/theme/colors';
import { HUB } from '@/theme/hub';
import { PETS_ART } from '@/constants/appArt';
import { HomeSectionHeading } from '@/components/home/HomeSectionHeading';
import { PetPhoto } from './PetPhoto';
import { PetAction, PetButton, PetPanel, PetText } from './PetUi';
import { PetErrorText, PetFilterChip } from './PetScreen';
import { tx } from '@/i18n/locale';

/**
 * MEDIVET hub: her pets in one list, then care for the chosen pet (calendar, weight, MEDIVET chat).
 * With no pet yet: one card that explains the three steps and adds the first one.
 */
export function PetsHubView({ pets, error, offline, onNavigate, onRetry }: { pets: Pet[]; error?: string | null; offline?: boolean; onNavigate: (path: string) => void; onRetry: () => void }) {
  const c = useThemeColors();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = pets.find((pet) => pet.id === selectedId) ?? pets[0];

  return (
    <View style={{ gap: HUB.sectionGap }}>
      {error ? (
        <View style={{ gap: 8 }}>
          <PetErrorText message={error} />
          <PetButton label={tx('განახლება', 'Refresh')} variant="secondary" onPress={onRetry} />
        </View>
      ) : null}

      {!pets.length && !error ? (
        <PetPanel>
          <View style={{ gap: 14 }}>
            <Image source={PETS_ART.empty} resizeMode="contain" accessibilityIgnoresInvertColors style={{ width: 132, height: 132, alignSelf: 'center' }} />
            <PetText size={19} bold>{tx('პირველი ნაბიჯი — გაცნობა', 'First step — introductions')}</PetText>
            <PetText size={13} muted>{tx('დაიწყე სახელითა და სახეობით. ფოტო, ასაკი და სხვა დეტალები მოგვიანებითაც შეგიძლია დაამატო.', 'Start with a name and species. You can add a photo, age and other details later.')}</PetText>
            <View style={{ gap: 10 }}>
              {[
                { title: tx('შექმენი პროფილი', 'Create a profile'), body: tx('თითოეულ ცხოველს თავისი ჩანაწერები და ისტორია აქვს.', 'Each pet has their own records and history.') },
                { title: tx('შეინახე და დაგეგმე', 'Save and plan'), body: tx('ჩატარებული პროცედურა — ისტორიაში, მომავალი — მოვლის გეგმაში.', 'Done procedures go to the history, upcoming ones to the care plan.') },
                { title: tx('მიჰყევი ცვლილებებს', 'Follow changes'), body: tx('წონა, ალერგიები და მდგომარეობები ერთ ადგილას.', 'Weight, allergies and conditions in one place.') },
              ].map((step, index) => (
                <View key={step.title} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                  <View style={[s.step, { backgroundColor: c.accent100 }]}>
                    <PetText size={13} bold color={c.primary100}>{index + 1}</PetText>
                  </View>
                  <View style={{ flex: 1, gap: 1 }}>
                    <PetText size={14} bold>{step.title}</PetText>
                    <PetText size={12} muted>{step.body}</PetText>
                  </View>
                </View>
              ))}
            </View>
            <PetButton label={tx('ცხოველის დამატება', 'Add a pet')} icon={Plus} onPress={() => onNavigate('/pets/new')} />
          </View>
        </PetPanel>
      ) : null}

      {pets.length ? (
        <View>
          <HomeSectionHeading title={tx(`ჩემი ცხოველები · ${pets.length}`, `My pets · ${pets.length}`)} />
          <View style={[s.group, { backgroundColor: c.surface }]}>
            {pets.map((pet, index) => (
              <Pressable
                key={pet.id}
                accessibilityRole="button"
                accessibilityLabel={`${pet.name}. ${getSpecies(pet.speciesId)?.labelKa ?? ''} · ${formatPetAgeKa(pet.age, ka.pets)}`}
                onPress={() => onNavigate(`/pets/${pet.id}`)}
                style={s.petRow}
              >
                <PetPhoto photoUrl={pet.photoUrl} name={pet.name} speciesId={pet.speciesId} size={56} />
                <View style={[s.petText, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.bg300 }]}>
                  <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
                    <PetText size={17} bold>{pet.name}</PetText>
                    <PetText size={12.5} muted>{getSpecies(pet.speciesId)?.labelKa} · {formatPetAgeKa(pet.age, ka.pets)}</PetText>
                  </View>
                  <ChevronRight size={18} color={c.text300} strokeWidth={2.2} />
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {selected ? (
        <View>
          <HomeSectionHeading title={tx(`ზრუნვა · ${selected.name}`, `Care · ${selected.name}`)} />
          {pets.length > 1 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -HUB.gutter, marginBottom: 12 }} contentContainerStyle={{ gap: 8, paddingHorizontal: HUB.gutter }}>
              {pets.map((pet) => <PetFilterChip key={pet.id} selected={selected.id === pet.id} label={pet.name} onPress={() => setSelectedId(pet.id)} />)}
            </ScrollView>
          ) : null}
          <View style={{ gap: 10 }}>
            <PetAction icon={CalendarCheck2} art={PETS_ART.calendar} title={tx('მოვლის კალენდარი', 'Care calendar')} body={tx('დაგეგმე პროცედურები და ნახე, რა გაქვს შესასრულებელი.', 'Plan procedures and see what’s coming up.')} onPress={() => onNavigate(`/pets/${selected.id}/care`)} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <PetAction compact icon={Scale} art={PETS_ART.weight} title={tx('წონა', 'Weight')} body={tx('გაზომვები და ცვლილება', 'Measurements and change')} onPress={() => onNavigate(`/pets/${selected.id}/weight`)} />
              <PetAction compact icon={MessageCircle} art={PETS_ART.vet} title="MEDIVET" body={tx('AI დამხმარე ზრუნვაში', 'AI help with care')} onPress={() => onNavigate(`/pets/${selected.id}/chat`)} />
            </View>
            {offline ? <PetText size={12} muted>{tx('ნაჩვენებია შენახული სია. ახალი ჩანაწერისთვის ინტერნეტკავშირი დაგჭირდება.', 'Showing the saved list. You’ll need an internet connection to add a new record.')}</PetText> : null}
          </View>
          <View style={{ marginTop: 12, marginHorizontal: 4 }}>
            <PetText size={12} muted>{tx('MEDIVET ინფორმაციის გაგებაში გეხმარება. დიაგნოზისა და მკურნალობისთვის მიმართე ვეტერინარს.', 'MEDIVET helps you understand information. For diagnosis and treatment, see a vet.')}</PetText>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  group: { borderRadius: HUB.cardRadius, overflow: 'hidden' },
  petRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingLeft: 14 },
  petText: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 14, paddingRight: 14, alignSelf: 'stretch' },
  step: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
});
