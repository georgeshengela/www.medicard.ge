import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { PetForm, formToBody, hydratePetForm, type LocalPhoto, type PetFormValue } from '@/components/pets/PetForm';
import { PetLoading } from '@/components/pets/PetUi';
import { ApiError, api } from '@/lib/api';
import { clearPetsDraft, loadPetsDraft, savePetsDraft } from '@/lib/petsDraft';
import { localAccountId } from '@/lib/localAccount';
import { useAuth } from '@/store/AuthContext';

export default function NewPetScreen() { const { user } = useAuth(); return user ? <NewPetForm key={user.id} owner={user.id} /> : <PetLoading />; }
function NewPetForm({ owner }: { owner: string }) {
  const router = useRouter(), lock = useRef(false), alive = useRef(true), saved = useRef(false);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null), writes = useRef(Promise.resolve());
  const [initial, setInitial] = useState<PetFormValue | null>(null), [submitting, setSubmitting] = useState(false), [error, setError] = useState<string | null>(null);
  const current = () => alive.current && owner === localAccountId();
  useEffect(() => {
    alive.current = true;
    void loadPetsDraft(owner).catch(() => null).then(draft => { if (current()) setInitial(hydratePetForm(draft)); });
    return () => { alive.current = false; };
  }, [owner]);
  const onChange = useCallback((value: PetFormValue) => {
    if (saved.current || lock.current) return;
    if (pending.current) clearTimeout(pending.current);
    pending.current = setTimeout(() => { pending.current = null; if (!saved.current && owner === localAccountId()) writes.current = writes.current.catch(() => undefined).then(() => savePetsDraft(value, owner)).catch(() => undefined); }, 300);
  }, [owner]);
  const onSubmit = async (value: PetFormValue, photo: LocalPhoto | null) => {
    if (lock.current || !current()) return;
    lock.current = true; setSubmitting(true); setError(null);
    try {
      const { pet } = await api.pets.create(formToBody(value));
      saved.current = true;
      if (pending.current) clearTimeout(pending.current);
      await writes.current.catch(() => undefined);
      await clearPetsDraft(owner).catch(() => undefined);
      if (!current()) return;
      let photoFailed = false;
      if (photo) { try { await api.pets.uploadPhoto(pet.id, photo); } catch { photoFailed = true; } }
      if (!current()) return;
      router.replace(`/pets/${pet.id}`);
      if (photoFailed) Alert.alert('პროფილი შენახულია', 'ფოტო ვერ აიტვირთა. პროფილის რედაქტირებიდან შეგიძლია ხელახლა დაამატო.');
    } catch (caught) {
      if (current()) setError(caught instanceof ApiError ? caught.message : 'შენახვა ვერ მოხერხდა. შეამოწმე ინტერნეტი და სცადე ხელახლა.');
    } finally { lock.current = false; if (current()) setSubmitting(false); }
  };
  return initial ? <PetForm wizard initial={initial} submitting={submitting} error={error} submitLabel="პროფილის შექმნა" onChange={onChange} onSubmit={onSubmit} /> : <PetLoading />;
}
