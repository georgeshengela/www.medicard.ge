import React, { useEffect, useState } from 'react';
import { Alert, Image, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { CalendarPlus, ChevronRight, MapPin, Navigation, Phone, Star, X } from 'lucide-react-native';
import { ModuleHeader } from '@/components/brand/ModuleHeader';
import { FlatCard, Stars, StatusPill, imageUri } from '@/components/book/BookUI';
import { Button } from '@/components/ui/Button';
import { APP_MODAL_OVERLAY, APP_MODAL_PROPS, Modal } from '@/components/ui/appModal';
import { RecordsPageSkeleton } from '@/components/ui/Skeleton';
import { useAccountQuery } from '@/hooks/useAccountQuery';
import { tx } from '@/i18n/locale';
import { api } from '@/lib/api';
import { syncBookReminders } from '@/lib/book/bookNotifications';
import { bookCategory } from '@/lib/book/categories';
import { directionsUrl, durationLabel, priceLabel, whenLabel } from '@/lib/book/bookFormat';
import type { BookAppointment } from '@/lib/book/bookTypes';
import { FRESH, invalidate } from '@/lib/queryClient';
import { HUB, hubText } from '@/theme/hub';
import { useIsDark, useThemeColors } from '@/theme/colors';

/** One booking: where, what, when, with whom; call, route, add to the calendar, cancel, and a review after the visit. */
export default function AppointmentScreen() {
  const c = useThemeColors();
  const dark = useIsDark();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string; review?: string }>();
  const id = String(params.id ?? '');
  const query = useAccountQuery<BookAppointment>({ key: ['book', 'appointment', id], fetch: async () => (await api.book.appointment(id)).appointment, staleTime: FRESH.SHORT, enabled: Boolean(id) });
  const a = query.data;
  const [reviewOpen, setReviewOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const ink = dark ? '#F0ABFC' : '#A21CAF';
  const past = a ? new Date(a.endsAt).getTime() < Date.now() : false;
  const canReview = Boolean(a && !a.reviewed && (a.status === 'COMPLETED' || (a.status === 'CONFIRMED' && past)));
  const open = Boolean(a && (a.status === 'PENDING' || a.status === 'CONFIRMED') && !past);

  useEffect(() => {
    if (params.review === '1' && canReview) setReviewOpen(true);
  }, [params.review, canReview]);

  const refreshAll = async () => {
    void invalidate('book');
    void invalidate('home');
    try {
      const r = await api.book.appointments();
      await syncBookReminders(r.upcoming);
    } catch {
      /* next focus */
    }
  };

  const cancel = () => {
    if (!a) return;
    Alert.alert(
      tx('ჯავშნის გაუქმება', 'Cancel booking'),
      a.canCancelFree
        ? tx(`${a.serviceName}, ${whenLabel(a.startsAt)}. ბიზნესს შეტყობინება მივა.`, `${a.serviceName}, ${whenLabel(a.startsAt)}. The business will be notified.`)
        : tx(`გაუქმების ვადა (${a.cancelHours} სთ) გასულია — ბიზნესი ამას ხედავს. მაინც გავაუქმო?`, `The free-cancellation window (${a.cancelHours} h) has passed — the business sees that. Cancel anyway?`),
      [
        { text: tx('არა', 'No'), style: 'cancel' },
        {
          text: tx('გაუქმება', 'Cancel booking'),
          style: 'destructive',
          onPress: async () => {
            try {
              await api.book.cancel(a.id);
              void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
              await query.refetch();
              void refreshAll();
            } catch (error) {
              Alert.alert(tx('ვერ გაუქმდა', 'Could not cancel'), error instanceof Error ? error.message : '');
            }
          },
        },
      ],
    );
  };

  const addToCalendar = async () => {
    if (!a) return;
    try {
      const Calendar = await import('expo-calendar');
      const { status } = await Calendar.requestCalendarPermissionsAsync();
      if (status !== 'granted') return;
      const cals = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      const target = cals.find((x) => x.allowsModifications && (Platform.OS === 'ios' ? x.source?.name !== 'Birthdays' : true)) ?? cals[0];
      if (!target) return;
      await Calendar.createEventAsync(target.id, {
        title: `${a.serviceName} · ${a.business?.name ?? 'MEDIBOOK'}`,
        startDate: new Date(a.startsAt),
        endDate: new Date(a.endsAt),
        location: a.business?.address ?? undefined,
        notes: a.staffName ? tx(`თანამშრომელი: ${a.staffName}`, `With ${a.staffName}`) : undefined,
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      Alert.alert(tx('დაემატა კალენდარში', 'Added to your calendar'));
    } catch {
      Alert.alert(tx('კალენდარში ვერ დაემატა', 'Could not add to the calendar'));
    }
  };

  const submitReview = async () => {
    if (!a || !rating) return;
    setBusy(true);
    try {
      await api.book.review(a.id, { rating, text: text.trim() || undefined });
      setReviewOpen(false);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      await query.refetch();
      void invalidate('book');
    } catch (error) {
      Alert.alert(tx('შეფასება ვერ შეინახა', 'Could not save the review'), error instanceof Error ? error.message : '');
    } finally {
      setBusy(false);
    }
  };

  const cat = bookCategory(a?.business?.category);
  const Icon = cat.icon;
  const logo = imageUri(a?.business?.logoUrl ?? a?.business?.coverUrl);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg100 }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40, paddingHorizontal: HUB.gutter }} showsVerticalScrollIndicator={false}>
        <ModuleHeader module="book" subtitle={tx('ჯავშანი', 'Booking')} fallbackHref="/book" />
        {!a ? (
          <View style={{ marginTop: 20 }}>{query.isError ? <Text style={[hubText.body, { color: c.text200 }]}>{tx('ჯავშანი ვერ მოიძებნა.', 'Booking not found.')}</Text> : <RecordsPageSkeleton />}</View>
        ) : (
          <>
            <FlatCard style={{ marginTop: 20, padding: 18, gap: 12 }}>
              <StatusPill status={a.status} />
              <Text style={[hubText.sectionTitle, { color: c.text100, fontSize: 21, lineHeight: 28 }]}>{a.serviceName}</Text>
              <Text style={[hubText.body, { color: c.text100, fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 16 }]}>{whenLabel(a.startsAt)}</Text>
              <Text style={[hubText.caption, { color: c.text200 }]}>
                {durationLabel(a.durationMin)}{a.staffName ? tx(` · ${a.staffName}`, ` · with ${a.staffName}`) : ''} · {priceLabel(a.price)}{a.discountAmount ? tx(` (ფასდაკლება −${a.discountAmount} ₾)`, ` (discount −${a.discountAmount} ₾)`) : ''}
              </Text>
              {a.note ? <Text style={[hubText.caption, { color: c.text200 }]}>{tx('შენიშვნა: ', 'Note: ')}{a.note}</Text> : null}
              {a.status === 'CANCELLED' ? (
                <Text style={[hubText.caption, { color: c.text300 }]}>
                  {a.cancelledBy === 'BUSINESS' ? tx('გააუქმა ბიზნესმა', 'Cancelled by the business') : tx('გააუქმე შენ', 'Cancelled by you')}{a.cancelReason ? ` · ${a.cancelReason}` : ''}
                </Text>
              ) : null}
            </FlatCard>

            {a.business ? (
              <Pressable accessibilityRole="button" onPress={() => router.push(`/book/b/${a.business!.id}` as never)} style={[s.biz, { backgroundColor: c.surface }]}>
                {logo ? <Image source={{ uri: logo }} style={[s.logo, { backgroundColor: c.bg200 }]} /> : (
                  <View style={[s.logo, { backgroundColor: `${cat.color}${dark ? '33' : '1F'}`, alignItems: 'center', justifyContent: 'center' }]}>
                    <Icon size={22} color={cat.color} strokeWidth={1.9} />
                  </View>
                )}
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[hubText.cardTitle, { color: c.text100 }]}>{a.business.name}</Text>
                  {a.business.address ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <MapPin size={12} color={c.text300} />
                      <Text numberOfLines={2} style={[hubText.caption, { color: c.text200, flex: 1 }]}>{a.business.address}</Text>
                    </View>
                  ) : null}
                </View>
                <ChevronRight size={17} color={c.text300} />
              </Pressable>
            ) : null}

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              <Action icon={Phone} label={tx('დარეკვა', 'Call')} disabled={!a.business?.phone} onPress={() => a.business?.phone && Linking.openURL(`tel:${a.business.phone.replace(/[^\d+]/g, '')}`)} />
              <Action icon={Navigation} label={tx('მარშრუტი', 'Route')} disabled={a.business?.lat == null} onPress={() => {
                const b = a.business!;
                const url = Platform.OS === 'ios' ? `maps:?daddr=${b.lat},${b.lng}&q=${encodeURIComponent(b.name)}` : `geo:${b.lat},${b.lng}?q=${b.lat},${b.lng}(${encodeURIComponent(b.name)})`;
                Linking.openURL(url).catch(() => Linking.openURL(directionsUrl(b.lat!, b.lng!, b.name)));
              }} />
              {open ? <Action icon={CalendarPlus} label={tx('კალენდარში', 'Calendar')} onPress={() => void addToCalendar()} /> : null}
            </View>

            {canReview ? (
              <Pressable accessibilityRole="button" onPress={() => setReviewOpen(true)} style={[s.reviewCta, { backgroundColor: c.surface, borderColor: ink }]}>
                <Star size={18} color={ink} fill={ink} />
                <View style={{ flex: 1 }}>
                  <Text style={[hubText.cardTitle, { color: c.text100 }]}>{tx('როგორ იყო?', 'How was it?')}</Text>
                  <Text style={[hubText.caption, { color: c.text200 }]}>{tx('შეაფასე ერთი შეხებით — ეს სხვებს ეხმარება არჩევაში', 'Rate it with one tap — it helps others choose')}</Text>
                </View>
                <ChevronRight size={17} color={c.text300} />
              </Pressable>
            ) : null}
            {a.reviewed ? <Text style={[hubText.caption, { color: c.text300, marginTop: 12, textAlign: 'center' }]}>{tx('მადლობა შეფასებისთვის.', 'Thanks for your review.')}</Text> : null}

            {open ? (
              <View style={{ marginTop: 28 }}>
                <Button label={tx('ჯავშნის გაუქმება', 'Cancel booking')} variant="ghost" onPress={cancel} />
                <Text style={[hubText.small, { color: c.text300, textAlign: 'center', marginTop: 8 }]}>
                  {a.canCancelFree ? tx(`უფასო გაუქმება ვიზიტამდე ${a.cancelHours} საათით ადრე`, `Free cancellation up to ${a.cancelHours} hours before`) : tx('გაუქმების ვადა გასულია — თუ ვერ მოხვალ, მაინც გააუქმე, რომ დრო სხვას დარჩეს', 'The free window has passed — if you cannot make it, cancel anyway so the slot goes to someone else')}
                </Text>
              </View>
            ) : null}
            {!open && a.business && a.status !== 'PENDING' ? (
              <View style={{ marginTop: 28 }}>
                <Button label={tx('ისევ ჩაწერა', 'Book again')} variant="secondary" onPress={() => router.push(`/book/b/${a.business!.id}/book${a.serviceId ? `?serviceId=${a.serviceId}` : ''}` as never)} />
              </View>
            ) : null}
          </>
        )}
      </ScrollView>

      <Modal visible={reviewOpen} {...APP_MODAL_PROPS} onRequestClose={() => setReviewOpen(false)}>
        <Pressable accessibilityLabel={tx('დახურვა', 'Close')} onPress={() => setReviewOpen(false)} style={{ position: 'absolute', inset: 0, backgroundColor: APP_MODAL_OVERLAY }} />
        <View style={[s.sheet, { backgroundColor: c.surface, paddingBottom: insets.bottom + 16 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={[hubText.sectionTitle, { color: c.text100, flex: 1 }]}>{tx('შეაფასე ვიზიტი', 'Rate your visit')}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={tx('დახურვა', 'Close')} onPress={() => setReviewOpen(false)} hitSlop={8}><X size={20} color={c.text200} /></Pressable>
          </View>
          <Text style={[hubText.caption, { color: c.text200 }]}>{a?.business?.name} · {a?.serviceName}</Text>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 14, justifyContent: 'center' }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <Pressable key={i} accessibilityRole="button" accessibilityLabel={tx(`${i} ვარსკვლავი`, `${i} stars`)} onPress={() => { setRating(i); void Haptics.selectionAsync().catch(() => undefined); }} hitSlop={6}>
                <Star size={36} color="#F59E0B" fill={i <= rating ? '#F59E0B' : 'transparent'} strokeWidth={1.6} />
              </Pressable>
            ))}
          </View>
          {rating ? <View style={{ alignItems: 'center', marginTop: 6 }}><Stars value={rating} size={0} /></View> : null}
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={tx('რამდენიმე სიტყვა (არასავალდებულო)', 'A few words (optional)')}
            placeholderTextColor={c.text300}
            multiline
            maxLength={1000}
            style={[hubText.body, { color: c.text100, backgroundColor: c.bg100, borderRadius: 14, padding: 12, minHeight: 80, marginTop: 14, textAlignVertical: 'top' }]}
          />
          <View style={{ marginTop: 14 }}>
            <Button label={tx('შეფასების გაგზავნა', 'Send review')} onPress={() => void submitReview()} disabled={!rating || busy} loading={busy} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Action({ icon: Icon, label, onPress, disabled }: { icon: React.ComponentType<{ size: number; color: string; strokeWidth?: number }>; label: string; onPress: () => void; disabled?: boolean }) {
  const c = useThemeColors();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} disabled={disabled} style={[s.action, { backgroundColor: c.surface, opacity: disabled ? 0.4 : 1 }]}>
      <Icon size={18} color={c.primary100} strokeWidth={2} />
      <Text style={[hubText.small, { color: c.text100, fontFamily: 'NotoSansGeorgian_600SemiBold' }]}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  biz: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: HUB.cardRadius, marginTop: 12 },
  logo: { width: 48, height: 48, borderRadius: 14 },
  action: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 12, borderRadius: 16 },
  reviewCta: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: HUB.cardRadius, marginTop: 20, borderWidth: 1 },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20 },
});
