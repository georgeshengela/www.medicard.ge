/**
 * Command Center status + feature-share helpers.
 * Deterministic. No scores, no LLM, no invented anomalies.
 */

export function featureShareOfActive(featureUserIds, activeUserIds) {
  const active = new Set([...activeUserIds].filter(Boolean));
  const feature = new Set([...featureUserIds].filter(Boolean));
  let amongActive = 0;
  for (const id of feature) {
    if (active.has(id)) amongActive += 1;
  }
  const pctOfActive = active.size <= 0
    ? null
    : Math.round((amongActive / active.size) * 1000) / 10;
  return {
    featureUsers: feature.size,
    amongActive,
    activeUsers: active.size,
    pctOfActive,
  };
}

const SEV_RANK = { critical: 0, warning: 1, info: 2 };

function pushUnique(items, seen, item) {
  const key = item.key || item.title;
  if (!key || seen.has(key)) return;
  seen.add(key);
  items.push(item);
}

function polishAttention(raw) {
  if (raw?.metric?.orphanOutcomes != null) {
    return {
      title: 'შედეგები გადაწყვეტილების გარეშე',
      detail: `${raw.metric.orphanOutcomes} შეტყობინების შედეგს არ აქვს შესაბამისი გადაწყვეტილება.`,
    };
  }
  return {
    title: raw.title,
    detail: raw.detail,
  };
}

/**
 * One resolver for top status + attention list.
 *
 * degraded  — DB/API down or maintenance
 * attention — any warning (including any AI error in the last 24h)
 * healthy   — no critical or warning
 */
export function resolveCommandCenterStatus({
  dbOk = true,
  apiOk = true,
  maintenanceMode = false,
  forceUpdate = false,
  aiErrors24h = 0,
  aiLast24h = 0,
  smsFailed24h = 0,
  lastSyncFailed = false,
  failedCampaigns24h = 0,
  attention = [],
} = {}) {
  const items = [];
  const seen = new Set();

  if (dbOk === false) {
    pushUnique(items, seen, {
      key: 'db',
      severity: 'critical',
      title: 'ბაზა არ პასუხობს',
      detail: 'მონაცემთა ბაზის შემოწმება ჩაიშალა.',
      href: '#/quality',
    });
  }
  if (apiOk === false) {
    pushUnique(items, seen, {
      key: 'api',
      severity: 'critical',
      title: 'API არ პასუხობს',
      detail: 'სისტემის ჯანმრთელობის შემოწმება ჩაიშალა.',
      href: '#/quality',
    });
  }
  if (maintenanceMode) {
    pushUnique(items, seen, {
      key: 'maintenance',
      severity: 'critical',
      title: 'ტექნიკური რეჟიმი ჩართულია',
      detail: 'API უარყოფს არაადმინურ ტრაფიკს.',
      href: '#/settings',
    });
  }
  if (forceUpdate) {
    pushUnique(items, seen, {
      key: 'force-update',
      severity: 'warning',
      title: 'იძულებითი განახლება ჩართულია',
      detail: 'ძველი აპის ვერსიები API-ს ვერ გამოიყენებს.',
      href: '#/settings',
    });
  }
  if (Number(aiErrors24h) > 0) {
    const n = Number(aiErrors24h);
    const req = Number(aiLast24h) || 0;
    pushUnique(items, seen, {
      key: 'ai-errors',
      severity: 'warning',
      title: 'AI შეცდომები',
      detail: req
        ? `${n} შეცდომა ბოლო 24 საათში · ${req} მოთხოვნიდან.`
        : `${n} შეცდომა ბოლო 24 საათში.`,
      href: '#/ai',
      period: 'ბოლო 24სთ',
      value: n,
    });
  }
  if (Number(smsFailed24h) >= 3) {
    pushUnique(items, seen, {
      key: 'sms',
      severity: 'warning',
      title: 'SMS შეცდომები',
      detail: `${smsFailed24h} SMS ვერ გაიგზავნა ბოლო 24 საათში.`,
      href: '#/sms',
      period: 'ბოლო 24სთ',
      value: smsFailed24h,
    });
  }
  if (lastSyncFailed) {
    pushUnique(items, seen, {
      key: 'pharmacy-sync',
      severity: 'warning',
      title: 'ფარმაციის ბოლო სინქი ჩაიშალა',
      detail: 'აფთიაქის სინქრონიზაცია წარუმატებელია.',
      href: '#/pharmacy',
    });
  }
  if (Number(failedCampaigns24h) > 0) {
    pushUnique(items, seen, {
      key: 'push-failed',
      severity: 'warning',
      title: 'Push კამპანია ჩაიშალა',
      detail: `${failedCampaigns24h} კამპანია მონიშნულია წარუმატებლად ბოლო 24 საათში.`,
      href: '#/push',
      period: 'ბოლო 24სთ',
    });
  }

  for (const raw of attention || []) {
    if (!raw?.title) continue;
    if (/AI შეცდომ/i.test(raw.title) && seen.has('ai-errors')) continue;
    if (raw.severity === 'info') continue;
    const polished = polishAttention(raw);
    pushUnique(items, seen, {
      key: `${raw.href || ''}:${raw.title}`,
      severity: raw.severity === 'critical' ? 'critical' : 'warning',
      title: polished.title,
      detail: polished.detail,
      href: raw.href || '#/quality',
      period: raw.period,
      value: raw.n,
    });
  }

  items.sort((a, b) => (SEV_RANK[a.severity] ?? 9) - (SEV_RANK[b.severity] ?? 9));
  const level = items.some((i) => i.severity === 'critical')
    ? 'degraded'
    : items.some((i) => i.severity === 'warning')
      ? 'attention'
      : 'healthy';

  return {
    level,
    items,
    reasons: items.slice(0, 4).map((i) => i.title),
  };
}

export const COMMAND_CENTER_STATUS_KA = {
  healthy: { label: 'გამართული', summary: 'კრიტიკული წარმოების პრობლემა არ ჩანს.' },
  attention: { label: 'საჭიროა ყურადღება', summary: 'ქვემოთ ჩამოთვლილი სიგნალები საჭიროებს შემოწმებას.' },
  degraded: { label: 'დეგრადირებული', summary: 'სისტემა ან მონაცემთა ბაზა არ მუშაობს ნორმალურად.' },
};
