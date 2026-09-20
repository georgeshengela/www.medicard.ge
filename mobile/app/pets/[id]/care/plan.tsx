import { parsePetDate, petCarePlanError } from '@/lib/petsPresentation';
import React, { useCallback, useRef, useState } from 'react';
import { Text } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Check, Clock, Hash, Package, Pill } from 'lucide-react-native';
import { PetButton as Button } from '@/components/pets/PetUi';
import { PetPanel as Card } from '@/components/pets/PetUi';
import { PetDateField as DateField } from '@/components/pets/PetDateField';
import { PetInput as Input } from '@/components/pets/PetUi';
import {
  BasisChips,
  CareKindChips,
  CareProductPicker,
  RecurrenceChips,
  RouteChips,
  SourceChips,
} from '@/components/pets/PetCareChips';
import { PetErrorText, PetFormScroll } from '@/components/pets/PetScreen';
import { ka } from '@/i18n/ka';
import {
  api,
  type PetCareKind,
  type PetCareRoute,
  type PetCareSource,
  type PetProduct,
  type PetRecurrenceBasis,
  type PetRecurrenceKind,
} from '@/lib/api';
import { isoToDigits } from '@/lib/birthdate';
import { formatCycleDateKa } from '@/lib/cycleCivilDateKa';
import { kindLabel, newPetsRequestId, petsCareErrorMessage, summarizePlanKa } from '@/lib/petsCare';
import { todayIsoLocal } from '@/lib/visitReminders';

function digitsToIso(digits: string): string | null {
  if (!digits) return null;
  const parsed = parsePetDate(digits, { allowFuture: true });
  return parsed.ok ? parsed.iso : '';
}

export default function PetCarePlanScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    id: string;
    kind?: string;
    productId?: string;
    title?: string;
    dose?: string;
    doseUnit?: string;
    startOn?: string;
    dueTime?: string;
    recurrenceKind?: string;
    intervalCount?: string;
  }>();
  const requestId = useRef(newPetsRequestId()).current;
  const [kind, setKind] = useState<PetCareKind | null>((params.kind as PetCareKind) || null);
  const [products, setProducts] = useState<PetProduct[]>([]);
  const [productId, setProductId] = useState<string | null>(params.productId || null);
  const [title, setTitle] = useState(params.title || '');
  const [dateDigits, setDateDigits] = useState(isoToDigits(params.startOn || todayIsoLocal()));
  const [dueTime, setDueTime] = useState(params.dueTime || '');
  const [times, setTimes] = useState('08:00,20:00');
  const [recurrenceKind, setRecurrenceKind] = useState<PetRecurrenceKind>((params.recurrenceKind as PetRecurrenceKind) || 'ONCE');
  const [intervalCount, setIntervalCount] = useState(params.intervalCount || '1');
  const [basis, setBasis] = useState<PetRecurrenceBasis>('FIXED_CALENDAR');
  const [courseEnds, setCourseEnds] = useState('');
  const [limit, setOccurrenceLimit] = useState('');
  const [source, setSource] = useState<PetCareSource>('USER_ENTERED');
  const [dose, setDose] = useState(params.dose || '');
  const [doseUnit, setDoseUnit] = useState(params.doseUnit || '');
  const [route, setRoute] = useState<PetCareRoute | null>(null);
  const saveLock = useRef(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProducts = useCallback(async () => {
    if (!params.id) return;
    try {
      const res = await api.pets.products.list(params.id);
      setProducts(res.items);
    } catch {
      setProducts([]);
    }
  }, [params.id]);

  useFocusEffect(
    useCallback(() => {
      void loadProducts();
    }, [loadProducts]),
  );

  const selected = products.find((row) => row.id === productId);
  const startOn = digitsToIso(dateDigits);
  const courseEndsOn = digitsToIso(courseEnds);
  const matchingProducts = products.filter((row) => !kind || row.kind === kind);

  const save = async () => {
    if (!params.id || saveLock.current) return;
    const validation = petCarePlanError({ kind, startDigits: dateDigits, endDigits: courseEnds, dueTime, times, recurrence: recurrenceKind, interval: intervalCount, limit });
    if (validation) { setError(validation); return; }
    if (!kind || !startOn) return;
    saveLock.current = true;
    setSaving(true);
    setError(null);
    try {
      await api.pets.schedules.create(params.id, {
        kind,
        title: title.trim() || selected?.name || kindLabel(kind, ka.pets),
        productId,
        startOn,
        dueTime: recurrenceKind === 'DAILY_COURSE' ? null : dueTime.trim() || null,
        times: recurrenceKind === 'DAILY_COURSE' ? times.split(',').map((item) => item.trim()).filter(Boolean) : null,
        recurrenceKind,
        intervalCount: recurrenceKind === 'ONCE' || recurrenceKind === 'DAILY_COURSE' ? undefined : Number(intervalCount),
        recurrenceBasis: recurrenceKind === 'ONCE' ? 'NONE' : recurrenceKind === 'DAILY_COURSE' ? 'FIXED_CALENDAR' : basis,
        source,
        courseEndsOn: courseEndsOn || null,
        occurrenceLimit: limit ? Number(limit) : null,
        dose: dose.trim() || null,
        doseUnit: doseUnit.trim() || null,
        route,
        clientRequestId: requestId,
      });
      void import('@/lib/petCareReminders').then(module => module.reconcilePetCareReminders({ reason: 'plan-created' })).catch(() => undefined);
      router.replace(`/pets/${params.id}/care`);
    } catch (caught) {
      setError(petsCareErrorMessage(caught, { ...ka.pets, offline: ka.common.networkError }));
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  };

  const summary =
    kind && startOn
      ? summarizePlanKa(
          {
            kind,
            title: title.trim() || selected?.name || kindLabel(kind, ka.pets),
            productName: selected?.name || title,
            startOn,
            recurrenceKind,
            intervalCount: Number(intervalCount) || 1,
            recurrenceBasis: recurrenceKind === 'DAILY_COURSE' ? 'FIXED_CALENDAR' : basis,
            courseEndsOn,
            occurrenceLimit: limit ? Number(limit) : null,
          },
          ka.pets,
          formatCycleDateKa,
        )
      : '';

  return (
    <PetFormScroll
      footer={
        <>
          <PetErrorText message={error} />
          <Button
            icon={Check}
            label={saving ? ka.pets.saving : ka.pets.confirmPlan}
            loading={saving}
            disabled={saving}
            onPress={() => void save()}
          />
        </>
      }
    >
      <Text style={{ fontFamily: "NotoSansGeorgian_400Regular", fontSize: 14, lineHeight: 22 }} className="text-text-200">დაგეგმე მომავალი მოვლა. დოზა და სიხშირე მიუთითე ვეტერინარის დანიშნულების ან პროდუქტის ინსტრუქციის მიხედვით.</Text>
      <CareKindChips
        value={kind}
        onChange={(next) => {
          setKind(next);
          setProductId(null);
          void loadProducts();
        }}
      />

      <Input
        figma
        icon={Package}
        label={ka.pets.productName}
        value={title}
        onChangeText={setTitle}
        placeholder={ka.pets.productNamePh}
      />

      <CareProductPicker
        products={matchingProducts}
        value={productId}
        onChange={(next, match) => {
          setProductId(next);
          if (match && !title) setTitle(match.name);
        }}
        onAddNew={() => router.push(`/pets/${params.id}/care/products/new?returnTo=plan`)}
      />

      <DateField allowFuture figma label={ka.pets.firstDate} value={dateDigits} onChangeText={setDateDigits} showAge={false} />
      <Input
        figma
        icon={Clock}
        label={ka.pets.administeredTime}
        value={dueTime}
        onChangeText={setDueTime}
        placeholder="09:00"
      />

      <RecurrenceChips value={recurrenceKind} onChange={setRecurrenceKind} />
      {recurrenceKind !== 'ONCE' && recurrenceKind !== 'DAILY_COURSE' ? (
        <>
          <Input
            figma
            icon={Hash}
            label={ka.pets.intervalCount}
            value={intervalCount}
            onChangeText={setIntervalCount}
            keyboardType="number-pad"
          />
          <BasisChips value={basis} onChange={setBasis} />
        </>
      ) : null}
      {recurrenceKind === 'DAILY_COURSE' ? (
        <Input figma icon={Clock} label={ka.pets.times} value={times} onChangeText={setTimes} placeholder="08:00,20:00" />
      ) : null}
      <DateField allowFuture figma label={ka.pets.courseEndsOn} value={courseEnds} onChangeText={setCourseEnds} showAge={false} />
      <Input
        figma
        icon={Hash}
        label={ka.pets.occurrenceLimit}
        value={limit}
        onChangeText={setOccurrenceLimit}
        keyboardType="number-pad"
      />

      <SourceChips value={source} onChange={setSource} />
      <Input figma icon={Pill} label={ka.pets.dose} value={dose} onChangeText={setDose} />
      <Input
        figma
        icon={Pill}
        label={ka.pets.doseUnit}
        value={doseUnit}
        onChangeText={setDoseUnit}
        placeholder={ka.pets.doseUnitPh}
      />
      <RouteChips value={route} onChange={setRoute} />

      {summary ? (
        <Card>
          <Text className="text-sm font-semibold text-text-200">{ka.pets.planSummary}</Text>
          <Text className="mt-2 text-base text-text-100">{summary}</Text>
          <Text className="mt-2 text-sm text-text-300">{ka.pets.reminderPlanNote}</Text>
        </Card>
      ) : null}
    </PetFormScroll>
  );
}
