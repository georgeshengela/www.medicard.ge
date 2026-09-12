/**
 * Dump live Express router stacks without importing server.js (that file listen()s).
 */
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { authRouter } from '../src/routes/auth.routes.js';
import { healthProfileRouter } from '../src/routes/health-profile.routes.js';
import { healthMetricsRouter } from '../src/routes/health-metrics.routes.js';
import { aiRouter } from '../src/routes/ai.routes.js';
import { chatsRouter } from '../src/routes/chats.routes.js';
import { recordsRouter } from '../src/routes/records.routes.js';
import { filesRouter } from '../src/routes/files.routes.js';
import { medicationsRouter } from '../src/routes/medications.routes.js';
import { visitsRouter } from '../src/routes/visits.routes.js';
import { cycleRouter } from '../src/routes/cycle.routes.js';
import { usageRouter } from '../src/routes/usage.routes.js';
import { adminRouter } from '../src/routes/admin.routes.js';
import { adminRewardsRouter } from '../src/routes/adminRewards.routes.js';
import { appRouter } from '../src/routes/app.routes.js';
import { accountRouter } from '../src/routes/account.routes.js';
import { pushRouter } from '../src/routes/push.routes.js';
import { pharmacyRouter } from '../src/routes/pharmacy.routes.js';
import { checkInRouter } from '../src/routes/check-in.routes.js';
import { locationRouter } from '../src/routes/location.routes.js';
import { questsRouter } from '../src/routes/quests.routes.js';
import { achievementsRouter } from '../src/routes/achievements.routes.js';
import { rewardsRouter } from '../src/routes/rewards.routes.js';
import { mediCompanionRouter } from '../src/routes/mediCompanion.routes.js';
import { mediWorldRouter } from '../src/routes/mediWorld.routes.js';

function joinPath(mount, routePath) {
  const left = String(mount || '').replace(/\/$/, '');
  const parts = Array.isArray(routePath) ? routePath : [routePath];
  return parts.map((part) => {
    const right = String(part || '/');
    if (right === '/') return left || '/';
    return `${left}${right.startsWith('/') ? right : `/${right}`}`;
  });
}

function walk(stack, mount, source, acc) {
  for (const layer of stack || []) {
    if (layer.route) {
      const methods = Object.keys(layer.route.methods || {}).filter((m) => layer.route.methods[m]);
      for (const mapped of joinPath(mount, layer.route.path)) {
        for (const method of methods) {
          acc.push({
            method: method.toUpperCase(),
            path: mapped,
            mount,
            source,
          });
        }
      }
    } else if (layer.name === 'router' && layer.handle?.stack) {
      walk(layer.handle.stack, mount, source, acc);
    }
  }
}

function classify(route) {
  const p = route.path;
  if (p.startsWith('/api/admin')) return 'ADMIN_ONLY';
  if (p === '/api/cycle/share/:code' && route.method === 'GET' && route.source.includes('server.js')) {
    return 'PUBLIC';
  }
  if (p.startsWith('/api/cycle/share')) return 'PARTNER_SCOPED';
  if (p.startsWith('/api/files')) return 'OWNER_ONLY';
  if (p.startsWith('/uploads')) return 'PUBLIC';
  if (
    p.startsWith('/api/auth/login') ||
    p.startsWith('/api/auth/register') ||
    p.startsWith('/api/auth/password') ||
    p.startsWith('/api/auth/phone') ||
    p === '/api/app/status' ||
    p === '/health' ||
    p === '/privacy' ||
    p === '/terms' ||
    p.startsWith('/calculators')
  ) {
    return 'PUBLIC';
  }
  if (p.startsWith('/api/')) return 'OWNER_ONLY';
  if (p.startsWith('/admin')) return 'PUBLIC';
  return 'PUBLIC';
}

const routers = [
  ['/api/auth', authRouter, 'server/src/routes/auth.routes.js'],
  ['/api/health-profile', healthProfileRouter, 'server/src/routes/health-profile.routes.js'],
  ['/api/health-metrics', healthMetricsRouter, 'server/src/routes/health-metrics.routes.js'],
  ['/api/ai', aiRouter, 'server/src/routes/ai.routes.js'],
  ['/api/chats', chatsRouter, 'server/src/routes/chats.routes.js'],
  ['/api/records', recordsRouter, 'server/src/routes/records.routes.js'],
  ['/api/files', filesRouter, 'server/src/routes/files.routes.js'],
  ['/api/medications', medicationsRouter, 'server/src/routes/medications.routes.js'],
  ['/api/visits', visitsRouter, 'server/src/routes/visits.routes.js'],
  ['/api/cycle', cycleRouter, 'server/src/routes/cycle.routes.js'],
  ['/api/usage', usageRouter, 'server/src/routes/usage.routes.js'],
  ['/api/push', pushRouter, 'server/src/routes/push.routes.js'],
  ['/api/pharmacy', pharmacyRouter, 'server/src/routes/pharmacy.routes.js'],
  ['/api/check-in', checkInRouter, 'server/src/routes/check-in.routes.js'],
  ['/api/location', locationRouter, 'server/src/routes/location.routes.js'],
  ['/api/quests', questsRouter, 'server/src/routes/quests.routes.js'],
  ['/api/achievements', achievementsRouter, 'server/src/routes/achievements.routes.js'],
  ['/api/rewards', rewardsRouter, 'server/src/routes/rewards.routes.js'],
  ['/api/medi-companion', mediCompanionRouter, 'server/src/routes/mediCompanion.routes.js'],
  ['/api/medi-world', mediWorldRouter, 'server/src/routes/mediWorld.routes.js'],
  ['/api/app', appRouter, 'server/src/routes/app.routes.js'],
  ['/api/account', accountRouter, 'server/src/routes/account.routes.js'],
  ['/api/admin', adminRouter, 'server/src/routes/admin.routes.js'],
  ['/api/admin/rewards', adminRewardsRouter, 'server/src/routes/adminRewards.routes.js'],
];

const live = [];
for (const [mount, router, source] of routers) {
  walk(router.stack, mount, source, live);
}

const appLevel = [
  { method: 'GET', path: '/uploads/*', mount: '/uploads', source: 'server/src/server.js' },
  { method: 'HEAD', path: '/uploads/*', mount: '/uploads', source: 'server/src/server.js' },
  { method: 'GET', path: '/privacy', mount: '/', source: 'server/src/server.js' },
  { method: 'GET', path: '/terms', mount: '/', source: 'server/src/server.js' },
  { method: 'GET', path: '/calculators', mount: '/', source: 'server/src/server.js' },
  { method: 'GET', path: '/calculators/:slug', mount: '/', source: 'server/src/server.js' },
  { method: 'GET', path: '/health', mount: '/', source: 'server/src/server.js' },
  { method: 'GET', path: '/api/cycle/share/:code', mount: '/', source: 'server/src/server.js' },
  { method: 'GET', path: '/admin', mount: '/admin', source: 'server/src/server.js' },
  { method: 'GET', path: '/share', mount: '/share', source: 'server/src/server.js' },
];

live.push(...appLevel);

const seen = new Set();
const unique = [];
for (const row of live) {
  const key = `${row.method} ${row.path}`;
  if (seen.has(key)) continue;
  seen.add(key);
  unique.push({
    ...row,
    securityClass: classify(row),
  });
}

unique.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));

const classCounts = {};
for (const row of unique) {
  classCounts[row.securityClass] = (classCounts[row.securityClass] || 0) + 1;
}

const out = {
  generatedAt: new Date().toISOString(),
  canonicalLiveCount: unique.length,
  unknownCount: unique.filter((r) => r.securityClass === 'UNKNOWN').length,
  securityClassCounts: classCounts,
  routes: unique,
};

const dest = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../qa/release-audit/RA-01/_live-routes.json',
);
await writeFile(dest, `${JSON.stringify(out, null, 2)}\n`);
console.log(JSON.stringify({ canonicalLiveCount: out.canonicalLiveCount, unknownCount: out.unknownCount, classCounts }, null, 2));
