import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { ChevronLeft, ChevronRight, Zap } from 'lucide-react-native';
import { FlatCard } from '@/components/book/BookUI';
import { ChosenPills, FlowHeader, StepBar, StepTitle, bundleLine, monthName, serviceParams, useBookingFlow } from '@/components/book/BookFlow';
import { Button } from '@/components/ui/Button';
import { RecordsPageSkeleton } from '@/components/ui/Skeleton';
import { tx } from '@/i18n/locale';
import { api } from '@/lib/api';
import { addDays, dateFromYmd, dayLabel, durationLabel, weekdayShort, ymdLocal } from '@/lib/book/bookFormat';
import type { BookAvailability, BookDayStrip, BookSlot } from '@/lib/book/bookTypes';
import { HUB, hubText } from '@/theme/hub';
import { useIsDark, useThemeColors } from '@/theme/colors';
import { moduleInk } from '@/theme/moduleBrand';

type Day = { date: string; count: number; closed: boolean };

/**
 * Step „როდის“ — the way Fresha, Booksy and Treatwell do it: a week strip you page through (a dot under
 * every day that still has free time), the free times of the chosen day right under it in three parts of
 * the day, the earliest free time offered first, and one Continue button in the thumb zone once a time
 * is picked. Day and time are one decision, so they live on one page.
 */
export default function BookWhenStep() {
  const c = useThemeColors();
  const dark = useIsDark();
  const ink = moduleInk('book', dark);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { b, query, service, serviceIds, serviceKey, selected, bundle, staffId, person, params, steps, go } = useBookingFlow();
  const [strip, setStrip] = useState<BookDayStrip | null>(null);
  const [stripFailed, setStripFailed] = useState(false);
  const [date, setDate] = useState<string | null>(params.date ? String(params.date) : null);
  const [slots, setSlots] = useState<BookAvailability | null>(null);
  const [slot, setSlot] = useState<BookSlot | null>(null);
  const [earliest, setEarliest] = useState<{ date: string; slot: BookSlot } | null | undefined>(undefined);
  const [week, setWeek] = useState(0);
  const stripRef = useRef<ScrollView>(null);
  const pageWidth = width - HUB.gutter * 2;

  // The days the business takes bookings for, from today.
  useEffect(() => {
    if (!b || !service) return;
    let alive = true;
    setStrip(null);
    setStripFailed(false);
    setEarliest(undefined);
    api.book.days(b.id, { ...serviceParams(serviceIds), staffId, days: Math.min(60, Math.max(14, b.settings.horizonDays || 30)) })
      .then(async (res) => {
        if (!alive) return;
        setStrip(res);
        const firstFree = res.days.find((d) => d.count > 0) ?? null;
        if (!date || !res.days.some((d) => d.date === date && d.count > 0)) setDate(firstFree?.date ?? res.days[0]?.date ?? ymdLocal());
        if (!firstFree) { setEarliest(null); return; }
        try {
          const av = await api.book.availability(b.id, { ...serviceParams(serviceIds), date: firstFree.date, staffId });
          if (alive) setEarliest(av.slots[0] ? { date: firstFree.date, slot: av.slots[0] } : null);
        } catch { if (alive) setEarliest(null); }
      })
      .catch(() => alive && setStripFailed(true));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [b?.id, serviceKey, staffId]);

  // The free times of the chosen day.
  useEffect(() => {
    if (!b || !service || !date) return;
    let alive = true;
    setSlots(null);
    setSlot(null);
    api.book.availability(b.id, { ...serviceParams(serviceIds), date, staffId })
      .then((res) => alive && setSlots(res))
      .catch(() => alive && setSlots({ date, serviceId: service.id, durationMin: bundle.durationMin, slots: [], closed: false, reason: 'error' }));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [b, serviceKey, date, staffId]);

  // Weeks of seven, Monday first, from the week that holds today.
  const weeks = useMemo(() => {
    const days = strip?.days ?? [];
    if (!days.length) return [] as Day[][];
    const byDate = new Map(days.map((d) => [d.date, d]));
    const first = dateFromYmd(days[0].date);
    const start = addDays(days[0].date, -((first.getDay() + 6) % 7));
    const last = days[days.length - 1].date;
    const out: Day[][] = [];
    let cursor = start;
    while (cursor <= last) {
      const row: Day[] = [];
      for (let i = 0; i < 7; i += 1) { const d = addDays(cursor, i); row.push(byDate.get(d) ?? { date: d, count: -1, closed: true }); }
      out.push(row);
      cursor = addDays(cursor, 7);
    }
    return out;
  }, [strip]);

  useEffect(() => {
    if (!date || !weeks.length) return;
    const idx = weeks.findIndex((w) => w.some((d) => d.date === date));
    if (idx >= 0 && idx !== week) { setWeek(idx); stripRef.current?.scrollTo({ x: idx * pageWidth, animated: true }); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weeks.length]);

  const goWeek = (idx: number) => {
    const next = Math.max(0, Math.min(weeks.length - 1, idx));
    setWeek(next);
    stripRef.current?.scrollTo({ x: next * pageWidth, animated: true });
  };
  const monthOfWeek = (row: Day[] | undefined) => {
    if (!row) return '';
    const mid = dateFromYmd(row[3].date);
    const firstD = dateFromYmd(row[0].date);
    const lastD = dateFromYmd(row[6].date);
    return firstD.getMonth() === lastD.getMonth() ? `${monthName(mid.getMonth())} ${mid.getFullYear()}` : `${monthName(firstD.getMonth())} – ${monthName(lastD.getMonth())} ${lastD.getFullYear()}`;
  };

  const groups = useMemo(() => {
    const out: Array<{ label: string; items: BookSlot[] }> = [
      { label: tx('დილა', 'Morning'), items: [] }, { label: tx('დღე', 'Afternoon'), items: [] }, { label: tx('საღამო', 'Evening'), items: [] },
    ];
    for (const sl of slots?.slots ?? []) {
      const h = Number(sl.time.split(':')[0]);
      (h < 12 ? out[0] : h < 17 ? out[1] : out[2]).items.push(sl);
    }
    return out.filter((g) => g.items.length);
  }, [slots]);
  const freeDays = useMemo(() => (strip?.days ?? []).filter((d) => d.count > 0).length, [strip]);

  const pickDay = (d: Day) => {
    if (d.count <= 0) return;
    void Haptics.selectionAsync().catch(() => undefined);
    setDate(d.date);
  };
  const pickSlot = (sl: BookSlot) => {
    void Haptics.selectionAsync().catch(() => undefined);
    setSlot(sl);
  };
  const takeEarliest = () => {
    if (!earliest) return;
    void Haptics.selectionAsync().catch(() => undefined);
    if (earliest.date !== date) setDate(earliest.date);
    setSlot(earliest.slot);
    go('confirm', { date: earliest.date, startsAt: earliest.slot.startsAt, time: earliest.slot.time, pick: staffId || (earliest.slot.staffIds.length === 1 ? earliest.slot.staffIds[0] : '') });
  };
  const next = () => {
    if (!slot || !date) return;
    go('confirm', { date, startsAt: slot.startsAt, time: slot.time, pick: staffId || (slot.staffIds.length === 1 ? slot.staffIds[0] : '') });
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg100 }}>
      <FlowHeader b={b} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: HUB.gutter, paddingBottom: insets.bottom + 120 }} showsVerticalScrollIndicator={false}>
        <StepBar steps={steps} current="when" />
        {!b || !service ? (
          query.isError ? <Text style={[hubText.body, { color: c.text200 }]}>{tx('ბიზნესი ვერ მოიძებნა.', 'Business not found.')}</Text> : <RecordsPageSkeleton />
        ) : (
          <>
            <StepTitle title={tx('როდის?', 'When?')} sub={strip ? (freeDays ? tx(`${freeDays} დღეა თავისუფალი დროებით — წერტილი დღის ქვეშ.`, `${freeDays} days with free time — a dot under the day.`) : tx('ახლო დღეებში თავისუფალი დრო არ ჩანს.', 'No free time in the coming days.')) : tx('თავისუფალ დღეებს ვეძებ…', 'Looking for free days…')} />
            <ChosenPills items={[...selected.map((x) => x.name), person ? person.name : staffId ? null : tx('ნებისმიერი', 'Anyone')]} />

            {earliest ? (
              <Pressable accessibilityRole="button" onPress={takeEarliest} style={[s.earliest, { backgroundColor: c.surface, borderColor: ink }]}>
                <View style={[s.zap, { borderColor: ink }]}><Zap size={16} color={ink} strokeWidth={2.2} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={[hubText.cardTitle, { color: c.text100 }]}>{tx('ყველაზე ახლო თავისუფალი დრო', 'Earliest free time')}</Text>
                  <Text style={[hubText.caption, { color: c.text200 }]}>{dayLabel(dateFromYmd(earliest.date))} · {earliest.slot.time}</Text>
                </View>
                <Text style={[hubText.small, { color: ink, fontFamily: 'NotoSansGeorgian_600SemiBold' }]}>{tx('ავიღოთ', 'Take it')}</Text>
              </Pressable>
            ) : null}

            {stripFailed ? (
              <FlatCard style={{ padding: 16 }}><Text style={[hubText.body, { color: c.text200 }]}>{tx('თავისუფალი დღეები ვერ ჩაიტვირთა. სცადე ხელახლა.', 'Free days could not load. Please try again.')}</Text></FlatCard>
            ) : !strip ? (
              <RecordsPageSkeleton />
            ) : (
              <FlatCard style={{ paddingVertical: 12 }}>
                <View style={[s.monthRow, { paddingHorizontal: 8 }]}>
                  <Pressable accessibilityRole="button" accessibilityLabel={tx('წინა კვირა', 'Previous week')} disabled={week <= 0} onPress={() => goWeek(week - 1)} style={[s.navBtn, { opacity: week <= 0 ? 0.3 : 1 }]}><ChevronLeft size={20} color={c.text100} /></Pressable>
                  <Text style={[hubText.cardTitle, { color: c.text100 }]}>{monthOfWeek(weeks[week])}</Text>
                  <Pressable accessibilityRole="button" accessibilityLabel={tx('შემდეგი კვირა', 'Next week')} disabled={week >= weeks.length - 1} onPress={() => goWeek(week + 1)} style={[s.navBtn, { opacity: week >= weeks.length - 1 ? 0.3 : 1 }]}><ChevronRight size={20} color={c.text100} /></Pressable>
                </View>
                <ScrollView
                  ref={stripRef}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onMomentumScrollEnd={(e) => setWeek(Math.round(e.nativeEvent.contentOffset.x / pageWidth))}
                  contentOffset={{ x: week * pageWidth, y: 0 }}
                >
                  {weeks.map((row, wi) => (
                    <View key={wi} style={{ width: pageWidth, flexDirection: 'row', paddingHorizontal: 6 }}>
                      {row.map((d) => {
                        const on = d.date === date;
                        const free = d.count > 0;
                        const dt = dateFromYmd(d.date);
                        const isToday = d.date === ymdLocal();
                        return (
                          <Pressable
                            key={d.date}
                            accessibilityRole="button"
                            accessibilityState={{ selected: on, disabled: !free }}
                            accessibilityLabel={`${dayLabel(dt)}${free ? tx(`, ${d.count} თავისუფალი დრო`, `, ${d.count} free slots`) : d.count === 0 ? tx(', თავისუფალი დრო არ არის', ', no free time') : tx(', არ იწერება', ', not open')}`}
                            disabled={!free}
                            onPress={() => pickDay(d)}
                            style={[s.day, { backgroundColor: on ? ink : 'transparent' }]}
                          >
                            <Text style={[hubText.small, { color: on ? '#fff' : c.text300 }]}>{weekdayShort(dt)}</Text>
                            <View style={[s.dayNum, isToday && !on ? { borderWidth: 1, borderColor: ink } : null]}>
                              <Text style={[hubText.value, { color: on ? '#fff' : free ? c.text100 : c.text300, fontSize: 16, opacity: free || on ? 1 : 0.5 }]}>{dt.getDate()}</Text>
                            </View>
                            <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: free ? (on ? '#fff' : ink) : 'transparent' }} />
                          </Pressable>
                        );
                      })}
                    </View>
                  ))}
                </ScrollView>
              </FlatCard>
            )}

            {date ? (
              <View style={{ marginTop: HUB.sectionGap }}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
                  <Text style={[hubText.sectionTitle, { color: c.text100 }]}>{dayLabel(dateFromYmd(date))}</Text>
                  <Text style={[hubText.caption, { color: c.text300 }]}>{slots ? tx(`${slots.slots.length} თავისუფალი დრო · ${durationLabel(bundle.durationMin)}`, `${slots.slots.length} free · ${durationLabel(bundle.durationMin)}`) : ''}</Text>
                </View>
                {!slots ? (
                  <RecordsPageSkeleton />
                ) : !slots.slots.length ? (
                  <FlatCard style={{ padding: 16, gap: 10 }}>
                    <Text style={[hubText.body, { color: c.text200 }]}>
                      {slots.reason === 'closed' ? tx('ამ დღეს დახურულია.', 'Closed on this day.')
                        : slots.reason === 'horizon' ? tx('ასე შორს ჯერ არ იწერენ.', 'Bookings do not open that far ahead yet.')
                          : slots.reason === 'error' ? tx('დროები ვერ ჩაიტვირთა. სცადე ხელახლა.', 'Times could not load. Please try again.')
                            : tx('ამ დღეს თავისუფალი დრო აღარ დარჩა — აირჩიე სხვა დღე ზემოთ.', 'No free time left on this day — pick another day above.')}
                    </Text>
                  </FlatCard>
                ) : groups.map((g) => (
                  <View key={g.label} style={{ marginBottom: 12 }}>
                    <Text style={[hubText.caption, { color: c.text300, marginBottom: 8, marginLeft: 4 }]}>{g.label}</Text>
                    <View style={s.grid}>
                      {g.items.map((sl) => {
                        const on = slot?.startsAt === sl.startsAt;
                        return (
                          <Pressable key={sl.startsAt} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={tx(`${sl.time}, თავისუფალია`, `${sl.time}, free`)} onPress={() => pickSlot(sl)} style={[s.slot, { backgroundColor: on ? ink : c.surface, borderColor: on ? ink : c.bg300 }]}>
                            <Text style={[hubText.value, { color: on ? '#fff' : c.text100, fontSize: 15 }]}>{sl.time}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                ))}
              </View>
            ) : null}
          </>
        )}
      </ScrollView>

      {b && service ? (
        <View style={[s.footer, { paddingBottom: insets.bottom + 12, backgroundColor: c.bg100, borderTopColor: c.bg200 }]}>
          <Text style={[hubText.caption, { color: slot ? c.text100 : c.text300, textAlign: 'center', marginBottom: 8 }]}>
            {slot && date ? `${dayLabel(dateFromYmd(date))} · ${slot.time} · ${bundleLine(bundle)}` : tx('აირჩიე დღე და დრო', 'Pick a day and a time')}
          </Text>
          <Button label={tx('გაგრძელება', 'Continue')} size="lg" onPress={next} disabled={!slot} />
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  earliest: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: HUB.cardRadius, borderWidth: 1, marginBottom: 12 },
  zap: { width: 36, height: 36, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  navBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  day: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 8, borderRadius: 14, minHeight: 72 },
  dayNum: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slot: { width: '31%', flexGrow: 1, minHeight: 48, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: HUB.gutter, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
});
