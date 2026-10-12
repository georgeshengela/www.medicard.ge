// Read-only: the admin Brain funnel / types / reasons / day series / fatigue counted in Postgres
// (loadBrainPlanStats) against the JS reference on raw rows (the dashboard code before 2026-10-13).
// Prints counts and family/reason names only — never user ids.
//   node --env-file=.env scripts/brain-plan-parity.mjs [7d 30d today ...]
import assert from 'node:assert/strict';
import { prisma } from '../src/lib/prisma.js';
import { fillDaySeries, createdAtToTbilisiYmd, parseAnalyticsRange } from '../src/lib/adminAnalyticsRange.js';
import { loadDecisionRows, loadDecisionRowsByIds } from '../src/lib/notificationDecisions.js';
import { loadOutcomeRows } from '../src/lib/notificationOutcomes.js';
import {
  buildNotificationFunnel,
  buildTypePerformance,
  collapseDecisionPlans,
  loadBrainPlanStats,
  typeRowsPayload,
} from '../src/lib/adminAnalyticsV21.js';

function planDays(range, plans) {
  return {
    suppressed: fillDaySeries(range.days, plans.filter((d) => d.result === 'BLOCKED'), (row) => createdAtToTbilisiYmd(row.createdAt)),
    cancelled: fillDaySeries(range.days, plans.filter((d) => d.result === 'CANCELLED'), (row) => createdAtToTbilisiYmd(row.syncedAt || row.createdAt)),
    planned: fillDaySeries(
      range.days,
      plans.filter((d) => (d.result === 'SEND' || d.result === 'CANCELLED') && !d.superseded),
      (row) => createdAtToTbilisiYmd(row.createdAt),
    ),
  };
}

// The JS reference keeps the first row it meets as the plan's createdAt/syncedAt (day series). Postgres
// returned 7-day rows in createdAt order (index scan) but longer ranges in table order, so the old charts
// moved with the query plan; SQL uses the first run. Sorting here compares that intended rule.
const byCreatedAt = (rows) => rows.slice().sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

async function oldPath(range, now) {
  const [decisions, prevDecisions, outcomes, prevOutcomes] = await Promise.all([
    loadDecisionRows(range.fromDt, range.toExclusiveDt).then(byCreatedAt),
    loadDecisionRows(range.prevFromDt, range.prevToExclusiveDt).then(byCreatedAt),
    loadOutcomeRows(range.fromDt, range.toExclusiveDt),
    loadOutcomeRows(range.prevFromDt, range.prevToExclusiveDt),
  ]);
  const funnel = buildNotificationFunnel(decisions, outcomes, { now });
  const prevFunnel = buildNotificationFunnel(prevDecisions, prevOutcomes, { now });
  const { plans } = collapseDecisionPlans(decisions, now);
  const prevPlans = collapseDecisionPlans(prevDecisions, now).plans;
  const knownIds = new Set(decisions.map((row) => row.decisionId));
  const outsideIds = [...new Set(outcomes.map((row) => row.decisionId).filter((id) => id && !knownIds.has(id)))];
  const outside = outsideIds.length ? await loadDecisionRowsByIds(outsideIds) : [];
  const familyById = new Map(outside.map((row) => [row.decisionId, row.family]));
  const reasons = new Map();
  for (const row of plans) {
    if ((row.result === 'BLOCKED' || row.result === 'CANCELLED') && !row.superseded) {
      const reason = row.reason || 'unspecified';
      reasons.set(reason, (reasons.get(reason) || 0) + 1);
    }
  }
  const latestFatigue = new Map();
  for (const row of decisions) {
    if (row.selectedFrequency || row.baseDailyCap != null) {
      const prev = latestFatigue.get(row.userId);
      if (!prev || new Date(row.createdAt) >= prev.at) {
        latestFatigue.set(row.userId, { at: new Date(row.createdAt), baseDailyCap: row.baseDailyCap, adaptiveDailyCap: row.adaptiveDailyCap });
      }
    }
  }
  const distribution = { normal: 0, reduced: 0, highlyReduced: 0, unknown: 0 };
  for (const row of latestFatigue.values()) {
    const base = Number(row.baseDailyCap);
    const adaptive = Number(row.adaptiveDailyCap);
    if (!Number.isFinite(base) || !Number.isFinite(adaptive)) distribution.unknown += 1;
    else if (adaptive >= base) distribution.normal += 1;
    else if (adaptive <= Math.max(1, Math.floor(base / 3))) distribution.highlyReduced += 1;
    else distribution.reduced += 1;
  }
  return {
    rawRows: decisions.length,
    prevRawRows: prevDecisions.length,
    funnel,
    prevFunnel,
    prevPlans: prevPlans.length,
    types: buildTypePerformance(decisions, outcomes, prevDecisions, prevOutcomes, { now, familyById }).types,
    reasons: Object.fromEntries(reasons),
    fatigue: { sampleUsers: latestFatigue.size, distribution },
    days: planDays(range, plans),
  };
}

async function newPath(range, now) {
  const [cur, prev] = await Promise.all([
    loadBrainPlanStats(range.fromDt, range.toExclusiveDt, { now, outsideFamilies: true }),
    loadBrainPlanStats(range.prevFromDt, range.prevToExclusiveDt, { now, outsideFamilies: false }),
  ]);
  const series = (kind) => fillDaySeries(range.days, cur.days.filter((row) => row.kind === kind), (row) => row.day, (row) => row.count);
  return {
    rawRows: cur.funnel.rawRows,
    prevRawRows: prev.funnel.rawRows,
    funnel: cur.funnel,
    prevFunnel: prev.funnel,
    prevPlans: prev.funnel.evaluated,
    types: typeRowsPayload(cur.types, prev.types),
    reasons: Object.fromEntries(cur.reasons.map((row) => [row.reason, row.count])),
    fatigue: cur.fatigue,
    days: { suppressed: series('suppressed'), cancelled: series('cancelled'), planned: series('planned') },
  };
}

function sortedByFamily(types) {
  return [...types].sort((a, b) => a.family.localeCompare(b.family));
}

const presets = process.argv.slice(2).length ? process.argv.slice(2) : ['7d', '30d', 'today'];
let failed = 0;
for (const preset of presets) {
  const range = parseAnalyticsRange({ range: preset });
  const now = Date.now();
  const tOld = Date.now();
  const before = await oldPath(range, now);
  const oldMs = Date.now() - tOld;
  const tNew = Date.now();
  const after = await newPath(range, now);
  const newMs = Date.now() - tNew;
  const checks = {
    rawRows: [before.rawRows, after.rawRows],
    prevRawRows: [before.prevRawRows, after.prevRawRows],
    funnel: [before.funnel, after.funnel],
    prevFunnel: [before.prevFunnel, after.prevFunnel],
    prevPlans: [before.prevPlans, after.prevPlans],
    types: [sortedByFamily(before.types), sortedByFamily(after.types)],
    typeOrder: [
      before.types.map((row) => `${row.scheduled}/${row.evaluated}`),
      after.types.map((row) => `${row.scheduled}/${row.evaluated}`),
    ],
    reasons: [before.reasons, after.reasons],
    fatigue: [before.fatigue, after.fatigue],
    days: [before.days, after.days],
  };
  const diffs = [];
  for (const [name, [a, b]] of Object.entries(checks)) {
    try {
      assert.deepStrictEqual(b, a);
    } catch {
      diffs.push(name);
    }
  }
  const f = after.funnel;
  console.log(
    `${preset}: ${diffs.length ? `DIFF in ${diffs.join(', ')}` : 'same'} — raw ${after.rawRows} (prev ${after.prevRawRows}), plans ${f.evaluated} (prev ${after.prevPlans}),`,
    `scheduled ${f.scheduled}, due ${f.due}, pending ${f.pending}, superseded ${f.superseded}, delivered ${f.delivered}, opened ${f.opened},`,
    `actioned ${f.actioned}, cancelled ${f.cancelled}, families ${after.types.length}, fatigue users ${after.fatigue.sampleUsers}`,
    `| JS path ${oldMs} ms, SQL path ${newMs} ms`,
  );
  for (const name of diffs) {
    const [a, b] = checks[name];
    console.log(`  ${name}\n    old: ${JSON.stringify(a)}\n    new: ${JSON.stringify(b)}`);
  }
  failed += diffs.length;
}
await prisma.$disconnect();
process.exitCode = failed ? 1 : 0;
