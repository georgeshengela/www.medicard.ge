import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { PetForm, formToBody, petToForm, type LocalPhoto, type PetFormValue } from '@/components/pets/PetForm';
import { PetButton, PetIntro, PetLoading } from '@/components/pets/PetUi';
import { PetErrorText, PetPageScroll } from '@/components/pets/PetScreen';
import { ApiError, api, type Pet } from '@/lib/api';
import { useAuth } from '@/store/AuthContext';
import { localAccountId } from '@/lib/localAccount';

export default function EditPetScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(), { user } = useAuth();
  return id && user ? <EditPet key={`${user.id}:${id}`} id={id} owner={user.id} /> : <PetLoading />;
}
function EditPet({ id, owner }: { id: string; owner: string }) {
  const router = useRouter(), alive = useRef(true), lock = useRef(false), revision = useRef(0);
  const [pet, setPet] = useState<Pet | null>(null), [loading, setLoading] = useState(true), [submitting, setSubmitting] = useState(false), [error, setError] = useState<string | null>(null);
  const current = useCallback(() => alive.current && localAccountId() === owner, [owner]);
  const load = useCallback(async () => { const request = ++revision.current; setLoading(true); setError(null); try { const result = await api.pets.get(id); if (current() && request === revision.current) setPet(result.pet); } catch (error) { if (current()) setError(error instanceof ApiError ? error.message : 'პროფილი ვერ ჩაიტვირთა. სცადე ხელახლა.'); } finally { if (current()) setLoading(false); } }, [id, current]);
  useEffect(() => { alive.current = true; void load(); return () => { alive.current = false; revision.current++; }; }, [load]);
  const onSubmit = async (value: PetFormValue, photo: LocalPhoto | null, removePhoto: boolean) => {
    if (lock.current || !pet || !current()) return;
    lock.current = true; setSubmitting(true); setError(null); let profileSaved = false;
    try {
      await api.pets.update(id, formToBody(value)); profileSaved = true;
      if (!current()) return;
      if (photo) await api.pets.uploadPhoto(id, photo); else if (removePhoto && pet.photoUrl) await api.pets.removePhoto(id);
      if (current()) router.replace(`/pets/${id}`);
    } catch (error) { if (current()) setError(profileSaved ? 'ინფორმაცია შენახულია, მაგრამ ფოტო ვერ განახლდა. სცადე შენახვა ხელახლა.' : error instanceof ApiError ? error.message : 'შენახვა ვერ მოხერხდა. სცადე ხელახლა.'); }
    finally { lock.current = false; if (current()) setSubmitting(false); }
  };
  if (loading) return <PetLoading />;
  if (!pet) return <PetPageScroll><PetIntro title="პროფილი ვერ ჩაიტვირთა" body="შენი ჩანაწერები შენახულია. შეამოწმე კავშირი და ხელახლა სცადე." /><PetErrorText message={error} /><PetButton label="ხელახლა ცდა" onPress={() => void load()} /></PetPageScroll>;
  return <PetForm initial={petToForm(pet)} existingPhotoUrl={pet.photoUrl} submitting={submitting} error={error} submitLabel="ცვლილებების შენახვა" onSubmit={onSubmit} />;
}
