import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button } from '@/components/ui/Button';
import { DateField } from '@/components/ui/DateField';
import { Input } from '@/components/ui/Input';
import { SegmentedField } from '@/components/ui/SegmentedField';
import { CareKindChips, RouteChips } from '@/components/pets/PetCareChips';
import { PetChoiceRows, PetErrorText, PetFormScroll } from '@/components/pets/PetScreen';
import { ka } from '@/i18n/ka';
import { api, type PetCareKind, type PetCareRoute, type PetProduct } from '@/lib/api';
import { isoToDigits, parseBirthDate } from '@/lib/birthdate';
import { localUtcOffsetMinutes, newPetsRequestId, petsCareErrorMessage } from '@/lib/petsCare';
import { todayIsoLocal } from '@/lib/visitReminders';

function digitsToIso(digits: string): string | null {
  if (!digits) return null;
  const parsed = parseBirthDate(digits);
  return parsed.ok ? parsed.iso : '';
}

export default function PetCareRecordScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const requestId = useRef(newPetsRequestId()).current;
  const [kind, setKind] = useState<PetCareKind | null>(null);
  const [products, setProducts] = useState<PetProduct[]>([]);
  const [productId, setProductId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [mode, setMode] = useState<'given' | 'plan'>('given');
  const [dateDigits, setDateDigits] = useState(isoToDigits(todayIsoLocal()));
  const [time, setTime] = useState('');
  const [dose, setDose] = useState('');
  const [doseUnit, setDoseUnit] = useState('');
  const [route, setRoute] = useState<PetCareRoute | null>(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProducts = useCallback(async () => {
    if (!id) return;
    try {
      const res = await api.pets.products.list(id);
      setProducts(res.items);
    } catch {
      setProducts([]);
    }
  }, [id]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  const selected = products.find((row) => row.id === productId);
  const iso = digitsToIso(dateDigits);
  const matchingProducts = products.filter((row) => !kind || row.kind === kind);

  const goPlan = () => {
    if (!id || !kind) return;
    router.replace(
      `/pets/${id}/care/plan?kind=${kind}&productId=${productId || ''}&title=${encodeURIComponent(title)}`,
    );
  };

  const save = async () => {
    if (!id || !kind || saving) return;
    if (mode === 'plan') {
      goPlan();
      return;
    }
    if (!iso) {
      setError(ka.pets.administeredOn);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.pets.events.create(id, {
        kind,
        title: title.trim() || selected?.name || kind,
        productId,
        administeredOn: iso,
        administeredTime: time.trim() || null,
        utcOffsetMinutes: time.trim() ? localUtcOffsetMinutes() : null,
        dose: dose.trim() || null,
        doseUnit: doseUnit.trim() || null,
        route,
        notes: notes.trim() || null,
        clientRequestId: requestId,
      });
      router.replace(`/pets/${id}/care/history`);
    } catch (caught) {
      setError(petsCareErrorMessage(caught, { ...ka.pets, offline: ka.common.networkError }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <PetFormScroll
      footer={
        <>
          <PetErrorText message={error} />
          <Button
            label={mode === 'plan' ? ka.pets.planCare : ka.pets.save}
            loading={saving}
            disabled={!kind || saving}
            onPress={() => void save()}
          />
          {mode === 'given' && kind ? (
            <Button label={ka.pets.alsoPlanNext} variant="ghost" onPress={goPlan} />
          ) : null}
        </>
      }
    >
      <CareKindChips
        value={kind}
        onChange={(next) => {
          setKind(next);
          setProductId(null);
          void loadProducts();
        }}
      />

      <Input label={ka.pets.productName} value={title} onChangeText={setTitle} placeholder={ka.pets.productNamePh} />

      <PetChoiceRows
        value={productId || 'none'}
        onChange={(next) => {
          if (next === 'none') {
            setProductId(null);
            return;
          }
          setProductId(next);
          const match = matchingProducts.find((row) => row.id === next);
          if (match && !title) setTitle(match.name);
        }}
        options={[
          { value: 'none', label: ka.pets.skipProduct },
          ...matchingProducts.map((row) => ({ value: row.id, label: row.name })),
        ]}
      />

      <SegmentedField
        label={ka.pets.alreadyGiven}
        value={mode}
        onChange={setMode}
        options={[
          { value: 'given', label: ka.pets.alreadyGiven },
          { value: 'plan', label: ka.pets.planningNext },
        ]}
      />

      {mode === 'given' ? (
        <>
          <DateField label={ka.pets.administeredOn} value={dateDigits} onChangeText={setDateDigits} showAge={false} />
          <Input label={ka.pets.administeredTime} value={time} onChangeText={setTime} placeholder="09:00" />
          <Input label={ka.pets.dose} value={dose} onChangeText={setDose} />
          <Input label={ka.pets.doseUnit} value={doseUnit} onChangeText={setDoseUnit} placeholder={ka.pets.doseUnitPh} />
          <RouteChips value={route} onChange={setRoute} />
          <Input label={ka.pets.note} value={notes} onChangeText={setNotes} />
        </>
      ) : null}
    </PetFormScroll>
  );
}
