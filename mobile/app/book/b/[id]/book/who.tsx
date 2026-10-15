import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { FlatCard } from '@/components/book/BookUI';
import { ChosenPills, FlowHeader, PersonRow, StepBar, StepTitle, serviceParams, useBookingFlow } from '@/components/book/BookFlow';
import { RecordsPageSkeleton } from '@/components/ui/Skeleton';
import { tx } from '@/i18n/locale';
import { api } from '@/lib/api';
import { dayLabel } from '@/lib/book/bookFormat';
import type { BookSlot } from '@/lib/book/bookTypes';
import { HUB, hubText } from '@/theme/hub';
import { useIsDark, useThemeColors } from '@/theme/colors';
import { moduleInk } from '@/theme/moduleBrand';

type Nearest = { date: string; slots: BookSlot[] } | null;

/**
 * Step 2 — who: anyone (whoever is free first) or a named person. Under every name the nearest free day
 * and its first times as chips — one tap on a chip books that time straight away (the summary still
 * comes before anything is created), the way Altegio offers „nearest time slot“ on its professional page.
 */
export default function BookWhoStep() {
  const c = useThemeColors();
  const dark = useIsDark();
  const ink = moduleInk('book', dark);
  const insets = useSafeAreaInsets();
  const { b, query, service, serviceIds, serviceKey, selected, eligibleStaff, steps, go } = useBookingFlow();
  const [nearest, setNearest] = useState<Record<string, Nearest>>({});

  useEffect(() => {
    if (!b || !service) return;
    let alive = true;
    const ids: Array<string | null> = [null, ...eligibleStaff.map((p) => p.id)];
    void Promise.allSettled(ids.map(async (id) => {
      const strip = await api.book.days(b.id, { ...serviceParams(serviceIds), staffId: id, days: 14 });
      const first = strip.days.find((d) => d.count > 0);
      if (!first) return null;
      const av = await api.book.availability(b.id, { ...serviceParams(serviceIds), date: first.date, staffId: id });
      return { date: first.date, slots: av.slots.slice(0, 4) };
    })).then((results) => {
      if (!alive) return;
      const next: Record<string, Nearest> = {};
      results.forEach((r, i) => { next[ids[i] ?? '*'] = r.status === 'fulfilled' ? r.value : null; });
      setNearest(next);
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [b, serviceKey, eligibleStaff]);

  const pick = (staffId: string | null) => {
    void Haptics.selectionAsync().catch(() => undefined);
    go('when', { staffId: staffId ?? '', date: '', startsAt: '', time: '', pick: '' });
  };
  const pickSlot = (staffId: string | null, date: string, sl: BookSlot) => {
    void Haptics.selectionAsync().catch(() => undefined);
    go('confirm', { staffId: staffId ?? '', date, startsAt: sl.startsAt, time: sl.time, pick: staffId || (sl.staffIds.length === 1 ? sl.staffIds[0] : '') });
  };

  const chips = (id: string | null) => {
    const key = id ?? '*';
    if (!(key in nearest)) return null;
    const n = nearest[key];
    if (!n || !n.slots.length) return null;
    return (
      <View style={s.chipsRow}>
        <Text style={[hubText.small, { color: c.text300, marginRight: 2 }]}>{dayLabel(n.date)}:</Text>
        {n.slots.map((sl) => (
          <Pressable key={sl.startsAt} accessibilityRole="button" accessibilityLabel={tx(`${dayLabel(n.date)} ${sl.time}`, `${dayLabel(n.date)} ${sl.time}`)} onPress={() => pickSlot(id, n.date, sl)} style={[s.chip, { borderColor: ink }]}>
            <Text style={[hubText.small, { color: c.text100, fontFamily: 'NotoSansGeorgian_600SemiBold' }]}>{sl.time}</Text>
          </Pressable>
        ))}
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg100 }}>
      <FlowHeader b={b} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: HUB.gutter, paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
        <StepBar steps={steps} current="who" />
        {!b || !service ? (
          query.isError ? <Text style={[hubText.body, { color: c.text200 }]}>{tx('ბიზნესი ვერ მოიძებნა.', 'Business not found.')}</Text> : <RecordsPageSkeleton />
        ) : (
          <>
            <StepTitle title={tx('ვისთან?', 'With whom?')} sub={tx('ყველას თავისი გრაფიკი აქვს. უახლოესი თავისუფალი დროები თითოეულთან წერია — ერთი შეხებით პირდაპირ შეჯამებაზე გადახვალ.', 'Each person keeps their own hours. The nearest free times sit next to every name — one tap takes you straight to the summary.')} />
            <ChosenPills items={selected.map((x) => x.name)} />
            <FlatCard>
              <View>
                <PersonRow person={null} first nearest={'*' in nearest ? (nearest['*'] ? dayLabel(nearest['*'].date) : null) : undefined} onPress={() => pick(null)} />
                {chips(null)}
              </View>
              {eligibleStaff.map((p) => (
                <View key={p.id}>
                  <PersonRow person={p} first={false} nearest={p.id in nearest ? (nearest[p.id] ? dayLabel(nearest[p.id]!.date) : null) : undefined} onPress={() => pick(p.id)} />
                  {chips(p.id)}
                </View>
              ))}
            </FlatCard>
            <Text style={[hubText.small, { color: c.text300, marginTop: 10 }]}>{tx('სახელზე დაჭერით ყველა დღეს და დროს ნახავ.', 'Tap a name to see every day and time.')}</Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingBottom: 12, marginTop: -4, paddingLeft: 72 },
  chip: { paddingHorizontal: 12, minHeight: 36, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
