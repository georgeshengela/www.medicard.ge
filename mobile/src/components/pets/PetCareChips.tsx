import React from 'react';
import { ChoiceTiles } from '@/components/ui/ChoiceTiles';
import { ka } from '@/i18n/ka';
import { CARE_KINDS, kindLabel } from '@/lib/petsCare';
import type { PetCareKind, PetCareRoute, PetCareSource, PetRecurrenceBasis, PetRecurrenceKind } from '@/lib/api';

export function CareKindChips({
  value,
  onChange,
}: {
  value: PetCareKind | null;
  onChange: (kind: PetCareKind) => void;
}) {
  return (
    <ChoiceTiles
      label={ka.pets.careKind}
      value={value}
      onChange={onChange}
      options={CARE_KINDS.map((kind) => ({ value: kind, label: kindLabel(kind, ka.pets) }))}
    />
  );
}

export function RecurrenceChips({
  value,
  onChange,
}: {
  value: PetRecurrenceKind;
  onChange: (kind: PetRecurrenceKind) => void;
}) {
  return (
    <ChoiceTiles
      label={ka.pets.recurrence}
      value={value}
      onChange={onChange}
      options={[
        { value: 'ONCE', label: ka.pets.once },
        { value: 'EVERY_N_DAYS', label: ka.pets.everyNDays },
        { value: 'EVERY_N_WEEKS', label: ka.pets.everyNWeeks },
        { value: 'EVERY_N_MONTHS', label: ka.pets.everyNMonths },
        { value: 'DAILY_COURSE', label: ka.pets.dailyCourse },
      ]}
    />
  );
}

export function BasisChips({
  value,
  onChange,
}: {
  value: PetRecurrenceBasis;
  onChange: (basis: PetRecurrenceBasis) => void;
}) {
  return (
    <ChoiceTiles
      label={ka.pets.basis}
      value={value}
      onChange={onChange}
      columns={1}
      options={[
        { value: 'FIXED_CALENDAR', label: ka.pets.basisCalendar },
        { value: 'FROM_ADMINISTRATION', label: ka.pets.basisAdmin },
      ]}
    />
  );
}

export function SourceChips({
  value,
  onChange,
}: {
  value: PetCareSource;
  onChange: (source: PetCareSource) => void;
}) {
  return (
    <ChoiceTiles
      label={ka.pets.source}
      value={value}
      onChange={onChange}
      columns={1}
      options={[
        { value: 'VETERINARIAN', label: ka.pets.sourceVet },
        { value: 'PRODUCT_INSTRUCTIONS', label: ka.pets.sourceProduct },
        { value: 'USER_ENTERED', label: ka.pets.sourceUser },
      ]}
    />
  );
}

export function RouteChips({
  value,
  onChange,
}: {
  value: PetCareRoute | null;
  onChange: (route: PetCareRoute) => void;
}) {
  return (
    <ChoiceTiles
      label={ka.pets.route}
      value={value}
      onChange={onChange}
      options={[
        { value: 'oral', label: ka.pets.routeOral },
        { value: 'topical', label: ka.pets.routeTopical },
        { value: 'injection', label: ka.pets.routeInjection },
        { value: 'other', label: ka.pets.routeOther },
        { value: 'unknown', label: ka.pets.routeUnknown },
      ]}
    />
  );
}
