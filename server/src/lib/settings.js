import { prisma } from './prisma.js';
import { getMobileAppVersion } from './mobileAppVersion.js';
import { parseAppVersion } from './appVersion.js';
import { isMediWorldEnabled, isMediWorldExploreEnabled, isMediWorldMovementEnabled, isMediWorldGardenEnabled } from './mediWorld/flags.js';

const DEFAULTS = {
  id: 'default',
  maintenanceMode: false,
  maintenanceMessage: 'აპლიკაცია დროებით განახლების რეჟიმშია. გთხოვთ, სცადოთ მოგვიანებით.',
  minAppVersion: '1.0.0',
  forceUpdate: false,
  allowRegistrations: true,
  supportEmail: 'support@medicard.ge',
  qaOtpEnabled: false,
};

async function ensureQaOtpColumn() {
  await prisma.$executeRawUnsafe(
    'ALTER TABLE "AppSettings" ADD COLUMN IF NOT EXISTS "qaOtpEnabled" BOOLEAN NOT NULL DEFAULT false',
  );
}

async function readSettingsRow() {
  return prisma.appSettings.upsert({
    where: { id: 'default' },
    create: DEFAULTS,
    update: {},
  });
}

export async function getAppSettings() {
  let row;
  try {
    row = await readSettingsRow();
  } catch (error) {
    console.error('[settings] AppSettings read failed', error?.code || error?.message);
    try {
      await ensureQaOtpColumn();
      row = await readSettingsRow();
    } catch (retryError) {
      console.error('[settings] AppSettings fallback', retryError?.code || retryError?.message);
      return { ...DEFAULTS, updatedAt: new Date() };
    }
  }

  const mobileVersion = getMobileAppVersion();
  const parsedMobile = parseAppVersion(mobileVersion);
  // Do not auto-promote the 1.0.0 placeholder onto public generation 1 (`1.0.0.7.66`).
  // That would force-update historic 15–65 clients. Only fill from epoch-0 builds.
  if (
    mobileVersion &&
    row.minAppVersion === '1.0.0' &&
    parsedMobile?.epoch === 0 &&
    compareSemver(mobileVersion, row.minAppVersion) > 0
  ) {
    try {
      row = await prisma.appSettings.update({
        where: { id: 'default' },
        data: { minAppVersion: mobileVersion },
      });
    } catch {
      /* keep the row we already loaded */
    }
  }

  return row;
}

export function publicAppSettings(settings) {
  return {
    maintenanceMode: settings.maintenanceMode,
    maintenanceMessage: settings.maintenanceMessage,
    minAppVersion: settings.minAppVersion,
    forceUpdate: settings.forceUpdate,
    allowRegistrations: settings.allowRegistrations,
    supportEmail: settings.supportEmail,
    mediWorldEnabled: isMediWorldEnabled(),
    mediWorldExploreEnabled: isMediWorldExploreEnabled(),
    mediWorldMovementEnabled: isMediWorldMovementEnabled(),
    mediWorldGardenEnabled: isMediWorldGardenEnabled(),
    updatedAt: settings.updatedAt,
  };
}

/** Semver compare: a < b → -1, a = b → 0, a > b → 1 */
export function compareSemver(a, b) {
  const pa = String(a || '0.0.0').split('.').map((n) => Number.parseInt(n, 10) || 0);
  const pb = String(b || '0.0.0').split('.').map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i += 1) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  return 0;
}
