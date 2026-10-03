import React, { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api, ApiError } from '@/lib/api';
import { invalidateCoachEntry } from '@/components/coach/CoachEntry';
import { Button, Card, Chip, CoachForm, Field, Input, Toggle } from '@/components/coach/CoachUI';
import { hubText } from '@/theme/hub';
import { useThemeColors } from '@/theme/colors';
import { tx } from '@/i18n/locale';

const REASONS: { key: string; label: string }[] = [
  { key: 'harassment', label: tx('შეურაცხყოფა ან შევიწროება', 'Abuse or harassment') },
  { key: 'inappropriate', label: tx('შეუფერებელი შინაარსი ან ფოტო', 'Inappropriate content or photo') },
  { key: 'unsafe', label: tx('სახიფათო ან არაპროფესიული რჩევა', 'Dangerous or unprofessional advice') },
  { key: 'spam', label: tx('სპამი ან რეკლამა', 'Spam or advertising') },
  { key: 'impersonation', label: tx('ყალბი პროფილი ან სერტიფიკატი', 'Fake profile or certificate') },
  { key: 'other', label: tx('სხვა', 'Other') },
];

/**
 * Report the other side of a MEDICOACH relationship (App Review 1.2). A client may also block the
 * trainer: the link ends at once and the trainer cannot invite again. MEDICARD reviews every report.
 */
export default function CoachReportScreen() {
  const router = useRouter();
  const c = useThemeColors();
  const params = useLocalSearchParams<{ id?: string; name?: string; role?: string }>();
  const aboutTrainer = params.role !== 'client';
  const [reason, setReason] = useState<string | null>(null);
  const [details, setDetails] = useState('');
  const [block, setBlock] = useState(aboutTrainer);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!reason || !params.id) return;
    setBusy(true);
    try {
      await api.coach.report({ subjectId: String(params.id), reason, details: details.trim(), block });
      if (block) invalidateCoachEntry();
      Alert.alert(tx('მადლობა', 'Thank you'), block ? tx('შეტყობინება მივიღეთ და კავშირი შეწყდა. MEDICARD-ის გუნდი განიხილავს.', 'We got your report and the connection has ended. The MEDICARD team will review it.') : tx('შეტყობინება მივიღეთ. MEDICARD-ის გუნდი განიხილავს.', 'We got your report. The MEDICARD team will review it.'));
      router.replace((aboutTrainer ? '/trainer' : '/coach') as never);
    } catch (e) {
      Alert.alert(tx('ვერ გაიგზავნა', 'Couldn’t send'), e instanceof ApiError ? e.message : tx('სცადე ხელახლა.', 'Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <CoachForm
      title={tx('შეტყობინება დარღვევაზე', 'Report a problem')}
      subtitle={params.name ? String(params.name) : undefined}
      fallback={aboutTrainer ? '/trainer' : '/coach'}
      footer={<Button label={tx('გაგზავნა', 'Send')} busy={busy} disabled={!reason} onPress={() => void submit()} />}
    >
      <Field label={tx('რა მოხდა?', 'What happened?')}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {REASONS.map((r) => (
            <Chip key={r.key} label={r.label} selected={reason === r.key} onPress={() => setReason(r.key)} />
          ))}
        </View>
      </Field>
      <Field label={tx('დეტალები (არასავალდებულო)', 'Details (optional)')} hint={tx('არ ჩაწერო ჯანმრთელობის ან სხვისი პირადი მონაცემები.', 'Don’t include health data or anyone’s personal information.')}>
        <Input value={details} onChangeText={setDetails} multiline maxLength={1000} placeholder={tx('მოკლედ აღწერე', 'Describe it briefly')} />
      </Field>
      <Card style={{ paddingVertical: 6, marginTop: 12 }}>
        <Toggle
          title={aboutTrainer ? tx('ტრენერის დაბლოკვა', 'Block trainer') : tx('კავშირის დასრულება', 'End connection')}
          body={aboutTrainer ? tx('კავშირი მაშინვე შეწყდება და ეს ტრენერი ვეღარ მოგწვევს.', 'The connection ends right away and this trainer can’t invite you again.') : tx('კლიენტთან კავშირი მაშინვე შეწყდება.', 'The connection with the client ends right away.')}
          value={block}
          onChange={setBlock}
        />
      </Card>
      <Text style={[hubText.small, { color: c.text300, marginTop: 10 }]}>
        {tx('შეტყობინებას MEDICARD-ის გუნდი განიხილავს. საჭიროების შემთხვევაში ტრენერის სტატუსი შეჩერდება.', 'The MEDICARD team reviews every report. If needed, the trainer’s status will be suspended.')}
      </Text>
    </CoachForm>
  );
}
