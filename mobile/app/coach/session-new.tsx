import React, { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { api, ApiError } from '@/lib/api';
import { addDaysYmd, dayLabel, tbilisiToIso, tbilisiYmd, type CoachCatalog, type Gym, type RosterClient } from '@/lib/coach';
import { Avatar, Button, Chip, CoachForm, Field, Input, Loading, coachStyles } from '@/components/coach/CoachUI';
import { hubText } from '@/theme/hub';
import { useThemeColors } from '@/theme/colors';

const TIMES = Array.from({ length: 35 }, (_, i) => {
  const m = 6 * 60 + i * 30;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
});
const DURATIONS = [30, 45, 60, 75, 90, 120];
const REPEATS = [
  { n: 1, label: 'ერთხელ' },
  { n: 4, label: '4 კვირა' },
  { n: 8, label: '8 კვირა' },
  { n: 12, label: '12 კვირა' },
];

/** Book a client (or publish an open slot). Day/time are tap chips — fast in a gym, same on iOS and Android. */
export default function NewSessionScreen() {
  const router = useRouter();
  const c = useThemeColors();
  const params = useLocalSearchParams<{ date?: string; clientId?: string }>();
  const today = tbilisiYmd();
  const [clients, setClients] = useState<RosterClient[] | null>(null);
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [catalog, setCatalog] = useState<CoachCatalog | null>(null);
  const [clientId, setClientId] = useState<string | null>(params.clientId ? String(params.clientId) : null);
  const [day, setDay] = useState(params.date && String(params.date) >= today ? String(params.date) : today);
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState(60);
  const [kind, setKind] = useState('STRENGTH');
  const [gymId, setGymId] = useState<string | null>(null);
  const [repeat, setRepeat] = useState(1);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [openSlot, setOpenSlot] = useState(false);

  useEffect(() => {
    void Promise.all([api.coach.clients(), api.coach.me(), api.coach.catalog()])
      .then(([r, me, cat]) => {
        setClients(r.clients);
        const g = me.trainerProfile?.gyms ?? [];
        setGyms(g);
        setGymId((prev) => prev ?? g[0]?.id ?? null);
        setCatalog(cat);
      })
      .catch(() => setClients([]));
  }, []);

  const days = useMemo(() => Array.from({ length: 28 }, (_, i) => addDaysYmd(today, i)), [today]);
  const nowHm = (() => {
    const t = new Date(Date.now() + 4 * 3600000);
    return `${String(t.getUTCHours()).padStart(2, '0')}:${String(t.getUTCMinutes()).padStart(2, '0')}`;
  })();
  const times = day === today ? TIMES.filter((t) => t > nowHm) : TIMES;
  const who = clients?.find((x) => x.id === clientId);

  const submit = async () => {
    if (!openSlot && !clientId) return Alert.alert('კლიენტი', 'აირჩიე კლიენტი ან „თავისუფალი სლოტი“.');
    if (!time) return Alert.alert('დრო', 'აირჩიე დაწყების დრო.');
    setBusy(true);
    try {
      const res = await api.coach.createSession({ clientId: openSlot ? null : clientId, startsAt: tbilisiToIso(day, time), durationMin: duration, gymId, kind, note: note.trim(), repeatWeeks: repeat });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      Alert.alert(
        'დაინიშნა ✅',
        openSlot ? `${res.sessions.length} თავისუფალი სლოტი გამოქვეყნდა — შენი კლიენტები დაჯავშნიან.` : `${who?.name ?? 'კლიენტს'} შეტყობინება მიუვა. შეხსენება — 24 და 1 საათით ადრე.`,
        [{ text: 'კარგი', onPress: () => router.back() }],
      );
    } catch (e) {
      Alert.alert('ვერ დაინიშნა', e instanceof ApiError ? e.message : 'სცადე ხელახლა.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <CoachForm
      title="ვარჯიშის დანიშვნა"
      fallback="/coach/calendar"
      footer={<Button label={repeat > 1 ? `დანიშვნა · ${repeat} კვირა` : 'დანიშვნა'} busy={busy} disabled={!time || (!openSlot && !clientId)} onPress={() => void submit()} />}
    >
      {!clients ? <Loading /> : null}
      {clients ? (
        <>
          <Field label="ვისთვის">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              <Chip label="თავისუფალი სლოტი" selected={openSlot} onPress={() => { setOpenSlot(true); setClientId(null); }} />
              {clients.map((x) => (
                <Chip key={x.id} label={x.name} selected={!openSlot && clientId === x.id} onPress={() => { setOpenSlot(false); setClientId(x.id); }} />
              ))}
            </ScrollView>
            {who ? (
              <View style={[coachStyles.row, { marginTop: 10 }]}>
                <Avatar avatarId={who.avatarId} name={who.name} size={32} />
                <Text style={[hubText.caption, { color: c.text200, flex: 1 }]}>{who.nextSession ? `შემდეგი ვარჯიში უკვე დაგეგმილია` : 'დაგეგმილი ვარჯიში არ აქვს'}</Text>
              </View>
            ) : null}
            {openSlot ? <Text style={[hubText.small, { color: c.text300, marginTop: 6 }]}>სლოტს შენი ნებისმიერი კლიენტი დაჯავშნის „ჩემი ტრენერი“-დან — ერთხელ.</Text> : null}
          </Field>

          <Field label="დღე">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {days.map((d) => (
                <Chip key={d} label={dayLabel(d, today)} selected={day === d} onPress={() => { setDay(d); setTime(''); }} />
              ))}
            </ScrollView>
          </Field>

          <Field label="დაწყება">
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {times.map((t) => (
                <Chip key={t} label={t} selected={time === t} onPress={() => setTime(t)} />
              ))}
            </View>
          </Field>

          <Field label="ხანგრძლივობა">
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {DURATIONS.map((m) => (
                <Chip key={m} label={`${m} წთ`} selected={duration === m} onPress={() => setDuration(m)} />
              ))}
            </View>
          </Field>

          <Field label="ვარჯიშის ტიპი">
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {(catalog?.sessionKinds ?? []).map((k) => (
                <Chip key={k.key} label={k.label} selected={kind === k.key} onPress={() => setKind(k.key)} />
              ))}
            </View>
          </Field>

          {gyms.length ? (
            <Field label="დარბაზი">
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {gyms.map((g) => (
                  <Chip key={g.id} label={`${g.brand} · ${g.name}`} selected={gymId === g.id} onPress={() => setGymId(g.id)} />
                ))}
                <Chip label="დარბაზის გარეშე" selected={gymId === null} onPress={() => setGymId(null)} />
              </View>
            </Field>
          ) : null}

          <Field label="გამეორება ყოველ კვირას">
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {REPEATS.map((r) => (
                <Chip key={r.n} label={r.label} selected={repeat === r.n} onPress={() => setRepeat(r.n)} />
              ))}
            </View>
          </Field>

          <Field label="შენიშვნა კლიენტს (არასავალდ.)">
            <Input value={note} onChangeText={setNote} maxLength={300} placeholder="მაგ. ფეხების დღე — წამოიღე ქამარი" />
          </Field>
          <View style={{ height: 12 }} />
        </>
      ) : null}
    </CoachForm>
  );
}
