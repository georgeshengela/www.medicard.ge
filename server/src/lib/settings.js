import { prisma } from './prisma.js';
import { getMobileAppVersion } from './mobileAppVersion.js';

const DEFAULTS = {
  id: 'default',
  maintenanceMode: false,
  maintenanceMessage: 'აპლიკაცია დროებით განახლების რეჟიმშია. გთხოვთ, სცადოთ მოგვიანებით.',
  minAppVersion: '1.0.0',
  forceUpdate: false,
  allowRegistrations: true,
  supportEmail: 'support@medicard.ge',
};

export async function getAppSettings() {
  let row = await prisma.appSettings.upsert({
    where: { id: 'default' },
    create: DEFAULTS,
    update: {},
  });

  const mobileVersion = getMobileAppVersion();
  if (mobileVersion && row.minAppVersion === '1.0.0' && compareSemver(mobileVersion, row.minAppVersion) > 0) {
    row = await prisma.appSettings.update({
      where: { id: 'default' },
      data: { minAppVersion: mobileVersion },
    });
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
