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
import { PetButton } from './PetUi';
import { PetListGroup, PetListRow } from './PetScreen';
import { tx } from '@/i18n/locale';
import { PETS_ART } from '@/constants/appArt';

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
  if (!state.ready) return <Bone height={170} radius={22} />;
  const error = tx('ჩანაწერები ვერ ჩაიტვირთა — შეეხე ხელახლა სანახავად.', 'Records couldn’t load — tap to try again.');
  return <View style={{ gap: 12 }}>
    <PetListGroup>
    <PetListRow title={tx('წონა', 'Weight')} icon={Scale} art={PETS_ART.weight} subtitle={state.errors.includes('weight') ? error : state.weight ? `${formatPetWeight(state.weight, ka.pets)} · ${formatCycleDateKa(state.weight.recordedOn)}` : tx('პირველი გაზომვა ჯერ არ დაგიმატებია.', 'You haven’t added a first measurement yet.')} onPress={() => router.push(`/pets/${petId}/weight`)} />
    <PetListRow title={tx('ალერგიები', 'Allergies')} icon={ShieldAlert} art={PETS_ART.allergy} subtitle={state.errors.includes('allergies') ? error : state.allergies.length ? state.allergies.slice(0, 3).map(item => item.name).join(' · ') : tx('ჯერ არ არის ჩანაწერი. ეს ალერგიის არარსებობას არ ადასტურებს.', 'No records yet. This doesn’t confirm there are no allergies.')} onPress={() => router.push(`/pets/${petId}/allergies`)} />
    <PetListRow title={tx('მდგომარეობები', 'Conditions')} icon={Stethoscope} art={PETS_ART.condition} subtitle={state.errors.includes('conditions') ? error : state.conditions.length ? tx(`${state.conditions.filter(item => item.status === 'active').length} მიმდინარე · ${state.conditions.length} ჩანაწერი სულ`, `${state.conditions.filter(item => item.status === 'active').length} current · ${state.conditions.length} ${state.conditions.length === 1 ? 'record' : 'records'} total`) : tx('შეინახე დაკვირვებები და ვეტერინარის მიერ დადასტურებული მდგომარეობები.', 'Save observations and conditions confirmed by a vet.')} onPress={() => router.push(`/pets/${petId}/conditions`)} />
    </PetListGroup>
    {state.errors.length ? <PetButton variant="secondary" label={tx('ჩანაწერების განახლება', 'Refresh records')} onPress={() => void load()} /> : null}
  </View>;
}
