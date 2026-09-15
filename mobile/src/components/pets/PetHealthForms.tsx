import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import {
  Check,
  CheckCircle2,
  CircleQuestionMark,
  HeartPulse,
  Pencil,
  Pill,
  Scale,
  ShieldAlert,
  Stethoscope,
  User,
  Utensils,
  Wind,
  Zap,
  type LucideIcon,
} from 'lucide-react-native';
import { Button } from '@/components/ui/Button';
import { DateField } from '@/components/ui/DateField';
import { Input } from '@/components/ui/Input';
import {
  PetChipRow,
  PetErrorText,
  PetFilterChip,
  PetFormScroll,
  PetSectionLabel,
} from '@/components/pets/PetScreen';
import { ka } from '@/i18n/ka';
import { isoToDigits, parseCivilDate } from '@/lib/birthdate';
import type {
  PetAllergy,
  PetAllergyCategory,
  PetAllergyStatus,
  PetAllergyWrite,
  PetCondition,
  PetConditionBasis,
  PetConditionStatus,
  PetConditionWrite,
  PetWeightLog,
  PetWeightUnit,
  PetWeightWrite,
} from '@/lib/api';
import { todayIsoLocal } from '@/lib/visitReminders';

function digitsToIso(digits: string): string | null {
  if (!digits) return null;
  const parsed = parseCivilDate(digits);
  return parsed.ok ? parsed.iso : '';
}

function ChipField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 12 }}>
      <PetSectionLabel label={label} />
      {children}
    </View>
  );
}

export function allergyCategoryIcon(category: PetAllergyCategory): LucideIcon {
  switch (category) {
    case 'food':
      return Utensils;
    case 'medication':
      return Pill;
    case 'environmental':
      return Wind;
    case 'unknown':
      return CircleQuestionMark;
    default:
      return ShieldAlert;
  }
}

export function PetWeightForm({
  initial,
  saving,
  error,
  footer,
  onSubmit,
}: {
  initial?: PetWeightLog | null;
  saving: boolean;
  error: string | null;
  footer?: React.ReactNode;
  onSubmit: (body: PetWeightWrite) => void;
}) {
  const [value, setValue] = useState(initial ? String(initial.inputValue) : '');
  const [unit, setUnit] = useState<PetWeightUnit>(initial?.inputUnit || 'kg');
  const [dateDigits, setDateDigits] = useState(isoToDigits(initial?.recordedOn || todayIsoLocal()));
  const [note, setNote] = useState(initial?.note || '');
  const [fieldError, setFieldError] = useState<string | null>(null);

  const submit = () => {
    const amount = Number(value.replace(',', '.'));
    if (!Number.isFinite(amount) || amount <= 0) {
      setFieldError(ka.pets.weightRequired);
      return;
    }
    const iso = digitsToIso(dateDigits);
    if (!iso) {
      setFieldError(ka.pets.recordedOn);
      return;
    }
    setFieldError(null);
    onSubmit({
      recordedOn: iso,
      inputValue: amount,
      inputUnit: unit,
      note: note.trim() || null,
    });
  };

  const weightInvalid = fieldError === ka.pets.weightRequired;

  return (
    <PetFormScroll
      footer={
        <>
          <PetErrorText message={weightInvalid ? error : fieldError || error} />
          <Button
            icon={Check}
            label={saving ? ka.pets.saving : ka.pets.save}
            loading={saving}
            onPress={submit}
          />
          {footer}
        </>
      }
    >
      <Input
        figma
        icon={Scale}
        label={ka.pets.weightValue}
        value={value}
        onChangeText={setValue}
        keyboardType="decimal-pad"
        placeholder="4.2"
        error={weightInvalid ? ka.pets.weightRequired : undefined}
      />
      <ChipField label={ka.pets.weightUnit}>
        <PetChipRow>
          <PetFilterChip label={ka.pets.unitKg} selected={unit === 'kg'} onPress={() => setUnit('kg')} />
          <PetFilterChip label={ka.pets.unitG} selected={unit === 'g'} onPress={() => setUnit('g')} />
          <PetFilterChip label={ka.pets.unitLb} selected={unit === 'lb'} onPress={() => setUnit('lb')} />
        </PetChipRow>
      </ChipField>
      <DateField
        figma
        label={ka.pets.recordedOn}
        value={dateDigits}
        onChangeText={setDateDigits}
        showAge={false}
        placeholder={ka.pets.datePh}
      />
      <Input
        figma
        icon={Pencil}
        label={ka.pets.note}
        value={note}
        onChangeText={setNote}
        placeholder={ka.pets.notePh}
      />
    </PetFormScroll>
  );
}

export function PetAllergyForm({
  initial,
  saving,
  error,
  footer,
  onSubmit,
}: {
  initial?: PetAllergy | null;
  saving: boolean;
  error: string | null;
  footer?: React.ReactNode;
  onSubmit: (body: PetAllergyWrite) => void;
}) {
  const [name, setName] = useState(initial?.name || '');
  const [category, setCategory] = useState<PetAllergyCategory>(initial?.category || 'unknown');
  const [status, setStatus] = useState<PetAllergyStatus>(initial?.reportedStatus || 'suspected');
  const [reaction, setReaction] = useState(initial?.reaction || '');
  const [notes, setNotes] = useState(initial?.notes || '');
  const [dateDigits, setDateDigits] = useState(isoToDigits(initial?.notedOn));
  const [fieldError, setFieldError] = useState<string | null>(null);

  const categories = useMemo(
    () =>
      [
        { value: 'unknown' as const, label: ka.pets.allergyCatUnknown, icon: CircleQuestionMark },
        { value: 'food' as const, label: ka.pets.allergyCatFood, icon: Utensils },
        { value: 'medication' as const, label: ka.pets.allergyCatMedication, icon: Pill },
        { value: 'environmental' as const, label: ka.pets.allergyCatEnvironmental, icon: Wind },
        { value: 'other' as const, label: ka.pets.allergyCatOther, icon: ShieldAlert },
      ],
    [],
  );

  const submit = () => {
    if (!name.trim()) {
      setFieldError(ka.pets.nameRequired);
      return;
    }
    const iso = dateDigits ? digitsToIso(dateDigits) : null;
    if (dateDigits && iso === '') {
      setFieldError(ka.pets.allergyNotedOn);
      return;
    }
    setFieldError(null);
    onSubmit({
      name: name.trim(),
      category,
      reportedStatus: status,
      reaction: reaction.trim() || null,
      notes: notes.trim() || null,
      notedOn: iso,
    });
  };

  const nameInvalid = fieldError === ka.pets.nameRequired;

  return (
    <PetFormScroll
      footer={
        <>
          <PetErrorText message={nameInvalid ? error : fieldError || error} />
          <Button
            icon={Check}
            label={saving ? ka.pets.saving : ka.pets.save}
            loading={saving}
            onPress={submit}
          />
          {footer}
        </>
      }
    >
      <Input
        figma
        icon={allergyCategoryIcon(category)}
        label={ka.pets.allergen}
        value={name}
        onChangeText={setName}
        placeholder={ka.pets.allergenPh}
        error={nameInvalid ? ka.pets.nameRequired : undefined}
      />
      <ChipField label={ka.pets.allergyCategory}>
        <PetChipRow>
          {categories.map((option) => (
            <PetFilterChip
              key={option.value}
              label={option.label}
              icon={option.icon}
              selected={category === option.value}
              onPress={() => setCategory(option.value)}
            />
          ))}
        </PetChipRow>
      </ChipField>
      <ChipField label={ka.pets.allergyReported}>
        <View style={{ gap: 8 }}>
          <PetFilterChip
            fill
            label={ka.pets.allergySuspected}
            icon={User}
            selected={status === 'suspected'}
            onPress={() => setStatus('suspected')}
          />
          <PetFilterChip
            fill
            label={ka.pets.allergyVetConfirmed}
            icon={Stethoscope}
            selected={status === 'veterinarian_confirmed'}
            onPress={() => setStatus('veterinarian_confirmed')}
          />
        </View>
      </ChipField>
      <Input
        figma
        icon={Zap}
        label={ka.pets.allergyReaction}
        value={reaction}
        onChangeText={setReaction}
        placeholder={ka.pets.allergyReactionPh}
      />
      <DateField
        figma
        label={ka.pets.allergyNotedOn}
        value={dateDigits}
        onChangeText={setDateDigits}
        showAge={false}
        placeholder={ka.pets.datePh}
        hint={ka.pets.dateUnknownHint}
      />
      <Input
        figma
        icon={Pencil}
        label={ka.pets.note}
        value={notes}
        onChangeText={setNotes}
        placeholder={ka.pets.notePh}
      />
    </PetFormScroll>
  );
}

export function PetConditionForm({
  initial,
  saving,
  error,
  footer,
  onSubmit,
}: {
  initial?: PetCondition | null;
  saving: boolean;
  error: string | null;
  footer?: React.ReactNode;
  onSubmit: (body: PetConditionWrite) => void;
}) {
  const [name, setName] = useState(initial?.name || '');
  const [status, setStatus] = useState<PetConditionStatus>(initial?.status || 'active');
  const [basis, setBasis] = useState<PetConditionBasis>(initial?.reportedBasis || 'owner_reported');
  const [onsetDigits, setOnsetDigits] = useState(isoToDigits(initial?.onsetOn));
  const [resolvedDigits, setResolvedDigits] = useState(isoToDigits(initial?.resolvedOn));
  const [notes, setNotes] = useState(initial?.notes || '');
  const [fieldError, setFieldError] = useState<string | null>(null);

  const submit = () => {
    if (!name.trim()) {
      setFieldError(ka.pets.nameRequired);
      return;
    }
    const onsetOn = onsetDigits ? digitsToIso(onsetDigits) : null;
    const resolvedOn = resolvedDigits ? digitsToIso(resolvedDigits) : null;
    if (onsetDigits && onsetOn === '') {
      setFieldError(ka.pets.conditionOnset);
      return;
    }
    if (resolvedDigits && resolvedOn === '') {
      setFieldError(ka.pets.conditionResolvedOn);
      return;
    }
    setFieldError(null);
    onSubmit({
      name: name.trim(),
      status,
      reportedBasis: basis,
      onsetOn,
      resolvedOn: status === 'resolved' ? resolvedOn : null,
      notes: notes.trim() || null,
    });
  };

  const nameInvalid = fieldError === ka.pets.nameRequired;

  return (
    <PetFormScroll
      footer={
        <>
          <PetErrorText message={nameInvalid ? error : fieldError || error} />
          <Button
            icon={Check}
            label={saving ? ka.pets.saving : ka.pets.save}
            loading={saving}
            onPress={submit}
          />
          {footer}
        </>
      }
    >
      <Input
        figma
        icon={Stethoscope}
        label={ka.pets.conditionName}
        value={name}
        onChangeText={setName}
        placeholder={ka.pets.conditionNamePh}
        error={nameInvalid ? ka.pets.nameRequired : undefined}
      />
      <ChipField label={ka.pets.conditionStatus}>
        <PetChipRow>
          <PetFilterChip
            label={ka.pets.conditionActive}
            icon={HeartPulse}
            selected={status === 'active'}
            onPress={() => setStatus('active')}
          />
          <PetFilterChip
            label={ka.pets.conditionResolved}
            icon={CheckCircle2}
            selected={status === 'resolved'}
            onPress={() => setStatus('resolved')}
          />
          <PetFilterChip
            label={ka.pets.conditionUnknown}
            icon={CircleQuestionMark}
            selected={status === 'unknown'}
            onPress={() => setStatus('unknown')}
          />
        </PetChipRow>
      </ChipField>
      <ChipField label={ka.pets.conditionBasis}>
        <View style={{ gap: 8 }}>
          <PetFilterChip
            fill
            label={ka.pets.conditionOwnerReported}
            icon={User}
            selected={basis === 'owner_reported'}
            onPress={() => setBasis('owner_reported')}
          />
          <PetFilterChip
            fill
            label={ka.pets.conditionVetConfirmed}
            icon={Stethoscope}
            selected={basis === 'veterinarian_confirmed'}
            onPress={() => setBasis('veterinarian_confirmed')}
          />
        </View>
      </ChipField>
      <DateField
        figma
        label={ka.pets.conditionOnset}
        value={onsetDigits}
        onChangeText={setOnsetDigits}
        showAge={false}
        placeholder={ka.pets.datePh}
        hint={ka.pets.dateUnknownHint}
      />
      {status === 'resolved' ? (
        <DateField
          figma
          label={ka.pets.conditionResolvedOn}
          value={resolvedDigits}
          onChangeText={setResolvedDigits}
          showAge={false}
          placeholder={ka.pets.datePh}
          hint={ka.pets.dateUnknownHint}
        />
      ) : null}
      <Input
        figma
        icon={Pencil}
        label={ka.pets.note}
        value={notes}
        onChangeText={setNotes}
        placeholder={ka.pets.notePh}
      />
    </PetFormScroll>
  );
}
