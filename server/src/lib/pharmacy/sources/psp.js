import { FETCH_HEADERS, SOURCES } from '../constants.js';

const BASE = SOURCES.PSP.baseUrl;
const GRAPHQL = 'https://app.psp.ge/graphql';
/** Magento category id for მედიკამენტები (from urlResolver). */
export const PSP_MEDICATION_CATEGORY_ID = '823';

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
    }
  }
}`;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function graphql(query, variables = {}) {
  const res = await fetch(GRAPHQL, {
    method: 'POST',
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
  };
}

/** Parse legacy HTML listings (kept for tests / fallback). */
export function parsePspListingHtml(html, categoryId = null) {
  void html;
  void categoryId;
  return [];
}

export async function closePspBrowser() {
  // PSP uses GraphQL — no browser session.
}

/**
 * Fetch PSP medications via Magento GraphQL (app.psp.ge).
 */
export async function fetchPspProducts(opts = {}) {
  const { maxPages = 50, categoryId = null, onProgress } = opts;
  const pageSize = 100;
  const all = [];
  const seen = new Set();

  const first = await graphql(PRODUCTS_QUERY, {
    filter: { category_id: { eq: PSP_MEDICATION_CATEGORY_ID } },
    pageSize,
    currentPage: 1,
  });

  const totalPages = Math.min(first?.products?.page_info?.total_pages ?? 1, maxPages);
  console.log(`[psp] category ${PSP_MEDICATION_CATEGORY_ID}: ${first?.products?.total_count ?? 0} products, ${totalPages} pages`);

  for (let page = 1; page <= totalPages; page += 1) {
    const data =
      page === 1
        ? first
        : await graphql(PRODUCTS_QUERY, {
            filter: { category_id: { eq: PSP_MEDICATION_CATEGORY_ID } },
            pageSize,
            currentPage: page,
          });

    for (const item of data?.products?.items || []) {
      const mapped = mapPspProduct(item, categoryId);
      if (!mapped || seen.has(mapped.sourceProductId)) continue;
      seen.add(mapped.sourceProductId);
      all.push(mapped);
    }

    onProgress?.(all.length);
    if (page < totalPages) await sleep(200);
  }

  return all;
}
