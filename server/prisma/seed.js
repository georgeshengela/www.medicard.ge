import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { ensureDrugCategories, ensurePharmacySources } from '../src/lib/pharmacy/categories.js';

const prisma = new PrismaClient();

const PACKAGES = [
  {
    code: 'FREE',
    nameKa: 'უფასო',
    nameEn: 'Free',
    descriptionKa: '3 AI შეკითხვა დღეში. საბაზისო ჩატი და ძირითადი მოდულები.',
    monthlyAiLimit: 90,
    dailyAiLimit: 3,
    priceGel: 0,
    sortOrder: 1,
    features: {
      doctorChat: true,
      consilium: false,
      labAnalysis: true,
      imaging: false,
      skin: false,
      skincare: false,
      medicationReview: true,
    },
  },
  {
    code: 'STANDARD',
    nameKa: 'სტანდარტი',
    nameEn: 'Standard',
    descriptionKa: '1 500 AI შეკითხვა თვეში · 30-დღიანი გამოწერა. ყველა მოდული.',
    monthlyAiLimit: 1500,
    dailyAiLimit: 50,
    priceGel: 19.99,
    sortOrder: 2,
    features: {
      doctorChat: true,
      consilium: true,
      labAnalysis: true,
      imaging: true,
      skin: true,
      skincare: true,
      medicationReview: true,
    },
  },
  {
    code: 'ULTIMATE',
    nameKa: 'ულტიმატი',
    nameEn: 'Ultimate',
    descriptionKa: 'შეუზღუდავი AI თვეში · 30-დღიანი გამოწერა · სრული წვდომა.',
    monthlyAiLimit: -1,
    dailyAiLimit: -1,
    priceGel: 49.99,
    sortOrder: 3,
    features: {
      doctorChat: true,
      consilium: true,
      labAnalysis: true,
      imaging: true,
      skin: true,
      skincare: true,
      medicationReview: true,
      prioritySupport: true,
    },
  },
];

async function main() {
  for (const pkg of PACKAGES) {
    await prisma.package.upsert({
      where: { code: pkg.code },
      create: pkg,
      update: {
        nameKa: pkg.nameKa,
        nameEn: pkg.nameEn,
        descriptionKa: pkg.descriptionKa,
        monthlyAiLimit: pkg.monthlyAiLimit,
        dailyAiLimit: pkg.dailyAiLimit,
        priceGel: pkg.priceGel,
        features: pkg.features,
        sortOrder: pkg.sortOrder,
        active: true,
      },
    });
  }

  await prisma.appSettings.upsert({
    where: { id: 'default' },
    create: { id: 'default' },
    update: {},
  });

  const free = await prisma.package.findUnique({ where: { code: 'FREE' } });
  if (free) {
    await prisma.user.updateMany({
      where: { packageId: null },
      data: { packageId: free.id },
    });
  }

  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@medicard.ge').toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || 'MedicardAdmin1!';
  const adminName = process.env.ADMIN_FULL_NAME || 'Medicard Admin';

  await prisma.admin.upsert({
    where: { email: adminEmail },
    create: {
      email: adminEmail,
      fullName: adminName,
      passwordHash: await bcrypt.hash(adminPassword, 12),
    },
    update: {
      fullName: adminName,
      passwordHash: await bcrypt.hash(adminPassword, 12),
    },
  });

  console.log('Seeded monthly packages: FREE (90/mo), STANDARD (1500/mo), ULTIMATE (∞/mo)');
  console.log(`Admin login: ${adminEmail}`);
  console.log('Change ADMIN_PASSWORD in production.');

  await ensurePharmacySources();
  await ensureDrugCategories();
  console.log('Pharmacy sources and drug categories seeded.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
