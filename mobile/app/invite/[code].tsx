import { useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { normalizeReferralCode, savePendingReferralCode } from '@/lib/referral';
import { useAuth } from '@/store/AuthContext';

/** medicard://invite/CODE — keep the code, then open the entry screen (or sign-in first). */
export default function InviteLink() {
  const router = useRouter();
  const { code } = useLocalSearchParams<{ code?: string }>();
  const { user } = useAuth();
  useEffect(() => {
    const normalized = normalizeReferralCode(code);
    void savePendingReferralCode(normalized).finally(() => {
      if (!user) router.replace('/' as never);
      else router.replace((normalized ? `/profile/invite-code?code=${normalized}` : '/profile/invite') as never);
    });
  }, [code, router, user]);
  return null;
}
