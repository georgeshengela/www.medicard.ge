import React, { useCallback, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { CalendarClock, ChevronRight } from 'lucide-react-native';
import { api, ApiError } from '@/lib/api';
import { localAccountId } from '@/lib/localAccount';
import { SESSION_STATUS_LABEL, clockOf, dayLabel, tbilisiYmd, type ClientOverview, type CoachSession } from '@/lib/coach';
import { Badge, Button, Card, CoachHeader, EmptyNote, ErrorBox, Loading, Screen, Section, coachStyles } from '@/components/coach/CoachUI';
import { hubText } from '@/theme/hub';
import { useThemeColors } from '@/theme/colors';

function SessionRow({ s, onPress, action }: { s: CoachSession; onPress?: () => void; action?: React.ReactNode }) {
  const c = useThemeColors();
  const tone = s.status === 'DONE' ? 'ok' : s.status === 'CANCELLED' || s.status === 'NO_SHOW' ? 'bad' : s.clientConfirmedAt ? 'brand' : 'neutral';
  return (
    <Card onPress={onPress} style={{ gap: 10, marginBottom: 10 }} accessibilityLabel={`${s.label}, ${s.kindLabel}, ${SESSION_STATUS_LABEL[s.status]}`}>
      <View style={coachStyles.row}>
        <View style={{ width: 56, alignItems: 'center' }}>
          <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 18, color: c.text100 }}>{clockOf(s.startsAt)}</Text>
          <Text style={[hubText.small, { color: c.text300 }]}>{s.durationMin} წთ</Text>
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={[hubText.cardTitle, { color: c.text100 }]}>
            {dayLabel(tbilisiYmd(s.startsAt))} · {s.kindLabel}
          </Text>
          {s.gym ? <Text numberOfLines={1} style={[hubText.caption, { color: c.text300 }]}>{s.gym.brand} · {s.gym.name}</Text> : null}
          <Badge label={s.status === 'SCHEDULED' && s.clientConfirmedAt ? 'დადასტურებული' : SESSION_STATUS_LABEL[s.status]} tone={tone} />
        </View>
        {onPress ? <ChevronRight size={18} color={c.text300} /> : null}
      </View>
      {action}
    </Card>
  );
}

export default function ClientSessionsScreen() {
  const router = useRouter();
  const c = useThemeColors();
  const [ov, setOv] = useState<ClientOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const owner = localAccountId();
    try {
      const o = await api.coach.overview();
      if (localAccountId() === owner) setOv(o);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'ჩატვირთვა ვერ მოხერხდა.');
    }
  }, []);
  useFocusEffect(useCallback(() => void load(), [load]));

  const run = async (id: string, fn: () => Promise<unknown>) => {
    setBusy(id);
    try {
      await fn();
      await load();
    } catch (e) {
      Alert.alert('ვერ მოხერხდა', e instanceof ApiError ? e.message : 'სცადე ხელახლა.');
    } finally {
      setBusy(null);
    }
  };

  const upcoming = (ov?.upcoming ?? []).filter((s) => s.status === 'SCHEDULED');
  const cancelled = (ov?.upcoming ?? []).filter((s) => s.status === 'CANCELLED');
  return (
    <View style={{ flex: 1, backgroundColor: c.bg100 }}>
      <CoachHeader title="ვარჯიშები" subtitle={ov?.trainer?.displayName} fallback="/trainer" />
      <Screen>
        {error ? <ErrorBox message={error} onRetry={load} /> : null}
        {!ov && !error ? <Loading /> : null}
        {ov ? (
          <>
            <Section title="მომავალი" style={{ marginTop: 8 }}>
              {upcoming.length ? (
                upcoming.map((s) => (
                  <SessionRow
                    key={s.id}
                    s={s}
                    action={
                      <View style={[coachStyles.row, { gap: 10 }]}>
                        {!s.clientConfirmedAt ? <Button label="მოვალ ✓" style={{ flex: 1, minHeight: 44 }} busy={busy === `c${s.id}`} onPress={() => void run(`c${s.id}`, () => api.coach.confirm(s.id))} /> : null}
                        <Button
                          label="გაუქმება"
                          kind="secondary"
                          style={{ flex: 1, minHeight: 44 }}
                          onPress={() =>
                            Alert.alert('ვარჯიშის გაუქმება', s.label, [
                              { text: 'არა', style: 'cancel' },
                              { text: 'გაუქმება', style: 'destructive', onPress: () => void run(`x${s.id}`, () => api.coach.cancel(s.id)) },
                            ])
                          }
                        />
                      </View>
                    }
                  />
                ))
              ) : (
                <Card>
                  <EmptyNote icon={CalendarClock} title="დაგეგმილი ვარჯიში არ არის" body="როცა ტრენერი ჩაგწერს, აქ გამოჩნდება და შეხსენება 24 და 1 საათით ადრე მოგივა." />
                </Card>
              )}
            </Section>
            {ov.past?.length ? (
              <Section title="ჩატარებული">
                {ov.past.map((s) => (
                  <SessionRow key={s.id} s={s} onPress={() => router.push(`/trainer/session/${s.id}` as never)} />
                ))}
              </Section>
            ) : null}
            {cancelled.length ? (
              <Section title="გაუქმებული">
                {cancelled.map((s) => (
                  <SessionRow key={s.id} s={s} />
                ))}
              </Section>
            ) : null}
          </>
        ) : null}
      </Screen>
    </View>
  );
}
