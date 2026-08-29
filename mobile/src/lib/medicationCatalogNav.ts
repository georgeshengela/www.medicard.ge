import type { CatalogProductSummary } from '@/lib/api';

export function catalogProductSetupParams(product: CatalogProductSummary) {
  return {
    name: product.name,
    generic: product.manufacturer ?? product.strength ?? '',
    imageUrl: product.imageUrl ? encodeURIComponent(product.imageUrl) : '',
    catalogProductId: product.id,
    manufacturer: product.manufacturer ?? '',
    strength: product.strength ?? '',
    formLabel: product.form ?? '',
  };
}

export function catalogProductMeta(product: CatalogProductSummary) {
  return [product.form, product.strength, product.manufacturer].filter(Boolean).join(' · ');
}
