import 'dotenv/config';
import { mapPspProduct } from '../src/lib/pharmacy/sources/psp.js';
import { upsertOfferFromListing, recomputeProductPricing } from '../src/lib/pharmacy/match.js';
import { invalidateCrossSourceIndex } from '../src/lib/pharmacy/crossMatch.js';
import { prisma } from '../src/lib/prisma.js';

// Quick ingest for PSP products missing from category 823 (e.g. Viagra).
const QUERY = `
query products($search: String!, $pageSize: Int) {
  products(search: $search, pageSize: $pageSize) {
    items {
      id sku name url_key url_suffix stock_status
      price_range { minimum_price { final_price { value } regular_price { value } discount { percent_off } } }
      small_image { url } image { url }
    }
  }
}`;

async function fetchSearch(q) {
  const res = await fetch('https://app.psp.ge/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query: QUERY, variables: { search: q, pageSize: 20 } }),
  });
  const json = await res.json();
  return json.data?.products?.items ?? [];
}

const items = await fetchSearch('ვიაგრ');
console.log('Found', items.length, 'PSP items');
const touched = new Set();
for (const item of items) {
  const listing = mapPspProduct(item, null);
  if (!listing) continue;
  const id = await upsertOfferFromListing(listing);
  touched.add(id);
  console.log('Upserted', listing.rawName, listing.priceGel);
}
for (const id of touched) await recomputeProductPricing(id);
invalidateCrossSourceIndex();
console.log('Done', touched.size, 'products');
await prisma.$disconnect();
