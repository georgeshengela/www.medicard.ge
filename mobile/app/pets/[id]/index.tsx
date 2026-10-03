import React, { useCallback, useRef, useState } from 'react';
import { Alert, Linking, Pressable, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Archive, ChevronDown, MessageCircle, Pencil, Phone, Plus, Stethoscope } from 'lucide-react-native';
import { PetAction, PetButton, PetIntro, PetLoading, PetPanel, PetText } from '@/components/pets/PetUi';
import { PetPhoto } from '@/components/pets/PetPhoto';
import { PETS_ART } from '@/constants/appArt';
import { PetErrorText, PetFactRow, PetPageScroll } from '@/components/pets/PetScreen';
import { PetCareSummary } from '@/components/pets/PetCareSummary';
import { PetHealthSummaries } from '@/components/pets/PetHealthSummaries';
import { ka } from '@/i18n/ka';
import { ApiError, api, type Pet } from '@/lib/api';
import { isoToDisplay } from '@/lib/birthdate';
import { formatPetAgeKa } from '@/lib/petsAge';
import { getSpecies } from '@/lib/petsCatalog';
import { petBreedLabel, petSetupItems } from '@/lib/petsPresentation';
import { localAccountId } from '@/lib/localAccount';
import { useAuth } from '@/store/AuthContext';
import { useThemeColors } from '@/theme/colors';
import { useAccountQuery } from '@/hooks/useAccountQuery';
import { FRESH } from '@/lib/queryClient';
import { tx } from '@/i18n/locale';

export default function PetProfileScreen() { const { id } = useLocalSearchParams<{ id: string }>(), { user } = useAuth(); return id && user ? <PetProfile key={`${user.id}:${id}`} id={id} owner={user.id} /> : <PetLoading />; }
function PetProfile({ id, owner }: { id: string; owner: string }) {
  const c = useThemeColors(), router = useRouter(), archiveLock = useRef(false);
  const [actionError, setActionError] = useState<string | null>(null), [archiving, setArchiving] = useState(false), [details, setDetails] = useState(false);
  const current = () => localAccountId() === owner;
  // Pet edits, weights, care and photos all write /api/pets (invalidates 'pets'); 30 s fresh is safe.
  const query = useAccountQuery<Pet>({ key: ['pets', 'detail', id], fetch: async () => (await api.pets.get(id)).pet, staleTime: FRESH.SHORT });
  const pet = current() ? query.data ?? null : null;
  const ready = !query.isPending || query.fetchStatus === 'idle';
  const loadError = query.isError && !query.isFetching ? (query.error instanceof ApiError ? query.error.message : ka.pets.loadError) : null;
  const error = actionError ?? loadError;
  const { refetch } = query;
  const load = useCallback(() => { setActionError(null); void refetch(); }, [refetch]);
  const edit = () => router.push(`/pets/${id}/edit`);
  const archive = () => Alert.alert(ka.pets.archiveConfirmTitle, ka.pets.archiveConfirmBody, [{ text: ka.common.cancel, style: 'cancel' }, { text: ka.pets.archiveAction, style: 'destructive', onPress: async () => { if (archiveLock.current || !current()) return; archiveLock.current = true; setArchiving(true); setActionError(null); try { await api.pets.archive(id); if (!current()) return; void import('@/lib/petCareReminders').then(module => module.reconcilePetCareReminders({ reason: 'archive' })).catch(() => undefined); router.replace('/pets'); } catch (error) { if (current()) setActionError(error instanceof ApiError ? error.message : ka.common.networkError); } finally { archiveLock.current = false; if (current()) setArchiving(false); } } }]);
  if (!ready) return <PetLoading />;
  if (!pet) return <PetPageScroll><PetIntro title={tx('პროფილი ვერ ჩაიტვირთა', 'The profile couldn’t load')} body={tx('შეამოწმე ინტერნეტკავშირი და ხელახლა სცადე.', 'Check your internet connection and try again.')} /><PetErrorText message={error} /><PetButton label={tx('ხელახლა ცდა', 'Try again')} onPress={() => void load()} /></PetPageScroll>;
  const missing = petSetupItems(pet).filter(item => !item.done);
  const hasVet = Boolean(pet.vetName || pet.vetClinicName || pet.vetPhone || pet.vetAddress || pet.vetNotes);
  return <><Stack.Screen options={{ title: pet.name, headerRight: () => <Pressable accessibilityRole="button" accessibilityLabel={tx('პროფილის რედაქტირება', 'Edit profile')} onPress={edit} style={{ width: 44, height: 44, justifyContent: 'center', alignItems: 'center' }}><Pencil size={20} color={c.primary100} /></Pressable> }} /><PetPageScroll>
    <PetPanel><View style={{ gap: 18 }}><View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}><PetPhoto photoUrl={pet.photoUrl} name={pet.name} speciesId={pet.speciesId} size={84} /><View style={{ flex: 1, gap: 4 }}><PetText size={11} bold color={c.primary100}>{tx('მისი პირადი სივრცე', 'Their own space')}</PetText><PetText size={25} bold>{pet.name}</PetText><PetText size={13} muted>{getSpecies(pet.speciesId)?.labelKa} · {formatPetAgeKa(pet.age, ka.pets)}</PetText></View></View><View style={{ height: 1, backgroundColor: c.bg300 }} /><PetText size={13} muted>{petBreedLabel(pet)} · {pet.sex === 'MALE' ? tx('მამრი', 'Male') : pet.sex === 'FEMALE' ? tx('მდედრი', 'Female') : tx('სქესი უცნობია', 'Sex unknown')}</PetText><Pressable accessibilityRole="button" accessibilityState={{ expanded: details }} onPress={() => setDetails(!details)} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><PetText size={13} bold color={c.primary100}>{tx('პროფილის დეტალები', 'Profile details')}</PetText><ChevronDown color={c.primary100} size={18} style={{ transform: [{ rotate: details ? '180deg' : '0deg' }] }} /></Pressable>{details ? <View><PetFactRow label={tx('ასაკი', 'Age')} value={formatPetAgeKa(pet.age, ka.pets)} />{pet.birthDate ? <PetFactRow label={tx('დაბადების თარიღი', 'Date of birth')} value={isoToDisplay(pet.birthDate) || ka.pets.missing} /> : null}<PetFactRow label={tx('სტერილიზაცია / კასტრაცია', 'Spayed / neutered')} value={pet.neutered === true ? tx('კი', 'Yes') : pet.neutered === false ? tx('არა', 'No') : tx('არ არის მითითებული', 'Not specified')} last /><PetButton label={tx('ინფორმაციის შეცვლა', 'Edit details')} variant="ghost" icon={Pencil} onPress={edit} /></View> : null}</View></PetPanel>
    {error ? <><PetErrorText message={error} /><PetButton label={tx('განახლება', 'Refresh')} variant="secondary" onPress={() => void load()} /></> : null}
    <PetCareSummary key={`care:${id}`} pet={pet} />
    <PetAction icon={MessageCircle} art={PETS_ART.vet} title={tx('MEDIVET · ჰკითხე მის შესახებ', 'MEDIVET · ask about them')} body={tx('გაიგე მეტი მოვლასა და შენახულ ჩანაწერებზე. AI პასუხი ვეტერინარის კონსულტაციას ვერ ცვლის.', 'Learn more about care and saved records. An AI answer can’t replace a vet consultation.')} onPress={() => router.push(`/pets/${id}/chat`)} />
    <View style={{ gap: 6 }}><PetText size={20} bold>{tx('ჯანმრთელობის ისტორია', 'Health history')}</PetText><PetText muted>{tx('გაზომვები და შენიშვნები — დროთა განმავლობაში.', 'Measurements and notes — over time.')}</PetText></View>
    <PetHealthSummaries key={`health:${id}`} petId={id} />
    <PetPanel><View style={{ gap: 12 }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><Stethoscope size={22} color={c.primary100} /><PetText size={16} bold>{tx('მისი ვეტერინარი', 'Their vet')}</PetText></View>{hasVet ? <>{pet.vetName ? <PetText bold>{pet.vetName}</PetText> : null}{pet.vetClinicName ? <PetText muted>{pet.vetClinicName}</PetText> : null}{pet.vetAddress ? <PetText size={13} muted>{pet.vetAddress}</PetText> : null}{pet.vetNotes ? <PetText size={13} muted>{pet.vetNotes}</PetText> : null}{pet.vetPhone ? <PetButton variant="secondary" icon={Phone} label={pet.vetPhone} onPress={() => { const phone = pet.vetPhone?.replace(/[^\d+]/g, ''); if (phone) void Linking.openURL(`tel:${phone}`).catch(() => Alert.alert(tx('ზარი ვერ გაიხსნა', 'Couldn’t start the call'), tx('ნომერი შეგიძლია ვეტერინარის კონტაქტში ნახო.', 'You can find the number in the vet contact.'))); }} /> : null}<PetButton label={tx('კონტაქტის შეცვლა', 'Edit contact')} variant="ghost" onPress={edit} /></> : <><PetText muted>{tx('შეინახე კლინიკა და ტელეფონი, რომ საჭირო დროს მარტივად იპოვო.', 'Save the clinic and phone number so they’re easy to find when you need them.')}</PetText><PetButton label={tx('კონტაქტის დამატება', 'Add contact')} icon={Plus} variant="secondary" onPress={edit} /></>}</View></PetPanel>
    {missing.length ? <PetPanel><View style={{ gap: 10 }}><PetText bold>{tx('შეავსე, როცა მოგინდება', 'Fill in whenever you like')}</PetText><PetText size={12} muted>{tx('ეს არჩევითი დეტალებია — ყველა ფუნქციის გამოყენება ახლაც შეგიძლია.', 'These details are optional — you can use every feature right now.')}</PetText>{missing.map(item => <Pressable key={item.key} accessibilityRole="button" onPress={edit} style={{ minHeight: 44, flexDirection: 'row', gap: 10, alignItems: 'center' }}><Plus size={17} color={c.primary100} /><PetText size={13} color={c.primary100}>{item.label}</PetText></Pressable>)}</View></PetPanel> : null}
    <PetButton label={tx('პროფილის რედაქტირება', 'Edit profile')} variant="secondary" icon={Pencil} onPress={edit} />
    <PetButton label={tx('პროფილის დაარქივება', 'Archive profile')} variant="ghost" icon={Archive} loading={archiving} onPress={archive} />
  </PetPageScroll></>;
}
