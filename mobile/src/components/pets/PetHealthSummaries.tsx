import React, { useCallback, useRef, useState } from 'react';
import { View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Scale, ShieldAlert, Stethoscope } from 'lucide-react-native';
import { api, type PetAllergy, type PetCondition, type PetWeightLog } from '@/lib/api';
import { localAccountId } from '@/lib/localAccount';
import { formatPetWeight } from '@/lib/petsHealth';
import { formatCycleDateKa } from '@/lib/cycleCivilDateKa';
import { ka } from '@/i18n/ka';
import { Bone } from '@/components/ui/Skeleton';
import { PetAction, PetButton, PetText } from './PetUi';

export function PetHealthSummaries({ petId }: { petId: string }) {
  const router = useRouter(), revision = useRef(0);
  const [state, setState] = useState<{ ready: boolean; errors: string[]; weight: PetWeightLog | null; allergies: PetAllergy[]; conditions: PetCondition[] }>({ ready: false, errors: [], weight: null, allergies: [], conditions: [] });
  const load = useCallback(async () => {
    const request = ++revision.current, owner = localAccountId();
    const [weight, allergies, conditions] = await Promise.allSettled([api.pets.weight.list(petId, { limit: 30 }), api.pets.allergies.list(petId), api.pets.conditions.list(petId)]);
    if (request !== revision.current || owner !== localAccountId()) return;
    setState({ ready: true, errors: [weight.status === 'rejected' ? 'weight' : '', allergies.status === 'rejected' ? 'allergies' : '', conditions.status === 'rejected' ? 'conditions' : ''].filter(Boolean), weight: weight.status === 'fulfilled' ? weight.value.latest : null, allergies: allergies.status === 'fulfilled' ? allergies.value.items : [], conditions: conditions.status === 'fulfilled' ? conditions.value.items : [] });
  }, [petId]);
  useFocusEffect(useCallback(() => { void load(); return () => { revision.current++; }; }, [load]));
  if (!state.ready) return <Bone height={170} radius={24} />;
  const error = 'ჩანაწერები ვერ ჩაიტვირთა — შეეხე ხელახლა სანახავად.';
  return <View style={{ gap: 12 }}>
    <PetAction title="წონის ჩანაწერები" icon={Scale} body={state.errors.includes('weight') ? error : state.weight ? `${formatPetWeight(state.weight, ka.pets)} · ${formatCycleDateKa(state.weight.recordedOn)}` : 'პირველი გაზომვა ჯერ არ დაგიმატებია.'} onPress={() => router.push(`/pets/${petId}/weight`)} />
    <PetAction title="ალერგიები" icon={ShieldAlert} body={state.errors.includes('allergies') ? error : state.allergies.length ? state.allergies.slice(0, 3).map(item => item.name).join(' · ') : 'ჯერ არ არის ჩანაწერი. ეს ალერგიის არარსებობას არ ადასტურებს.'} onPress={() => router.push(`/pets/${petId}/allergies`)} />
    <PetAction title="მდგომარეობები და ისტორია" icon={Stethoscope} body={state.errors.includes('conditions') ? error : state.conditions.length ? `${state.conditions.filter(item => item.status === 'active').length} მიმდინარე · ${state.conditions.length} ჩანაწერი სულ` : 'შეინახე დაკვირვებები და ვეტერინარის მიერ დადასტურებული მდგომარეობები.'} onPress={() => router.push(`/pets/${petId}/conditions`)} />
    {state.errors.length ? <PetButton variant="secondary" label="ჩანაწერების განახლება" onPress={() => void load()} /> : null}
  </View>;
}
