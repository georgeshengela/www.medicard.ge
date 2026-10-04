import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { PharmacyProductImage } from '@/components/pharmacy/PharmacyProductImage';
import { ka } from '@/i18n/ka';
import { tx } from '@/i18n/locale';
import type { CatalogProductSummary } from '@/lib/api';
import { useIsDark, useThemeColors } from '@/theme/colors';
import { HUB, hubInk, hubText, hubTint } from '@/theme/hub';

/** Short facts that fit one line: strength and pack, else the form, else the category. */
export function catalogRowMeta(product: CatalogProductSummary): string {
  const facts = [product.strength, product.packSize ? `${product.packSize}${/\D/.test(product.packSize) ? '' : tx(' ც', ' pcs')}` : null].filter(Boolean);
  if (facts.length) return facts.join(' · ');
  return product.form || product.category?.nameKa || '';
}

/**
 * One catalogue product as a list row (MEDIPILL search, pharmacy catalogue, category, hub): picture ·
 * name and its strength/pack · the best price in green with how many pharmacies sell it.
 */
export function CatalogProductRow({ product, onPress, first }: { product: CatalogProductSummary; onPress: () => void; first?: boolean }) {
  const c = useThemeColors();
  const dark = useIsDark();
  const green = hubInk('green', dark);
  const meta = catalogRowMeta(product);
  const offers = (product.sourcePrices ?? []).filter((s) => s.priceGel != null).length || product.offerCount || 0;
  const price = product.bestPriceGel;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[product.name, meta, price != null ? `${price.toFixed(2)} ₾` : null].filter(Boolean).join(', ')}
      onPress={onPress}
    >
      {first ? null : <View style={[s.divider, { backgroundColor: c.bg300 }]} />}
      <View style={s.row}>
        <PharmacyProductImage uri={product.imageUrl} size={52} rounded={16} />
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text numberOfLines={2} style={[hubText.cardTitle, { color: c.text100 }]}>
            {product.name}
          </Text>
          {meta ? (
            <Text numberOfLines={1} style={[hubText.caption, { color: c.text200 }]}>
              {meta}
            </Text>
          ) : null}
        </View>
        {price != null ? (
          <View style={{ alignItems: 'flex-end', gap: 3 }}>
            <Text style={[hubText.value, { fontSize: 15, lineHeight: 20, color: green }]}>{price.toFixed(2)} ₾</Text>
            {product.savingsPercent ? (
              <View style={[s.save, { backgroundColor: hubTint(green, dark) }]}>
                <Text style={[s.saveText, { color: green }]}>{ka.pharmacy.savings(product.savingsPercent)}</Text>
              </View>
            ) : offers > 1 ? (
              <Text style={[hubText.small, { color: c.text300 }]}>{ka.pharmacy.offersCount(offers)}</Text>
            ) : null}
          </View>
        ) : (
          <ChevronRight size={18} color={c.text300} strokeWidth={2} />
        )}
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  divider: { height: StyleSheet.hairlineWidth, marginLeft: HUB.cardPad + 52 + 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: HUB.cardPad, paddingVertical: 12 },
  save: { borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
  saveText: { fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 11, lineHeight: 15 },
});
