import React, { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Flame, HeartPulse, Star, Timer } from 'lucide-react-native';
import { api, ApiError } from '@/lib/api';
import { localAccountId } from '@/lib/localAccount';
import { SESSION_STATUS_LABEL, clockOf, dayLabel, tbilisiYmd, workoutKindLabel, type CoachSession } from '@/lib/coach';
import { Badge, Card, CoachHeader, ErrorBox, Loading, Screen, Section, Stat, coachStyles } from '@/components/coach/CoachUI';
import { hubText } from '@/theme/hub';
import { useThemeColors } from '@/theme/colors';
import { dateLocale, tx } from '@/i18n/locale';

/** One finished session: what the trainer logged + the phone workout for that hour. */
export default function ClientSessionDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useThemeColors();
  const [s, setS] = useState<CoachSession | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const owner = localAccountId();
    try {
      const res = await api.coach.session(String(id));
      if (localAccountId() === owner) setS(res.session);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : tx('ჩატვირთვა ვერ მოხერხდა.', 'Couldn’t load.'));
    }
  }, [id]);
  useFocusEffect(useCallback(() => void load(), [load]));

  const rate = async (n: number) => {
    if (!s) return;
    setS({ ...s, clientRating: n });
    try {
      setS((await api.coach.rate(s.id, n)).session);
    } catch {
      void load();
    }
  };

  const volume = (s?.exercises ?? []).reduce((sum, e) => sum + (e.sets ?? 0) * (e.reps ?? 0) * (e.kg ?? 0), 0);
  return (
    <View style={{ flex: 1, backgroundColor: c.bg100 }}>
      <CoachHeader title={tx('ვარჯიში', 'Workout')} subtitle={s ? `${dayLabel(tbilisiYmd(s.startsAt))} · ${clockOf(s.startsAt)}` : undefined} fallback="/trainer/sessions" />
      <Screen>
        {error ? <ErrorBox message={error} onRetry={load} /> : null}
        {!s && !error ? <Loading /> : null}
        {s ? (
          <>
            <Card style={{ marginTop: 8, gap: 12 }}>
              <View style={coachStyles.rowBetween}>
                <Text style={[hubText.cardTitle, { color: c.text100, fontSize: 18 }]}>{s.kindLabel}</Text>
                <Badge label={SESSION_STATUS_LABEL[s.status]} tone={s.status === 'DONE' ? 'ok' : 'bad'} />
              </View>
              <View style={[coachStyles.row, { gap: 8 }]}>
                <Stat label={tx('ხანგრძლივობა', 'Duration')} value={`${s.durationMin} ${tx('წთ', 'min')}`} />
                <Stat label={tx('სავარჯიშო', 'Exercises')} value={String(s.exercises.length)} />
                <Stat label={tx('მოცულობა', 'Volume')} value={volume ? `${Math.round(volume).toLocaleString(dateLocale())} ${tx('კგ', 'kg')}` : '—'} />
              </View>
            </Card>

            {s.workout ? (
              <Section title={tx('შენი საათიდან / ტელეფონიდან', 'From your watch / phone')}>
                <Card style={{ gap: 12 }}>
                  <Text style={[hubText.cardTitle, { color: c.text100 }]}>{workoutKindLabel(s.workout.kind)}</Text>
                  <View style={[coachStyles.row, { gap: 8 }]}>
                    <View style={{ flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                      <Timer size={16} color={c.primary100} />
                      <Stat label={tx('დრო', 'Time')} value={`${s.workout.durationMin} ${tx('წთ', 'min')}`} />
                    </View>
                    <View style={{ flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                      <Flame size={16} color="#F97316" />
                      <Stat label={tx('კალორია', 'Calories')} value={s.workout.kcal != null ? `${s.workout.kcal}` : '—'} />
                    </View>
                    <View style={{ flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                      <HeartPulse size={16} color="#E11D48" />
                      <Stat label={tx('საშ. პულსი', 'Avg HR')} value={s.workout.avgHeartRate != null ? `${s.workout.avgHeartRate}` : '—'} />
                    </View>
                  </View>
                </Card>
              </Section>
            ) : null}

            {s.exercises.length ? (
              <Section title={tx('სავარჯიშოები', 'Exercises')}>
                <Card style={{ paddingVertical: 6 }}>
                  {s.exercises.map((e, i) => (
                    <View key={`${e.name}${i}`} style={[coachStyles.rowBetween, { paddingVertical: 10, borderBottomWidth: i < s.exercises.length - 1 ? 0.5 : 0, borderColor: c.bg300 }]}>
                      <Text style={[hubText.cardTitle, { color: c.text100, flex: 1 }]}>{e.name}</Text>
                      <Text style={[hubText.body, { color: c.text200 }]}>
                        {[e.sets && e.reps ? `${e.sets}×${e.reps}` : null, e.kg ? `${e.kg} ${tx('კგ', 'kg')}` : null, e.minutes ? `${e.minutes} ${tx('წთ', 'min')}` : null].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                  ))}
                </Card>
              </Section>
            ) : null}

            {s.trainerNote ? (
              <Section title={tx('ტრენერის შენიშვნა', 'Trainer’s note')}>
                <Card>
                  <Text style={[hubText.body, { color: c.text100, fontSize: 14, lineHeight: 22 }]}>{s.trainerNote}</Text>
                </Card>
              </Section>
            ) : null}

            {s.status === 'DONE' ? (
              <Section title={tx('როგორ იყო ვარჯიში?', 'How was the workout?')}>
                <Card style={{ flexDirection: 'row', justifyContent: 'center', gap: 10 }}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Pressable key={n} accessibilityRole="button" accessibilityLabel={tx(`${n} ვარსკვლავი`, `${n} ${n === 1 ? 'star' : 'stars'}`)} hitSlop={6} onPress={() => void rate(n)}>
                      <Star size={34} color="#F59E0B" fill={(s.clientRating ?? 0) >= n ? '#F59E0B' : 'transparent'} />
                    </Pressable>
                  ))}
                </Card>
              </Section>
            ) : null}
          </>
        ) : null}
      </Screen>
    </View>
  );
}
