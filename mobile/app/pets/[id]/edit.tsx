import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { PetForm, formToBody, petToForm, type LocalPhoto, type PetFormValue } from '@/components/pets/PetForm';
import { PetButton, PetIntro, PetLoading } from '@/components/pets/PetUi';
import { PetErrorText, PetPageScroll } from '@/components/pets/PetScreen';
import { ApiError, api, type Pet } from '@/lib/api';
import { useAuth } from '@/store/AuthContext';
import { localAccountId } from '@/lib/localAccount';
import { tx } from '@/i18n/locale';

export default function EditPetScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(), { user } = useAuth();
  return id && user ? <EditPet key={`${user.id}:${id}`} id={id} owner={user.id} /> : <PetLoading />;
}
function EditPet({ id, owner }: { id: string; owner: string }) {
  const router = useRouter(), alive = useRef(true), lock = useRef(false), revision = useRef(0);
  const [pet, setPet] = useState<Pet | null>(null), [loading, setLoading] = useState(true), [submitting, setSubmitting] = useState(false), [error, setError] = useState<string | null>(null);
  const current = useCallback(() => alive.current && localAccountId() === owner, [owner]);
  const load = useCallback(async () => { const request = ++revision.current; setLoading(true); setError(null); try { const result = await api.pets.get(id); if (current() && request === revision.current) setPet(result.pet); } catch (error) { if (current()) setError(error instanceof ApiError ? error.message : tx('პროფილი ვერ ჩაიტვირთა. სცადე ხელახლა.', 'The profile couldn’t load. Try again.')); } finally { if (current()) setLoading(false); } }, [id, current]);
  useEffect(() => { alive.current = true; void load(); return () => { alive.current = false; revision.current++; }; }, [load]);
  const onSubmit = async (value: PetFormValue, photo: LocalPhoto | null, removePhoto: boolean) => {
    if (lock.current || !pet || !current()) return;
    lock.current = true; setSubmitting(true); setError(null); let profileSaved = false;
    try {
      await api.pets.update(id, formToBody(value)); profileSaved = true;
      if (!current()) return;
      if (photo) await api.pets.uploadPhoto(id, photo); else if (removePhoto && pet.photoUrl) await api.pets.removePhoto(id);
      if (current()) router.replace(`/pets/${id}`);
    } catch (error) { if (current()) setError(profileSaved ? tx('ინფორმაცია შენახულია, მაგრამ ფოტო ვერ განახლდა. სცადე შენახვა ხელახლა.', 'Your details are saved, but the photo couldn’t update. Try saving again.') : error instanceof ApiError ? error.message : tx('შენახვა ვერ მოხერხდა. სცადე ხელახლა.', 'Couldn’t save. Try again.')); }
    finally { lock.current = false; if (current()) setSubmitting(false); }
  };
  if (loading) return <PetLoading />;
  if (!pet) return <PetPageScroll><PetIntro title={tx('პროფილი ვერ ჩაიტვირთა', 'The profile couldn’t load')} body={tx('შენი ჩანაწერები შენახულია. შეამოწმე კავშირი და ხელახლა სცადე.', 'Your records are saved. Check your connection and try again.')} /><PetErrorText message={error} /><PetButton label={tx('ხელახლა ცდა', 'Try again')} onPress={() => void load()} /></PetPageScroll>;
  return <PetForm initial={petToForm(pet)} existingPhotoUrl={pet.photoUrl} submitting={submitting} error={error} submitLabel={tx('ცვლილებების შენახვა', 'Save changes')} onSubmit={onSubmit} />;
}
