import { prisma } from './prisma.js';
import { getMobileAppVersion } from './mobileAppVersion.js';
import { parseAppVersion } from './appVersion.js';
import { consumerPurchasesEnabled } from './consumerPurchases.js';
import { isEnglish } from './i18n.js';

/** Admin-typed maintenance text is Georgian; English requests read this instead. */
export const MAINTENANCE_MESSAGE_EN = 'MEDICARD is being updated. Please try again in a little while.';

/** Maintenance text for a request / language ('ka' keeps the admin's message). */
export function maintenanceMessageFor(settings, lang = 'ka') {
  return isEnglish(lang) ? MAINTENANCE_MESSAGE_EN : settings?.maintenanceMessage;
}

const DEFAULTS = {
  id: 'default',
  maintenanceMode: false,
  maintenanceMessage: 'აპი ახლა ახლდება. სცადე ცოტა ხანში.',
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
  const existing = await prisma.appSettings.findUnique({ where: { id: 'default' } });
  if (existing) return existing;
  return prisma.appSettings.upsert({
    where: { id: 'default' },
    create: DEFAULTS,
    update: {},
  });
}

/**
 * Every /api request checks maintenance mode, so the row is cached for SETTINGS_TTL_MS per instance
 * (one read instead of an upsert per request; a request loop used to write here 3 000×/min).
 * Admin writes call invalidateAppSettings(); other instances pick the change up within the TTL.
 */
const SETTINGS_TTL_MS = 10_000;
let settingsCache = { at: 0, value: null, pending: null };

export function invalidateAppSettings() {
  settingsCache = { at: 0, value: null, pending: null };
}

export async function getAppSettings() {
  if (settingsCache.value && Date.now() - settingsCache.at < SETTINGS_TTL_MS) return settingsCache.value;
  if (settingsCache.pending) return settingsCache.pending;
  const cache = settingsCache;
  const pending = loadAppSettings()
    .then((value) => {
      if (settingsCache === cache) settingsCache = { at: Date.now(), value, pending: null };
      return value;
    })
    .catch((error) => {
      if (settingsCache === cache) cache.pending = null;
      throw error;
    });
  cache.pending = pending;
  return pending;
}

async function loadAppSettings() {
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

export function publicAppSettings(settings, lang = 'ka') {
  return {
    maintenanceMode: settings.maintenanceMode,
    maintenanceMessage: maintenanceMessageFor(settings, lang),
    minAppVersion: settings.minAppVersion,
    forceUpdate: settings.forceUpdate,
    allowRegistrations: settings.allowRegistrations,
    supportEmail: settings.supportEmail,
    consumerPurchasesEnabled: consumerPurchasesEnabled(),
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
