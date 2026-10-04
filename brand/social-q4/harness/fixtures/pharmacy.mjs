// MEDIPILL price comparison: /pharmacy (MedCatalogBrowser sort=best_price), /pharmacy/category/[slug],
// /pharmacy/product/[id], the medications hub's catalogue preview (sort=name&limit=3) and the medication
// picture lookup (useMedicationImages: q=<medName>&limit=5).
//
// Shapes: server/src/routes/pharmacy.routes.js (mapProduct, categories, meta/sync — the router has no auth),
// lib/pharmacy/crossMatch.js (pricingFromOffers, buildSourcePricesFromOffers), lib/pharmacy/constants.js
// (SOURCES, SOURCE_ORDER = PSP, PHARMADEPOT, GPC; Aversi retired 2026-09-30), lib/pharmacy/categories.js.
// Client types: mobile/src/lib/api.ts CatalogProductSummary / CatalogProductDetail / PharmacySourcePrice.
//
// imageUrl is null everywhere (the app draws its pill placeholder; a picture would also replace the pill
// art on the medications screens through useMedicationImages). Source logoUrl is null too — note the app
// still falls back to its own constant favicons (mobile/src/constants/pharmacyVisuals.ts → psp.ge,
// pharmadepot.ge, gpc.ge); when the browser cannot load them it shows coloured initials.
// An unfiltered list reports the production-sized catalogue total (the app loads only the first 40 rows,
// exactly like production); a category reports its chip count; a search reports the real matches.
import { uuidFrom } from './_mockkit.mjs';

const SOURCES = {
  // Poster rule: no real pharmacy chain names on screen — neutral labels (ids unchanged).
  PSP: { id: 'PSP', nameKa: 'ცენტრის აფთიაქი', baseUrl: 'https://example.ge', logoUrl: null },
  PHARMADEPOT: { id: 'PHARMADEPOT', nameKa: 'ვაკის აფთიაქი', baseUrl: 'https://example.ge', logoUrl: null },
  GPC: { id: 'GPC', nameKa: 'დიდუბის აფთიაქი', baseUrl: 'https://example.ge', logoUrl: null },
};
const SOURCE_ORDER = ['PSP', 'PHARMADEPOT', 'GPC'];
const CATALOG_TOTAL = 3486;

/** Pharmadepot medication subcategories (server/src/lib/pharmacy/categories.js) with believable product counts. */
const SUBCATEGORIES = [
  ['immunology', 'იმუნოლოგია', 1, 64], ['ear-drops', 'ყურის წვეთები', 2, 18], ['endocrinology', 'ენდოკრინოლოგია', 3, 71],
  ['erectile', 'ერექციული დისფუნქცია', 4, 22], ['sedatives', 'დამამშვიდებელი საშუალებები', 5, 47], ['diabetes', 'დიაბეტური მედიკამენტები', 6, 83],
  ['eye-drops', 'თვალის წვეთები და მალამოები', 7, 96], ['painkillers', 'ტკივილგამაყუჩებელი საშუალებები', 8, 154], ['gastro', 'გასტროენტეროლოგია', 9, 268],
  ['antiseptic', 'ანტისეპტიკური საშუალებები', 10, 58], ['corticosteroids', 'კორტიკოსტეროიდები', 11, 39], ['musculoskeletal', 'ძვალ კუნთოვანი სისტემა', 12, 121],
  ['allergy', 'ალერგია', 13, 76], ['blood', 'სისხლწარმოქმნა და სისხლი', 14, 52], ['antiinfective', 'ინფექციის საწინააღმდეგო საშუალებები და ვაქცინები', 15, 237],
  ['gynecology', 'გინეკოლოგია და უროლოგია', 16, 143], ['antiparasitic', 'პარაზიტების საწინააღმდეგო პრეპარატები', 17, 21], ['oncology', 'ონკოლოგია და ბიოტექნოლოგია', 18, 34],
  ['solvents', 'გამხსნელები', 19, 12], ['vitamins', 'ვიტამინები და მინერალები', 20, 312], ['nervous', 'ნერვული სისტემა', 21, 289],
  ['cardio', 'გულ სისხლძარღვთა სისტემა', 22, 347], ['dermatology', 'დერმატოლოგია', 23, 198], ['respiratory', 'სასუნთქი სისტემა', 24, 176],
  ['ear-disease', 'ყურის დაავადებების მკურნალობისთვის', 25, 9], ['hemorrhoids', 'ჰემოროიდული პრეპარატები', 26, 17],
];
const PARENT = { id: uuidFrom('drugcat:medikamentebi'), slug: 'medikamentebi', nameKa: 'მედიკამენტები' };
const CATEGORY = Object.fromEntries(SUBCATEGORIES.map(([slug, nameKa, sortOrder, count]) => [slug, { id: uuidFrom(`drugcat:${slug}`), slug, nameKa, sortOrder, count }]));

// [slug, name, manufacturer, country, form, strength, packSize, category, { PSP, PHARMADEPOT, GPC }, options]
// price: number (in stock), [price, 'out'] (listed, not in stock), [price, oldPrice] (on sale), null (not sold there).
const PRODUCTS = [
  ['vitamin-d3-2000-iu-60', 'ვიტამინი D3 2000 სე', 'Solgar', 'აშშ', 'კაფსულა', '2000 სე', '60 კაფსულა', 'vitamins', { PSP: 24.9, PHARMADEPOT: [21.45, 23.9], GPC: 23.6 },
    'ვიტამინი D3 (ქოლეკალციფეროლი) ძვლებისა და იმუნიტეტისთვის. სასურველია ჭამასთან ერთად.'],
  ['magnesium-b6-50', 'მაგნიუმი B6', 'Zentiva', 'ჩეხეთი', 'ტაბლეტი', '470 მგ + 5 მგ', '50 ტაბლეტი', 'vitamins', { PSP: 14.3, PHARMADEPOT: 15.1, GPC: 13.85 },
    'მაგნიუმის ლაქტატი და პირიდოქსინი (ვიტამინი B6).'],
  ['omega-3-1000-60', 'ომეგა-3 1000 მგ', 'Doppelherz', 'გერმანია', 'კაფსულა', '1000 მგ', '60 კაფსულა', 'vitamins', { PSP: 27.5, PHARMADEPOT: 29.9, GPC: [31.2, 'out'] },
    'თევზის ცხიმი EPA და DHA ომეგა-3 ცხიმოვანი მჟავებით.'],
  ['metformin-500-60', 'მეტფორმინი 500 მგ', 'Teva', 'ისრაელი', 'ტაბლეტი', '500 მგ', '60 ტაბლეტი', 'diabetes', { PSP: 6.4, PHARMADEPOT: 5.95, GPC: 6.8 },
    'გაიცემა ფარმაცევტის მიერ რეცეპტით.'],
  ['vitamin-d3-1000-iu-120', 'ვიტამინი D3 1000 სე', "Nature's Bounty", 'აშშ', 'ტაბლეტი', '1000 სე', '120 ტაბლეტი', 'vitamins', { PSP: 18.9, PHARMADEPOT: 17.4, GPC: null }, null],
  ['vitamin-d3-drops-10ml', 'ვიტამინი D3 წვეთები', 'Medana Pharma', 'პოლონეთი', 'წვეთები', '500 სე/წვეთი', '10 მლ', 'vitamins', { PSP: 9.8, PHARMADEPOT: 8.95, GPC: 9.4 }, null],
  ['vitamin-c-1000-20', 'ვიტამინი C 1000 მგ, შუშხუნა', 'Hermes Arzneimittel', 'გერმანია', 'შუშხუნა ტაბლეტი', '1000 მგ', '20 ტაბლეტი', 'vitamins', { PSP: 7.9, PHARMADEPOT: 8.4, GPC: 7.65 }, null],
  ['vitamin-b12-1000-60', 'ვიტამინი B12 1000 მკგ', 'Solgar', 'აშშ', 'ტაბლეტი', '1000 მკგ', '60 ტაბლეტი', 'vitamins', { PSP: 32.4, PHARMADEPOT: 29.9, GPC: 31.0 }, null],
  ['folic-acid-400-50', 'ფოლიუმის მჟავა 400 მკგ', 'GMP', 'საქართველო', 'ტაბლეტი', '400 მკგ', '50', 'vitamins', { PSP: 3.2, PHARMADEPOT: 2.95, GPC: 3.1 }, null],
  ['zinc-25-30', 'თუთია 25 მგ', 'Solgar', 'აშშ', 'ტაბლეტი', '25 მგ', '30 ტაბლეტი', 'vitamins', { PSP: 11.2, PHARMADEPOT: 12.1, GPC: 10.9 }, null],
  ['multivitamin-30', 'მულტივიტამინი', 'Bayer', 'გერმანია', 'ტაბლეტი', null, '30 ტაბლეტი', 'vitamins', { PSP: 22.6, PHARMADEPOT: 24.1, GPC: 23.3 }, null],
  ['iron-bisglycinate-25-30', 'რკინის ბისგლიცინატი 25 მგ', 'Solgar', 'აშშ', 'კაფსულა', '25 მგ', '30 კაფსულა', 'blood', { PSP: 26.3, PHARMADEPOT: 24.8, GPC: null }, null],
  ['magnesium-citrate-400-60', 'მაგნიუმის ციტრატი 400 მგ', 'Doppelherz', 'გერმანია', 'ტაბლეტი', '400 მგ', '60 ტაბლეტი', 'vitamins', { PSP: 19.4, PHARMADEPOT: 18.2, GPC: null }, null],
  ['calcium-d3-60', 'კალციუმი + D3', 'Takeda', 'ნორვეგია', 'საღეჭი ტაბლეტი', '500 მგ + 200 სე', '60 ტაბლეტი', 'vitamins', { PSP: 14.7, PHARMADEPOT: 13.9, GPC: 15.2 }, null],
  ['omega-3-kids-150ml', 'ომეგა-3 ბავშვებისთვის, სიროფი', "Möller's", 'ნორვეგია', 'სიროფი', null, '150 მლ', 'vitamins', { PSP: 34.9, PHARMADEPOT: 36.5, GPC: 33.8 }, null],
  ['paracetamol-500-20', 'პარაცეტამოლი 500 მგ', 'GMP', 'საქართველო', 'ტაბლეტი', '500 მგ', '20', 'painkillers', { PSP: 1.35, PHARMADEPOT: 1.2, GPC: 1.45 }, null],
  ['ibuprofen-400-20', 'იბუპროფენი 400 მგ', 'Berlin-Chemie', 'გერმანია', 'ტაბლეტი', '400 მგ', '20', 'painkillers', { PSP: 4.6, PHARMADEPOT: 4.95, GPC: 4.3 }, null],
  ['aspirin-cardio-100-28', 'ასპირინი კარდიო 100 მგ', 'Bayer', 'გერმანია', 'ტაბლეტი', '100 მგ', '28', 'cardio', { PSP: 5.9, PHARMADEPOT: 5.4, GPC: 6.2 }, null],
  ['atorvastatin-20-30', 'ატორვასტატინი 20 მგ', 'Teva', 'ისრაელი', 'ტაბლეტი', '20 მგ', '30', 'cardio', { PSP: 12.8, PHARMADEPOT: 11.95, GPC: 13.4 }, null],
  ['amlodipine-5-30', 'ამლოდიპინი 5 მგ', 'KRKA', 'სლოვენია', 'ტაბლეტი', '5 მგ', '30', 'cardio', { PSP: 4.8, PHARMADEPOT: 5.2, GPC: 4.55 }, null],
  ['bisoprolol-5-30', 'ბისოპროლოლი 5 მგ', 'Merck', 'გერმანია', 'ტაბლეტი', '5 მგ', '30', 'cardio', { PSP: 7.4, PHARMADEPOT: 6.9, GPC: 7.8 }, null],
  ['losartan-50-30', 'ლოზარტანი 50 მგ', 'KRKA', 'სლოვენია', 'ტაბლეტი', '50 მგ', '30', 'cardio', { PSP: 6.2, PHARMADEPOT: 6.6, GPC: 5.95 }, null],
  ['metformin-850-60', 'მეტფორმინი 850 მგ', 'Teva', 'ისრაელი', 'ტაბლეტი', '850 მგ', '60', 'diabetes', { PSP: 7.9, PHARMADEPOT: 7.35, GPC: 8.1 }, null],
  ['omeprazole-20-30', 'ომეპრაზოლი 20 მგ', 'KRKA', 'სლოვენია', 'კაფსულა', '20 მგ', '30', 'gastro', { PSP: 5.6, PHARMADEPOT: 5.1, GPC: 5.85 }, null],
  ['pancreatin-25000-20', 'პანკრეატინი 25000 ერთ.', 'Berlin-Chemie', 'გერმანია', 'კაფსულა', '25000 ერთ.', '20', 'gastro', { PSP: 17.9, PHARMADEPOT: 16.75, GPC: 18.4 }, null],
  ['pantoprazole-40-28', 'პანტოპრაზოლი 40 მგ', 'Takeda', 'გერმანია', 'ტაბლეტი', '40 მგ', '28', 'gastro', { PSP: 15.3, PHARMADEPOT: 14.6, GPC: null }, null],
  ['loperamide-2-20', 'ლოპერამიდი 2 მგ', 'GMP', 'საქართველო', 'კაფსულა', '2 მგ', '20', 'gastro', { PSP: 2.3, PHARMADEPOT: 2.1, GPC: 2.45 }, null],
  ['loratadine-10-10', 'ლორატადინი 10 მგ', 'GMP', 'საქართველო', 'ტაბლეტი', '10 მგ', '10', 'allergy', { PSP: 2.4, PHARMADEPOT: 2.2, GPC: 2.55 }, null],
  ['cetirizine-10-20', 'ცეტირიზინი 10 მგ', 'Zentiva', 'ჩეხეთი', 'ტაბლეტი', '10 მგ', '20', 'allergy', { PSP: 6.3, PHARMADEPOT: 5.85, GPC: 6.1 }, null],
  ['acetylcysteine-600-10', 'აცეტილცისტეინი 600 მგ, შუშხუნა', 'Hexal', 'გერმანია', 'შუშხუნა ტაბლეტი', '600 მგ', '10', 'respiratory', { PSP: 9.6, PHARMADEPOT: 8.9, GPC: 9.95 }, null],
  ['xylometazoline-spray-10ml', 'ქსილომეტაზოლინი 0.1%, ცხვირის სპრეი', 'Novartis', 'შვეიცარია', 'სპრეი', '0.1%', '10 მლ', 'respiratory', { PSP: 6.9, PHARMADEPOT: 7.4, GPC: 6.6 }, null],
  ['bromhexine-8-20', 'ბრომჰექსინი 8 მგ', 'Berlin-Chemie', 'გერმანია', 'ტაბლეტი', '8 მგ', '20', 'respiratory', { PSP: 3.6, PHARMADEPOT: 3.3, GPC: 3.75 }, null],
  ['valerian-20-50', 'ვალერიანის ექსტრაქტი 20 მგ', 'GMP', 'საქართველო', 'ტაბლეტი', '20 მგ', '50', 'sedatives', { PSP: 2.1, PHARMADEPOT: 1.95, GPC: 2.25 }, null],
  ['melatonin-3-30', 'მელატონინი 3 მგ', 'Natrol', 'აშშ', 'ტაბლეტი', '3 მგ', '30', 'nervous', { PSP: 12.9, PHARMADEPOT: 13.6, GPC: 12.4 }, null],
  ['diclofenac-gel-50', 'დიკლოფენაკი 1% გელი', 'Novartis', 'შვეიცარია', 'გელი', '1%', '50 გ', 'musculoskeletal', { PSP: 8.7, PHARMADEPOT: 8.1, GPC: 9.2 }, null],
  ['chlorhexidine-100ml', 'ქლორჰექსიდინი 0.05%', 'GMP', 'საქართველო', 'ხსნარი', '0.05%', '100 მლ', 'antiseptic', { PSP: 1.1, PHARMADEPOT: 0.95, GPC: 1.2 }, null],
  ['artificial-tears-10ml', 'ხელოვნური ცრემლი, თვალის წვეთები', 'Santen', 'ფინეთი', 'წვეთები', null, '10 მლ', 'eye-drops', { PSP: 11.4, PHARMADEPOT: 10.6, GPC: 11.9 }, null],
  ['levothyroxine-50-50', 'L-თიროქსინი 50 მკგ', 'Berlin-Chemie', 'გერმანია', 'ტაბლეტი', '50 მკგ', '50', 'endocrinology', { PSP: 4.3, PHARMADEPOT: 3.95, GPC: 4.5 }, null],
  ['amoxicillin-500-16', 'ამოქსიცილინი 500 მგ', 'Sandoz', 'ავსტრია', 'კაფსულა', '500 მგ', '16', 'antiinfective', { PSP: 5.4, PHARMADEPOT: 4.95, GPC: 5.7 }, null],
  ['echinacea-100-20', 'ექინაცეა 100 მგ', 'Doppelherz', 'გერმანია', 'ტაბლეტი', '100 მგ', '20', 'immunology', { PSP: 10.5, PHARMADEPOT: 11.2, GPC: 9.9 }, null],
];

const round2 = (n) => Math.round(n * 100) / 100;

function offersFor(row, now) {
  const [slug, name, , , , , , , prices] = row;
  const offers = [];
  SOURCE_ORDER.forEach((sourceId, i) => {
    const p = prices[sourceId];
    if (p == null) return;
    const [priceGel, extra] = Array.isArray(p) ? p : [p, null];
    const oldPriceGel = typeof extra === 'number' ? extra : null;
    // Each pharmacy was re-read by its sync a few hours ago (never stale → can be "the best").
    const syncedAt = new Date(now - (2 + i * 1.5) * 3600_000 - (slug.length % 7) * 60_000).toISOString();
    offers.push({
      id: uuidFrom(`offer:${slug}:${sourceId}`),
      sourceId,
      priceGel,
      oldPriceGel,
      discountPercent: oldPriceGel ? Math.round(((oldPriceGel - priceGel) / oldPriceGel) * 100) : null,
      inStock: extra !== 'out',
      sourceUrl: `${SOURCES[sourceId].baseUrl}/product/${slug}`,
      rawName: name,
      imageUrl: null,
      syncedAt,
    });
  });
  return offers;
}

const comparable = (o) => o.priceGel > 0 && o.inStock !== false;

/** crossMatch.pricingFromOffers */
function pricing(offers) {
  const priced = offers.filter(comparable).sort((a, b) => a.priceGel - b.priceGel);
  if (!priced.length) return { bestPriceGel: null, bestSourceId: null, offerCount: 0, savingsPercent: null };
  const min = priced[0].priceGel;
  const max = priced[priced.length - 1].priceGel;
  return {
    bestPriceGel: min,
    bestSourceId: priced[0].sourceId,
    offerCount: new Set(priced.map((o) => o.sourceId)).size,
    savingsPercent: priced.length > 1 && max > min ? Math.round(((max - min) / max) * 100) : null,
  };
}

/** crossMatch.buildSourcePricesFromOffers */
function sourcePrices(offers, bestId) {
  const byId = Object.fromEntries(offers.map((o) => [o.sourceId, o]));
  const priced = offers.filter(comparable).map((o) => o.priceGel);
  const minPrice = priced.length ? Math.min(...priced) : null;
  return SOURCE_ORDER.map((sourceId) => {
    const offer = byId[sourceId];
    const priceGel = offer?.priceGel ?? null;
    const isBest = bestId === sourceId && offer != null;
    return {
      sourceId,
      nameKa: SOURCES[sourceId].nameKa,
      logoUrl: SOURCES[sourceId].logoUrl,
      priceGel,
      oldPriceGel: offer?.oldPriceGel ?? null,
      inStock: offer?.inStock ?? false,
      stale: false,
      syncedAt: offer?.syncedAt ?? null,
      isBest,
      sourceUrl: offer?.sourceUrl ?? null,
      priceDiffGel: priceGel != null && minPrice != null && !isBest && offer?.inStock !== false && priceGel > minPrice ? round2(priceGel - minPrice) : null,
    };
  });
}

/** pharmacy.routes.js mapProduct */
function mapProduct(row, now, includeOffers = false) {
  const [slug, name, manufacturer, country, form, strength, packSize, categorySlug, , description] = row;
  const offers = offersFor(row, now);
  const p = pricing(offers);
  const category = CATEGORY[categorySlug];
  const payload = {
    id: uuidFrom(`catalog:${slug}`),
    slug,
    name,
    imageUrl: null,
    manufacturer,
    country,
    form,
    strength,
    packSize,
    description: description ?? null,
    category: category ? { id: category.id, slug: category.slug, nameKa: category.nameKa } : null,
    bestPriceGel: p.bestPriceGel,
    bestSource: p.bestSourceId ? { ...SOURCES[p.bestSourceId] } : null,
    offerCount: p.offerCount,
    savingsPercent: p.savingsPercent,
    sourcePrices: sourcePrices(offers, p.bestSourceId),
    lastSyncedAt: offers.map((o) => o.syncedAt).sort().pop() ?? null,
  };
  if (includeOffers) {
    payload.offers = offers
      .map(({ sourceId, ...o }) => ({ ...o, source: { ...SOURCES[sourceId] } }))
      .sort((a, b) => a.priceGel - b.priceGel);
  }
  return payload;
}

/** Stable ids for the report / screenshots. */
export const PHARMACY_IDS = Object.fromEntries(PRODUCTS.map((row) => [row[0], uuidFrom(`catalog:${row[0]}`)]));

export function init(state) {
  state.pharmacy = { syncedHoursAgo: 2 };
}

const fold = (s) => String(s ?? '').toLocaleLowerCase('ka').trim();

export const routes = [
  {
    method: 'GET',
    path: '/api/pharmacy/categories',
    handler: () => ({
      categories: [
        {
          id: PARENT.id,
          slug: PARENT.slug,
          nameKa: PARENT.nameKa,
          iconUrl: null,
          productCount: 0,
          children: SUBCATEGORIES.map(([slug]) => CATEGORY[slug]).map((c) => ({ id: c.id, slug: c.slug, nameKa: c.nameKa, iconUrl: null, productCount: c.count })),
        },
      ],
    }),
  },
  {
    method: 'GET',
    path: '/api/pharmacy/products',
    handler: (rq) => {
      const now = Date.now();
      const q = fold(rq.query.q);
      const categoryKey = rq.query.category ? String(rq.query.category) : null;
      const category = categoryKey ? Object.values(CATEGORY).find((c) => c.slug === categoryKey || c.id === categoryKey) ?? null : null;
      const sort = ['best_price', 'name', 'savings'].includes(rq.query.sort) ? rq.query.sort : 'best_price';
      const page = Math.max(1, Number.parseInt(rq.query.page ?? '1', 10) || 1);
      const limit = Math.max(1, Math.min(100, Number.parseInt(rq.query.limit ?? '24', 10) || 24));
      let rows = PRODUCTS.map((row) => mapProduct(row, now));
      if (category) rows = rows.filter((p) => p.category?.id === category.id);
      if (q) rows = rows.filter((p) => fold(p.name).includes(q));
      rows = rows.filter((p) => p.offerCount > 0);
      rows.sort((a, b) =>
        sort === 'name' ? a.name.localeCompare(b.name, 'ka') : (a.bestPriceGel ?? Infinity) - (b.bestPriceGel ?? Infinity) || a.name.localeCompare(b.name, 'ka'),
      );
      const total = q ? rows.length : category ? Math.max(rows.length, category.count) : Math.max(rows.length, CATALOG_TOTAL);
      return { products: rows.slice((page - 1) * limit, page * limit), pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
    },
  },
  {
    method: 'GET',
    path: '/api/pharmacy/products/:id',
    handler: (rq) => {
      const id = rq.params.id;
      const row = PRODUCTS.find((r) => r[0] === id || uuidFrom(`catalog:${r[0]}`) === id);
      if (!row) return rq.reply(404, { error: rq.lang === 'en' ? 'Product not found.' : 'პროდუქტი ვერ მოიძებნა.' });
      return { product: mapProduct(row, Date.now(), true) };
    },
  },
  {
    method: 'GET',
    path: '/api/pharmacy/meta/sync',
    handler: () => {
      const now = Date.now();
      const at = (h) => new Date(now - h * 3600_000).toISOString();
      return {
        sources: {
          PSP: { finishedAt: at(2), itemsFetched: 4120 },
          PHARMADEPOT: { finishedAt: at(3.5), itemsFetched: 3874 },
          GPC: { finishedAt: at(5), itemsFetched: 3391 },
          ALL: { finishedAt: at(2), itemsFetched: 11385 },
        },
        catalog: { products: CATALOG_TOTAL, offers: 8710, comparedProducts: 2190, offersBySource: { PSP: 3102, PHARMADEPOT: 2987, GPC: 2621 } },
      };
    },
  },
];
