import React, { useRef, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check, Hash, Package, Pencil } from 'lucide-react-native';
import { Button } from '@/components/ui/Button';
import { DateField } from '@/components/ui/DateField';
import { Input } from '@/components/ui/Input';
import { CareKindChips } from '@/components/pets/PetCareChips';
import { PetErrorText, PetFormScroll } from '@/components/pets/PetScreen';
import { ka } from '@/i18n/ka';
import { api, type PetCareKind, type PetProduct } from '@/lib/api';
import { isoToDigits, parseCivilDate } from '@/lib/birthdate';
import { newPetsRequestId, petsCareErrorMessage } from '@/lib/petsCare';
import { useThemeColors } from '@/theme/colors';

function digitsToIso(digits: string): string | null {
  if (!digits) return null;
  const parsed = parseCivilDate(digits);
  return parsed.ok ? parsed.iso : '';
}

export function PetProductForm({
  initial,
  saving,
  error,
  footer,
  onSubmit,
}: {
  initial?: PetProduct | null;
  saving: boolean;
  error: string | null;
  footer?: React.ReactNode;
  onSubmit: (body: {
    kind: PetCareKind;
    name: string;
    formulation: string | null;
    batchId: string | null;
    notes: string | null;
    expiresOn: string | null;
  }) => void;
}) {
  const [kind, setKind] = useState<PetCareKind>(initial?.kind || 'FLEA_TICK');
  const [name, setName] = useState(initial?.name || '');
  const [formulation, setFormulation] = useState(initial?.formulation || '');
  const [batchId, setBatchId] = useState(initial?.batchId || '');
  const [notes, setNotes] = useState(initial?.notes || '');
  const [expires, setExpires] = useState(isoToDigits(initial?.expiresOn || ''));

  return (
    <PetFormScroll
      footer={
        <>
          <PetErrorText message={error} />
          <Button
            icon={Check}
            label={saving ? ka.pets.saving : ka.pets.save}
            loading={saving}
            onPress={() =>
              onSubmit({
                kind,
                name,
                formulation: formulation.trim() || null,
                batchId: batchId.trim() || null,
                notes: notes.trim() || null,
                expiresOn: digitsToIso(expires),
              })
            }
          />
          {footer}
        </>
      }
    >
      <CareKindChips value={kind} onChange={setKind} />
      <Input figma icon={Package} label={ka.pets.productName} value={name} onChangeText={setName} placeholder={ka.pets.productNamePh} />
      <Input figma icon={Pencil} label={ka.pets.formulation} value={formulation} onChangeText={setFormulation} />
      <Input figma icon={Hash} label={ka.pets.batchId} value={batchId} onChangeText={setBatchId} />
      <DateField figma label={ka.pets.expiresOn} value={expires} onChangeText={setExpires} showAge={false} hint={ka.pets.expiresHint} />
      <Input figma icon={Pencil} label={ka.pets.note} value={notes} onChangeText={setNotes} />
    </PetFormScroll>
  );
}

export default function PetProductNewScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { id, returnTo } = useLocalSearchParams<{ id: string; returnTo?: string }>();
  const requestId = useRef(newPetsRequestId()).current;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg100 }}>
      <PetProductForm
        saving={saving}
        error={error}
        onSubmit={async (body) => {
          if (!id || saving) return;
          setSaving(true);
          setError(null);
          try {
            await api.pets.products.create(id, { ...body, clientRequestId: requestId });
            if (returnTo === 'plan' || returnTo === 'record') {
              router.back();
              return;
            }
            router.replace(`/pets/${id}/care/products`);
          } catch (caught) {
            setError(petsCareErrorMessage(caught, { ...ka.pets, offline: ka.common.networkError }));
          } finally {
            setSaving(false);
          }
        }}
      />
    </View>
  );
}
