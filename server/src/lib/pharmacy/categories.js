import { prisma } from '../prisma.js';
import { SOURCES } from './constants.js';

/** Pharmadepot medication subcategories (from category 111843). */
export const PHARMADEPOT_SUBCATEGORIES = [
  { id: 'immunology', nameKa: 'იმუნოლოგია', sortOrder: 1 },
  { id: 'ear-drops', nameKa: 'ყურის წვეთები', sortOrder: 2 },
  { id: 'endocrinology', nameKa: 'ენდოკრინოლოგია', sortOrder: 3 },
  { id: 'erectile', nameKa: 'ერექციული დისფუნქცია', sortOrder: 4 },
  { id: 'sedatives', nameKa: 'დამამშვიდებელი საშუალებები', sortOrder: 5 },
  { id: 'diabetes', nameKa: 'დიაბეტური მედიკამენტები', sortOrder: 6 },
  { id: 'eye-drops', nameKa: 'თვალის წვეთები და მალამოები', sortOrder: 7 },
  { id: 'painkillers', nameKa: 'ტკივილგამაყუჩებელი საშუალებები', sortOrder: 8 },
  { id: 'gastro', nameKa: 'გასტროენტეროლოგია', sortOrder: 9 },
  { id: 'antiseptic', nameKa: 'ანტისეპტიკური საშუალებები', sortOrder: 10 },
  { id: 'corticosteroids', nameKa: 'კორტიკოსტეროიდები', sortOrder: 11 },
  { id: 'musculoskeletal', nameKa: 'ძვალ კუნთოვანი სისტემა', sortOrder: 12 },
  { id: 'allergy', nameKa: 'ალერგია', sortOrder: 13 },
  { id: 'blood', nameKa: 'სისხლწარმოქმნა და სისხლი', sortOrder: 14 },
  { id: 'antiinfective', nameKa: 'ინფექციის საწინააღმდეგო საშუალებები და ვაქცინები', sortOrder: 15 },
  { id: 'gynecology', nameKa: 'გინეკოლოგია და უროლოგია', sortOrder: 16 },
  { id: 'antiparasitic', nameKa: 'პარაზიტების საწინააღმდეგო პრეპარატები', sortOrder: 17 },
  { id: 'oncology', nameKa: 'ონკოლოგია და ბიოტექნოლოგია', sortOrder: 18 },
  { id: 'solvents', nameKa: 'გამხსნელები', sortOrder: 19 },
  { id: 'vitamins', nameKa: 'ვიტამინები და მინერალები', sortOrder: 20 },
  { id: 'nervous', nameKa: 'ნერვული სისტემა', sortOrder: 21 },
  { id: 'cardio', nameKa: 'გულ სისხლძარღვთა სისტემა', sortOrder: 22 },
  { id: 'dermatology', nameKa: 'დერმატოლოგია', sortOrder: 23 },
  { id: 'respiratory', nameKa: 'სასუნთქი სისტემა', sortOrder: 24 },
  { id: 'ear-disease', nameKa: 'ყურის დაავადებების მკურნალობისთვის', sortOrder: 25 },
  { id: 'hemorrhoids', nameKa: 'ჰემოროიდული პრეპარატები', sortOrder: 26 },
];

export async function ensurePharmacySources() {
  for (const src of Object.values(SOURCES)) {
    await prisma.pharmacySource.upsert({
      where: { id: src.id },
      create: {
        id: src.id,
        nameKa: src.nameKa,
        baseUrl: src.baseUrl,
        logoUrl: src.logoUrl,
      },
      update: {
        nameKa: src.nameKa,
        baseUrl: src.baseUrl,
        logoUrl: src.logoUrl,
      },
    });
  }
}

export async function ensureDrugCategories() {
  const parent = await prisma.drugCategory.upsert({
    where: { slug: 'medikamentebi' },
    create: {
      slug: 'medikamentebi',
      nameKa: 'მედიკამენტები',
      sortOrder: 0,
    },
    update: { nameKa: 'მედიკამენტები' },
  });

  for (const cat of PHARMADEPOT_SUBCATEGORIES) {
    const slug = cat.id;
    const row = await prisma.drugCategory.upsert({
      where: { slug },
      create: {
        slug,
        nameKa: cat.nameKa,
        parentId: parent.id,
        sortOrder: cat.sortOrder,
      },
      update: {
        nameKa: cat.nameKa,
        parentId: parent.id,
        sortOrder: cat.sortOrder,
      },
    });

    await prisma.sourceCategoryMap.upsert({
      where: {
        source_sourceCategory: { source: 'PHARMADEPOT', sourceCategory: cat.id },
      },
      create: {
        source: 'PHARMADEPOT',
        sourceCategory: cat.id,
        categoryId: row.id,
      },
      update: { categoryId: row.id },
    });
  }

  return parent;
}

export async function getCategoryIdBySlug(slug) {
  const row = await prisma.drugCategory.findUnique({ where: { slug } });
  return row?.id ?? null;
}

export async function getCategoryIdForSourceCategory(source, sourceCategory) {
  const map = await prisma.sourceCategoryMap.findUnique({
    where: { source_sourceCategory: { source, sourceCategory } },
  });
  return map?.categoryId ?? null;
}
