import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { FlatCard } from '@/components/book/BookUI';
import { FlowHeader, ServiceRow, StepBar, StepTitle, bundleLine, bundleOf, discountFor, useBookingFlow } from '@/components/book/BookFlow';
import { Button } from '@/components/ui/Button';
import { RecordsPageSkeleton } from '@/components/ui/Skeleton';
import { tx } from '@/i18n/locale';
import type { BookService } from '@/lib/book/bookTypes';
import { HUB, hubText } from '@/theme/hub';
import { useThemeColors } from '@/theme/colors';

/**
 * Step 1 — the services. One is the rule, but a visit may hold several (haircut + colour, cleaning + whitening):
 * every row is a checkbox, and a bar in the thumb zone adds them up — „2 სერვისი · 1 სთ 30 წთ · 95 ₾“ — with one
 * button that names the next step, the way Altegio does it. Arriving with ?serviceId (the „ჩაწერა“ pill on the
 * business page) skips straight ahead with that one service; coming back from the summary keeps every tick.
 */
export default function BookServiceStep() {
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const { b, query, services, service, serviceId, serviceIds, params, steps, askWho, go } = useBookingFlow();
  const [picked, setPicked] = useState<string[]>(serviceIds);
  const jumped = useRef(false);

  // The business page hands over one service: go straight on. A return from the summary carries `serviceIds`
  // instead, so the ticks are shown rather than skipped.
  useEffect(() => {
    if (!b || jumped.current || params.serviceIds) return;
    if (serviceId && service) {
      jumped.current = true;
      go(askWho ? 'who' : 'when', { serviceId: service.id }, true);
    }
  }, [b, serviceId, service, askWho, go, params.serviceIds]);

  // Ticks follow the route params when the page is reopened from the summary with a different set.
  const key = serviceIds.join(',');
  useEffect(() => { setPicked(serviceIds); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const groups = useMemo(() => {
    const map = new Map<string, BookService[]>();
    for (const svc of services) {
      const g = svc.group ?? '';
      map.set(g, [...(map.get(g) ?? []), svc]);
    }
    return [...map.entries()];
  }, [services]);

  const selected = useMemo(() => picked.map((id) => services.find((s) => s.id === id)).filter((s): s is BookService => Boolean(s)), [picked, services]);
  const bundle = useMemo(() => bundleOf(selected), [selected]);
  // Someone must be able to do the whole visit: with the chosen set, is there a person left who performs them all?
  const nobody = useMemo(() => {
    if (!b || selected.length < 2) return false;
    return !(b.staff ?? []).some((p) => p.bookable && (!p.serviceIds.length || selected.every((s) => p.serviceIds.includes(s.id))));
  }, [b, selected]);

  const toggle = (svc: BookService) => {
    void Haptics.selectionAsync().catch(() => undefined);
    setPicked((cur) => (cur.includes(svc.id) ? cur.filter((id) => id !== svc.id) : cur.length >= 8 ? cur : [...cur, svc.id]));
  };
  const next = () => {
    if (!selected.length) return;
    void Haptics.selectionAsync().catch(() => undefined);
    // Who/when/confirm read `serviceIds`; `serviceId` stays the first one for everything older.
    const ids = selected.map((s) => s.id);
    go(askWho ? 'who' : 'when', { serviceId: ids[0], serviceIds: ids.length > 1 ? ids.join(',') : '', staffId: '', date: '', startsAt: '', time: '', pick: '' });
  };

  const askWhoNow = Boolean(b?.settings.allowStaffChoice) && (b?.staff ?? []).filter((p) => p.bookable && (!p.serviceIds.length || selected.every((s) => p.serviceIds.includes(s.id)))).length > 1;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg100 }}>
      <FlowHeader b={b} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: HUB.gutter, paddingBottom: insets.bottom + (selected.length ? 130 : 40) }} showsVerticalScrollIndicator={false}>
        <StepBar steps={steps} current="service" />
        {!b ? (
          query.isError ? <Text style={[hubText.body, { color: c.text200 }]}>{tx('ბიზნესი ვერ მოიძებნა.', 'Business not found.')}</Text> : <RecordsPageSkeleton />
        ) : !services.length ? (
          <FlatCard style={{ padding: 18 }}>
            <Text style={[hubText.body, { color: c.text200 }]}>{tx('ამ ბიზნესს ონლაინ სერვისი ჯერ არ აქვს. დარეკე და ჩაეწერე ტელეფონით.', 'This business has no online services yet. Call to book by phone.')}</Text>
          </FlatCard>
        ) : (
          <>
            <StepTitle title={tx('რა გინდა?', 'What would you like?')} sub={tx('მონიშნე ერთი ან რამდენიმე სერვისი — ერთ ვიზიტად, ერთმანეთის მიყოლებით შესრულდება. ფასი და ხანგრძლივობა თითოეულთანაა.', 'Tick one or several services — they follow one another in one visit. Price and duration sit next to each one.')} />
            {groups.map(([group, list]) => (
              <View key={group || '_'} style={{ marginBottom: 14 }}>
                {group && groups.length > 1 ? <Text style={[hubText.caption, { color: c.text300, marginBottom: 6, marginLeft: 4 }]}>{group}</Text> : null}
                <FlatCard>
                  {list.map((svc, i) => <ServiceRow key={svc.id} service={svc} on={picked.includes(svc.id)} first={i === 0} discount={discountFor(b.discounts, svc)} onPress={() => toggle(svc)} />)}
                </FlatCard>
              </View>
            ))}
            <Text style={[hubText.small, { color: c.text300, marginTop: 4 }]}>{tx('გადახდა ადგილზე — MEDICARD-ში არაფერი იხდის.', 'You pay on site — nothing is charged in MEDICARD.')}</Text>
          </>
        )}
      </ScrollView>

      {b && selected.length ? (
        <View style={[s.footer, { paddingBottom: insets.bottom + 12, backgroundColor: c.bg100, borderTopColor: c.bg200 }]}>
          <Text style={[hubText.caption, { color: nobody ? c.danger : c.text100, textAlign: 'center', marginBottom: 8 }]} numberOfLines={2}>
            {nobody ? tx('ამ სერვისებს ერთი და იგივე თანამშრომელი ვერ შეასრულებს — დატოვე ნაწილი ცალკე ჯავშნისთვის.', 'No one person does all of these — leave some for a separate booking.') : bundleLine(bundle)}
          </Text>
          <Button label={askWhoNow ? tx('აირჩიე ვინ', 'Choose who') : tx('აირჩიე დრო', 'Choose a time')} size="lg" onPress={next} disabled={nobody} />
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: HUB.gutter, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
});
