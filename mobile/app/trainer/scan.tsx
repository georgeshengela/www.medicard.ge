import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import { classifyScan, normalizeCoachCode } from '@/lib/coach';
import { QrScanner } from '@/components/coach/QrScanner';
import { tx } from '@/i18n/locale';

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
    setError(kind?.kind === 'person' ? tx('ეს ადამიანის პირადი QR-ია. ტრენერთან დასაკავშირებლად დაასკანერე ტრენერის QR (მის პროფილში).', 'This is a person’s personal QR. To connect with a trainer, scan the trainer’s QR (in their profile).') : tx('ეს ტრენერის QR კოდი არ არის.', 'This isn’t a trainer QR code.'));
  };
  return <QrScanner title={tx('ტრენერის QR', 'Trainer QR')} hint={tx('მიუშვირე ტრენერის QR-ს — ის ჩანს მის „პროფილის“ ტაბზე', 'Point at the trainer’s QR — it’s on their Profile tab')} error={error} onScan={onScan} />;
}
