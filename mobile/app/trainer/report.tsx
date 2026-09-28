import React, { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api, ApiError } from '@/lib/api';
import { invalidateCoachEntry } from '@/components/coach/CoachEntry';
import { Button, Card, Chip, CoachForm, Field, Input, Toggle } from '@/components/coach/CoachUI';
import { hubText } from '@/theme/hub';
import { useThemeColors } from '@/theme/colors';

const REASONS: { key: string; label: string }[] = [
  { key: 'harassment', label: 'შეურაცხყოფა ან შევიწროება' },
  { key: 'inappropriate', label: 'შეუფერებელი შინაარსი ან ფოტო' },
  { key: 'unsafe', label: 'სახიფათო ან არაპროფესიული რჩევა' },
  { key: 'spam', label: 'სპამი ან რეკლამა' },
  { key: 'impersonation', label: 'ყალბი პროფილი ან სერტიფიკატი' },
  { key: 'other', label: 'სხვა' },
];

/**
 * Report the other side of a MEDI COACH relationship (App Review 1.2). A client may also block the
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
      Alert.alert('მადლობა', block ? 'შეტყობინება მივიღეთ და კავშირი შეწყდა. MEDICARD-ის გუნდი განიხილავს.' : 'შეტყობინება მივიღეთ. MEDICARD-ის გუნდი განიხილავს.');
      router.replace((aboutTrainer ? '/trainer' : '/coach') as never);
    } catch (e) {
      Alert.alert('ვერ გაიგზავნა', e instanceof ApiError ? e.message : 'სცადე ხელახლა.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <CoachForm
      title="შეტყობინება დარღვევაზე"
      subtitle={params.name ? String(params.name) : undefined}
      fallback={aboutTrainer ? '/trainer' : '/coach'}
      footer={<Button label="გაგზავნა" busy={busy} disabled={!reason} onPress={() => void submit()} />}
    >
      <Field label="რა მოხდა?">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {REASONS.map((r) => (
            <Chip key={r.key} label={r.label} selected={reason === r.key} onPress={() => setReason(r.key)} />
          ))}
        </View>
      </Field>
      <Field label="დეტალები (არასავალდებულო)" hint="არ ჩაწერო ჯანმრთელობის ან სხვისი პირადი მონაცემები.">
        <Input value={details} onChangeText={setDetails} multiline maxLength={1000} placeholder="მოკლედ აღწერე" />
      </Field>
      <Card style={{ paddingVertical: 6, marginTop: 12 }}>
        <Toggle
          title={aboutTrainer ? 'ტრენერის დაბლოკვა' : 'კავშირის დასრულება'}
          body={aboutTrainer ? 'კავშირი მაშინვე შეწყდება და ეს ტრენერი ვეღარ მოგწვევს.' : 'კლიენტთან კავშირი მაშინვე შეწყდება.'}
          value={block}
          onChange={setBlock}
        />
      </Card>
      <Text style={[hubText.small, { color: c.text300, marginTop: 10 }]}>
        შეტყობინებას MEDICARD-ის გუნდი განიხილავს. საჭიროების შემთხვევაში ტრენერის სტატუსი შეჩერდება.
      </Text>
    </CoachForm>
  );
}
