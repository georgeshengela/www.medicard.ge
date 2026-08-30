import { env } from '../config/env.js';
import { prisma } from './prisma.js';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
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
 * @param {{ fetchImpl?: typeof fetch }} [opts]
 */
export async function sendExpoPush(tokens, { title, body, data }, { fetchImpl = fetch } = {}) {
  const unique = [...new Set(tokens.filter((token) => isExpoPushToken(token)))];
  if (!unique.length) return { sent: 0, failed: 0, tickets: [], deliveries: [] };

  let sent = 0;
  let failed = 0;
  const tickets = [];
  const deliveries = [];

  for (let i = 0; i < unique.length; i += CHUNK_SIZE) {
    const chunk = unique.slice(i, i + CHUNK_SIZE);
    const messages = chunk.map((to) => ({
      to,
      title,
      body,
      sound: 'default',
      priority: 'high',
      channelId: 'medicard-push',
      data: data ?? {},
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
  const [devices, users, campaigns, sentAgg, sent24h, deviceRows] = await Promise.all([
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
  ]);

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
  };
}
