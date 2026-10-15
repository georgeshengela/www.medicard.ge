import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import { BadgeCheck, CalendarCheck, ChevronRight, MapPin, Search, Star } from 'lucide-react-native';
import { ModuleWordmark } from '@/components/brand/ModuleWordmark';
import { tx } from '@/i18n/locale';
import { API_BASE_URL } from '@/lib/api';
import { bookCategory, BOOK_CATEGORY_CHIPS } from '@/lib/book/categories';
import { distanceLabel, fromPriceLabel, statusLabel, statusTone, whenLabel } from '@/lib/book/bookFormat';
import type { BookAppointment, BookBusinessCard, BookCategoryId } from '@/lib/book/bookTypes';
import { locationFromProfile } from '@/lib/userLocation';
import { useAuth } from '@/store/AuthContext';
import { useIsDark, useThemeColors } from '@/theme/colors';
import { HUB, hubText } from '@/theme/hub';
import { MODULE_BRANDS } from '@/theme/moduleBrand';

export const BRAND = MODULE_BRANDS.book;
export const TBILISI = { lat: 41.7151, lng: 44.8271 };

export function imageUri(path: string | null | undefined): string | null {
  if (!path) return null;
  return path.startsWith('http') ? path : `${API_BASE_URL}${path}`;
}

export type BookOrigin = { lat: number; lng: number };
export type OriginSource = 'gps' | 'profile' | 'default';

/**
 * Where „ახლოს შენთან“ is measured from: the live position when location is already allowed, the city from
 * the profile otherwise, Tbilisi's centre as the last resort. `request()` asks the OS — only ever from a
 * button press (AGENTS.md: permissions never from effects).
 */
export function useBookOrigin(): { origin: BookOrigin; source: OriginSource; granted: boolean | null; request: () => Promise<boolean>; refresh: () => Promise<void> } {
  const { healthProfile } = useAuth();
  const profileLoc = locationFromProfile(healthProfile);
  const fallback: { origin: BookOrigin; source: OriginSource } = profileLoc?.lat != null && profileLoc?.lng != null
    ? { origin: { lat: profileLoc.lat, lng: profileLoc.lng }, source: 'profile' }
    : { origin: TBILISI, source: 'default' };
  const [state, setState] = useState<{ origin: BookOrigin; source: OriginSource }>(fallback);
  const [granted, setGranted] = useState<boolean | null>(null);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  const locate = useCallback(async () => {
    try {
      const last = await Location.getLastKnownPositionAsync({ maxAge: 5 * 60_000 });
      if (last?.coords && alive.current) setState({ origin: { lat: last.coords.latitude, lng: last.coords.longitude }, source: 'gps' });
      const fix = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000)),
      ]);
      if (fix?.coords && alive.current) setState({ origin: { lat: fix.coords.latitude, lng: fix.coords.longitude }, source: 'gps' });
    } catch {
      /* keep the fallback */
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      const ok = status === Location.PermissionStatus.GRANTED;
      if (alive.current) setGranted(ok);
      if (ok) await locate();
    } catch {
      if (alive.current) setGranted(false);
    }
  }, [locate]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const request = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      const ok = status === Location.PermissionStatus.GRANTED;
      if (alive.current) setGranted(ok);
      if (ok) await locate();
      return ok;
    } catch {
      return false;
    }
  }, [locate]);

  return { origin: state.origin, source: state.source, granted, request, refresh };
}

/** One business in a list: picture or category tile, name, category · distance, rating, open now, price. */
export function BusinessRow({ business, onPress, first = false }: { business: BookBusinessCard; onPress: () => void; first?: boolean }) {
  const c = useThemeColors();
  const dark = useIsDark();
  const cat = bookCategory(business.category);
  const Icon = cat.icon;
  const img = imageUri(business.coverUrl ?? business.logoUrl);
  const meta = [business.categoryLabel, distanceLabel(business.distanceKm)].filter(Boolean).join(' · ');
  const price = fromPriceLabel(business.fromPrice);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${business.name}. ${meta}`}
      onPress={onPress}
      style={[s.row, { backgroundColor: c.surface, borderTopWidth: first ? 0 : StyleSheet.hairlineWidth, borderTopColor: c.bg200 }]}
    >
      {img ? (
        <Image source={{ uri: img }} style={[s.thumb, { backgroundColor: c.bg200 }]} />
      ) : (
        <View style={[s.thumb, { backgroundColor: `${cat.color}${dark ? '33' : '1F'}`, alignItems: 'center', justifyContent: 'center' }]}>
          <Icon size={22} color={cat.color} strokeWidth={1.9} />
        </View>
      )}
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text numberOfLines={1} style={[hubText.cardTitle, { color: c.text100, flexShrink: 1 }]}>{business.name}</Text>
          {business.claimed ? <BadgeCheck size={15} color={dark ? BRAND.ink.dark : BRAND.ink.light} strokeWidth={2.2} /> : null}
        </View>
        <Text numberOfLines={1} style={[hubText.caption, { color: c.text200 }]}>{meta}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {business.rating != null ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <Star size={12} color="#F59E0B" fill="#F59E0B" />
              <Text style={[hubText.small, { color: c.text100, fontFamily: 'NotoSansGeorgian_600SemiBold' }]}>{business.rating.toFixed(1)}</Text>
              <Text style={[hubText.small, { color: c.text300 }]}>({business.ratingCount})</Text>
            </View>
          ) : null}
          {business.openNow != null ? (
            <Text style={[hubText.small, { color: business.openNow ? c.success : c.text300 }]}>
              {business.openNow ? tx(`ღიაა${business.closesAt ? ` · ${business.closesAt}-მდე` : ''}`, `Open${business.closesAt ? ` · until ${business.closesAt}` : ''}`) : tx(`დახურულია${business.opensAt ? ` · ${business.opensAt}` : ''}`, `Closed${business.opensAt ? ` · opens ${business.opensAt}` : ''}`)}
            </Text>
          ) : null}
          {price ? <Text style={[hubText.small, { color: c.text200 }]}>{price}</Text> : null}
        </View>
      </View>
      {business.bookable ? (
        <View style={[s.bookPill, { backgroundColor: `${dark ? BRAND.ink.dark : BRAND.ink.light}${dark ? '26' : '14'}` }]}>
          <CalendarCheck size={13} color={dark ? BRAND.ink.dark : BRAND.ink.light} strokeWidth={2.2} />
          <Text style={[hubText.small, { color: dark ? BRAND.ink.dark : BRAND.ink.light, fontFamily: 'NotoSansGeorgian_600SemiBold' }]}>{tx('ჩაწერა', 'Book')}</Text>
        </View>
      ) : (
        <ChevronRight size={17} color={c.text300} />
      )}
    </Pressable>
  );
}

/** Horizontal category chips; `null` = every category. */
export function CategoryChips({ value, onChange, all = true }: { value: BookCategoryId | null; onChange: (next: BookCategoryId | null) => void; all?: boolean }) {
  const c = useThemeColors();
  const dark = useIsDark();
  const chips = [...(all ? [{ id: null as BookCategoryId | null, short: tx('ყველა', 'All'), color: dark ? BRAND.ink.dark : BRAND.ink.light, icon: null }] : []), ...BOOK_CATEGORY_CHIPS.map((x) => ({ id: x.id as BookCategoryId | null, short: x.short, color: x.color, icon: x.icon }))];
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: HUB.gutter }} style={{ marginHorizontal: -HUB.gutter }}>
      {chips.map((chip) => {
        const on = chip.id === value;
        const Icon = chip.icon;
        return (
          <Pressable
            key={chip.id ?? 'all'}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(chip.id)}
            style={[s.chip, { backgroundColor: on ? chip.color : c.surface, borderColor: on ? chip.color : c.bg300 }]}
          >
            {Icon ? <Icon size={14} color={on ? '#fff' : chip.color} strokeWidth={2.2} /> : null}
            <Text style={[hubText.small, { color: on ? '#fff' : c.text100, fontFamily: 'NotoSansGeorgian_600SemiBold' }]}>{chip.short}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** The hub's one spotlight: the next booking, or the search prompt when there is none. */
export function BookHero({ next, onOpen, onSearch, onMap }: { next: BookAppointment | null; onOpen: (a: BookAppointment) => void; onSearch: () => void; onMap: () => void }) {
  return (
    <LinearGradient colors={BRAND.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
      <View pointerEvents="none" style={[s.glow, { backgroundColor: BRAND.glow }]} />
      <View pointerEvents="none" style={s.ring1} />
      <View pointerEvents="none" style={s.ring2} />
      <ModuleWordmark module="book" size={20} onHero />
      {next ? (
        <Pressable accessibilityRole="button" onPress={() => onOpen(next)} style={{ gap: 4, marginTop: 14 }}>
          <Text style={[hubText.caption, { color: BRAND.onHero }]}>{tx('შემდეგი ჯავშანი', 'Next booking')}</Text>
          <Text style={s.heroTitle}>{next.serviceName}</Text>
          <Text style={[hubText.body, { color: '#FFFFFF' }]}>{next.business?.name ?? ''}</Text>
          <Text style={[hubText.body, { color: BRAND.onHero }]}>{whenLabel(next.startsAt)}{next.staffName ? ` · ${next.staffName}` : ''}</Text>
          <View style={[s.heroButton, { alignSelf: 'flex-start', marginTop: 10 }]}>
            <Text style={[hubText.link, { color: BRAND.gradient[0] }]}>{tx('დეტალები', 'Details')}</Text>
            <ChevronRight size={16} color={BRAND.gradient[0]} strokeWidth={2.4} />
          </View>
        </Pressable>
      ) : (
        <View style={{ gap: 8, marginTop: 14 }}>
          <Text style={s.heroTitle}>{tx('ჩაეწერე სტომატოლოგთან, სალონში, ესთეტიკის ცენტრში', 'Book a dentist, a salon, an aesthetic centre')}</Text>
          <Text style={[hubText.body, { color: BRAND.onHero }]}>{tx('ირგვლივ ყველა ადგილი — რუკაზე, ფასებით, თავისუფალი დროებით. ჯავშანი ორ შეხებაში.', 'Every place around you — on the map, with prices and free slots. Booked in two taps.')}</Text>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
            <Pressable accessibilityRole="button" onPress={onSearch} style={s.heroButton}>
              <Search size={16} color={BRAND.gradient[0]} strokeWidth={2.4} />
              <Text style={[hubText.link, { color: BRAND.gradient[0] }]}>{tx('ძებნა', 'Search')}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={onMap} style={[s.heroButton, { backgroundColor: 'rgba(255,255,255,0.18)' }]}>
              <MapPin size={16} color="#fff" strokeWidth={2.4} />
              <Text style={[hubText.link, { color: '#fff' }]}>{tx('რუკა', 'Map')}</Text>
            </Pressable>
          </View>
        </View>
      )}
    </LinearGradient>
  );
}

export function StatusPill({ status }: { status: BookAppointment['status'] }) {
  const c = useThemeColors();
  const tone = statusTone(status);
  const bg = tone === 'success' ? c.successBg : tone === 'warning' ? c.warningBg : tone === 'danger' ? c.dangerBg : tone === 'brand' ? c.accent100 : c.bg200;
  const fg = tone === 'success' ? c.success : tone === 'warning' ? c.warning : tone === 'danger' ? c.danger : tone === 'brand' ? c.primary100 : c.text200;
  return (
    <View style={{ alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, backgroundColor: bg }}>
      <Text style={[hubText.small, { color: fg, fontFamily: 'NotoSansGeorgian_600SemiBold' }]}>{statusLabel(status)}</Text>
    </View>
  );
}

/** One booking in a list (upcoming / past). */
export function AppointmentRow({ appointment, onPress, first = false }: { appointment: BookAppointment; onPress: () => void; first?: boolean }) {
  const c = useThemeColors();
  const dark = useIsDark();
  const cat = bookCategory(appointment.business?.category);
  const Icon = cat.icon;
  const img = imageUri(appointment.business?.logoUrl ?? appointment.business?.coverUrl);
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[s.row, { backgroundColor: c.surface, borderTopWidth: first ? 0 : StyleSheet.hairlineWidth, borderTopColor: c.bg200 }]}>
      {img ? <Image source={{ uri: img }} style={[s.thumbSmall, { backgroundColor: c.bg200 }]} /> : (
        <View style={[s.thumbSmall, { backgroundColor: `${cat.color}${dark ? '33' : '1F'}`, alignItems: 'center', justifyContent: 'center' }]}>
          <Icon size={20} color={cat.color} strokeWidth={1.9} />
        </View>
      )}
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <Text numberOfLines={1} style={[hubText.cardTitle, { color: c.text100 }]}>{appointment.serviceName}</Text>
        <Text numberOfLines={1} style={[hubText.caption, { color: c.text200 }]}>{appointment.business?.name ?? ''}{appointment.staffName ? ` · ${appointment.staffName}` : ''}</Text>
        <Text numberOfLines={1} style={[hubText.caption, { color: c.text100, fontFamily: 'NotoSansGeorgian_600SemiBold' }]}>{whenLabel(appointment.startsAt)}</Text>
      </View>
      <StatusPill status={appointment.status} />
    </Pressable>
  );
}

export function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((i) => <Star key={i} size={size} color="#F59E0B" fill={i <= Math.round(value) ? '#F59E0B' : 'transparent'} strokeWidth={1.8} />)}
    </View>
  );
}

export function FlatCard({ children, style }: { children: React.ReactNode; style?: object }) {
  const c = useThemeColors();
  return <View style={[{ backgroundColor: c.surface, borderRadius: HUB.cardRadius, overflow: 'hidden' }, style]}>{children}</View>;
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  thumb: { width: 56, height: 56, borderRadius: 16 },
  thumbSmall: { width: 44, height: 44, borderRadius: 14 },
  bookPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  hero: { borderRadius: HUB.cardRadius, padding: 20, overflow: 'hidden' },
  glow: { position: 'absolute', right: -40, top: -50, width: 180, height: 180, borderRadius: 90 },
  ring1: { position: 'absolute', right: -30, top: -30, width: 150, height: 150, borderRadius: 75, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  ring2: { position: 'absolute', right: -60, top: -60, width: 230, height: 230, borderRadius: 115, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  heroTitle: { fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 19, lineHeight: 26, color: '#FFFFFF' },
  heroButton: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFFFFF', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999 },
});
