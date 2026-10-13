import React from 'react';
import { MedCatalogBrowser } from '@/components/pharmacy/MedCatalogBrowser';

/** Price comparison: the shared MEDIPILL catalogue, boxes sold by both pharmacy chains first. */
export default function PharmacyIndexScreen() {
  return <MedCatalogBrowser sort="popular" />;
}
