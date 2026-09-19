import { env } from '../config/env.js';
import { prisma } from './prisma.js';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts';
const CHUNK_SIZE = 100;

export function isExpoPushToken(token) {
  return typeof token === 'string' && /^(ExponentPushToken|ExpoPushToken)\[.+\]$/.test(token.trim());
}

/** Expo returns an array, or a single ticket object when only one recipient is sent. */
export function normalizePushTickets(payload) {
  const data = payload?.data;
  if (Array.isArray(data)) return data.filter((ticket) => ticket && typeof ticket === 'object');
  if (data && typeof data === 'object' && (data.status || data.id)) return [data];
  return [];
}

export function tallyPushTickets(tickets, { fallbackSent = 0, fallbackFailed = 0 } = {}) {
  if (!tickets.length) return { sent: fallbackSent, failed: fallbackFailed };
  let sent = 0;
  let failed = 0;
  for (const ticket of tickets) {
    if (String(ticket.status || '').toLowerCase() === 'ok') sent += 1;
    else failed += 1;
  }
  return { sent, failed };
}

export function tokenPreview(token) {
  const value = String(token || '');
  if (value.length <= 28) return value;
  return `${value.slice(0, 22)}…${value.slice(-4)}`;
}

/** iOS APNs only accepts string values in `data`. */
export function stringifyPushData(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
  const out = {};
  for (const [key, value] of Object.entries(data)) {
    if (value == null) continue;
    out[key] = typeof value === 'string' ? value : String(value);
  }
  return out;
}

export function normalizePushReceipts(payload) {
  const data = payload?.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
  return data;
}

export function applyPushReceipts(deliveries, receipts) {
  const next = deliveries.map((row) => {
    const receipt = row.ticketId ? receipts?.[row.ticketId] : null;
    if (!receipt || typeof receipt !== 'object') return row;
    const status = String(receipt.status || '').toLowerCase();
    if (status === 'error') {
      return {
        ...row,
        status: 'error',
        receiptStatus: 'error',
        error: receipt.message || receipt.details?.error || row.error,
      };
    }
    return { ...row, receiptStatus: receipt.status || 'ok' };
  });
  let sent = 0;
  let failed = 0;
  for (const row of next) {
    if (row.status === 'ok') sent += 1;
    else failed += 1;
  }
  return { sent, failed, deliveries: next };
}

export async function fetchExpoPushReceipts(ids, { fetchImpl = fetch } = {}) {
  const unique = [...new Set(ids.filter((id) => typeof id === 'string' && id.trim()))];
  if (!unique.length) return {};
  const response = await fetchImpl(EXPO_RECEIPTS_URL, {
    method: 'POST',
    headers: expoHeaders(),
    body: JSON.stringify({ ids: unique }),
  });
  const payload = await response.json().catch(() => ({}));
  return normalizePushReceipts(payload);
}

function expoHeaders() {
  const headers = {
    Accept: 'application/json',
    'Accept-Encoding': 'gzip, deflate',
    'Content-Type': 'application/json',
  };
  if (env.EXPO_ACCESS_TOKEN) {
    headers.Authorization = `Bearer ${env.EXPO_ACCESS_TOKEN}`;
  }
  return headers;
}

/**
 * @param {string[]} tokens Expo push tokens
 * @param {{ title: string, body: string, data?: Record<string, unknown> }} message
 * @param {{ fetchImpl?: typeof fetch, receiptWaitMs?: number }} [opts]
 */
export async function sendExpoPush(tokens, { title, body, data }, { fetchImpl = fetch, receiptWaitMs = 0 } = {}) {
  const unique = [...new Set(tokens.filter((token) => isExpoPushToken(token)))];
  if (!unique.length) return { sent: 0, failed: 0, tickets: [], deliveries: [] };

  let sent = 0;
  let failed = 0;
  const tickets = [];
  const deliveries = [];
  const payloadData = stringifyPushData(data ?? {});

  for (let i = 0; i < unique.length; i += CHUNK_SIZE) {
    const chunk = unique.slice(i, i + CHUNK_SIZE);
    const messages = chunk.map((to) => ({
      to,
      title,
      body,
      sound: 'default',
      priority: 'high',
      channelId: 'medicard-push',
      data: payloadData,
    }));

    const response = await fetchImpl(EXPO_PUSH_URL, {
      method: 'POST',
      headers: expoHeaders(),
      body: JSON.stringify(messages),
    });

    const payload = await response.json().catch(() => ({}));
    const results = normalizePushTickets(payload);
    const hasTopLevelError = Array.isArray(payload?.errors) && payload.errors.length > 0;
    const tallied = tallyPushTickets(results, {
      fallbackSent: response.ok && !hasTopLevelError ? chunk.length : 0,
      fallbackFailed: !response.ok || hasTopLevelError ? chunk.length : 0,
    });

    sent += tallied.sent;
    failed += tallied.failed;
    tickets.push(...results);

    for (let index = 0; index < chunk.length; index += 1) {
      const ticket = results[index];
      const ok = String(ticket?.status || '').toLowerCase() === 'ok' || (!ticket && response.ok && !hasTopLevelError);
      deliveries.push({
        tokenPreview: tokenPreview(chunk[index]),
        status: ok ? 'ok' : 'error',
        ticketId: ticket?.id || null,
        error: ticket?.message || payload?.errors?.[0]?.message || null,
      });
    }

    const stale = chunk.filter((_, index) => results[index]?.details?.error === 'DeviceNotRegistered');
    if (stale.length) {
      await prisma.pushToken.updateMany({
        where: { token: { in: stale } },
        data: { active: false },
      });
    }
  }

  const ticketIds = deliveries.map((row) => row.ticketId).filter(Boolean);
  if (ticketIds.length && receiptWaitMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, receiptWaitMs));
    try {
      const receipts = await fetchExpoPushReceipts(ticketIds, { fetchImpl });
      const withReceipts = applyPushReceipts(deliveries, receipts);
      sent = withReceipts.sent;
      failed = withReceipts.failed;
      deliveries.length = 0;
      deliveries.push(...withReceipts.deliveries);
      const staleFromReceipts = unique.filter((_, index) => {
        const error = String(withReceipts.deliveries[index]?.error || '');
        return /DeviceNotRegistered/i.test(error);
      });
      if (staleFromReceipts.length) {
        await prisma.pushToken.updateMany({
          where: { token: { in: staleFromReceipts } },
          data: { active: false },
        });
      }
    } catch (error) {
      console.warn('[push] receipts', error);
    }
  }

  return { sent, failed, tickets, deliveries };
}

export async function resolveSegmentTokens(segment) {
  const now = new Date();

  if (segment === 'ALL') {
    const tokens = await prisma.pushToken.findMany({
      where: { active: true },
      select: { token: true },
    });
    return tokens.map((row) => row.token);
  }

  const users = await prisma.user.findMany({
    where: {
      pushTokens: { some: { active: true } },
      ...(segment === 'ACTIVE' ? { status: 'ACTIVE' } : {}),
    },
    include: {
      package: true,
      pushTokens: { where: { active: true }, select: { token: true } },
    },
  });

  const filtered = users.filter((user) => {
    const expired = Boolean(user.packageExpiresAt && user.packageExpiresAt.getTime() < now.getTime());
    const code = expired || !user.package?.code || user.package.code === 'FREE' ? 'FREE' : user.package.code;
    if (segment === 'FREE') return code === 'FREE';
    if (segment === 'STANDARD') return code === 'STANDARD';
    if (segment === 'ULTIMATE') return code === 'ULTIMATE';
    if (segment === 'ACTIVE') return user.status === 'ACTIVE';
    return true;
  });

  return filtered.flatMap((user) => user.pushTokens.map((row) => row.token));
}

export async function getPushStats() {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [devices, users, campaigns, sentAgg, sent24h, deviceRows, platformRows] = await Promise.all([
    prisma.pushToken.count({ where: { active: true } }),
    prisma.pushToken.groupBy({
      by: ['userId'],
      where: { active: true },
      _count: true,
    }),
    prisma.pushCampaign.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: {
        id: true,
        title: true,
        segment: true,
        status: true,
        targetCount: true,
        sentCount: true,
        failedCount: true,
        sentAt: true,
        createdAt: true,
      },
    }),
    prisma.pushCampaign.aggregate({
      _sum: { sentCount: true, failedCount: true, targetCount: true },
      _count: true,
    }),
    prisma.pushCampaign.aggregate({
      where: { sentAt: { gte: since24h } },
      _sum: { sentCount: true },
    }),
    prisma.pushToken.findMany({
      where: { active: true },
      orderBy: { lastSeenAt: 'desc' },
      take: 24,
      select: {
        id: true,
        platform: true,
        lastSeenAt: true,
        createdAt: true,
        user: { select: { fullName: true, email: true } },
      },
    }),
    prisma.pushToken.groupBy({
      by: ['platform'],
      where: { active: true },
      _count: true,
    }),
  ]);

  const platforms = { ios: 0, android: 0, web: 0 };
  for (const row of platformRows) {
    const key = String(row.platform || '').toLowerCase();
    if (key in platforms) platforms[key] = Number(row._count?._all ?? row._count ?? 0);
  }

  return {
    activeDevices: devices,
    subscribedUsers: users.length,
    recentCampaigns: campaigns,
    totalSent: sentAgg._sum.sentCount ?? 0,
    totalFailed: sentAgg._sum.failedCount ?? 0,
    totalTarget: sentAgg._sum.targetCount ?? 0,
    campaignCount: sentAgg._count,
    sentLast24h: sent24h._sum.sentCount ?? 0,
    devices: deviceRows,
    platforms,
  };
}
