import React, { useMemo, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BellRing, CalendarPlus, Search, X } from 'lucide-react-native';
import { ModuleHeader, ModuleHeaderButton } from '@/components/brand/ModuleHeader';
import { AppointmentRow, FlatCard } from '@/components/book/BookUI';
import { ListRowsSkeleton } from '@/components/ui/Skeleton';
import { useAccountQuery } from '@/hooks/useAccountQuery';
import { tx } from '@/i18n/locale';
import { api } from '@/lib/api';
import { dateFromYmd, dayLabel, monthDay, whenLabel, ymdLocal } from '@/lib/book/bookFormat';
import type { BookAppointment, BookWaitlistEntry } from '@/lib/book/bookTypes';
import { FRESH, invalidate } from '@/lib/queryClient';
import { HUB, hubText } from '@/theme/hub';
import { useIsDark, useThemeColors } from '@/theme/colors';
import { moduleInk } from '@/theme/moduleBrand';

/** „ჩემი ჯავშნები“: everything ahead grouped by day, then the past (completed, cancelled, missed) — one tap opens a booking. */
export default function MyBookingsScreen() {
  const c = useThemeColors();
  const dark = useIsDark();
  const ink = moduleInk('book', dark);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const mine = useAccountQuery({ key: ['book', 'mine'], fetch: api.book.appointments, staleTime: FRESH.SHORT });
  const waiting = useAccountQuery({ key: ['book', 'waitlist'], fetch: api.book.waitlist.list, staleTime: FRESH.SHORT });
  const openWait = useMemo(() => (waiting.data?.entries ?? []).filter((e) => e.status === 'WAITING' || e.status === 'OFFERED'), [waiting.data]);
  const upcoming = mine.data?.upcoming ?? [];
  const past = mine.data?.past ?? [];
  const list = tab === 'upcoming' ? upcoming : past;

  const groups = useMemo(() => {
    const map = new Map<string, BookAppointment[]>();
    for (const a of list) {
      const key = ymdLocal(new Date(a.startsAt));
      map.set(key, [...(map.get(key) ?? []), a]);
    }
    return [...map.entries()];
  }, [list]);

  const open = (a: BookAppointment) => router.push(`/book/appointments/${a.id}` as never);
  // An offer opens the booking flow on that day with the same services and person; leaving asks once.
  const bookOffer = (e: BookWaitlistEntry) => {
    const q: Record<string, string> = { serviceId: e.serviceIds[0] ?? e.serviceId ?? '' };
    if (e.serviceIds.length > 1) q.serviceIds = e.serviceIds.join(',');
    if (e.staffId) q.staffId = e.staffId;
    q.date = e.offeredStartsAt ? ymdLocal(new Date(e.offeredStartsAt)) : e.fromDate;
    router.push({ pathname: `/book/b/${e.businessId}/book/when`, params: q } as never);
  };
  const leave = (e: BookWaitlistEntry) => {
    Alert.alert(tx('სიიდან ამოღება?', 'Leave the list?'), `${e.serviceName} · ${e.business?.name ?? ''}`, [
      { text: tx('დარჩენა', 'Stay'), style: 'cancel' },
      { text: tx('ამოღება', 'Leave'), style: 'destructive', onPress: () => { void api.book.waitlist.cancel(e.id).then(() => invalidate('book')).catch(() => undefined); } },
    ]);
  };

  return (
    <ScrollView
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 60, paddingHorizontal: HUB.gutter }}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={mine.isRefetching} onRefresh={() => { void mine.refetch(); void waiting.refetch(); }} tintColor={c.primary200} />}
    >
      <ModuleHeader module="book" subtitle={tx('ჩემი ჯავშნები', 'My bookings')} fallbackHref="/book" right={<ModuleHeaderButton label={tx('ძებნა', 'Search')} icon={Search} onPress={() => router.push('/book/search' as never)} />} />

      <View style={[s.tabs, { backgroundColor: c.bg200, marginTop: 20 }]}>
        {(['upcoming', 'past'] as const).map((key) => {
          const on = tab === key;
          const n = key === 'upcoming' ? upcoming.length : past.length;
          return (
            <Pressable key={key} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => setTab(key)} style={[s.tab, on ? { backgroundColor: c.surface } : null]}>
              <Text style={[hubText.cardTitle, { color: on ? c.text100 : c.text200 }]}>{key === 'upcoming' ? tx('მომავალი', 'Upcoming') : tx('წარსული', 'Past')}</Text>
              {mine.data ? <Text style={[hubText.small, { color: on ? ink : c.text300 }]}>{n}</Text> : null}
            </Pressable>
          );
        })}
      </View>

      {tab === 'upcoming' && openWait.length ? (
        <View style={{ marginTop: 16 }}>
          <Text style={[hubText.caption, { color: c.text300, marginBottom: 6, marginLeft: 4 }]}>{tx('მოლოდინის სია', 'Waiting list')}</Text>
          <FlatCard>
            {openWait.map((e, i) => (
              <View key={e.id} style={[s.waitRow, i ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.bg200 } : null]}>
                <View style={[s.waitIcon, { borderColor: ink }]}><BellRing size={16} color={ink} strokeWidth={2.2} /></View>
                <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                  <Text numberOfLines={1} style={[hubText.cardTitle, { color: c.text100 }]}>{e.serviceName}</Text>
                  <Text numberOfLines={1} style={[hubText.caption, { color: c.text200 }]}>{e.business?.name ?? ''}{e.staffName ? ` · ${e.staffName}` : ''} · {e.fromDate === e.toDate ? dayLabel(dateFromYmd(e.fromDate)) : `${monthDay(e.fromDate)} – ${monthDay(e.toDate)}`}</Text>
                  {e.status === 'OFFERED' && e.offeredStartsAt ? (
                    <Pressable accessibilityRole="button" onPress={() => bookOffer(e)} style={[s.offer, { borderColor: ink }]}>
                      <Text style={[hubText.small, { color: c.text100, fontFamily: 'NotoSansGeorgian_600SemiBold' }]}>{tx('გათავისუფლდა: ', 'Opened up: ')}{whenLabel(e.offeredStartsAt)}</Text>
                      <Text style={[hubText.small, { color: ink, fontFamily: 'NotoSansGeorgian_600SemiBold' }]}>{tx('დაჯავშნე', 'Book it')}</Text>
                    </Pressable>
                  ) : (
                    <Text style={[hubText.small, { color: c.text300 }]}>{tx('ველოდებით თავისუფალ დროს — შეტყობინება მოგივა.', 'Waiting for a free time — you will be notified.')}</Text>
                  )}
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel={tx('სიიდან ამოღება', 'Leave the list')} onPress={() => leave(e)} hitSlop={8} style={s.waitX}>
                  <X size={16} color={c.text300} />
                </Pressable>
              </View>
            ))}
          </FlatCard>
        </View>
      ) : null}

      {mine.isLoading && !mine.data ? (
        <View style={{ marginTop: 16 }}><ListRowsSkeleton rows={4} padded={false} /></View>
      ) : !list.length ? (
        <FlatCard style={{ marginTop: 16, padding: 20, gap: 8, alignItems: 'center' }}>
          <View style={[s.emptyIcon, { borderColor: ink }]}><CalendarPlus size={22} color={ink} strokeWidth={2} /></View>
          <Text style={[hubText.cardTitle, { color: c.text100, textAlign: 'center' }]}>{tab === 'upcoming' ? tx('მომავალი ჯავშანი არ გაქვს', 'Nothing booked ahead') : tx('წარსული ჯავშნები ჯერ არ არის', 'No past bookings yet')}</Text>
          <Text style={[hubText.body, { color: c.text200, textAlign: 'center' }]}>{tab === 'upcoming' ? tx('მოძებნე ადგილი და ჩაეწერე — ორ შეხებაში.', 'Find a place and book — two taps.') : tx('დასრულებული, გაუქმებული და გაცდენილი ვიზიტები აქ დარჩება.', 'Completed, cancelled and missed visits stay here.')}</Text>
          {tab === 'upcoming' ? (
            <Pressable accessibilityRole="button" onPress={() => router.push('/book/search' as never)} style={[s.cta, { backgroundColor: ink }]}>
              <Text style={[hubText.link, { color: '#fff' }]}>{tx('ადგილის მოძებნა', 'Find a place')}</Text>
            </Pressable>
          ) : null}
        </FlatCard>
      ) : (
        groups.map(([day, items]) => (
          <View key={day} style={{ marginTop: 16 }}>
            <Text style={[hubText.caption, { color: c.text300, marginBottom: 6, marginLeft: 4 }]}>{dayLabel(items[0].startsAt)}</Text>
            <FlatCard>
              {items.map((a, i) => <AppointmentRow key={a.id} appointment={a} first={i === 0} onPress={() => open(a)} />)}
            </FlatCard>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  tabs: { flexDirection: 'row', padding: 4, borderRadius: 16, gap: 4 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44, borderRadius: 13 },
  emptyIcon: { width: 48, height: 48, borderRadius: 16, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  cta: { marginTop: 6, paddingHorizontal: 18, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  waitRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  waitIcon: { width: 36, height: 36, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  waitX: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginTop: -8, marginRight: -8 },
  offer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 6, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
});
