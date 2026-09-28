import React, { useCallback, useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { CalendarPlus, CalendarRange, CheckCircle2, ChevronLeft, ChevronRight, MapPin, Repeat } from 'lucide-react-native';
import { api } from '@/lib/api';
import { localAccountId } from '@/lib/localAccount';
import { MONTH_SHORT, SESSION_STATUS_LABEL, WEEKDAY_SHORT, addDaysYmd, clockOf, tbilisiToIso, tbilisiYmd, weekDays, type CoachSession } from '@/lib/coach';
import { CoachGate, CoachShell } from '@/components/coach/CoachShell';
import { Avatar, Button, Card, IconTile, Loading, Section, coachStyles } from '@/components/coach/CoachUI';
import { FadeIn, StatusPill, haptic } from '@/components/coach/CoachKit';
import { hubText } from '@/theme/hub';
import { useIsDark, useThemeColors } from '@/theme/colors';

const MONTH_LONG = ['იანვარი', 'თებერვალი', 'მარტი', 'აპრილი', 'მაისი', 'ივნისი', 'ივლისი', 'აგვისტო', 'სექტემბერი', 'ოქტომბერი', 'ნოემბერი', 'დეკემბერი'];

export default function CoachCalendarScreen() {
  const router = useRouter();
  const c = useThemeColors();
  const dark = useIsDark();
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
  const list = [...(byDay.get(day) ?? [])].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const shiftRef = useRef<(weeks: number) => void>(() => undefined);
  const shift = (weeks: number) => {
    haptic.tap();
    const next = addDaysYmd(anchor, weeks * 7);
    const wk = weekDays(next);
    setAnchor(next);
    setDay(wk[0] <= today && today <= wk[6] ? today : wk[0]);
    setSessions(null);
  };
  shiftRef.current = shift;
  // Swipe the week strip left/right to change weeks (the arrows stay for accessibility).
  const swipe = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 18 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
        onPanResponderRelease: (_e, g) => {
          if (g.dx < -50) shiftRef.current(1);
          else if (g.dx > 50) shiftRef.current(-1);
        },
      }),
    [],
  );

  const d0 = new Date(`${days[0]}T12:00:00Z`);
  const d6 = new Date(`${days[6]}T12:00:00Z`);
  const monthTitle = d0.getUTCMonth() === d6.getUTCMonth() ? `${MONTH_LONG[d0.getUTCMonth()]} ${d0.getUTCFullYear()}` : `${MONTH_SHORT[d0.getUTCMonth()]} – ${MONTH_SHORT[d6.getUTCMonth()]} ${d6.getUTCFullYear()}`;
  const weekCount = (sessions ?? []).filter((s) => s.status === 'SCHEDULED' && s.clientId).length;
  const selected = new Date(`${day}T12:00:00Z`);

  return (
    <CoachShell
      title="კალენდარი"
      subtitle={`${d0.getUTCDate()} ${MONTH_SHORT[d0.getUTCMonth()]} – ${d6.getUTCDate()} ${MONTH_SHORT[d6.getUTCMonth()]}${sessions ? ` · ${weekCount} ვარჯიში` : ''}`}
      right={
        <Pressable accessibilityRole="button" accessibilityLabel="ვარჯიშის დანიშვნა" onPress={() => router.push(`/coach/session-new?date=${day}` as never)} style={st.addBtn}>
          <CalendarPlus size={22} color="#FFFFFF" />
        </Pressable>
      }
    >
      <CoachGate error={error} />
      <Card style={{ marginTop: 16, paddingHorizontal: 10, paddingVertical: 12 }}>
        <View style={[coachStyles.rowBetween, { paddingHorizontal: 6 }]}>
          <Pressable accessibilityRole="button" accessibilityLabel="წინა კვირა" onPress={() => shift(-1)} hitSlop={8} style={[st.navBtn, { backgroundColor: c.bg200 }]}>
            <ChevronLeft size={20} color={c.text100} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={anchor !== today ? 'დღევანდელ კვირაზე დაბრუნება' : monthTitle}
            disabled={anchor === today}
            onPress={() => {
              haptic.tap();
              setAnchor(today);
              setDay(today);
              setSessions(null);
            }}
            style={{ alignItems: 'center', minHeight: 40, justifyContent: 'center' }}
          >
            <Text style={[hubText.cardTitle, { color: c.text100 }]}>{monthTitle}</Text>
            {anchor !== today ? <Text style={[hubText.small, { color: c.primary200, fontFamily: 'NotoSansGeorgian_600SemiBold' }]}>დღევანდელ კვირაზე</Text> : null}
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="შემდეგი კვირა" onPress={() => shift(1)} hitSlop={8} style={[st.navBtn, { backgroundColor: c.bg200 }]}>
            <ChevronRight size={20} color={c.text100} />
          </Pressable>
        </View>
        <View {...swipe.panHandlers} style={{ flexDirection: 'row', gap: 4, marginTop: 12 }}>
          {days.map((d) => {
            const date = new Date(`${d}T12:00:00Z`);
            const items = (byDay.get(d) ?? []).filter((s) => s.status !== 'CANCELLED');
            const isSel = d === day;
            const isToday = d === today;
            return (
              <Pressable
                key={d}
                accessibilityRole="button"
                accessibilityState={{ selected: isSel }}
                accessibilityLabel={`${WEEKDAY_SHORT[date.getUTCDay()]} ${date.getUTCDate()}, ${items.length} ვარჯიში`}
                onPress={() => {
                  if (!isSel) haptic.tap();
                  setDay(d);
                }}
                style={[st.day, { backgroundColor: isSel ? '#0D9488' : 'transparent', borderColor: isToday && !isSel ? '#14B8A6' : 'transparent' }]}
              >
                <Text style={[hubText.small, { color: isSel ? '#CCFBF1' : c.text300 }]}>{WEEKDAY_SHORT[date.getUTCDay()]}</Text>
                <Text style={[st.dayNum, { color: isSel ? '#FFFFFF' : d < today ? c.text300 : c.text100 }]}>{date.getUTCDate()}</Text>
                <View style={{ flexDirection: 'row', gap: 2, height: 6 }}>
                  {items.slice(0, 4).map((s) => (
                    <View key={s.id} style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: isSel ? '#FFFFFF' : s.status === 'DONE' ? c.success : s.clientId ? '#14B8A6' : c.text300 }} />
                  ))}
                </View>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Section title={day === today ? 'დღეს' : `${WEEKDAY_SHORT[selected.getUTCDay()]}, ${selected.getUTCDate()} ${MONTH_SHORT[selected.getUTCMonth()]}`} link={list.length && day >= today ? 'დამატება' : undefined} onLink={() => router.push(`/coach/session-new?date=${day}` as never)}>
        {!sessions && !error ? <Loading rows={2} /> : null}
        {sessions && !list.length ? (
          <Card style={{ gap: 12, alignItems: 'center', paddingVertical: 24 }}>
            <IconTile icon={CalendarRange} ink="neutral" size={48} />
            <Text style={[hubText.cardTitle, { color: c.text100 }]}>{day < today ? 'ამ დღეს ვარჯიში არ ყოფილა' : 'თავისუფალი დღე'}</Text>
            {day >= today ? (
              <>
                <Text style={[hubText.body, { color: c.text300, textAlign: 'center' }]}>დანიშნე ვარჯიში ან გახსენი სლოტი, რომელსაც კლიენტი თავად დაჯავშნის.</Text>
                <Button label="დანიშვნა ამ დღეს" icon={CalendarPlus} style={{ alignSelf: 'stretch' }} onPress={() => router.push(`/coach/session-new?date=${day}` as never)} />
              </>
            ) : null}
          </Card>
        ) : null}
        <View style={{ gap: 10 }}>
          {list.map((s, i) => {
            const cancelled = s.status === 'CANCELLED';
            const stripe = cancelled ? c.bg300 : s.status === 'DONE' ? c.success : s.status === 'NO_SHOW' ? c.danger : s.clientId ? '#14B8A6' : dark ? '#6B7280' : '#9CA3AF';
            return (
              <FadeIn key={s.id} delay={Math.min(i, 5) * 40}>
                <Card onPress={() => router.push(`/coach/session/${s.id}` as never)} style={{ flexDirection: 'row', padding: 0, overflow: 'hidden', opacity: cancelled ? 0.7 : 1 }} accessibilityLabel={`${clockOf(s.startsAt)}, ${s.clientName ?? 'თავისუფალი სლოტი'}, ${SESSION_STATUS_LABEL[s.status]}`}>
                  <View style={{ width: 5, backgroundColor: stripe }} />
                  <View style={[coachStyles.row, { flex: 1, padding: 14, gap: 12 }]}>
                    <View style={{ width: 50 }}>
                      <Text style={[st.time, { color: c.text100 }]}>{clockOf(s.startsAt)}</Text>
                      <Text style={[hubText.small, { color: c.text300 }]}>{s.durationMin} წთ</Text>
                    </View>
                    {s.clientId ? <Avatar avatarId={s.clientAvatarId} photoUrl={s.clientAvatarUrl} name={s.clientName ?? '?'} size={40} /> : null}
                    <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                      <Text numberOfLines={1} style={[hubText.cardTitle, { color: cancelled ? c.text300 : c.text100, textDecorationLine: cancelled ? 'line-through' : 'none' }]}>{s.clientName ?? 'თავისუფალი სლოტი'}</Text>
                      <View style={[coachStyles.row, { gap: 5 }]}>
                        {s.gym ? <MapPin size={12} color={c.text300} /> : null}
                        <Text numberOfLines={1} style={[hubText.caption, { color: c.text300, flex: 1 }]}>
                          {s.kindLabel}
                          {s.gym ? ` · ${s.gym.brand}` : ''}
                        </Text>
                        {s.seriesId && s.seriesId !== 'slot' ? <Repeat size={12} color={c.text300} accessibilityLabel="ყოველკვირეული" /> : null}
                      </View>
                    </View>
                    {s.status === 'SCHEDULED' && s.clientConfirmedAt ? (
                      <CheckCircle2 size={20} color={c.success} accessibilityLabel="დადასტურებულია" />
                    ) : (
                      <StatusPill label={cancelled && s.lateCancel ? 'გვიან გაუქმდა' : SESSION_STATUS_LABEL[s.status]} tone={s.status === 'DONE' ? 'ok' : s.status === 'OPEN' ? 'brand' : s.status === 'SCHEDULED' ? 'neutral' : 'bad'} />
                    )}
                  </View>
                </Card>
              </FadeIn>
            );
          })}
        </View>
      </Section>
    </CoachShell>
  );
}

const st = StyleSheet.create({
  addBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#0D9488', alignItems: 'center', justifyContent: 'center' },
  navBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  day: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 16, gap: 2, borderWidth: 1.5, minHeight: 64 },
  dayNum: { fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 17, lineHeight: 24 },
  time: { fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 16, lineHeight: 22 },
});
