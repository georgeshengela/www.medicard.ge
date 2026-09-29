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
import { tx } from '@/i18n/locale';

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
      setError(e instanceof ApiError ? e.message : tx('ჩატვირთვა ვერ მოხერხდა.', 'Couldn’t load.'));
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
      Alert.alert(tx('ვერ შეინახა', 'Couldn’t save'), e instanceof ApiError ? e.message : tx('სცადე ხელახლა.', 'Please try again.'));
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
          tx(`${health} ვერ დაუკავშირდა`, `Couldn’t connect to ${health}`),
          r.reason === 'denied'
            ? tx(`ნებართვა არ მოგვეცა. ჩართე ვარჯიშების წაკითხვა ${health}-ის პარამეტრებში.`, `Permission wasn’t granted. Turn on workout reading in ${health} settings.`)
            : r.reason === 'expo_go'
              ? tx('ეს ფუნქცია მხოლოდ აპის სრულ ვერსიაში მუშაობს.', 'This only works in the full version of the app.')
              : tx('ამ მოწყობილობაზე ვარჯიშების წაკითხვა ვერ მოხერხდა.', 'Couldn’t read workouts on this device.'),
        );
    } finally {
      setBusy(null);
    }
  };

  const end = () => {
    Alert.alert(tx('ტრენერთან კავშირის დასრულება', 'End connection with trainer'), tx('ტრენერი მაშინვე ვეღარ ნახავს შენს მონაცემებს, მომავალი ვარჯიშები გაუქმდება. ისტორია შენთან დარჩება.', 'Your trainer immediately loses access to your data, and upcoming workouts are cancelled. Your history stays with you.'), [
      { text: tx('არა', 'No'), style: 'cancel' },
      {
        text: tx('დასრულება', 'End'),
        style: 'destructive',
        onPress: async () => {
          try {
            await api.coach.unlink();
            invalidateCoachEntry();
            router.replace('/trainer' as never);
          } catch (e) {
            Alert.alert(tx('ვერ მოხერხდა', 'Something went wrong'), e instanceof ApiError ? e.message : tx('სცადე ხელახლა.', 'Please try again.'));
          }
        },
      },
    ]);
  };

  const link = ov?.link;
  return (
    <View style={{ flex: 1, backgroundColor: c.bg100 }}>
      <CoachHeader title={tx('გაზიარება ტრენერთან', 'Sharing with trainer')} subtitle={ov?.trainer?.displayName} fallback="/trainer" />
      <Screen>
        {error ? <ErrorBox message={error} onRetry={load} /> : null}
        {!ov && !error ? <Loading /> : null}
        {link ? (
          <>
            <Card style={{ marginTop: 8, gap: 10 }}>
              <View style={coachStyles.row}>
                <IconTile icon={Lock} ink="teal" />
                <Text style={[hubText.body, { color: c.text200, flex: 1 }]}>
                  {tx('ცვლილება მაშინვე მოქმედებს. გამორთული კატეგორია ტრენერისთვის ქრება — ისტორიის ჩათვლით.', 'Changes take effect immediately. A category you turn off disappears for the trainer — history included.')}
                </Text>
              </View>
              <Text style={[hubText.small, { color: c.text300 }]}>
                {link.trainerViewedAt ? tx(`ტრენერმა ბოლოს ნახა: ${dayLabel(tbilisiYmd(link.trainerViewedAt))} ${clockOf(link.trainerViewedAt)}`, `Your trainer last viewed: ${dayLabel(tbilisiYmd(link.trainerViewedAt))} ${clockOf(link.trainerViewedAt)}`) : tx('ტრენერს შენი მონაცემები ჯერ არ უნახავს.', 'Your trainer hasn’t viewed your data yet.')}
              </Text>
            </Card>
            <Section title={tx('ტრენერი ხედავს', 'Your trainer sees')}>
              <Card style={{ paddingVertical: 6 }}>
                <Toggle title={tx('ვარჯიშების განრიგი', 'Session schedule')} body={tx('ჯავშნები ორივე მხარეს ჩანს — ეს კავშირის საფუძველია.', 'Bookings are visible to both of you — that’s the basis of the connection.')} value disabled onChange={() => undefined} />
                {COACH_SCOPES.map((k) => (
                  <Toggle key={k} title={SCOPE_COPY[k].title} body={SCOPE_COPY[k].body} value={link.scopes[k]} onChange={(v) => void setScope(k, v)} disabled={link.status !== 'ACTIVE'} />
                ))}
              </Card>
              <Text style={[hubText.small, { color: c.text300, marginTop: 8 }]}>{tx('არასოდეს ჩანს: სამედიცინო ჩანაწერები, ანალიზები, წამლები, ციკლი, Medi-სთან საუბრები.', 'Never visible: medical records, lab results, medications, your cycle, conversations with Medi.')}</Text>
            </Section>
            {health && link.scopes.workouts ? (
              <Section title={tx(`ვარჯიშები ${health}-იდან`, `Workouts from ${health}`)}>
                <Card style={{ gap: 6 }}>
                  <View style={coachStyles.row}>
                    <IconTile icon={Activity} ink="green" />
                    <Text style={[hubText.body, { color: c.text200, flex: 1 }]}>
                      {tx('საათით ან ტელეფონით ჩაწერილი ვარჯიშები (ხანგრძლივობა, კალორია, პულსი) ავტომატურად მიებმება ტრენერთან ვარჯიშს.', 'Workouts recorded on your watch or phone (duration, calories, heart rate) are automatically matched to your sessions with the trainer.')}
                    </Text>
                  </View>
                  <Toggle title={tx('ვარჯიშების წაკითხვა', 'Read workouts')} value={healthOn} disabled={busy === 'health'} onChange={(v) => void toggleHealth(v)} />
                </Card>
              </Section>
            ) : null}
            <Section title={tx('კავშირი', 'Connection')}>
              <Button label={tx('ტრენერთან კავშირის დასრულება', 'End connection with trainer')} kind="danger" icon={Unlink} onPress={end} />
              {ov?.trainer ? (
                <Button
                  label={tx('შეტყობინება დარღვევაზე / დაბლოკვა', 'Report / block')}
                  kind="ghost"
                  style={{ marginTop: 8 }}
                  onPress={() => router.push({ pathname: '/trainer/report', params: { id: ov.trainer!.id, name: ov.trainer!.displayName, role: 'trainer' } } as never)}
                />
              ) : null}
            </Section>
          </>
        ) : ov ? (
          <Text style={[hubText.body, { color: c.text200, marginTop: 20 }]}>{tx('ტრენერთან კავშირი არ გაქვს.', 'You’re not connected with a trainer.')}</Text>
        ) : null}
      </Screen>
    </View>
  );
}
