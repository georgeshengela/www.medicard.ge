import { prisma } from '../prisma.js';
import { SOURCES } from './constants.js';

/**
 * The catalogue's categories, as a person looks for a medicine („გული და წნევა“), not as a pharmacy
 * files it. Slugs of the old Pharmadepot-shaped list are kept where the meaning carries over, so app
 * builds that pick an icon by slug still find one. Order = order of the chips.
 *
 * A product's category comes from what the pharmacies say: Pharmadepot/GPC's sub-category (an ATC-like
 * tree) and PSP's own category names, then the most common category of the same active substance.
 * Never from words inside the name (that put Concor — „კონკორი“ contains „ონკო“ — under oncology).
 */
export const CATEGORIES = [
  { slug: 'painkillers', ka: 'ტკივილი და სიცხე', en: 'Pain and fever' },
  { slug: 'respiratory', ka: 'გაციება, ხველა, სუნთქვა', en: 'Cold, cough and breathing' },
  { slug: 'cardio', ka: 'გული და წნევა', en: 'Heart and blood pressure' },
  { slug: 'gastro', ka: 'კუჭი და ნაწლავები', en: 'Stomach and digestion' },
  { slug: 'vitamins', ka: 'ვიტამინები და იმუნიტეტი', en: 'Vitamins and immunity' },
  { slug: 'allergy', ka: 'ალერგია', en: 'Allergy' },
  { slug: 'antiinfective', ka: 'ინფექციები და პარაზიტები', en: 'Infections and parasites' },
  { slug: 'nervous', ka: 'ნერვები, ძილი, განწყობა', en: 'Nerves, sleep and mood' },
  { slug: 'diabetes', ka: 'დიაბეტი', en: 'Diabetes' },
  { slug: 'dermatology', ka: 'კანი', en: 'Skin' },
  { slug: 'eye-drops', ka: 'თვალი', en: 'Eyes' },
  { slug: 'ear-drops', ka: 'ყური, ცხვირი, ყელი', en: 'Ear, nose and throat' },
  { slug: 'musculoskeletal', ka: 'სახსრები და კუნთები', en: 'Joints and muscles' },
  { slug: 'gynecology', ka: 'ქალის ჯანმრთელობა', en: "Women's health" },
  { slug: 'erectile', ka: 'მამაკაცის ჯანმრთელობა', en: "Men's health" },
  { slug: 'urology', ka: 'თირკმელი და შარდის გზები', en: 'Kidneys and bladder' },
  { slug: 'blood', ka: 'სისხლი და ანემია', en: 'Blood and anaemia' },
  { slug: 'endocrinology', ka: 'ჰორმონები და ფარისებრი ჯირკვალი', en: 'Hormones and thyroid' },
  { slug: 'antiseptic', ka: 'ანტისეპტიკა და პირველადი დახმარება', en: 'Antiseptics and first aid' },
  { slug: 'homeopathy', ka: 'ჰომეოპათია და მცენარეული', en: 'Homeopathy and herbal' },
  { slug: 'oncology', ka: 'ონკოლოგია', en: 'Oncology' },
  { slug: 'other', ka: 'სხვა', en: 'Other' },
].map((c, i) => ({ ...c, sortOrder: i + 1 }));

export const CATEGORY_SLUGS = new Set(CATEGORIES.map((c) => c.slug));

/** Pharmadepot/GPC `medicament_sub_category_id` → our slug (their tree follows ATC groups). */
const PHARMADEPOT_SUBCATEGORY = {
  285: 'vitamins', 165: 'ear-drops', 198: 'endocrinology', 44: 'erectile', 86: 'nervous', 58: 'diabetes',
  69: 'eye-drops', 91: 'painkillers', 197: 'gastro', 140: 'antiseptic', 56: 'endocrinology', 61: 'musculoskeletal',
  150: 'allergy', 52: 'blood', 55: 'antiinfective', 57: 'gynecology', 11365: 'antiinfective', 372: 'oncology',
  12090: 'painkillers', 12091: 'vitamins', 12093: 'nervous', 12094: 'cardio', 12095: 'dermatology', 12097: 'respiratory',
  12105: 'ear-drops', 12108: 'gastro', 11366: 'eye-drops', 13652: 'diabetes', 229: 'dermatology', 12104: 'homeopathy',
};

/** PSP category names → our slug; the first rule that matches a name decides that name's vote. */
const PSP_RULES = [
  ['gynecology', /ქალთა|ვაგინალ|კონტრაცეპ|მენოპაუზ|ორსულ|ოვულაცი|მეან|ქალის ჯანმრთ|პრემენსტრუ|მენსტრუალ/],
  ['erectile', /მამაკაც|ერექცი|პროსტატ|ანდროპაუზ|კაცის ჯანმრთ/],
  ['urology', /საშარდე|ცისტიტ|თირკმ|ენურეზ/],
  ['diabetes', /დიაბეტ|შაქრის დამწევ/],
  ['oncology', /ონკოლოგ/],
  ['homeopathy', /ჰომეოპათ|სამკურნალო მცენარ|არომათერაპ/],
  ['eye-drops', /ოფთალმოლ|თვალის|გლაუკომ|კატარაქტ|ლინზ/],
  ['ear-drops', /ოტორინოლარინგ|ცხვირის|ყურის|ყელის ტკივილ|ხვრინვ/],
  ['allergy', /ალერგი/],
  ['blood', /ჰემატოლოგ|სისხლის შედედ|სისხლის გამათხელ|ანემი/],
  ['cardio', /გულ სისხლძარღვ|წნევის|ქოლესტერინ|გულის კუნთ|არითმი|შარდმდენ|ვენები/],
  ['musculoskeletal', /სახსრ|ძვალ|კუნთ|ანთების საწინააღმდეგო მალამო/],
  ['painkillers', /ტკივილგამაყუჩ|სიცხის დამწევ|თავის ტკივილ|კბილის ტკივილ|შაკიკ/],
  ['respiratory', /გრიპ|გაციებ|ხველ|სასუნთქ|ასთმ|საინჰალაც|ინჰალატორ/],
  ['gastro', /კუჭ|ნაწლავ|შეკრულობ|ფაღარათ|შებერილობ|საჭმლის მომნელ|გულძმარვ|ღებინებ|სპაზმის მომხსნ|ღვიძლ|დისბაქტერ|ბუასილ|ნაბახუსევ/],
  ['antiinfective', /ანტიბიოტიკ|ანტივირუს|სოკოს საწინააღმდეგო|პარაზიტ|ჭიის|ტილის|მუნის/],
  ['nervous', /ნევროლოგ|ანტიდეპრეს|ფსიქოზ|დემენცი|ეპილეფსი|პარკინსონ|მეხსიერებ|ტვინში|დამამშვიდ|ძილის|დამოკიდებულ/],
  ['endocrinology', /ენდოკრინ|ჰორმონ|ფარისებრ|გლუკოკორტიკ/],
  ['dermatology', /დერმატოლოგ|კანის|აკნე|ფსორიაზ|ფრჩხილ|სებორე|დამწვრობ|კოჟრ|თმის/],
  ['vitamins', /ვიტამინ|მინერალ|ომეგა|ელექტროლიტ|საკვები დანამატ|იმუნიტეტ|იმუნურ|იმუნოლოგ|სელენ|კალციუმ|ენერგია/],
  ['antiseptic', /ანტისეპტიკ|პირველადი დახმარ|სადეზინფექციო|ჭრილობ/],
  ['painkillers', /საანესთეზიო/],
  ['other', /სამედიცინო ტექნიკა|წვრილმანი სამედიცინო|პრეზერვატივ|ლუბრიკანტ|მწერების/],
];

function pspSlug(name) {
  for (const [slug, re] of PSP_RULES) if (re.test(name)) return slug;
  return null;
}

/** Pharmadepot files urology together with gynaecology; these substances are the urology half. */
const UROLOGY_SUBSTANCES =
  /ნიტროფურანტ|ფურაზიდ|ფურაგინ|ფოსფომიც|ტამსულოზ|ფინასტერიდ|დუტასტერიდ|სოლიფენაც|ტოლტეროდ|ალფუზოზ|სილოდოზ|ოქსიბუტინ|ტროსპიუმ|მირაბეგრ|nitrofurant|furazid|fosfomyc|tamsulos|finasterid|dutasterid|solifenac|tolterod|alfuzos|silodos|oxybutyn|trospium|mirabegr/i;

/** Anti-inflammatory painkillers: ATC files them under the musculoskeletal system, people look under pain. */
const PAINKILLER_SUBSTANCES =
  /იბუპროფ|კეტოპროფ|ნაპროქს|ნიმესულ|დიკლოფენაკ|კეტოროლაკ|მელოქსიკ|აცეკლოფენაკ|ლორნოქსიკ|ეტორიკოქს|ცელეკოქს|ibuprof|ketoprof|naprox|nimesul|diclofenac|ketorolac|meloxicam|aceclofenac|lornoxicam|etoricox|celecox/i;
const SYSTEMIC_FORMS = new Set(['tablet', 'tablet-eff', 'capsule', 'powder', 'oral-liquid', 'rectal', 'injection', 'lozenge', 'drops']);

function pharmadepotSlug(subCategoryId, formGroup, substance) {
  const slug = PHARMADEPOT_SUBCATEGORY[subCategoryId] ?? null;
  if (String(subCategoryId) === '61' && SYSTEMIC_FORMS.has(formGroup) && PAINKILLER_SUBSTANCES.test(substance || '')) return 'painkillers';
  // Corticosteroids: a cream is a skin medicine; gynaecology & urology: split by substance.
  if (String(subCategoryId) === '56' && ['cream', 'ointment', 'gel', 'topical'].includes(formGroup)) return 'dermatology';
  if (String(subCategoryId) === '56' && formGroup === 'eye') return 'eye-drops';
  if (String(subCategoryId) === '57' && formGroup !== 'vaginal' && UROLOGY_SUBSTANCES.test(substance || '')) return 'urology';
  return slug;
}

/**
 * One product's category from its offers' facts: Pharmadepot/GPC sub-categories count three times
 * (one ATC-like tree), each PSP category name once. Null when nobody says anything usable.
 */
export function categorySlugFor({ facts = [], formGroup = null, kind = 'medicine' }) {
  if (kind === 'other') return 'other';
  const votes = new Map();
  const vote = (slug, n) => slug && votes.set(slug, (votes.get(slug) || 0) + n);
  const seenSub = new Set();
  for (const f of facts) {
    if (f?.subCategoryId && !seenSub.has(f.subCategoryId)) {
      seenSub.add(f.subCategoryId);
      vote(pharmadepotSlug(f.subCategoryId, formGroup, f.innKa || f.brand), 3);
    }
    for (const name of f?.categories || []) vote(pspSlug(name), 1);
  }
  if (!votes.size) return null;
  const order = new Map(CATEGORIES.map((c) => [c.slug, c.sortOrder]));
  return [...votes.entries()].sort((a, b) => b[1] - a[1] || order.get(a[0]) - order.get(b[0]))[0][0];
}

export async function ensurePharmacySources() {
  for (const src of Object.values(SOURCES)) {
    await prisma.pharmacySource.upsert({
      where: { id: src.id },
      create: { id: src.id, nameKa: src.nameKa, baseUrl: src.baseUrl, logoUrl: src.logoUrl },
      update: { nameKa: src.nameKa, baseUrl: src.baseUrl, logoUrl: src.logoUrl },
    });
  }
}

/** Creates/renames the categories under „მედიკამენტები“; retired ones stay (empty) and are not listed. */
export async function ensureDrugCategories() {
  const parent = await prisma.drugCategory.upsert({
    where: { slug: 'medikamentebi' },
    create: { slug: 'medikamentebi', nameKa: 'მედიკამენტები', sortOrder: 0 },
    update: { nameKa: 'მედიკამენტები' },
  });
  const ids = new Map();
  for (const cat of CATEGORIES) {
    const row = await prisma.drugCategory.upsert({
      where: { slug: cat.slug },
      create: { slug: cat.slug, nameKa: cat.ka, parentId: parent.id, sortOrder: cat.sortOrder },
      update: { nameKa: cat.ka, parentId: parent.id, sortOrder: cat.sortOrder },
    });
    ids.set(cat.slug, row.id);
  }
  return ids;
}

export async function getCategoryIdBySlug(slug) {
  const row = await prisma.drugCategory.findUnique({ where: { slug } });
  return row?.id ?? null;
}

/** The category's name in the reader's language (the table holds Georgian only). */
export function categoryName(slug, nameKa, lang = 'ka') {
  if (lang !== 'en') return nameKa;
  return CATEGORIES.find((c) => c.slug === slug)?.en ?? nameKa;
}
