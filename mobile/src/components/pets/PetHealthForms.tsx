import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { DateField } from '@/components/ui/DateField';
import { Input } from '@/components/ui/Input';
import { ChoiceTiles } from '@/components/ui/ChoiceTiles';
import { SegmentedField } from '@/components/ui/SegmentedField';
import { PetErrorText, PetFormScroll } from '@/components/pets/PetScreen';
import { ka } from '@/i18n/ka';
import { isoToDigits, parseBirthDate } from '@/lib/birthdate';
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
  const parsed = parseBirthDate(digits);
  return parsed.ok ? parsed.iso : '';
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

  return (
    <PetFormScroll
      footer={
        <>
          <PetErrorText message={fieldError || error} />
          <Button label={saving ? ka.pets.saving : ka.pets.save} loading={saving} onPress={submit} />
          {footer}
        </>
      }
    >
      <Input
        label={ka.pets.weightValue}
        value={value}
        onChangeText={setValue}
        keyboardType="decimal-pad"
        placeholder="4.2"
      />
      <SegmentedField
        label={ka.pets.weightUnit}
        value={unit}
        onChange={setUnit}
        options={[
          { value: 'kg', label: ka.pets.unitKg },
          { value: 'g', label: ka.pets.unitG },
          { value: 'lb', label: ka.pets.unitLb },
        ]}
      />
      <DateField
        label={ka.pets.recordedOn}
        value={dateDigits}
        onChangeText={setDateDigits}
        showAge={false}
        placeholder={ka.pets.datePh}
      />
      <Input label={ka.pets.note} value={note} onChangeText={setNote} placeholder={ka.pets.notePh} />
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
        { value: 'unknown' as const, label: ka.pets.allergyCatUnknown },
        { value: 'food' as const, label: ka.pets.allergyCatFood },
        { value: 'medication', label: ka.pets.allergyCatMedication },
        { value: 'environmental', label: ka.pets.allergyCatEnvironmental },
        { value: 'other', label: ka.pets.allergyCatOther },
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

  return (
    <PetFormScroll
      footer={
        <>
          <PetErrorText message={fieldError || error} />
          <Button label={saving ? ka.pets.saving : ka.pets.save} loading={saving} onPress={submit} />
          {footer}
        </>
      }
    >
      <Input label={ka.pets.allergen} value={name} onChangeText={setName} placeholder={ka.pets.allergenPh} />
      <ChoiceTiles label={ka.pets.allergyCategory} value={category} onChange={setCategory} options={categories} />
      <ChoiceTiles
        label={ka.pets.allergyReported}
        value={status}
        onChange={setStatus}
        columns={1}
        options={[
          { value: 'suspected', label: ka.pets.allergySuspected },
          { value: 'veterinarian_confirmed', label: ka.pets.allergyVetConfirmed },
        ]}
      />
      <Input label={ka.pets.allergyReaction} value={reaction} onChangeText={setReaction} placeholder={ka.pets.allergyReactionPh} />
      <DateField
        label={ka.pets.allergyNotedOn}
        value={dateDigits}
        onChangeText={setDateDigits}
        showAge={false}
        placeholder={ka.pets.datePh}
        hint={ka.pets.dateUnknownHint}
      />
      <Input label={ka.pets.note} value={notes} onChangeText={setNotes} placeholder={ka.pets.notePh} />
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

  return (
    <PetFormScroll
      footer={
        <>
          <PetErrorText message={fieldError || error} />
          <Button label={saving ? ka.pets.saving : ka.pets.save} loading={saving} onPress={submit} />
          {footer}
        </>
      }
    >
      <Input label={ka.pets.conditionName} value={name} onChangeText={setName} placeholder={ka.pets.conditionNamePh} />
      <SegmentedField
        label={ka.pets.conditionStatus}
        value={status}
        onChange={setStatus}
        options={[
          { value: 'active', label: ka.pets.conditionActive },
          { value: 'resolved', label: ka.pets.conditionResolved },
          { value: 'unknown', label: ka.pets.conditionUnknown },
        ]}
      />
      <ChoiceTiles
        label={ka.pets.conditionBasis}
        value={basis}
        onChange={setBasis}
        columns={1}
        options={[
          { value: 'owner_reported', label: ka.pets.conditionOwnerReported },
          { value: 'veterinarian_confirmed', label: ka.pets.conditionVetConfirmed },
        ]}
      />
      <DateField
        label={ka.pets.conditionOnset}
        value={onsetDigits}
        onChangeText={setOnsetDigits}
        showAge={false}
        placeholder={ka.pets.datePh}
        hint={ka.pets.dateUnknownHint}
      />
      {status === 'resolved' ? (
        <DateField
          label={ka.pets.conditionResolvedOn}
          value={resolvedDigits}
          onChangeText={setResolvedDigits}
          showAge={false}
          placeholder={ka.pets.datePh}
          hint={ka.pets.dateUnknownHint}
        />
      ) : null}
      <Input label={ka.pets.note} value={notes} onChangeText={setNotes} placeholder={ka.pets.notePh} />
    </PetFormScroll>
  );
}
