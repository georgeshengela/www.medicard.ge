import { FETCH_HEADERS, SOURCES } from '../constants.js';
import { factsFromPsp } from '../facts.js';

const BASE = SOURCES.PSP.baseUrl;
const GRAPHQL = 'https://app.psp.ge/graphql';
/** Magento category id for მედიკამენტები (from urlResolver). */
export const PSP_MEDICATION_CATEGORY_ID = '823';
/** Extra PSP categories not under 823 but sold as OTC meds (e.g. Viagra → sexual health). */
export const PSP_EXTRA_CATEGORY_IDS = ['1554', '2035'];

/**
 * The nightly list: price, stock and the structured fields PSP keeps on every product (active
 * substance, dose, form, volume, „30 ტაბლეტი“, country, its categories). ~1 s per 100 products.
 */
const PRODUCTS_QUERY = `
query products($search: String = "", $filter: ProductAttributeFilterInput, $sort: ProductAttributeSortInput, $pageSize: Int, $currentPage: Int) {
  products(search: $search, filter: $filter, sort: $sort, pageSize: $pageSize, currentPage: $currentPage) {
    total_count
    page_info { total_pages current_page page_size }
    items {
      id
      sku
      name
      url_key
      url_suffix
      stock_status
      price_range {
        minimum_price {
          final_price { value currency }
          regular_price { value currency }
          discount { amount_off percent_off }
        }
      }
      small_image { url }
      image { url }
      categories { name }
      moqmedi_nivtiereba
      doza
      migebis_forma
      moculoba
      raodenoba_forma
      country_of_manufacture
    }
  }
}`;

/**
 * Attributes PSP returns only through custom_attributesV2, which costs ~8 s per 100 products: the
 * Georgian/Latin substance pairs, units in the box, maker. Read once per product (facts.enriched).
 */
const ATTRIBUTES_QUERY = `
query attrs($skus: [String], $pageSize: Int) {
  products(filter: { sku: { in: $skus } }, pageSize: $pageSize) {
    items {
      id
      description { html }
      fa: custom_attributesV2(filters: { is_filterable: true }) {
        items { code ... on AttributeValue { value } ... on AttributeSelectedOptions { selected_options { label } } }
      }
      pa: custom_attributesV2(filters: { is_html_allowed_on_front: false }) {
        items { code ... on AttributeValue { value } }
      }
    }
  }
}`;

const ATTRIBUTE_CODES = new Set(['generics2', 'units', 'custom_manufacturer', 'drug_forms', 'med_dosage', 'product_country']);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function graphql(query, variables = {}, timeoutMs = 30_000) {
  const res = await fetch(GRAPHQL, {
    method: 'POST',
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      ...FETCH_HEADERS,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Origin: BASE,
      Referer: `${BASE}/`,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) throw new Error(`PSP GraphQL HTTP ${res.status}`);
  const json = await res.json();
  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join('; '));
  }
  return json.data;
}

function buildProductUrl(item) {
  const suffix = item.url_suffix || '.html';
  const key = item.url_key || item.sku || String(item.id);
  return `${BASE}/${encodeURIComponent(key)}${suffix.startsWith('.') ? suffix : `.${suffix}`}`;
}

export function mapPspProduct(item, categoryId = null) {
  const min = item.price_range?.minimum_price;
  const priceGel = min?.final_price?.value ?? null;
  if (priceGel == null || priceGel <= 0) return null;

  const regular = min?.regular_price?.value ?? null;
  const oldPriceGel = regular != null && regular > priceGel ? regular : null;
  const discountPercent = min?.discount?.percent_off ?? null;

  return {
    sourceId: 'PSP',
    sourceProductId: String(item.id),
    rawName: String(item.name || '').replace(/\s+/g, ' ').trim(),
    priceGel,
    oldPriceGel,
    discountPercent: discountPercent != null ? Math.round(discountPercent) : null,
    inStock: item.stock_status !== 'OUT_OF_STOCK',
    imageUrl: item.small_image?.url || item.image?.url || null,
    sourceUrl: buildProductUrl(item),
    categoryId,
    facts: { ...factsFromPsp(item), sku: item.sku ? String(item.sku) : null },
  };
}

export async function closePspBrowser() {
  // PSP uses GraphQL — no browser session.
}

async function fetchPspCategory(categoryId, { maxPages, pageSize, onProgress, seen, all }) {
  const first = await graphql(PRODUCTS_QUERY, {
    filter: { category_id: { eq: String(categoryId) } },
    pageSize,
    currentPage: 1,
  });

  const totalPages = Math.min(first?.products?.page_info?.total_pages ?? 1, maxPages);
  console.log(
    `[psp] category ${categoryId}: ${first?.products?.total_count ?? 0} products, ${totalPages} pages`,
  );

  for (let page = 1; page <= totalPages; page += 1) {
    const data =
      page === 1
        ? first
        : await graphql(PRODUCTS_QUERY, {
            filter: { category_id: { eq: String(categoryId) } },
            pageSize,
            currentPage: page,
          });

    for (const item of data?.products?.items || []) {
      const mapped = mapPspProduct(item, null);
      if (!mapped || seen.has(mapped.sourceProductId)) continue;
      seen.add(mapped.sourceProductId);
      all.push(mapped);
    }

    onProgress?.(all.length);
    if (page < totalPages) await sleep(200);
  }
}

/**
 * Fetch PSP medications via Magento GraphQL (app.psp.ge).
 */
export async function fetchPspProducts(opts = {}) {
  const { maxPages = 50, onProgress } = opts;
  const pageSize = 100;
  const all = [];
  const seen = new Set();
  const categoryIds = [...new Set([PSP_MEDICATION_CATEGORY_ID, ...PSP_EXTRA_CATEGORY_IDS])];

  for (const catId of categoryIds) {
    await fetchPspCategory(catId, { maxPages, pageSize, onProgress, seen, all });
  }
  return all;
}

/**
 * Whether the leaflet says the medicine needs a prescription. PSP has no field for it; the leaflet's
 * „გაცემის პირობები“ does („II ჯგუფი, გაიცემა ფორმა №3 რეცეპტით“, „III ჯგუფი, გაიცემა რეცეპტის
 * გარეშე“). Null when the leaflet does not say.
 */
export function prescriptionFromLeaflet(html) {
  const text = String(html || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
  if (!text) return null;
  // Only the dispensing rule counts — every patient leaflet also says „თუ იყენებთ რეცეპტით გაცემულ ან
  // ურეცეპტოდ გაცემულ მედიკამენტს…“, which says nothing about this medicine.
  const rx =
    /(?<![IV])I{1,2}\s*ჯგუფ|ჯგუფი?\s*I{1,2}(?![IV\w])|ფორმა\s*(?:№|N|#)\s*[13]\s*(?:-?ით\s*)?რეცეპტ|გაიცემა\s+(?:ექიმის\s+)?(?:ფორმა\s*(?:№|N|#)?\s*\d+\s*)?რეცეპტით|რეცეპტით\s+გაიცემა/;
  const otc = /III\s*ჯგუფ|ჯგუფი?\s*III(?![\w])|გაიცემა\s+(?:ექიმის\s+)?რეცეპტის\s+გარეშე|რეცეპტის\s+გარეშე\s+გაიცემა|გაიცემა\s+ურეცეპტოდ|ურეცეპტოდ\s+გაიცემა/;
  if (rx.test(text)) return true;
  if (otc.test(text)) return false;
  return null;
}

/** custom_attributesV2 items → { code: value | [labels] } for the codes we use, plus the leaflet's Rx. */
export function pspAttributes(item) {
  const out = {};
  for (const a of [...(item.fa?.items || []), ...(item.pa?.items || [])]) {
    if (!ATTRIBUTE_CODES.has(a.code)) continue;
    out[a.code] = a.value ?? (a.selected_options || []).map((o) => o.label);
  }
  out.rx = prescriptionFromLeaflet(item.description?.html);
  return out;
}

/**
 * The slow attributes for products not read before: `skus` in batches of 40, three batches at a
 * time (one batch takes 5–45 s on PSP's side). Returns Map(sourceProductId → attrs). A failed batch
 * is skipped (tried again the next night).
 */
export async function fetchPspAttributes(skus, { onProgress } = {}) {
  const out = new Map();
  const batches = [];
  for (let i = 0; i < skus.length; i += 40) batches.push(skus.slice(i, i + 40));
  let done = 0;
  const one = async (batch, n) => {
    try {
      const data = await graphql(ATTRIBUTES_QUERY, { skus: batch, pageSize: batch.length }, 120_000);
      for (const item of data?.products?.items || []) out.set(String(item.id), pspAttributes(item));
    } catch (err) {
      console.warn(`[psp] attributes batch ${n + 1} failed: ${err?.message || err}`);
    }
    done += batch.length;
    onProgress?.(done);
  };
  for (let i = 0; i < batches.length; i += 3) {
    await Promise.all(batches.slice(i, i + 3).map((b, k) => one(b, i + k)));
    await sleep(300);
  }
  return out;
}
