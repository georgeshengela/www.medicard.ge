import { useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { normalizeCoachCode } from '@/lib/coach';
import { useAuth } from '@/store/AuthContext';

/** medicard://c/CODE and https://medicard.ge/c/CODE — a trainer's invitation. */
export default function CoachInviteLink() {
  const router = useRouter();
  const { code } = useLocalSearchParams<{ code?: string }>();
  const { user } = useAuth();
  useEffect(() => {
    const normalized = normalizeCoachCode(code);
    if (!user) router.replace('/' as never);
    else router.replace((normalized ? `/trainer/connect?code=${normalized}` : '/trainer') as never);
  }, [code, router, user]);
  return null;
}
