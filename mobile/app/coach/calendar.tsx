import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { CalendarPlus, ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react-native';
import { api } from '@/lib/api';
import { localAccountId } from '@/lib/localAccount';
import { MONTH_SHORT, SESSION_STATUS_LABEL, WEEKDAY_SHORT, addDaysYmd, clockOf, tbilisiToIso, tbilisiYmd, weekDays, type CoachSession } from '@/lib/coach';
import { CoachGate, CoachShell } from '@/components/coach/CoachShell';
import { Avatar, Badge, Button, Card, Loading, Section, coachStyles } from '@/components/coach/CoachUI';
import { hubText } from '@/theme/hub';
import { useThemeColors } from '@/theme/colors';

export default function CoachCalendarScreen() {
  const router = useRouter();
  const c = useThemeColors();
  const today = tbilisiYmd();
  const [anchor, setAnchor] = useState(today);
  const [day, setDay] = useState(today);
  const [sessions, setSessions] = useState<CoachSession[] | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const days = useMemo(() => weekDays(anchor), [anchor]);

  const load = useCallback(async () => {
    const owner = localAccountId();
    try {
      const res = await api.coach.sessions(tbilisiToIso(days[0], '00:00'), tbilisiToIso(addDaysYmd(days[6], 1), '00:00'));
      if (localAccountId() === owner) {
        setSessions(res.sessions);
        setError(null);
      }
    } catch (e) {
      setError(e as Error);
    }
  }, [days]);
  useFocusEffect(useCallback(() => void load(), [load]));

  const byDay = useMemo(() => {
    const m = new Map<string, CoachSession[]>();
    for (const s of sessions ?? []) {
      const d = tbilisiYmd(s.startsAt);
      m.set(d, [...(m.get(d) ?? []), s]);
    }
    return m;
  }, [sessions]);
  const list = (byDay.get(day) ?? []).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const shift = (weeks: number) => {
    const next = addDaysYmd(anchor, weeks * 7);
    setAnchor(next);
    setDay(weekDays(next)[0] <= today && today <= weekDays(next)[6] ? today : weekDays(next)[0]);
    setSessions(null);
  };
  const d0 = new Date(`${days[0]}T12:00:00Z`);
  const d6 = new Date(`${days[6]}T12:00:00Z`);

  return (
    <CoachShell
      title="კალენდარი"
      subtitle={`${d0.getUTCDate()} ${MONTH_SHORT[d0.getUTCMonth()]} – ${d6.getUTCDate()} ${MONTH_SHORT[d6.getUTCMonth()]} · ${(sessions ?? []).filter((s) => s.status === 'SCHEDULED').length} ვარჯიში`}
      right={
        <Pressable accessibilityRole="button" accessibilityLabel="ვარჯიშის დანიშვნა" onPress={() => router.push(`/coach/session-new?date=${day}` as never)} style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: '#0D9488', alignItems: 'center', justifyContent: 'center' }}>
          <CalendarPlus size={22} color="#FFFFFF" />
        </Pressable>
      }
    >
      <CoachGate error={error} />
      <View style={[coachStyles.rowBetween, { marginTop: 16 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="წინა კვირა" onPress={() => shift(-1)} hitSlop={10} style={{ padding: 6 }}>
          <ChevronLeft size={22} color={c.text100} />
        </Pressable>
        {anchor !== today ? (
          <Pressable accessibilityRole="button" onPress={() => { setAnchor(today); setDay(today); setSessions(null); }}>
            <Text style={[hubText.link, { color: c.primary100 }]}>დღევანდელ კვირაზე</Text>
          </Pressable>
        ) : (
          <Text style={[hubText.caption, { color: c.text300 }]}>ეს კვირა</Text>
        )}
        <Pressable accessibilityRole="button" accessibilityLabel="შემდეგი კვირა" onPress={() => shift(1)} hitSlop={10} style={{ padding: 6 }}>
          <ChevronRight size={22} color={c.text100} />
        </Pressable>
      </View>
      <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
        {days.map((d) => {
          const date = new Date(`${d}T12:00:00Z`);
          const n = (byDay.get(d) ?? []).filter((s) => s.status === 'SCHEDULED').length;
          const selected = d === day;
          return (
            <Pressable
              key={d}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`${WEEKDAY_SHORT[date.getUTCDay()]} ${date.getUTCDate()}, ${n} ვარჯიში`}
              onPress={() => setDay(d)}
              style={{ flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 16, backgroundColor: selected ? '#0D9488' : c.surface, gap: 2 }}
            >
              <Text style={[hubText.small, { color: selected ? '#CCFBF1' : c.text300 }]}>{WEEKDAY_SHORT[date.getUTCDay()]}</Text>
              <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 17, color: selected ? '#FFFFFF' : d === today ? c.primary100 : c.text100 }}>{date.getUTCDate()}</Text>
              <View style={{ flexDirection: 'row', gap: 2, height: 6 }}>
                {Array.from({ length: Math.min(n, 4) }).map((_, i) => (
                  <View key={i} style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: selected ? '#FFFFFF' : '#14B8A6' }} />
                ))}
              </View>
            </Pressable>
          );
        })}
      </View>

      <Section title={day === today ? 'დღეს' : `${WEEKDAY_SHORT[new Date(`${day}T12:00:00Z`).getUTCDay()]}, ${Number(day.slice(8))} ${MONTH_SHORT[Number(day.slice(5, 7)) - 1]}`}>
        {!sessions && !error ? <Loading /> : null}
        {sessions && !list.length ? (
          <Card style={{ gap: 10 }}>
            <Text style={[hubText.body, { color: c.text200 }]}>ამ დღეს ვარჯიში არ არის.</Text>
            {day >= today ? <Button label="დანიშვნა ამ დღეს" icon={CalendarPlus} onPress={() => router.push(`/coach/session-new?date=${day}` as never)} /> : null}
          </Card>
        ) : null}
        {list.map((s) => (
          <Card key={s.id} onPress={() => router.push(`/coach/session/${s.id}` as never)} style={{ marginBottom: 10 }} accessibilityLabel={`${clockOf(s.startsAt)}, ${s.clientName ?? 'თავისუფალი სლოტი'}`}>
            <View style={coachStyles.row}>
              <View style={{ width: 54 }}>
                <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 17, color: c.text100 }}>{clockOf(s.startsAt)}</Text>
                <Text style={[hubText.small, { color: c.text300 }]}>{s.durationMin} წთ</Text>
              </View>
              {s.clientId ? <Avatar avatarId={s.clientAvatarId} photoUrl={s.clientAvatarUrl} name={s.clientName ?? '?'} size={38} /> : null}
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Text numberOfLines={1} style={[hubText.cardTitle, { color: s.status === 'CANCELLED' ? c.text300 : c.text100, textDecorationLine: s.status === 'CANCELLED' ? 'line-through' : 'none' }]}>{s.clientName ?? 'თავისუფალი სლოტი'}</Text>
                <Text numberOfLines={1} style={[hubText.caption, { color: c.text300 }]}>
                  {s.kindLabel}
                  {s.gym ? ` · ${s.gym.brand} ${s.gym.name}` : ''}
                  {s.seriesId && s.seriesId !== 'slot' ? ' · ყოველკვირეული' : ''}
                </Text>
              </View>
              {s.status === 'SCHEDULED' && s.clientConfirmedAt ? (
                <CheckCircle2 size={20} color={c.success} />
              ) : (
                <Badge label={s.status === 'CANCELLED' && s.lateCancel ? 'გვიან გაუქმდა' : SESSION_STATUS_LABEL[s.status]} tone={s.status === 'DONE' ? 'ok' : s.status === 'OPEN' ? 'brand' : s.status === 'SCHEDULED' ? 'neutral' : 'bad'} />
              )}
            </View>
          </Card>
        ))}
      </Section>
    </CoachShell>
  );
}
