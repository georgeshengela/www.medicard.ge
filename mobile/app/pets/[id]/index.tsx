import React, { useCallback, useRef, useState } from 'react';
import { Alert, Linking, Pressable, View } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Archive, ChevronDown, MessageCircle, Pencil, Phone, Plus, Stethoscope } from 'lucide-react-native';
import { PetAction, PetButton, PetIntro, PetLoading, PetPanel, PetText } from '@/components/pets/PetUi';
import { PetPhoto } from '@/components/pets/PetPhoto';
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

export default function PetProfileScreen() { const { id } = useLocalSearchParams<{ id: string }>(), { user } = useAuth(); return id && user ? <PetProfile key={`${user.id}:${id}`} id={id} owner={user.id} /> : <PetLoading />; }
function PetProfile({ id, owner }: { id: string; owner: string }) {
  const c = useThemeColors(), router = useRouter(), revision = useRef(0), archiveLock = useRef(false);
  const [pet, setPet] = useState<Pet | null>(null), [error, setError] = useState<string | null>(null), [ready, setReady] = useState(false), [archiving, setArchiving] = useState(false), [details, setDetails] = useState(false);
  const current = () => localAccountId() === owner;
  const load = useCallback(async () => { const request = ++revision.current; setError(null); try { const { pet } = await api.pets.get(id); if (request === revision.current && localAccountId() === owner) setPet(pet); } catch (error) { if (request === revision.current && localAccountId() === owner) setError(error instanceof ApiError ? error.message : ka.pets.loadError); } finally { if (request === revision.current && localAccountId() === owner) setReady(true); } }, [id, owner]);
  useFocusEffect(useCallback(() => { void load(); return () => { revision.current++; }; }, [load]));
  const edit = () => router.push(`/pets/${id}/edit`);
  const archive = () => Alert.alert(ka.pets.archiveConfirmTitle, ka.pets.archiveConfirmBody, [{ text: ka.common.cancel, style: 'cancel' }, { text: ka.pets.archiveAction, style: 'destructive', onPress: async () => { if (archiveLock.current || !current()) return; archiveLock.current = true; setArchiving(true); setError(null); try { await api.pets.archive(id); if (!current()) return; void import('@/lib/petCareReminders').then(module => module.reconcilePetCareReminders({ reason: 'archive' })).catch(() => undefined); router.replace('/pets'); } catch (error) { if (current()) setError(error instanceof ApiError ? error.message : ka.common.networkError); } finally { archiveLock.current = false; if (current()) setArchiving(false); } } }]);
  if (!ready) return <PetLoading />;
  if (!pet) return <PetPageScroll><PetIntro title="პროფილი ვერ ჩაიტვირთა" body="შეამოწმე ინტერნეტკავშირი და ხელახლა სცადე." /><PetErrorText message={error} /><PetButton label="ხელახლა ცდა" onPress={() => void load()} /></PetPageScroll>;
  const missing = petSetupItems(pet).filter(item => !item.done);
  const hasVet = Boolean(pet.vetName || pet.vetClinicName || pet.vetPhone || pet.vetAddress || pet.vetNotes);
  return <><Stack.Screen options={{ title: pet.name, headerRight: () => <Pressable accessibilityRole="button" accessibilityLabel="პროფილის რედაქტირება" onPress={edit} style={{ width: 44, height: 44, justifyContent: 'center', alignItems: 'center' }}><Pencil size={20} color={c.primary100} /></Pressable> }} /><PetPageScroll>
    <PetPanel><View style={{ gap: 18 }}><View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}><PetPhoto photoUrl={pet.photoUrl} name={pet.name} size={84} /><View style={{ flex: 1, gap: 4 }}><PetText size={11} bold color={c.primary100}>მისი პირადი სივრცე</PetText><PetText size={25} bold>{pet.name}</PetText><PetText size={13} muted>{getSpecies(pet.speciesId)?.labelKa} · {formatPetAgeKa(pet.age, ka.pets)}</PetText></View></View><View style={{ height: 1, backgroundColor: c.bg300 }} /><PetText size={13} muted>{petBreedLabel(pet)} · {pet.sex === 'MALE' ? 'მამრი' : pet.sex === 'FEMALE' ? 'მდედრი' : 'სქესი უცნობია'}</PetText><Pressable accessibilityRole="button" accessibilityState={{ expanded: details }} onPress={() => setDetails(!details)} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><PetText size={13} bold color={c.primary100}>პროფილის დეტალები</PetText><ChevronDown color={c.primary100} size={18} style={{ transform: [{ rotate: details ? '180deg' : '0deg' }] }} /></Pressable>{details ? <View><PetFactRow label="ასაკი" value={formatPetAgeKa(pet.age, ka.pets)} />{pet.birthDate ? <PetFactRow label="დაბადების თარიღი" value={isoToDisplay(pet.birthDate) || ka.pets.missing} /> : null}<PetFactRow label="სტერილიზაცია / კასტრაცია" value={pet.neutered === true ? 'კი' : pet.neutered === false ? 'არა' : 'არ არის მითითებული'} last /><PetButton label="ინფორმაციის შეცვლა" variant="ghost" icon={Pencil} onPress={edit} /></View> : null}</View></PetPanel>
    {error ? <><PetErrorText message={error} /><PetButton label="განახლება" variant="secondary" onPress={() => void load()} /></> : null}
    <PetCareSummary key={`care:${id}`} pet={pet} />
    <PetAction icon={MessageCircle} title="Medi Vet · ჰკითხე მის შესახებ" body="გაიგე მეტი მოვლასა და შენახულ ჩანაწერებზე. AI პასუხი ვეტერინარის კონსულტაციას ვერ ცვლის." onPress={() => router.push(`/pets/${id}/chat`)} />
    <View style={{ gap: 6 }}><PetText size={20} bold>ჯანმრთელობის ისტორია</PetText><PetText muted>გაზომვები და შენიშვნები — დროთა განმავლობაში.</PetText></View>
    <PetHealthSummaries key={`health:${id}`} petId={id} />
    <PetPanel><View style={{ gap: 12 }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><Stethoscope size={22} color={c.primary100} /><PetText size={16} bold>მისი ვეტერინარი</PetText></View>{hasVet ? <>{pet.vetName ? <PetText bold>{pet.vetName}</PetText> : null}{pet.vetClinicName ? <PetText muted>{pet.vetClinicName}</PetText> : null}{pet.vetAddress ? <PetText size={13} muted>{pet.vetAddress}</PetText> : null}{pet.vetNotes ? <PetText size={13} muted>{pet.vetNotes}</PetText> : null}{pet.vetPhone ? <PetButton variant="secondary" icon={Phone} label={pet.vetPhone} onPress={() => { const phone = pet.vetPhone?.replace(/[^\d+]/g, ''); if (phone) void Linking.openURL(`tel:${phone}`).catch(() => Alert.alert('ზარი ვერ გაიხსნა', 'ნომერი შეგიძლია ვეტერინარის კონტაქტში ნახო.')); }} /> : null}<PetButton label="კონტაქტის შეცვლა" variant="ghost" onPress={edit} /></> : <><PetText muted>შეინახე კლინიკა და ტელეფონი, რომ საჭირო დროს მარტივად იპოვო.</PetText><PetButton label="კონტაქტის დამატება" icon={Plus} variant="secondary" onPress={edit} /></>}</View></PetPanel>
    {missing.length ? <PetPanel><View style={{ gap: 10 }}><PetText bold>შეავსე, როცა მოგინდება</PetText><PetText size={12} muted>ეს არჩევითი დეტალებია — ყველა ფუნქციის გამოყენება ახლაც შეგიძლია.</PetText>{missing.map(item => <Pressable key={item.key} accessibilityRole="button" onPress={edit} style={{ minHeight: 44, flexDirection: 'row', gap: 10, alignItems: 'center' }}><Plus size={17} color={c.primary100} /><PetText size={13} color={c.primary100}>{item.label}</PetText></Pressable>)}</View></PetPanel> : null}
    <PetButton label="პროფილის რედაქტირება" variant="secondary" icon={Pencil} onPress={edit} />
    <PetButton label="პროფილის დაარქივება" variant="ghost" icon={Archive} loading={archiving} onPress={archive} />
  </PetPageScroll></>;
}
