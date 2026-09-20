import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import {
  BookOpen,
  Bug,
  BugOff,
  Calendar,
  CalendarDays,
  Clock,
  CircleQuestionMark,
  Droplet,
  HeartPulse,
  Package,
  Pill,
  Plus,
  Stethoscope,
  Syringe,
  User,
  type LucideIcon,
} from 'lucide-react-native';
import { SelectField } from '@/components/ui/SelectField';
import { PetChipRow, PetFilterChip, PetSectionLabel, PetSheet } from '@/components/pets/PetScreen';
import { ka } from '@/i18n/ka';
import { CARE_KINDS, kindLabel } from '@/lib/petsCare';
import type {
  PetCareKind,
  PetCareRoute,
  PetCareSource,
  PetProduct,
  PetRecurrenceBasis,
  PetRecurrenceKind,
} from '@/lib/api';

export function CareChipField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 12 }}>
      <PetSectionLabel label={label} />
      {children}
    </View>
  );
}

export function careKindIcon(kind: PetCareKind | null | undefined): LucideIcon {
  switch (kind) {
    case 'VACCINATION':
      return Syringe;
    case 'FLEA_TICK':
      return Bug;
    case 'DEWORMING':
      return BugOff;
    case 'MEDICATION':
      return Pill;
    default:
      return HeartPulse;
  }
}

export function CareKindChips({
  value,
  onChange,
}: {
  value: PetCareKind | null;
  onChange: (kind: PetCareKind) => void;
}) {
  return (
    <CareChipField label={ka.pets.careKind}>
      <PetChipRow>
        {(CARE_KINDS as readonly PetCareKind[]).map((kind) => (
          <PetFilterChip
            key={kind}
            label={kindLabel(kind, ka.pets)}
            icon={careKindIcon(kind)}
            selected={value === kind}
            onPress={() => onChange(kind)}
          />
        ))}
      </PetChipRow>
    </CareChipField>
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
    <CareChipField label={ka.pets.recurrence}>
      <PetChipRow>
        <PetFilterChip label={ka.pets.once} icon={Calendar} selected={value === 'ONCE'} onPress={() => onChange('ONCE')} />
        <PetFilterChip
          label={ka.pets.everyNDays}
          icon={CalendarDays}
          selected={value === 'EVERY_N_DAYS'}
          onPress={() => onChange('EVERY_N_DAYS')}
        />
        <PetFilterChip
          label={ka.pets.everyNWeeks}
          icon={CalendarDays}
          selected={value === 'EVERY_N_WEEKS'}
          onPress={() => onChange('EVERY_N_WEEKS')}
        />
        <PetFilterChip
          label={ka.pets.everyNMonths}
          icon={CalendarDays}
          selected={value === 'EVERY_N_MONTHS'}
          onPress={() => onChange('EVERY_N_MONTHS')}
        />
        <PetFilterChip
          label={ka.pets.dailyCourse}
          icon={Clock}
          selected={value === 'DAILY_COURSE'}
          onPress={() => onChange('DAILY_COURSE')}
        />
      </PetChipRow>
    </CareChipField>
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
    <CareChipField label={ka.pets.basis}>
      <View style={{ gap: 8 }}>
        <PetFilterChip
          fill
          label={ka.pets.basisCalendar}
          icon={Calendar}
          selected={value === 'FIXED_CALENDAR'}
          onPress={() => onChange('FIXED_CALENDAR')}
        />
        <PetFilterChip
          fill
          label={ka.pets.basisAdmin}
          icon={Clock}
          selected={value === 'FROM_ADMINISTRATION'}
          onPress={() => onChange('FROM_ADMINISTRATION')}
        />
      </View>
    </CareChipField>
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
    <CareChipField label={ka.pets.source}>
      <View style={{ gap: 8 }}>
        <PetFilterChip
          fill
          label={ka.pets.sourceVet}
          icon={Stethoscope}
          selected={value === 'VETERINARIAN'}
          onPress={() => onChange('VETERINARIAN')}
        />
        <PetFilterChip
          fill
          label={ka.pets.sourceProduct}
          icon={BookOpen}
          selected={value === 'PRODUCT_INSTRUCTIONS'}
          onPress={() => onChange('PRODUCT_INSTRUCTIONS')}
        />
        <PetFilterChip
          fill
          label={ka.pets.sourceUser}
          icon={User}
          selected={value === 'USER_ENTERED'}
          onPress={() => onChange('USER_ENTERED')}
        />
      </View>
    </CareChipField>
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
    <CareChipField label={ka.pets.route}>
      <PetChipRow>
        <PetFilterChip label={ka.pets.routeOral} icon={Pill} selected={value === 'oral'} onPress={() => onChange('oral')} />
        <PetFilterChip
          label={ka.pets.routeTopical}
          icon={Droplet}
          selected={value === 'topical'}
          onPress={() => onChange('topical')}
        />
        <PetFilterChip
          label={ka.pets.routeInjection}
          icon={Syringe}
          selected={value === 'injection'}
          onPress={() => onChange('injection')}
        />
        <PetFilterChip label={ka.pets.routeOther} icon={HeartPulse} selected={value === 'other'} onPress={() => onChange('other')} />
        <PetFilterChip
          label={ka.pets.routeUnknown}
          icon={CircleQuestionMark}
          selected={value === 'unknown'}
          onPress={() => onChange('unknown')}
        />
      </PetChipRow>
    </CareChipField>
  );
}

export function CareIntentChips({
  value,
  onChange,
}: {
  value: 'given' | 'plan';
  onChange: (mode: 'given' | 'plan') => void;
}) {
  return (
    <CareChipField label={ka.pets.alreadyGiven}>
      <View style={{ gap: 8 }}>
        <PetFilterChip
          fill
          label={ka.pets.alreadyGiven}
          icon={Clock}
          selected={value === 'given'}
          onPress={() => onChange('given')}
        />
        <PetFilterChip
          fill
          label={ka.pets.planningNext}
          icon={CalendarDays}
          selected={value === 'plan'}
          onPress={() => onChange('plan')}
        />
      </View>
    </CareChipField>
  );
}

export function CareProductPicker({
  products,
  value,
  onChange,
  onAddNew,
}: {
  products: PetProduct[];
  value: string | null;
  onChange: (id: string | null, product?: PetProduct) => void;
  onAddNew?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = products.find((row) => row.id === value);

  return (
    <View style={{ gap: 8 }}>
      <SelectField
        icon={Package}
        label={ka.pets.productsTitle}
        value={selected?.name || ''}
        placeholder={ka.pets.skipProduct}
        onPress={() => setOpen(true)}
      />
      {onAddNew ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={ka.pets.productAdd}
          onPress={onAddNew}
          className="min-h-11 justify-center active:opacity-80"
        >
          <Text className="text-base font-semibold text-primary-200">{ka.pets.productAdd}</Text>
        </Pressable>
      ) : null}
      <PetSheet visible={open} title={ka.pets.productsTitle} onClose={() => setOpen(false)}>
        <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
          <View style={{ gap: 8, paddingBottom: 12 }}>
            <PetFilterChip
              fill
              label={ka.pets.skipProduct}
              selected={!value}
              onPress={() => {
                onChange(null);
                setOpen(false);
              }}
            />
            {products.map((row) => (
              <PetFilterChip
                key={row.id}
                fill
                icon={careKindIcon(row.kind)}
                label={row.name}
                selected={value === row.id}
                onPress={() => {
                  onChange(row.id, row);
                  setOpen(false);
                }}
              />
            ))}
            {onAddNew ? (
              <PetFilterChip
                fill
                icon={Plus}
                label={ka.pets.productAdd}
                selected={false}
                onPress={() => {
                  setOpen(false);
                  onAddNew();
                }}
              />
            ) : null}
          </View>
        </ScrollView>
      </PetSheet>
    </View>
  );
}
