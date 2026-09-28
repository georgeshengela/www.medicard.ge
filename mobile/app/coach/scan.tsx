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
      setError(kind?.kind === 'trainer' ? 'ეს ტრენერის კოდია. დაასკანერე კლიენტის პირადი QR (პროფილი → ჩემი QR).' : 'ეს MEDICARD-ის პროფილის QR კოდი არ არის.');
      return;
    }
    setBusy(true);
    setError(null);
    setSent(null);
    try {
      setPreview(await api.coach.scan(kind.token));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'QR ვერ შემოწმდა.');
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
      setError(e instanceof ApiError ? e.message : 'მოწვევა ვერ გაიგზავნა.');
    } finally {
      setBusy(false);
    }
  };

  const p = preview;
  const status = sent ?? (p?.link ? (p.link.status === 'ACTIVE' ? 'ACTIVE' : p.link.initiator === 'TRAINER' ? 'REQUESTED' : null) : null);
  return (
    <QrScanner
      title="კლიენტის QR"
      hint="მიუშვირე კლიენტის QR-ს (პროფილი → ჩემი QR)"
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
                  {[p.user.age ? `${p.user.age} წ.` : null, p.user.gender === 'FEMALE' ? 'ქალი' : p.user.gender === 'MALE' ? 'კაცი' : null].filter(Boolean).join(' · ') || 'MEDICARD მომხმარებელი'}
                </Text>
              </View>
            </View>
            {status === 'ACTIVE' ? (
              <>
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  <CheckCircle2 size={18} color="#34D399" />
                  <Text style={[hubText.body, { color: '#FFFFFF' }]}>{sent ? 'შემოგიერთდა — მისი მოთხოვნა დადასტურდა.' : 'უკვე შენი კლიენტია.'}</Text>
                </View>
                <Button label="კლიენტის გახსნა" onPress={() => router.replace(`/coach/client/${p.user.id}` as never)} />
              </>
            ) : status === 'REQUESTED' ? (
              <>
                <Text style={[hubText.body, { color: '#C5DADA' }]}>მოწვევა გაიგზავნა. {p.user.name.split(' ')[0]} ნახავს შეტყობინებას და თავად აირჩევს, რას გაგიზიაროს.</Text>
                <Button label="კარგი" kind="secondary" onPress={() => router.replace('/coach/clients' as never)} />
              </>
            ) : p.hasOtherTrainer ? (
              <Text style={[hubText.body, { color: '#FCA5A5' }]}>ამ ადამიანს უკვე ჰყავს სხვა ტრენერი MEDICARD-ში.</Text>
            ) : (
              <>
                <Text style={[hubText.caption, { color: '#9CA3AF' }]}>ჯანმრთელობის მონაცემი არ ჩანს, სანამ კლიენტი მოწვევას არ მიიღებს და არ აირჩევს, რას გაგიზიაროს.</Text>
                <Button label={p.link ? 'მოთხოვნის დადასტურება' : 'კლიენტად მოწვევა'} icon={UserPlus} busy={busy} onPress={() => void invite()} />
              </>
            )}
          </View>
        ) : null
      }
    />
  );
}
