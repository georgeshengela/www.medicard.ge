import React, { useEffect, useRef, useState } from 'react';
import { Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Map as MapIcon, Search, X } from 'lucide-react-native';
import { BusinessRow, CategoryChips, FlatCard, useBookOrigin } from '@/components/book/BookUI';
import { ListRowsSkeleton } from '@/components/ui/Skeleton';
import { tx } from '@/i18n/locale';
import { api } from '@/lib/api';
import { bookCategory } from '@/lib/book/categories';
import type { BookBusinessCard, BookCategoryId } from '@/lib/book/bookTypes';
import { HUB, hubText } from '@/theme/hub';
import { useThemeColors } from '@/theme/colors';

/** Search by name, service or address; a category narrows it. Results are measured from where the person is. */
export default function BookSearchScreen() {
  const c = useThemeColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ category?: string; q?: string }>();
  const { origin, source } = useBookOrigin();
  const [q, setQ] = useState(params.q ? String(params.q) : '');
  const [category, setCategory] = useState<BookCategoryId | null>((params.category as BookCategoryId) || null);
  const [rows, setRows] = useState<BookBusinessCard[] | null>(null);
  const [loading, setLoading] = useState(false);
  const ticket = useRef(0);
  const input = useRef<TextInput>(null);

  useEffect(() => {
    const mine = ++ticket.current;
    const term = q.trim();
    if (term.length < 2 && !category) {
      setRows(null);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = term.length >= 2 || source !== 'gps'
          ? await api.book.search({ q: term, category, limit: 60, origin })
          : await api.book.nearby({ lat: origin.lat, lng: origin.lng, radiusKm: 15, category, limit: 60 });
        if (mine === ticket.current) setRows(res.businesses);
      } catch {
        if (mine === ticket.current) setRows([]);
      } finally {
        if (mine === ticket.current) setLoading(false);
      }
    }, 280);
    return () => clearTimeout(t);
  }, [q, category, origin.lat, origin.lng, source]);

  useEffect(() => {
    if (!params.category) setTimeout(() => input.current?.focus(), 80);
  }, [params.category]);

  const cat = category ? bookCategory(category) : null;
  return (
    <View style={{ flex: 1, backgroundColor: c.bg100, paddingTop: insets.top + 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: HUB.gutter }}>
        <Pressable accessibilityRole="button" accessibilityLabel={tx('უკან', 'Back')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/book' as never))} style={[s.round, { backgroundColor: c.surface }]}>
          <ArrowLeft size={20} color={c.text100} />
        </Pressable>
        <View style={[s.field, { backgroundColor: c.surface, borderColor: c.bg300 }]}>
          <Search size={18} color={c.text300} strokeWidth={2} />
          <TextInput
            ref={input}
            value={q}
            onChangeText={setQ}
            placeholder={cat ? tx(`ძებნა: ${cat.label}`, `Search: ${cat.label}`) : tx('სახელი, სერვისი, მისამართი', 'Name, service, address')}
            placeholderTextColor={c.text300}
            returnKeyType="search"
            onSubmitEditing={() => Keyboard.dismiss()}
            autoCorrect={false}
            style={[hubText.body, { flex: 1, color: c.text100, fontSize: 15, paddingVertical: 0 }]}
          />
          {q ? (
            <Pressable accessibilityRole="button" accessibilityLabel={tx('გასუფთავება', 'Clear')} hitSlop={8} onPress={() => setQ('')}>
              <X size={16} color={c.text300} strokeWidth={2.4} />
            </Pressable>
          ) : null}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={tx('რუკა', 'Map')} onPress={() => router.push((category ? `/book/map?category=${category}` : '/book/map') as never)} style={[s.round, { backgroundColor: c.surface }]}>
          <MapIcon size={20} color={c.text100} />
        </Pressable>
      </View>
      <View style={{ marginTop: 12, paddingHorizontal: HUB.gutter }}>
        <CategoryChips value={category} onChange={setCategory} />
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ paddingHorizontal: HUB.gutter, paddingTop: 16, paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
        {rows == null && !loading ? (
          <Text style={[hubText.body, { color: c.text200, paddingHorizontal: 4 }]}>
            {tx('ჩაწერე სახელი ან აირჩიე კატეგორია — ვაჩვენებ ყველა ადგილს, ახლო-ახლოს პირველად.', 'Type a name or pick a category — every place shows up, the nearest first.')}
          </Text>
        ) : loading && !rows ? (
          <ListRowsSkeleton rows={6} padded={false} />
        ) : rows && rows.length ? (
          <FlatCard>
            {rows.map((b, i) => <BusinessRow key={b.id} business={b} first={i === 0} onPress={() => router.push(`/book/b/${b.id}` as never)} />)}
          </FlatCard>
        ) : (
          <FlatCard style={{ padding: 18, gap: 6 }}>
            <Text style={[hubText.cardTitle, { color: c.text100 }]}>{tx('ვერაფერი მოიძებნა', 'Nothing found')}</Text>
            <Text style={[hubText.body, { color: c.text200 }]}>{tx('სცადე სხვა სიტყვა ან კატეგორია. თუ ადგილი კატალოგში არ არის, ჩაწერე ვიზიტი ხელით.', 'Try another word or category. If the place is not in the catalogue, add the visit by hand.')}</Text>
          </FlatCard>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  round: { width: 44, height: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  field: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, borderRadius: 16, paddingHorizontal: 12, borderWidth: 1 },
});
