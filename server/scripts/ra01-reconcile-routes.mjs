import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ra00 = JSON.parse(await readFile(path.join(here, '../../qa/release-audit/RA-00/api-inventory.json'), 'utf8'));
const live = JSON.parse(await readFile(path.join(here, '../../qa/release-audit/RA-01/_live-routes.json'), 'utf8'));

const key = (method, p) => `${String(method).toUpperCase()} ${p}`;
const staticSet = new Map(ra00.routes.map((row) => [key(row.method, row.path), row]));
const liveSet = new Map(live.routes.map((row) => [key(row.method, row.path), row]));

function reasonForLive(row) {
  if (row.path === '/api/files/:filename') return 'Added in RA-01 as the authenticated private-file route.';
  if (row.path === '/uploads/*' && row.method === 'HEAD') {
    return 'Legacy upload mount answers all methods; RA-00 listed GET only.';
  }
  if (row.path.startsWith('/api/cycle/')) {
    return 'RA-00 regex captured source template literals; live dump uses resolved paths.';
  }
  return 'Present on the live router stack; missed by RA-00 static regex.';
}

function reasonForStatic(row) {
  if (String(row.path).includes('${')) {
    return 'Static regex captured the source template literal, not the resolved route.';
  }
  return 'Static regex path is not a unique live method+path.';
}

const liveMissingFromStatic = [];
for (const [k, row] of liveSet) {
  if (!staticSet.has(k)) {
    liveMissingFromStatic.push({
      method: row.method,
      path: row.path,
      mount: row.mount,
      source: row.source,
      securityClass: row.securityClass,
      reasonMissed: reasonForLive(row),
    });
  }
}

const staticMissingLive = [];
for (const [k, row] of staticSet) {
  if (!liveSet.has(k)) {
    staticMissingLive.push({
      method: row.method,
      path: row.path,
      sourceFile: row.sourceFile,
      reason: reasonForStatic(row),
    });
  }
}

const out = {
  generatedAt: new Date().toISOString(),
  ra00StaticCount: ra00.count,
  ra00ReportedLiveApprox: 217,
  ra01UniqueLiveCount: live.canonicalLiveCount,
  canonicalRouteCount: live.canonicalLiveCount,
  unknownCount: live.unknownCount,
  liveMissingFromStaticCount: liveMissingFromStatic.length,
  staticMissingLiveCount: staticMissingLive.length,
  liveMissingFromStatic,
  staticMissingLive,
  securityClassCounts: live.securityClassCounts,
  notes: [
    'Canonical count is unique HTTP method+path after walking mounted routers plus app-level routes in server.js.',
    'RA-00 ~217 included duplicate registrations and array-path expansions.',
    'GET /uploads/* is classified PUBLIC as a deny stub: unauthenticated callers receive 401 JSON and never file bytes.',
  ],
};

await writeFile(
  path.join(here, '../../qa/release-audit/RA-01/route-reconciliation.json'),
  `${JSON.stringify(out, null, 2)}\n`,
);
console.log(
  JSON.stringify(
    {
      canonical: out.canonicalRouteCount,
      unknown: out.unknownCount,
      liveOnly: out.liveMissingFromStaticCount,
      staticOnly: out.staticMissingLiveCount,
    },
    null,
    2,
  ),
);
