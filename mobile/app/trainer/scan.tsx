import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import { classifyScan, normalizeCoachCode } from '@/lib/coach';
import { QrScanner } from '@/components/coach/QrScanner';

/** Client scans a trainer's QR (medicard.ge/c/CODE) → the consent screen for that trainer. */
export default function TrainerQrScanScreen() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const onScan = (data: string) => {
    const kind = classifyScan(data);
    const code = kind?.kind === 'trainer' ? kind.code : normalizeCoachCode(data);
    if (code) {
      router.replace(`/trainer/connect?code=${code}` as never);
      return;
    }
    setError(kind?.kind === 'person' ? 'ეს ადამიანის პირადი QR-ია. ტრენერთან დასაკავშირებლად დაასკანერე ტრენერის QR (მის პროფილში).' : 'ეს ტრენერის QR კოდი არ არის.');
  };
  return <QrScanner title="ტრენერის QR" hint="მიუშვირე ტრენერის QR-ს — ის ჩანს მის „პროფილის“ ტაბზე" error={error} onScan={onScan} />;
}
