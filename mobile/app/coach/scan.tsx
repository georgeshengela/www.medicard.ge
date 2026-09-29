import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { CheckCircle2, UserPlus } from 'lucide-react-native';
import { api, ApiError } from '@/lib/api';
import { classifyScan, type ScanPreview } from '@/lib/coach';
import { QrScanner } from '@/components/coach/QrScanner';
import { Avatar, Button } from '@/components/coach/CoachUI';
import { hubText } from '@/theme/hub';
import { tx } from '@/i18n/locale';

/** Trainer scans a person's MEDICARD QR → identity preview → invite. Health data only after their consent. */
export default function CoachScanScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string }>();
  const [preview, setPreview] = useState<ScanPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<'REQUESTED' | 'ACTIVE' | null>(null);

  const lookup = async (data: string) => {
    const kind = classifyScan(data) ?? (/^[A-Za-z0-9_-]{16,40}$/.test(data) ? { kind: 'person' as const, token: data } : null);
    if (!kind || kind.kind !== 'person') {
      setError(kind?.kind === 'trainer' ? tx('ეს ტრენერის კოდია. დაასკანერე კლიენტის პირადი QR (პროფილი → ჩემი QR).', 'This is a trainer code. Scan the client’s personal QR (Profile → My QR).') : tx('ეს MEDICARD-ის პროფილის QR კოდი არ არის.', 'This isn’t a MEDICARD profile QR code.'));
      return;
    }
    setBusy(true);
    setError(null);
    setSent(null);
    try {
      setPreview(await api.coach.scan(kind.token));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : tx('QR ვერ შემოწმდა.', 'Couldn’t check the QR.'));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (params.token) void lookup(String(params.token));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.token]);

  const invite = async () => {
    if (!preview) return;
    setBusy(true);
    try {
      const r = await api.coach.invite(preview.token);
      setSent(r.status);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : tx('მოწვევა ვერ გაიგზავნა.', 'Couldn’t send the invite.'));
    } finally {
      setBusy(false);
    }
  };

  const p = preview;
  const status = sent ?? (p?.link ? (p.link.status === 'ACTIVE' ? 'ACTIVE' : p.link.initiator === 'TRAINER' ? 'REQUESTED' : null) : null);
  return (
    <QrScanner
      title={tx('კლიენტის QR', 'Client QR')}
      hint={tx('მიუშვირე კლიენტის QR-ს (პროფილი → ჩემი QR)', 'Point at the client’s QR (Profile → My QR)')}
      busy={busy}
      error={error}
      onScan={(d) => void lookup(d)}
      footer={
        p ? (
          <View style={{ backgroundColor: '#111827', borderRadius: 22, padding: 16, gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Avatar avatarId={p.user.avatarId} photoUrl={p.user.avatarUrl} name={p.user.name} size={56} />
              <View style={{ flex: 1 }}>
                <Text style={[hubText.cardTitle, { color: '#FFFFFF', fontSize: 17 }]}>{p.user.name}</Text>
                <Text style={[hubText.caption, { color: '#9CA3AF' }]}>
                  {[p.user.age ? tx(`${p.user.age} წ.`, `${p.user.age} y`) : null, p.user.gender === 'FEMALE' ? tx('ქალი', 'Female') : p.user.gender === 'MALE' ? tx('კაცი', 'Male') : null].filter(Boolean).join(' · ') || tx('MEDICARD მომხმარებელი', 'MEDICARD user')}
                </Text>
              </View>
            </View>
            {status === 'ACTIVE' ? (
              <>
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  <CheckCircle2 size={18} color="#34D399" />
                  <Text style={[hubText.body, { color: '#FFFFFF' }]}>{sent ? tx('შემოგიერთდა — მისი მოთხოვნა დადასტურდა.', 'Connected — their request is confirmed.') : tx('უკვე შენი კლიენტია.', 'Already your client.')}</Text>
                </View>
                <Button label={tx('კლიენტის გახსნა', 'Open client')} onPress={() => router.replace(`/coach/client/${p.user.id}` as never)} />
              </>
            ) : status === 'REQUESTED' ? (
              <>
                <Text style={[hubText.body, { color: '#C5DADA' }]}>{tx(`მოწვევა გაიგზავნა. ${p.user.name.split(' ')[0]} ნახავს შეტყობინებას და თავად აირჩევს, რას გაგიზიაროს.`, `Invite sent. ${p.user.name.split(' ')[0]} will see the notification and choose what to share with you.`)}</Text>
                <Button label={tx('კარგი', 'OK')} kind="secondary" onPress={() => router.replace('/coach/clients' as never)} />
              </>
            ) : p.hasOtherTrainer ? (
              <Text style={[hubText.body, { color: '#FCA5A5' }]}>{tx('ამ ადამიანს უკვე ჰყავს სხვა ტრენერი MEDICARD-ში.', 'This person already has another trainer on MEDICARD.')}</Text>
            ) : (
              <>
                <Text style={[hubText.caption, { color: '#9CA3AF' }]}>{tx('ჯანმრთელობის მონაცემი არ ჩანს, სანამ კლიენტი მოწვევას არ მიიღებს და არ აირჩევს, რას გაგიზიაროს.', 'No health data is visible until the client accepts the invite and chooses what to share with you.')}</Text>
                <Button label={p.link ? tx('მოთხოვნის დადასტურება', 'Confirm request') : tx('კლიენტად მოწვევა', 'Invite as client')} icon={UserPlus} busy={busy} onPress={() => void invite()} />
              </>
            )}
          </View>
        ) : null
      }
    />
  );
}
