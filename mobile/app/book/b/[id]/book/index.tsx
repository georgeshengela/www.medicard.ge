import React, { useEffect, useMemo, useRef } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { FlatCard } from '@/components/book/BookUI';
import { FlowHeader, ServiceRow, StepBar, StepTitle, discountFor, useBookingFlow } from '@/components/book/BookFlow';
import { RecordsPageSkeleton } from '@/components/ui/Skeleton';
import { tx } from '@/i18n/locale';
import type { BookService } from '@/lib/book/bookTypes';
import { HUB, hubText } from '@/theme/hub';
import { useThemeColors } from '@/theme/colors';

/** Step 1 — the service. Arriving with ?serviceId (the „ჩაწერა“ pill on the business page) skips straight ahead. */
export default function BookServiceStep() {
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const { b, query, services, service, serviceId, steps, askWho, go } = useBookingFlow();
  const jumped = useRef(false);

  useEffect(() => {
    if (!b || jumped.current) return;
    if (serviceId && service) {
      jumped.current = true;
      go(askWho ? 'who' : 'when', { serviceId: service.id }, true);
    }
  }, [b, serviceId, service, askWho, go]);

  const groups = useMemo(() => {
    const map = new Map<string, BookService[]>();
    for (const svc of services) {
      const g = svc.group ?? '';
      map.set(g, [...(map.get(g) ?? []), svc]);
    }
    return [...map.entries()];
  }, [services]);

  const pick = (svc: BookService) => {
    void Haptics.selectionAsync().catch(() => undefined);
    go(askWho ? 'who' : 'when', { serviceId: svc.id, staffId: '', date: '', startsAt: '', time: '', pick: '' });
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg100 }}>
      <FlowHeader b={b} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: HUB.gutter, paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
        <StepBar steps={steps} current="service" />
        {!b ? (
          query.isError ? <Text style={[hubText.body, { color: c.text200 }]}>{tx('ბიზნესი ვერ მოიძებნა.', 'Business not found.')}</Text> : <RecordsPageSkeleton />
        ) : !services.length ? (
          <FlatCard style={{ padding: 18 }}>
            <Text style={[hubText.body, { color: c.text200 }]}>{tx('ამ ბიზნესს ონლაინ სერვისი ჯერ არ აქვს. დარეკე და ჩაეწერე ტელეფონით.', 'This business has no online services yet. Call to book by phone.')}</Text>
          </FlatCard>
        ) : (
          <>
            <StepTitle title={tx('რა გინდა?', 'What would you like?')} sub={tx('აირჩიე სერვისი — ფასი და ხანგრძლივობა თითოეულთანაა. შემდეგ ვინ და როდის.', 'Pick a service — price and duration sit next to each one. Then who and when.')} />
            {groups.map(([group, list]) => (
              <View key={group || '_'} style={{ marginBottom: 14 }}>
                {group && groups.length > 1 ? <Text style={[hubText.caption, { color: c.text300, marginBottom: 6, marginLeft: 4 }]}>{group}</Text> : null}
                <FlatCard>
                  {list.map((svc, i) => <ServiceRow key={svc.id} service={svc} on={svc.id === serviceId} first={i === 0} discount={discountFor(b.discounts, svc)} onPress={() => pick(svc)} />)}
                </FlatCard>
              </View>
            ))}
            <Text style={[hubText.small, { color: c.text300, marginTop: 4 }]}>{tx('გადახდა ადგილზე — MEDICARD-ში არაფერი იხდის.', 'You pay on site — nothing is charged in MEDICARD.')}</Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}
