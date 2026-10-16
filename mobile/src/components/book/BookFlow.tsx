import React, { useMemo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check, ChevronRight } from 'lucide-react-native';
import { ModuleStackHeader } from '@/components/brand/ModuleHeader';
import { imageUri } from '@/components/book/BookUI';
import { useAccountQuery } from '@/hooks/useAccountQuery';
import { isEn, tx } from '@/i18n/locale';
import { api } from '@/lib/api';
import { clockOf, dayLabel, durationLabel, priceLabel, tbilisiWeekday, tbilisiYmd } from '@/lib/book/bookFormat';
import type { BookBusinessDetail, BookDiscount, BookService, BookStaff } from '@/lib/book/bookTypes';
import { FRESH } from '@/lib/queryClient';
import { HUB, hubText } from '@/theme/hub';
import { useIsDark, useThemeColors } from '@/theme/colors';
import { moduleInk } from '@/theme/moduleBrand';

/**
 * The booking flow is four short pages (owner 2026-10-15: „ყველაფერი ერთ გვერდზე საშინელებაა“): the service,
 * the person (only when the business lets clients choose and more than one can do it), the day and time on one
 * page (the way the big booking apps do it), then one summary to confirm. What is chosen travels in the route params, so every page can be reopened
 * from the stack and the back gesture always means „one step back“.
 */
export type BookStep = 'service' | 'who' | 'when' | 'confirm';
/** `serviceIds` is a comma list — a visit may hold several services (haircut + colour), booked as one block of time. */
export type FlowParams = { id: string; serviceId?: string; serviceIds?: string; staffId?: string; date?: string; startsAt?: string; time?: string; pick?: string; seats?: string; seatsLeft?: string };

/** „ჯგუფური · 15 ადგილი“ for a class service, nothing for a normal visit. */
export function seatsLine(service: Pick<BookService, 'seats'>): string | null {
  const n = Number(service.seats ?? 1);
  return n > 1 ? tx(`ჯგუფური · ${n} ადგილი`, `Group · ${n} seats`) : null;
}

/** What the chosen services add up to: the block of time, the total, the names. */
export type ServiceBundle = { ids: string[]; names: string[]; durationMin: number; price: number | null; priceTo: number | null; currency: string };
export function bundleOf(list: BookService[]): ServiceBundle {
  const durationMin = list.reduce((sum, s) => sum + s.durationMin, 0);
  const priced = list.every((s) => s.price != null);
  const price = priced ? Math.round(list.reduce((sum, s) => sum + (s.price ?? 0), 0) * 100) / 100 : null;
  const hasTo = priced && list.some((s) => s.priceTo != null && s.priceTo > (s.price ?? 0));
  const priceTo = hasTo ? Math.round(list.reduce((sum, s) => sum + (s.priceTo ?? s.price ?? 0), 0) * 100) / 100 : null;
  return { ids: list.map((s) => s.id), names: list.map((s) => s.name), durationMin, price, priceTo, currency: list[0]?.currency ?? 'GEL' };
}
/** Query params the availability endpoints take: one id, or the comma list for a bundle. */
export function serviceParams(ids: string[]): { serviceId?: string; serviceIds?: string } {
  return ids.length > 1 ? { serviceIds: ids.join(',') } : { serviceId: ids[0] };
}

const STEP_LABEL: Record<BookStep, () => string> = {
  service: () => tx('სერვისი', 'Service'),
  who: () => tx('ვინ', 'Who'),
  when: () => tx('როდის', 'When'),
  confirm: () => tx('დადასტურება', 'Confirm'),
};
const KA_MONTHS_LONG = ['იანვარი', 'თებერვალი', 'მარტი', 'აპრილი', 'მაისი', 'ივნისი', 'ივლისი', 'აგვისტო', 'სექტემბერი', 'ოქტომბერი', 'ნოემბერი', 'დეკემბერი'];
const EN_MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export function monthName(index: number): string {
  return (isEn() ? EN_MONTHS_LONG : KA_MONTHS_LONG)[index];
}

/** Everything a step needs: the business, what is chosen so far, the step list, and `go()` to the next page. */
export function useBookingFlow() {
  const router = useRouter();
  const params = useLocalSearchParams<FlowParams>();
  const businessId = String(params.id ?? '');
  const query = useAccountQuery<BookBusinessDetail>({ key: ['book', 'business', businessId], fetch: async () => (await api.book.business(businessId)).business, staleTime: FRESH.SHORT, enabled: Boolean(businessId) });
  const b = query.data ?? null;
  const serviceId = params.serviceId ? String(params.serviceId) : null;
  const serviceIdsParam = params.serviceIds ? String(params.serviceIds) : '';
  const staffId = params.staffId ? String(params.staffId) : null;
  const services = useMemo(() => (b?.services ?? []).filter((s) => s.online), [b?.services]);
  // The chosen services, in the order they were ticked; `service` stays the first one for the single-service paths.
  const serviceIds = useMemo(() => {
    const list = serviceIdsParam.split(',').filter(Boolean);
    return list.length ? list : serviceId ? [serviceId] : [];
  }, [serviceIdsParam, serviceId]);
  const selected = useMemo(() => serviceIds.map((id) => services.find((s) => s.id === id)).filter((s): s is BookService => Boolean(s)), [services, serviceIds]);
  const service = selected[0] ?? null;
  const bundle = useMemo(() => bundleOf(selected), [selected]);
  const serviceKey = bundle.ids.join(',');
  // One person does the whole visit, so they must perform every chosen service.
  const eligibleStaff = useMemo(() => (b?.staff ?? []).filter((p) => p.bookable && (!p.serviceIds.length || selected.every((s) => p.serviceIds.includes(s.id)))), [b?.staff, selected]);
  const askWho = Boolean(b?.settings.allowStaffChoice && eligibleStaff.length > 1);
  const steps = useMemo<BookStep[]>(() => ['service', ...(askWho ? (['who'] as BookStep[]) : []), 'when', 'confirm'], [askWho]);
  const person = useMemo(() => {
    const id = staffId || (params.pick ? String(params.pick) : null);
    return id ? (b?.staff ?? []).find((p) => p.id === id) ?? null : null;
  }, [b?.staff, staffId, params.pick]);

  const go = (step: BookStep, patch: Partial<FlowParams> = {}, replace = false) => {
    const next: Record<string, string> = {};
    for (const [k, v] of Object.entries({ serviceId: params.serviceId, serviceIds: params.serviceIds, staffId: params.staffId, date: params.date, startsAt: params.startsAt, time: params.time, pick: params.pick, ...patch })) {
      if (v !== undefined && v !== null && String(v) !== '') next[k] = String(v);
    }
    const href = { pathname: `/book/b/${businessId}/book/${step === 'service' ? '' : step}`, params: next } as never;
    if (replace) router.replace(href);
    else router.push(href);
  };

  return { router, params, businessId, query, b, services, service, serviceId, serviceIds, serviceKey, selected, bundle, staffId, eligibleStaff, askWho, steps, person, go };
}

/** Four or five hairlines and „ეტაპი 2 / 5 · ვინ“. */
export function StepBar({ steps, current }: { steps: BookStep[]; current: BookStep }) {
  const c = useThemeColors();
  const dark = useIsDark();
  const ink = moduleInk('book', dark);
  const idx = Math.max(0, steps.indexOf(current));
  return (
    <View style={{ gap: 8, marginTop: 6, marginBottom: 16 }} accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: steps.length, now: idx + 1 }}>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {steps.map((s, i) => <View key={s} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: i <= idx ? ink : c.bg300 }} />)}
      </View>
      <Text style={[hubText.small, { color: c.text300 }]}>
        {tx(`ეტაპი ${idx + 1} / ${steps.length}`, `Step ${idx + 1} of ${steps.length}`)} · {STEP_LABEL[current]()}
      </Text>
    </View>
  );
}

export function FlowHeader({ b, onBack }: { b: BookBusinessDetail | null; onBack?: () => void }) {
  return <ModuleStackHeader module="book" subtitle={b?.name ?? tx('ჯავშანი', 'Booking')} fallbackHref="/book" onBack={onBack} />;
}

export function StepTitle({ title, sub }: { title: string; sub?: string | null }) {
  const c = useThemeColors();
  return (
    <View style={{ gap: 4, marginBottom: 14 }}>
      <Text style={[hubText.sectionTitle, { color: c.text100, fontSize: 22, lineHeight: 28 }]}>{title}</Text>
      {sub ? <Text style={[hubText.body, { color: c.text200 }]}>{sub}</Text> : null}
    </View>
  );
}

/** What is already chosen, as outlined pills under the title (lilac as a line, never a fill). */
export function ChosenPills({ items }: { items: Array<string | null | undefined> }) {
  const c = useThemeColors();
  const dark = useIsDark();
  const ink = moduleInk('book', dark);
  const list = items.filter(Boolean) as string[];
  if (!list.length) return null;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
      {list.map((label, i) => (
        <View key={`${i}-${label}`} style={[s.pill, { borderColor: ink }]}>
          <Check size={12} color={ink} strokeWidth={2.6} />
          <Text style={[hubText.small, { color: c.text100, fontFamily: 'NotoSansGeorgian_600SemiBold' }]}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

/**
 * A discount that covers this service today (public, active ones only); the server applies the exact one.
 * Weekday, day and clock are the business's (Tbilisi), like the server's `discountApplies`.
 */
export function discountFor(discounts: BookDiscount[] | undefined, service: BookService | null, at?: Date): BookDiscount | null {
  if (!discounts?.length || !service) return null;
  const when = at ?? new Date();
  const wd = tbilisiWeekday(when);
  const hhmm = clockOf(when);
  const ymd = tbilisiYmd(when);
  return discounts.find((d) => {
    if (d.serviceIds?.length && !d.serviceIds.includes(service.id)) return false;
    if (d.weekdays?.length && !d.weekdays.includes(wd)) return false;
    if (d.startsOn && ymd < d.startsOn) return false;
    if (d.endsOn && ymd > d.endsOn) return false;
    if (at && d.hoursFrom && d.hoursTo && !(hhmm >= d.hoursFrom && hhmm < d.hoursTo)) return false;
    if (d.code) return false;
    return true;
  }) ?? null;
}

export function discountedPrice(price: number | null, d: BookDiscount | null): number | null {
  if (price == null || !d) return price;
  const out = d.kind === 'PERCENT' ? price * (1 - d.value / 100) : price - d.value;
  return Math.max(0, Math.round(out * 100) / 100);
}

export function discountLabel(d: BookDiscount): string {
  return d.kind === 'PERCENT' ? `−${d.value}%` : `−${d.value} ₾`;
}

/** One service to tick: name, duration, price, a discount tag when one applies. Several can be ticked for one visit. */
export function ServiceRow({ service, on, first, discount, onPress }: { service: BookService; on: boolean; first: boolean; discount: BookDiscount | null; onPress: () => void }) {
  const c = useThemeColors();
  const dark = useIsDark();
  const ink = moduleInk('book', dark);
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={onPress} style={[s.row, !first ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.bg200 } : null]}>
      <View style={[s.check, { borderColor: on ? ink : c.bg300 }]}>{on ? <Check size={14} color={ink} strokeWidth={3} /> : null}</View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[hubText.cardTitle, { color: c.text100 }]}>{service.name}</Text>
        <Text style={[hubText.caption, { color: c.text200 }]}>{[durationLabel(service.durationMin), seatsLine(service), service.description].filter(Boolean).join(' · ')}</Text>
        {discount ? <Text style={[hubText.small, { color: ink, fontFamily: 'NotoSansGeorgian_600SemiBold' }]}>{discountLabel(discount)} · {discount.title}</Text> : null}
      </View>
      <Text style={[hubText.value, { color: c.text100 }]}>{priceLabel(service.price, service.priceTo, service.currency)}</Text>
    </Pressable>
  );
}

/** „2 სერვისი · 1 სთ 30 წთ · 95 ₾“ — the one line every step repeats about the chosen services. */
export function bundleLine(bundle: ServiceBundle): string {
  const count = bundle.ids.length > 1 ? tx(`${bundle.ids.length} სერვისი`, `${bundle.ids.length} services`) : bundle.names[0] ?? '';
  return [count, durationLabel(bundle.durationMin), priceLabel(bundle.price, bundle.priceTo, bundle.currency)].filter(Boolean).join(' · ');
}

/** A person to pick: picture or coloured initial, name, title, the nearest free day. */
export function PersonRow({ person, first, nearest, onPress }: { person: BookStaff | null; first: boolean; nearest: string | null | undefined; onPress: () => void }) {
  const c = useThemeColors();
  const dark = useIsDark();
  const ink = moduleInk('book', dark);
  const img = person?.imageUrl ? imageUri(person.imageUrl) : null;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[s.row, { paddingVertical: 14 }, !first ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.bg200 } : null]}>
      {img ? <Image source={{ uri: img }} style={[s.avatar, { backgroundColor: c.bg200 }]} /> : (
        <View style={[s.avatar, { backgroundColor: person ? (person.color ?? c.bg200) : 'transparent', borderWidth: person ? 0 : 1.5, borderColor: ink, alignItems: 'center', justifyContent: 'center' }]}>
          <Text style={[hubText.value, { color: person ? '#fff' : ink }]}>{person ? person.name.trim().slice(0, 1).toUpperCase() : '∗'}</Text>
        </View>
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[hubText.cardTitle, { color: c.text100 }]}>{person ? person.name : tx('ნებისმიერი თანამშრომელი', 'Anyone available')}</Text>
        <Text style={[hubText.caption, { color: c.text200 }]}>{person ? (person.title ?? tx('თანამშრომელი', 'Staff')) : tx('ვინც უფრო ადრე თავისუფალია', 'Whoever is free first')}</Text>
        <Text style={[hubText.small, { color: nearest === undefined ? c.text300 : nearest ? ink : c.text300, fontFamily: 'NotoSansGeorgian_600SemiBold' }]}>
          {nearest === undefined ? tx('ვამოწმებ თავისუფალ დროს…', 'Checking free time…') : nearest ? tx(`უახლოესი: ${nearest}`, `Earliest: ${nearest}`) : tx('14 დღეში თავისუფალი დრო არ ჩანს', 'No free time in the next 14 days')}
        </Text>
      </View>
      <ChevronRight size={16} color={c.text300} />
    </Pressable>
  );
}

export function nearestFromStrip(days: Array<{ date: string; count: number }>): string | null {
  const hit = days.find((d) => d.count > 0);
  return hit ? dayLabel(hit.date) : null;
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, minHeight: 56 },
  check: { width: 22, height: 22, borderRadius: 7, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 46, height: 46, borderRadius: 23 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1 },
});

export { HUB };
