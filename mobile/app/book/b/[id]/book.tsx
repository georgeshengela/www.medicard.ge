import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Check, ChevronRight, Clock, Tag, User, Users } from 'lucide-react-native';
import { ModuleStackHeader } from '@/components/brand/ModuleHeader';
import { FlatCard } from '@/components/book/BookUI';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { KeyboardFormShell } from '@/components/ui/KeyboardFormShell';
import { useAccountQuery } from '@/hooks/useAccountQuery';
import { tx } from '@/i18n/locale';
import { api, ApiError } from '@/lib/api';
import { syncBookReminders } from '@/lib/book/bookNotifications';
import { addDays, dateFromYmd, durationLabel, monthDay, priceLabel, weekdayShort, whenLabel, ymdLocal } from '@/lib/book/bookFormat';
import type { BookAppointment, BookAvailability, BookBusinessDetail, BookDayStrip, BookService, BookSlot } from '@/lib/book/bookTypes';
import { isPhoneRequiredError, offerPhoneVerification } from '@/lib/phoneGate';
import { FRESH, invalidate } from '@/lib/queryClient';
import { HUB, hubText } from '@/theme/hub';
import { useIsDark, useThemeColors } from '@/theme/colors';

/**
 * Booking in one page: the service, who (anyone or a chosen person), the day, the time, a note, then confirm.
 * Free slots come from the server for the chosen person (or anyone); the server checks again when booking,
 * so two people never take the same minute.
 */
export default function BookFlowScreen() {
  const c = useThemeColors();
  const dark = useIsDark();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string; serviceId?: string; staffId?: string }>();
  const businessId = String(params.id ?? '');
  const business = useAccountQuery<BookBusinessDetail>({ key: ['book', 'business', businessId], fetch: async () => (await api.book.business(businessId)).business, staleTime: FRESH.SHORT, enabled: Boolean(businessId) });
  const b = business.data;
  const services = useMemo(() => (b?.services ?? []).filter((s) => s.online), [b?.services]);
  const [serviceId, setServiceId] = useState<string | null>(params.serviceId ? String(params.serviceId) : null);
  const service = services.find((s) => s.id === serviceId) ?? (serviceId ? null : services[0] ?? null);
  const [staffId, setStaffId] = useState<string | null>(params.staffId ? String(params.staffId) : null);
  const [date, setDate] = useState<string>(ymdLocal());
  const [strip, setStrip] = useState<BookDayStrip | null>(null);
  const [slots, setSlots] = useState<BookAvailability | null>(null);
  const [slot, setSlot] = useState<BookSlot | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<BookAppointment | null>(null);
  const ink = dark ? '#F0ABFC' : '#A21CAF';

  useEffect(() => {
    if (!service && services.length && !serviceId) setServiceId(services[0].id);
  }, [service, services, serviceId]);

  const eligibleStaff = useMemo(() => (b?.staff ?? []).filter((p) => p.bookable && (!service || !p.serviceIds.length || p.serviceIds.includes(service.id))), [b?.staff, service]);
  useEffect(() => {
    if (staffId && !eligibleStaff.some((p) => p.id === staffId)) setStaffId(null);
  }, [eligibleStaff, staffId]);

  useEffect(() => {
    if (!b || !service) return;
    let alive = true;
    api.book.days(b.id, { serviceId: service.id, staffId, days: 14 }).then((res) => {
      if (!alive) return;
      setStrip(res);
      const firstOpen = res.days.find((d) => d.count > 0);
      if (firstOpen && !res.days.some((d) => d.date === date && d.count > 0)) setDate(firstOpen.date);
    }).catch(() => alive && setStrip(null));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [b?.id, service?.id, staffId]);

  useEffect(() => {
    if (!b || !service) return;
    let alive = true;
    setSlots(null);
    setSlot(null);
    api.book.availability(b.id, { serviceId: service.id, date, staffId }).then((res) => alive && setSlots(res)).catch(() => alive && setSlots({ date, serviceId: service.id, durationMin: service.durationMin, slots: [], closed: true }));
    return () => { alive = false; };
  }, [b?.id, b, service, date, staffId]);

  const confirm = async () => {
    if (!b || !service || !slot) return;
    setBusy(true);
    try {
      const { appointment } = await api.book.create({ businessId: b.id, serviceId: service.id, staffId: staffId ?? (slot.staffIds.length === 1 ? slot.staffIds[0] : null), startsAt: slot.startsAt, note: note.trim() || undefined });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      setDone(appointment);
      void invalidate('book');
      void invalidate('home');
      void api.book.appointments().then((r) => syncBookReminders(r.upcoming)).catch(() => undefined);
    } catch (error) {
      if (isPhoneRequiredError(error)) {
        offerPhoneVerification(router, tx('ჯავშნისთვის ტელეფონის ნომერი საჭიროა — ბიზნესი ასე დაგიკავშირდება.', 'A phone number is needed to book — this is how the business reaches you.'));
      } else if (error instanceof ApiError && error.code === 'SLOT_TAKEN') {
        Alert.alert(tx('ეს დრო უკვე დაიკავეს', 'This time was just taken'), error.message);
        setSlot(null);
        void api.book.availability(b.id, { serviceId: service.id, date, staffId }).then(setSlots).catch(() => undefined);
      } else {
        Alert.alert(tx('ვერ ჩაიწერა', 'Could not book'), error instanceof Error ? error.message : tx('სცადე ხელახლა.', 'Please try again.'));
      }
    } finally {
      setBusy(false);
    }
  };

  const days = strip?.days ?? Array.from({ length: 14 }, (_, i) => ({ date: addDays(ymdLocal(), i), count: -1, closed: false }));
  const slotsByPart = useMemo(() => {
    const groups: Array<{ label: string; items: BookSlot[] }> = [
      { label: tx('დილა', 'Morning'), items: [] }, { label: tx('დღე', 'Afternoon'), items: [] }, { label: tx('საღამო', 'Evening'), items: [] },
    ];
    for (const sl of slots?.slots ?? []) {
      const h = Number(sl.time.split(':')[0]);
      (h < 12 ? groups[0] : h < 17 ? groups[1] : groups[2]).items.push(sl);
    }
    return groups.filter((g) => g.items.length);
  }, [slots]);

  if (done) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg100 }}>
        <ModuleStackHeader module="book" subtitle={tx('ჯავშანი', 'Booking')} fallbackHref="/book" onBack={() => router.dismissTo('/book' as never)} />
        <ScrollView contentContainerStyle={{ paddingHorizontal: HUB.gutter, paddingBottom: insets.bottom + 40 }}>
          <FlatCard style={{ padding: 22, alignItems: 'center', gap: 10 }}>
            <View style={[s.check, { backgroundColor: done.status === 'PENDING' ? c.warningBg : c.successBg }]}>
              {done.status === 'PENDING' ? <Clock size={30} color={c.warning} strokeWidth={2.2} /> : <Check size={30} color={c.success} strokeWidth={2.6} />}
            </View>
            <Text style={[hubText.sectionTitle, { color: c.text100, textAlign: 'center' }]}>
              {done.status === 'PENDING' ? tx('ჯავშანი გაგზავნილია', 'Booking sent') : tx('ჩაწერილი ხარ', 'You are booked')}
            </Text>
            <Text style={[hubText.body, { color: c.text200, textAlign: 'center' }]}>
              {done.serviceName} · {done.business?.name}{'\n'}{whenLabel(done.startsAt)}{done.staffName ? ` · ${done.staffName}` : ''}
            </Text>
            <Text style={[hubText.caption, { color: c.text300, textAlign: 'center' }]}>
              {done.status === 'PENDING' ? tx('ბიზნესი დაადასტურებს და შეტყობინება მოგივა.', 'The business will confirm and you will get a notification.') : tx('შეხსენება მოგივა წინა დღეს და 2 საათით ადრე.', 'You will be reminded the day before and two hours ahead.')}
            </Text>
            <View style={{ width: '100%', gap: 10, marginTop: 8 }}>
              <Button label={tx('ჯავშნის დეტალები', 'Booking details')} onPress={() => router.replace(`/book/appointments/${done.id}` as never)} />
              <Button label={tx('MEDIBOOK-ზე დაბრუნება', 'Back to MEDIBOOK')} variant="secondary" onPress={() => router.dismissTo('/book' as never)} />
            </View>
          </FlatCard>
        </ScrollView>
      </View>
    );
  }

  const header = <ModuleStackHeader module="book" subtitle={b?.name ?? tx('ჯავშანი', 'Booking')} fallbackHref="/book" />;
  const footer = (
    <View style={{ paddingHorizontal: HUB.gutter, paddingTop: 10, paddingBottom: insets.bottom + 12, backgroundColor: c.bg100 }}>
      {slot && service ? (
        <Text style={[hubText.caption, { color: c.text200, textAlign: 'center', marginBottom: 8 }]}>
          {whenLabel(slot.startsAt)} · {durationLabel(service.durationMin)} · {priceLabel(service.price, service.priceTo, service.currency)}
        </Text>
      ) : null}
      <Button label={busy ? tx('იწერება…', 'Booking…') : tx('ჯავშნის დადასტურება', 'Confirm booking')} size="lg" onPress={() => void confirm()} disabled={!slot || !service || busy} loading={busy} />
    </View>
  );

  return (
    <KeyboardFormShell header={header} footer={footer} background={c.bg100} contentStyle={{ paddingHorizontal: HUB.gutter, paddingBottom: 24 }}>
      {!b ? null : (
        <>
          <Text style={[hubText.sectionTitle, { color: c.text100 }]}>{tx('სერვისი', 'Service')}</Text>
          <FlatCard style={{ marginTop: 10 }}>
            {services.map((svc, i) => <ServiceRow key={svc.id} service={svc} on={svc.id === service?.id} first={i === 0} ink={ink} onPress={() => { setServiceId(svc.id); setSlot(null); }} />)}
          </FlatCard>

          {b.settings.allowStaffChoice && eligibleStaff.length > 1 ? (
            <>
              <Text style={[hubText.sectionTitle, { color: c.text100, marginTop: HUB.sectionGap }]}>{tx('ვინ', 'With whom')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10, marginHorizontal: -HUB.gutter }} contentContainerStyle={{ paddingHorizontal: HUB.gutter, gap: 8 }}>
                <Chip on={!staffId} label={tx('ნებისმიერი', 'Anyone')} icon={Users} ink={ink} onPress={() => setStaffId(null)} />
                {eligibleStaff.map((p) => <Chip key={p.id} on={staffId === p.id} label={p.name} icon={User} ink={ink} onPress={() => setStaffId(p.id)} />)}
              </ScrollView>
            </>
          ) : null}

          <Text style={[hubText.sectionTitle, { color: c.text100, marginTop: HUB.sectionGap }]}>{tx('დღე', 'Day')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10, marginHorizontal: -HUB.gutter }} contentContainerStyle={{ paddingHorizontal: HUB.gutter, gap: 8 }}>
            {days.map((d) => {
              const on = d.date === date;
              const empty = d.count === 0 || d.closed;
              const dt = dateFromYmd(d.date);
              return (
                <Pressable key={d.date} accessibilityRole="button" accessibilityState={{ selected: on, disabled: empty }} disabled={empty} onPress={() => setDate(d.date)} style={[s.day, { backgroundColor: on ? ink : c.surface, opacity: empty ? 0.4 : 1 }]}>
                  <Text style={[hubText.small, { color: on ? '#fff' : c.text200 }]}>{weekdayShort(dt)}</Text>
                  <Text style={[hubText.value, { color: on ? '#fff' : c.text100, fontSize: 17 }]}>{dt.getDate()}</Text>
                  <Text style={[hubText.small, { color: on ? '#fff' : c.text300, fontSize: 10 }]}>{monthDay(d.date).split(' ')[1]}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={[hubText.sectionTitle, { color: c.text100, marginTop: HUB.sectionGap }]}>{tx('დრო', 'Time')}</Text>
          {!slots ? (
            <Text style={[hubText.body, { color: c.text300, marginTop: 10 }]}>{tx('თავისუფალ დროებს ვეძებ…', 'Looking for free times…')}</Text>
          ) : !slots.slots.length ? (
            <FlatCard style={{ marginTop: 10, padding: 16 }}>
              <Text style={[hubText.body, { color: c.text200 }]}>
                {slots.reason === 'closed' ? tx('ამ დღეს დახურულია. აირჩიე სხვა დღე.', 'Closed on this day. Pick another one.')
                  : slots.reason === 'horizon' ? tx('ასე შორს ჯერ არ იწერენ.', 'Bookings do not open that far ahead yet.')
                    : tx('ამ დღეს თავისუფალი დრო არ დარჩა. აირჩიე სხვა დღე ან სხვა თანამშრომელი.', 'No free time left on this day. Pick another day or another person.')}
              </Text>
            </FlatCard>
          ) : (
            slotsByPart.map((g) => (
              <View key={g.label} style={{ marginTop: 10 }}>
                <Text style={[hubText.caption, { color: c.text300, marginBottom: 6, marginLeft: 4 }]}>{g.label}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {g.items.map((sl) => {
                    const on = slot?.startsAt === sl.startsAt;
                    return (
                      <Pressable key={sl.startsAt} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => { setSlot(sl); void Haptics.selectionAsync().catch(() => undefined); }} style={[s.slot, { backgroundColor: on ? ink : c.surface, borderColor: on ? ink : c.bg300 }]}>
                        <Text style={[hubText.value, { color: on ? '#fff' : c.text100, fontSize: 14 }]}>{sl.time}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))
          )}

          <Text style={[hubText.sectionTitle, { color: c.text100, marginTop: HUB.sectionGap }]}>{tx('შენიშვნა (არასავალდებულო)', 'Note (optional)')}</Text>
          <View style={{ marginTop: 10 }}>
            <Input value={note} onChangeText={setNote} placeholder={tx('მაგ. პირველი ვიზიტი, მოდი ადრე 10 წუთით…', 'e.g. first visit, I may be 10 minutes early…')} multiline maxLength={500} style={{ minHeight: 72 }} />
          </View>
          {b.settings.bookingNote ? (
            <View style={[s.noteBox, { backgroundColor: c.surface }]}>
              <Tag size={15} color={c.text200} />
              <Text style={[hubText.caption, { color: c.text200, flex: 1 }]}>{b.settings.bookingNote}</Text>
            </View>
          ) : null}
          <Text style={[hubText.small, { color: c.text300, marginTop: 12 }]}>
            {tx(`უფასო გაუქმება ვიზიტამდე ${b.settings.cancelHours} საათით ადრე. გადახდა ადგილზე — MEDICARD-ში არაფერი იხდის.`, `Free cancellation up to ${b.settings.cancelHours} hours before. You pay on site — nothing is charged in MEDICARD.`)}
          </Text>
        </>
      )}
    </KeyboardFormShell>
  );
}

function ServiceRow({ service, on, first, ink, onPress }: { service: BookService; on: boolean; first: boolean; ink: string; onPress: () => void }) {
  const c = useThemeColors();
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: on }} onPress={onPress} style={[s.row, !first ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.bg200 } : null]}>
      <View style={[s.radio, { borderColor: on ? ink : c.bg300, backgroundColor: on ? ink : 'transparent' }]}>{on ? <Check size={13} color="#fff" strokeWidth={3} /> : null}</View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[hubText.cardTitle, { color: c.text100 }]}>{service.name}</Text>
        <Text style={[hubText.caption, { color: c.text200 }]}>{durationLabel(service.durationMin)}</Text>
      </View>
      <Text style={[hubText.value, { color: c.text100 }]}>{priceLabel(service.price, service.priceTo, service.currency)}</Text>
      <ChevronRight size={16} color="transparent" />
    </Pressable>
  );
}

function Chip({ on, label, icon: Icon, ink, onPress }: { on: boolean; label: string; icon: React.ComponentType<{ size: number; color: string; strokeWidth?: number }>; ink: string; onPress: () => void }) {
  const c = useThemeColors();
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: on }} onPress={onPress} style={[s.chip, { backgroundColor: on ? ink : c.surface, borderColor: on ? ink : c.bg300 }]}>
      <Icon size={14} color={on ? '#fff' : c.text200} strokeWidth={2.2} />
      <Text style={[hubText.small, { color: on ? '#fff' : c.text100, fontFamily: 'NotoSansGeorgian_600SemiBold' }]}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 999, borderWidth: 1 },
  day: { width: 58, paddingVertical: 10, borderRadius: 16, alignItems: 'center', gap: 2 },
  slot: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1, minWidth: 72, alignItems: 'center' },
  noteBox: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 14, marginTop: 10 },
  check: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
});
