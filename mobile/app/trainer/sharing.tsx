import React, { useCallback, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Activity, Lock, Unlink } from 'lucide-react-native';
import { api, ApiError } from '@/lib/api';
import { invalidateCoachEntry } from '@/components/coach/CoachEntry';
import { localAccountId } from '@/lib/localAccount';
import { COACH_SCOPES, SCOPE_COPY, clockOf, dayLabel, tbilisiYmd, type ClientOverview, type CoachScope } from '@/lib/coach';
import { disableCoachWorkouts, enableCoachWorkouts, isCoachWorkoutsEnabled, syncCoachWorkouts, workoutsHealthName } from '@/lib/coachWorkouts';
import { Button, Card, CoachHeader, ErrorBox, IconTile, Loading, Screen, Section, Toggle, coachStyles } from '@/components/coach/CoachUI';
import { hubText } from '@/theme/hub';
import { useThemeColors } from '@/theme/colors';

/** What the trainer can see, changed instantly; workouts from Health; end the connection. */
export default function TrainerSharingScreen() {
  const router = useRouter();
  const c = useThemeColors();
  const [ov, setOv] = useState<ClientOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [healthOn, setHealthOn] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const health = workoutsHealthName();

  const load = useCallback(async () => {
    const owner = localAccountId();
    try {
      const [o, h] = await Promise.all([api.coach.overview(), isCoachWorkoutsEnabled(owner)]);
      if (localAccountId() !== owner) return;
      setOv(o);
      setHealthOn(h);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'ჩატვირთვა ვერ მოხერხდა.');
    }
  }, []);
  useFocusEffect(useCallback(() => void load(), [load]));

  const setScope = async (k: CoachScope, v: boolean) => {
    if (!ov?.link) return;
    setOv({ ...ov, link: { ...ov.link, scopes: { ...ov.link.scopes, [k]: v } } });
    try {
      setOv(await api.coach.setScopes({ [k]: v }));
      if (k === 'workouts' && v) void syncCoachWorkouts({ force: true });
    } catch (e) {
      Alert.alert('ვერ შეინახა', e instanceof ApiError ? e.message : 'სცადე ხელახლა.');
      void load();
    }
  };

  const toggleHealth = async (v: boolean) => {
    setBusy('health');
    try {
      if (!v) {
        await disableCoachWorkouts();
        setHealthOn(false);
        return;
      }
      const r = await enableCoachWorkouts();
      if (r.ok) setHealthOn(true);
      else
        Alert.alert(
          `${health} ვერ დაუკავშირდა`,
          r.reason === 'denied'
            ? `ნებართვა არ მოგვეცა. ჩართე ვარჯიშების წაკითხვა ${health}-ის პარამეტრებში.`
            : r.reason === 'expo_go'
              ? 'ეს ფუნქცია მხოლოდ აპის სრულ ვერსიაში მუშაობს.'
              : 'ამ მოწყობილობაზე ვარჯიშების წაკითხვა ვერ მოხერხდა.',
        );
    } finally {
      setBusy(null);
    }
  };

  const end = () => {
    Alert.alert('ტრენერთან კავშირის დასრულება', 'ტრენერი მაშინვე ვეღარ ნახავს შენს მონაცემებს, მომავალი ვარჯიშები გაუქმდება. ისტორია შენთან დარჩება.', [
      { text: 'არა', style: 'cancel' },
      {
        text: 'დასრულება',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.coach.unlink();
            invalidateCoachEntry();
            router.replace('/trainer' as never);
          } catch (e) {
            Alert.alert('ვერ მოხერხდა', e instanceof ApiError ? e.message : 'სცადე ხელახლა.');
          }
        },
      },
    ]);
  };

  const link = ov?.link;
  return (
    <View style={{ flex: 1, backgroundColor: c.bg100 }}>
      <CoachHeader title="გაზიარება ტრენერთან" subtitle={ov?.trainer?.displayName} fallback="/trainer" />
      <Screen>
        {error ? <ErrorBox message={error} onRetry={load} /> : null}
        {!ov && !error ? <Loading /> : null}
        {link ? (
          <>
            <Card style={{ marginTop: 8, gap: 10 }}>
              <View style={coachStyles.row}>
                <IconTile icon={Lock} ink="teal" />
                <Text style={[hubText.body, { color: c.text200, flex: 1 }]}>
                  ცვლილება მაშინვე მოქმედებს. გამორთული კატეგორია ტრენერისთვის ქრება — ისტორიის ჩათვლით.
                </Text>
              </View>
              <Text style={[hubText.small, { color: c.text300 }]}>
                {link.trainerViewedAt ? `ტრენერმა ბოლოს ნახა: ${dayLabel(tbilisiYmd(link.trainerViewedAt))} ${clockOf(link.trainerViewedAt)}` : 'ტრენერს შენი მონაცემები ჯერ არ უნახავს.'}
              </Text>
            </Card>
            <Section title="ტრენერი ხედავს">
              <Card style={{ paddingVertical: 6 }}>
                <Toggle title="ვარჯიშების განრიგი" body="ჯავშნები ორივე მხარეს ჩანს — ეს კავშირის საფუძველია." value disabled onChange={() => undefined} />
                {COACH_SCOPES.map((k) => (
                  <Toggle key={k} title={SCOPE_COPY[k].title} body={SCOPE_COPY[k].body} value={link.scopes[k]} onChange={(v) => void setScope(k, v)} disabled={link.status !== 'ACTIVE'} />
                ))}
              </Card>
              <Text style={[hubText.small, { color: c.text300, marginTop: 8 }]}>არასოდეს ჩანს: სამედიცინო ჩანაწერები, ანალიზები, წამლები, ციკლი, Medi-სთან საუბრები.</Text>
            </Section>
            {health && link.scopes.workouts ? (
              <Section title={`ვარჯიშები ${health}-იდან`}>
                <Card style={{ gap: 6 }}>
                  <View style={coachStyles.row}>
                    <IconTile icon={Activity} ink="green" />
                    <Text style={[hubText.body, { color: c.text200, flex: 1 }]}>
                      საათით ან ტელეფონით ჩაწერილი ვარჯიშები (ხანგრძლივობა, კალორია, პულსი) ავტომატურად მიებმება ტრენერთან ვარჯიშს.
                    </Text>
                  </View>
                  <Toggle title="ვარჯიშების წაკითხვა" value={healthOn} disabled={busy === 'health'} onChange={(v) => void toggleHealth(v)} />
                </Card>
              </Section>
            ) : null}
            <Section title="კავშირი">
              <Button label="ტრენერთან კავშირის დასრულება" kind="danger" icon={Unlink} onPress={end} />
              {ov?.trainer ? (
                <Button
                  label="შეტყობინება დარღვევაზე / დაბლოკვა"
                  kind="ghost"
                  style={{ marginTop: 8 }}
                  onPress={() => router.push({ pathname: '/trainer/report', params: { id: ov.trainer!.id, name: ov.trainer!.displayName, role: 'trainer' } } as never)}
                />
              ) : null}
            </Section>
          </>
        ) : ov ? (
          <Text style={[hubText.body, { color: c.text200, marginTop: 20 }]}>ტრენერთან კავშირი არ გაქვს.</Text>
        ) : null}
      </Screen>
    </View>
  );
}
