import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import * as ImagePicker from 'expo-image-picker';
import {
  Bird,
  Building2,
  CalendarDays,
  Camera,
  Cat,
  ChevronDown,
  CircleQuestionMark,
  Clock,
  Dog,
  Fence,
  Fish,
  MapPin,
  Mars,
  PawPrint,
  Pencil,
  Phone,
  Rabbit,
  Rat,
  Search,
  Stethoscope,
  Turtle,
  Venus,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import { Button } from '@/components/ui/Button';
import { DateField } from '@/components/ui/DateField';
import { Input } from '@/components/ui/Input';
import { SelectField } from '@/components/ui/SelectField';
import { PetPhoto } from '@/components/pets/PetPhoto';
import {
  PetChipRow,
  PetErrorText,
  PetFilterChip,
  PetFormScroll,
  PetSectionLabel,
  PetSheet,
} from '@/components/pets/PetScreen';
import { ka } from '@/i18n/ka';
import type { Pet, PetAgeKind, PetSex, PetWriteBody } from '@/lib/api';
import { IMAGE_PICKER_OPTIONS, toUploadableImage } from '@/lib/imageUpload';
import { isoToDigits, parseBirthDate } from '@/lib/birthdate';
import { ageToApproxBirth, approxBirthToAge, approxBirthYears } from '@/lib/petsAge';
import { getSpecies, searchBreeds, SPECIES } from '@/lib/petsCatalog';
import { useFigmaAuth } from '@/constants/figmaAuthLayout';
import { useIsDark, useThemeColors } from '@/theme/colors';

export type LocalPhoto = { uri: string; name: string; mimeType: string };

export type PetFormValue = {
  name: string;
  speciesId: string;
  breedId: string;
  customBreed: string;
  sex: PetSex;
  neutered: boolean | null;
  ageKind: PetAgeKind;
  birthDigits: string;
  approxYears: string;
  approxMonths: string;
  vetClinicName: string;
  vetName: string;
  vetPhone: string;
  vetAddress: string;
  vetNotes: string;
};

const EMPTY: PetFormValue = {
  name: '',
  speciesId: 'dog',
  breedId: 'unknown',
  customBreed: '',
  sex: 'UNKNOWN',
  neutered: null,
  ageKind: 'UNKNOWN',
  birthDigits: '',
  approxYears: '',
  approxMonths: '',
  vetClinicName: '',
  vetName: '',
  vetPhone: '',
  vetAddress: '',
  vetNotes: '',
};

/** Figma 11416:83303 ring geometry — 5.33 stroke, round caps, teal on gray track. */
const RING_SIZE = 120;
const RING_STROKE = 5.33333;
const PHOTO_SIZE = 96;

function speciesIcon(id: string): LucideIcon {
  switch (id) {
    case 'dog':
      return Dog;
    case 'cat':
      return Cat;
    case 'bird':
      return Bird;
    case 'rabbit':
      return Rabbit;
    case 'rodent':
      return Rat;
    case 'fish':
      return Fish;
    case 'reptile':
      return Turtle;
    case 'horse':
      return Fence;
    default:
      return PawPrint;
  }
}

export function hydratePetForm(raw?: Partial<PetFormValue> | null): PetFormValue {
  return {
    ...EMPTY,
    ...raw,
    speciesId: raw?.speciesId || 'dog',
  };
}

export function petToForm(pet: Pet): PetFormValue {
  return {
    name: pet.name,
    speciesId: pet.speciesId,
    breedId: pet.breedId,
    customBreed: pet.customBreed ?? '',
    sex: pet.sex,
    neutered: pet.neutered,
    ageKind: pet.ageKind,
    birthDigits: isoToDigits(pet.birthDate),
    approxYears: pet.approxAgeYears == null ? '' : String(pet.approxAgeYears),
    approxMonths: pet.approxAgeMonths == null ? '' : String(pet.approxAgeMonths),
    vetClinicName: pet.vetClinicName ?? '',
    vetName: pet.vetName ?? '',
    vetPhone: pet.vetPhone ?? '',
    vetAddress: pet.vetAddress ?? '',
    vetNotes: pet.vetNotes ?? '',
  };
}

export function formToBody(value: PetFormValue): PetWriteBody {
  const body: PetWriteBody = {
    name: value.name.trim(),
    speciesId: value.speciesId,
    breedId: value.breedId || 'unknown',
    customBreed: value.breedId === 'custom' ? value.customBreed.trim() : null,
    sex: value.sex,
    neutered: value.neutered,
    ageKind: value.ageKind,
    vetClinicName: value.vetClinicName.trim() || null,
    vetName: value.vetName.trim() || null,
    vetPhone: value.vetPhone.trim() || null,
    vetAddress: value.vetAddress.trim() || null,
    vetNotes: value.vetNotes.trim() || null,
  };
  if (value.ageKind === 'EXACT') {
    const parsed = parseBirthDate(value.birthDigits);
    body.birthDate = parsed.ok ? parsed.iso : '';
  } else if (value.ageKind === 'APPROXIMATE') {
    body.approxAgeYears = value.approxYears === '' ? null : Number(value.approxYears);
    body.approxAgeMonths = value.approxMonths === '' ? null : Number(value.approxMonths);
  }
  return body;
}

function petFormProgress(value: PetFormValue, hasPhoto: boolean): number {
  let filled = 0;
  if (value.name.trim()) filled += 1;
  if (value.speciesId) filled += 1;
  if (value.breedId && value.breedId !== 'unknown') {
    if (value.breedId !== 'custom' || value.customBreed.trim()) filled += 1;
  }
  if (value.sex !== 'UNKNOWN') filled += 1;
  if (value.ageKind !== 'UNKNOWN') filled += 1;
  if (hasPhoto) filled += 1;
  return filled / 6;
}

function PetPhotoProgress({
  localUri,
  existingPhotoUrl,
  name,
  progress,
  onPress,
}: {
  localUri: string | null;
  existingPhotoUrl: string | null;
  name: string;
  progress: number;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  const dark = useIsDark();
  const auth = useFigmaAuth();
  const r = (RING_SIZE - RING_STROKE) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, progress));
  const dash = c * pct;
  const track = dark ? colors.bg300 : '#E5E7EB';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={ka.pets.photo}
      accessibilityValue={{ now: Math.round(pct * 100), min: 0, max: 100 }}
      onPress={onPress}
      style={{ width: RING_SIZE, height: RING_SIZE, alignItems: 'center', justifyContent: 'center' }}
    >
      <Svg width={RING_SIZE} height={RING_SIZE} style={{ position: 'absolute' }}>
        <Circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={r}
          stroke={track}
          strokeWidth={RING_STROKE}
          fill="none"
        />
        <Circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={r}
          stroke={colors.primary200}
          strokeWidth={RING_STROKE}
          fill="none"
          strokeDasharray={`${dash} ${c}`}
          strokeLinecap="round"
          rotation={-90}
          origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}
        />
      </Svg>
      {localUri ? (
        <Image
          source={{ uri: localUri }}
          style={{ width: PHOTO_SIZE, height: PHOTO_SIZE, borderRadius: PHOTO_SIZE / 2 }}
        />
      ) : (
        <PetPhoto photoUrl={existingPhotoUrl} name={name || ' '} size={PHOTO_SIZE} />
      )}
      <View
        style={{
          position: 'absolute',
          right: 2,
          bottom: 2,
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: auth.primaryBg,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 2,
          borderColor: colors.surface,
        }}
      >
        <Camera size={16} color={colors.onPrimary} strokeWidth={2.2} />
      </View>
    </Pressable>
  );
}

export function PetForm({
  initial,
  existingPhotoUrl,
  submitting,
  error,
  submitLabel,
  onChange,
  onSubmit,
}: {
  initial?: PetFormValue;
  existingPhotoUrl?: string | null;
  submitting: boolean;
  error: string | null;
  submitLabel: string;
  onChange?: (value: PetFormValue) => void;
  onSubmit: (value: PetFormValue, photo: LocalPhoto | null, removePhoto: boolean) => void;
}) {
  const colors = useThemeColors();
  const [value, setValue] = useState<PetFormValue>(() => hydratePetForm(initial));
  const [localPhoto, setLocalPhoto] = useState<LocalPhoto | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [speciesOpen, setSpeciesOpen] = useState(false);
  const [breedOpen, setBreedOpen] = useState(false);
  const [yearOpen, setYearOpen] = useState(false);
  const [monthOpen, setMonthOpen] = useState(false);
  const [breedQuery, setBreedQuery] = useState('');
  const [showVet, setShowVet] = useState(Boolean(initial?.vetClinicName || initial?.vetName));
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [approxCal, setApproxCal] = useState<{ year: number | null; month: number | null }>(() => {
    const seeded = hydratePetForm(initial);
    return ageToApproxBirth(seeded.approxYears, seeded.approxMonths) ?? { year: null, month: null };
  });

  useEffect(() => {
    onChange?.(value);
  }, [value, onChange]);

  const species = getSpecies(value.speciesId);
  const breedOptions = useMemo(
    () => (value.speciesId ? searchBreeds(value.speciesId, breedQuery) : []),
    [value.speciesId, breedQuery],
  );
  const yearOptions = useMemo(() => approxBirthYears(), []);

  const patch = (next: Partial<PetFormValue>) => setValue((prev) => ({ ...prev, ...next }));

  const applyApproxBirth = (year: number | null, month: number | null) => {
    setApproxCal({ year, month });
    if (year == null || month == null) {
      patch({ approxYears: '', approxMonths: '' });
      return;
    }
    const age = approxBirthToAge(year, month);
    if (!age) {
      patch({ approxYears: '', approxMonths: '' });
      return;
    }
    patch({ approxYears: String(age.years), approxMonths: String(age.months) });
  };

  const onSpecies = (id: string) => {
    patch({ speciesId: id, breedId: 'unknown', customBreed: '' });
    setBreedQuery('');
    setSpeciesOpen(false);
  };

  const pickPhoto = () => {
    Alert.alert(ka.pets.photo, undefined, [
      { text: ka.common.cancel, style: 'cancel' },
      {
        text: ka.upload.fromCamera,
        onPress: async () => {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (!perm.granted) {
            Alert.alert(ka.upload.permissionDenied);
            return;
          }
          const result = await ImagePicker.launchCameraAsync(IMAGE_PICKER_OPTIONS);
          if (result.canceled || !result.assets?.[0]) return;
          const file = await toUploadableImage(result.assets[0]);
          setLocalPhoto({ uri: file.uri, name: file.name, mimeType: file.mimeType });
          setRemovePhoto(false);
        },
      },
      {
        text: ka.upload.fromGallery,
        onPress: async () => {
          const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!perm.granted) {
            Alert.alert(ka.upload.permissionDenied);
            return;
          }
          const result = await ImagePicker.launchImageLibraryAsync(IMAGE_PICKER_OPTIONS);
          if (result.canceled || !result.assets?.[0]) return;
          const file = await toUploadableImage(result.assets[0]);
          setLocalPhoto({ uri: file.uri, name: file.name, mimeType: file.mimeType });
          setRemovePhoto(false);
        },
      },
    ]);
  };

  const validate = (): string | null => {
    if (!value.name.trim()) return ka.pets.nameRequired;
    if (!value.speciesId) return ka.pets.speciesRequired;
    if (value.breedId === 'custom' && !value.customBreed.trim()) return ka.pets.customBreed;
    if (value.ageKind === 'EXACT') {
      const parsed = parseBirthDate(value.birthDigits);
      if (!parsed.ok) return parsed.error;
    }
    if (value.ageKind === 'APPROXIMATE') {
      if (approxCal.year == null) return ka.pets.approxYearPick;
      if (approxCal.month == null) return ka.pets.approxMonthPick;
      if (!approxBirthToAge(approxCal.year, approxCal.month)) return ka.pets.ageApproximate;
    }
    return null;
  };

  const submit = () => {
    if (submitting) return;
    const problem = validate();
    if (problem) {
      setFieldError(problem);
      return;
    }
    setFieldError(null);
    onSubmit(value, localPhoto, removePhoto);
  };

  const breedSummary = () => {
    if (value.breedId === 'custom' && value.customBreed) return value.customBreed;
    if (value.breedId === 'mixed') return ka.pets.breedMixed;
    if (value.breedId === 'unknown' || !value.breedId) return ka.pets.breedUnknown;
    return species?.breeds.find((row) => row.id === value.breedId)?.label || ka.pets.breedUnknown;
  };

  const photoUri = localPhoto?.uri || (!removePhoto ? existingPhotoUrl : null);
  const hasPhoto = Boolean(localPhoto || (existingPhotoUrl && !removePhoto));
  const progress = petFormProgress(value, hasPhoto);
  const SpeciesIcon = speciesIcon(value.speciesId);
  const breedIcon =
    value.breedId === 'custom'
      ? Pencil
      : value.breedId === 'mixed'
        ? PawPrint
        : value.breedId === 'unknown' || !value.breedId
          ? CircleQuestionMark
          : SpeciesIcon;

  const pickBreed = (breedId: string) => {
    patch({ breedId, customBreed: breedId === 'custom' ? value.customBreed : '' });
    setBreedOpen(false);
  };

  const fields = (
    <>
      <View className="items-center">
        <PetPhotoProgress
          localUri={localPhoto?.uri ?? null}
          existingPhotoUrl={removePhoto ? null : existingPhotoUrl ?? null}
          name={value.name}
          progress={progress}
          onPress={pickPhoto}
        />
        <Text className="mt-3 text-sm font-semibold text-primary-200">
          {photoUri && !removePhoto ? ka.pets.photoChange : ka.pets.photoAdd}
        </Text>
        {hasPhoto ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={ka.pets.photoRemove}
            onPress={() => {
              setRemovePhoto(true);
              setLocalPhoto(null);
            }}
            className="mt-1 min-h-11 justify-center active:opacity-80"
          >
            <Text className="text-sm text-text-300">{ka.pets.photoRemove}</Text>
          </Pressable>
        ) : null}
        <Text className="mt-1 text-center text-xs text-text-300">{ka.pets.photoHint}</Text>
      </View>

      <Input
        figma
        icon={PawPrint}
        label={ka.pets.name}
        value={value.name}
        onChangeText={(name) => patch({ name })}
        placeholder={ka.pets.namePh}
        maxLength={40}
        autoCapitalize="words"
      />

      <SelectField
        label={ka.pets.species}
        value={species?.labelKa || ''}
        placeholder={ka.pets.species}
        icon={SpeciesIcon}
        onPress={() => setSpeciesOpen(true)}
      />

      <View className="gap-3">
        <SelectField
          label={ka.pets.breed}
          value={breedSummary()}
          icon={breedIcon}
          onPress={() => setBreedOpen(true)}
          hint={ka.pets.catalogCoverage}
        />
        {value.breedId === 'custom' ? (
          <Input
            figma
            icon={Pencil}
            label={ka.pets.customBreed}
            value={value.customBreed}
            onChangeText={(customBreed) => patch({ customBreed })}
            placeholder={ka.pets.customBreedPh}
            maxLength={80}
          />
        ) : null}
      </View>

      <View style={{ gap: 12 }}>
        <PetSectionLabel label={ka.pets.sex} />
        <PetChipRow>
          <PetFilterChip
            label={ka.pets.sexMale}
            icon={Mars}
            selected={value.sex === 'MALE'}
            onPress={() => patch({ sex: 'MALE' })}
          />
          <PetFilterChip
            label={ka.pets.sexFemale}
            icon={Venus}
            selected={value.sex === 'FEMALE'}
            onPress={() => patch({ sex: 'FEMALE' })}
          />
          <PetFilterChip
            label={ka.pets.sexUnknown}
            icon={CircleQuestionMark}
            selected={value.sex === 'UNKNOWN'}
            onPress={() => patch({ sex: 'UNKNOWN' })}
          />
        </PetChipRow>
      </View>

      <View style={{ gap: 12 }}>
        <PetSectionLabel label={ka.pets.neutered} />
        <PetChipRow>
          <PetFilterChip
            label={ka.pets.neuteredYes}
            icon={Stethoscope}
            selected={value.neutered === true}
            onPress={() => patch({ neutered: true })}
          />
          <PetFilterChip
            label={ka.pets.neuteredNo}
            icon={X}
            selected={value.neutered === false}
            onPress={() => patch({ neutered: false })}
          />
          <PetFilterChip
            label={ka.pets.neuteredUnknown}
            icon={CircleQuestionMark}
            selected={value.neutered == null}
            onPress={() => patch({ neutered: null })}
          />
        </PetChipRow>
      </View>

      <View style={{ gap: 12 }}>
        <PetSectionLabel label={ka.pets.age} />
        <PetChipRow>
          <PetFilterChip
            label={ka.pets.ageExact}
            icon={CalendarDays}
            selected={value.ageKind === 'EXACT'}
            onPress={() => patch({ ageKind: 'EXACT' })}
          />
          <PetFilterChip
            label={ka.pets.ageApproximate}
            icon={Clock}
            selected={value.ageKind === 'APPROXIMATE'}
            onPress={() => patch({ ageKind: 'APPROXIMATE' })}
          />
          <PetFilterChip
            label={ka.pets.ageUnknown}
            icon={CircleQuestionMark}
            selected={value.ageKind === 'UNKNOWN'}
            onPress={() => patch({ ageKind: 'UNKNOWN' })}
          />
        </PetChipRow>
      </View>
      {value.ageKind === 'EXACT' ? (
        <DateField
          figma
          label={ka.pets.birthDate}
          value={value.birthDigits}
          onChangeText={(birthDigits) => patch({ birthDigits })}
        />
      ) : null}
      {value.ageKind === 'APPROXIMATE' ? (
        <View className="flex-row gap-3">
          <View className="flex-1">
            <SelectField
              label={ka.pets.approxYears}
              value={approxCal.year == null ? '' : String(approxCal.year)}
              placeholder={ka.pets.approxYearPick}
              icon={CalendarDays}
              onPress={() => setYearOpen(true)}
            />
          </View>
          <View className="flex-1">
            <SelectField
              label={ka.pets.approxMonths}
              value={approxCal.month == null ? '' : ka.auth.months[approxCal.month - 1]}
              placeholder={ka.pets.approxMonthPick}
              icon={Clock}
              onPress={() => setMonthOpen(true)}
            />
          </View>
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: showVet }}
        onPress={() => setShowVet((open) => !open)}
        className="min-h-11 flex-row items-center justify-between active:opacity-80"
      >
        <Text className="text-sm font-semibold text-primary-200">{ka.pets.vetSection}</Text>
        <ChevronDown
          size={18}
          color={colors.primary200}
          strokeWidth={2.2}
          style={{ transform: [{ rotate: showVet ? '180deg' : '0deg' }] }}
        />
      </Pressable>
      {showVet ? (
        <View className="gap-4">
          <Input
            figma
            icon={Building2}
            label={ka.pets.vetClinic}
            value={value.vetClinicName}
            onChangeText={(vetClinicName) => patch({ vetClinicName })}
          />
          <Input
            figma
            icon={Stethoscope}
            label={ka.pets.vetDoctor}
            value={value.vetName}
            onChangeText={(vetName) => patch({ vetName })}
          />
          <Input
            figma
            icon={Phone}
            label={ka.pets.vetPhone}
            value={value.vetPhone}
            onChangeText={(vetPhone) => patch({ vetPhone })}
            keyboardType="phone-pad"
          />
          <Input
            figma
            icon={MapPin}
            label={ka.pets.vetAddress}
            value={value.vetAddress}
            onChangeText={(vetAddress) => patch({ vetAddress })}
          />
          <Input
            figma
            icon={Pencil}
            label={ka.pets.vetNotes}
            value={value.vetNotes}
            onChangeText={(vetNotes) => patch({ vetNotes })}
            multiline
          />
        </View>
      ) : null}
    </>
  );

  const sheets = (
    <>
      <PetSheet visible={speciesOpen} title={ka.pets.species} onClose={() => setSpeciesOpen(false)}>
        <ScrollView style={{ maxHeight: 360 }} keyboardShouldPersistTaps="handled">
          <View style={{ gap: 8, paddingBottom: 8 }}>
            {SPECIES.map((row) => (
              <PetFilterChip
                key={row.id}
                fill
                label={row.labelKa}
                icon={speciesIcon(row.id)}
                selected={value.speciesId === row.id}
                onPress={() => onSpecies(row.id)}
              />
            ))}
          </View>
        </ScrollView>
      </PetSheet>

      <PetSheet visible={breedOpen} title={ka.pets.breed} onClose={() => setBreedOpen(false)}>
        <View style={{ gap: 8 }}>
          {species && species.breeds.length > 0 ? (
            <Input
              figma
              icon={Search}
              value={breedQuery}
              onChangeText={setBreedQuery}
              placeholder={ka.pets.breedSearchPh}
              autoCapitalize="none"
            />
          ) : (
            <Text className="text-sm text-text-300">{ka.pets.catalogLimited}</Text>
          )}
          <ScrollView style={{ maxHeight: 360 }} keyboardShouldPersistTaps="handled">
            <View style={{ gap: 8, paddingBottom: 8 }}>
              <PetFilterChip
                fill
                label={ka.pets.breedUnknown}
                icon={CircleQuestionMark}
                selected={value.breedId === 'unknown'}
                onPress={() => pickBreed('unknown')}
              />
              {species?.allowsMixed ? (
                <PetFilterChip
                  fill
                  label={ka.pets.breedMixed}
                  icon={PawPrint}
                  selected={value.breedId === 'mixed'}
                  onPress={() => pickBreed('mixed')}
                />
              ) : null}
              <PetFilterChip
                fill
                label={ka.pets.breedCustom}
                icon={Pencil}
                selected={value.breedId === 'custom'}
                onPress={() => pickBreed('custom')}
              />
              {breedOptions.map((row) => (
                <PetFilterChip
                  key={row.id}
                  fill
                  label={row.label}
                  icon={speciesIcon(value.speciesId)}
                  selected={value.breedId === row.id}
                  onPress={() => pickBreed(row.id)}
                />
              ))}
              <Text className="mt-1 text-xs text-text-300">{ka.pets.catalogAttribution}</Text>
            </View>
          </ScrollView>
        </View>
      </PetSheet>
      <PetSheet visible={yearOpen} title={ka.pets.approxYears} onClose={() => setYearOpen(false)}>
        <ScrollView style={{ maxHeight: 360 }} keyboardShouldPersistTaps="handled">
          <View style={{ gap: 8, paddingBottom: 8 }}>
            {yearOptions.map((year) => (
              <PetFilterChip
                key={year}
                fill
                label={String(year)}
                icon={CalendarDays}
                selected={approxCal.year === year}
                onPress={() => {
                  const month =
                    approxCal.month != null && approxBirthToAge(year, approxCal.month) ? approxCal.month : null;
                  applyApproxBirth(year, month);
                  setYearOpen(false);
                }}
              />
            ))}
          </View>
        </ScrollView>
      </PetSheet>
      <PetSheet visible={monthOpen} title={ka.pets.approxMonths} onClose={() => setMonthOpen(false)}>
        <View style={{ gap: 8, paddingBottom: 8 }}>
          {ka.auth.months.map((label, index) => {
            const month = index + 1;
            if (approxCal.year != null && !approxBirthToAge(approxCal.year, month)) return null;
            return (
              <PetFilterChip
                key={label}
                fill
                label={label}
                icon={Clock}
                selected={approxCal.month === month}
                onPress={() => {
                  applyApproxBirth(approxCal.year, month);
                  setMonthOpen(false);
                }}
              />
            );
          })}
        </View>
      </PetSheet>
    </>
  );

  const footer = (
    <>
      <PetErrorText message={fieldError || error} />
      <Button label={submitLabel} loading={submitting} disabled={submitting} onPress={submit} />
    </>
  );

  return (
    <>
      <PetFormScroll footer={footer}>{fields}</PetFormScroll>
      {sheets}
    </>
  );
}
