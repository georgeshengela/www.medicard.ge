import { prisma } from './prisma.js';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const CHUNK_SIZE = 100;

/**
 * @param {string[]} tokens Expo push tokens
 * @param {{ title: string, body: string, data?: Record<string, unknown> }} message
 */
export async function sendExpoPush(tokens, { title, body, data }) {
  const unique = [...new Set(tokens.filter(Boolean))];
  if (!unique.length) return { sent: 0, failed: 0, tickets: [] };

  let sent = 0;
  let failed = 0;
  const tickets = [];

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

    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    const payload = await response.json().catch(() => ({}));
    const results = Array.isArray(payload?.data) ? payload.data : [];

    for (const ticket of results) {
      tickets.push(ticket);
      if (ticket.status === 'ok') sent += 1;
      else failed += 1;
    }

    if (!results.length && !response.ok) {
      failed += chunk.length;
    }
  }

  return { sent, failed, tickets };
}

export async function resolveSegmentTokens(segment) {
  const now = new Date();

  if (segment === 'ALL') {
    const tokens = await prisma.pushToken.findMany({
      where: { active: true },
      select: { token: true },
    });
    return tokens.map((t) => t.token);
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

  return filtered.flatMap((user) => user.pushTokens.map((t) => t.token));
}

export async function getPushStats() {
  const [devices, users, campaigns] = await Promise.all([
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
  ]);

  return {
    activeDevices: devices,
    subscribedUsers: users.length,
    recentCampaigns: campaigns,
  };
}
