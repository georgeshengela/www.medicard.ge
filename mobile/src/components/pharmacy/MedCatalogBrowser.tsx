import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronRight, PackageOpen, PenLine, Plus, Search, X } from 'lucide-react-native';
import { MedsButton, MedsEmptyState, MedsIconTile, medsInk } from '@/components/medications/MedsHubUI';
import { CatalogProductRow } from '@/components/pharmacy/CatalogProductRow';
import { ListRowsSkeleton } from '@/components/ui/Skeleton';
import { EMPTY_ART } from '@/constants/appArt';
import { ka } from '@/i18n/ka';
import { tx } from '@/i18n/locale';
import { api, type CatalogProductSummary, type DrugCategoryInfo } from '@/lib/api';
import { isFeatureOn, useFeatureState } from '@/lib/featureFlags';
import { formatRelative } from '@/lib/format';
import { catalogProductSetupParams } from '@/lib/medicationCatalogNav';
import { useIsDark, useThemeColors } from '@/theme/colors';
import { HUB, hubText, hubTint } from '@/theme/hub';

const PAGE = 40;

/**
 * MEDIPILL's one catalogue screen — the add-a-medication search, the pharmacy price list and a
 * category all render this: a pinned search field and category chips, then one card of products
 * (best price first in green), and „ხელით დამატება“ at the end for anything the catalogue lacks.
 */
export function MedCatalogBrowser({
  initialQuery = '',
  category,
  autoFocus,
  sort = 'name',
}: {
  initialQuery?: string;
  /** A fixed category (the category screen): no chips, the list is that category only. */
  category?: string;
  autoFocus?: boolean;
  sort?: 'name' | 'best_price';
}) {
  const c = useThemeColors();
  const dark = useIsDark();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const features = useFeatureState();
  const medsOn = isFeatureOn('medications', features);
  const pharmacyOn = isFeatureOn('pharmacy', features);
  const ink = medsInk(dark);

  const [query, setQuery] = useState(initialQuery);
  const [debounced, setDebounced] = useState(initialQuery.trim());
  const [chip, setChip] = useState<string | null>(null);
  const [categories, setCategories] = useState<DrugCategoryInfo[]>([]);
  const [products, setProducts] = useState<CatalogProductSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 350);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (category) return;
    void api.pharmacy.categories().then((res) => setCategories(res.categories)).catch(() => undefined);
  }, [category]);

  useEffect(() => {
    void api.pharmacy
      .syncMeta()
      .then((res) => {
        const times = Object.values(res.sources ?? {}).map((src) => src?.finishedAt).filter(Boolean) as string[];
        setSyncedAt(times.sort().pop() ?? null);
      })
      .catch(() => undefined);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.pharmacy.products({ q: debounced || undefined, category: category ?? chip ?? undefined, sort, limit: PAGE });
      setProducts(res.products);
      setTotal(res.pagination?.total ?? res.products.length);
    } catch {
      setProducts([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [category, chip, debounced, sort]);

  useEffect(() => {
    void load();
  }, [load]);

  const chips = useMemo(() => categories.flatMap((cat) => (cat.children?.length ? cat.children : [cat])), [categories]);
  const typed = query.trim();

  // With prices paused, a pick goes straight into the add form; otherwise to the price comparison.
  const open = (product: CatalogProductSummary) =>
    pharmacyOn
      ? router.push(`/pharmacy/product/${product.id}` as never)
      : router.push({ pathname: '/medications/add/setup', params: catalogProductSetupParams(product) });
  const addByHand = () =>
    router.push(typed.length >= 2 ? { pathname: '/medications/add/setup', params: { name: typed } } : '/medications/add/setup');

  const countLine = debounced
    ? ka.pharmacy.resultsCount(total)
    : total > 0
      ? ka.pharmacy.catalogSize(total)
      : null;

  const footer = (
    <View style={{ gap: 12, marginTop: products.length ? 12 : 0 }}>
      {medsOn ? (
        <Pressable accessibilityRole="button" onPress={addByHand} style={[s.handRow, { backgroundColor: c.surface }]}>
          <MedsIconTile icon={PenLine} ink="violet" size={42} iconSize={19} />
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Text numberOfLines={1} style={[hubText.cardTitle, { color: c.text100 }]}>
              {typed.length >= 2 ? `${ka.meds.addCustom}: „${typed}“` : ka.meds.addCustom}
            </Text>
            <Text numberOfLines={1} style={[hubText.caption, { color: c.text200 }]}>
              {tx('კატალოგში თუ ვერ იპოვე', 'If it is not in the catalogue')}
            </Text>
          </View>
          <ChevronRight size={18} color={c.text300} strokeWidth={2} />
        </Pressable>
      ) : null}
      <Text style={[hubText.small, { color: c.text300, textAlign: 'center', paddingHorizontal: 12 }]}>
        {syncedAt ? `${ka.pharmacy.syncUpdated(formatRelative(syncedAt))}. ` : ''}
        {ka.pharmacy.disclaimer}
      </Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.bg100 }}>
      <View style={{ paddingHorizontal: HUB.gutter, gap: 12, paddingBottom: 12 }}>
        <View style={[s.search, { backgroundColor: c.surface }]}>
          <Search size={18} color={c.text300} strokeWidth={2.2} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={ka.meds.searchPlaceholder}
            placeholderTextColor={c.text300}
            autoFocus={autoFocus}
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel={ka.meds.searchPlaceholder}
            style={[hubText.body, { flex: 1, paddingVertical: 12, fontSize: 16, color: c.text100 }]}
          />
          {query ? (
            <Pressable onPress={() => setQuery('')} hitSlop={12} accessibilityRole="button" accessibilityLabel={tx('გასუფთავება', 'Clear')}>
              <X size={18} color={c.text300} />
            </Pressable>
          ) : null}
        </View>
        {countLine ? (
          <Text numberOfLines={1} style={[hubText.small, { color: c.text300, paddingHorizontal: 4 }]}>{countLine}</Text>
        ) : null}
      </View>

      {!category && chips.length ? (
        <View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: HUB.gutter, gap: 8, paddingBottom: 14 }}>
            {[{ id: 'all', slug: null as string | null, nameKa: tx('ყველა', 'All'), productCount: undefined as number | undefined }, ...chips].map((item) => {
              const selected = chip === item.slug;
              return (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => setChip(item.slug)}
                  style={[s.chip, { backgroundColor: selected ? hubTint(ink, dark) : c.surface }]}
                >
                  <Text numberOfLines={1} style={[selected ? hubText.link : hubText.caption, { color: selected ? ink : c.text100 }]}>
                    {item.nameKa}
                  </Text>
                  {item.productCount ? (
                    <Text style={[hubText.small, { color: selected ? ink : c.text300 }]}>{item.productCount}</Text>
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      {loading && products.length === 0 ? (
        <ListRowsSkeleton rows={6} />
      ) : products.length === 0 ? (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: HUB.gutter, paddingBottom: insets.bottom + 24 }}>
          <MedsEmptyState icon={PackageOpen} ink="sky" art={EMPTY_ART.search} title={ka.meds.searchNotFound} body={ka.meds.searchNotFoundHint}>
            {medsOn ? (
              <MedsButton label={typed.length >= 2 ? `${ka.meds.addCustom}: ${typed}` : ka.meds.addCustom} icon={Plus} onPress={addByHand} />
            ) : null}
          </MedsEmptyState>
        </ScrollView>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: HUB.gutter, paddingBottom: insets.bottom + 24 }}
          renderItem={({ item, index }) => (
            <View
              style={[
                { backgroundColor: c.surface, overflow: 'hidden' },
                index === 0 && { borderTopLeftRadius: HUB.cardRadius, borderTopRightRadius: HUB.cardRadius },
                index === products.length - 1 && { borderBottomLeftRadius: HUB.cardRadius, borderBottomRightRadius: HUB.cardRadius },
              ]}
            >
              <CatalogProductRow product={item} first={index === 0} onPress={() => open(item)} />
            </View>
          )}
          ListFooterComponent={footer}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  search: { minHeight: 50, borderRadius: HUB.tileRadius, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 10 },
  chip: { minHeight: 36, borderRadius: 999, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 6 },
  handRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: HUB.cardRadius, paddingHorizontal: HUB.cardPad, paddingVertical: 12 },
});
