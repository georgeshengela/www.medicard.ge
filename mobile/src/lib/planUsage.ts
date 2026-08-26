import { ka } from '@/i18n/ka';
import { formatDate } from '@/lib/format';
import type { Usage } from '@/lib/api';
import { useAuth } from '@/store/AuthContext';

export type PlanCode = 'FREE' | 'STANDARD' | 'ULTIMATE';

export function planMeta(code: PlanCode) {
  if (code === 'ULTIMATE') {
    return { title: ka.profile.ultimatePlan, detail: ka.profile.ultimatePlanDetail, accent: 'success' as const };
  }
  if (code === 'STANDARD') {
    return { title: ka.profile.standardPlan, detail: ka.profile.standardPlanDetail, accent: 'brand' as const };
  }
  return { title: ka.profile.freePlan, detail: ka.profile.freePlanDetail, accent: 'neutral' as const };
}

export type PlanUsageSnapshot = {
  code: PlanCode;
  meta: ReturnType<typeof planMeta>;
  usage: Usage | null;
  limit: number;
  unlimited: boolean;
  remaining: number | null;
  exhausted: boolean;
  progress: number;
  started: string | null;
  expires: string | null;
  expired: boolean;
  quotaLabel: string;
};

export function buildPlanUsage(user: ReturnType<typeof useAuth>['user'], usage: Usage | null): PlanUsageSnapshot {
  const code = (user?.package?.code ?? 'FREE') as PlanCode;
  const meta = planMeta(code);

  const limit =
    user?.package?.monthlyAiLimit ?? user?.package?.dailyAiLimit ?? usage?.limit ?? 90;
  const unlimited = Boolean(usage?.unlimited || user?.package?.unlimited || limit < 0);
  const remaining = unlimited ? null : (usage?.remaining ?? limit);
  const exhausted = !unlimited && remaining === 0;
  const progress = unlimited ? 1 : limit > 0 ? Math.min(1, Math.max(0, (remaining ?? 0) / limit)) : 0;

  const started = user?.packageStartedAt ? formatDate(user.packageStartedAt) : null;
  const expires = user?.packageExpiresAt ? formatDate(user.packageExpiresAt) : null;
  const expired =
    Boolean(user?.packageExpiresAt && new Date(user.packageExpiresAt).getTime() < Date.now());

  const quotaLabel = exhausted
    ? ka.usage.exhaustedTitle
    : unlimited
      ? ka.usage.unlimitedBanner
      : `${remaining} / ${limit} ${ka.usage.queries}`;

  return {
    code,
    meta,
    usage,
    limit,
    unlimited,
    remaining,
    exhausted,
    progress,
    started,
    expires,
    expired,
    quotaLabel,
  };
}

export function usePlanUsage(): PlanUsageSnapshot {
  const { user, usage } = useAuth();
  return buildPlanUsage(user, usage);
}
