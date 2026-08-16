import { env } from '../config/env.js';
import { prisma } from './prisma.js';
import { todayKey } from './usage.js';

const TIMEOUT_MS = 10_000;
const CACHE_MS = 30_000;

let cache = { at: 0, data: null };

function withTimeout(ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return { signal: ctrl.signal, done: () => clearTimeout(timer) };
}

async function fetchJson(url, headers) {
  const wait = withTimeout(TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers, signal: wait.signal });
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = null; }
    return { ok: res.ok, status: res.status, json };
  } finally {
    wait.done();
  }
}

function money(value) {
  if (value == null || Number.isNaN(Number(value))) return null;
  return Math.round(Number(value) * 1e6) / 1e6;
}

function pickNum(obj, keys) {
  if (!obj || typeof obj !== 'object') return null;
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return null;
}

export async function getOpenRouterBalance() {
  const configured = Boolean(env.OPENROUTER_API_KEY);
  const base = env.OPENROUTER_BASE_URL.replace(/\/$/, '');
  const model = env.OPENROUTER_MODEL;
  const dashboardUrl = 'https://openrouter.ai/settings/credits';

  if (!configured) {
    return {
      id: 'openrouter',
      name: 'OpenRouter',
      role: 'vision',
      configured: false,
      ok: false,
      remaining: null,
      total: null,
      used: null,
      usedDaily: null,
      usedWeekly: null,
      usedMonthly: null,
      currency: 'USD',
      model,
      dashboardUrl,
      error: 'OPENROUTER_API_KEY არ არის',
    };
  }

  const headers = { Authorization: `Bearer ${env.OPENROUTER_API_KEY}`, Accept: 'application/json' };
  const [credits, key] = await Promise.all([
    fetchJson(`${base}/credits`, headers),
    fetchJson(`${base}/key`, headers),
  ]);

  const creditData = credits.json?.data ?? credits.json;
  const keyData = key.json?.data ?? key.json;
  const total = money(pickNum(creditData, ['total_credits', 'totalCredits']));
  const used = money(pickNum(creditData, ['total_usage', 'totalUsage']) ?? pickNum(keyData, ['usage']));
  const remaining = total != null && used != null ? money(total - used) : money(pickNum(keyData, ['limit_remaining']));

  if (!credits.ok && !key.ok) {
    return {
      id: 'openrouter',
      name: 'OpenRouter',
      role: 'vision',
      configured: true,
      ok: false,
      remaining: null,
      total: null,
      used: null,
      usedDaily: null,
      usedWeekly: null,
      usedMonthly: null,
      currency: 'USD',
      model,
      dashboardUrl,
      error: credits.json?.error?.message || `HTTP ${credits.status}`,
    };
  }

  return {
    id: 'openrouter',
    name: 'OpenRouter',
    role: 'vision',
    configured: true,
    ok: Boolean(credits.ok || key.ok),
    tone: remaining == null ? 'warn' : remaining <= 0 ? 'bad' : remaining < 2 ? 'warn' : 'ok',
    remaining,
    total,
    used,
    usedDaily: money(pickNum(keyData, ['usage_daily'])),
    usedWeekly: money(pickNum(keyData, ['usage_weekly'])),
    usedMonthly: money(pickNum(keyData, ['usage_monthly'])),
    currency: 'USD',
    model,
    dashboardUrl,
    error: remaining == null ? 'ბალანსი ვერ წაიკითხა' : null,
  };
}

export async function getEvidenceMdBalance() {
  const configured = Boolean(env.EVIDENCEMD_API_KEY);
  const base = env.EVIDENCEMD_BASE_URL.replace(/\/$/, '');
  const model = env.EVIDENCEMD_MODEL;
  const dashboardUrl = 'https://evidencemd.ai/developers';
  const creditsPerCall = 4;

  const empty = {
    id: 'evidencemd',
    name: 'EvidenceMD',
    role: 'chat',
    configured,
    ok: false,
    remaining: null,
    remainingSource: null,
    usedToday: 0,
    usedAll: 0,
    creditsPerCall,
    estimatedCreditsToday: 0,
    currency: 'credits',
    model,
    dashboardUrl,
    error: configured ? null : 'EVIDENCEMD_API_KEY არ არის',
  };

  if (!configured) return empty;

  const headers = { 'x-api-key': env.EVIDENCEMD_API_KEY, Accept: 'application/json' };
  const date = todayKey();

  const [models, credits, todayAgg, allAgg] = await Promise.all([
    fetchJson(`${base}/models`, headers),
    fetchJson(`${base}/credits`, headers),
    prisma.dailyUsage.aggregate({ _sum: { count: true }, where: { date } }),
    prisma.dailyUsage.aggregate({ _sum: { count: true } }),
  ]);

  const usedToday = todayAgg._sum.count ?? 0;
  const usedAll = allAgg._sum.count ?? 0;
  const creditData = credits.ok ? (credits.json?.data ?? credits.json) : null;
  const remaining = money(pickNum(creditData, [
    'remaining', 'balance', 'credits', 'credits_remaining', 'remaining_credits',
  ]));

  return {
    ...empty,
    ok: models.ok,
    tone: !models.ok ? 'bad' : remaining != null && remaining <= 0 ? 'bad' : 'ok',
    remaining,
    remainingSource: remaining != null ? 'api' : null,
    usedToday,
    usedAll,
    estimatedCreditsToday: usedToday * creditsPerCall,
    error: models.ok
      ? (remaining == null ? 'EvidenceMD-ს საჯარო ბალანსის API არ აქვს — ნაჩვენებია Medicard-ის გამოყენება' : null)
      : (credits.json?.error || `HTTP ${models.status}`),
  };
}

export async function getProviderBalances({ fresh = false } = {}) {
  const now = Date.now();
  if (!fresh && cache.data && now - cache.at < CACHE_MS) return cache.data;

  const [openrouter, evidencemd] = await Promise.all([
    getOpenRouterBalance().catch((err) => ({
      id: 'openrouter',
      name: 'OpenRouter',
      role: 'vision',
      configured: Boolean(env.OPENROUTER_API_KEY),
      ok: false,
      remaining: null,
      error: err.message,
      dashboardUrl: 'https://openrouter.ai/settings/credits',
      model: env.OPENROUTER_MODEL,
      currency: 'USD',
    })),
    getEvidenceMdBalance().catch((err) => ({
      id: 'evidencemd',
      name: 'EvidenceMD',
      role: 'chat',
      configured: Boolean(env.EVIDENCEMD_API_KEY),
      ok: false,
      remaining: null,
      error: err.message,
      dashboardUrl: 'https://evidencemd.ai/developers',
      model: env.EVIDENCEMD_MODEL,
      currency: 'credits',
    })),
  ]);

  cache = { at: now, data: { openrouter, evidencemd, fetchedAt: new Date().toISOString() } };
  return cache.data;
}
