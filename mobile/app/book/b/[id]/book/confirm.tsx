import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { CalendarDays, Check, Clock, MapPin, Tag, User } from 'lucide-react-native';
import { FlatCard } from '@/components/book/BookUI';
import { FlowHeader, StepBar, StepTitle, discountFor, discountLabel, discountedPrice, useBookingFlow } from '@/components/book/BookFlow';
import { ModuleStackHeader } from '@/components/brand/ModuleHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { KeyboardFormShell } from '@/components/ui/KeyboardFormShell';
import { RecordsPageSkeleton } from '@/components/ui/Skeleton';
import { tx } from '@/i18n/locale';
import { api, ApiError } from '@/lib/api';
import { syncBookReminders } from '@/lib/book/bookNotifications';
import { durationLabel, priceLabel, whenLabel } from '@/lib/book/bookFormat';
import type { BookAppointment } from '@/lib/book/bookTypes';
import { isPhoneRequiredError, offerPhoneVerification } from '@/lib/phoneGate';
import { invalidate } from '@/lib/queryClient';
import { HUB, hubText } from '@/theme/hub';
import { useIsDark, useThemeColors } from '@/theme/colors';
import { moduleInk } from '@/theme/moduleBrand';

/** The last step — one summary (every service with its price, who, when, where), a note, the rules, then confirm. The server checks the minute again when booking. */
export default function BookConfirmStep() {
  const c = useThemeColors();
  const dark = useIsDark();
  const ink = moduleInk('book', dark);
  const insets = useSafeAreaInsets();
  const { router, b, query, service, serviceIds, selected, bundle, staffId, person, params, steps, businessId } = useBookingFlow();
  const startsAt = params.startsAt ? String(params.startsAt) : null;
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<BookAppointment | null>(null);

  // A discount is checked per service (the server applies the exact one); the total is what the client sees.
  const lines = useMemo(() => selected.map((svc) => {
    const discount = discountFor(b?.discounts, svc, startsAt ? new Date(startsAt) : undefined);
    return { svc, discount, final: discountedPrice(svc.price, discount) };
  }), [b?.discounts, selected, startsAt]);
  const discounts = lines.filter((l) => l.discount).map((l) => l.discount!);
  const finalPrice = lines.length && lines.every((l) => l.final != null) ? Math.round(lines.reduce((sum, l) => sum + (l.final ?? 0), 0) * 100) / 100 : null;
  const priceTo = discounts.length ? null : bundle.priceTo;

  const confirm = async () => {
    if (!b || !service || !startsAt) return;
    setBusy(true);
    try {
      const { appointment } = await api.book.create({
        businessId: b.id,
        ...(serviceIds.length > 1 ? { serviceIds } : { serviceId: service.id }),
        staffId: staffId ?? (params.pick ? String(params.pick) : null),
        startsAt,
        note: note.trim() || undefined,
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      setDone(appointment);
      void invalidate('book');
      void invalidate('home');
      void api.book.appointments().then((r) => syncBookReminders(r.upcoming)).catch(() => undefined);
    } catch (error) {
      if (isPhoneRequiredError(error)) {
        offerPhoneVerification(router, tx('ჯავშნისთვის ტელეფონის ნომერი საჭიროა — ბიზნესი ასე დაგიკავშირდება.', 'A phone number is needed to book — this is how the business reaches you.'));
      } else if (error instanceof ApiError && error.code === 'SLOT_TAKEN') {
        Alert.alert(tx('ეს დრო უკვე დაიკავეს', 'This time was just taken'), tx('აირჩიე სხვა დრო.', 'Pick another time.'), [{ text: tx('დროის არჩევა', 'Pick a time'), onPress: () => router.back() }]);
      } else {
        Alert.alert(tx('ვერ ჩაიწერა', 'Could not book'), error instanceof Error ? error.message : tx('სცადე ხელახლა.', 'Please try again.'));
      }
    } finally {
      setBusy(false);
    }
  };

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

  const header = <FlowHeader b={b} />;
  const footer = (
    <View style={{ paddingHorizontal: HUB.gutter, paddingTop: 10, paddingBottom: insets.bottom + 12, backgroundColor: c.bg100 }}>
      {service && startsAt ? (
        <Text style={[hubText.caption, { color: c.text200, textAlign: 'center', marginBottom: 8 }]}>
          {whenLabel(startsAt)} · {durationLabel(bundle.durationMin)} · {priceLabel(finalPrice, priceTo, bundle.currency)}
        </Text>
      ) : null}
      <Button label={busy ? tx('იწერება…', 'Booking…') : tx('ჯავშნის დადასტურება', 'Confirm booking')} size="lg" onPress={() => void confirm()} disabled={!service || !startsAt || busy} loading={busy} />
    </View>
  );

  const change = (step: 'service' | 'who' | 'when') => {
    const path = `/book/b/${businessId}/book${step === 'service' ? '' : `/${step}`}`;
    // The service page reads `serviceIds` so it shows the ticks instead of skipping ahead.
    router.dismissTo({ pathname: path, params: { serviceId: params.serviceId, serviceIds: serviceIds.join(','), staffId: params.staffId, date: params.date } } as never);
  };

  const several = selected.length > 1;

  return (
    <KeyboardFormShell header={header} footer={footer} background={c.bg100} contentStyle={{ paddingHorizontal: HUB.gutter, paddingBottom: 24 }}>
      <StepBar steps={steps} current="confirm" />
      {!b || !service || !startsAt ? (
        query.isError ? <Text style={[hubText.body, { color: c.text200 }]}>{tx('ბიზნესი ვერ მოიძებნა.', 'Business not found.')}</Text> : <RecordsPageSkeleton />
      ) : (
        <>
          <StepTitle title={tx('ყველაფერი სწორია?', 'Everything right?')} sub={tx('გადახედე და დაადასტურე — ჯავშანი მხოლოდ ახლა იქმნება.', 'Check it over and confirm — the booking is made only now.')} />
          <FlatCard>
            <Row
              icon={Tag}
              label={several ? tx('სერვისები', 'Services') : tx('სერვისი', 'Service')}
              value={several ? tx(`${selected.length} სერვისი`, `${selected.length} services`) : service.name}
              sub={`${durationLabel(bundle.durationMin)} · ${priceLabel(finalPrice, priceTo, bundle.currency)}${!several && lines[0]?.discount ? ` (${discountLabel(lines[0].discount)}, ${priceLabel(service.price, null, service.currency)}-დან)` : ''}`}
              first
              onChange={() => change('service')}
            >
              {several ? (
                <View style={{ gap: 5, marginTop: 6, borderLeftWidth: 2, borderLeftColor: ink, paddingLeft: 10 }}>
                  {lines.map(({ svc, discount, final }) => (
                    <View key={svc.id} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
                      <Text style={[hubText.caption, { color: c.text100, flex: 1 }]} numberOfLines={1}>{svc.name}<Text style={{ color: c.text300 }}> · {durationLabel(svc.durationMin)}</Text></Text>
                      <Text style={[hubText.caption, { color: discount ? ink : c.text100, fontFamily: 'NotoSansGeorgian_600SemiBold' }]}>{priceLabel(final, discount ? null : svc.priceTo, svc.currency)}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </Row>
            <Row icon={User} label={tx('ვინ', 'Who')} value={person ? person.name : tx('ნებისმიერი თანამშრომელი', 'Anyone available')} sub={person?.title ?? (staffId ? null : tx('ვინც ამ დროს თავისუფალია', 'Whoever is free at this time'))} onChange={steps.includes('who') ? () => change('who') : undefined} />
            <Row icon={CalendarDays} label={tx('როდის', 'When')} value={whenLabel(startsAt)} sub={tx(`დასრულდება ~${durationLabel(bundle.durationMin)}-ში`, `Ends in about ${durationLabel(bundle.durationMin)}`)} onChange={() => change('when')} />
            <Row icon={MapPin} label={tx('სად', 'Where')} value={b.name} sub={b.address ?? null} />
          </FlatCard>
          {discounts.length ? (
            <View style={[s.note, { borderColor: ink, backgroundColor: c.surface }]}>
              <Text style={[hubText.caption, { color: c.text100 }]}><Text style={{ color: ink, fontFamily: 'NotoSansGeorgian_600SemiBold' }}>{discounts.map((d) => `${d.title} · ${discountLabel(d)}`).join(', ')}</Text> — {tx('ფასდაკლება ადგილზე, ზუსტ თანხას ბიზნესი დაადასტურებს.', 'applied on site; the business confirms the exact amount.')}</Text>
            </View>
          ) : null}

          <Text style={[hubText.sectionTitle, { color: c.text100, marginTop: HUB.sectionGap }]}>{tx('შენიშვნა ბიზნესისთვის', 'A note for the business')}</Text>
          <View style={{ marginTop: 10 }}>
            <Input value={note} onChangeText={setNote} placeholder={tx('არასავალდებულო — მაგ. პირველი ვიზიტი, ალერგია, 10 წუთით ადრე მოვალ…', 'Optional — e.g. first visit, an allergy, I may be 10 minutes early…')} multiline maxLength={500} style={{ minHeight: 76 }} />
          </View>
          {b.settings.bookingNote ? (
            <View style={[s.note, { borderColor: c.bg300, backgroundColor: c.surface }]}>
              <Text style={[hubText.caption, { color: c.text200 }]}><Text style={{ color: c.text100, fontFamily: 'NotoSansGeorgian_600SemiBold' }}>{tx('ბიზნესისგან: ', 'From the business: ')}</Text>{b.settings.bookingNote}</Text>
            </View>
          ) : null}
          <Text style={[hubText.small, { color: c.text300, marginTop: 12 }]}>
            {tx(`უფასო გაუქმება ვიზიტამდე ${b.settings.cancelHours} საათით ადრე. გადახდა ადგილზე — MEDICARD-ში არაფერი იხდის. ${b.settings.autoConfirm ? 'ჯავშანი მაშინვე დასტურდება.' : 'ბიზნესი ჯავშანს თავად დაადასტურებს.'}`, `Free cancellation up to ${b.settings.cancelHours} hours before. You pay on site — nothing is charged in MEDICARD. ${b.settings.autoConfirm ? 'The booking is confirmed at once.' : 'The business confirms the booking itself.'}`)}
          </Text>
        </>
      )}
    </KeyboardFormShell>
  );
}

function Row({ icon: Icon, label, value, sub, first = false, onChange, children }: { icon: React.ComponentType<{ size: number; color: string; strokeWidth?: number }>; label: string; value: string; sub?: string | null; first?: boolean; onChange?: () => void; children?: React.ReactNode }) {
  const c = useThemeColors();
  const dark = useIsDark();
  const ink = moduleInk('book', dark);
  return (
    <View style={[s.row, !first ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.bg200 } : null]}>
      <View style={[s.tile, { borderColor: c.bg300 }]}><Icon size={17} color={c.text200} strokeWidth={2} /></View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[hubText.small, { color: c.text300 }]}>{label}</Text>
        <Text style={[hubText.cardTitle, { color: c.text100 }]}>{value}</Text>
        {sub ? <Text style={[hubText.caption, { color: c.text200 }]}>{sub}</Text> : null}
        {children}
      </View>
      {onChange ? (
        <Pressable accessibilityRole="button" accessibilityLabel={tx(`${label} — შეცვლა`, `Change ${label}`)} onPress={onChange} hitSlop={8} style={{ paddingVertical: 8, paddingHorizontal: 4, alignSelf: 'flex-start' }}>
          <Text style={[hubText.small, { color: ink, fontFamily: 'NotoSansGeorgian_600SemiBold' }]}>{tx('შეცვლა', 'Change')}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  tile: { width: 36, height: 36, borderRadius: 11, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  note: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 14, marginTop: 10, borderWidth: 1 },
  check: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
});
