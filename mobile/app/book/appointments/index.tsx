import React, { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CalendarPlus, Search } from 'lucide-react-native';
import { ModuleHeader, ModuleHeaderButton } from '@/components/brand/ModuleHeader';
import { AppointmentRow, FlatCard } from '@/components/book/BookUI';
import { ListRowsSkeleton } from '@/components/ui/Skeleton';
import { useAccountQuery } from '@/hooks/useAccountQuery';
import { tx } from '@/i18n/locale';
import { api } from '@/lib/api';
import { dayLabel, ymdLocal } from '@/lib/book/bookFormat';
import type { BookAppointment } from '@/lib/book/bookTypes';
import { FRESH } from '@/lib/queryClient';
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

  return (
    <ScrollView
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 60, paddingHorizontal: HUB.gutter }}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={mine.isRefetching} onRefresh={() => void mine.refetch()} tintColor={c.primary200} />}
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
});
