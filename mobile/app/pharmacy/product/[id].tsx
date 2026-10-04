import React, { useCallback, useMemo, useState } from 'react';
import { Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Building2, Check, ExternalLink, Gauge, Globe, Package, Pill, Plus, RefreshCw, Tag } from 'lucide-react-native';
import { HomeSectionHeading } from '@/components/home/HomeSectionHeading';
import { MedsButton, MedsCard, MedsInfoRow } from '@/components/medications/MedsHubUI';
import { catalogRowMeta } from '@/components/pharmacy/CatalogProductRow';
import { PharmacyProductImage } from '@/components/pharmacy/PharmacyProductImage';
import { PharmacySourceLogo } from '@/components/pharmacy/PharmacySourceLogo';
import { ProductHeroSkeleton } from '@/components/ui/Skeleton';
import { useMedications } from '@/hooks/useMedications';
import { ka } from '@/i18n/ka';
import { tx } from '@/i18n/locale';
import { api, type CatalogProductDetail, type PharmacySourcePrice } from '@/lib/api';
import { useFeature } from '@/lib/featureFlags';
import { formatRelative } from '@/lib/format';
import { catalogProductSetupParams } from '@/lib/medicationCatalogNav';
import { parseMedicationConfig } from '@/lib/medications.shared';
import { buildCompareSlots, compareStats, isBestSlot } from '@/lib/pharmacyCompare';
import { useIsDark, useThemeColors } from '@/theme/colors';
import { HUB, hubInk, hubText, hubTint } from '@/theme/hub';

/**
 * A catalogue medicine: what it is, the best price, every pharmacy side by side (a bar per price, the
 * cheapest in green, a tap opens that pharmacy) and its details. The pinned footer adds it to her
 * medications — or opens it there when it already is.
 */
export default function PharmacyProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const c = useThemeColors();
  const dark = useIsDark();
  const insets = useSafeAreaInsets();
  // „Add to my medications“ leads into the medications module, which an admin can pause.
  const medsOn = useFeature('medications');
  const { medications } = useMedications();
  const [product, setProduct] = useState<CatalogProductDetail | null>(null);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const green = hubInk('green', dark);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const res = await api.pharmacy.product(String(id));
      setProduct(res.product);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const mine = useMemo(
    () => (product ? medications.find((med) => parseMedicationConfig(med.config).catalogProductId === product.id) : undefined),
    [medications, product],
  );

  if (!product) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg100 }}>
        {failed ? (
          <View style={{ paddingHorizontal: HUB.gutter, paddingTop: 24, gap: 14, alignItems: 'center' }}>
            <Text style={[hubText.body, { color: c.text200, textAlign: 'center' }]}>
              {tx('ვერ ჩაიტვირთა. შეამოწმე ინტერნეტი და სცადე თავიდან.', 'Could not load. Check the connection and try again.')}
            </Text>
            <MedsButton label={tx('თავიდან ცდა', 'Try again')} icon={RefreshCw} tone="tonal" compact onPress={() => void load()} />
          </View>
        ) : (
          <ProductHeroSkeleton />
        )}
      </View>
    );
  }

  const slots = buildCompareSlots(product.sourcePrices ?? []);
  const { available, maxPrice, savingsGel } = compareStats(slots, product.bestPriceGel);
  const best = slots.find((slot) => isBestSlot(slot, product.bestPriceGel));
  // When the prices were last read — once for the page, so each pharmacy row stays one clear line.
  const lastSync = available.map((slot) => slot.syncedAt).filter(Boolean).sort().pop() ?? null;
  const sorted = [...slots].sort((a, b) => (a.priceGel ?? Infinity) - (b.priceGel ?? Infinity));
  const facts = [product.form, catalogRowMeta(product)].filter((v, i, all) => v && all.indexOf(v) === i).join(' · ');
  const details = [
    product.manufacturer ? { icon: Building2, ink: 'blue' as const, label: ka.pharmacy.manufacturer, value: product.manufacturer } : null,
    product.country ? { icon: Globe, ink: 'sky' as const, label: ka.pharmacy.country, value: product.country } : null,
    product.form ? { icon: Pill, ink: 'violet' as const, label: ka.pharmacy.form, value: product.form } : null,
    product.strength ? { icon: Gauge, ink: 'amber' as const, label: ka.pharmacy.strength, value: product.strength } : null,
    product.packSize ? { icon: Package, ink: 'green' as const, label: ka.pharmacy.pack, value: product.packSize } : null,
  ].filter(Boolean) as { icon: typeof Pill; ink: 'blue' | 'sky' | 'violet' | 'amber' | 'green'; label: string; value: string }[];

  const openSource = (slot: PharmacySourcePrice) => {
    if (slot.sourceUrl) void Linking.openURL(slot.sourceUrl);
  };
  const footerVisible = medsOn || !!best?.sourceUrl;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg100 }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: HUB.gutter, paddingTop: 4, paddingBottom: (footerVisible ? 96 : 24) + insets.bottom, gap: HUB.sectionGap - 6 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={green} />}
        showsVerticalScrollIndicator={false}
      >
        {/* What it is: picture, name, the facts on one line, its category. */}
        <MedsCard style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
          <PharmacyProductImage uri={product.imageUrl} size={84} rounded={20} />
          <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
            <Text accessibilityRole="header" style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 18, lineHeight: 25, color: c.text100 }}>
              {product.name}
            </Text>
            {facts ? <Text style={[hubText.caption, { color: c.text200 }]}>{facts}</Text> : null}
            {product.category ? (
              <View style={[s.tag, { backgroundColor: c.bg200 }]}>
                <Tag size={11} color={c.text300} strokeWidth={2.4} />
                <Text numberOfLines={1} style={[hubText.small, { color: c.text200 }]}>{product.category.nameKa}</Text>
              </View>
            ) : null}
          </View>
        </MedsCard>

        {/* The answer first: the lowest price, where, and how much it saves. */}
        {product.bestPriceGel != null ? (
          <MedsCard style={{ gap: 6 }}>
            <Text style={[hubText.caption, { color: c.text200 }]}>{ka.pharmacy.bestPrice}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 32, lineHeight: 40, color: green }}>
                {product.bestPriceGel.toFixed(2)} ₾
              </Text>
              {savingsGel != null && savingsGel > 0 ? (
                <View style={[s.pill, { backgroundColor: hubTint(green, dark) }]}>
                  <Text style={[s.pillText, { color: green }]}>{tx(`დაზოგე ${savingsGel.toFixed(2)} ₾`, `Save ${savingsGel.toFixed(2)} ₾`)}</Text>
                </View>
              ) : null}
            </View>
            {best ? (
              <Text style={[hubText.body, { color: c.text100 }]}>{ka.pharmacy.cheapestAt(best.nameKa)}</Text>
            ) : null}
          </MedsCard>
        ) : null}

        {/* Every pharmacy side by side: the bar is the price against the dearest one. */}
        <View>
          <HomeSectionHeading title={`${ka.pharmacy.compareTitle} · ${available.length}`} />
          {available.length === 0 ? (
            <MedsCard>
              <Text style={[hubText.body, { color: c.text200, textAlign: 'center' }]}>{ka.pharmacy.noOffers}</Text>
            </MedsCard>
          ) : (
            <MedsCard padded={false}>
              {sorted.map((slot, index) => (
                <PriceRow
                  key={slot.sourceId}
                  slot={slot}
                  first={index === 0}
                  isBest={isBestSlot(slot, product.bestPriceGel)}
                  maxPrice={maxPrice ?? Math.max(...available.map((a) => a.priceGel ?? 0))}
                  onOpen={() => openSource(slot)}
                />
              ))}
            </MedsCard>
          )}
        </View>

        {details.length ? (
          <View>
            <HomeSectionHeading title={ka.pharmacy.detailsTitle} />
            <MedsCard padded={false}>
              {details.map((row, index) => (
                <MedsInfoRow key={row.label} icon={row.icon} ink={row.ink} label={row.label} value={row.value} isLast={index === details.length - 1} />
              ))}
            </MedsCard>
          </View>
        ) : null}

        <Text style={[hubText.small, { color: c.text300, textAlign: 'center', paddingHorizontal: 12 }]}>
          {lastSync ? `${ka.pharmacy.syncUpdated(formatRelative(lastSync))}. ` : ''}
          {ka.pharmacy.disclaimer}
        </Text>
      </ScrollView>

      {footerVisible ? (
        <View style={[s.footer, { backgroundColor: c.bg100, paddingBottom: Math.max(insets.bottom, 16) }]}>
          {best?.sourceUrl ? (
            <MedsButton
              tone="tonal"
              ink="green"
              icon={ExternalLink}
              label={best.nameKa}
              accessibilityLabel={tx(`${best.nameKa}-ში გახსნა`, `Open at ${best.nameKa}`)}
              onPress={() => openSource(best)}
              style={medsOn ? { paddingHorizontal: 16 } : { flex: 1 }}
            />
          ) : null}
          {medsOn ? (
            mine ? (
              <MedsButton
                tone="tonal"
                icon={Check}
                label={tx('ჩემს წამლებშია', 'In my medications')}
                onPress={() => router.push(`/medications/${mine.id}` as never)}
                style={{ flex: 1 }}
              />
            ) : (
              <MedsButton
                icon={Plus}
                label={tx('ჩემს წამლებში', 'Add to mine')}
                accessibilityLabel={ka.meds.addMedicationCta}
                onPress={() => router.push({ pathname: '/medications/add/setup', params: catalogProductSetupParams(product) })}
                style={{ flex: 1 }}
              />
            )
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/** One pharmacy: logo · name and stock · the price with its bar · a tap opens the pharmacy's page. */
function PriceRow({ slot, first, isBest, maxPrice, onOpen }: {
  slot: PharmacySourcePrice;
  first: boolean;
  isBest: boolean;
  maxPrice: number;
  onOpen: () => void;
}) {
  const c = useThemeColors();
  const dark = useIsDark();
  const green = hubInk('green', dark);
  const has = slot.priceGel != null;
  const share = has && maxPrice > 0 ? Math.max(0.08, slot.priceGel! / maxPrice) : 0;
  const status = !has
    ? ka.pharmacy.noPrice
    : slot.stale
      ? ka.pharmacy.unconfirmed
      : slot.inStock
        ? ka.pharmacy.inStock
        : ka.pharmacy.notInStock;
  const statusColor = !has ? c.text300 : slot.stale ? c.warning : slot.inStock ? c.success : c.danger;
  const content = (
    <View style={[s.priceRow, isBest && { backgroundColor: hubTint(green, dark) }]}>
      <View style={[s.logo, { backgroundColor: c.bg100 }]}>
        <PharmacySourceLogo sourceId={slot.sourceId} logoUrl={slot.logoUrl} size={24} showFallbackText={false} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text numberOfLines={1} style={[hubText.cardTitle, { color: c.text100, flexShrink: 1 }]}>{slot.nameKa}</Text>
          {isBest ? (
            <View style={[s.bestBadge, { backgroundColor: green }]}>
              <Text style={[s.bestText, { color: dark ? '#052E16' : '#FFFFFF' }]}>{ka.pharmacy.lowest}</Text>
            </View>
          ) : null}
        </View>
        {has ? (
          <View style={[s.track, { backgroundColor: c.bg200 }]}>
            <View style={[s.bar, { width: `${Math.round(share * 100)}%`, backgroundColor: isBest ? green : c.text300 }]} />
          </View>
        ) : null}
        <Text numberOfLines={1} style={[hubText.small, { color: c.text300 }]}>
          <Text style={{ color: statusColor, fontFamily: 'NotoSansGeorgian_600SemiBold' }}>{status}</Text>
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 2, minWidth: 74 }}>
        {has ? (
          <>
            <Text style={[hubText.value, { fontSize: 16, lineHeight: 21, color: isBest ? green : slot.stale || !slot.inStock ? c.text300 : c.text100 }]}>
              {slot.priceGel!.toFixed(2)} ₾
            </Text>
            {!isBest && slot.priceDiffGel != null && slot.priceDiffGel > 0 ? (
              <Text style={[hubText.small, { color: c.danger }]}>{ka.pharmacy.priceDiff(slot.priceDiffGel.toFixed(2))}</Text>
            ) : null}
          </>
        ) : (
          <Text style={[hubText.caption, { color: c.text300 }]}>—</Text>
        )}
      </View>
      {has && slot.sourceUrl ? <ExternalLink size={15} color={c.text300} strokeWidth={2} /> : null}
    </View>
  );
  return (
    <View>
      {first ? null : <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.bg300, marginLeft: HUB.cardPad + 40 + 12 }} />}
      {has && slot.sourceUrl ? (
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={`${slot.nameKa}, ${slot.priceGel!.toFixed(2)} ₾, ${status}`}
          onPress={onOpen}
        >
          {content}
        </Pressable>
      ) : (
        content
      )}
    </View>
  );
}

const s = StyleSheet.create({
  tag: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, marginTop: 2, maxWidth: '100%' },
  pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 12.5, lineHeight: 17 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: HUB.cardPad, paddingVertical: 14 },
  logo: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  bestBadge: { borderRadius: 999, paddingHorizontal: 7, paddingVertical: 1 },
  bestText: { fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 10.5, lineHeight: 15 },
  track: { height: 5, borderRadius: 3, overflow: 'hidden' },
  bar: { height: '100%', borderRadius: 3 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: 10, paddingHorizontal: HUB.gutter, paddingTop: 12 },
});
