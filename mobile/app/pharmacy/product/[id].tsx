import React, { useCallback, useMemo, useState } from 'react';
import { Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Building2, Check, ChevronRight, ExternalLink, FlaskConical, Gauge, Globe, Info, Package, Pill, Plus, RefreshCw, Tag } from 'lucide-react-native';
import { HomeSectionHeading } from '@/components/home/HomeSectionHeading';
import { MedsButton, MedsCard, MedsInfoRow } from '@/components/medications/MedsHubUI';
import { catalogRowMeta } from '@/components/pharmacy/CatalogProductRow';
import { PharmacyProductImage } from '@/components/pharmacy/PharmacyProductImage';
import { PharmacySourceLogo } from '@/components/pharmacy/PharmacySourceLogo';
import { ProductHeroSkeleton } from '@/components/ui/Skeleton';
import { useMedications } from '@/hooks/useMedications';
import { ka } from '@/i18n/ka';
import { tx } from '@/i18n/locale';
import { api, type CatalogAlternative, type CatalogProductDetail } from '@/lib/api';
import { useFeature } from '@/lib/featureFlags';
import { formatRelative } from '@/lib/format';
import { catalogProductSetupParams } from '@/lib/medicationCatalogNav';
import { parseMedicationConfig } from '@/lib/medications.shared';
import { buildCompareSlots, compareRows, compareStats, countriesDiffer, isBestSlot, type CompareRow } from '@/lib/pharmacyCompare';
import { useIsDark, useThemeColors } from '@/theme/colors';
import { HUB, hubInk, hubText, hubTint } from '@/theme/hub';

/**
 * A catalogue medicine: what it is (substance, prescription), the best price and the price of one
 * tablet, every pharmacy side by side (Pharmadepot and GPC — one company, one price list — share a line
 * when their prices agree), other pack sizes and the same substance from other makers, each by the
 * price of one unit. The pinned footer adds it to her medications — or opens it there when it already is.
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

  // A medicine may point at an older id of this product (two listings became one).
  const mine = useMemo(() => {
    if (!product) return undefined;
    const ids = new Set([product.id, String(id), ...(product.aliases ?? [])]);
    return medications.find((med) => ids.has(String(parseMedicationConfig(med.config).catalogProductId ?? '')));
  }, [medications, product, id]);

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
  const rows = compareRows(slots);
  const best = rows.find((row) => isBestSlot(row, product.bestPriceGel));
  const showCountry = countriesDiffer(slots);
  // When the prices were last read — once for the page, so each pharmacy row stays one clear line.
  const lastSync = available.map((slot) => slot.syncedAt).filter(Boolean).sort().pop() ?? null;
  const facts = [product.form, catalogRowMeta(product)].filter((v, i, all) => v && all.indexOf(v) === i).join(' · ');
  const details = [
    product.inn ? { icon: FlaskConical, ink: 'violet' as const, label: ka.pharmacy.activeSubstance, value: product.inn } : null,
    product.manufacturer ? { icon: Building2, ink: 'blue' as const, label: ka.pharmacy.manufacturer, value: product.manufacturer } : null,
    product.country ? { icon: Globe, ink: 'sky' as const, label: ka.pharmacy.country, value: product.country } : null,
    product.form ? { icon: Pill, ink: 'violet' as const, label: ka.pharmacy.form, value: product.form } : null,
    product.strength ? { icon: Gauge, ink: 'amber' as const, label: ka.pharmacy.strength, value: product.strength } : null,
    product.packSize ? { icon: Package, ink: 'green' as const, label: ka.pharmacy.pack, value: product.packLabel ?? product.packSize } : null,
  ].filter(Boolean) as { icon: typeof Pill; ink: 'blue' | 'sky' | 'violet' | 'amber' | 'green'; label: string; value: string }[];

  const openSource = (row: CompareRow) => {
    if (row.sourceUrl) void Linking.openURL(row.sourceUrl);
  };
  const openProduct = (alt: CatalogAlternative) => router.push(`/pharmacy/product/${alt.id}` as never);
  const footerVisible = medsOn || !!best?.sourceUrl;
  const otherPacks = product.otherPacks ?? [];
  const analogues = product.analogues ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: c.bg100 }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: HUB.gutter, paddingTop: 4, paddingBottom: (footerVisible ? 96 : 24) + insets.bottom, gap: HUB.sectionGap - 6 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={green} />}
        showsVerticalScrollIndicator={false}
      >
        {/* What it is: picture, name, the facts on one line, its category and whether it needs a prescription. */}
        <MedsCard style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
          <PharmacyProductImage uri={product.imageUrl} size={84} rounded={20} />
          <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
            <Text accessibilityRole="header" style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 18, lineHeight: 25, color: c.text100 }}>
              {product.name}
            </Text>
            {product.latinName ? <Text numberOfLines={1} style={[hubText.caption, { color: c.text300 }]}>{product.latinName}</Text> : null}
            {facts ? <Text style={[hubText.caption, { color: c.text200 }]}>{facts}</Text> : null}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 }}>
              {product.category ? (
                <View style={[s.tag, { backgroundColor: c.bg200 }]}>
                  <Tag size={11} color={c.text300} strokeWidth={2.4} />
                  <Text numberOfLines={1} style={[hubText.small, { color: c.text200 }]}>{product.category.nameKa}</Text>
                </View>
              ) : null}
              {product.prescription != null ? (
                <View style={[s.tag, { backgroundColor: hubTint(hubInk(product.prescription ? 'amber' : 'green', dark), dark) }]}>
                  <Text style={[hubText.small, { color: hubInk(product.prescription ? 'amber' : 'green', dark), fontFamily: 'NotoSansGeorgian_600SemiBold' }]}>
                    {product.prescription ? ka.pharmacy.prescription : ka.pharmacy.noPrescription}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        </MedsCard>

        {/* The answer first: the lowest price, where, how much it saves, and one tablet's price. */}
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
            {best?.sourceUrl ? (
              // Opens the cheapest pharmacy's page — the one action the footer leaves to this card.
              <Pressable
                accessibilityRole="link"
                accessibilityLabel={tx(`${best.nameKa}-ში გახსნა`, `Open at ${best.nameKa}`)}
                onPress={() => openSource(best)}
                hitSlop={8}
                style={s.bestLink}
              >
                <Text style={[hubText.body, { color: c.text100, flexShrink: 1 }]}>{ka.pharmacy.cheapestAt(best.nameKa)}</Text>
                <ExternalLink size={15} color={green} strokeWidth={2.2} />
              </Pressable>
            ) : best ? (
              <Text style={[hubText.body, { color: c.text100 }]}>{ka.pharmacy.cheapestAt(best.nameKa)}</Text>
            ) : null}
            {product.unitPriceGel != null && product.unitLabel ? (
              <Text style={[hubText.caption, { color: c.text200 }]}>{ka.pharmacy.unitPrice(product.unitPriceGel.toFixed(2), product.unitLabel)}</Text>
            ) : null}
          </MedsCard>
        ) : null}

        {/* Every pharmacy side by side: the bar is the price against the dearest one. */}
        <View>
          <HomeSectionHeading title={`${ka.pharmacy.compareTitle} · ${rows.filter((row) => row.priceGel != null).length}`} />
          {available.length === 0 ? (
            <MedsCard>
              <Text style={[hubText.body, { color: c.text200, textAlign: 'center' }]}>{ka.pharmacy.noOffers}</Text>
            </MedsCard>
          ) : (
            <MedsCard padded={false}>
              {rows.map((row, index) => (
                <PriceRow
                  key={row.sourceIds.join('+')}
                  row={row}
                  first={index === 0}
                  isBest={isBestSlot(row, product.bestPriceGel)}
                  maxPrice={maxPrice ?? Math.max(...available.map((a) => a.priceGel ?? 0))}
                  showCountry={showCountry}
                  onOpen={() => openSource(row)}
                />
              ))}
            </MedsCard>
          )}
        </View>

        {otherPacks.length ? (
          <View>
            <HomeSectionHeading title={ka.pharmacy.otherPacksTitle} />
            <MedsCard padded={false}>
              {otherPacks.map((alt, index) => (
                // The same pack from another maker or country (Concor from Turkey) says where it is from.
                <AlternativeRow key={alt.id} alt={alt} first={index === 0} showMaker={alt.unitCount === product.unitCount} onPress={() => openProduct(alt)} />
              ))}
            </MedsCard>
          </View>
        ) : null}

        {analogues.length ? (
          <View>
            <HomeSectionHeading title={ka.pharmacy.analoguesTitle} />
            <MedsCard padded={false}>
              {analogues.map((alt, index) => (
                <AlternativeRow key={alt.id} alt={alt} first={index === 0} showMaker onPress={() => openProduct(alt)} />
              ))}
              <View style={[s.note, { borderTopColor: c.bg300 }]}>
                <Info size={14} color={c.text300} strokeWidth={2.2} />
                <Text style={[hubText.small, { color: c.text200, flex: 1 }]}>{ka.pharmacy.analoguesNote}</Text>
              </View>
            </MedsCard>
          </View>
        ) : null}

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
          {/* One action, never cut: the cheapest pharmacy opens from the best-price card above. */}
          {!medsOn && best?.sourceUrl ? (
            <MedsButton
              tone="tonal"
              ink="green"
              icon={ExternalLink}
              label={best.nameKa}
              accessibilityLabel={tx(`${best.nameKa}-ში გახსნა`, `Open at ${best.nameKa}`)}
              onPress={() => openSource(best)}
              style={{ flex: 1 }}
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

/** One pharmacy (or Pharmadepot · GPC together): logo · name and stock · the price with its bar · a tap opens its page. */
function PriceRow({ row, first, isBest, maxPrice, showCountry, onOpen }: {
  row: CompareRow;
  first: boolean;
  isBest: boolean;
  maxPrice: number;
  showCountry: boolean;
  onOpen: () => void;
}) {
  const c = useThemeColors();
  const dark = useIsDark();
  const green = hubInk('green', dark);
  const has = row.priceGel != null;
  const share = has && maxPrice > 0 ? Math.max(0.08, row.priceGel! / maxPrice) : 0;
  const status = !has
    ? ka.pharmacy.noPrice
    : row.stale
      ? ka.pharmacy.unconfirmed
      : row.inStock
        ? ka.pharmacy.inStock
        : ka.pharmacy.notInStock;
  const statusColor = !has ? c.text300 : row.stale ? c.warning : row.inStock ? c.success : c.danger;
  const extra = showCountry && row.country ? ka.pharmacy.madeIn(row.country) : null;
  const content = (
    <View style={[s.priceRow, isBest && { backgroundColor: hubTint(green, dark) }]}>
      <View style={[s.logo, { backgroundColor: c.bg100 }]}>
        {row.logos.length > 1 ? (
          <View style={s.logoPair}>
            {row.logos.map((logo) => (
              <PharmacySourceLogo key={logo.sourceId} sourceId={logo.sourceId} logoUrl={logo.logoUrl} size={17} showFallbackText={false} />
            ))}
          </View>
        ) : (
          <PharmacySourceLogo sourceId={row.sourceId} logoUrl={row.logoUrl} size={24} showFallbackText={false} />
        )}
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
        <Text numberOfLines={2} style={[hubText.cardTitle, { color: c.text100 }]}>{row.nameKa}</Text>
        {has ? (
          <View style={[s.track, { backgroundColor: c.bg200 }]}>
            <View style={[s.bar, { width: `${Math.round(share * 100)}%`, backgroundColor: isBest ? green : c.text300 }]} />
          </View>
        ) : null}
        <Text numberOfLines={1} style={[hubText.small, { color: c.text300 }]}>
          <Text style={{ color: statusColor, fontFamily: 'NotoSansGeorgian_600SemiBold' }}>{status}</Text>
          {extra ? ` · ${extra}` : ''}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 2, minWidth: 74 }}>
        {has ? (
          <>
            <Text style={[hubText.value, { fontSize: 16, lineHeight: 21, color: isBest ? green : row.stale || !row.inStock ? c.text300 : c.text100 }]}>
              {row.priceGel!.toFixed(2)} ₾
            </Text>
            {/* The cheapest line is the green one (and named in the card above): no badge to squeeze the name. */}
            {!isBest && row.priceDiffGel != null && row.priceDiffGel > 0 ? (
              <Text style={[hubText.small, { color: c.danger }]}>{ka.pharmacy.priceDiff(row.priceDiffGel.toFixed(2))}</Text>
            ) : null}
          </>
        ) : (
          <Text style={[hubText.caption, { color: c.text300 }]}>—</Text>
        )}
      </View>
      {has && row.sourceUrl ? <ExternalLink size={15} color={c.text300} strokeWidth={2} /> : null}
    </View>
  );
  return (
    <View>
      {first ? null : <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.bg300, marginLeft: HUB.cardPad + 40 + 12 }} />}
      {has && row.sourceUrl ? (
        <Pressable accessibilityRole="link" accessibilityLabel={`${row.nameKa}, ${row.priceGel!.toFixed(2)} ₾, ${status}`} onPress={onOpen}>
          {content}
        </Pressable>
      ) : (
        content
      )}
    </View>
  );
}

/**
 * Another box: picture · name (two lines, never cut short) with who makes it and the price of one unit
 * under it · its price. Only the price sits on the right, so the name keeps the width.
 */
function AlternativeRow({ alt, first, showMaker, onPress }: { alt: CatalogAlternative; first: boolean; showMaker?: boolean; onPress: () => void }) {
  const c = useThemeColors();
  const dark = useIsDark();
  const green = hubInk('green', dark);
  const maker = showMaker ? [alt.manufacturer, alt.country].filter(Boolean).join(' · ') : '';
  // The count is in the name („#30“): the line under it says what one unit costs, or the pack when it can't.
  const pack =
    alt.unitPriceGel != null && alt.unitLabel
      ? ka.pharmacy.unitPrice(alt.unitPriceGel.toFixed(2), alt.unitLabel)
      : alt.packLabel ?? (alt.unitCount ? String(alt.unitCount) : '');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[alt.name, maker, pack, alt.bestPriceGel != null ? `${alt.bestPriceGel.toFixed(2)} ₾` : null].filter(Boolean).join(', ')}
      onPress={onPress}
    >
      {first ? null : <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.bg300, marginLeft: HUB.cardPad + 44 + 12 }} />}
      <View style={s.altRow}>
        <PharmacyProductImage uri={alt.imageUrl} size={44} rounded={14} />
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text numberOfLines={2} style={[hubText.cardTitle, { color: c.text100, fontSize: 14, lineHeight: 20 }]}>{alt.name}</Text>
          {maker ? <Text numberOfLines={1} style={[hubText.small, { color: c.text200 }]}>{maker}</Text> : null}
          {pack ? <Text numberOfLines={1} style={[hubText.small, { color: c.text300 }]}>{pack}</Text> : null}
        </View>
        {alt.bestPriceGel != null ? <Text style={[hubText.value, { fontSize: 14, lineHeight: 19, color: green }]}>{alt.bestPriceGel.toFixed(2)} ₾</Text> : null}
        <ChevronRight size={16} color={c.text300} strokeWidth={2} />
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  tag: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, maxWidth: '100%' },
  pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 12.5, lineHeight: 17 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: HUB.cardPad, paddingVertical: 14 },
  logo: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  logoPair: { flexDirection: 'row', gap: 2, alignItems: 'center' },
  track: { height: 5, borderRadius: 3, overflow: 'hidden' },
  bar: { height: '100%', borderRadius: 3 },
  bestLink: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  altRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: HUB.cardPad, paddingVertical: 12 },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingHorizontal: HUB.cardPad, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', paddingHorizontal: HUB.gutter, paddingTop: 12 },
});
