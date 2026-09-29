import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { CalendarPlus } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api, ApiError } from '@/lib/api';
import { MONTH_SHORT, WEEKDAY_SHORT, addDaysYmd, dayLabel, tbilisiToIso, tbilisiYmd, type CoachCatalog, type Gym, type RosterClient } from '@/lib/coach';
import { Avatar, Button, Chip, CoachForm, Field, Input, Loading, coachStyles } from '@/components/coach/CoachUI';
import { haptic } from '@/components/coach/CoachKit';
import { hubText } from '@/theme/hub';
import { useThemeColors } from '@/theme/colors';
import { tx } from '@/i18n/locale';

const TIMES = Array.from({ length: 35 }, (_, i) => {
  const m = 6 * 60 + i * 30;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
});
const DURATIONS = [30, 45, 60, 75, 90, 120];
const REPEATS = [
  { n: 1, label: tx('ერთხელ', 'Once') },
  { n: 4, label: tx('4 კვირა', '4 weeks') },
  { n: 8, label: tx('8 კვირა', '8 weeks') },
  { n: 12, label: tx('12 კვირა', '12 weeks') },
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
    if (!openSlot && !clientId) return Alert.alert(tx('კლიენტი', 'Client'), tx('აირჩიე კლიენტი ან „თავისუფალი სლოტი“.', 'Choose a client or “Open slot”.'));
    if (!time) return Alert.alert(tx('დრო', 'Time'), tx('აირჩიე დაწყების დრო.', 'Choose a start time.'));
    setBusy(true);
    try {
      const res = await api.coach.createSession({ clientId: openSlot ? null : clientId, startsAt: tbilisiToIso(day, time), durationMin: duration, gymId, kind, note: note.trim(), repeatWeeks: repeat });
      haptic.success();
      Alert.alert(
        tx('დაინიშნა', 'Scheduled'),
        openSlot
          ? tx(`${res.sessions.length} თავისუფალი სლოტი გამოქვეყნდა — შენი კლიენტები დაჯავშნიან.`, `${res.sessions.length} open ${res.sessions.length === 1 ? 'slot' : 'slots'} published — your clients can book them.`)
          : tx(`${who?.name ?? 'კლიენტს'} შეტყობინება მიუვა. შეხსენება — 24 და 1 საათით ადრე.`, `${who?.name ?? 'Your client'} will get a notification. Reminders go out 24 hours and 1 hour before.`),
        [{ text: tx('კარგი', 'OK'), onPress: () => router.back() }],
      );
    } catch (e) {
      Alert.alert(tx('ვერ დაინიშნა', 'Couldn’t schedule'), e instanceof ApiError ? e.message : tx('სცადე ხელახლა.', 'Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <CoachForm
      title={tx('ვარჯიშის დანიშვნა', 'Schedule a workout')}
      fallback="/coach/calendar"
      footer={<Button label={time ? tx(`დანიშვნა · ${dayLabel(day, today)}, ${time}${repeat > 1 ? ` · ${repeat} კვ.` : ''}`, `Schedule · ${dayLabel(day, today)}, ${time}${repeat > 1 ? ` · ${repeat} wk` : ''}`) : tx('აირჩიე დრო', 'Choose a time')} busy={busy} disabled={!time || (!openSlot && !clientId)} onPress={() => void submit()} />}
    >
      {!clients ? <Loading /> : null}
      {clients ? (
        <>
          <Field label={tx('ვისთვის', 'For')}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 8 }}>
              <PersonTile label={tx('თავისუფალი სლოტი', 'Open slot')} selected={openSlot} onPress={() => { setOpenSlot(true); setClientId(null); }}>
                <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: c.bg200, alignItems: 'center', justifyContent: 'center' }}>
                  <CalendarPlus size={22} color={c.text200} />
                </View>
              </PersonTile>
              {clients.map((x) => (
                <PersonTile key={x.id} label={x.name.split(' ')[0]} selected={!openSlot && clientId === x.id} onPress={() => { setOpenSlot(false); setClientId(x.id); }}>
                  <Avatar avatarId={x.avatarId} photoUrl={x.avatarUrl} name={x.name} size={52} />
                </PersonTile>
              ))}
            </ScrollView>
            {who ? <Text style={[hubText.caption, { color: c.text300, marginTop: 8 }]}>{who.name} · {who.nextSession ? tx('შემდეგი ვარჯიში უკვე დაგეგმილია', 'Next workout already scheduled') : tx('დაგეგმილი ვარჯიში არ აქვს', 'No workout scheduled')}</Text> : null}
            {openSlot ? <Text style={[hubText.small, { color: c.text300, marginTop: 8 }]}>{tx('სლოტს შენი ნებისმიერი კლიენტი დაჯავშნის „ჩემი ტრენერი“-დან — ერთხელ.', 'Any of your clients can book the slot from “My trainer” — once.')}</Text> : null}
            {!clients.length && !openSlot ? <Text style={[hubText.small, { color: c.text300, marginTop: 8 }]}>{tx('კლიენტები ჯერ არ გყავს — გახსენი თავისუფალი სლოტი.', 'No clients yet — open a free slot.')}</Text> : null}
          </Field>

          <Field label={tx('დღე', 'Day')}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
              {days.map((d) => {
                const date = new Date(`${d}T12:00:00Z`);
                const sel = day === d;
                return (
                  <Pressable
                    key={d}
                    accessibilityRole="button"
                    accessibilityState={{ selected: sel }}
                    accessibilityLabel={dayLabel(d, today)}
                    onPress={() => { haptic.tap(); setDay(d); setTime(''); }}
                    style={{ width: 58, minHeight: 70, borderRadius: 18, alignItems: 'center', justifyContent: 'center', gap: 2, backgroundColor: sel ? '#0D9488' : c.surface }}
                  >
                    <Text style={[hubText.small, { color: sel ? '#CCFBF1' : c.text300 }]}>{d === today ? tx('დღეს', 'Today') : WEEKDAY_SHORT[date.getUTCDay()]}</Text>
                    <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 19, lineHeight: 26, color: sel ? '#FFFFFF' : c.text100 }}>{date.getUTCDate()}</Text>
                    <Text style={[hubText.small, { color: sel ? '#CCFBF1' : c.text300, fontSize: 10 }]}>{MONTH_SHORT[date.getUTCMonth()]}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Field>

          <Field label={tx('დაწყება', 'Start')}>
            {times.length ? (
              ([[tx('დილა', 'Morning'), (t: string) => t < '12:00'], [tx('დღე', 'Afternoon'), (t: string) => t >= '12:00' && t < '17:00'], [tx('საღამო', 'Evening'), (t: string) => t >= '17:00']] as const).map(([label, test]) => {
                const group = times.filter(test);
                if (!group.length) return null;
                return (
                  <View key={label} style={{ marginBottom: 10 }}>
                    <Text style={[hubText.small, { color: c.text300, marginBottom: 6 }]}>{label}</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      {group.map((t) => (
                        <Chip key={t} label={t} selected={time === t} onPress={() => setTime(t)} />
                      ))}
                    </View>
                  </View>
                );
              })
            ) : (
              <Text style={[hubText.body, { color: c.text300 }]}>{tx('დღევანდელი დრო ამოიწურა — აირჩიე სხვა დღე.', 'No times left today — choose another day.')}</Text>
            )}
          </Field>

          <Field label={tx('ხანგრძლივობა', 'Duration')}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {DURATIONS.map((m) => (
                <Chip key={m} label={tx(`${m} წთ`, `${m} min`)} selected={duration === m} onPress={() => setDuration(m)} />
              ))}
            </View>
          </Field>

          <Field label={tx('ვარჯიშის ტიპი', 'Workout type')}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {(catalog?.sessionKinds ?? []).map((k) => (
                <Chip key={k.key} label={k.label} selected={kind === k.key} onPress={() => setKind(k.key)} />
              ))}
            </View>
          </Field>

          {gyms.length ? (
            <Field label={tx('დარბაზი', 'Gym')}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {gyms.map((g) => (
                  <Chip key={g.id} label={`${g.brand} · ${g.name}`} selected={gymId === g.id} onPress={() => setGymId(g.id)} />
                ))}
                <Chip label={tx('დარბაზის გარეშე', 'No gym')} selected={gymId === null} onPress={() => setGymId(null)} />
              </View>
            </Field>
          ) : null}

          <Field label={tx('გამეორება ყოველ კვირას', 'Repeat weekly')}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {REPEATS.map((r) => (
                <Chip key={r.n} label={r.label} selected={repeat === r.n} onPress={() => setRepeat(r.n)} />
              ))}
            </View>
          </Field>

          <Field label={tx('შენიშვნა კლიენტს (არასავალდ.)', 'Note to client (optional)')}>
            <Input value={note} onChangeText={setNote} maxLength={300} placeholder={tx('მაგ. ფეხების დღე — წამოიღე ქამარი', 'e.g. Leg day — bring your belt')} />
          </Field>
          <View style={{ height: 12 }} />
        </>
      ) : null}
    </CoachForm>
  );
}

/** Avatar + first name, selectable (who the session is for). */
function PersonTile({ label, selected, onPress, children }: { label: string; selected: boolean; onPress: () => void; children: React.ReactNode }) {
  const c = useThemeColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      style={{ width: 76, alignItems: 'center', gap: 6 }}
    >
      <View style={{ padding: 3, borderRadius: 32, borderWidth: 2, borderColor: selected ? '#14B8A6' : 'transparent' }}>{children}</View>
      <Text numberOfLines={2} style={[hubText.small, { color: selected ? c.text100 : c.text200, textAlign: 'center', fontFamily: selected ? 'NotoSansGeorgian_700Bold' : 'NotoSansGeorgian_400Regular' }]}>{label}</Text>
    </Pressable>
  );
}
