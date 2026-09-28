import React, { useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AlertTriangle } from 'lucide-react-native';
import { api, ApiError } from '@/lib/api';
import { GOAL_TYPE_LABEL, addDaysYmd, tbilisiYmd, type ClientDashboard, type GoalProposal } from '@/lib/coach';
import { Button, Card, Chip, CoachForm, Field, Input, Loading, Stat, coachStyles } from '@/components/coach/CoachUI';
import { hubText } from '@/theme/hub';
import { useThemeColors } from '@/theme/colors';

const WEEKS = [4, 8, 12, 16, 24];

/** Trainer proposes a goal; the client accepts it in their app (it becomes their weight goal). */
export default function CoachGoalScreen() {
  const { clientId } = useLocalSearchParams<{ clientId: string }>();
  const router = useRouter();
  const c = useThemeColors();
  const [d, setD] = useState<ClientDashboard | null>(null);
  const [type, setType] = useState<GoalProposal['type']>('lose');
  const [target, setTarget] = useState('');
  const [weeks, setWeeks] = useState(12);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void api.coach
      .client(String(clientId))
      .then((res) => {
        setD(res);
        const cur = res.weight?.currentKg;
        if (res.weight?.goal) setTarget(String(res.weight.goal.targetKg));
        else if (cur) setTarget(String(Math.round(cur * 0.93)));
      })
      .catch((e) => Alert.alert('ვერ ჩაიტვირთა', e instanceof ApiError ? e.message : 'სცადე ხელახლა.'));
  }, [clientId]);

  const current = d?.weight?.currentKg ?? null;
  const t = Number(target.replace(',', '.'));
  const pace = current && t ? Math.abs(current - t) / weeks : null;
  const pctWeek = current && pace ? (pace / current) * 100 : null;
  const unsafe = pctWeek != null && ((type === 'lose' && pctWeek > 1) || (type === 'gain' && pace! > 0.5));
  const deadline = addDaysYmd(tbilisiYmd(), weeks * 7);

  const send = async () => {
    if (!t || t < 30 || t > 300) return Alert.alert('სამიზნე წონა', 'მიუთითე წონა 30–300 კგ.');
    setBusy(true);
    try {
      await api.coach.proposeGoal(String(clientId), { type, targetKg: Math.round(t * 10) / 10, deadlineYmd: deadline, note: note.trim() });
      Alert.alert('შეთავაზება გაიგზავნა', 'კლიენტი მიიღებს შეტყობინებას და თავად დაადასტურებს.', [{ text: 'კარგი', onPress: () => router.back() }]);
    } catch (e) {
      Alert.alert('ვერ გაიგზავნა', e instanceof ApiError ? e.message : 'სცადე ხელახლა.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <CoachForm title="მიზნის შეთავაზება" subtitle={d?.client.name} fallback="/coach/clients" footer={<Button label="შეთავაზება კლიენტს" busy={busy} onPress={() => void send()} />}>
      {!d ? <Loading /> : null}
      {d ? (
        <>
          <Field label="მიზნის ტიპი">
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {(Object.keys(GOAL_TYPE_LABEL) as GoalProposal['type'][]).map((k) => (
                <Chip key={k} label={GOAL_TYPE_LABEL[k]} selected={type === k} onPress={() => setType(k)} />
              ))}
            </View>
          </Field>
          <Field label={`სამიზნე წონა, კგ${current ? ` (ახლა ${current})` : ''}`}>
            <Input value={target} onChangeText={(v) => setTarget(v.replace(/[^\d.,]/g, '').slice(0, 5))} keyboardType="decimal-pad" placeholder="72" style={{ fontSize: 22, textAlign: 'center', minHeight: 56 }} />
          </Field>
          <Field label="ვადა">
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {WEEKS.map((w) => (
                <Chip key={w} label={`${w} კვირა`} selected={weeks === w} onPress={() => setWeeks(w)} />
              ))}
            </View>
          </Field>
          <Card style={{ marginTop: 16, flexDirection: 'row', gap: 6 }}>
            <Stat label="ტემპი" value={pace != null ? `${Math.round(pace * 100) / 100} კგ` : '—'} hint="კვირაში" />
            <Stat label="სხეულის წონის" value={pctWeek != null ? `${Math.round(pctWeek * 10) / 10}%` : '—'} hint="კვირაში" />
            <Stat label="ვადა" value={deadline.slice(5).replace('-', '.')} hint={deadline.slice(0, 4)} />
          </Card>
          {unsafe ? (
            <View style={[coachStyles.row, { gap: 8, backgroundColor: c.warningBg, borderRadius: 14, padding: 12, marginTop: 10 }]}>
              <AlertTriangle size={18} color={c.warning} />
              <Text style={[hubText.caption, { color: c.text100, flex: 1 }]}>
                {type === 'lose' ? 'კვირაში სხეულის წონის 1%-ზე მეტი კლება ზედმეტად სწრაფია — კუნთის დაკარგვისა და დაბრუნების რისკია. გაზარდე ვადა.' : 'კვირაში 0.5 კგ-ზე მეტი მატება ძირითადად ცხიმია. გაზარდე ვადა.'}
              </Text>
            </View>
          ) : null}
          <Field label="შეტყობინება კლიენტს (არასავალდ.)">
            <Input value={note} onChangeText={setNote} multiline maxLength={300} placeholder="მაგ. რეალისტური და მდგრადი ტემპი — ერთად გავაკეთებთ" />
          </Field>
          <View style={{ height: 12 }} />
        </>
      ) : null}
    </CoachForm>
  );
}
