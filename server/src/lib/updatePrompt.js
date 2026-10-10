/**
 * Soft update prompt (owner 2026-10-11). When a phone has an OTA ready it shows a small card
 * („ახალი ვერსია მზადაა“); a tap restarts into the new version — no App Store, nothing blocked.
 * `enabled` = that card appears automatically (on by default, admin can switch it off); `belowVersion`
 * = the admin additionally asks every version below it to look for the update right away.
 * One row, raw SQL (install-update-prompt.mjs; also created lazily). Never locks anyone out, unlike
 * AppSettings.forceUpdate.
 */
import { prisma } from './prisma.js';
import { isAppVersionBelow, parseAppVersion } from './appVersion.js';

const TTL_MS = 15_000;
let cache = { at: 0, row: null };
let ensured = false;

export const UPDATE_PROMPT_SQL = `CREATE TABLE IF NOT EXISTS "UpdatePrompt" (
  "id" TEXT PRIMARY KEY,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "belowVersion" TEXT,
  "promptId" TEXT,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedBy" TEXT
)`;

async function ensureTable(db) {
  if (ensured) return;
  await db.$executeRawUnsafe(UPDATE_PROMPT_SQL);
  ensured = true;
}

/** No row yet = the automatic card is on and nobody is asked explicitly. */
const DEFAULT = { enabled: true, belowVersion: null, promptId: null, updatedAt: null, updatedBy: null };

/** The current prompt (cached 15 s); never throws — a broken table means „no prompt“. */
export async function getUpdatePrompt(db = prisma) {
  if (cache.row && Date.now() - cache.at < TTL_MS) return cache.row;
  try {
    await ensureTable(db);
    const rows = await db.$queryRaw`SELECT "enabled", "belowVersion", "promptId", "updatedAt", "updatedBy" FROM "UpdatePrompt" WHERE "id" = 'default'`;
    const row = rows[0] ? { ...DEFAULT, ...rows[0] } : DEFAULT;
    cache = { at: Date.now(), row };
    return row;
  } catch {
    return DEFAULT;
  }
}

/**
 * What one client gets in /api/app/status: `auto` (show the card when an update is ready) and `ask`
 * (the admin asked this version to look for the update now; the id lets a phone ask only once per request).
 */
export function updatePromptForClient(prompt, clientVersion) {
  const auto = prompt?.enabled !== false;
  const below = auto && prompt?.belowVersion && prompt.promptId && isAppVersionBelow(clientVersion, prompt.belowVersion) === true;
  return { auto, ask: below ? { id: prompt.promptId, version: prompt.belowVersion } : null };
}

/**
 * Admin: switch the automatic card on/off (`enabled`) and/or ask every version below `belowVersion`
 * („“ / null stops asking). A new target gets a new id, so phones that dismissed the old one see it again.
 */
export async function setUpdatePrompt({ enabled, belowVersion }, adminId, db = prisma) {
  const clearing = belowVersion === null || belowVersion === '';
  const version = clearing || belowVersion === undefined ? null : parseAppVersion(belowVersion)?.raw ?? null;
  if (!clearing && belowVersion !== undefined && !version) throw Object.assign(new Error('ვერსია არასწორია'), { status: 400 });
  await ensureTable(db);
  cache = { at: 0, row: null };
  const current = await getUpdatePrompt(db);
  const on = enabled === undefined ? current.enabled !== false : Boolean(enabled);
  const target = clearing ? null : version ?? current.belowVersion;
  const promptId = target && target === current.belowVersion && current.promptId ? current.promptId : target ? `up-${Date.now().toString(36)}` : null;
  await db.$executeRaw`INSERT INTO "UpdatePrompt" ("id", "enabled", "belowVersion", "promptId", "updatedAt", "updatedBy")
    VALUES ('default', ${on}, ${target}, ${promptId}, CURRENT_TIMESTAMP, ${adminId ?? null})
    ON CONFLICT ("id") DO UPDATE SET "enabled" = EXCLUDED."enabled", "belowVersion" = EXCLUDED."belowVersion",
      "promptId" = EXCLUDED."promptId", "updatedAt" = EXCLUDED."updatedAt", "updatedBy" = EXCLUDED."updatedBy"`;
  cache = { at: 0, row: null };
  return getUpdatePrompt(db);
}
