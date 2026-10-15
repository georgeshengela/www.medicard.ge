import React, { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { FlatCard } from '@/components/book/BookUI';
import { ChosenPills, FlowHeader, PersonRow, StepBar, StepTitle, nearestFromStrip, useBookingFlow } from '@/components/book/BookFlow';
import { RecordsPageSkeleton } from '@/components/ui/Skeleton';
import { tx } from '@/i18n/locale';
import { api } from '@/lib/api';
import { HUB, hubText } from '@/theme/hub';
import { useThemeColors } from '@/theme/colors';

/** Step 2 — who: anyone (whoever is free first) or a named person, each with the nearest free day. */
export default function BookWhoStep() {
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const { b, query, service, eligibleStaff, steps, go } = useBookingFlow();
  const [nearest, setNearest] = useState<Record<string, string | null>>({});

  useEffect(() => {
    if (!b || !service) return;
    let alive = true;
    const ids = [null, ...eligibleStaff.map((p) => p.id)];
    void Promise.allSettled(ids.map((id) => api.book.days(b.id, { serviceId: service.id, staffId: id, days: 14 }))).then((results) => {
      if (!alive) return;
      const next: Record<string, string | null> = {};
      results.forEach((r, i) => { next[ids[i] ?? '*'] = r.status === 'fulfilled' ? nearestFromStrip(r.value.days) : null; });
      setNearest(next);
    });
    return () => { alive = false; };
  }, [b, service, eligibleStaff]);

  const pick = (staffId: string | null) => {
    void Haptics.selectionAsync().catch(() => undefined);
    go('when', { staffId: staffId ?? '', date: '', startsAt: '', time: '', pick: '' });
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
            <StepTitle title={tx('ვისთან?', 'With whom?')} sub={tx('ყველას თავისი გრაფიკი აქვს — უახლოესი თავისუფალი დღე თითოეულთან წერია.', 'Each person keeps their own hours — the nearest free day is next to every name.')} />
            <ChosenPills items={[service.name]} />
            <FlatCard>
              <PersonRow person={null} first nearest={'*' in nearest ? nearest['*'] : undefined} onPress={() => pick(null)} />
              {eligibleStaff.map((p) => <PersonRow key={p.id} person={p} first={false} nearest={p.id in nearest ? nearest[p.id] : undefined} onPress={() => pick(p.id)} />)}
            </FlatCard>
          </>
        )}
      </ScrollView>
    </View>
  );
}
