import React from 'react';
import { MedCatalogBrowser } from '@/components/pharmacy/MedCatalogBrowser';

/** Price comparison: the shared MEDIPILL catalogue, cheapest first. */
export default function PharmacyIndexScreen() {
  return <MedCatalogBrowser sort="best_price" />;
}
