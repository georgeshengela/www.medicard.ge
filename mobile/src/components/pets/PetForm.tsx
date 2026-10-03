import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Image, Keyboard, Pressable, ScrollView, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { requestPhotoLibraryAccess } from '@/lib/photoLibraryAccess';
import { Bird, Camera, Cat, Check, ChevronRight, Dog, Fish, PawPrint, Rabbit, Rat, Search, Stethoscope, Turtle, Fence, type LucideIcon } from 'lucide-react-native';
import { PetInput as Input } from '@/components/pets/PetUi';
import { SelectField } from '@/components/ui/SelectField';
import { PetPhoto, petSpeciesArt } from './PetPhoto';
import { PetDateField } from './PetDateField';
import { PetChipRow, PetErrorText, PetFilterChip, PetFormScroll, PetSectionLabel, PetSheet } from './PetScreen';
import { PetButton, PetIntro, PetPanel, PetText } from './PetUi';
import { ka } from '@/i18n/ka';
import type { Pet, PetAgeKind, PetSex, PetWriteBody } from '@/lib/api';
import { IMAGE_PICKER_OPTIONS, toUploadableImage } from '@/lib/imageUpload';
import { isoToDigits } from '@/lib/birthdate';
import { getSpecies, searchBreeds, SPECIES } from '@/lib/petsCatalog';
import { approximateAgeError, identityAgeBody, parsePetDate, petBreedLabel } from '@/lib/petsPresentation';
import { useThemeColors } from '@/theme/colors';
import { tx } from '@/i18n/locale';

export type LocalPhoto = { uri: string; name: string; mimeType: string };
export type PetFormValue = {
  name: string; speciesId: string; breedId: string; customBreed: string; sex: PetSex; neutered: boolean | null;
  ageKind: PetAgeKind; birthDigits: string; approxYears: string; approxMonths: string; approxAgeRecordedOn?: string | null;
  vetClinicName: string; vetName: string; vetPhone: string; vetAddress: string; vetNotes: string;
};
const EMPTY: PetFormValue = { name: '', speciesId: 'dog', breedId: 'unknown', customBreed: '', sex: 'UNKNOWN', neutered: null, ageKind: 'UNKNOWN', birthDigits: '', approxYears: '', approxMonths: '', vetClinicName: '', vetName: '', vetPhone: '', vetAddress: '', vetNotes: '' };
export function hydratePetForm(raw?: Partial<PetFormValue> | null): PetFormValue { return { ...EMPTY, ...raw, speciesId: raw?.speciesId || 'dog' }; }
export function petToForm(pet: Pet): PetFormValue {
  return { name: pet.name, speciesId: pet.speciesId, breedId: pet.breedId, customBreed: pet.customBreed ?? '', sex: pet.sex, neutered: pet.neutered, ageKind: pet.ageKind, birthDigits: isoToDigits(pet.birthDate), approxYears: pet.approxAgeYears == null ? '' : String(pet.approxAgeYears), approxMonths: pet.approxAgeMonths == null ? '' : String(pet.approxAgeMonths), approxAgeRecordedOn: pet.approxAgeRecordedOn, vetClinicName: pet.vetClinicName ?? '', vetName: pet.vetName ?? '', vetPhone: pet.vetPhone ?? '', vetAddress: pet.vetAddress ?? '', vetNotes: pet.vetNotes ?? '' };
}
export function formToBody(value: PetFormValue): PetWriteBody {
  return { name: value.name.trim(), speciesId: value.speciesId, breedId: value.breedId || 'unknown', customBreed: value.breedId === 'custom' ? value.customBreed.trim() : null, sex: value.sex, neutered: value.neutered, ...identityAgeBody(value.ageKind, value.birthDigits, value.approxYears, value.approxMonths, value.approxAgeRecordedOn), vetClinicName: value.vetClinicName.trim() || null, vetName: value.vetName.trim() || null, vetPhone: value.vetPhone.trim() || null, vetAddress: value.vetAddress.trim() || null, vetNotes: value.vetNotes.trim() || null };
}
export const petSpeciesIcon = (id: string): LucideIcon => ({ dog: Dog, cat: Cat, bird: Bird, rabbit: Rabbit, rodent: Rat, fish: Fish, reptile: Turtle, horse: Fence }[id] ?? PawPrint);

export function PetForm({ initial, existingPhotoUrl, submitting, error, submitLabel, onChange, onSubmit, wizard = false }: { initial?: PetFormValue; existingPhotoUrl?: string | null; submitting: boolean; error: string | null; submitLabel: string; onChange?: (value: PetFormValue) => void; onSubmit: (value: PetFormValue, photo: LocalPhoto | null, removePhoto: boolean) => void; wizard?: boolean }) {
  const colors = useThemeColors(), scrollRef = useRef<ScrollView>(null);
  const [value, setValue] = useState(() => hydratePetForm(initial));
  const [photo, setPhoto] = useState<LocalPhoto | null>(null), [removePhoto, setRemovePhoto] = useState(false);
  const [step, setStep] = useState(0), [fieldError, setFieldError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<'species' | 'breed' | null>(null), [query, setQuery] = useState('');
  const [showVet, setShowVet] = useState(Boolean(initial?.vetClinicName || initial?.vetName || initial?.vetPhone || initial?.vetAddress || initial?.vetNotes));
  const [picking, setPicking] = useState(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { onChange?.(value); }, [value, onChange]);
  const patch = (next: Partial<PetFormValue>) => { setFieldError(null); setValue(prev => ({ ...prev, ...next })); };
  const species = getSpecies(value.speciesId);
  const breeds = useMemo(() => searchBreeds(value.speciesId, query), [value.speciesId, query]);
  const pick = async (camera: boolean) => {
    setPicking(true);
    try {
      const permission = camera ? await ImagePicker.requestCameraPermissionsAsync() : await requestPhotoLibraryAccess();
      if (!permission.granted) { Alert.alert(ka.upload.permissionDenied); return; }
      const result = camera ? await ImagePicker.launchCameraAsync(IMAGE_PICKER_OPTIONS) : await ImagePicker.launchImageLibraryAsync(IMAGE_PICKER_OPTIONS);
      if (!result.canceled && result.assets[0]) { const next = await toUploadableImage(result.assets[0]); if (mounted.current) { setPhoto(next); setRemovePhoto(false); } }
    } catch { if (mounted.current) setFieldError(tx('ფოტოს გახსნა ვერ მოხერხდა. სცადე სხვა ფოტო.', 'Couldn’t open the photo. Try another one.')); }
    finally { if (mounted.current) setPicking(false); }
  };
  const pickPhoto = () => { if (picking || submitting) return; Keyboard.dismiss(); Alert.alert(tx('ცხოველის ფოტო', 'Pet photo'), tx('აირჩიე მკაფიო ფოტო, რომ პროფილი ადვილად იცნო.', 'Choose a clear photo so the profile is easy to recognize.'), [{ text: ka.common.cancel, style: 'cancel' }, { text: ka.upload.fromCamera, onPress: () => void pick(true) }, { text: ka.upload.fromGallery, onPress: () => void pick(false) }]); };
  const validate = (details: boolean) => {
    if (!value.name.trim()) return tx('ჯერ შენი ცხოველის სახელი ჩაწერე.', 'First, enter your pet’s name.');
    if (!species) return tx('აირჩიე ცხოველის სახეობა.', 'Choose your pet’s species.');
    if (details && value.breedId === 'custom' && !value.customBreed.trim()) return tx('ჩაწერე ჯიში ან აირჩიე „არ ვიცი“.', 'Enter a breed or choose “I don’t know”.');
    if (details && value.ageKind === 'EXACT') { const date = parsePetDate(value.birthDigits); if (!date.ok) return date.error; const born = new Date(`${date.iso}T12:00:00`), oldest = new Date(); oldest.setFullYear(oldest.getFullYear() - 80); if (born < oldest) return tx('შეამოწმე დაბადების წელი — ასაკი 80 წელს არ უნდა აღემატებოდეს.', 'Check the birth year — age can’t be more than 80 years.'); }
    if (details && value.ageKind === 'APPROXIMATE') return approximateAgeError(value.approxYears, value.approxMonths);
    return null;
  };
  const go = (next: number) => { Keyboard.dismiss(); setFieldError(null); setStep(next); requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: 0, animated: false })); };
  const advance = () => { const problem = validate(!wizard || step > 0); if (problem) { setFieldError(problem); return; } if (wizard && step < 2) go(step + 1); else onSubmit(value, photo, removePhoto); };
  const sex = value.sex === 'MALE' ? tx('მამრი', 'Male') : value.sex === 'FEMALE' ? tx('მდედრი', 'Female') : tx('სქესი უცნობია', 'Sex unknown');
  const age = value.ageKind === 'EXACT' ? value.birthDigits.replace(/(\d{2})(\d{2})(\d{4})/, '$1.$2.$3') : value.ageKind === 'APPROXIMATE' ? tx(`დაახლოებით ${value.approxYears || 0} წელი და ${value.approxMonths || 0} თვე`, `About ${value.approxYears || 0} ${Number(value.approxYears || 0) === 1 ? 'year' : 'years'} and ${value.approxMonths || 0} ${Number(value.approxMonths || 0) === 1 ? 'month' : 'months'}`) : tx('ასაკს მოგვიანებით დაამატებ', 'You’ll add the age later');
  const photoView = <Pressable disabled={picking || submitting} accessibilityRole="button" accessibilityLabel={tx('ცხოველის ფოტოს არჩევა', 'Choose a pet photo')} onPress={pickPhoto} style={{ alignSelf: 'flex-start' }}>{photo ? <Image source={{ uri: photo.uri }} style={{ width: 88, height: 88, borderRadius: 28 }} /> : <PetPhoto photoUrl={removePhoto ? null : existingPhotoUrl ?? null} name={value.name || ' '} speciesId={value.speciesId} size={88} />}<View style={{ position: 'absolute', right: -4, bottom: -4, width: 32, height: 32, borderRadius: 16, backgroundColor: '#0D9488', borderWidth: 3, borderColor: colors.bg100, alignItems: 'center', justifyContent: 'center' }}><Camera size={15} color="#FFFFFF" /></View></Pressable>;
  const identity = <View style={{ gap: 22 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>{photoView}<View style={{ flex: 1, gap: 5 }}><PetText bold>{tx('გავიცნოთ შენი მეგობარი', 'Let’s meet your friend')}</PetText><PetText size={13} muted>{tx('ფოტო სურვილისამებრ. შეცვლა ყოველთვის შეგიძლია.', 'A photo is optional. You can always change it.')}</PetText>{photo || (!removePhoto && existingPhotoUrl) ? <Pressable accessibilityRole="button" onPress={() => { setPhoto(null); setRemovePhoto(true); }} style={{ minHeight: 44, justifyContent: 'center' }}><PetText size={12} color={colors.danger}>{tx('ფოტოს წაშლა', 'Remove photo')}</PetText></Pressable> : null}</View></View>
    <Input figma label={tx('რა ჰქვია? *', 'What’s their name? *')} accessibilityLabel={tx('ცხოველის სახელი', 'Pet name')} placeholder={tx('მაგალითად, ლუნა', 'For example, Luna')} value={value.name} onChangeText={name => patch({ name })} maxLength={40} autoCapitalize="words" returnKeyType="done" />
    <View style={{ gap: 10 }}><PetSectionLabel label={tx('სახეობა *', 'Species *')} /><PetChipRow>{SPECIES.slice(0, 4).map(item => <PetFilterChip key={item.id} label={item.labelKa} icon={petSpeciesIcon(item.id)} art={petSpeciesArt(item.id)} selected={value.speciesId === item.id} onPress={() => patch({ speciesId: item.id, breedId: 'unknown', customBreed: '' })} />)}</PetChipRow><PetButton variant="secondary" label={SPECIES.slice(0, 4).some(s => s.id === value.speciesId) ? tx('სხვა სახეობები', 'Other species') : species?.labelKa || tx('სახეობის არჩევა', 'Choose species')} icon={PawPrint} onPress={() => setSheet('species')} /></View>
    <PetText size={12} muted>{tx('* მხოლოდ სახელი და სახეობაა აუცილებელი.', '* Only the name and species are required.')}</PetText>
  </View>;
  const details = <View style={{ gap: 22 }}>
    <SelectField label={tx('ჯიში', 'Breed')} value={petBreedLabel({ speciesId: value.speciesId, breedId: value.breedId, customBreed: value.customBreed })} onPress={() => { setQuery(''); setSheet('breed'); }} />
    {value.breedId === 'custom' ? <Input figma label={tx('ჩაწერე ჯიში', 'Enter breed')} value={value.customBreed} onChangeText={customBreed => patch({ customBreed })} maxLength={80} /> : null}
    <View style={{ gap: 10 }}><PetSectionLabel label={tx('სქესი', 'Sex')} /><PetChipRow>{([{ value: 'MALE', label: tx('მამრი', 'Male') }, { value: 'FEMALE', label: tx('მდედრი', 'Female') }, { value: 'UNKNOWN', label: tx('არ ვიცი', 'I don’t know') }] as const).map(item => <PetFilterChip key={item.value} label={item.label} selected={value.sex === item.value} onPress={() => patch({ sex: item.value })} />)}</PetChipRow></View>
    <View style={{ gap: 10 }}><PetSectionLabel label={tx('სტერილიზაცია / კასტრაცია', 'Spayed / neutered')} /><PetChipRow>{[{ value: true, label: tx('კი', 'Yes') }, { value: false, label: tx('არა', 'No') }, { value: null, label: tx('არ ვიცი', 'I don’t know') }].map(item => <PetFilterChip key={item.label} label={item.label} selected={value.neutered === item.value} onPress={() => patch({ neutered: item.value })} />)}</PetChipRow></View>
    <View style={{ gap: 10 }}><PetSectionLabel label={tx('ასაკი', 'Age')} /><PetChipRow>{([{ value: 'EXACT', label: tx('ვიცი თარიღი', 'I know the date') }, { value: 'APPROXIMATE', label: tx('დაახლოებით', 'Approximately') }, { value: 'UNKNOWN', label: tx('არ ვიცი', 'I don’t know') }] as const).map(item => <PetFilterChip key={item.value} label={item.label} selected={value.ageKind === item.value} onPress={() => patch({ ageKind: item.value })} />)}</PetChipRow></View>
    {value.ageKind === 'EXACT' ? <PetDateField label={tx('დაბადების თარიღი', 'Date of birth')} value={value.birthDigits} onChangeText={birthDigits => patch({ birthDigits })} /> : null}
    {value.ageKind === 'APPROXIMATE' ? <View style={{ gap: 10 }}><View style={{ flexDirection: 'row', gap: 12 }}><View style={{ flex: 1 }}><Input figma label={tx('წელი', 'Years')} value={value.approxYears} keyboardType="number-pad" maxLength={2} onChangeText={approxYears => patch({ approxYears, approxAgeRecordedOn: null })} placeholder="0" /></View><View style={{ flex: 1 }}><Input figma label={tx('თვე', 'Months')} value={value.approxMonths} keyboardType="number-pad" maxLength={2} onChangeText={approxMonths => patch({ approxMonths, approxAgeRecordedOn: null })} placeholder="0–11" /></View></View><PetText size={12} muted>{value.approxAgeRecordedOn ? tx(`ეს შეფასება ჩაიწერა ${value.approxAgeRecordedOn.slice(0, 10)}-ს. შეცვლისას მიუთითე დღევანდელი ასაკი.`, `This estimate was recorded on ${value.approxAgeRecordedOn.slice(0, 10)}. If you change it, enter their age today.`) : tx('მიუთითე დღევანდელი სავარაუდო ასაკი.', 'Enter their approximate age today.')}</PetText></View> : null}
    <PetPanel><Pressable accessibilityRole="button" accessibilityState={{ expanded: showVet }} onPress={() => setShowVet(!showVet)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 }}><Stethoscope size={23} color={colors.primary100} /><View style={{ flex: 1 }}><PetText bold>{tx('ვეტერინარის კონტაქტი', 'Vet contact')}</PetText><PetText size={12} muted>{tx('სურვილისამებრ · ყველაფერი ერთ ადგილას', 'Optional · everything in one place')}</PetText></View><ChevronRight size={18} color={colors.text300} style={{ transform: [{ rotate: showVet ? '90deg' : '0deg' }] }} /></Pressable>{showVet ? <View style={{ gap: 16, marginTop: 18 }}>{([{ key: 'vetClinicName', label: tx('კლინიკა', 'Clinic'), max: 160 }, { key: 'vetName', label: tx('ვეტერინარის სახელი', 'Vet’s name'), max: 80 }, { key: 'vetPhone', label: tx('ტელეფონი', 'Phone'), max: 40 }, { key: 'vetAddress', label: tx('მისამართი', 'Address'), max: 300 }, { key: 'vetNotes', label: tx('შენიშვნა', 'Note'), max: 500 }] as const).map(item => <Input key={item.key} figma label={item.label} value={value[item.key]} maxLength={item.max} keyboardType={item.key === 'vetPhone' ? 'phone-pad' : 'default'} multiline={item.key === 'vetNotes'} onChangeText={text => patch({ [item.key]: text })} />)}</View> : null}</PetPanel>
  </View>;
  return <>
    <PetFormScroll scrollRef={scrollRef} footer={<><PetErrorText message={fieldError || error} /><View style={{ flexDirection: 'row', gap: 10 }}>{wizard && step > 0 ? <PetButton label={tx('უკან', 'Back')} variant="secondary" fullWidth={false} disabled={submitting} onPress={() => go(step - 1)} /> : null}<View style={{ flex: 1 }}><PetButton label={wizard && step < 2 ? tx('გაგრძელება', 'Continue') : submitLabel} icon={wizard && step < 2 ? ChevronRight : Check} loading={submitting} disabled={picking} onPress={advance} /></View></View></>}>
      {wizard ? <View style={{ gap: 10 }}><View style={{ flexDirection: 'row', gap: 6 }}>{[0, 1, 2].map(index => <View key={index} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: index <= step ? colors.primary200 : colors.bg300 }} />)}</View><PetText size={12} muted>{tx('ნაბიჯი', 'Step')} {step + 1} / 3 · {[tx('გაცნობა', 'Intro'), tx('დეტალები', 'Details'), tx('გადამოწმება', 'Review')][step]}</PetText></View> : null}
      <PetIntro title={wizard ? [tx('პატარა მეგობარი, დიდი ზრუნვა.', 'Little friend, big care.'), tx('ის, რაც მის შესახებ იცი.', 'What you know about them.'), tx('მისი სივრცე მზადაა.', 'Their space is ready.')][step] : tx('მისი ამბავი, განახლებული.', 'Their story, updated.')} body={wizard ? [tx('დაუმატე შენს ოჯახს ცხოველის პირადი პროფილი.', 'Add a personal profile for your pet.'), tx('ეს დეტალები არჩევითია. რაც არ იცი, მოგვიანებით შეავსე.', 'These details are optional. Fill in what you don’t know later.'), tx('გადაამოწმე მონაცემები. შენახვის შემდეგ შეძლებ მოვლისა და ჯანმრთელობის ჩანაწერების დამატებას.', 'Check the details. Once saved, you can add care and health records.')][step] : tx('შეცვალე ინფორმაცია და შეინახე. სხვა ჩანაწერები შენარჩუნდება.', 'Update the details and save. Other records are kept.')} />
      {!wizard || step === 0 ? identity : null}
      {!wizard || step === 1 ? details : null}
      {wizard && step === 2 ? <><PetPanel><View style={{ gap: 16 }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>{photoView}<View style={{ flex: 1, gap: 4 }}><PetText size={23} bold>{value.name.trim()}</PetText><PetText muted>{species?.labelKa} · {sex}</PetText></View></View><View style={{ height: 1, backgroundColor: colors.bg300 }} /><PetText>{petBreedLabel({ speciesId: value.speciesId, breedId: value.breedId, customBreed: value.customBreed })}</PetText><PetText muted>{age}</PetText>{value.vetName || value.vetClinicName ? <PetText muted>{value.vetName || value.vetClinicName}</PetText> : null}</View></PetPanel><PetPanel><PetText bold>{tx('შემდეგი ნაბიჯი — ზრუნვა', 'Next step — care')}</PetText><PetText muted>{tx('შეინახე წონა და ჯანმრთელობის ისტორია, დაგეგმე მოვლა და დაუსვი შეკითხვები MEDIVET-ს. ცხოველის ჩანაწერები შენს ჯანმრთელობის მონაცემებს არ ერევა.', 'Save weight and health history, plan care and ask MEDIVET questions. Your pet’s records never mix with your own health data.')}</PetText></PetPanel><PetButton label={tx('დეტალების შეცვლა', 'Edit details')} variant="ghost" onPress={() => go(1)} /></> : null}
    </PetFormScroll>
    <PetSheet visible={sheet !== null} title={sheet === 'species' ? tx('აირჩიე სახეობა', 'Choose species') : tx('აირჩიე ჯიში', 'Choose breed')} onClose={() => setSheet(null)}>
      {sheet === 'breed' ? <View style={{ paddingBottom: 12 }}><Input figma icon={Search} accessibilityLabel={tx('ჯიშის ძებნა', 'Search breeds')} placeholder={tx('მოძებნე ჯიში', 'Search for a breed')} value={query} onChangeText={setQuery} /></View> : null}
      <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 360, flexShrink: 1 }} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>{sheet === 'species' ? SPECIES.map(item => <PetFilterChip fill key={item.id} label={item.labelKa} icon={petSpeciesIcon(item.id)} art={petSpeciesArt(item.id)} selected={item.id === value.speciesId} onPress={() => { patch({ speciesId: item.id, breedId: 'unknown', customBreed: '' }); setSheet(null); }} />) : <>{[{ id: 'unknown', label: tx('არ ვიცი', 'I don’t know') }, ...(species?.allowsMixed ? [{ id: 'mixed', label: tx('შერეული ჯიში', 'Mixed breed') }] : []), { id: 'custom', label: tx('თავად ჩავწერ', 'I’ll type it') }, ...breeds.filter(item => !['unknown', 'mixed', 'custom'].includes(item.id))].map(item => <PetFilterChip fill key={item.id} label={item.label} selected={item.id === value.breedId} onPress={() => { patch({ breedId: item.id }); setSheet(null); }} />)}{query && !breeds.length ? <PetText muted>{tx('ჯიში ვერ მოიძებნა. შეგიძლია თავად ჩაწერო.', 'No breed found. You can type it yourself.')}</PetText> : null}</>}</ScrollView>
    </PetSheet>
  </>;
}
