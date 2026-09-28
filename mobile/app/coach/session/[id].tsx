import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { CheckCircle2, ChevronRight, Flame, HeartPulse, MapPin, Plus, Star, Timer, Trash2, UserX } from 'lucide-react-native';
import { api, ApiError } from '@/lib/api';
import { localAccountId } from '@/lib/localAccount';
import { SESSION_STATUS_LABEL, addDaysYmd, clockOf, dayLabel, tbilisiToIso, tbilisiYmd, workoutKindLabel, type CoachSession, type Exercise } from '@/lib/coach';
import { Avatar, Badge, Button, Card, Chip, CoachForm, Field, Input, Loading, Section, Stat, coachStyles } from '@/components/coach/CoachUI';
import { FadeIn, KpiTile, StatusPill, sessionTiming } from '@/components/coach/CoachKit';
import { hubText } from '@/theme/hub';
import { useThemeColors } from '@/theme/colors';

const QUICK = ['ბექ სქვოთი', 'ჟიმი წოლით', 'მკვდარი წევა', 'ჟიმი ზემოთ', 'აზიდვა', 'ლანჯი', 'რუმინული წევა', 'ქვედა ბლოკი', 'პლანკა', 'კარდიო'];
type Row = { name: string; sets: string; reps: string; kg: string };
const toRow = (e: Exercise): Row => ({ name: e.name, sets: e.sets != null ? String(e.sets) : '', reps: e.reps != null ? String(e.reps) : '', kg: e.kg != null ? String(e.kg) : '' });
const num = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')));

export default function CoachSessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const c = useThemeColors();
  const [s, setS] = useState<CoachSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);
  const [newDay, setNewDay] = useState('');
  const [newTime, setNewTime] = useState('');

  const load = useCallback(async () => {
    const owner = localAccountId();
    try {
      const res = await api.coach.coachSession(String(id));
      if (localAccountId() !== owner) return;
      setS(res.session);
      setRows(res.session.exercises.length ? res.session.exercises.map(toRow) : []);
      setNote(res.session.trainerNote);
      setNewDay(tbilisiYmd(res.session.startsAt));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'ჩატვირთვა ვერ მოხერხდა.');
    }
  }, [id]);
  useFocusEffect(useCallback(() => void load(), [load]));

  const started = s ? new Date(s.startsAt).getTime() <= Date.now() + 15 * 60000 : false;
  const canLog = s && s.clientId && (s.status === 'DONE' || s.status === 'NO_SHOW' || (s.status === 'SCHEDULED' && started));
  const canChange = s && (s.status === 'SCHEDULED' || s.status === 'OPEN') && !started;
  const volume = useMemo(() => rows.reduce((sum, r) => sum + (num(r.sets) ?? 0) * (num(r.reps) ?? 0) * (num(r.kg) ?? 0), 0), [rows]);

  const complete = async (status: 'DONE' | 'NO_SHOW') => {
    if (!s) return;
    setBusy(status);
    try {
      const exercises = rows.filter((r) => r.name.trim()).map((r) => ({ name: r.name.trim(), sets: num(r.sets), reps: num(r.reps), kg: num(r.kg) }));
      const res = await api.coach.completeSession(s.id, { status, exercises, trainerNote: note.trim() });
      setS({ ...res.session, workout: s.workout });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      if (status === 'DONE') Alert.alert('შენახულია', 'კლიენტი ნახავს ვარჯიშის შედეგს და შეფასებას დატოვებს.');
    } catch (e) {
      Alert.alert('ვერ შეინახა', e instanceof ApiError ? e.message : 'სცადე ხელახლა.');
    } finally {
      setBusy(null);
    }
  };

  const cancel = () =>
    Alert.alert('ვარჯიშის გაუქმება', s?.clientName ? `${s.clientName}-ს შეტყობინება მიუვა.` : 'სლოტი წაიშლება.', [
      { text: 'არა', style: 'cancel' },
      {
        text: 'გაუქმება',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.coach.cancelSession(String(id));
            router.back();
          } catch (e) {
            Alert.alert('ვერ მოხერხდა', e instanceof ApiError ? e.message : 'სცადე ხელახლა.');
          }
        },
      },
    ]);

  const move = async () => {
    if (!newDay || !newTime) return;
    setBusy('move');
    try {
      const res = await api.coach.updateSession(String(id), { startsAt: tbilisiToIso(newDay, newTime) });
      setS(res.session);
      setMoving(false);
    } catch (e) {
      Alert.alert('ვერ გადაიტანა', e instanceof ApiError ? e.message : 'სცადე ხელახლა.');
    } finally {
      setBusy(null);
    }
  };

  const today = tbilisiYmd();
  const days = Array.from({ length: 21 }, (_, i) => addDaysYmd(today, i));
  const times = Array.from({ length: 35 }, (_, i) => {
    const m = 6 * 60 + i * 30;
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  });

  return (
    <CoachForm
      title={s?.clientName ?? (s?.status === 'OPEN' ? 'თავისუფალი სლოტი' : 'ვარჯიში')}
      subtitle={s ? `${dayLabel(tbilisiYmd(s.startsAt))} · ${clockOf(s.startsAt)} · ${s.durationMin} წთ` : undefined}
      fallback="/coach/calendar"
      footer={
        canLog ? (
          <View style={[coachStyles.row, { gap: 10 }]}>
            <Button label={s?.status === 'DONE' ? 'განახლება' : 'ჩატარდა'} icon={CheckCircle2} style={{ flex: 1.4 }} busy={busy === 'DONE'} onPress={() => void complete('DONE')} />
            <Button label="არ მოვიდა" icon={UserX} kind="secondary" style={{ flex: 1 }} busy={busy === 'NO_SHOW'} onPress={() => void complete('NO_SHOW')} />
          </View>
        ) : canChange ? (
          moving ? (
            <Button label="გადატანა" busy={busy === 'move'} disabled={!newTime} onPress={() => void move()} />
          ) : (
            <View style={[coachStyles.row, { gap: 10 }]}>
              <Button label="გადატანა" kind="secondary" style={{ flex: 1 }} onPress={() => setMoving(true)} />
              <Button label="გაუქმება" kind="danger" style={{ flex: 1 }} onPress={cancel} />
            </View>
          )
        ) : (
          <Button label="უკან" kind="secondary" onPress={() => router.back()} />
        )
      }
    >
      {error ? <Text style={[hubText.body, { color: c.danger, marginTop: 12 }]}>{error}</Text> : null}
      {!s && !error ? <Loading /> : null}
      {s ? (
        <>
          <FadeIn>
            <Card style={{ marginTop: 8, gap: 14 }}>
              <View style={coachStyles.rowBetween}>
                <StatusPill
                  label={s.status === 'SCHEDULED' ? (s.clientConfirmedAt ? 'კლიენტმა დაადასტურა' : 'დასტურს ელოდება') : SESSION_STATUS_LABEL[s.status]}
                  tone={s.status === 'DONE' || (s.status === 'SCHEDULED' && s.clientConfirmedAt) ? 'ok' : s.status === 'CANCELLED' || s.status === 'NO_SHOW' ? 'bad' : s.status === 'OPEN' ? 'brand' : 'neutral'}
                />
                {s.status === 'SCHEDULED' ? <Text style={[hubText.caption, { color: c.text300 }]}>{sessionTiming(s.startsAt, s.durationMin).text}</Text> : null}
              </View>
              <View style={[coachStyles.row, { gap: 14 }]}>
                <View>
                  <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 30, lineHeight: 38, color: c.text100 }}>{clockOf(s.startsAt)}</Text>
                  <Text style={[hubText.caption, { color: c.text300 }]}>{dayLabel(tbilisiYmd(s.startsAt))}</Text>
                </View>
                <View style={{ width: 1, alignSelf: 'stretch', backgroundColor: c.bg300 }} />
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={[hubText.cardTitle, { color: c.text100 }]}>{s.kindLabel} · {s.durationMin} წთ</Text>
                  {s.gym ? (
                    <View style={[coachStyles.row, { gap: 5 }]}>
                      <MapPin size={13} color={c.text300} />
                      <Text numberOfLines={1} style={[hubText.caption, { color: c.text300, flex: 1 }]}>{s.gym.brand} · {s.gym.name}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
              {s.clientId ? (
                <Pressable accessibilityRole="button" accessibilityLabel={`${s.clientName}-ის ბარათი`} onPress={() => router.push(`/coach/client/${s.clientId}` as never)} className="active:opacity-80" style={[coachStyles.row, { backgroundColor: c.bg200, borderRadius: 16, padding: 10 }]}>
                  <Avatar avatarId={s.clientAvatarId} photoUrl={s.clientAvatarUrl} name={s.clientName ?? '?'} size={40} />
                  <Text numberOfLines={1} style={[hubText.cardTitle, { color: c.text100, flex: 1 }]}>{s.clientName}</Text>
                  {s.clientRating ? (
                    <View style={[coachStyles.row, { gap: 2 }]} accessibilityLabel={`შეფასება ${s.clientRating} 5-დან`}>
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} size={14} color="#F59E0B" fill={i < (s.clientRating ?? 0) ? '#F59E0B' : 'transparent'} />
                      ))}
                    </View>
                  ) : null}
                  <ChevronRight size={16} color={c.text300} />
                </Pressable>
              ) : null}
              {s.note ? <Text style={[hubText.body, { color: c.text200 }]}>„{s.note}“</Text> : null}
              {s.status === 'CANCELLED' && s.cancelReason ? <Text style={[hubText.caption, { color: c.danger }]}>მიზეზი: {s.cancelReason}{s.lateCancel ? ' · ბოლო წუთის გაუქმება' : ''}</Text> : null}
            </Card>
          </FadeIn>

          {s.workout ? (
            <Section title={`კლიენტის საათიდან · ${workoutKindLabel(s.workout.kind)}`}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <KpiTile icon={Timer} ink="teal" value={`${s.workout.durationMin}`} label="წუთი" />
                <KpiTile icon={Flame} ink="amber" value={s.workout.kcal != null ? String(s.workout.kcal) : '—'} label="კკალ" />
                <KpiTile icon={HeartPulse} ink="rose" value={s.workout.avgHeartRate != null ? String(s.workout.avgHeartRate) : '—'} label="საშ. პულსი" />
              </View>
            </Section>
          ) : null}

          {moving && canChange ? (
            <>
              <Field label="ახალი დღე">
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {days.map((d) => (
                    <Chip key={d} label={dayLabel(d, today)} selected={newDay === d} onPress={() => { setNewDay(d); setNewTime(''); }} />
                  ))}
                </ScrollView>
              </Field>
              <Field label="ახალი დრო">
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {times.map((t) => (
                    <Chip key={t} label={t} selected={newTime === t} onPress={() => setNewTime(t)} />
                  ))}
                </View>
              </Field>
              <Text style={[hubText.small, { color: c.text300, marginTop: 8 }]}>კლიენტს ახალი დროის შეტყობინება მიუვა და ხელახლა დაადასტურებს.</Text>
            </>
          ) : null}

          {canLog ? (
            <>
              <Section title={volume ? `სავარჯიშოები · ${Math.round(volume).toLocaleString('ka-GE')} კგ მოცულობა` : 'სავარჯიშოები'}>
                {rows.map((r, i) => (
                  <Card key={i} style={{ marginBottom: 8, gap: 8, paddingVertical: 12 }}>
                    <View style={[coachStyles.row, { gap: 8 }]}>
                      <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: c.accent100, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 12, color: c.primary100 }}>{i + 1}</Text>
                      </View>
                      <Input inset style={{ flex: 1, minHeight: 44 }} value={r.name} onChangeText={(t) => setRows((x) => x.map((y, j) => (j === i ? { ...y, name: t } : y)))} placeholder="სავარჯიშო" />
                      <Pressable accessibilityRole="button" accessibilityLabel="სავარჯიშოს წაშლა" hitSlop={10} onPress={() => setRows((x) => x.filter((_, j) => j !== i))} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
                        <Trash2 size={18} color={c.text300} />
                      </Pressable>
                    </View>
                    <View style={[coachStyles.row, { gap: 8 }]}>
                      {(['sets', 'reps', 'kg'] as const).map((k) => (
                        <View key={k} style={{ flex: 1 }}>
                          <Text style={[hubText.small, { color: c.text300, marginBottom: 2 }]}>{k === 'sets' ? 'სეტი' : k === 'reps' ? 'გამეორება' : 'კგ'}</Text>
                          <Input inset style={{ minHeight: 44, textAlign: 'center' }} keyboardType="decimal-pad" value={r[k]} onChangeText={(t) => setRows((x) => x.map((y, j) => (j === i ? { ...y, [k]: t.replace(/[^\d.,]/g, '').slice(0, 6) } : y)))} placeholder="—" />
                        </View>
                      ))}
                    </View>
                  </Card>
                ))}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {QUICK.filter((q) => !rows.some((r) => r.name === q)).map((q) => (
                    <Chip key={q} label={`+ ${q}`} onPress={() => setRows((x) => [...x, { name: q, sets: '3', reps: '10', kg: '' }])} />
                  ))}
                </View>
                <Button label="სხვა სავარჯიშო" icon={Plus} kind="ghost" onPress={() => setRows((x) => [...x, { name: '', sets: '', reps: '', kg: '' }])} />
              </Section>
              <Field label="შენიშვნა კლიენტს">
                <Input value={note} onChangeText={setNote} multiline maxLength={1000} placeholder="რა გამოუვიდა კარგად, რაზე იმუშაოს შემდეგ ჯერზე" />
              </Field>
              <View style={{ height: 12 }} />
            </>
          ) : null}
        </>
      ) : null}
    </CoachForm>
  );
}
