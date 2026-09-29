import React, { useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AlertTriangle } from 'lucide-react-native';
import { api, ApiError } from '@/lib/api';
import { GOAL_TYPE_LABEL, addDaysYmd, tbilisiYmd, type ClientDashboard, type GoalProposal } from '@/lib/coach';
import { Button, Card, Chip, CoachForm, Field, Input, Loading, Stat, coachStyles } from '@/components/coach/CoachUI';
import { hubText } from '@/theme/hub';
import { useThemeColors } from '@/theme/colors';
import { tx } from '@/i18n/locale';

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
      .catch((e) => Alert.alert(tx('ვერ ჩაიტვირთა', 'Couldn’t load'), e instanceof ApiError ? e.message : tx('სცადე ხელახლა.', 'Please try again.')));
  }, [clientId]);

  const current = d?.weight?.currentKg ?? null;
  const t = Number(target.replace(',', '.'));
  const pace = current && t ? Math.abs(current - t) / weeks : null;
  const pctWeek = current && pace ? (pace / current) * 100 : null;
  const unsafe = pctWeek != null && ((type === 'lose' && pctWeek > 1) || (type === 'gain' && pace! > 0.5));
  const deadline = addDaysYmd(tbilisiYmd(), weeks * 7);

  const send = async () => {
    if (!t || t < 30 || t > 300) return Alert.alert(tx('სამიზნე წონა', 'Target weight'), tx('მიუთითე წონა 30–300 კგ.', 'Enter a weight between 30 and 300 kg.'));
    setBusy(true);
    try {
      await api.coach.proposeGoal(String(clientId), { type, targetKg: Math.round(t * 10) / 10, deadlineYmd: deadline, note: note.trim() });
      Alert.alert(tx('შეთავაზება გაიგზავნა', 'Proposal sent'), tx('კლიენტი მიიღებს შეტყობინებას და თავად დაადასტურებს.', 'Your client gets a notification and confirms it themselves.'), [{ text: tx('კარგი', 'OK'), onPress: () => router.back() }]);
    } catch (e) {
      Alert.alert(tx('ვერ გაიგზავნა', 'Couldn’t send'), e instanceof ApiError ? e.message : tx('სცადე ხელახლა.', 'Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <CoachForm title={tx('მიზნის შეთავაზება', 'Propose a goal')} subtitle={d?.client.name} fallback="/coach/clients" footer={<Button label={tx('შეთავაზება კლიენტს', 'Send to client')} busy={busy} onPress={() => void send()} />}>
      {!d ? <Loading /> : null}
      {d ? (
        <>
          <Field label={tx('მიზნის ტიპი', 'Goal type')}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {(Object.keys(GOAL_TYPE_LABEL) as GoalProposal['type'][]).map((k) => (
                <Chip key={k} label={GOAL_TYPE_LABEL[k]} selected={type === k} onPress={() => setType(k)} />
              ))}
            </View>
          </Field>
          <Field label={tx(`სამიზნე წონა, კგ${current ? ` (ახლა ${current})` : ''}`, `Target weight, kg${current ? ` (now ${current})` : ''}`)}>
            <Input value={target} onChangeText={(v) => setTarget(v.replace(/[^\d.,]/g, '').slice(0, 5))} keyboardType="decimal-pad" placeholder="72" style={{ fontSize: 22, textAlign: 'center', minHeight: 56 }} />
          </Field>
          <Field label={tx('ვადა', 'Deadline')}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {WEEKS.map((w) => (
                <Chip key={w} label={tx(`${w} კვირა`, `${w} ${w === 1 ? 'week' : 'weeks'}`)} selected={weeks === w} onPress={() => setWeeks(w)} />
              ))}
            </View>
          </Field>
          <Card style={{ marginTop: 16, flexDirection: 'row', gap: 6 }}>
            <Stat label={tx('ტემპი', 'Pace')} value={pace != null ? `${Math.round(pace * 100) / 100} ${tx('კგ', 'kg')}` : '—'} hint={tx('კვირაში', 'per week')} />
            <Stat label={tx('სხეულის წონის', 'Of body weight')} value={pctWeek != null ? `${Math.round(pctWeek * 10) / 10}%` : '—'} hint={tx('კვირაში', 'per week')} />
            <Stat label={tx('ვადა', 'Deadline')} value={deadline.slice(5).replace('-', '.')} hint={deadline.slice(0, 4)} />
          </Card>
          {unsafe ? (
            <View style={[coachStyles.row, { gap: 8, backgroundColor: c.warningBg, borderRadius: 14, padding: 12, marginTop: 10 }]}>
              <AlertTriangle size={18} color={c.warning} />
              <Text style={[hubText.caption, { color: c.text100, flex: 1 }]}>
                {type === 'lose' ? tx('კვირაში სხეულის წონის 1%-ზე მეტი კლება ზედმეტად სწრაფია — კუნთის დაკარგვისა და დაბრუნების რისკია. გაზარდე ვადა.', 'Losing more than 1% of body weight a week is too fast — it risks muscle loss and regaining the weight. Extend the deadline.') : tx('კვირაში 0.5 კგ-ზე მეტი მატება ძირითადად ცხიმია. გაზარდე ვადა.', 'Gaining more than 0.5 kg a week is mostly fat. Extend the deadline.')}
              </Text>
            </View>
          ) : null}
          <Field label={tx('შეტყობინება კლიენტს (არასავალდ.)', 'Message to client (optional)')}>
            <Input value={note} onChangeText={setNote} multiline maxLength={300} placeholder={tx('მაგ. რეალისტური და მდგრადი ტემპი — ერთად გავაკეთებთ', 'e.g. A realistic, steady pace — we’ll do it together')} />
          </Field>
          <View style={{ height: 12 }} />
        </>
      ) : null}
    </CoachForm>
  );
}
