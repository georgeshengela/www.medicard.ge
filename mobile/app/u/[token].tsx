import { useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '@/lib/api';
import { useAuth } from '@/store/AuthContext';

/**
 * medicard://u/TOKEN and https://medicard.ge/u/TOKEN — a person's personal QR opened by the phone camera.
 * A verified trainer lands on the scan preview; anyone else sees their own QR screen with a note.
 */
export default function PersonalQrLink() {
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token?: string }>();
  const { user } = useAuth();
  useEffect(() => {
    if (!user) {
      router.replace('/' as never);
      return;
    }
    void api.coach
      .me()
      .then((me) => {
        if (me.trainerProfile?.status === 'VERIFIED' && token) router.replace(`/coach/scan?token=${encodeURIComponent(String(token))}` as never);
        else router.replace(`/profile/qr?note=${encodeURIComponent('ეს MEDICARD-ის პირადი QR კოდია — მას მხოლოდ დადასტურებული ტრენერი ასკანერებს. ქვემოთ შენი QR-ია.')}` as never);
      })
      .catch(() => router.replace('/profile/qr' as never));
  }, [router, token, user]);
  return null;
}
