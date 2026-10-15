import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, LocateFixed, X } from 'lucide-react-native';
import { BookMap, type BookMapBounds, type BookMapHandle } from '@/components/book/BookMap';
import { BusinessRow, CategoryChips, FlatCard, useBookOrigin } from '@/components/book/BookUI';
import { tx } from '@/i18n/locale';
import { api } from '@/lib/api';
import type { BookBusinessCard, BookCategoryId, BookPin } from '@/lib/book/bookTypes';
import { hubText } from '@/theme/hub';
import { useIsDark, useThemeColors } from '@/theme/colors';

/**
 * The map: every business around as a dot in its category colour, clusters when dense, the person's blue
 * dot. Pins reload as the viewport moves; a tap opens the place's card at the bottom.
 */
export default function BookMapScreen() {
  const c = useThemeColors();
  const dark = useIsDark();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ category?: string; focus?: string; lat?: string; lng?: string }>();
  const { origin, source, request } = useBookOrigin();
  const map = useRef<BookMapHandle>(null);
  const [category, setCategory] = useState<BookCategoryId | null>((params.category as BookCategoryId) || null);
  const [bounds, setBounds] = useState<BookMapBounds | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const [selected, setSelected] = useState<BookBusinessCard | null>(null);
  const [ready, setReady] = useState(false);
  const pinsRef = useRef<BookPin[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusLat = params.lat ? Number(params.lat) : null;
  const focusLng = params.lng ? Number(params.lng) : null;
  const initialCenter = useRef(Number.isFinite(focusLat) && Number.isFinite(focusLng) ? { lat: focusLat as number, lng: focusLng as number } : origin);

  const load = useCallback(async (b: BookMapBounds, cat: BookCategoryId | null) => {
    try {
      const { pins } = await api.book.map({ ...b, category: cat });
      pinsRef.current = pins;
      setCount(pins.length);
      map.current?.send({ type: 'pins', pins });
    } catch {
      /* the next move retries */
    }
  }, []);

  const onBounds = useCallback((b: BookMapBounds) => {
    setBounds(b);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void load(b, category), 220);
  }, [category, load]);

  useEffect(() => {
    if (bounds) void load(bounds, category);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  useEffect(() => {
    if (ready && source === 'gps') map.current?.send({ type: 'me', lat: origin.lat, lng: origin.lng, fly: false });
  }, [ready, origin.lat, origin.lng, source]);

  useEffect(() => {
    if (ready && params.focus) map.current?.send({ type: 'select', id: String(params.focus) });
  }, [ready, params.focus]);

  const onSelect = useCallback(async (id: string | null) => {
    if (!id) {
      setSelected(null);
      return;
    }
    const pin = pinsRef.current.find((p) => p.id === id);
    if (pin) setSelected({ id: pin.id, slug: pin.slug, name: pin.name, category: pin.category, categoryLabel: '', tags: [], address: null, city: null, district: null, lat: pin.lat, lng: pin.lng, phone: null, rating: pin.rating, ratingCount: 0, claimed: pin.claimed, bookable: pin.claimed, coverUrl: null, logoUrl: null, openNow: null, closesAt: null, opensAt: null, distanceKm: null, fromPrice: null, favorite: false });
    try {
      const { business } = await api.book.business(id);
      setSelected((cur) => (cur?.id === id || !cur ? business : cur));
    } catch {
      /* keep the pin's facts */
    }
  }, []);

  const locate = async () => {
    const ok = await request();
    if (!ok) return;
  };
  useEffect(() => {
    if (ready && source === 'gps') map.current?.send({ type: 'me', lat: origin.lat, lng: origin.lng, fly: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);

  useEffect(() => {
    if (ready) map.current?.send({ type: 'padding', top: insets.top + 110, bottom: selected ? 180 : 40 });
  }, [ready, insets.top, selected]);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg100 }}>
      <BookMap ref={map} center={initialCenter.current} zoom={Number.isFinite(focusLat) ? 16 : 13} onReady={() => setReady(true)} onBounds={onBounds} onSelect={(id) => void onSelect(id)} />

      <View pointerEvents="box-none" style={[s.top, { paddingTop: insets.top + 10 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16 }}>
          <Pressable accessibilityRole="button" accessibilityLabel={tx('უკან', 'Back')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/book' as never))} style={[s.round, { backgroundColor: c.surface }]}>
            <ArrowLeft size={20} color={c.text100} />
          </Pressable>
          <View style={[s.pillCount, { backgroundColor: c.surface }]}>
            <Text style={[hubText.small, { color: c.text200 }]}>
              {count == null ? tx('იტვირთება…', 'Loading…') : tx(`${count} ადგილი ამ არეში`, `${count} ${count === 1 ? 'place' : 'places'} in view`)}
            </Text>
          </View>
        </View>
        <View style={{ marginTop: 10, paddingHorizontal: 20 }}>
          <CategoryChips value={category} onChange={setCategory} />
        </View>
      </View>

      <View pointerEvents="box-none" style={[s.bottom, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={tx('ჩემი მდებარეობა', 'My location')} onPress={() => void locate()} style={[s.round, s.fab, { backgroundColor: c.surface }]}>
          <LocateFixed size={20} color={source === 'gps' ? c.primary100 : c.text100} strokeWidth={2.1} />
        </Pressable>
        {selected ? (
          <FlatCard style={{ marginHorizontal: 16 }}>
            <View style={{ position: 'absolute', right: 6, top: 6, zIndex: 2 }}>
              <Pressable accessibilityRole="button" accessibilityLabel={tx('დახურვა', 'Close')} hitSlop={8} onPress={() => { setSelected(null); map.current?.send({ type: 'select', id: null }); }} style={[s.close, { backgroundColor: c.bg200 }]}>
                <X size={14} color={c.text200} strokeWidth={2.4} />
              </Pressable>
            </View>
            <BusinessRow business={selected} first onPress={() => router.push(`/book/b/${selected.id}` as never)} />
            {selected.address ? <Text style={[hubText.caption, { color: c.text200, paddingHorizontal: 14, paddingBottom: 12, marginTop: -6 }]}>{selected.address}</Text> : null}
          </FlatCard>
        ) : null}
      </View>
      {!dark ? null : null}
    </View>
  );
}

const s = StyleSheet.create({
  top: { position: 'absolute', left: 0, right: 0, top: 0 },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, gap: 12 },
  round: { width: 44, height: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  pillCount: { paddingHorizontal: 14, height: 44, borderRadius: 16, justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  fab: { alignSelf: 'flex-end', marginRight: 16 },
  close: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
